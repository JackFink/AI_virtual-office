"""
Google Drive Direct Cloud Client (REST API v3 · Pure Python Stdlib)
Supports two official Google OAuth 2.0 authentication methods without third-party pip packages:
1. One-click Google Cloud SDK OAuth (`gcloud auth login --enable-gdrive-access`) — zero client_secret setup required
2. Standard OAuth 2.0 Desktop/Web Client (`config/cli/gdrive_oauth_client.json` + PKCE callback -> `gdrive_token.json`)
"""
from __future__ import annotations

import base64
import hashlib
import json
import mimetypes
import os
import re
import secrets
import shutil
import subprocess
import threading
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from backend.config_paths import (
    GDRIVE_OAUTH_CLIENT_FILE,
    GDRIVE_TOKEN_FILE,
    LOGIN_SCRIPTS_DIR,
    ROOT,
)

DRIVE_API_BASE = "https://www.googleapis.com/drive/v3"
DRIVE_UPLOAD_BASE = "https://www.googleapis.com/upload/drive/v3"
OAUTH_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token"
OAUTH_TOKENINFO_URL = "https://oauth2.googleapis.com/tokeninfo"
DRIVE_SCOPES = "openid email profile https://www.googleapis.com/auth/drive"

_LOCK = threading.Lock()
_PENDING_OAUTH: Dict[str, Dict[str, Any]] = {}
_GCLOUD_CACHE: Dict[str, Any] = {
    "checked_at": 0.0,
    "has_drive_scope": False,
    "access_token": None,
    "email": None,
    "display_name": None,
}


def invalidate_gdrive_cache() -> None:
    with _LOCK:
        _GCLOUD_CACHE["checked_at"] = 0.0
        _GCLOUD_CACHE["has_drive_scope"] = False
        _GCLOUD_CACHE["access_token"] = None


def resolve_gcloud_exe() -> Optional[str]:
    for cmd_name in ("gcloud.cmd", "gcloud"):
        found = shutil.which(cmd_name)
        if found:
            return str(Path(found).resolve())
    if os.name == "nt":
        candidates = [
            Path(os.environ.get("ProgramFiles(x86)", r"C:\Program Files (x86)"))
            / "Google" / "Cloud SDK" / "google-cloud-sdk" / "bin" / "gcloud.cmd",
            Path(os.environ.get("ProgramFiles", r"C:\Program Files"))
            / "Google" / "Cloud SDK" / "google-cloud-sdk" / "bin" / "gcloud.cmd",
            Path(os.environ.get("LOCALAPPDATA", ""))
            / "Google" / "Cloud SDK" / "google-cloud-sdk" / "bin" / "gcloud.cmd",
        ]
        for c in candidates:
            if c.exists() and c.is_file():
                return str(c.resolve())
    return None


def _load_oauth_client_config() -> Optional[Dict[str, str]]:
    if not GDRIVE_OAUTH_CLIENT_FILE.exists():
        return None
    try:
        raw = json.loads(GDRIVE_OAUTH_CLIENT_FILE.read_text(encoding="utf-8"))
        block = raw.get("installed") or raw.get("web") or raw
        if isinstance(block, dict):
            cid = str(block.get("client_id") or "").strip()
            csec = str(block.get("client_secret") or "").strip()
            if cid and "YOUR_GOOGLE_OAUTH_CLIENT_ID" not in cid:
                return {
                    "client_id": cid,
                    "client_secret": csec,
                    "auth_uri": str(block.get("auth_uri") or OAUTH_AUTH_URL),
                    "token_uri": str(block.get("token_uri") or OAUTH_TOKEN_URL),
                }
    except Exception:
        pass
    return None


def save_oauth_client_json(raw_json_str: str) -> Dict[str, Any]:
    try:
        parsed = json.loads(raw_json_str)
    except Exception as exc:
        raise ValueError(f"유효한 JSON 형식이 아닙니다: {exc}") from exc
    if not isinstance(parsed, dict):
        raise ValueError("Google OAuth client_secret JSON 객체가 필요합니다.")
    block = parsed.get("installed") or parsed.get("web") or parsed
    cid = str((block or {}).get("client_id") or "").strip()
    csec = str((block or {}).get("client_secret") or "").strip()
    if not cid or not csec:
        raise ValueError("JSON 안에 'client_id'와 'client_secret' 항목이 포함되어 있어야 합니다.")
    GDRIVE_OAUTH_CLIENT_FILE.parent.mkdir(parents=True, exist_ok=True)
    GDRIVE_OAUTH_CLIENT_FILE.write_text(json.dumps(parsed, ensure_ascii=False, indent=2), encoding="utf-8")
    return {"ok": True, "client_id_preview": cid[:18] + "..."}


def build_oauth_authorize_url(redirect_uri: str) -> str:
    client = _load_oauth_client_config()
    if not client:
        raise ValueError(
            "OAuth 클라이언트 설정(client_secret.json)이 아직 등록되지 않았습니다. "
            "Google Cloud SDK 원클릭 로그인을 사용하거나 client_secret.json을 먼저 등록해 주세요."
        )
    verifier_bytes = secrets.token_bytes(32)
    code_verifier = base64.urlsafe_b64encode(verifier_bytes).decode("ascii").rstrip("=")
    digest = hashlib.sha256(code_verifier.encode("ascii")).digest()
    code_challenge = base64.urlsafe_b64encode(digest).decode("ascii").rstrip("=")
    state = secrets.token_urlsafe(24)

    with _LOCK:
        now = time.time()
        expired_states = [k for k, v in _PENDING_OAUTH.items() if now - v.get("created_at", 0) > 900]
        for k in expired_states:
            _PENDING_OAUTH.pop(k, None)
        _PENDING_OAUTH[state] = {
            "code_verifier": code_verifier,
            "redirect_uri": redirect_uri,
            "created_at": now,
        }

    params = {
        "client_id": client["client_id"],
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": DRIVE_SCOPES,
        "access_type": "offline",
        "include_granted_scopes": "true",
        "prompt": "consent",
        "state": state,
        "code_challenge": code_challenge,
        "code_challenge_method": "S256",
    }
    return f"{client['auth_uri']}?{urlencode(params)}"


def _fetch_drive_about_user(access_token: str) -> Tuple[Optional[str], Optional[str]]:
    req = Request(
        f"{DRIVE_API_BASE}/about?fields=user(emailAddress,displayName)",
        headers={"Authorization": f"Bearer {access_token}", "Accept": "application/json"},
    )
    with urlopen(req, timeout=8) as resp:
        data = json.loads(resp.read().decode("utf-8"))
        u = data.get("user") or {}
        return u.get("emailAddress"), u.get("displayName")


def exchange_oauth_code(code: str, state: str, fallback_redirect_uri: str) -> Dict[str, Any]:
    client = _load_oauth_client_config()
    if not client:
        raise ValueError("OAuth 클라이언트 설정(gdrive_oauth_client.json)을 찾을 수 없습니다.")
    with _LOCK:
        pending = _PENDING_OAUTH.pop(state, None)
    if not pending:
        raise ValueError("OAuth 인증 세션(state)이 만료되었거나 유효하지 않습니다. 다시 시도해 주세요.")

    form_data = urlencode(
        {
            "client_id": client["client_id"],
            "client_secret": client["client_secret"],
            "code": code,
            "code_verifier": pending["code_verifier"],
            "grant_type": "authorization_code",
            "redirect_uri": pending.get("redirect_uri") or fallback_redirect_uri,
        }
    ).encode("utf-8")
    req = Request(
        client["token_uri"],
        data=form_data,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        method="POST",
    )
    try:
        with urlopen(req, timeout=10) as resp:
            tok_data = json.loads(resp.read().decode("utf-8"))
    except HTTPError as exc:
        err_body = exc.read().decode("utf-8", errors="replace")
        raise ValueError(f"토큰 교환 실패 ({exc.code}): {err_body[:200]}") from exc

    access_tok = tok_data.get("access_token")
    if not access_tok:
        raise ValueError("액세스 토큰을 발급받지 못했습니다.")

    email, display_name = None, None
    try:
        email, display_name = _fetch_drive_about_user(access_tok)
    except Exception:
        pass

    existing_refresh = None
    if GDRIVE_TOKEN_FILE.exists():
        try:
            old = json.loads(GDRIVE_TOKEN_FILE.read_text(encoding="utf-8"))
            existing_refresh = old.get("refresh_token")
        except Exception:
            pass

    saved_payload = {
        "access_token": access_tok,
        "refresh_token": tok_data.get("refresh_token") or existing_refresh,
        "expires_at": time.time() + float(tok_data.get("expires_in", 3500)),
        "scope": tok_data.get("scope", DRIVE_SCOPES),
        "email": email,
        "display_name": display_name,
        "updated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }
    GDRIVE_TOKEN_FILE.parent.mkdir(parents=True, exist_ok=True)
    GDRIVE_TOKEN_FILE.write_text(json.dumps(saved_payload, ensure_ascii=False, indent=2), encoding="utf-8")
    invalidate_gdrive_cache()
    return saved_payload


def _get_oauth_file_token() -> Optional[Tuple[str, Optional[str], Optional[str]]]:
    if not GDRIVE_TOKEN_FILE.exists():
        return None
    try:
        tok = json.loads(GDRIVE_TOKEN_FILE.read_text(encoding="utf-8"))
        if not isinstance(tok, dict):
            return None
        access_tok = str(tok.get("access_token") or "").strip()
        expires_at = float(tok.get("expires_at") or 0)
        email = tok.get("email")
        dname = tok.get("display_name")
        if access_tok and time.time() < expires_at - 60:
            return access_tok, email, dname

        refresh_tok = str(tok.get("refresh_token") or "").strip()
        client = _load_oauth_client_config()
        if refresh_tok and client:
            form_data = urlencode(
                {
                    "client_id": client["client_id"],
                    "client_secret": client["client_secret"],
                    "refresh_token": refresh_tok,
                    "grant_type": "refresh_token",
                }
            ).encode("utf-8")
            req = Request(
                client["token_uri"],
                data=form_data,
                headers={"Content-Type": "application/x-www-form-urlencoded"},
                method="POST",
            )
            with urlopen(req, timeout=8) as resp:
                refreshed = json.loads(resp.read().decode("utf-8"))
            new_access = str(refreshed.get("access_token") or "").strip()
            if new_access:
                tok["access_token"] = new_access
                tok["expires_at"] = time.time() + float(refreshed.get("expires_in", 3500))
                GDRIVE_TOKEN_FILE.write_text(json.dumps(tok, ensure_ascii=False, indent=2), encoding="utf-8")
                return new_access, email, dname
    except Exception:
        pass
    return None


def _probe_gcloud_drive_token(force_refresh: bool = False) -> Dict[str, Any]:
    now = time.time()
    with _LOCK:
        ttl = 2100.0 if _GCLOUD_CACHE["has_drive_scope"] else 25.0
        if not force_refresh and (now - _GCLOUD_CACHE["checked_at"] < ttl):
            return dict(_GCLOUD_CACHE)

    gcloud_exe = resolve_gcloud_exe()
    if not gcloud_exe:
        res = {"checked_at": now, "has_drive_scope": False, "access_token": None, "email": None, "display_name": None}
        with _LOCK:
            _GCLOUD_CACHE.update(res)
        return res

    try:
        proc = subprocess.run(
            [gcloud_exe, "auth", "print-access-token"],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=6.0,
            shell=False,
        )
        tok = (proc.stdout or "").strip()
        if proc.returncode != 0 or not tok:
            res = {"checked_at": now, "has_drive_scope": False, "access_token": None, "email": None, "display_name": None}
            with _LOCK:
                _GCLOUD_CACHE.update(res)
            return res

        # Check token scopes & email
        with urlopen(f"{OAUTH_TOKENINFO_URL}?access_token={tok}", timeout=5) as r:
            info = json.loads(r.read().decode("utf-8"))
        scopes_str = str(info.get("scope") or "")
        email = info.get("email")
        has_drive = "googleapis.com/auth/drive" in scopes_str
        dname = None
        if has_drive:
            try:
                d_email, d_name = _fetch_drive_about_user(tok)
                email = d_email or email
                dname = d_name
            except Exception:
                pass
        res = {
            "checked_at": now,
            "has_drive_scope": has_drive,
            "access_token": tok if has_drive else None,
            "email": email,
            "display_name": dname,
        }
        with _LOCK:
            _GCLOUD_CACHE.update(res)
        return res
    except Exception:
        res = {"checked_at": now, "has_drive_scope": False, "access_token": None, "email": None, "display_name": None}
        with _LOCK:
            _GCLOUD_CACHE.update(res)
        return res


def get_valid_access_token(force_refresh: bool = False) -> Tuple[Optional[str], str, Optional[str], Optional[str]]:
    """Returns (access_token, auth_mode, email, display_name)."""
    oauth_res = _get_oauth_file_token()
    if oauth_res:
        return oauth_res[0], "oauth_client", oauth_res[1], oauth_res[2]

    gc_res = _probe_gcloud_drive_token(force_refresh=force_refresh)
    if gc_res.get("has_drive_scope") and gc_res.get("access_token"):
        return gc_res["access_token"], "gcloud_drive", gc_res.get("email"), gc_res.get("display_name")

    return None, "none", gc_res.get("email"), None


def get_gdrive_connection_status(force_refresh: bool = False) -> Dict[str, Any]:
    gcloud_exe = resolve_gcloud_exe()
    oauth_client = _load_oauth_client_config()
    tok, mode, email, dname = get_valid_access_token(force_refresh=force_refresh)
    connected = bool(tok and mode != "none")

    return {
        "connected": connected,
        "auth_mode": mode,
        "account_email": email if connected else None,
        "gcloud_pending_email": email if (not connected and email) else None,
        "display_name": dname,
        "gcloud_installed": bool(gcloud_exe),
        "oauth_client_configured": bool(oauth_client),
    }


def launch_gcloud_drive_login() -> Dict[str, Any]:
    gcloud_exe = resolve_gcloud_exe()
    if not gcloud_exe:
        return {
            "ok": False,
            "error": "Google Cloud SDK(gcloud)가 설치되어 있지 않습니다. OAuth client_secret.json 등록 방식을 사용해 주세요.",
        }
    invalidate_gdrive_cache()
    if os.name == "nt":
        LOGIN_SCRIPTS_DIR.mkdir(parents=True, exist_ok=True)
        bat_path = LOGIN_SCRIPTS_DIR / "login_helper_gdrive.cmd"
        lines = [
            "@echo off",
            "chcp 65001 >nul",
            "title [NEXUS Virtual Office] Google Drive 직접 연결 로그인 도우미",
            "echo ======================================================================",
            "echo   [Google Drive 직접 연결] 구글 계정 브라우저 권한 승인 (OAuth 2.0)",
            "echo ======================================================================",
            "echo.",
            "echo   잠시 후 웹 브라우저가 열리면 연결할 구글 계정을 선택하고",
            "echo   [Google Drive 파일 보기/관리 권한]을 허용(Allow)해 주세요!",
            "echo   승인이 완료되면 버추얼 오피스 화면으로 돌아가 [상태 새로고침]을 눌러주세요.",
            "echo ======================================================================",
            "echo.",
            f'call "{gcloud_exe}" auth login --enable-gdrive-access',
            "echo.",
            "echo [완료] Google Drive 직접 연결 승인이 완료되었습니다. 이 창을 닫으셔도 됩니다.",
            "pause",
        ]
        bat_path.write_text("\r\n".join(lines), encoding="utf-8")
        subprocess.Popen(
            ["cmd.exe", "/c", "start", "", str(bat_path.resolve())],
            cwd=str(ROOT),
            shell=False,
        )
        return {
            "ok": True,
            "message": "새 터미널 창과 웹 브라우저에서 Google Drive 권한 승인 창을 열었습니다. 브라우저에서 허용(Allow) 후 [🔄 연결 확인]을 눌러주세요!",
        }
    return {
        "ok": False,
        "error": f"터미널에서 '{gcloud_exe} auth login --enable-gdrive-access' 명령을 실행해 주세요.",
    }


def disconnect_gdrive() -> Dict[str, Any]:
    if GDRIVE_TOKEN_FILE.exists():
        try:
            GDRIVE_TOKEN_FILE.unlink()
        except OSError:
            pass
    invalidate_gdrive_cache()
    return {"ok": True, "message": "저장된 OAuth 토큰 연결을 해제했습니다."}


def _drive_api_json(
    method: str,
    url: str,
    body_obj: Optional[Dict[str, Any]] = None,
    raw_body: Optional[bytes] = None,
    content_type: str = "application/json; charset=UTF-8",
) -> Dict[str, Any]:
    tok, _, _, _ = get_valid_access_token()
    if not tok:
        raise PermissionError("Google Drive에 아직 로그인/연결되어 있지 않습니다. 먼저 [🔑 Google Drive 직접 로그인]을 진행해 주세요.")

    data_bytes = raw_body if raw_body is not None else (
        json.dumps(body_obj, ensure_ascii=False).encode("utf-8") if body_obj is not None else None
    )
    headers = {
        "Authorization": f"Bearer {tok}",
        "Accept": "application/json",
    }
    if data_bytes is not None:
        headers["Content-Type"] = content_type

    req = Request(url, data=data_bytes, headers=headers, method=method)
    try:
        with urlopen(req, timeout=25) as resp:
            raw = resp.read().decode("utf-8")
            return json.loads(raw) if raw.strip() else {}
    except HTTPError as exc:
        err_txt = exc.read().decode("utf-8", errors="replace")
        if exc.code in (401, 403):
            invalidate_gdrive_cache()
        raise RuntimeError(f"Google Drive API 오류 ({exc.code}): {err_txt[:240]}") from exc
    except URLError as exc:
        raise RuntimeError(f"Google Drive 네트워크 연결 실패: {exc}") from exc


def extract_folder_id_from_input(raw_input: str) -> str:
    s = (raw_input or "").strip().strip('"').strip("'")
    if not s or s.lower() in ("root", "my-drive", "내 드라이브"):
        return "root"
    m_folder = re.search(r"/folders/([a-zA-Z0-9_-]+)", s)
    if m_folder:
        return m_folder.group(1)
    m_id = re.search(r"[?&]id=([a-zA-Z0-9_-]+)", s)
    if m_id:
        return m_id.group(1)
    if re.fullmatch(r"[a-zA-Z0-9_-]{10,120}", s):
        return s
    raise ValueError(
        "유효한 Google Drive 폴더 URL(https://drive.google.com/drive/folders/...) 또는 폴더 ID를 입력하거나, "
        "[☁️ 클라우드 폴더 탐색] 창에서 폴더를 선택해 주세요."
    )


def get_folder_metadata(folder_id: str) -> Dict[str, Any]:
    fid = extract_folder_id_from_input(folder_id)
    if fid == "root":
        return {
            "id": "root",
            "name": "내 드라이브 (루트)",
            "webViewLink": "https://drive.google.com/drive/my-drive",
        }
    params = urlencode(
        {
            "fields": "id,name,mimeType,webViewLink,trashed",
            "supportsAllDrives": "true",
        }
    )
    meta = _drive_api_json("GET", f"{DRIVE_API_BASE}/files/{fid}?{params}")
    if meta.get("trashed"):
        raise ValueError("선택한 Google Drive 폴더가 휴지통에 있습니다.")
    if meta.get("mimeType") != "application/vnd.google-apps.folder":
        raise ValueError("선택한 항목은 폴더가 아닙니다. Google Drive 폴더 링크 또는 ID를 지정해 주세요.")
    return {
        "id": meta["id"],
        "name": meta.get("name") or fid,
        "webViewLink": meta.get("webViewLink") or f"https://drive.google.com/drive/folders/{meta['id']}",
    }


def get_folder_path_segments(folder_id: str) -> List[str]:
    """Resolves the folder hierarchy from My Drive root down to folder_id (e.g. ['Projects', 'NEXUS_Team'])."""
    fid = extract_folder_id_from_input(folder_id)
    if fid == "root":
        return []
    try:
        root_meta = _drive_api_json("GET", f"{DRIVE_API_BASE}/files/root?fields=id")
        root_id = str(root_meta.get("id") or "")
    except Exception:
        root_id = ""

    segments: List[str] = []
    cur_id = fid
    visited = set()
    for _ in range(10):
        if not cur_id or cur_id in visited or cur_id in ("root", root_id):
            break
        visited.add(cur_id)
        params = urlencode({"fields": "id,name,parents", "supportsAllDrives": "true"})
        meta = _drive_api_json("GET", f"{DRIVE_API_BASE}/files/{cur_id}?{params}")
        if str(meta.get("id") or "") == root_id:
            break
        name = str(meta.get("name") or cur_id).strip()
        if name:
            segments.insert(0, name)
        parents = meta.get("parents") or []
        if not parents or parents[0] in ("root", root_id):
            break
        cur_id = str(parents[0])
    return segments


def resolve_mounted_gdrive_path(
    folder_id: str,
    folder_name: str,
    detected_gdrives: List[Dict[str, str]],
    create_if_missing: bool = True,
) -> Optional[Path]:
    """Maps a Google Drive folder ID/name to the local mounted Google Drive volume (e.g. F:\\내 드라이브\\NEXUS_팀명) if present."""
    if not detected_gdrives:
        return None
    gd_root_str = str(detected_gdrives[0].get("root") or "").strip()
    if not gd_root_str:
        return None
    gd_root = Path(gd_root_str)
    try:
        if not gd_root.exists():
            return None
    except OSError:
        return None

    fid = extract_folder_id_from_input(folder_id or "root")
    if fid == "root":
        return gd_root

    segments: List[str] = []
    try:
        segments = get_folder_path_segments(fid)
    except Exception:
        segments = []
    if not segments and folder_name and folder_name not in ("root", "내 드라이브 (루트)"):
        segments = [folder_name.strip()]
    if not segments:
        return gd_root

    target_p = gd_root.joinpath(*segments)
    if create_if_missing:
        try:
            target_p.mkdir(parents=True, exist_ok=True)
        except Exception:
            pass
    try:
        return target_p if target_p.exists() else None
    except OSError:
        return None


def resolve_local_gdrive_path_to_cloud_folder(
    local_path: Path,
    detected_gdrives: List[Dict[str, str]],
) -> Optional[Dict[str, Any]]:
    """
    If local_path points inside a mounted Google Drive volume (e.g. F:\\내 드라이브\\AI오피스-테스트 or
    F:\\.shortcut-targets-by-id\\<ID>\\...), resolves it via Google Drive REST API v3 to its cloud folder
    metadata {'id', 'name', 'webViewLink'} so the workspace binds as a Google Drive web URL.
    Returns None if local_path is NOT a Google Drive path.
    """
    raw_str = str(local_path).strip()
    if not raw_str:
        return None

    # 1) Handle .shortcut-targets-by-id/<ID>[/<subpath>]
    m_sc = re.search(r"\.shortcut-targets-by-id[\\/]([a-zA-Z0-9_-]+)(?:[\\/](.*))?$", raw_str, flags=re.IGNORECASE)
    if m_sc:
        gd_conn = get_gdrive_connection_status()
        if not gd_conn.get("connected"):
            raise ValueError(
                "선택한 Google Drive 폴더를 웹 주소(https://drive.google.com/...)로 연결하려면 "
                "먼저 [🔑 Google Drive 직접 연결] 로그인을 완료해 주세요."
            )
        cur_meta = get_folder_metadata(m_sc.group(1))
        rem = (m_sc.group(2) or "").strip("\\/")
        if rem:
            for seg in [x for x in re.split(r"[\\/]+", rem) if x]:
                cur_meta = create_subfolder(seg, parent_id=cur_meta["id"])
        return {
            "id": cur_meta["id"],
            "name": cur_meta.get("name") or cur_meta["id"],
            "webViewLink": cur_meta.get("webViewLink") or f"https://drive.google.com/drive/folders/{cur_meta['id']}",
        }

    # 2) Handle mounted Google Drive volumes (e.g. F:\내 드라이브, G:\My Drive)
    try:
        resolved_p = local_path.resolve()
    except OSError:
        resolved_p = local_path

    matched_rel_parts: Optional[Tuple[str, ...]] = None
    is_drive_root = False
    for gd in (detected_gdrives or []):
        gd_root_str = str(gd.get("root") or "").strip()
        gd_drv_str = str(gd.get("drive") or "").strip()
        if gd_root_str:
            try:
                gd_root_p = Path(gd_root_str).resolve()
            except OSError:
                gd_root_p = Path(gd_root_str)
            # Case-insensitive path prefix match on Windows
            if os.name == "nt":
                rp_str = str(resolved_p).rstrip("\\/")
                gr_str = str(gd_root_p).rstrip("\\/")
                if rp_str.lower() == gr_str.lower():
                    matched_rel_parts = ()
                    break
                if rp_str.lower().startswith(gr_str.lower() + "\\"):
                    tail = rp_str[len(gr_str) + 1 :]
                    matched_rel_parts = tuple(x for x in tail.split("\\") if x)
                    break
            else:
                try:
                    rel = resolved_p.relative_to(gd_root_p)
                    matched_rel_parts = rel.parts
                    break
                except ValueError:
                    pass
        if gd_drv_str and str(resolved_p).rstrip("\\/").lower() == gd_drv_str.rstrip("\\/").lower():
            is_drive_root = True
            matched_rel_parts = ()
            break

    if matched_rel_parts is None and not is_drive_root:
        return None

    gd_conn = get_gdrive_connection_status()
    if not gd_conn.get("connected"):
        raise ValueError(
            "선택한 Google Drive 폴더를 웹 주소(https://drive.google.com/...)로 연결하려면 "
            "먼저 [🔑 Google Drive 직접 연결] 로그인을 완료해 주세요."
        )

    if not matched_rel_parts:
        return {
            "id": "root",
            "name": "내 드라이브 (루트)",
            "webViewLink": "https://drive.google.com/drive/my-drive",
        }

    cur_id = "root"
    cur_meta: Dict[str, Any] = {
        "id": "root",
        "name": "내 드라이브 (루트)",
        "webViewLink": "https://drive.google.com/drive/my-drive",
    }
    for seg in matched_rel_parts:
        cur_meta = create_subfolder(seg, parent_id=cur_id)
        cur_id = cur_meta["id"]

    return {
        "id": cur_meta["id"],
        "name": cur_meta.get("name") or matched_rel_parts[-1],
        "webViewLink": cur_meta.get("webViewLink") or f"https://drive.google.com/drive/folders/{cur_meta['id']}",
    }


def list_subfolders(parent_id: str = "root") -> Dict[str, Any]:
    pid = extract_folder_id_from_input(parent_id)
    parent_meta = get_folder_metadata(pid)
    safe_pid = pid.replace("'", "\\'")
    q = f"'{safe_pid}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false"
    params = urlencode(
        {
            "q": q,
            "orderBy": "name",
            "pageSize": "100",
            "fields": "files(id,name,webViewLink,modifiedTime)",
            "supportsAllDrives": "true",
            "includeItemsFromAllDrives": "true",
        }
    )
    data = _drive_api_json("GET", f"{DRIVE_API_BASE}/files?{params}")
    folders = [
        {
            "id": f["id"],
            "name": f.get("name") or f["id"],
            "webViewLink": f.get("webViewLink") or f"https://drive.google.com/drive/folders/{f['id']}",
        }
        for f in (data.get("files") or [])
        if f.get("id")
    ]
    return {"parent": parent_meta, "folders": folders}


def create_subfolder(name: str, parent_id: str = "root") -> Dict[str, Any]:
    clean_name = (name or "").strip()
    if not clean_name:
        raise ValueError("생성할 폴더 이름을 입력해 주세요.")
    pid = extract_folder_id_from_input(parent_id)
    safe_pid = pid.replace("'", "\\'")
    safe_name = clean_name.replace("\\", "\\\\").replace("'", "\\'")

    # Check if folder with exact name already exists under parent_id
    q = (
        f"'{safe_pid}' in parents and name = '{safe_name}' "
        f"and mimeType = 'application/vnd.google-apps.folder' and trashed = false"
    )
    check_params = urlencode(
        {
            "q": q,
            "pageSize": "1",
            "fields": "files(id,name,webViewLink)",
            "supportsAllDrives": "true",
            "includeItemsFromAllDrives": "true",
        }
    )
    existing = _drive_api_json("GET", f"{DRIVE_API_BASE}/files?{check_params}").get("files") or []
    if existing:
        f0 = existing[0]
        return {
            "id": f0["id"],
            "name": f0.get("name") or clean_name,
            "webViewLink": f0.get("webViewLink") or f"https://drive.google.com/drive/folders/{f0['id']}",
            "reused": True,
        }

    create_params = urlencode({"fields": "id,name,webViewLink", "supportsAllDrives": "true"})
    created = _drive_api_json(
        "POST",
        f"{DRIVE_API_BASE}/files?{create_params}",
        body_obj={
            "name": clean_name,
            "mimeType": "application/vnd.google-apps.folder",
            "parents": [pid],
        },
    )
    return {
        "id": created["id"],
        "name": created.get("name") or clean_name,
        "webViewLink": created.get("webViewLink") or f"https://drive.google.com/drive/folders/{created['id']}",
        "reused": False,
    }


def upload_file_to_folder(local_path: Path, parent_id: str = "root", remote_name: Optional[str] = None) -> Dict[str, Any]:
    if not local_path.is_file():
        raise FileNotFoundError(f"업로드할 로컬 파일이 없습니다: {local_path}")
    fname = (remote_name or local_path.name).strip()
    pid = extract_folder_id_from_input(parent_id)
    safe_pid = pid.replace("'", "\\'")
    safe_name = fname.replace("\\", "\\\\").replace("'", "\\'")

    # Check if file already exists in parent_id for idempotent overwrite
    q = f"'{safe_pid}' in parents and name = '{safe_name}' and mimeType != 'application/vnd.google-apps.folder' and trashed = false"
    check_params = urlencode(
        {
            "q": q,
            "pageSize": "1",
            "fields": "files(id,name,webViewLink)",
            "supportsAllDrives": "true",
            "includeItemsFromAllDrives": "true",
        }
    )
    existing = _drive_api_json("GET", f"{DRIVE_API_BASE}/files?{check_params}").get("files") or []

    mime_type, _ = mimetypes.guess_type(fname)
    if not mime_type:
        if fname.endswith((".md", ".py", ".txt", ".log")):
            mime_type = "text/plain; charset=utf-8"
        else:
            mime_type = "application/octet-stream"

    file_bytes = local_path.read_bytes()
    boundary = f"===============nexus_gdrive_{secrets.token_hex(12)}=="

    meta_dict: Dict[str, Any] = {"name": fname}
    if not existing:
        meta_dict["parents"] = [pid]
    meta_bytes = json.dumps(meta_dict, ensure_ascii=False).encode("utf-8")

    multipart_body = (
        f"--{boundary}\r\n"
        f"Content-Type: application/json; charset=UTF-8\r\n\r\n"
    ).encode("utf-8") + meta_bytes + (
        f"\r\n--{boundary}\r\n"
        f"Content-Type: {mime_type}\r\n\r\n"
    ).encode("utf-8") + file_bytes + f"\r\n--{boundary}--\r\n".encode("utf-8")

    up_params = urlencode({"uploadType": "multipart", "fields": "id,name,webViewLink", "supportsAllDrives": "true"})
    if existing:
        fid = existing[0]["id"]
        res = _drive_api_json(
            "PATCH",
            f"{DRIVE_UPLOAD_BASE}/files/{fid}?{up_params}",
            raw_body=multipart_body,
            content_type=f"multipart/related; boundary={boundary}",
        )
    else:
        res = _drive_api_json(
            "POST",
            f"{DRIVE_UPLOAD_BASE}/files?{up_params}",
            raw_body=multipart_body,
            content_type=f"multipart/related; boundary={boundary}",
        )
    return {
        "id": res["id"],
        "name": res.get("name") or fname,
        "webViewLink": res.get("webViewLink") or f"https://drive.google.com/file/d/{res['id']}/view",
    }


def upload_mission_bundle(
    project_dir: Path,
    report_file: Optional[Path],
    target_folder_id: str = "root",
) -> Dict[str, Any]:
    """Uploads an entire generated mission project folder + .md report directly to Google Drive REST API v3."""
    pid = extract_folder_id_from_input(target_folder_id)
    uploaded_files: List[Dict[str, str]] = []

    proj_folder = create_subfolder(project_dir.name, parent_id=pid)
    proj_folder_id = proj_folder["id"]

    # Map relative subdir -> created Drive folder ID
    subdir_map: Dict[str, str] = {"": proj_folder_id}

    if project_dir.exists() and project_dir.is_dir():
        for item in sorted(project_dir.rglob("*")):
            if not item.is_file():
                continue
            rel_parent = item.parent.relative_to(project_dir).as_posix()
            if rel_parent == ".":
                rel_parent = ""
            if rel_parent not in subdir_map:
                cur_parent_id = proj_folder_id
                acc_parts: List[str] = []
                for part in rel_parent.split("/"):
                    acc_parts.append(part)
                    key = "/".join(acc_parts)
                    if key not in subdir_map:
                        sub_created = create_subfolder(part, parent_id=cur_parent_id)
                        subdir_map[key] = sub_created["id"]
                    cur_parent_id = subdir_map[key]
            up_res = upload_file_to_folder(item, parent_id=subdir_map[rel_parent], remote_name=item.name)
            uploaded_files.append(up_res)

    report_res = None
    if report_file and report_file.is_file():
        report_res = upload_file_to_folder(report_file, parent_id=pid, remote_name=report_file.name)
        uploaded_files.append(report_res)

    return {
        "ok": True,
        "project_folder_id": proj_folder_id,
        "project_folder_name": proj_folder["name"],
        "project_folder_url": proj_folder["webViewLink"],
        "report_url": report_res["webViewLink"] if report_res else None,
        "uploaded_count": len(uploaded_files),
        "uploaded_files": uploaded_files,
    }
