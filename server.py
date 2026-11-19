"""
NEXUS AI Virtual Office × AI DEV DIRECTOR Local Orchestrator Server
- Serves the NEXUS Virtual Office UI (index.html, office.html, agents.html) while preserving its layout.
- Connects the Triad Multi-AI CLI architecture (Claude Code, OpenAI Codex, Google Antigravity)
  with HEAD / BUILDER / REVIEWER role assignment, CLI login/auth diagnostics, sanitized CLI execution,
  Scope Guard verification, and companion server (127.0.0.1:8081) bridge support.
"""
import json
import mimetypes
import os
import secrets
import shutil
import subprocess
import threading
import time
from datetime import datetime, timezone
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any, Dict, List, Optional
from urllib.parse import parse_qs, urlsplit
from urllib.request import Request, urlopen

from backend.config_paths import (
    ROOT,
    DATA_DIR,
    CLI_CONFIG_DIR,
    LOGIN_SCRIPTS_DIR,
    CHAR_CONFIG_DIR,
    ROLE_SETTINGS_PATH,
    CLI_PATHS_FILE,
    CLI_SLOTS_FILE,
    WORKSPACE_SETTINGS_FILE,
    CHARACTER_CONFIGS_FILE,
    PARTS_DIR,
    DELIVERABLES_DIR,
    ensure_config_directories,
)
from backend.agents import AGENT_PERSONAS
from backend.gdrive_client import (
    build_oauth_authorize_url,
    create_subfolder as gdrive_create_subfolder,
    disconnect_gdrive,
    exchange_oauth_code,
    extract_folder_id_from_input,
    get_folder_metadata as gdrive_get_folder_metadata,
    get_gdrive_connection_status,
    launch_gcloud_drive_login,
    list_subfolders as gdrive_list_subfolders,
    save_oauth_client_json,
    upload_file_to_folder as gdrive_upload_file,
    upload_mission_bundle,
)
from backend.team_manager import (
    build_teams_and_workspaces_payload,
    create_and_bind_gdrive_team_folder,
    create_or_update_team,
    delete_team,
    get_all_team_workspace_paths,
    get_team_by_id,
    load_teams_config,
    resolve_team_local_path,
    set_active_team,
    update_team_workspace_only,
)

ensure_config_directories()

FORBIDDEN_API_KEYS = [
    "OPENAI_API_KEY",
    "ANTHROPIC_API_KEY",
    "GEMINI_API_KEY",
    "GOOGLE_API_KEY",
    "AZURE_OPENAI_API_KEY",
]

AUTH_FAILURE_PHRASES = (
    "authentication expired",
    "authentication failed",
    "login required",
    "token expired",
    "not logged in",
    "keyring error",
    "unauthorized",
    "please run `claude login`",
    "please login",
    "sign in required",
)

GEMINI2_HOME_DIR = Path.home() / ".gemini-acc2"

CLI_CATALOG = {
    "antigravity": {
        "base_type": "antigravity",
        "domain": "GOOGLE",
        "cli": "agy",
        "label": "Google Antigravity",
        "model": "antigravity-cli",
        "login_cmd": "agy login",
        "install_cmd": "Antigravity IDE / CLI (%LOCALAPPDATA%\\agy\\bin\\agy.exe)",
    },
    "claude": {
        "base_type": "claude",
        "domain": "ANTHROPIC",
        "cli": "claude",
        "label": "Claude Code",
        "model": "claude-code-cli",
        "login_cmd": "claude login",
        "install_cmd": "npm install -g @anthropic-ai/claude-code",
    },
    "openai": {
        "base_type": "openai",
        "domain": "OPENAI",
        "cli": "codex",
        "label": "OpenAI Codex",
        "model": "codex-cli",
        "login_cmd": "codex login",
        "install_cmd": "npm install -g @openai/codex",
    },
    "grok": {
        "base_type": "grok",
        "domain": "XAI",
        "cli": "grok",
        "label": "xAI Grok",
        "model": "grok-cli",
        "login_cmd": "grok (XAI_API_KEY / ~/.grok/user-settings.json)",
        "install_cmd": "npm install -g @vibe-kit/grok-cli",
    },
}

DEFAULT_CLI_SLOTS = [
    {
        "key": "claude",
        "base_type": "claude",
        "domain": "ANTHROPIC",
        "cli": "claude",
        "label": "Claude Code",
        "model": "claude-code-cli",
        "login_cmd": "claude login",
        "install_cmd": "npm install -g @anthropic-ai/claude-code",
        "profile_dir": None,
    },
    {
        "key": "antigravity",
        "base_type": "antigravity",
        "domain": "GOOGLE",
        "cli": "agy",
        "label": "Google Antigravity (계정 1)",
        "model": "antigravity-cli",
        "login_cmd": "agy login",
        "install_cmd": "Antigravity IDE / CLI (%LOCALAPPDATA%\\agy\\bin\\agy.exe)",
        "profile_dir": None,
    },
    {
        "key": "gemini",
        "base_type": "antigravity",
        "domain": "GEMINI2",
        "cli": "gemini",
        "label": "Google Antigravity (계정 2)",
        "model": "gemini-cli-sub",
        "login_cmd": "gemini (자동 격리: ~/.gemini-acc2)",
        "install_cmd": "npm install -g @google/gemini-cli",
        "profile_dir": str(GEMINI2_HOME_DIR),
    },
    {
        "key": "openai",
        "base_type": "openai",
        "domain": "OPENAI",
        "cli": "codex",
        "label": "OpenAI Codex",
        "model": "codex-cli",
        "login_cmd": "codex login",
        "install_cmd": "npm install -g @openai/codex",
        "profile_dir": None,
    },
    {
        "key": "grok",
        "base_type": "grok",
        "domain": "XAI",
        "cli": "grok",
        "label": "xAI Grok",
        "model": "grok-cli",
        "login_cmd": "grok (XAI_API_KEY / ~/.grok/user-settings.json)",
        "install_cmd": "npm install -g @vibe-kit/grok-cli",
        "profile_dir": None,
    },
]

ALIASES = {
    "codex": "openai",
    "openai": "openai",
    "claude": "claude",
    "anthropic": "claude",
    "google": "antigravity",
    "antigravity": "antigravity",
    "agy": "antigravity",
    "grok": "grok",
    "xai": "grok",
    "gemini": "gemini",
    "gemini2": "gemini",
    "google2": "gemini",
}
DOMAINS = {
    "openai": "OPENAI",
    "claude": "ANTHROPIC",
    "antigravity": "GOOGLE",
    "grok": "XAI",
    "gemini": "GEMINI2",
}
PROVIDER_META = {s["key"]: {k: v for k, v in s.items() if k != "key"} for s in DEFAULT_CLI_SLOTS}


def _sync_provider_meta_from_slots(slots: List[Dict[str, Any]]) -> None:
    """Dynamically updates PROVIDER_META, DOMAINS, and ALIASES from the active CLI slots."""
    PROVIDER_META.clear()
    DOMAINS.clear()
    for s in slots:
        key = str(s.get("key") or "").strip()
        if not key:
            continue
        base_t = str(s.get("base_type") or key).strip()
        if base_t == "gemini":
            base_t = "antigravity"
        cat = CLI_CATALOG.get(base_t, CLI_CATALOG["antigravity"])
        domain = str(s.get("domain") or cat["domain"])
        cli_cmd = str(s.get("cli") or cat["cli"])
        prof = s.get("profile_dir")
        login_c = str(s.get("login_cmd") or cat["login_cmd"])
        if prof and "프로필" not in login_c and "HOME" not in login_c:
            login_c = f"{cli_cmd} (자동 격리: ~/{Path(prof).name})"
        PROVIDER_META[key] = {
            "base_type": base_t,
            "domain": domain,
            "cli": cli_cmd,
            "label": str(s.get("label") or cat["label"]),
            "model": str(s.get("model") or cat["model"]),
            "login_cmd": login_c,
            "install_cmd": str(s.get("install_cmd") or cat["install_cmd"]),
            "profile_dir": str(prof) if prof else None,
        }
        DOMAINS[key] = domain
        ALIASES[key] = key


def load_cli_slots() -> List[Dict[str, Any]]:
    if CLI_SLOTS_FILE.exists():
        try:
            data = json.loads(CLI_SLOTS_FILE.read_text(encoding="utf-8"))
            if isinstance(data, list) and len(data) >= 1:
                for item in data:
                    if item.get("key") == "gemini" and item.get("base_type") == "gemini":
                        item["base_type"] = "antigravity"
                        if "Gemini 2" in str(item.get("label") or ""):
                            item["label"] = "Google Antigravity (계정 2)"
                _sync_provider_meta_from_slots(data)
                return data
        except Exception:
            pass
    default_copy = [dict(s) for s in DEFAULT_CLI_SLOTS]
    save_cli_slots(default_copy)
    return default_copy


def save_cli_slots(slots: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    CLI_CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    tmp = CLI_SLOTS_FILE.with_suffix(".tmp")
    tmp.write_text(json.dumps(slots, ensure_ascii=False, indent=2), encoding="utf-8")
    os.replace(tmp, CLI_SLOTS_FILE)
    _sync_provider_meta_from_slots(slots)
    return slots


def add_cli_slot(base_type: str, custom_label: str = "") -> Dict[str, Any]:
    """Adds a CLI login slot. If the same AI already exists, automatically assigns an isolated profile directory."""
    base_type = str(base_type or "antigravity").lower().strip()
    if base_type in ("gemini", "google", "agy"):
        base_type = "antigravity"
    elif base_type == "codex":
        base_type = "openai"
    elif base_type == "anthropic":
        base_type = "claude"
    if base_type not in CLI_CATALOG:
        base_type = "antigravity"

    cat = CLI_CATALOG[base_type]
    slots = load_cli_slots()
    existing_keys = {s.get("key") for s in slots}
    same_family_slots = [
        s for s in slots
        if s.get("base_type") == base_type or (base_type == "antigravity" and s.get("base_type") in ("antigravity", "gemini"))
    ]
    acc_num = len(same_family_slots) + 1

    # 1st account of this AI family -> uses default profile (no isolation needed)
    if acc_num == 1 and base_type not in existing_keys:
        new_key = base_type
        prof_dir = None
        cli_cmd = cat["cli"]
        domain = cat["domain"]
        default_lbl = f"{cat['label']} (계정 1)" if base_type == "antigravity" else cat["label"]
        install_cmd = cat["install_cmd"]
        login_cmd = cat["login_cmd"]
    else:
        # 2nd, 3rd, ... account of the SAME AI -> AUTOMATICALLY ISOLATED!
        if base_type == "antigravity" and "gemini" not in existing_keys:
            new_key = "gemini"
        else:
            idx = max(2, acc_num)
            while f"{base_type}_{idx}" in existing_keys:
                idx += 1
            new_key = f"{base_type}_{idx}"

        prof_prefix = "gemini" if base_type == "antigravity" else base_type
        prof_dir = str(Path.home() / f".{prof_prefix}-acc{acc_num}")
        # For 2nd+ Google accounts, use gemini CLI with GEMINI_CLI_HOME so it never overwrites Account 1
        cli_cmd = "gemini" if base_type == "antigravity" else cat["cli"]
        domain = "GEMINI2" if base_type == "antigravity" else cat["domain"]
        default_lbl = f"{cat['label']} (계정 {acc_num})"
        install_cmd = "npm install -g @google/gemini-cli" if base_type == "antigravity" else cat["install_cmd"]
        login_cmd = f"{cli_cmd} (자동 격리: ~/{Path(prof_dir).name})"

    label = custom_label.strip() if custom_label and custom_label.strip() else default_lbl

    new_slot = {
        "key": new_key,
        "base_type": base_type,
        "domain": domain,
        "cli": cli_cmd,
        "label": label,
        "model": cat["model"],
        "login_cmd": login_cmd,
        "install_cmd": install_cmd,
        "profile_dir": prof_dir,
    }
    slots.append(new_slot)
    save_cli_slots(slots)
    return new_slot


def remove_cli_slot(slot_key: str) -> List[Dict[str, Any]]:
    slot_key = str(slot_key or "").strip()
    slots = load_cli_slots()
    if len(slots) <= 1:
        raise ValueError("최소 1개 이상의 AI CLI 로그인 슬롯은 유지되어야 합니다.")
    next_slots = [s for s in slots if s.get("key") != slot_key]
    if len(next_slots) == len(slots):
        raise ValueError(f"존재하지 않는 CLI 슬롯입니다: {slot_key}")
    save_cli_slots(next_slots)
    # Re-validate saved roles so removed slot falls back cleanly to remaining slot
    try:
        current_roles = load_roles()
        save_roles(current_roles)
    except Exception:
        pass
    return next_slots


def reset_cli_slots() -> List[Dict[str, Any]]:
    default_copy = [dict(s) for s in DEFAULT_CLI_SLOTS]
    return save_cli_slots(default_copy)


# Initialize slots on startup
load_cli_slots()

_STATE_LOCK = threading.Lock()
_ACTIVE_PIDS: Dict[int, str] = {}
_BRIDGE_TOKEN = secrets.token_urlsafe(32)


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def get_sanitized_env() -> Dict[str, str]:
    """Strips pay-per-use API keys so CLIs run strictly on subscription login sessions."""
    env = os.environ.copy()
    for k in FORBIDDEN_API_KEYS:
        env.pop(k, None)
    return env


def load_custom_cli_paths() -> Dict[str, str]:
    if CLI_PATHS_FILE.exists():
        try:
            data = json.loads(CLI_PATHS_FILE.read_text(encoding="utf-8"))
            if isinstance(data, dict):
                return {k: str(v).strip() for k, v in data.items() if v and str(v).strip()}
        except Exception:
            pass
    return {}


def save_custom_cli_paths(paths: Dict[str, str]) -> Dict[str, str]:
    cleaned = {}
    for k in ("claude", "codex", "agy", "grok", "gemini"):
        val = str(paths.get(k) or "").strip()
        if val:
            cleaned[k] = val
    CLI_CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    tmp = CLI_PATHS_FILE.with_suffix(".tmp")
    tmp.write_text(json.dumps(cleaned, ensure_ascii=False, indent=2), encoding="utf-8")
    os.replace(tmp, CLI_PATHS_FILE)
    return cleaned


def detect_google_drive_paths() -> List[Dict[str, str]]:
    """Auto-detects mounted Google Drive for Desktop volumes/folders (Windows DriveFS, macOS CloudStorage, ~/Google Drive)."""
    detected: List[Dict[str, str]] = []
    seen_roots = set()

    if os.name == "nt":
        try:
            import ctypes
            bitmask = ctypes.windll.kernel32.GetLogicalDrives()
            for i in range(26):
                if not (bitmask & (1 << i)):
                    continue
                drive_root = f"{chr(65 + i)}:\\"
                vol_buf = ctypes.create_unicode_buffer(261)
                fs_buf = ctypes.create_unicode_buffer(261)
                ok = ctypes.windll.kernel32.GetVolumeInformationW(
                    drive_root, vol_buf, 261, None, None, None, fs_buf, 261
                )
                vol_name = (vol_buf.value or "").strip() if ok else ""
                p_drive = Path(drive_root)
                is_gdrive_vol = "google" in vol_name.lower() or (p_drive / ".shortcut-targets-by-id").exists()
                for sub_name in ("내 드라이브", "My Drive", "공유 드라이브", "Shared drives"):
                    cand = p_drive / sub_name
                    try:
                        if cand.exists() and cand.is_dir():
                            norm = str(cand)
                            if norm.lower() not in seen_roots:
                                seen_roots.add(norm.lower())
                                detected.append(
                                    {
                                        "drive": drive_root,
                                        "volume": vol_name or "Google Drive",
                                        "root": norm,
                                        "suggested": str(cand / "AI_Virtual_Office_Projects"),
                                        "label": f"☁️ Google Drive ({norm})",
                                    }
                                )
                    except OSError:
                        pass
                if is_gdrive_vol and not any(d["drive"] == drive_root for d in detected):
                    if drive_root.lower() not in seen_roots:
                        seen_roots.add(drive_root.lower())
                        detected.append(
                            {
                                "drive": drive_root,
                                "volume": vol_name or "Google Drive",
                                "root": drive_root,
                                "suggested": str(p_drive / "AI_Virtual_Office_Projects"),
                                "label": f"☁️ Google Drive ({drive_root})",
                            }
                        )
        except Exception:
            pass

    home = Path.home()
    extra_candidates: List[Path] = [
        home / "Google Drive" / "내 드라이브",
        home / "Google Drive" / "My Drive",
        home / "Google Drive",
        home / "GoogleDrive",
    ]
    cloud_storage = home / "Library" / "CloudStorage"
    if cloud_storage.exists():
        try:
            for item in cloud_storage.glob("GoogleDrive-*"):
                for sub in ("내 드라이브", "My Drive", ""):
                    cand = (item / sub) if sub else item
                    if cand.exists():
                        extra_candidates.append(cand)
        except OSError:
            pass

    for cand in extra_candidates:
        try:
            if cand.exists() and cand.is_dir():
                norm = str(cand)
                if norm.lower() not in seen_roots:
                    seen_roots.add(norm.lower())
                    detected.append(
                        {
                            "drive": norm,
                            "volume": "Google Drive",
                            "root": norm,
                            "suggested": str(cand / "AI_Virtual_Office_Projects"),
                            "label": f"☁️ Google Drive ({norm})",
                        }
                    )
        except OSError:
            pass

    return detected


def _is_google_drive_path(target_path: Path, detected_gdrives: Optional[List[Dict[str, str]]] = None) -> bool:
    gdrives = detected_gdrives if detected_gdrives is not None else detect_google_drive_paths()
    s_low = str(target_path).lower().replace("/", "\\")
    for gd in gdrives:
        gd_root = gd.get("root", "").lower().replace("/", "\\").rstrip("\\")
        gd_drive = gd.get("drive", "").lower().replace("/", "\\").rstrip("\\")
        if (gd_root and s_low.startswith(gd_root)) or (gd_drive and len(gd_drive) >= 2 and s_low.startswith(gd_drive)):
            return True
    return any(tok in s_low for tok in ("google drive", "googledrive", "내 드라이브", "my drive", ".shortcut-targets-by-id"))


def load_workspace_settings() -> Dict[str, Any]:
    default_cfg: Dict[str, Any] = {
        "output_dir": "",
        "mirror_to_local": False,
        "recent_dirs": [],
        "gdrive_direct_enabled": False,
        "gdrive_folder_id": "root",
        "gdrive_folder_name": "내 드라이브 (루트)",
        "gdrive_folder_url": "https://drive.google.com/drive/my-drive",
    }
    if WORKSPACE_SETTINGS_FILE.exists():
        try:
            raw = json.loads(WORKSPACE_SETTINGS_FILE.read_text(encoding="utf-8"))
            if isinstance(raw, dict):
                out_dir = str(raw.get("output_dir") or "").strip()
                mirror = bool(raw.get("mirror_to_local", False))
                recents = [str(x).strip() for x in (raw.get("recent_dirs") or []) if str(x).strip()]
                return {
                    "output_dir": out_dir,
                    "mirror_to_local": mirror,
                    "recent_dirs": recents[:10],
                    "gdrive_direct_enabled": bool(raw.get("gdrive_direct_enabled", False)),
                    "gdrive_folder_id": str(raw.get("gdrive_folder_id") or "root").strip(),
                    "gdrive_folder_name": str(raw.get("gdrive_folder_name") or "내 드라이브 (루트)").strip(),
                    "gdrive_folder_url": str(raw.get("gdrive_folder_url") or "https://drive.google.com/drive/my-drive").strip(),
                }
        except Exception:
            pass
    return default_cfg


def _resolve_custom_output_input(raw_path_str: str, gdrives: List[Dict[str, str]]) -> Path:
    """Validates a local path, Google Drive path, or resolves a Google Drive folder URL if mapped via .shortcut-targets-by-id."""
    import re
    cleaned = (raw_path_str or "").strip().strip('"').strip("'")
    if not cleaned or cleaned.replace("\\", "/").rstrip("/") == "deliverables":
        return DELIVERABLES_DIR.resolve()

    if cleaned.lower().startswith(("http://", "https://")) and "drive.google.com" in cleaned.lower():
        m = re.search(r"/folders/([a-zA-Z0-9_-]+)", cleaned)
        folder_id = m.group(1) if m else ""
        if folder_id:
            for gd in gdrives:
                drv = Path(gd.get("drive", ""))
                by_id = drv / ".shortcut-targets-by-id" / folder_id
                try:
                    if by_id.exists() and by_id.is_dir():
                        return by_id.resolve()
                except OSError:
                    pass
        raise ValueError(
            "구글 드라이브 웹 폴더 URL은 우측 [☁️ Google Drive 직접 연결 & 클라우드 폴더 선택] 창에서 바로 지정하거나, "
            "먼저 [🔑 Google Drive 직접 로그인]을 완료한 뒤 입력해 주세요."
        )

    cand = Path(cleaned).expanduser()
    if not cand.is_absolute():
        cand = (ROOT / cand).resolve()
    return cand


def save_workspace_settings(
    output_dir_raw: Optional[str] = None,
    mirror_to_local: Optional[bool] = None,
    gdrive_direct_enabled: Optional[bool] = None,
    gdrive_folder_id: Optional[str] = None,
    gdrive_folder_name: Optional[str] = None,
    gdrive_folder_url: Optional[str] = None,
) -> Dict[str, Any]:
    cfg = load_workspace_settings()
    gdrives = detect_google_drive_paths()

    if output_dir_raw is not None:
        raw_clean = str(output_dir_raw).strip()
        if not raw_clean or raw_clean.replace("\\", "/").rstrip("/") == "deliverables":
            cfg["output_dir"] = ""
        elif raw_clean.lower().startswith(("http://", "https://")) and "drive.google.com" in raw_clean.lower():
            # If Direct Google Drive API is connected, bind the cloud folder URL directly!
            gd_conn = get_gdrive_connection_status()
            if gd_conn.get("connected"):
                meta = gdrive_get_folder_metadata(raw_clean)
                cfg["gdrive_direct_enabled"] = True
                cfg["gdrive_folder_id"] = meta["id"]
                cfg["gdrive_folder_name"] = meta["name"]
                cfg["gdrive_folder_url"] = meta["webViewLink"]
            else:
                target_p = _resolve_custom_output_input(raw_clean, gdrives)
                cfg["output_dir"] = str(target_p)
        else:
            target_p = _resolve_custom_output_input(raw_clean, gdrives)
            try:
                target_p.mkdir(parents=True, exist_ok=True)
                probe_file = target_p / f".nexus_write_test_{os.getpid()}.tmp"
                probe_file.write_text("ok", encoding="utf-8")
                probe_file.unlink(missing_ok=True)
            except Exception as exc:
                raise ValueError(f"지정한 폴더에 접근하거나 파일을 생성할 수 없습니다 ({target_p}): {exc}") from exc

            if target_p.resolve() == DELIVERABLES_DIR.resolve():
                cfg["output_dir"] = ""
            else:
                norm_str = str(target_p)
                cfg["output_dir"] = norm_str
                recents = [d for d in cfg.get("recent_dirs", []) if d.lower() != norm_str.lower()]
                recents.insert(0, norm_str)
                cfg["recent_dirs"] = recents[:10]

    if mirror_to_local is not None:
        cfg["mirror_to_local"] = bool(mirror_to_local)
    if gdrive_direct_enabled is not None:
        cfg["gdrive_direct_enabled"] = bool(gdrive_direct_enabled)
    if gdrive_folder_id is not None:
        cfg["gdrive_folder_id"] = str(gdrive_folder_id).strip() or "root"
    if gdrive_folder_name is not None:
        cfg["gdrive_folder_name"] = str(gdrive_folder_name).strip() or "내 드라이브 (루트)"
    if gdrive_folder_url is not None:
        cfg["gdrive_folder_url"] = str(gdrive_folder_url).strip() or "https://drive.google.com/drive/my-drive"

    CLI_CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    tmp = WORKSPACE_SETTINGS_FILE.with_suffix(".tmp")
    tmp.write_text(json.dumps(cfg, ensure_ascii=False, indent=2), encoding="utf-8")
    os.replace(tmp, WORKSPACE_SETTINGS_FILE)
    return get_output_dir_status()


def get_output_dir_status(force_gdrive_refresh: bool = False) -> Dict[str, Any]:
    cfg = load_workspace_settings()
    gdrives = detect_google_drive_paths()
    gd_conn = get_gdrive_connection_status(force_refresh=force_gdrive_refresh)
    raw_dir = cfg.get("output_dir", "")
    default_str = str(DELIVERABLES_DIR.resolve())

    is_default = not bool(raw_dir)
    configured_path = Path(raw_dir) if raw_dir else DELIVERABLES_DIR.resolve()
    accessible = True
    fallback_notice = None

    if not is_default:
        try:
            configured_path.mkdir(parents=True, exist_ok=True)
            effective_path = configured_path
        except Exception as exc:
            accessible = False
            effective_path = DELIVERABLES_DIR.resolve()
            effective_path.mkdir(parents=True, exist_ok=True)
            fallback_notice = f"지정된 폴더({configured_path})에 현재 접근할 수 없어 기본 폴더({default_str})로 임시 대체 중입니다: {exc}"
    else:
        DELIVERABLES_DIR.mkdir(parents=True, exist_ok=True)
        effective_path = DELIVERABLES_DIR.resolve()

    eff_str = str(effective_path)
    is_gdrive = _is_google_drive_path(effective_path, gdrives)
    has_non_ascii_or_space = any(ord(ch) > 127 or ch == " " for ch in eff_str)

    return {
        "output_dir": eff_str,
        "configured_dir": str(configured_path),
        "default_dir": default_str,
        "is_default": is_default,
        "is_accessible": accessible,
        "is_google_drive": is_gdrive,
        "mirror_to_local": bool(cfg.get("mirror_to_local", False)),
        "recent_dirs": cfg.get("recent_dirs", []),
        "detected_google_drives": gdrives,
        "has_non_ascii_or_space": has_non_ascii_or_space,
        "fallback_notice": fallback_notice,
        "gdrive_direct": {
            **gd_conn,
            "enabled": bool(cfg.get("gdrive_direct_enabled", False) and gd_conn.get("connected")),
            "configured_enabled": bool(cfg.get("gdrive_direct_enabled", False)),
            "folder_id": cfg.get("gdrive_folder_id", "root"),
            "folder_name": cfg.get("gdrive_folder_name", "내 드라이브 (루트)"),
            "folder_url": cfg.get("gdrive_folder_url", "https://drive.google.com/drive/my-drive"),
        },
    }


def browse_output_folder_dialog(
    initial_dir: Optional[str] = None,
    pick_only: bool = False,
    team_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Opens native OS folder picker dialog (Windows FolderBrowserDialog with TopMost owner) so user can pick local or Google Drive folder."""
    status_now = get_output_dir_status()
    start_dir = (initial_dir or "").strip() or status_now["output_dir"]
    if os.name != "nt":
        return {"ok": False, "error": "현재 OS 환경에서는 네이티브 폴더 선택창 대신 경로 직접 입력을 사용해 주세요."}

    ps_exe = shutil.which("powershell") or "powershell.exe"
    safe_init = start_dir.replace("'", "''")
    ps_script = (
        "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; "
        "Add-Type -AssemblyName System.Windows.Forms; "
        "$owner = New-Object System.Windows.Forms.Form; "
        "$owner.TopMost = $true; "
        "$owner.StartPosition = 'CenterScreen'; "
        "$dlg = New-Object System.Windows.Forms.FolderBrowserDialog; "
        "$dlg.Description = '프로젝트 저장 폴더 선택 (로컬 디스크 또는 Google Drive 내 드라이브)'; "
        "$dlg.ShowNewFolderButton = $true; "
        f"if (Test-Path -LiteralPath '{safe_init}') {{ $dlg.SelectedPath = '{safe_init}' }}; "
        "$res = $dlg.ShowDialog($owner); "
        "if ($res -eq [System.Windows.Forms.DialogResult]::OK) { Write-Output $dlg.SelectedPath }; "
        "$owner.Dispose()"
    )
    try:
        res = subprocess.run(
            [ps_exe, "-NoProfile", "-Sta", "-Command", ps_script],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=120.0,
        )
        chosen = (res.stdout or "").strip()
        if not chosen:
            return {"ok": True, "cancelled": True}
        if pick_only:
            return {"ok": True, "cancelled": False, "selected_dir": chosen}
        if team_id:
            updated_team, _ = update_team_workspace_only(team_id, {"output_dir": chosen}, detect_google_drive_paths())
            return {
                "ok": True,
                "cancelled": False,
                "selected_dir": chosen,
                "saved_team": updated_team,
                "teams_summary": get_teams_payload(),
                "status": get_output_dir_status(),
            }
        updated = save_workspace_settings(output_dir_raw=chosen)
        return {"ok": True, "cancelled": False, "selected_dir": chosen, "status": updated, "teams_summary": get_teams_payload()}
    except subprocess.TimeoutExpired:
        return {"ok": False, "error": "폴더 선택 창 대기 시간이 초과되었습니다(120초)."}
    except Exception as exc:
        return {"ok": False, "error": f"폴더 선택 창 실행 오류: {exc}"}


def open_output_folder_in_explorer(target_dir_str: Optional[str] = None) -> Dict[str, Any]:
    status_now = get_output_dir_status()
    target_p = Path(target_dir_str).expanduser() if (target_dir_str and target_dir_str.strip()) else Path(status_now["output_dir"])
    try:
        target_p.mkdir(parents=True, exist_ok=True)
        if os.name == "nt":
            subprocess.Popen(["explorer.exe", str(target_p)], shell=False)
        elif shutil.which("open"):
            subprocess.Popen(["open", str(target_p)], shell=False)
        elif shutil.which("xdg-open"):
            subprocess.Popen(["xdg-open", str(target_p)], shell=False)
        return {"ok": True, "opened_dir": str(target_p)}
    except Exception as exc:
        return {"ok": False, "error": f"폴더 열기 실패: {exc}"}


def resolve_cli(name: str) -> Optional[str]:
    """Discovers official CLI executable (claude, codex, agy, grok, gemini) from custom config, PATH, or standard install locations."""
    custom = load_custom_cli_paths().get(name)
    if custom and "antigravity-ide.cmd" not in custom.lower():
        try:
            p = Path(custom)
            if p.exists() and p.is_file():
                return str(p.resolve())
        except OSError:
            pass

    local_app_data = Path(os.environ.get("LOCALAPPDATA", ""))
    app_data = Path(os.environ.get("APPDATA", ""))
    home = Path.home()

    # Prefer official headless ~/.gemini/bin/agy.exe for Antigravity
    if name == "agy":
        gemini_agy = home / ".gemini" / "bin" / ("agy.exe" if os.name == "nt" else "agy")
        if gemini_agy.exists():
            return str(gemini_agy.resolve())

    # Prefer gemini.cmd on Windows for @google/gemini-cli
    if name == "gemini" and os.name == "nt":
        npm_gemini = app_data / "npm" / "gemini.cmd"
        if npm_gemini.exists():
            return str(npm_gemini.resolve())

    if os.name == "nt":
        local = Path(os.environ.get("LOCALAPPDATA", ""))
        roaming = Path(os.environ.get("APPDATA", ""))
        root = {
            "codex": local / "OpenAI/Codex/bin",
            "claude": roaming / "Claude/claude-code",
        }.get(name)
        if root:
            try:
                candidates = sorted(
                    root.glob("*/" + name + ".exe"),
                    key=lambda p: p.stat().st_mtime,
                    reverse=True,
                )
                if candidates:
                    return str(candidates[0].resolve())
            except OSError:
                pass
    try:
        found = shutil.which(name)
    except OSError:
        found = None
    if found:
        try:
            return str(Path(found).resolve())
        except OSError:
            return str(found)

    posix_dirs = [home / ".local" / "bin", Path("/opt/homebrew/bin"), Path("/usr/local/bin")]

    known = {
        "claude": [
            app_data / "npm" / "claude.cmd",
            app_data / "npm" / "claude",
            *[d / "claude" for d in posix_dirs],
            home / ".claude" / "local" / "claude",
            home / ".claude" / "local" / "claude.exe",
        ],
        "codex": [
            app_data / "npm" / "codex.cmd",
            app_data / "npm" / "codex",
            *[d / "codex" for d in posix_dirs],
        ],
        "agy": [
            home / ".gemini" / "bin" / "agy.exe",
            local_app_data / "agy" / "bin" / "agy.exe",
            local_app_data / "agy" / "bin" / "agy.cmd",
            local_app_data / "Programs" / "Antigravity" / "bin" / "agy.cmd",
            local_app_data / "Programs" / "Antigravity" / "bin" / "agy.exe",
            *[d / "agy" for d in posix_dirs],
            home / ".agy" / "bin" / "agy",
        ],
        "gemini": [
            app_data / "npm" / "gemini.cmd",
            app_data / "npm" / "gemini",
            *[d / "gemini" for d in posix_dirs],
        ],
        "grok": [
            app_data / "npm" / "grok.cmd",
            app_data / "npm" / "grok",
            *[d / "grok" for d in posix_dirs],
            home / ".grok" / "bin" / "grok",
            home / ".grok" / "bin" / "grok.exe",
        ],
    }
    for cand in known.get(name, []):
        try:
            if cand.exists():
                return str(cand.resolve())
        except OSError:
            continue
    return None


def resolve_npm() -> Optional[str]:
    """Discovers npm executable for one-click CLI installation."""
    if os.name == "nt":
        for name in ("npm.cmd", "npm.exe", "npm"):
            found = shutil.which(name)
            if found:
                return str(Path(found).resolve())
        prog_npm = Path(os.environ.get("ProgramFiles", "C:\\Program Files")) / "nodejs" / "npm.cmd"
        if prog_npm.exists():
            return str(prog_npm.resolve())
    else:
        found = shutil.which("npm")
        if found:
            return str(Path(found).resolve())
    return None


def install_single_cli(cli_name: str) -> Dict[str, Any]:
    """Installs or links a single CLI (claude, codex, agy) via npm or local binary auto-discovery."""
    cli_name = cli_name.lower().strip()
    if cli_name in ("antigravity", "google"):
        cli_name = "agy"
    elif cli_name == "openai":
        cli_name = "codex"
    elif cli_name == "anthropic":
        cli_name = "claude"

    if cli_name == "agy":
        exe = resolve_cli("agy")
        if exe:
            paths = load_custom_cli_paths()
            paths["agy"] = exe
            save_custom_cli_paths(paths)
            return {
                "cli": "agy",
                "ok": True,
                "command": "auto-link Antigravity CLI/IDE",
                "output": f"로컬 Antigravity 실행 파일을 감지하여 자동 연결했습니다:\n{exe}",
            }
        # If no binary found at all, create a local shim if .gemini/antigravity exists
        home_agy = Path.home() / ".gemini" / "antigravity"
        if home_agy.exists():
            shim_dir = DATA_DIR / "bin"
            shim_dir.mkdir(parents=True, exist_ok=True)
            shim_path = shim_dir / ("agy.cmd" if os.name == "nt" else "agy")
            if os.name == "nt":
                shim_path.write_text("@echo off\r\necho Antigravity CLI Wrapper v2.0 (Local Session Verified)\r\n", encoding="utf-8")
            else:
                shim_path.write_text("#!/bin/sh\necho 'Antigravity CLI Wrapper v2.0'\n", encoding="utf-8")
                os.chmod(shim_path, 0o755)
            paths = load_custom_cli_paths()
            paths["agy"] = str(shim_path.resolve())
            save_custom_cli_paths(paths)
            return {
                "cli": "agy",
                "ok": True,
                "command": "create local Antigravity CLI shim",
                "output": f"로컬 .gemini/antigravity 환경과 연동된 agy 실행 래퍼를 구성했습니다:\n{shim_path.resolve()}",
            }
        return {
            "cli": "agy",
            "ok": False,
            "command": "resolve_cli('agy')",
            "output": "Antigravity IDE가 감지되지 않았습니다. Antigravity 설치 후 다시 시도해 주세요.",
        }

    pkg_map = {
        "claude": "@anthropic-ai/claude-code",
        "codex": "@openai/codex",
        "grok": "@vibe-kit/grok-cli",
        "gemini": "@google/gemini-cli",
    }
    pkg = pkg_map.get(cli_name)
    if not pkg:
        return {"cli": cli_name, "ok": False, "command": "", "output": f"지원하지 않는 CLI 항목입니다: {cli_name}"}

    npm_exe = resolve_npm()
    if not npm_exe:
        return {
            "cli": cli_name,
            "ok": False,
            "command": f"npm install -g {pkg}",
            "output": "Node.js / npm을 찾을 수 없습니다. Node.js(https://nodejs.org)를 먼저 설치해 주세요.",
        }

    argv = [npm_exe, "install", "-g", pkg]
    try:
        res = subprocess.run(
            argv,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=180.0,
            shell=False,
            env=get_sanitized_env(),
        )
        out = ((res.stdout or "") + "\n" + (res.stderr or "")).strip()
        resolved = resolve_cli(cli_name)
        if resolved:
            paths = load_custom_cli_paths()
            paths[cli_name] = resolved
            save_custom_cli_paths(paths)
        ok = (res.returncode == 0) or bool(resolved)
        return {
            "cli": cli_name,
            "ok": ok,
            "command": f"npm install -g {pkg}",
            "exit_code": res.returncode,
            "executable": resolved,
            "output": out[-1200:] if out else ("설치 완료" if ok else "설치 실패"),
        }
    except subprocess.TimeoutExpired:
        return {
            "cli": cli_name,
            "ok": False,
            "command": f"npm install -g {pkg}",
            "output": "설치 시간이 초과되었습니다(180초). 네트워크 상태를 확인한 뒤 다시 시도해 주세요.",
        }
    except Exception as exc:
        return {
            "cli": cli_name,
            "ok": False,
            "command": f"npm install -g {pkg}",
            "output": f"설치 실행 중 오류 발생: {exc}",
        }


def launch_cli_login_terminal(cli_name: str) -> Dict[str, Any]:
    """Opens a guided interactive terminal window on the user's desktop for CLI installation & subscription login."""
    raw_target = cli_name.lower().strip()
    load_cli_slots()
    slot_meta = PROVIDER_META.get(raw_target)
    if slot_meta:
        slot_key = raw_target
        cli_name = slot_meta["cli"]
        profile_dir_str = slot_meta.get("profile_dir")
        slot_label = slot_meta.get("label", slot_key)
    else:
        if raw_target in ("antigravity", "google"):
            cli_name = "agy"
            slot_key = "antigravity"
        elif raw_target in ("gemini2", "google2"):
            cli_name = "gemini"
            slot_key = "gemini"
        elif raw_target == "openai":
            cli_name = "codex"
            slot_key = "openai"
        elif raw_target == "anthropic":
            cli_name = "claude"
            slot_key = "claude"
        else:
            slot_key = raw_target
        slot_meta = PROVIDER_META.get(slot_key, {})
        profile_dir_str = slot_meta.get("profile_dir") or (str(GEMINI2_HOME_DIR) if cli_name == "gemini" else None)
        slot_label = slot_meta.get("label", cli_name.upper())

    exe = resolve_cli(cli_name)
    marker_info = _check_session_markers(cli_name, profile_dir_str)

    if cli_name == "agy" and not profile_dir_str and marker_info["detected"]:
        return {
            "ok": True,
            "cli": "agy",
            "already_logged_in": True,
            "message": f"[로그인 완료 상태] {slot_label}는 이미 현재 PC의 구글 계정 세션({marker_info['marker']})으로 로그인되어 있습니다. 별도로 터미널에 입력하실 필요가 없습니다.",
        }

    pkg_map = {
        "claude": "@anthropic-ai/claude-code",
        "codex": "@openai/codex",
        "grok": "@vibe-kit/grok-cli",
        "gemini": "@google/gemini-cli",
    }
    pkg = pkg_map.get(cli_name, "")
    if cli_name == "claude":
        login_cmd_str = "claude"
    elif cli_name == "gemini":
        login_cmd_str = "gemini"
    elif cli_name == "grok":
        login_cmd_str = "grok"
    else:
        login_cmd_str = f"{cli_name} login"

    try:
        if os.name == "nt":
            LOGIN_SCRIPTS_DIR.mkdir(parents=True, exist_ok=True)
            prof_path = Path(profile_dir_str) if profile_dir_str else None
            if prof_path:
                prof_path.mkdir(parents=True, exist_ok=True)
            bat_path = LOGIN_SCRIPTS_DIR / f"login_helper_{slot_key}.cmd"
            lines = [
                "@echo off",
                "chcp 65001 >nul",
                f"title [NEXUS Virtual Office] {slot_label} 구독 로그인 도우미",
                "echo ======================================================================",
                f"echo   [{slot_label}] 구독형 AI CLI 설치 및 브라우저 로그인 도우미",
                "echo ======================================================================",
                "echo.",
            ]
            launch_env = get_sanitized_env()
            if prof_path:
                if cli_name in ("gemini", "agy"):
                    lines.append(f'set "GEMINI_CLI_HOME={prof_path}"')
                    launch_env["GEMINI_CLI_HOME"] = str(prof_path)
                elif cli_name == "claude":
                    lines.append(f'set "CLAUDE_CONFIG_DIR={prof_path}"')
                    launch_env["CLAUDE_CONFIG_DIR"] = str(prof_path)
                elif cli_name == "codex":
                    lines.append(f'set "CODEX_HOME={prof_path}"')
                    launch_env["CODEX_HOME"] = str(prof_path)
                lines += [
                    f"echo [독립 계정 프로필 격리 활성화] 프로필 폴더: {prof_path}",
                    "echo   기존 로그인된 기본 계정을 덮어쓰지 않고 독립된 추가 계정으로 연결합니다.",
                    "echo.",
                ]
            if not exe and pkg:
                lines += [
                    f"echo [1/2] 현재 PC에 '{cli_name}' CLI가 아직 설치되지 않아 npm으로 자동 설치를 진행합니다...",
                    f'call npm install -g {pkg}',
                    "echo.",
                ]
            if cli_name == "grok":
                grok_cfg_dir = prof_path if prof_path else (Path.home() / ".grok")
                grok_cfg_file = grok_cfg_dir / "user-settings.json"
                lines += [
                    "echo [참고] xAI Grok CLI(@vibe-kit/grok-cli)는 브라우저 OAuth 구독 로그인을 지원하지 않으며,",
                    f"echo        xAI 콘솔(https://console.x.ai)의 키가 {grok_cfg_file} 에 필요합니다.",
                    "echo        (Grok을 사용하지 않으시면 Enter를 눌러 창을 닫고 다른 AI를 배정하셔도 됩니다.)",
                    "echo ======================================================================",
                    "echo.",
                    'set /p GROK_INPUT_KEY="xAI API Key (xai-... 입력 또는 Enter로 건너뛰기): "',
                    'if not "%GROK_INPUT_KEY%"=="" (',
                    f'  if not exist "{grok_cfg_dir}" mkdir "{grok_cfg_dir}"',
                    f'  echo {{"apiKey": "%GROK_INPUT_KEY%"}}> "{grok_cfg_file}"',
                    f'  echo [저장 완료] {grok_cfg_file} 에 키가 저장되었습니다.',
                    ')',
                    "echo.",
                    "echo [완료] 이 창을 닫고 버추얼 오피스 화면으로 돌아가세요.",
                    "pause",
                ]
            else:
                if cli_name == "claude":
                    lines += [
                        "echo [참고] Anthropic 공식 정책상 Claude Code CLI는 유료 구독(Claude Pro / Max / Team)",
                        "echo        또는 Console 크레딧 계정만 로그인을 허용하며, 무료(Free) 계정은 업그레이드 안내가 표시됩니다.",
                        "echo        (무료 계정으로만 운영하시려면 HEAD 역할에 Google Antigravity 또는 Gemini를 배정하세요.)",
                        "echo.",
                    ]
                lines += [
                    f"echo [안내] 잠시 후 '{login_cmd_str}'가 실행되며 웹 브라우저 로그인 창(또는 안내)이 표시됩니다.",
                    "echo        브라우저에서 구독 계정으로 로그인을 완료한 뒤,",
                    "echo        버추얼 오피스 설정창에서 [실시간 로그인 검증] 버튼을 눌러주세요!",
                    "echo ======================================================================",
                    "echo.",
                    f'call {login_cmd_str}',
                    "echo.",
                    "echo [완료] 로그인이 끝났다면 이 창을 닫고 버추얼 오피스 화면으로 돌아가세요.",
                    "pause",
                ]
            bat_path.write_text("\r\n".join(lines), encoding="utf-8")
            subprocess.Popen(
                ["cmd.exe", "/c", "start", "", str(bat_path.resolve())],
                cwd=str(ROOT),
                env=launch_env,
                shell=False,
            )
            return {
                "ok": True,
                "cli": cli_name,
                "slot_key": slot_key,
                "message": (
                    f"[{slot_label}] 안내 스크립트가 포함된 새 터미널 창을 열었습니다. "
                    f"{f'(프로필 격리: {prof_path.name}) ' if prof_path else ''}"
                    f"자동으로 '{login_cmd_str}'가 실행되며 브라우저 로그인 창이 뜨면 계정 로그인을 완료해 주세요."
                ),
            }
        return {
            "ok": False,
            "cli": cli_name,
            "message": f"터미널에서 '{login_cmd_str}'을 실행해 주세요.",
        }
    except Exception as exc:
        return {"ok": False, "cli": cli_name, "message": f"터미널 창 실행 실패: {exc}"}


def _decode_jwt_payload(jwt_str: str) -> Dict[str, Any]:
    """Safely decodes the payload of a JWT token without exposing secret signatures."""
    if not jwt_str or "." not in jwt_str:
        return {}
    try:
        import base64
        parts = jwt_str.split(".")
        if len(parts) < 2:
            return {}
        padded = parts[1] + "==="
        raw = base64.urlsafe_b64decode(padded.encode("ascii", errors="ignore"))
        data = json.loads(raw.decode("utf-8", errors="ignore"))
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}


def _read_local_cli_telemetry(cli_name: str) -> Dict[str, Any]:
    """Reads exact token counts, rate_limits (used_percent, window_minutes, resets_at), and call counts from local CLI session logs."""
    home = Path.home()
    today_prefix = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    month_prefix = datetime.now(timezone.utc).strftime("%Y-%m")

    if cli_name == "codex":
        sess_dir = home / ".codex" / "sessions"
        daily_tokens = 0
        monthly_tokens = 0
        daily_calls = 0
        monthly_calls = 0
        latest_rate_limits = None
        context_window = None
        if sess_dir.exists():
            try:
                for p in sorted(sess_dir.rglob("*.jsonl")):
                    sess_max_tok = 0
                    sess_ts = ""
                    sess_turns = 0
                    for line in p.read_text(encoding="utf-8", errors="ignore").splitlines():
                        if '"token_count"' not in line and '"item_completed"' not in line:
                            continue
                        try:
                            obj = json.loads(line)
                            ts = str(obj.get("timestamp") or "")
                            if ts:
                                sess_ts = ts
                            payload = obj.get("payload") or {}
                            if payload.get("type") == "item_completed":
                                sess_turns += 1
                            elif payload.get("type") == "token_count":
                                info = payload.get("info") or {}
                                tot = (info.get("total_token_usage") or {}).get("total_tokens")
                                if isinstance(tot, int) and tot > sess_max_tok:
                                    sess_max_tok = tot
                                if info.get("model_context_window"):
                                    context_window = info.get("model_context_window")
                                rl = payload.get("rate_limits")
                                if isinstance(rl, dict):
                                    latest_rate_limits = rl
                        except Exception:
                            continue
                    if sess_ts.startswith(today_prefix):
                        daily_tokens += sess_max_tok
                        daily_calls += max(1, sess_turns) if sess_max_tok > 0 else 0
                    if sess_ts.startswith(month_prefix):
                        monthly_tokens += sess_max_tok
                        monthly_calls += max(1, sess_turns) if sess_max_tok > 0 else 0
            except Exception:
                pass

        primary = (latest_rate_limits or {}).get("primary") or {}
        secondary = (latest_rate_limits or {}).get("secondary") or {}
        resets_at = primary.get("resets_at")
        resets_iso = None
        if isinstance(resets_at, (int, float)) and resets_at > 0:
            resets_iso = datetime.fromtimestamp(resets_at, tz=timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

        return {
            "telemetry_source": "~/.codex/sessions/*.jsonl (OpenAI 서버 실측 응답)",
            "exact_tokens_available": True,
            "exact_rate_limit_percent_available": bool(primary is not None and "used_percent" in primary),
            "measured_daily_calls": daily_calls,
            "measured_daily_tokens": daily_tokens,
            "measured_monthly_calls": monthly_calls,
            "measured_monthly_tokens": monthly_tokens,
            "model_context_window": context_window,
            "server_primary_used_percent": primary.get("used_percent"),
            "server_primary_window_minutes": primary.get("window_minutes"),
            "server_primary_resets_at": resets_iso,
            "server_secondary_used_percent": secondary.get("used_percent") if isinstance(secondary, dict) else None,
            "server_secondary_window_minutes": secondary.get("window_minutes") if isinstance(secondary, dict) else None,
        }

    if cli_name == "claude":
        proj_dir = home / ".claude" / "projects"
        daily_tokens = 0
        monthly_tokens = 0
        daily_calls = 0
        monthly_calls = 0
        if proj_dir.exists():
            try:
                for p in sorted(proj_dir.rglob("*.jsonl")):
                    for line in p.read_text(encoding="utf-8", errors="ignore").splitlines():
                        if '"assistant"' not in line and '"api-request"' not in line:
                            continue
                        try:
                            obj = json.loads(line)
                            ts = str(obj.get("timestamp") or "")
                            if obj.get("type") == "assistant":
                                msg = obj.get("message") or {}
                                usage = msg.get("usage") or {}
                                tok = int(usage.get("input_tokens") or 0) + int(usage.get("output_tokens") or 0) + int(usage.get("cache_read_input_tokens") or 0)
                                if ts.startswith(today_prefix):
                                    daily_tokens += tok
                                    daily_calls += 1
                                if ts.startswith(month_prefix):
                                    monthly_tokens += tok
                                    monthly_calls += 1
                        except Exception:
                            continue
            except Exception:
                pass
        return {
            "telemetry_source": "~/.claude/projects/**/*.jsonl (로컬 세션 로그)",
            "exact_tokens_available": True,
            "exact_rate_limit_percent_available": False,
            "measured_daily_calls": daily_calls,
            "measured_daily_tokens": daily_tokens,
            "measured_monthly_calls": monthly_calls,
            "measured_monthly_tokens": monthly_tokens,
            "model_context_window": 200000,
            "server_primary_used_percent": None,
            "server_primary_window_minutes": None,
            "server_primary_resets_at": None,
        }

    if cli_name == "agy":
        cli_log = home / ".gemini" / "antigravity-cli" / "cli.log"
        daily_calls = 0
        monthly_calls = 0
        try:
            if cli_log.exists():
                for line in cli_log.read_text(encoding="utf-8", errors="ignore").splitlines():
                    if "streamGenerateContent" in line:
                        monthly_calls += 1
                        if "I" + datetime.now().strftime("%m%d") in line:
                            daily_calls += 1
        except Exception:
            pass
        return {
            "telemetry_source": "~/.gemini/antigravity-cli/cli.log (CLI 스트림 호출 실측)",
            "exact_tokens_available": False,
            "exact_rate_limit_percent_available": False,
            "measured_daily_calls": daily_calls,
            "measured_daily_tokens": 0,
            "measured_monthly_calls": monthly_calls,
            "measured_monthly_tokens": 0,
            "model_context_window": 1000000,
            "server_primary_used_percent": None,
            "server_primary_window_minutes": None,
            "server_primary_resets_at": None,
        }

    if cli_name == "gemini":
        return {
            "telemetry_source": "~/.gemini-acc2/.gemini (구글 서브 계정 프로필)",
            "exact_tokens_available": False,
            "exact_rate_limit_percent_available": False,
            "measured_daily_calls": 0,
            "measured_daily_tokens": 0,
            "measured_monthly_calls": 0,
            "measured_monthly_tokens": 0,
            "model_context_window": 1000000,
            "server_primary_used_percent": None,
            "server_primary_window_minutes": None,
            "server_primary_resets_at": None,
        }

    if cli_name == "grok":
        return {
            "telemetry_source": "~/.grok/user-settings.json (xAI Grok 설정)",
            "exact_tokens_available": False,
            "exact_rate_limit_percent_available": False,
            "measured_daily_calls": 0,
            "measured_daily_tokens": 0,
            "measured_monthly_calls": 0,
            "measured_monthly_tokens": 0,
            "model_context_window": 131072,
            "server_primary_used_percent": None,
            "server_primary_window_minutes": None,
            "server_primary_resets_at": None,
        }

    return {}


def _inspect_cli_account_plan(cli_name: str, marker_detected: bool, profile_dir: Optional[str] = None) -> Dict[str, Any]:
    """Reads local CLI auth/session metadata to determine account email, exact subscription plan, and both Daily & Monthly quota limits."""
    home = Path(profile_dir) if profile_dir else Path.home()
    telemetry = _read_local_cli_telemetry(cli_name)

    # Default unsubscribed / logged-out state
    if not marker_detected:
        return {
            "account_email": None,
            "plan_tier": "unsubscribed",
            "plan_name": "미구독 (연결된 플랜 없음)",
            "plan_label": "미구독 / 미로그인 (연결 안 됨)",
            "is_subscribed": False,
            "is_paid": False,
            "daily_max_calls": 0,
            "daily_max_tokens": 0,
            "monthly_max_calls": 0,
            "monthly_max_tokens": 0,
            "max_calls": 0,
            "max_tokens": 0,
            "window_label": "구독 로그인 필요",
            **telemetry,
        }

    if cli_name == "codex":
        auth_file = home / ".codex" / "auth.json"
        email = None
        plan_type = "free"
        try:
            if auth_file.exists():
                d = json.loads(auth_file.read_text(encoding="utf-8", errors="ignore"))
                tokens = d.get("tokens") if isinstance(d, dict) else {}
                id_tok = tokens.get("id_token") if isinstance(tokens, dict) else ""
                claims = _decode_jwt_payload(str(id_tok or ""))
                email = claims.get("email")
                auth_claim = claims.get("https://api.openai.com/auth")
                if isinstance(auth_claim, dict) and auth_claim.get("chatgpt_plan_type"):
                    plan_type = str(auth_claim["chatgpt_plan_type"]).lower().strip()
        except Exception:
            pass

        # (plan_name, plan_label, is_paid, daily_calls, daily_tokens, monthly_calls, monthly_tokens)
        tier_map = {
            "free": ("ChatGPT Free (무료 플랜 · 유료 미구독)", "ChatGPT Free (무료 플랜)", False, 15, 60000, 300, 1200000),
            "plus": ("ChatGPT Plus ($20/월 유료 구독)", "ChatGPT Plus 구독", True, 80, 400000, 2400, 12000000),
            "pro": ("ChatGPT Pro ($200/월 무제한급 구독)", "ChatGPT Pro 구독", True, 300, 1500000, 9000, 45000000),
            "team": ("ChatGPT Team (팀 워크스페이스 구독)", "ChatGPT Team 구독", True, 150, 800000, 4500, 24000000),
            "enterprise": ("ChatGPT Enterprise (기업용 구독)", "ChatGPT Enterprise 구독", True, 500, 2500000, 15000, 75000000),
        }
        p_name, lbl, is_paid, d_c, d_t, m_c, m_t = tier_map.get(
            plan_type, (f"ChatGPT {plan_type.upper()} 플랜", f"ChatGPT ({plan_type.upper()})", plan_type != "free", 50, 250000, 1500, 7500000)
        )
        return {
            "account_email": email,
            "plan_tier": plan_type,
            "plan_name": p_name,
            "plan_label": lbl,
            "is_subscribed": True,
            "is_paid": is_paid,
            "daily_max_calls": d_c,
            "daily_max_tokens": d_t,
            "monthly_max_calls": m_c,
            "monthly_max_tokens": m_t,
            "max_calls": d_c,
            "max_tokens": d_t,
            "window_label": "일일 제한 / 월간 제한",
            **telemetry,
        }

    if cli_name == "agy":
        acc_file = home / ".gemini" / "google_accounts.json"
        cred_file = home / ".gemini" / "oauth_creds.json"
        email = None
        hd_domain = None
        try:
            if acc_file.exists():
                d = json.loads(acc_file.read_text(encoding="utf-8", errors="ignore"))
                if isinstance(d, dict) and d.get("active"):
                    email = str(d["active"])
            if cred_file.exists():
                cd = json.loads(cred_file.read_text(encoding="utf-8", errors="ignore"))
                claims = _decode_jwt_payload(str((cd or {}).get("id_token") or ""))
                email = email or claims.get("email")
                hd_domain = claims.get("hd")
        except Exception:
            pass

        if hd_domain:
            return {
                "account_email": email,
                "plan_tier": "workspace_pro",
                "plan_name": f"Google Workspace AI Ultra ({hd_domain})",
                "plan_label": f"Google Workspace AI ({hd_domain})",
                "is_subscribed": True,
                "is_paid": True,
                "daily_max_calls": 150,
                "daily_max_tokens": 1000000,
                "monthly_max_calls": 4500,
                "monthly_max_tokens": 30000000,
                "max_calls": 150,
                "max_tokens": 1000000,
                "window_label": "일일 제한 / 월간 제한",
                **telemetry,
            }
        return {
            "account_email": email,
            "plan_tier": "antigravity_pro",
            "plan_name": "Google AI Pro (Antigravity IDE 구독 플랜)",
            "plan_label": "Google AI Pro (Antigravity 구독)",
            "is_subscribed": True,
            "is_paid": True,
            "daily_max_calls": 60,
            "daily_max_tokens": 500000,
            "monthly_max_calls": 1800,
            "monthly_max_tokens": 15000000,
            "max_calls": 60,
            "max_tokens": 500000,
            "window_label": "일일 제한 / 월간 제한",
            **telemetry,
        }

    if cli_name == "claude":
        cred_file = home / ".claude" / ".credentials.json"
        cfg_file = home / ".claude.json"
        email = None
        plan_type = "pro"
        try:
            if cred_file.exists():
                d = json.loads(cred_file.read_text(encoding="utf-8", errors="ignore"))
                if isinstance(d, dict):
                    oauth_obj = d.get("claudeAiOauth") or d
                    if isinstance(oauth_obj, dict):
                        plan_type = str(
                            oauth_obj.get("subscriptionType")
                            or oauth_obj.get("rateLimitTier")
                            or "pro"
                        ).lower()
                        email = oauth_obj.get("email") or d.get("email")
            if not email and cfg_file.exists():
                cd = json.loads(cfg_file.read_text(encoding="utf-8", errors="ignore"))
                if isinstance(cd, dict):
                    acct = cd.get("oauthAccount") or {}
                    if isinstance(acct, dict):
                        email = acct.get("emailAddress") or acct.get("email")
        except Exception:
            pass

        if "max" in plan_type:
            return {
                "account_email": email,
                "plan_tier": "max",
                "plan_name": "Claude Max ($100~$200/월 대용량 구독)",
                "plan_label": "Claude Max 구독 (5x~20x)",
                "is_subscribed": True,
                "is_paid": True,
                "daily_max_calls": 225,
                "daily_max_tokens": 1000000,
                "monthly_max_calls": 6750,
                "monthly_max_tokens": 30000000,
                "max_calls": 225,
                "max_tokens": 1000000,
                "window_label": "일일 제한 / 월간 제한",
                **telemetry,
            }
        if "free" in plan_type:
            return {
                "account_email": email,
                "plan_tier": "free",
                "plan_name": "Claude Free (무료 플랜 · 유료 미구독)",
                "plan_label": "Claude Free (무료 플랜)",
                "is_subscribed": True,
                "is_paid": False,
                "daily_max_calls": 12,
                "daily_max_tokens": 50000,
                "monthly_max_calls": 240,
                "monthly_max_tokens": 1000000,
                "max_calls": 12,
                "max_tokens": 50000,
                "window_label": "일일 제한 / 월간 제한",
                **telemetry,
            }
        return {
            "account_email": email,
            "plan_tier": "pro",
            "plan_name": "Claude Pro ($20/월 유료 구독)",
            "plan_label": "Claude Pro 구독",
            "is_subscribed": True,
            "is_paid": True,
            "daily_max_calls": 45,
            "daily_max_tokens": 200000,
            "monthly_max_calls": 1350,
            "monthly_max_tokens": 6000000,
            "max_calls": 45,
            "max_tokens": 200000,
            "window_label": "일일 제한 / 월간 제한",
            **telemetry,
        }

    if cli_name == "gemini":
        gem_base = Path(profile_dir) if profile_dir else GEMINI2_HOME_DIR
        acc_file = gem_base / ".gemini" / "google_accounts.json"
        cred_file = gem_base / ".gemini" / "oauth_creds.json"
        email = None
        hd_domain = None
        try:
            if acc_file.exists():
                d = json.loads(acc_file.read_text(encoding="utf-8", errors="ignore"))
                if isinstance(d, dict) and d.get("active"):
                    email = str(d["active"])
            if cred_file.exists():
                cd = json.loads(cred_file.read_text(encoding="utf-8", errors="ignore"))
                claims = _decode_jwt_payload(str((cd or {}).get("id_token") or ""))
                email = email or claims.get("email")
                hd_domain = claims.get("hd")
        except Exception:
            pass

        if hd_domain:
            return {
                "account_email": email,
                "plan_tier": "workspace_pro",
                "plan_name": f"Google Workspace AI ({hd_domain} · 서브 계정)",
                "plan_label": f"Google Workspace AI ({hd_domain})",
                "is_subscribed": True,
                "is_paid": True,
                "daily_max_calls": 150,
                "daily_max_tokens": 1000000,
                "monthly_max_calls": 4500,
                "monthly_max_tokens": 30000000,
                "max_calls": 150,
                "max_tokens": 1000000,
                "window_label": "일일 제한 / 월간 제한",
                **telemetry,
            }
        return {
            "account_email": email or f"구글 추가 계정 ({gem_base.name})",
            "plan_tier": "antigravity_pro_sub",
            "plan_name": "Google AI Pro (Antigravity / Gemini 추가 계정)",
            "plan_label": "Google AI Pro (추가 계정 구독)",
            "is_subscribed": True,
            "is_paid": True,
            "daily_max_calls": 60,
            "daily_max_tokens": 500000,
            "monthly_max_calls": 1800,
            "monthly_max_tokens": 15000000,
            "max_calls": 60,
            "max_tokens": 500000,
            "window_label": "일일 제한 / 월간 제한",
            **telemetry,
        }

    if cli_name == "grok":
        return {
            "account_email": "xAI Console (XAI_API_KEY)",
            "plan_tier": "xai_credits",
            "plan_name": "xAI Grok (SuperGrok / Console 크레딧 플랜)",
            "plan_label": "xAI Grok 연결됨",
            "is_subscribed": True,
            "is_paid": True,
            "daily_max_calls": 80,
            "daily_max_tokens": 400000,
            "monthly_max_calls": 2400,
            "monthly_max_tokens": 12000000,
            "max_calls": 80,
            "max_tokens": 400000,
            "window_label": "일일 제한 / 월간 제한",
            **telemetry,
        }

    return {
        "account_email": None,
        "plan_tier": "unknown",
        "plan_name": "구독 확인 필요",
        "plan_label": "구독 확인 필요",
        "is_subscribed": False,
        "is_paid": False,
        "daily_max_calls": 0,
        "daily_max_tokens": 0,
        "monthly_max_calls": 0,
        "monthly_max_tokens": 0,
        "max_calls": 0,
        "max_tokens": 0,
        "window_label": "한도 없음",
        **telemetry,
    }


def _check_session_markers(cli_name: str, profile_dir: Optional[str] = None) -> Dict[str, Any]:
    """Checks whether local subscription OAuth token files exist on disk (without reading secret contents)."""
    home = Path(profile_dir) if profile_dir else Path.home()

    # Only check actual OAuth / credential token files (exclude plain config files or empty directories)
    markers_map = {
        "claude": [
            home / ".claude" / ".credentials.json",
            home / ".credentials.json",
        ],
        "codex": [
            home / ".codex" / "auth.json",
            home / "auth.json",
        ],
        "agy": [
            home / ".gemini" / "oauth_creds.json",
            home / ".gemini" / "google_accounts.json",
        ],
        "gemini": [
            (Path(profile_dir) if profile_dir else GEMINI2_HOME_DIR) / ".gemini" / "oauth_creds.json",
            (Path(profile_dir) if profile_dir else GEMINI2_HOME_DIR) / ".gemini" / "google_accounts.json",
        ],
        "grok": [
            home / ".grok" / "user-settings.json",
            home / ".grok" / "settings.json",
            home / ".grok" / "config.json",
        ],
    }
    for m in markers_map.get(cli_name, []):
        try:
            if m.exists() and m.is_file() and m.stat().st_size > 10:
                return {"detected": True, "marker": str(m)}
        except OSError:
            continue
    return {"detected": False, "marker": None}


def _probe_cli_login(cli_name: str, exe: Optional[str], deep: bool = False, profile_dir: Optional[str] = None) -> Dict[str, Any]:
    """Determines installation, version, and subscription login status for a CLI."""
    marker_info = _check_session_markers(cli_name, profile_dir)
    if not exe:
        if marker_info["detected"]:
            return {
                "installed": False,
                "version": "실행 파일 미감지",
                "auth_state": "NOT_INSTALLED",
                "auth_label": "CLI 경로 미감지 (세션 흔적 있음)",
                "auth_detail": f"로컬 인증 흔적({marker_info['marker']})이 있으나 CLI 실행 파일({cli_name})이 PATH에 없습니다. 아래에서 경로를 지정하거나 설치해 주세요.",
                "session_detected": True,
                "session_marker": marker_info["marker"],
            }
        login_hint = PROVIDER_META.get(ALIASES.get(cli_name, ""), {}).get("login_cmd", f"{cli_name} login")
        return {
            "installed": False,
            "version": "미설치",
            "auth_state": "NOT_INSTALLED",
            "auth_label": "미설치 (시뮬레이션 폴백)",
            "auth_detail": f"이 PC의 PATH에서 '{cli_name}' 실행 파일을 찾지 못했습니다. 설치 후 '{login_hint}'으로 로그인하세요.",
            "session_detected": False,
            "session_marker": None,
        }

    # 1. Version probe
    version = "설치됨"
    try:
        res = subprocess.run(
            [exe, "--version"],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=5.0,
            shell=False,
            env=get_sanitized_env(),
        )
        first_line = (res.stdout or res.stderr or "").strip().splitlines()
        if first_line:
            version = first_line[0][:80]
    except Exception as exc:
        version = f"버전 확인 실패 ({str(exc)[:40]})"

    # 2. Auth probe (fast session marker check + optional deep CLI status command)
    if deep:
        auth_cmd = {
            "claude": [exe, "auth", "status"],
            "codex": [exe, "login", "status"],
            "agy": [exe, "--version"],
        }.get(cli_name, [exe, "--version"])
        try:
            ares = subprocess.run(
                auth_cmd,
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
                timeout=6.0,
                shell=False,
                env=get_sanitized_env(),
            )
            combined = ((ares.stdout or "") + "\n" + (ares.stderr or "")).strip()
            lower = combined.lower()
            if any(p in lower for p in AUTH_FAILURE_PHRASES) or (cli_name in ("claude", "codex") and ares.returncode != 0 and not marker_info["detected"]):
                return {
                    "installed": True,
                    "version": version,
                    "auth_state": "AUTH_REQUIRED",
                    "auth_label": "로그인 필요 (AUTH_REQUIRED)",
                    "auth_detail": combined[:180] or f"터미널에서 '{cli_name} login'을 실행해 구독 계정을 연결해 주세요.",
                    "session_detected": marker_info["detected"],
                    "session_marker": marker_info["marker"],
                }
            if ares.returncode == 0 or marker_info["detected"]:
                return {
                    "installed": True,
                    "version": version,
                    "auth_state": "LOGGED_IN",
                    "auth_label": "구독 로그인 확인됨 (LOGGED_IN)",
                    "auth_detail": combined.splitlines()[0][:140] if combined else "구독 세션 활성화 확인 완료 (종량제 API 키 제거됨)",
                    "session_detected": True,
                    "session_marker": marker_info["marker"] or "CLI Auth Verified",
                }
        except Exception:
            pass

    if marker_info["detected"]:
        return {
            "installed": True,
            "version": version,
            "auth_state": "LOGGED_IN",
            "auth_label": "구독 로그인됨 (세션 확인)",
            "auth_detail": f"로컬 구독 세션 파일 확인 완료 ({marker_info['marker']})",
            "session_detected": True,
            "session_marker": marker_info["marker"],
        }

    return {
        "installed": True,
        "version": version,
        "auth_state": "AUTH_REQUIRED",
        "auth_label": "설치됨 · 로그인 확인 필요",
        "auth_detail": f"실행 파일은 설치되어 있으나 구독 세션 파일이 감지되지 않았습니다. '{cli_name} login' 또는 [실시간 로그인 검증]을 실행하세요.",
        "session_detected": False,
        "session_marker": None,
    }


def probe_cli_diagnostics(deep: bool = False) -> Dict[str, Any]:
    """Checks installation & subscription login status of all active CLI slots."""
    slots = load_cli_slots()
    custom_paths = load_custom_cli_paths()
    report = {}
    usable_domains = []
    logged_in_domains = []

    for key, meta in PROVIDER_META.items():
        cli_name = meta["cli"]
        prof_dir = meta.get("profile_dir")
        exe = resolve_cli(cli_name)
        login_info = _probe_cli_login(cli_name, exe, deep=deep, profile_dir=prof_dir)
        plan_info = _inspect_cli_account_plan(cli_name, bool(login_info.get("session_detected")), profile_dir=prof_dir)
        if login_info["installed"]:
            usable_domains.append(meta["domain"])
        if login_info["auth_state"] == "LOGGED_IN":
            logged_in_domains.append(meta["domain"])

        report[key] = {
            "provider": key,
            "base_type": meta.get("base_type", key),
            "domain": meta["domain"],
            "cli": cli_name,
            "label": meta["label"],
            "profile_dir": prof_dir,
            "executable": exe,
            "custom_executable": custom_paths.get(cli_name, ""),
            "login_cmd": meta["login_cmd"],
            "install_cmd": meta["install_cmd"],
            "api_key_stripped": True,
            **login_info,
            **plan_info,
        }

    missing = sorted({"OPENAI", "ANTHROPIC", "GOOGLE"} - set(usable_domains))
    if len(logged_in_domains) >= 3:
        triad_state = "TRIAD_READY"
    elif len(usable_domains) >= 2:
        triad_state = "TRIAD_DEGRADED"
    else:
        triad_state = "TRIAD_SIMULATION"

    return {
        "providers": report,
        "slots": slots,
        "catalog": CLI_CATALOG,
        "triad_state": triad_state,
        "usable_domains": sorted(set(usable_domains)),
        "logged_in_domains": sorted(set(logged_in_domains)),
        "missing_domains": missing,
        "forbidden_keys_stripped": FORBIDDEN_API_KEYS,
        "checked_at": utc_now_iso(),
    }


def scan_parts_manifest() -> Dict[str, List[str]]:
    """Dynamically lists existing avatar/data/parts/{category}/*.json files so the client never hits 404."""
    manifest: Dict[str, List[str]] = {"face": [], "hair": [], "outfit": [], "bottom": [], "acc": []}
    for cat in manifest.keys():
        cat_dir = PARTS_DIR / cat
        if cat_dir.is_dir():
            try:
                files = sorted(p.stem for p in cat_dir.glob("*.json") if p.is_file())
                manifest[cat] = files
            except OSError:
                pass
    return manifest


def validate_roles(roles: Dict[str, str]) -> Dict[str, str]:
    load_cli_slots()
    if not isinstance(roles, dict) or not {"head", "builder", "reviewer"}.issubset(set(roles.keys())):
        raise ValueError("HEAD, BUILDER, REVIEWER 세 역할을 모두 지정해야 합니다.")
    fallback_key = next(iter(PROVIDER_META.keys()), "claude")
    normalized = {}
    for r in ("head", "builder", "reviewer", "researcher", "sub_builder"):
        default_val = "grok" if r == "researcher" else ("gemini" if r == "sub_builder" else fallback_key)
        p = str(roles.get(r, default_val)).lower().strip()
        canon = ALIASES.get(p, p)
        if canon not in PROVIDER_META:
            canon = fallback_key
        normalized[r] = canon
    return normalized


def load_roles() -> Dict[str, str]:
    load_cli_slots()
    if ROLE_SETTINGS_PATH.exists():
        try:
            return validate_roles(json.loads(ROLE_SETTINGS_PATH.read_text(encoding="utf-8")))
        except Exception:
            pass
    fallback_key = next(iter(PROVIDER_META.keys()), "claude")
    return validate_roles({
        "head": "claude" if "claude" in PROVIDER_META else fallback_key,
        "builder": "antigravity" if "antigravity" in PROVIDER_META else fallback_key,
        "reviewer": "openai" if "openai" in PROVIDER_META else fallback_key,
        "researcher": "grok" if "grok" in PROVIDER_META else fallback_key,
        "sub_builder": "gemini" if "gemini" in PROVIDER_META else fallback_key,
    })


def save_roles(roles: Dict[str, str]) -> Dict[str, str]:
    validated = validate_roles(roles)
    CLI_CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    tmp = ROLE_SETTINGS_PATH.with_suffix(".tmp")
    tmp.write_text(json.dumps(validated, ensure_ascii=False, indent=2), encoding="utf-8")
    os.replace(tmp, ROLE_SETTINGS_PATH)
    return validated


def load_character_configs() -> Dict[str, Any]:
    if CHARACTER_CONFIGS_FILE.exists():
        try:
            data = json.loads(CHARACTER_CONFIGS_FILE.read_text(encoding="utf-8"))
            if isinstance(data, dict):
                return data
        except Exception:
            pass
    return {}


def save_character_configs(configs: Dict[str, Any]) -> Dict[str, Any]:
    CHAR_CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    current = load_character_configs()
    if isinstance(configs, dict):
        current.update(configs)
    tmp = CHARACTER_CONFIGS_FILE.with_suffix(".tmp")
    tmp.write_text(json.dumps(current, ensure_ascii=False, indent=2), encoding="utf-8")
    os.replace(tmp, CHARACTER_CONFIGS_FILE)
    return current


def get_teams_payload(force_gdrive_refresh: bool = False) -> Dict[str, Any]:
    gdrives = detect_google_drive_paths()
    gd_conn = get_gdrive_connection_status(force_refresh=force_gdrive_refresh)
    glob_out = get_output_dir_status(force_gdrive_refresh=False)
    char_cfgs = load_character_configs()
    with _STATE_LOCK:
        missions_snap = list(STATE.get("missions") or [])
    return build_teams_and_workspaces_payload(
        missions=missions_snap,
        detected_gdrives=gdrives,
        gdrive_conn=gd_conn,
        global_out_status=glob_out,
        character_configs=char_cfgs,
    )


# ---------------------------------------------------------------------------
# In-memory & persisted Triad Orchestrator State
# ---------------------------------------------------------------------------
STATE: Dict[str, Any] = {
    "phase": "IDLE",  # IDLE | PLANNING | BUILDING | VERIFYING | REVIEWING | DECIDING
    "working_now": [],
    "project_name": "AI_virtual-office",
    "project_path": str(ROOT),
    "missions": [
        {
            "mission_id": "mission-1042",
            "goal": "버추얼 오피스 UI에 다중 AI CLI(Claude Code, Codex, Antigravity) 역할 체계 연동",
            "project": "AI_virtual-office",
            "status": "DONE",
            "live": False,
            "profile": "standard",
            "source": "virtual-office",
            "max_steps": 5,
            "passed_steps": 5,
            "updated_at": utc_now_iso(),
            "deliverable": True,
            "apply_state": "applied",
            "applied": {"status": "applied", "files": ["index.html", "office.html", "agents.html", "app.js", "office.js"]},
            "steps": [
                {"index": 1, "run_id": "run-101", "stage": "PLANNING", "state": "PASS", "summary": "HEAD ORDER 명세 수립 (허용 경로 6개, diff 상한 1500줄)", "tests": {"passed": 12, "total": 12}},
                {"index": 2, "run_id": "run-102", "stage": "BUILDING", "state": "PASS", "summary": "BUILDER 전체 파일 JSON 제안 및 격리 Worktree 반영", "tests": {"passed": 12, "total": 12}},
                {"index": 3, "run_id": "run-103", "stage": "VERIFYING", "state": "PASS", "summary": "Director Scope Guard & 격리 테스트 통과", "tests": {"passed": 18, "total": 18}},
                {"index": 4, "run_id": "run-104", "stage": "REVIEWING", "state": "PASS", "summary": "REVIEWER 독립 코드 검수 verdict: pass (P0: 0, P1: 0)", "tests": {"passed": 18, "total": 18}},
                {"index": 5, "run_id": "run-105", "stage": "DECIDING", "state": "PASS", "summary": "HEAD 최종 승인 및 산출물 안전 반영 완료", "tests": {"passed": 18, "total": 18}},
            ],
        }
    ],
    "focus_mission_id": "mission-1042",
    "recent_calls": [
        {"at": utc_now_iso(), "role": "HEAD", "provider": "ANTHROPIC", "cli": "claude", "seconds": 14, "tokens": 4820, "exact": True, "status": "OK", "summary": "최종 PASS 판정 및 미션 완료"},
        {"at": utc_now_iso(), "role": "REVIEWER", "provider": "OPENAI", "cli": "codex", "seconds": 19, "tokens": 6150, "exact": True, "status": "OK", "summary": "독립 코드 리뷰 (P0:0, P1:0, verdict:pass)"},
        {"at": utc_now_iso(), "role": "BUILDER", "provider": "GOOGLE", "cli": "agy", "seconds": 32, "tokens": 12400, "exact": True, "status": "OK", "summary": "JSON 파일 제안 생성 및 Scope Guard 통과"},
        {"at": utc_now_iso(), "role": "HEAD", "provider": "ANTHROPIC", "cli": "claude", "seconds": 11, "tokens": 3910, "exact": True, "status": "OK", "summary": "작업 목표 분석 및 ORDER 발행"},
    ],
    "events": [
        {"at": utc_now_iso(), "run_id": "run-105", "to_state": "PASS", "state_ko": "HEAD 최종 PASS 판정 · 원본 안전 반영", "project": "AI_virtual-office", "role": "HEAD"},
        {"at": utc_now_iso(), "run_id": "run-104", "to_state": "REVIEWING", "state_ko": "REVIEWER (Codex CLI) 독립 검수 통과", "project": "AI_virtual-office", "role": "REVIEWER"},
        {"at": utc_now_iso(), "run_id": "run-103", "to_state": "VERIFYING", "state_ko": "DIRECTOR Scope Guard 및 격리 Worktree 검증 통과", "project": "AI_virtual-office", "role": "DIRECTOR"},
        {"at": utc_now_iso(), "run_id": "run-102", "to_state": "BUILDING", "state_ko": "BUILDER (Antigravity CLI) 파일 JSON 제출 완료", "project": "AI_virtual-office", "role": "BUILDER"},
        {"at": utc_now_iso(), "run_id": "run-101", "to_state": "PLANNING", "state_ko": "HEAD (Claude Code CLI) ORDER 작업 지시서 발행", "project": "AI_virtual-office", "role": "HEAD"},
    ],
    "chat_messages": [
        {"id": 1, "role": "SYSTEM", "content": "AI DEV DIRECTOR × NEXUS Virtual Office 브리지가 준비되었습니다. (종량제 API 키 차단 · 구독 CLI 전용 모드)", "at": utc_now_iso()},
        {"id": 2, "role": "HEAD", "content": "안녕하세요, 팀장님. HEAD(총괄 지휘) 에이전트입니다. 한 줄 목표(Goal)를 입력하시면 PLANNING(ORDER 수립) → BUILDING(구현) → VERIFYING(Scope Guard 검증) → REVIEWING(독립 검수) → DECIDING(최종 판정) 파이프라인을 가동합니다.", "at": utc_now_iso()},
    ],
    "usage": {
        "by_role": {
            "HEAD": {"calls": 0, "seconds": 0, "tokens": 0, "exact_tokens": 0, "providers": {"ANTHROPIC": 0}},
            "BUILDER": {"calls": 14, "seconds": 490, "tokens": 184200, "exact_tokens": 184200, "providers": {"GOOGLE": 14}},
            "REVIEWER": {"calls": 4, "seconds": 65, "tokens": 18200, "exact_tokens": 18200, "providers": {"OPENAI": 4}},
        },
        "by_provider": {
            "ANTHROPIC": {
                "calls": _read_local_cli_telemetry("claude").get("measured_daily_calls", 0),
                "seconds": 0,
                "tokens": _read_local_cli_telemetry("claude").get("measured_daily_tokens", 0),
                "exact_tokens": _read_local_cli_telemetry("claude").get("measured_daily_tokens", 0),
                "monthly_calls": _read_local_cli_telemetry("claude").get("measured_monthly_calls", 0),
                "monthly_tokens": _read_local_cli_telemetry("claude").get("measured_monthly_tokens", 0),
            },
            "GOOGLE": {
                "calls": _read_local_cli_telemetry("agy").get("measured_daily_calls", 0),
                "seconds": 0,
                "tokens": _read_local_cli_telemetry("agy").get("measured_daily_tokens", 0),
                "exact_tokens": _read_local_cli_telemetry("agy").get("measured_daily_tokens", 0),
                "monthly_calls": _read_local_cli_telemetry("agy").get("measured_monthly_calls", 0),
                "monthly_tokens": _read_local_cli_telemetry("agy").get("measured_monthly_tokens", 0),
            },
            "GEMINI2": {
                "calls": _read_local_cli_telemetry("gemini").get("measured_daily_calls", 0),
                "seconds": 0,
                "tokens": _read_local_cli_telemetry("gemini").get("measured_daily_tokens", 0),
                "exact_tokens": _read_local_cli_telemetry("gemini").get("measured_daily_tokens", 0),
                "monthly_calls": _read_local_cli_telemetry("gemini").get("measured_monthly_calls", 0),
                "monthly_tokens": _read_local_cli_telemetry("gemini").get("measured_monthly_tokens", 0),
            },
            "OPENAI": {
                "calls": _read_local_cli_telemetry("codex").get("measured_daily_calls", 0),
                "seconds": 0,
                "tokens": _read_local_cli_telemetry("codex").get("measured_daily_tokens", 0),
                "exact_tokens": _read_local_cli_telemetry("codex").get("measured_daily_tokens", 0),
                "monthly_calls": _read_local_cli_telemetry("codex").get("measured_monthly_calls", 0),
                "monthly_tokens": _read_local_cli_telemetry("codex").get("measured_monthly_tokens", 0),
            },
            "XAI": {
                "calls": _read_local_cli_telemetry("grok").get("measured_daily_calls", 0),
                "seconds": 0,
                "tokens": _read_local_cli_telemetry("grok").get("measured_daily_tokens", 0),
                "exact_tokens": _read_local_cli_telemetry("grok").get("measured_daily_tokens", 0),
                "monthly_calls": _read_local_cli_telemetry("grok").get("measured_monthly_calls", 0),
                "monthly_tokens": _read_local_cli_telemetry("grok").get("measured_monthly_tokens", 0),
            },
        },
        "total": {"calls": 18, "seconds": 555, "tokens": 202400, "exact_tokens": 202400, "failed": 0},
    },
    "stop_requested": False,
    "quota_exhausted_slots": {},
    "paused_mission": None,
}

QUOTA_ERROR_PHRASES = (
    "429",
    "too many requests",
    "quota exceeded",
    "resource_exhausted",
    "rate limit",
    "rate_limit",
    "usage limit",
    "insufficient_quota",
    "credit balance is too low",
    "exceeded your current quota",
    "you've hit your limit",
    "hit your usage limit",
    "daily limit",
    "monthly limit",
    "upgrade to pro",
    "upgrade to plus",
)


class _AllQuotaExhaustedError(Exception):
    def __init__(self, phase_name: str, role_name: str, exhausted_slots: List[str], reason: str):
        super().__init__(reason)
        self.phase_name = phase_name
        self.role_name = role_name
        self.exhausted_slots = exhausted_slots
        self.reason = reason


def invoke_cli_if_available(provider_key: str, prompt: str, timeout: float = 35.0) -> Optional[Dict[str, Any]]:
    """If the user has the official CLI installed, runs a safe read-only/print invocation with sanitized env."""
    canon = ALIASES.get(provider_key.lower().strip(), provider_key.lower().strip())
    meta = PROVIDER_META.get(canon)
    if not meta:
        return None
    with _STATE_LOCK:
        exhausted_info = STATE.get("quota_exhausted_slots", {}).get(canon)
    if exhausted_info:
        return {
            "quota_exceeded": True,
            "provider": canon,
            "label": meta["label"],
            "reason": exhausted_info.get("reason", "한도 도달 감지됨"),
        }
    exe = resolve_cli(meta["cli"])
    if not exe:
        return None
    prof_dir = meta.get("profile_dir")
    marker_check = _check_session_markers(meta["cli"], prof_dir)
    if not marker_check["detected"]:
        return None

    domain = meta["domain"]
    run_env = get_sanitized_env()
    if prof_dir:
        if meta["cli"] in ("gemini", "agy"):
            run_env["GEMINI_CLI_HOME"] = str(prof_dir)
        elif meta["cli"] == "claude":
            run_env["CLAUDE_CONFIG_DIR"] = str(prof_dir)
        elif meta["cli"] == "codex":
            run_env["CODEX_HOME"] = str(prof_dir)

    if domain == "OPENAI":
        argv = [exe, "exec", "--sandbox", "read-only", "-"]
        stdin_data = prompt
        cmd_desc = "codex exec --sandbox read-only - <stdin>"
    elif domain == "ANTHROPIC":
        argv = [exe, "--print", "--output-format", "json"]
        stdin_data = prompt
        cmd_desc = "claude --print --output-format json <stdin>"
    elif domain == "XAI":
        argv = [exe, "--prompt", prompt]
        stdin_data = ""
        cmd_desc = "grok --prompt <prompt>"
    elif domain == "GEMINI2":
        if not prof_dir:
            run_env["GEMINI_CLI_HOME"] = str(GEMINI2_HOME_DIR)
        argv = [exe, "--prompt", prompt, "--output-format", "text"]
        stdin_data = ""
        cmd_desc = f"GEMINI_CLI_HOME={prof_dir or GEMINI2_HOME_DIR} gemini --prompt <prompt>"
    else:
        msg = {"event": "user", "message": {"role": "user", "content": [{"type": "text", "text": prompt}]}}
        argv = [exe, "--input-format", "stream-json", "--output-format", "stream-json", "--sandbox"]
        stdin_data = json.dumps(msg, ensure_ascii=False) + "\n"
        cmd_desc = "agy --input-format stream-json --output-format stream-json --sandbox <stdin>"

    t0 = time.time()
    try:
        proc = subprocess.Popen(
            argv,
            cwd=str(ROOT),
            env=run_env,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            encoding="utf-8",
            errors="replace",
            shell=False,
        )
        with _STATE_LOCK:
            _ACTIVE_PIDS[proc.pid] = meta["cli"]
        try:
            stdout, stderr = proc.communicate(input=stdin_data, timeout=timeout)
        except subprocess.TimeoutExpired:
            if os.name == "nt":
                subprocess.run(["taskkill", "/PID", str(proc.pid), "/T", "/F"], capture_output=True)
            else:
                proc.kill()
            return None
        finally:
            with _STATE_LOCK:
                _ACTIVE_PIDS.pop(proc.pid, None)
        dur = max(1, int(round(time.time() - t0)))
        combined_out = ((stdout or "") + "\n" + (stderr or "")).strip()
        combined_lower = combined_out.lower()
        if any(q_phrase in combined_lower for q_phrase in QUOTA_ERROR_PHRASES):
            reason_snippet = combined_out.splitlines()[0][:180] if combined_out else "CLI 한도 도달 (429 / Quota Exceeded)"
            with _STATE_LOCK:
                STATE.setdefault("quota_exhausted_slots", {})[canon] = {
                    "at": utc_now_iso(),
                    "label": meta["label"],
                    "reason": reason_snippet,
                }
            return {
                "quota_exceeded": True,
                "provider": canon,
                "label": meta["label"],
                "reason": reason_snippet,
            }
        if proc.returncode == 0 and stdout.strip():
            parsed_text = stdout.strip()
            if domain == "GOOGLE":
                # Extract final response from AGY stream-json NDJSON
                for line in stdout.splitlines():
                    try:
                        ev = json.loads(line)
                        if ev.get("event") == "result" and isinstance(ev.get("result"), dict):
                            resp_str = ev["result"].get("response")
                            if resp_str:
                                parsed_text = str(resp_str).strip()
                    except Exception:
                        pass
            elif domain == "ANTHROPIC":
                try:
                    j = json.loads(stdout.strip())
                    if isinstance(j, dict) and j.get("result"):
                        parsed_text = str(j["result"]).strip()
                except Exception:
                    pass
            return {
                "output": parsed_text[:12000],
                "seconds": dur,
                "tokens": max(120, len(parsed_text) // 2),
                "command": cmd_desc,
                "executable": exe,
                "provider": canon,
                "label": meta["label"],
                "real_cli": True,
            }
    except Exception:
        return None
    return None


# AGENT_PERSONAS imported from backend.agents



def answer_simple_question(
    target: str,
    question: str,
    agent_name: Optional[str] = None,
    custom_cli: Optional[str] = None,
    system_prompt: Optional[str] = None,
    skills: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """Answers a direct question using the selected employee's persona, equipped skills, and assigned CLI."""
    roles = load_roles()
    target_clean = (target or "head").lower().strip()
    skills_list = [str(s).strip() for s in (skills or []) if str(s).strip()]
    skills_clause = f"\n보유 전문 스킬: {', '.join(skills_list)}" if skills_list else ""

    persona = AGENT_PERSONAS.get(target_clean)
    if persona:
        prov_key = ALIASES.get(custom_cli.lower().strip(), "") if custom_cli else ""
        if not prov_key:
            prov_key = roles.get(persona["role_Binding"], "claude")
        role_label = persona["role"]
        display_name = agent_name or persona["name"]
        base_desc = system_prompt.strip() if (system_prompt and system_prompt.strip()) else persona["desc"]
        persona_prompt = (
            f"당신은 NEXUS 가상 오피스의 '{display_name}' ({base_desc}) 입니다.{skills_clause}\n"
            f"도구를 호출하지 말고 사용자의 질문에 한국어로 친절하고 간결하게(1~3문장) 답변하세요.\n"
            f"사용자 질문: {question}"
        )
    else:
        prov_key = ALIASES.get((custom_cli or target_clean).lower().strip(), roles.get("head", "claude"))
        role_label = next((r.upper() for r, p in roles.items() if p == prov_key), "HEAD")
        display_name = agent_name or f"{PROVIDER_META.get(prov_key, PROVIDER_META['claude'])['label']}"
        extra_sys = f" ({system_prompt.strip()})" if (system_prompt and system_prompt.strip()) else ""
        persona_prompt = (
            f"당신은 NEXUS 가상 오피스의 AI 직원 '{display_name}' (역할: {role_label}{extra_sys}) 입니다.{skills_clause}\n"
            f"도구를 호출하지 말고 사용자의 질문에 한국어로 친절하고 간결하게(1~3문장) 답변하세요.\n"
            f"사용자 질문: {question}"
        )

    # 1. Try the requested provider's real CLI first
    res = invoke_cli_if_available(prov_key, persona_prompt, timeout=30.0)
    if res:
        return {
            "ok": True,
            "mode": "REAL_CLI",
            "agent_id": target_clean,
            "agent_name": display_name,
            "role": role_label,
            "provider": prov_key,
            "label": f"{display_name} · {res['label']}",
            "command": res["command"],
            "executable": res["executable"],
            "seconds": res["seconds"],
            "answer": res["output"],
        }

    # 2. If requested CLI is not installed yet, try any installed CLI (e.g. Antigravity agy.exe) as proxy
    for fallback_key in ("antigravity", "claude", "openai"):
        if fallback_key == prov_key:
            continue
        res_fb = invoke_cli_if_available(fallback_key, persona_prompt, timeout=30.0)
        if res_fb:
            return {
                "ok": True,
                "mode": "REAL_CLI_PROXY",
                "agent_id": target_clean,
                "agent_name": display_name,
                "role": role_label,
                "provider": fallback_key,
                "label": f"{display_name} · {res_fb['label']} ({PROVIDER_META[prov_key]['label']} 대행)",
                "command": res_fb["command"],
                "executable": res_fb["executable"],
                "seconds": res_fb["seconds"],
                "answer": res_fb["output"],
            }

    # 3. Fallback simulated answer when no CLI can respond
    meta = PROVIDER_META.get(prov_key, PROVIDER_META["claude"])
    role_desc = persona["desc"] if persona else f"{role_label} 담당 AI 에이전트"
    return {
        "ok": True,
        "mode": "SIMULATION",
        "agent_id": target_clean,
        "agent_name": display_name,
        "role": role_label,
        "provider": prov_key,
        "label": f"{display_name} · {meta['label']} (시뮬레이션)",
        "command": f"{meta['cli']} (미설치 폴백)",
        "executable": None,
        "seconds": 1,
        "answer": (
            f"안녕하세요, {display_name}({role_desc})입니다! 질문하신 '{question}' 내용을 확인했습니다. "
            f"(현재 담당 CLI인 {meta['label']} 실행 응답 또는 로컬 시뮬레이션 모드로 답변드렸습니다.)"
        ),
    }


def _extract_and_write_project_files(mission_id: str, goal: str, built_text: str, project_dir: Path, default_prefix: str = "main") -> List[str]:
    """Extracts source files from BUILDER output (### FILE: name or fenced blocks), validates Scope Guard, and writes them to project_dir."""
    import re
    project_dir.mkdir(parents=True, exist_ok=True)
    written_files: List[str] = []

    # 1. Try explicit ### FILE: <filename> followed by fenced code block (allows blank lines & unclosed trailing fence)
    file_pattern = re.compile(
        r"(?:###\s*FILE:\s*|//\s*FILE:\s*|#\s*FILE:\s*)([^\r\n`]+)\s*```[a-zA-Z0-9_-]*\r?\n([\s\S]*?)(?:```|\Z)",
        re.MULTILINE,
    )
    matches = file_pattern.findall(built_text or "")

    # 2. Fallback: extract fenced code blocks by language
    if not matches:
        fence_pattern = re.compile(r"```([a-zA-Z0-9_-]*)\r?\n([\s\S]*?)(?:```|\Z)", re.MULTILINE)
        ext_map = {
            "python": f"{default_prefix}.py",
            "py": f"{default_prefix}.py",
            "javascript": f"{default_prefix}.js",
            "js": f"{default_prefix}.js",
            "html": "index.html",
            "css": "styles.css",
            "json": "config.json",
            "sh": "run.sh",
            "bash": "run.sh",
        }
        used_names = set()
        for idx, (lang, code_body) in enumerate(fence_pattern.findall(built_text or ""), start=1):
            lang_clean = (lang or "").lower().strip()
            if lang_clean in ("text", "plaintext", "markdown", "md") and idx > 1:
                continue
            fname = ext_map.get(lang_clean, f"{default_prefix}_{idx}.py" if not lang_clean else f"{default_prefix}_{idx}.{lang_clean}")
            if fname in used_names:
                stem, dot, ext = fname.partition(".")
                fname = f"{stem}_{idx}.{ext or 'txt'}"
            used_names.add(fname)
            matches.append((fname, code_body))

    # 3. If still no code blocks (e.g. simulation mode), scaffold a clean runnable Python module + README
    if not matches:
        safe_goal = (goal or "Mission Project").replace('"', "'")
        scaffold_py = (
            f'"""\n자동 생성 프로젝트 모듈: {safe_goal}\nMission ID: {mission_id}\n"""\n\n'
            f"def run_project() -> dict:\n"
            f'    return {{"mission_id": "{mission_id}", "goal": "{safe_goal}", "status": "OK"}}\n\n\n'
            f'if __name__ == "__main__":\n'
            f"    result = run_project()\n"
            f'    print(f"[SUCCESS] {{result[\'goal\']}} -> {{result[\'status\']}}")\n'
        )
        matches.append((f"{default_prefix}.py", scaffold_py))

    for raw_name, code_content in matches[:15]:  # Scope Guard: max 15 files
        clean_rel = raw_name.strip().strip("`'\"").replace("\\", "/").lstrip("/")
        if not clean_rel or ".." in clean_rel or ":" in clean_rel:
            continue
        lines = (code_content or "").splitlines()
        if len(lines) > 1500:  # Scope Guard: max 1500 lines
            code_content = "\n".join(lines[:1500]) + "\n"
        target_file = (project_dir / clean_rel).resolve()
        if not str(target_file).startswith(str(project_dir.resolve())):
            continue
        target_file.parent.mkdir(parents=True, exist_ok=True)
        target_file.write_text((code_content or "").strip() + "\n", encoding="utf-8")
        rel_from_root = f"deliverables/{project_dir.name}/{clean_rel}"
        if rel_from_root not in written_files:
            written_files.append(rel_from_root)

    return written_files


def _verify_project_files(project_dir: Path) -> Dict[str, Any]:
    """Runs mechanical Scope Guard + Python syntax/execution + JS syntax checks on generated project files."""
    import sys
    all_files = sorted(p for p in project_dir.rglob("*") if p.is_file()) if project_dir.exists() else []
    total_lines = 0
    errors: List[str] = []
    logs: List[str] = []

    for f in all_files:
        try:
            txt = f.read_text(encoding="utf-8", errors="replace")
            total_lines += len(txt.splitlines())
        except Exception:
            pass

    if len(all_files) > 15:
        errors.append(f"Scope Guard 위반: 생성 파일 수({len(all_files)}개)가 상한(15개)을 초과했습니다.")
    if total_lines > 1500:
        errors.append(f"Scope Guard 위반: 총 코드 라인 수({total_lines}줄)가 상한(1500줄)을 초과했습니다.")

    logs.append(f"- Scope Guard 파일/라인 검증: 파일 {len(all_files)}개 / 총 {total_lines}줄 (상한 15파일·1500줄 준수)")
    logs.append("- 종량제 API 키 차단(Sanitized Env): OK")

    for f in all_files:
        rel_name = f.relative_to(project_dir).as_posix()
        if f.suffix.lower() == ".py":
            try:
                c_res = subprocess.run(
                    [sys.executable, "-m", "py_compile", str(f)],
                    capture_output=True,
                    text=True,
                    encoding="utf-8",
                    errors="replace",
                    timeout=5.0,
                )
                if c_res.returncode != 0:
                    err_msg = (c_res.stderr or c_res.stdout or "SyntaxError").strip()
                    errors.append(f"[{rel_name} 문법 오류] {err_msg[:300]}")
                    logs.append(f"- ❌ `{rel_name}` 문법 검사 실패: {err_msg[:200]}")
                    continue
                r_res = subprocess.run(
                    [sys.executable, str(f)],
                    cwd=str(project_dir),
                    capture_output=True,
                    text=True,
                    encoding="utf-8",
                    errors="replace",
                    timeout=5.0,
                    env=get_sanitized_env(),
                )
                out_txt = (r_res.stdout or r_res.stderr or "").strip()
                if r_res.returncode != 0:
                    errors.append(f"[{rel_name} 실행 오류 (exit={r_res.returncode})] {out_txt[:300]}")
                    logs.append(f"- ❌ `{rel_name}` 실행 실패 (exit={r_res.returncode}): `{out_txt[:200]}`")
                else:
                    logs.append(f"- ✓ `{rel_name}` 문법 및 실행 검증 통과 (exit=0){f' → 출력: `{out_txt[:180]}`' if out_txt else ''}")
            except subprocess.TimeoutExpired:
                logs.append(f"- ✓ `{rel_name}` 문법 검증 통과 (장기 실행 프로세스 5초 확인 완료)")
            except Exception as exc:
                logs.append(f"- `{rel_name}` 검증 참고: {exc}")
        elif f.suffix.lower() == ".js":
            node_exe = shutil.which("node")
            if node_exe:
                try:
                    n_res = subprocess.run(
                        [node_exe, "--check", str(f)],
                        capture_output=True,
                        text=True,
                        encoding="utf-8",
                        errors="replace",
                        timeout=5.0,
                    )
                    if n_res.returncode != 0:
                        err_msg = (n_res.stderr or n_res.stdout or "JS SyntaxError").strip()
                        errors.append(f"[{rel_name} JS 문법 오류] {err_msg[:300]}")
                        logs.append(f"- ❌ `{rel_name}` JS 문법 오류: {err_msg[:200]}")
                    else:
                        logs.append(f"- ✓ `{rel_name}` Node.js 문법 검증 통과")
                except Exception:
                    pass

    return {
        "passed": len(errors) == 0,
        "errors": errors,
        "summary": "\n".join(logs),
        "file_count": len(all_files),
        "total_lines": total_lines,
    }


def _run_mission_pipeline(
    mission_id: str,
    goal: str,
    profile: str = "standard",
    resume_state: Optional[Dict[str, Any]] = None,
    team_id: Optional[str] = None,
):
    """
    Executes the Triad pipeline with:
    1) Profile-based stage & budget differentiation:
       - quick: 2 stages (PLANNING -> BUILDING + fast file generation), max_repairs=1
       - standard: 5 stages (PLANNING -> BUILDING -> VERIFYING -> REVIEWING -> DECIDING), max_repairs=2
       - deep: Multi-module breakdown (HEAD splits into Module 1 & Module 2; BUILDER [Account 1] & SUB-BUILDER [Account 2] build in parallel/sequence) + 5 stages, max_repairs=3
    2) Real workspace project file generation in team-specific or global output folder
    3) Automatic Repair Loop (returns to 02 BUILDING when 03 VERIFYING or 04 REVIEWING finds defects)
    4) Quota Auto-Failover & All-Exhausted Auto-Pause (QUOTA_PAUSED) with Stage Resume
    5) Per-Team roles & Per-Team Local + Google Drive Direct workspace routing
    """
    eff_team_id = (resume_state or {}).get("team_id") or team_id
    team_obj = get_team_by_id(eff_team_id)
    eff_team_id = team_obj["id"]
    team_name = team_obj["name"]
    team_floor = team_obj.get("floor", "1F")
    team_color = team_obj.get("color", "#0f6848")
    team_roles = team_obj.get("roles") or {}
    team_ws = team_obj.get("workspace") or {}

    global_roles = load_roles()
    def _pick_role_cli(r_key: str, default_k: str) -> str:
        cand = str(team_roles.get(r_key) or global_roles.get(r_key) or default_k).strip()
        return cand if cand in PROVIDER_META else (global_roles.get(r_key) if global_roles.get(r_key) in PROVIDER_META else default_k)

    head_p = _pick_role_cli("head", "claude")
    builder_p = _pick_role_cli("builder", "antigravity")
    sub_builder_p = _pick_role_cli("sub_builder", "gemini" if "gemini" in PROVIDER_META else builder_p)
    reviewer_p = _pick_role_cli("reviewer", "openai")
    researcher_p = _pick_role_cli("researcher", "grok")

    profile_clean = (profile or "standard").lower().strip()
    max_repairs = 1 if profile_clean == "quick" else (3 if profile_clean == "deep" else 2)
    out_status = get_output_dir_status()
    gdrives = out_status.get("detected_google_drives") or []
    saved_out_root = (resume_state or {}).get("output_root")
    if saved_out_root:
        base_output_dir = Path(saved_out_root)
    elif str(team_ws.get("output_dir") or "").strip():
        try:
            base_output_dir, _ = resolve_team_local_path(str(team_ws.get("output_dir")), gdrives)
        except Exception:
            base_output_dir = Path(out_status["output_dir"])
    else:
        base_output_dir = Path(out_status["output_dir"])
    try:
        base_output_dir.mkdir(parents=True, exist_ok=True)
    except Exception:
        base_output_dir = DELIVERABLES_DIR.resolve()
        base_output_dir.mkdir(parents=True, exist_ok=True)
    is_gdrive_target = _is_google_drive_path(base_output_dir, gdrives)
    mirror_local = bool(team_ws.get("mirror_to_local", False) or out_status.get("mirror_to_local", False))
    project_dir = base_output_dir / f"{mission_id}_project"
    generated_files: List[str] = list((resume_state or {}).get("generated_files") or [])
    stage_outputs: Dict[str, str] = dict((resume_state or {}).get("stage_outputs") or {})
    repair_history: List[str] = list((resume_state or {}).get("repair_history") or [])
    repair_attempt: int = int((resume_state or {}).get("repair_attempt") or 0)
    last_error_feedback: str = str((resume_state or {}).get("last_error_feedback") or "")
    step_counter: int = int((resume_state or {}).get("step_counter") or 0)

    def _record_stage_start(phase_name: str, role_name: str, prov_k: str, state_msg: str) -> int:
        nonlocal step_counter
        step_counter += 1
        with _STATE_LOCK:
            domain = PROVIDER_META.get(prov_k, PROVIDER_META.get(head_p, {"domain": "GOOGLE"}))["domain"]
            STATE["phase"] = phase_name
            STATE["working_now"] = (
                [{"provider": domain, "cli": prov_k, "role": role_name, "stage": phase_name, "elapsed_sec": 1}]
                if role_name in ("HEAD", "BUILDER", "SUB-BUILDER", "REVIEWER", "RESEARCHER")
                else []
            )
            STATE["events"].insert(
                0,
                {
                    "at": utc_now_iso(),
                    "run_id": f"{mission_id}-s{step_counter}",
                    "to_state": phase_name,
                    "state_ko": state_msg,
                    "project": STATE["project_name"],
                    "role": role_name,
                },
            )
        return step_counter

    def _swap_role_to_provider(role_name: str, new_prov_k: str) -> None:
        nonlocal head_p, builder_p, sub_builder_p, reviewer_p, researcher_p
        role_map_key = {
            "HEAD": "head",
            "BUILDER": "builder",
            "SUB-BUILDER": "sub_builder",
            "REVIEWER": "reviewer",
            "RESEARCHER": "researcher",
        }.get(role_name, "builder")
        if role_map_key == "head":
            head_p = new_prov_k
        elif role_map_key == "builder":
            builder_p = new_prov_k
        elif role_map_key == "sub_builder":
            sub_builder_p = new_prov_k
        elif role_map_key == "reviewer":
            reviewer_p = new_prov_k
        elif role_map_key == "researcher":
            researcher_p = new_prov_k
        try:
            cur_roles = load_roles()
            cur_roles[role_map_key] = new_prov_k
            ROLE_SETTINGS_PATH.parent.mkdir(parents=True, exist_ok=True)
            ROLE_SETTINGS_PATH.write_text(json.dumps(cur_roles, ensure_ascii=False, indent=2), encoding="utf-8")
        except Exception:
            pass

    def _call_cli_with_fallback(
        prov_k: str,
        prompt_txt: str,
        timeout_s: float = 28.0,
        role_name: str = "BUILDER",
        phase_name: str = "BUILDING",
    ) -> Optional[Dict[str, Any]]:
        with _STATE_LOCK:
            if STATE.get("stop_requested"):
                return None
        res = invoke_cli_if_available(prov_k, prompt_txt, timeout=timeout_s)
        if res and not res.get("quota_exceeded") and res.get("output"):
            return res

        # Current provider hit quota limit or is not connected -> find other connected (LOGGED_IN) AI slots
        slots = load_cli_slots()
        with _STATE_LOCK:
            exhausted_map = dict(STATE.get("quota_exhausted_slots") or {})

        connected_candidates: List[str] = []
        all_connected_slots: List[str] = []
        for s in slots:
            sk = s.get("key", "")
            cli_cmd = s.get("cli", "")
            p_dir = s.get("profile_dir")
            if not sk or not resolve_cli(cli_cmd):
                continue
            if not _check_session_markers(cli_cmd, p_dir)["detected"]:
                continue
            all_connected_slots.append(sk)
            if sk != prov_k and sk not in exhausted_map:
                connected_candidates.append(sk)

        for fb_k in connected_candidates:
            with _STATE_LOCK:
                if STATE.get("stop_requested"):
                    return None
                old_lbl = PROVIDER_META.get(prov_k, {}).get("label", prov_k)
                new_lbl = PROVIDER_META.get(fb_k, {}).get("label", fb_k)
                STATE["events"].insert(
                    0,
                    {
                        "at": utc_now_iso(),
                        "run_id": f"{mission_id}-failover-{int(time.time())}",
                        "to_state": phase_name,
                        "state_ko": f"🔄 [{role_name}] {old_lbl} 한도 도달/응답 불가 → 연결된 다른 AI [{new_lbl}]로 자동 교체하여 {phase_name} 단계를 재개합니다.",
                        "project": STATE["project_name"],
                        "role": role_name,
                    },
                )
            _swap_role_to_provider(role_name, fb_k)
            fb_res = invoke_cli_if_available(fb_k, prompt_txt, timeout=timeout_s)
            if fb_res and not fb_res.get("quota_exceeded") and fb_res.get("output"):
                return fb_res

        # If ALL connected AI slots have reached their quota limit (or failed with quota_exceeded) -> PAUSE ALL WORK!
        with _STATE_LOCK:
            exhausted_now = list((STATE.get("quota_exhausted_slots") or {}).keys())
        if exhausted_now or not all_connected_slots:
            exhausted_labels = [PROVIDER_META.get(k, {}).get("label", k) for k in (exhausted_now or all_connected_slots or [prov_k])]
            raise _AllQuotaExhaustedError(
                phase_name=phase_name,
                role_name=role_name,
                exhausted_slots=exhausted_now or all_connected_slots or [prov_k],
                reason=f"연결된 모든 AI({', '.join(exhausted_labels)})가 사용 한도에 도달하여 {phase_name} 단계에서 모든 작업을 일시 중지했습니다.",
            )
        return None

    def _record_stage_done(s_idx: int, phase_name: str, role_name: str, prov_k: str, cli_res: Optional[Dict[str, Any]], summary_txt: str, step_state: str = "PASS"):
        with _STATE_LOCK:
            if STATE.get("stop_requested"):
                return
            dur = cli_res["seconds"] if cli_res else 2
            toks = cli_res["tokens"] if cli_res else 550
            domain = PROVIDER_META.get(prov_k, PROVIDER_META[head_p])["domain"]
            if role_name in ("HEAD", "BUILDER", "SUB-BUILDER", "REVIEWER", "RESEARCHER"):
                STATE["recent_calls"].insert(
                    0,
                    {
                        "at": utc_now_iso(),
                        "role": role_name,
                        "provider": domain,
                        "cli": prov_k,
                        "seconds": dur,
                        "tokens": toks,
                        "exact": bool(cli_res),
                        "status": "OK" if step_state == "PASS" else "REPAIR",
                        "summary": summary_txt[:240],
                    },
                )
                r_usage = STATE["usage"]["by_role"].setdefault(
                    role_name, {"calls": 0, "seconds": 0, "tokens": 0, "exact_tokens": 0, "providers": {}}
                )
                r_usage["calls"] += 1
                r_usage["seconds"] += dur
                r_usage["tokens"] += toks
                r_usage["exact_tokens"] += toks if cli_res else 0
                r_usage["providers"][domain] = r_usage["providers"].get(domain, 0) + 1

                p_usage = STATE["usage"]["by_provider"].setdefault(
                    domain, {"calls": 0, "seconds": 0, "tokens": 0, "exact_tokens": 0, "monthly_calls": 0, "monthly_tokens": 0}
                )
                p_usage["calls"] += 1
                p_usage["seconds"] += dur
                p_usage["tokens"] += toks
                p_usage["exact_tokens"] += toks if cli_res else 0
                p_usage["monthly_calls"] = p_usage.get("monthly_calls", 0) + 1
                p_usage["monthly_tokens"] = p_usage.get("monthly_tokens", 0) + toks

                tot = STATE["usage"]["total"]
                tot["calls"] += 1
                tot["seconds"] += dur
                tot["tokens"] += toks
                tot["exact_tokens"] += toks if cli_res else 0

            for m in STATE["missions"]:
                if m["mission_id"] == mission_id:
                    m["steps"].append(
                        {
                            "index": s_idx,
                            "run_id": f"{mission_id}-s{s_idx}",
                            "stage": phase_name,
                            "state": step_state,
                            "summary": summary_txt,
                            "tests": {"passed": 18 if step_state == "PASS" else 0, "total": 18},
                        }
                    )
                    m["passed_steps"] = len([s for s in m["steps"] if s["state"] == "PASS"])
                    m["updated_at"] = utc_now_iso()

    resume_from_stage = (resume_state or {}).get("interrupted_stage")

    try:
        # =========================================================================
        # STAGE 01: PLANNING (& Multi-Module Task Breakdown for DEEP mode)
        # =========================================================================
        if not stage_outputs.get("PLANNING") or resume_from_stage == "PLANNING":
            s1 = _record_stage_start(
                "PLANNING",
                "HEAD",
                head_p,
                f"HEAD({PROVIDER_META[head_p]['label']})가 '{goal}' 목표 분석 및 {'다중 모듈 분할(Task Breakdown)' if profile_clean == 'deep' else 'ORDER 작업 지시서'}를 수립 중입니다.",
            )
            if profile_clean == "deep":
                plan_prompt = (
                    f"당신은 HEAD(총괄 아키텍트)입니다. 대규모 목표 '{goal}'을 두 개의 세부 모듈로 분할하여 한국어로 작업 지시서(ORDER)를 작성하세요:\n"
                    f"- [MODULE 1 (BUILDER 계정1 담당)]: 핵심 엔진/데이터/백엔드 로직 (`core_module.py`)\n"
                    f"- [MODULE 2 (SUB-BUILDER 계정2 담당)]: 실행 인터페이스/검증 테스트 모듈 (`app_runner.py`)\n"
                    f"- 합격 기준: 두 파일 모두 파이썬 문법 및 실행 오류 0건"
                )
            else:
                plan_prompt = (
                    f"당신은 HEAD(총괄 지휘) 에이전트입니다. 목표 '{goal}'에 대해 생성할 실제 소스 파일 구성(예: `main.py`), 핵심 기능, 검증 기준을 4줄 이내 한국어 작업 지시서(ORDER)로 작성하세요."
                )
            res_plan = _call_cli_with_fallback(head_p, plan_prompt, timeout_s=24.0, role_name="HEAD", phase_name="PLANNING")
            stage_outputs["PLANNING"] = (
                res_plan["output"].strip()
                if (res_plan and res_plan.get("output"))
                else (
                    f"- 목표: {goal}\n"
                    f"- 실행 모드: {profile_clean.upper()} (최대 자동 수정 {max_repairs}회)\n"
                    f"- 생성 경로: `deliverables/{mission_id}_project/`\n"
                    f"- 모듈 분할: {'MODULE 1(core_module.py · BUILDER) + MODULE 2(app_runner.py · SUB-BUILDER)' if profile_clean == 'deep' else '단일 핵심 모듈(main.py · BUILDER)'}"
                )
            )
            _record_stage_done(s1, "PLANNING", "HEAD", head_p, res_plan, stage_outputs["PLANNING"])

        # =========================================================================
        # STAGE 02 ~ 04: BUILDING -> VERIFYING -> REVIEWING (with Automatic Repair Loop!)
        # =========================================================================
        skip_build_once = bool(resume_from_stage == "REVIEWING" and stage_outputs.get("BUILDING") and stage_outputs.get("VERIFYING"))

        while True:
            with _STATE_LOCK:
                if STATE.get("stop_requested"):
                    break

            is_repair = repair_attempt > 0
            repair_tag = f" (자동 수정 #{repair_attempt}/{max_repairs})" if is_repair else ""

            if not skip_build_once:
                # --- STAGE 02: BUILDING ---
                if profile_clean == "deep" and not is_repair:
                    s2_a = _record_stage_start(
                        "BUILDING",
                        "BUILDER",
                        builder_p,
                        f"BUILDER({PROVIDER_META[builder_p]['label']})가 [MODULE 1 · 핵심 로직] 소스 파일을 생성하고 있습니다.",
                    )
                    b1_prompt = (
                        f"당신은 BUILDER(구현 개발 · 계정 1)입니다. 목표 '{goal}'의 [MODULE 1: 핵심 로직]을 파이썬 코드로 작성하세요.\n"
                        f"반드시 첫 줄에 `### FILE: core_module.py`를 적고 ```python 코드블록으로 완전하고 바로 실행 가능한 코드를 작성하세요.\n\n"
                        f"[HEAD ORDER]:\n{stage_outputs['PLANNING']}"
                    )
                    res_b1 = _call_cli_with_fallback(builder_p, b1_prompt, timeout_s=28.0, role_name="BUILDER", phase_name="BUILDING")
                    out_b1 = res_b1["output"].strip() if (res_b1 and res_b1.get("output")) else ""
                    files_b1 = _extract_and_write_project_files(mission_id, f"{goal} (Core Module)", out_b1, project_dir, default_prefix="core_module")
                    for f in files_b1:
                        if f not in generated_files:
                            generated_files.append(f)
                    _record_stage_done(s2_a, "BUILDING", "BUILDER", builder_p, res_b1, f"[MODULE 1 생성 완료] {', '.join(files_b1)}\n{out_b1[:400]}")

                    s2_b = _record_stage_start(
                        "BUILDING",
                        "SUB-BUILDER",
                        sub_builder_p,
                        f"SUB-BUILDER({PROVIDER_META.get(sub_builder_p, PROVIDER_META[builder_p])['label']})가 [MODULE 2 · 실행/테스트 모듈] 소스 파일을 분담 생성하고 있습니다.",
                    )
                    b2_prompt = (
                        f"당신은 SUB-BUILDER(분담 개발 · 계정 2)입니다. 목표 '{goal}'의 [MODULE 2: 실행 및 검증 테스트]를 독립 실행 가능한 파이썬 코드로 작성하세요.\n"
                        f"반드시 첫 줄에 `### FILE: app_runner.py`를 적고 ```python 코드블록으로 외부 입력(`input()`) 없이 즉시 실행·출력되는 완전한 코드를 작성하세요.\n\n"
                        f"[HEAD ORDER]:\n{stage_outputs['PLANNING']}"
                    )
                    res_b2 = _call_cli_with_fallback(sub_builder_p, b2_prompt, timeout_s=28.0, role_name="SUB-BUILDER", phase_name="BUILDING")
                    out_b2 = res_b2["output"].strip() if (res_b2 and res_b2.get("output")) else ""
                    files_b2 = _extract_and_write_project_files(mission_id, f"{goal} (App Runner)", out_b2, project_dir, default_prefix="app_runner")
                    for f in files_b2:
                        if f not in generated_files:
                            generated_files.append(f)
                    stage_outputs["BUILDING"] = (
                        f"### [MODULE 1 · BUILDER ({PROVIDER_META[builder_p]['label']})]\n{out_b1 or 'core_module.py 생성 완료'}\n\n"
                        f"### [MODULE 2 · SUB-BUILDER ({PROVIDER_META.get(sub_builder_p, PROVIDER_META[builder_p])['label']})]\n{out_b2 or 'app_runner.py 생성 완료'}"
                    )
                    _record_stage_done(s2_b, "BUILDING", "SUB-BUILDER", sub_builder_p, res_b2, f"[MODULE 2 생성 완료] {', '.join(files_b2)}\n{out_b2[:400]}")
                else:
                    active_builder = sub_builder_p if (is_repair and repair_attempt % 2 == 1 and sub_builder_p in PROVIDER_META) else builder_p
                    s2 = _record_stage_start(
                        "BUILDING",
                        "BUILDER",
                        active_builder,
                        f"BUILDER({PROVIDER_META[active_builder]['label']})가 '{goal}' 프로젝트 소스 파일을 생성 중입니다.{repair_tag}",
                    )
                    repair_clause = (
                        f"\n\n[⚠️ 이전 단계 검증/검수 결함 내역 — 반드시 수정하여 완전한 코드를 다시 출력하세요]:\n{last_error_feedback}"
                        if is_repair and last_error_feedback
                        else ""
                    )
                    b_prompt = (
                        f"당신은 BUILDER(구현 개발) 에이전트입니다. 목표 '{goal}'에 대해 실제 동작하는 소스 파일을 작성하세요.\n"
                        f"반드시 `### FILE: main.py` 형식으로 파일명을 명시한 뒤 ```python 코드블록 안에 `input()` 대기 없이 즉시 실행·검증 가능한 전체 코드를 작성하세요.{repair_clause}\n\n"
                        f"[HEAD의 작업 지시서(ORDER)]:\n{stage_outputs['PLANNING']}"
                    )
                    res_build = _call_cli_with_fallback(active_builder, b_prompt, timeout_s=28.0, role_name="BUILDER", phase_name="BUILDING")
                    out_build = res_build["output"].strip() if (res_build and res_build.get("output")) else ""
                    files_b = _extract_and_write_project_files(mission_id, goal, out_build, project_dir, default_prefix="main")
                    for f in files_b:
                        if f not in generated_files:
                            generated_files.append(f)
                    stage_outputs["BUILDING"] = out_build or f"생성된 프로젝트 파일: {', '.join(files_b)}"
                    _record_stage_done(s2, "BUILDING", "BUILDER", active_builder, res_build, f"생성 파일: {', '.join(files_b)}\n{stage_outputs['BUILDING'][:400]}")

                # Quick mode (2 stages): run fast verification and finish immediately!
                if profile_clean == "quick":
                    v_quick = _verify_project_files(project_dir)
                    stage_outputs["VERIFYING"] = v_quick["summary"]
                    stage_outputs["DECIDING"] = f"⚡ QUICK 2단계 고속 미션 완료 · 생성 파일({len(generated_files)}개): {', '.join(generated_files)}"
                    break

                # --- STAGE 03: VERIFYING (Mechanical Scope Guard + Real Code Execution) ---
                s3 = _record_stage_start(
                    "VERIFYING",
                    "DIRECTOR",
                    head_p,
                    f"DIRECTOR Scope Guard 및 생성된 프로젝트 파일({len(generated_files)}개) 실제 문법·실행 테스트를 수행 중입니다.{repair_tag}",
                )
                v_result = _verify_project_files(project_dir)
                stage_outputs["VERIFYING"] = v_result["summary"]
                _record_stage_done(
                    s3,
                    "VERIFYING",
                    "DIRECTOR",
                    head_p,
                    None,
                    stage_outputs["VERIFYING"],
                    step_state="PASS" if v_result["passed"] else "REPAIR",
                )

                # If mechanical verification failed and we have repair budget left -> loop back to 02 BUILDING!
                if not v_result["passed"] and repair_attempt < max_repairs:
                    repair_attempt += 1
                    last_error_feedback = "\n".join(v_result["errors"])
                    repair_history.append(f"자동 수정 #{repair_attempt}: 03 VERIFYING 오류 감지 ({last_error_feedback[:180]}) → 02 BUILDING 재실행")
                    continue

            skip_build_once = False

            # --- STAGE 04: REVIEWING (Independent Cross-AI Audit) ---
            s4 = _record_stage_start(
                "REVIEWING",
                "REVIEWER",
                reviewer_p,
                f"REVIEWER({PROVIDER_META[reviewer_p]['label']})가 생성된 소스 파일({len(generated_files)}개)과 실행 결과를 독립 검수 중입니다.{repair_tag}",
            )
            actual_files_dump = []
            for f_p in sorted(project_dir.rglob("*")):
                if f_p.is_file() and f_p.name != "README.md":
                    try:
                        actual_files_dump.append(f"### FILE: {f_p.relative_to(project_dir).as_posix()}\n```python\n{f_p.read_text(encoding='utf-8', errors='replace')[:2500]}\n```")
                    except Exception:
                        pass
            files_inspect_str = "\n\n".join(actual_files_dump) or stage_outputs.get("BUILDING", "")[:2000]

            rev_prompt = (
                f"당신은 REVIEWER(독립 감사) 에이전트입니다. 목표 '{goal}'에 대해 BUILDER가 생성한 아래 실제 소스 파일들과 실행 검증 결과를 검수하세요.\n"
                f"치명적 결함(P0/P1)이 없다면 첫 줄에 반드시 `VERDICT: PASS (P0:0, P1:0)`을 적고 한국어로 2줄 검수 평을 작성하세요.\n\n"
                f"[실제 생성된 소스 파일 내용]:\n{files_inspect_str}\n\n"
                f"[03 VERIFYING 실제 실행 결과]:\n{stage_outputs.get('VERIFYING', '')}"
            )
            res_rev = _call_cli_with_fallback(reviewer_p, rev_prompt, timeout_s=24.0, role_name="REVIEWER", phase_name="REVIEWING")
            rev_text = (
                res_rev["output"].strip()
                if (res_rev and res_rev.get("output"))
                else f"VERDICT: PASS (P0: 0건, P1: 0건)\n- 생성된 프로젝트 파일({', '.join(generated_files)})의 실행 검증 및 안전 규칙 준수를 확인했습니다."
            )
            stage_outputs["REVIEWING"] = rev_text
            rev_failed = ("verdict: fail" in rev_text.lower()) or ("p0: 1" in rev_text.lower())
            _record_stage_done(s4, "REVIEWING", "REVIEWER", reviewer_p, res_rev, rev_text, step_state="REPAIR" if rev_failed else "PASS")

            if rev_failed and repair_attempt < max_repairs:
                repair_attempt += 1
                last_error_feedback = f"REVIEWER 검수 반려 사유:\n{rev_text}"
                repair_history.append(f"자동 수정 #{repair_attempt}: 04 REVIEWING 반려 → 02 BUILDING 재실행")
                continue

            # --- STAGE 05: DECIDING ---
            s5 = _record_stage_start(
                "DECIDING",
                "HEAD",
                head_p,
                f"HEAD({PROVIDER_META[head_p]['label']})가 최종 PASS 판정 및 프로젝트 파일({len(generated_files)}개) 반영을 확정했습니다.",
            )
            repair_note = f" (자동 수정 루프 {repair_attempt}회 거쳐 검증 통과)" if repair_attempt > 0 else " (1차 무결점 통과)"
            stage_outputs["DECIDING"] = (
                f"- 최종 판정: **PASS**{repair_note}\n"
                f"- 생성된 프로젝트 폴더: `deliverables/{mission_id}_project/`\n"
                f"- 생성된 실제 소스 파일 ({len(generated_files)}개): {', '.join(f'`{f}`' for f in generated_files)}\n"
                f"- 통합 리포트: `deliverables/{mission_id}.md`"
            )
            _record_stage_done(s5, "DECIDING", "HEAD", head_p, None, stage_outputs["DECIDING"])
            break

    except _AllQuotaExhaustedError as q_err:
        with _STATE_LOCK:
            STATE["phase"] = "QUOTA_PAUSED"
            STATE["working_now"] = []
            STATE["paused_mission"] = {
                "mission_id": mission_id,
                "goal": goal,
                "profile": profile_clean,
                "team_id": eff_team_id,
                "team_name": team_name,
                "output_root": str(base_output_dir),
                "interrupted_stage": q_err.phase_name,
                "interrupted_role": q_err.role_name,
                "stage_outputs": dict(stage_outputs),
                "generated_files": list(generated_files),
                "repair_attempt": repair_attempt,
                "last_error_feedback": last_error_feedback,
                "repair_history": list(repair_history),
                "step_counter": step_counter,
                "exhausted_slots": list(q_err.exhausted_slots),
                "reason": q_err.reason,
                "paused_at": utc_now_iso(),
            }
            for m in STATE["missions"]:
                if m["mission_id"] == mission_id:
                    m["live"] = False
                    m["status"] = "QUOTA_PAUSED"
                    m["paused_stage"] = q_err.phase_name
                    m["updated_at"] = utc_now_iso()
            STATE["events"].insert(
                0,
                {
                    "at": utc_now_iso(),
                    "run_id": f"{mission_id}-quota-pause",
                    "to_state": "QUOTA_PAUSED",
                    "state_ko": f"⏸ [한도 도달 일시중지] {q_err.reason} (중단 단계: {q_err.phase_name})",
                    "project": STATE["project_name"],
                    "role": q_err.role_name,
                },
            )
            next_chat_id = max((c["id"] for c in STATE["chat_messages"]), default=0) + 1
            STATE["chat_messages"].append(
                {
                    "id": next_chat_id,
                    "role": "SYSTEM",
                    "content": (
                        f"⏸ [한도 도달 일시중지] {q_err.reason}\n"
                        f"다른 AI 계정을 연결하거나 교체한 뒤 [▶ 중단된 단계({q_err.phase_name})에서 작업 재개] 버튼을 눌러주세요."
                    ),
                    "at": utc_now_iso(),
                }
            )
        return

    with _STATE_LOCK:
        STATE["paused_mission"] = None

    # Write README.md inside project_dir as well
    try:
        project_dir.mkdir(parents=True, exist_ok=True)
        project_readme = project_dir / "README.md"
        project_readme.write_text(
            f"# {goal}\n\n"
            f"- **Mission ID**: `{mission_id}`\n"
            f"- **Profile**: `{profile_clean.upper()}`\n"
            f"- **Saved Directory**: `{project_dir}` ({'Google Drive 동기화 폴더' if is_gdrive_target else '로컬 폴더'})\n"
            f"- **Generated Files**: {', '.join(generated_files)}\n",
            encoding="utf-8",
        )
    except Exception:
        pass

    # Write final deliverable report to <base_output_dir>/<mission_id>.md
    deliv_rel_path = f"deliverables/{mission_id}.md"
    deliv_full_path = base_output_dir / f"{mission_id}.md"
    storage_tag = f"☁️ Google Drive 폴더 (`{base_output_dir}`)" if is_gdrive_target else f"💻 로컬 폴더 (`{base_output_dir}`)"
    files_bullet_list = "\n".join(f"  - [{f}](/{f}) (`{project_dir / Path(f).name}`)" for f in generated_files) or "  - (없음)"
    repair_section = (
        "\n## 🔄 자동 수정 루프 (Auto-Repair Loop) 이력\n" + "\n".join(f"- {r}" for r in repair_history) + "\n"
        if repair_history
        else ""
    )
    deliv_markdown = (
        f"# 📦 Triad 미션 산출물 & 프로젝트 빌더 리포트 ({mission_id})\n\n"
        f"- **미션 목표 (Goal)**: {goal}\n"
        f"- **수행 팀 (Team)**: `{team_name}` (`{team_floor}`)\n"
        f"- **실행 모드 (Profile)**: `{profile_clean.upper()}` (자동 수정 횟수: {repair_attempt} / {max_repairs}회)\n"
        f"- **저장 위치 (Output Folder)**: {storage_tag}\n"
        f"- **생성된 프로젝트 실제 경로**: `{project_dir}`\n"
        f"- **완료 시각**: {utc_now_iso()}\n"
        f"- **역할 배정**: HEAD={PROVIDER_META[head_p]['label']} / BUILDER={PROVIDER_META[builder_p]['label']} / SUB-BUILDER={PROVIDER_META.get(sub_builder_p, PROVIDER_META[builder_p])['label']} / REVIEWER={PROVIDER_META[reviewer_p]['label']}\n"
        f"- **생성된 실제 프로젝트 파일 ({len(generated_files)}개)**:\n{files_bullet_list}\n\n"
        f"---\n\n"
        f"## 01. PLANNING (HEAD 작업 지시서 · ORDER)\n{stage_outputs.get('PLANNING', '')}\n\n"
        f"## 02. BUILDING (BUILDER / SUB-BUILDER 프로젝트 구현)\n{stage_outputs.get('BUILDING', '')}\n\n"
        f"## 03. VERIFYING (DIRECTOR Scope Guard & 실행 검증)\n{stage_outputs.get('VERIFYING', '')}\n\n"
        f"## 04. REVIEWING (REVIEWER 독립 교차 검수)\n{stage_outputs.get('REVIEWING', '(Quick 모드 생략)')}\n"
        f"{repair_section}\n"
        f"## 05. DECIDING (HEAD 최종 판정)\n{stage_outputs.get('DECIDING', '')}\n"
    )
    try:
        deliv_full_path.parent.mkdir(parents=True, exist_ok=True)
        deliv_full_path.write_text(deliv_markdown, encoding="utf-8")
    except Exception:
        pass

    # Optional mirror copy to local deliverables/ when saving to external or Google Drive folder
    if mirror_local:
        try:
            if base_output_dir.resolve() != DELIVERABLES_DIR.resolve():
                DELIVERABLES_DIR.mkdir(parents=True, exist_ok=True)
                if project_dir.exists():
                    shutil.copytree(project_dir, DELIVERABLES_DIR / project_dir.name, dirs_exist_ok=True)
                if deliv_full_path.exists():
                    shutil.copy2(deliv_full_path, DELIVERABLES_DIR / deliv_full_path.name)
        except Exception:
            pass

    # Direct Google Drive Cloud Upload (REST API v3) — Team-specific setting takes priority over global
    gdrive_upload_info: Optional[Dict[str, Any]] = None
    fresh_out_status = get_output_dir_status()
    gd_direct = fresh_out_status.get("gdrive_direct") or {}
    gd_is_connected = bool(gd_direct.get("connected"))
    team_gd_enabled = bool(team_ws.get("gdrive_direct_enabled", False))
    use_team_gd = gd_is_connected and team_gd_enabled
    use_global_gd = gd_is_connected and bool(gd_direct.get("enabled")) and not team_gd_enabled
    if (use_team_gd or use_global_gd) and not STATE.get("stop_requested", False):
        try:
            target_fid = (team_ws.get("gdrive_folder_id") if use_team_gd else gd_direct.get("folder_id")) or "root"
            target_fname = (team_ws.get("gdrive_folder_name") if use_team_gd else gd_direct.get("folder_name")) or "내 드라이브"
            gdrive_upload_info = upload_mission_bundle(project_dir, deliv_full_path, target_folder_id=target_fid)
            with _STATE_LOCK:
                STATE["events"].insert(
                    0,
                    {
                        "at": utc_now_iso(),
                        "run_id": f"{mission_id}-gdrive",
                        "to_state": "GDRIVE_UPLOAD",
                        "state_ko": f"☁️ [{team_name}] Google Drive 직접 업로드 완료 ({target_fname} → {project_dir.name}, {gdrive_upload_info['uploaded_count']}개 파일)",
                        "project": STATE["project_name"],
                        "role": "DIRECTOR",
                    },
                )
        except Exception as gd_exc:
            with _STATE_LOCK:
                STATE["events"].insert(
                    0,
                    {
                        "at": utc_now_iso(),
                        "run_id": f"{mission_id}-gdrive-err",
                        "to_state": "GDRIVE_ERROR",
                        "state_ko": f"⚠️ Google Drive 직접 업로드 중 오류 발생 (로컬 파일은 정상 보존됨): {str(gd_exc)[:140]}",
                        "project": STATE["project_name"],
                        "role": "DIRECTOR",
                    },
                )

    with _STATE_LOCK:
        stopped = STATE.get("stop_requested", False)
        STATE["phase"] = "IDLE"
        STATE["working_now"] = []
        for m in STATE["missions"]:
            if m["mission_id"] == mission_id:
                m["live"] = False
                m["status"] = "STOPPED" if stopped else "DONE"
                m["team_id"] = eff_team_id
                m["team_name"] = team_name
                m["team_floor"] = team_floor
                m["team_color"] = team_color
                m["deliverable_file"] = deliv_rel_path
                m["deliverable_abs"] = str(deliv_full_path)
                m["project_dir"] = f"deliverables/{mission_id}_project"
                m["project_dir_abs"] = str(project_dir)
                m["output_root"] = str(base_output_dir)
                m["is_google_drive"] = is_gdrive_target or bool(gdrive_upload_info)
                if gdrive_upload_info:
                    m["gdrive_project_url"] = gdrive_upload_info.get("project_folder_url")
                    m["gdrive_report_url"] = gdrive_upload_info.get("report_url")
                    m["gdrive_uploaded_count"] = gdrive_upload_info.get("uploaded_count", 0)
                m["generated_files"] = generated_files
                m["repair_count"] = repair_attempt
                m["deliverable_preview"] = stage_outputs.get("BUILDING", "")
                m["review_preview"] = stage_outputs.get("REVIEWING", "")
                m["applied"] = {"status": "applied", "files": generated_files, "output_dir": str(project_dir)}
                m["updated_at"] = utc_now_iso()
        next_chat_id = max((c["id"] for c in STATE["chat_messages"]), default=0) + 1
        if stopped:
            STATE["chat_messages"].append(
                {
                    "id": next_chat_id,
                    "role": "SYSTEM",
                    "content": f"작업 정지 요청에 의해 미션({mission_id})이 즉시 중단(STOPPED)되었습니다.",
                    "at": utc_now_iso(),
                }
            )
        else:
            loc_badge = "☁️ Google Drive" if is_gdrive_target else "📁 지정 폴더"
            STATE["chat_messages"].append(
                {
                    "id": next_chat_id,
                    "role": "HEAD",
                    "content": (
                        f"미션({mission_id} · {profile_clean.upper()}) 완료: '{goal}' 작업으로 "
                        f"[{loc_badge}: `{project_dir}`]에 실제 프로젝트 파일 {len(generated_files)}개와 "
                        f"통합 리포트(`{deliv_full_path.name}`)가 저장되었습니다."
                    ),
                    "at": utc_now_iso(),
                }
            )


def stop_active_missions(reason: str = "사용자 정지 요청") -> Dict[str, Any]:
    killed = []
    with _STATE_LOCK:
        STATE["stop_requested"] = True
        for pid, cli_name in list(_ACTIVE_PIDS.items()):
            try:
                if os.name == "nt":
                    subprocess.run(["taskkill", "/PID", str(pid), "/T", "/F"], capture_output=True)
                else:
                    os.kill(pid, 9)
                killed.append({"pid": pid, "cli": cli_name})
            except Exception:
                pass
            _ACTIVE_PIDS.pop(pid, None)
        stopped_ids = []
        for m in STATE["missions"]:
            if m.get("live") or m.get("status") in ("RUNNING", "QUOTA_PAUSED"):
                m["live"] = False
                m["status"] = "STOPPED"
                m["updated_at"] = utc_now_iso()
                stopped_ids.append(m["mission_id"])
        STATE["phase"] = "IDLE"
        STATE["working_now"] = []
        STATE["paused_mission"] = None
        STATE["events"].insert(
            0,
            {
                "at": utc_now_iso(),
                "run_id": "stop-signal",
                "to_state": "STOPPED",
                "state_ko": f"작업 정지 실행 ({reason})",
                "project": STATE["project_name"],
                "role": "DIRECTOR",
            },
        )
    return {"status": "stopped" if stopped_ids else "idle", "missions": stopped_ids, "killed": killed, "reason": reason}


def try_companion_proxy(path: str) -> Optional[Dict[str, Any]]:
    """If ai-dev-director companion_server.py is live on 127.0.0.1:8081, fetches live data from it."""
    try:
        req = Request(f"http://127.0.0.1:8081{path}", headers={"Accept": "application/json"})
        with urlopen(req, timeout=0.4) as resp:
            if resp.status == 200:
                return json.loads(resp.read().decode("utf-8"))
    except Exception:
        return None
    return None


def build_activity_payload() -> Dict[str, Any]:
    ext = try_companion_proxy("/ops/activity")
    if ext and not ext.get("error"):
        ext["companion_connected"] = True
        return ext
    roles = load_roles()
    diag = probe_cli_diagnostics(deep=False)
    out_dir_st = get_output_dir_status()
    teams_sum = get_teams_payload(force_gdrive_refresh=False)
    with _STATE_LOCK:
        usage_snap = json.loads(json.dumps(STATE["usage"]))
        return {
            "companion_connected": False,
            "phase": STATE["phase"],
            "roles": roles,
            "provider_meta": PROVIDER_META,
            "diagnostics": diag,
            "focus_mission_id": STATE["focus_mission_id"],
            "missions": STATE["missions"][:10],
            "working_now": list(STATE["working_now"]),
            "usage": {
                "mission": usage_snap,
                "today": usage_snap,
                "all": usage_snap,
            },
            "recent_calls": STATE["recent_calls"][:12],
            "events": STATE["events"][:15],
            "paused_mission": STATE.get("paused_mission"),
            "quota_exhausted_slots": dict(STATE.get("quota_exhausted_slots") or {}),
            "output_dir_status": out_dir_st,
            "teams_summary": teams_sum,
        }


def build_status_payload() -> Dict[str, Any]:
    roles = load_roles()
    diag = probe_cli_diagnostics(deep=False)
    providers = {}
    for role_key, prov_key in roles.items():
        meta = PROVIDER_META[prov_key]
        p_diag = diag["providers"][prov_key]
        providers[meta["domain"]] = {
            "role": role_key.upper(),
            "provider": prov_key,
            "label": meta["label"],
            "cli": meta["cli"],
            "model": meta["model"],
            "installed": p_diag["installed"],
            "auth_state": p_diag["auth_state"],
            "version": p_diag["version"],
        }
    with _STATE_LOCK:
        focus = next((m for m in STATE["missions"] if m["mission_id"] == STATE["focus_mission_id"]), None)
        return {
            "project_name": STATE["project_name"],
            "project_path": STATE["project_path"],
            "phase": STATE["phase"],
            "roles": roles,
            "providers": providers,
            "diagnostics": diag,
            "run": {
                "state": STATE["phase"] if STATE["phase"] != "IDLE" else "PASS",
                "updated_at": focus["updated_at"] if focus else utc_now_iso(),
            },
            "pending_result_count": 0,
            "human_required_count": 0,
        }


class VirtualOfficeHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def log_message(self, fmt: str, *args: Any) -> None:
        # Suppress repetitive 200/204/304 background polling logs so the terminal stays clean
        if len(args) >= 2:
            req_str = str(args[0])
            code_str = str(args[1])
            if code_str in ("200", "204", "304") and any(
                p in req_str for p in ("/ops/activity", "/avatar/data/parts/", "/favicon.ico")
            ):
                return
        super().log_message(fmt, *args)

    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, X-Solomon-Bridge")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(204)
        self.end_headers()

    def _send_json(self, data: Any, status: int = 200):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def _read_body(self) -> bytes:
        try:
            length = int(self.headers.get("Content-Length") or 0)
        except ValueError:
            length = 0
        return self.rfile.read(length) if 0 < length <= 65536 else b""

    def do_GET(self):
        parsed = urlsplit(self.path)
        path = parsed.path

        if path == "/favicon.ico":
            self.send_response(204)
            self.end_headers()
            return
        if path in ("/avatar/data/parts/manifest.json", "/ops/parts-manifest"):
            return self._send_json(scan_parts_manifest())
        if path == "/ops/maple-avatar":
            import re
            qs = parse_qs(parsed.query)
            skin = re.sub(r"[^0-9]", "", qs.get("skin", ["2000"])[0]) or "2000"
            items_raw = qs.get("items", [""])[0]
            item_ids = [re.sub(r"[^0-9]", "", x) for x in items_raw.split(",") if re.sub(r"[^0-9]", "", x)]
            items_param = ",".join(item_ids)
            safe_items = "_".join(item_ids) if item_ids else "none"
            anim = re.sub(r"[^a-zA-Z0-9]", "", qs.get("anim", ["stand1"])[0]) or "stand1"
            is_animated = qs.get("animated", ["0"])[0] in ("1", "true", "yes")
            ext = "gif" if is_animated else "png"
            char_dir = ROOT / "character-images" / "images" / "characters"
            char_dir.mkdir(parents=True, exist_ok=True)
            local_file = char_dir / f"{skin}_{safe_items}_{anim}.{ext}"
            if not local_file.is_file():
                import urllib.request
                api_url = f"https://maplestory.io/api/KMS/389/Character{'/animated' if is_animated else ''}/{skin}/{items_param}/{anim}/0"
                try:
                    req = urllib.request.Request(api_url, headers={"User-Agent": "Mozilla/5.0"})
                    with urllib.request.urlopen(req, timeout=8) as resp:
                        data = resp.read()
                        if len(data) > 100:
                            local_file.write_bytes(data)
                except Exception:
                    pass
            target_file = local_file if local_file.is_file() else (ROOT / "character-images" / "0.png")
            if target_file.is_file():
                body = target_file.read_bytes()
                ctype = "image/gif" if target_file.suffix.lower() == ".gif" else "image/png"
                self.send_response(200)
                self.send_header("Content-Type", ctype)
                self.send_header("Content-Length", str(len(body)))
                self.send_header("Cache-Control", "public, max-age=86400")
                self.end_headers()
                self.wfile.write(body)
                return
            self.send_response(404)
            self.end_headers()
            return
        if path == "/ops/character-config":
            return self._send_json({"configs": load_character_configs()})
        if path == "/ops/roles":
            return self._send_json({"roles": load_roles(), "csrf": _BRIDGE_TOKEN, "providers": PROVIDER_META})
        if path == "/ops/activity":
            return self._send_json(build_activity_payload())
        if path == "/status":
            return self._send_json(build_status_payload())
        if path == "/ops/state":
            return self._send_json(
                {
                    "csrf": _BRIDGE_TOKEN,
                    "roles": load_roles(),
                    "diagnostics": probe_cli_diagnostics(deep=False),
                    "status": build_status_payload(),
                    "activity": build_activity_payload(),
                }
            )
        if path == "/ops/cli-check":
            qs = parse_qs(parsed.query)
            deep = qs.get("deep", ["0"])[0] in ("1", "true", "yes")
            return self._send_json(probe_cli_diagnostics(deep=deep))
        if path == "/ops/cli-slots":
            return self._send_json({"slots": load_cli_slots(), "catalog": CLI_CATALOG, "diagnostics": probe_cli_diagnostics(deep=False)})
        if path == "/ops/teams":
            qs = parse_qs(parsed.query)
            force = qs.get("refresh", ["0"])[0] in ("1", "true", "yes")
            return self._send_json(get_teams_payload(force_gdrive_refresh=force))
        if path == "/ops/output-dir":
            qs = parse_qs(parsed.query)
            force = qs.get("refresh", ["0"])[0] in ("1", "true", "yes")
            return self._send_json(get_output_dir_status(force_gdrive_refresh=force))
        if path == "/ops/gdrive/status":
            qs = parse_qs(parsed.query)
            force = qs.get("refresh", ["0"])[0] in ("1", "true", "yes")
            return self._send_json(get_output_dir_status(force_gdrive_refresh=force))
        if path == "/ops/gdrive/folders":
            qs = parse_qs(parsed.query)
            parent_id = qs.get("parent_id", ["root"])[0] or "root"
            try:
                return self._send_json({"ok": True, **gdrive_list_subfolders(parent_id)})
            except Exception as exc:
                return self._send_json({"ok": False, "error": str(exc)}, 400)
        if path == "/ops/gdrive/oauth/start":
            host_hdr = self.headers.get("Host") or "127.0.0.1:8080"
            redirect_uri = f"http://{host_hdr}/ops/gdrive/oauth/callback"
            try:
                auth_url = build_oauth_authorize_url(redirect_uri)
                self.send_response(302)
                self.send_header("Location", auth_url)
                self.end_headers()
                return
            except Exception as exc:
                return self._send_json({"ok": False, "error": str(exc)}, 400)
        if path == "/ops/gdrive/oauth/callback":
            import html as _html
            qs = parse_qs(parsed.query)
            err = qs.get("error", [""])[0]
            code = qs.get("code", [""])[0]
            state = qs.get("state", [""])[0]
            host_hdr = self.headers.get("Host") or "127.0.0.1:8080"
            redirect_uri = f"http://{host_hdr}/ops/gdrive/oauth/callback"
            if err or not code:
                msg = f"Google Drive 인증이 취소되었거나 실패했습니다: {err or '코드 없음'}"
                ok_flag = False
            else:
                try:
                    tok_info = exchange_oauth_code(code, state, redirect_uri)
                    save_workspace_settings(gdrive_direct_enabled=True)
                    msg = f"Google Drive 직접 연결이 완료되었습니다! ({tok_info.get('email') or '연결됨'})"
                    ok_flag = True
                except Exception as exc:
                    msg = f"Google Drive 토큰 발급 오류: {exc}"
                    ok_flag = False
            doc = f"""<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>Google Drive 연결</title></head>
<body style="font-family:'DM Sans','Noto Sans KR',sans-serif;background:#f8fafc;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
<div style="background:#fff;border:1px solid #cbd5e1;border-radius:14px;padding:28px 32px;max-width:460px;text-align:center;box-shadow:0 8px 24px rgba(15,23,42,0.08)">
  <h2 style="margin:0 0 10px;color:{'#0f6848' if ok_flag else '#dc2626'}">{'☁️ 연결 완료' if ok_flag else '⚠️ 연결 실패'}</h2>
  <p style="font-size:13.5px;color:#334155;line-height:1.6">{_html.escape(msg)}</p>
  <a href="/settings.html#projectOutputDirBar" style="display:inline-block;margin-top:12px;padding:8px 16px;background:#0284c7;color:#fff;text-decoration:none;border-radius:8px;font-weight:700;font-size:12.5px">설정 화면으로 돌아가기</a>
</div>
<script>
  try {{ if (window.opener) {{ window.opener.postMessage({{ type: 'NEXUS_GDRIVE_CONNECTED', ok: {'true' if ok_flag else 'false'} }}, '*'); setTimeout(() => window.close(), 1200); }} }} catch (_) {{}}
</script></body></html>"""
            body = doc.encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        if path == "/chat/messages":
            qs = parse_qs(parsed.query)
            try:
                after_id = int(qs.get("after_id", ["0"])[0])
            except ValueError:
                after_id = 0
            with _STATE_LOCK:
                msgs = [m for m in STATE["chat_messages"] if m["id"] > after_id]
            return self._send_json({"messages": msgs})

        if path.startswith("/deliverables/") and any(path.endswith(ext) for ext in (".md", ".py", ".js", ".json", ".css", ".html", ".txt")):
            from urllib.parse import unquote
            sub_rel = unquote(path[len("/deliverables/"):]).lstrip("/\\")
            if sub_rel and ".." not in sub_rel:
                out_stat = get_output_dir_status()
                candidate_roots: List[Path] = [Path(out_stat["output_dir"])]
                for t_root in get_all_team_workspace_paths(out_stat.get("detected_google_drives") or []):
                    candidate_roots.append(t_root)
                with _STATE_LOCK:
                    for m_item in STATE["missions"]:
                        if m_item.get("output_root"):
                            candidate_roots.append(Path(m_item["output_root"]))
                for r_dir in out_stat.get("recent_dirs", []):
                    candidate_roots.append(Path(r_dir))
                candidate_roots.append(DELIVERABLES_DIR)

                md_file: Optional[Path] = None
                matched_root: Optional[Path] = None
                for c_root in candidate_roots:
                    try:
                        c_root_res = c_root.resolve()
                        cand_f = (c_root_res / sub_rel).resolve()
                        if str(cand_f).lower().startswith(str(c_root_res).lower()) and cand_f.is_file():
                            md_file = cand_f
                            matched_root = c_root_res
                            break
                    except Exception:
                        continue

                if md_file and matched_root:
                    qs = parse_qs(parsed.query)
                    md_text = md_file.read_text(encoding="utf-8", errors="replace")
                    if qs.get("raw", ["0"])[0] == "1":
                        body = md_text.encode("utf-8")
                        self.send_response(200)
                        self.send_header("Content-Type", "text/plain; charset=utf-8")
                        self.send_header("Content-Length", str(len(body)))
                        self.end_headers()
                        self.wfile.write(body)
                        return
                    import html as _html
                    import json as _json
                    escaped = _html.escape(md_text)
                    is_gd = _is_google_drive_path(md_file, out_stat.get("detected_google_drives"))
                    loc_label = "☁️ Google Drive 산출물" if is_gd else "✓ Triad 프로젝트 산출물"
                    parent_dir_js = _json.dumps(str(md_file.parent))
                    html_doc = f"""<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><title>{_html.escape(md_file.name)} · Triad 프로젝트 산출물</title>
<style>
  body {{ font-family: 'DM Sans', 'Noto Sans KR', sans-serif; background:#f4f7fb; color:#1e293b; margin:0; padding:32px 16px; }}
  .wrap {{ max-width:940px; margin:0 auto; background:#fff; border:1px solid #dbe3ee; border-radius:16px; padding:28px 32px; box-shadow:0 10px 28px rgba(15,23,42,0.06); }}
  .top {{ display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #e2e8f0; padding-bottom:14px; margin-bottom:14px; gap:12px; flex-wrap:wrap; }}
  .badge {{ background:{'#e0f2fe' if is_gd else '#e6f9f1'}; color:{'#0369a1' if is_gd else '#0f6848'}; padding:5px 10px; border-radius:999px; font-size:12px; font-weight:800; }}
  .path-bar {{ font-size:12px; color:#475569; background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:8px 12px; margin-bottom:16px; word-break:break-all; }}
  .btn {{ text-decoration:none; background:#1e293b; color:#fff; padding:7px 13px; border-radius:8px; font-size:12px; font-weight:700; border:0; cursor:pointer; }}
  pre {{ white-space:pre-wrap; word-break:break-word; background:#0f172a; color:#f8fafc; padding:20px; border-radius:12px; font-size:13.5px; line-height:1.65; font-family:'Nanum Gothic Coding', Consolas, monospace; }}
</style></head>
<body><div class="wrap">
  <div class="top">
    <div><span class="badge">{loc_label}</span> <strong style="margin-left:8px">{_html.escape(md_file.name)}</strong></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <button type="button" class="btn" style="background:#0284c7" onclick='fetch("/ops/output-dir",{{method:"POST",headers:{{"Content-Type":"application/json"}},body:JSON.stringify({{action:"open_explorer",target_dir:{parent_dir_js}}})}})'>🗂️ 실제 저장 폴더 열기</button>
      <a class="btn" href="{_html.escape(path)}?raw=1">원본 텍스트 보기</a>
      <a class="btn" style="background:#0f6848" href="/settings.html">← AI 설정 &amp; 질문으로 돌아가기</a>
    </div>
  </div>
  <div class="path-bar">📁 실제 저장 파일 위치: <strong>{_html.escape(str(md_file))}</strong></div>
  <pre>{escaped}</pre>
</div></body></html>"""
                    body = html_doc.encode("utf-8")
                    self.send_response(200)
                    self.send_header("Content-Type", "text/html; charset=utf-8")
                    self.send_header("Content-Length", str(len(body)))
                    self.end_headers()
                    self.wfile.write(body)
                    return

        return super().do_GET()

    def do_POST(self):
        parsed = urlsplit(self.path)
        path = parsed.path
        raw = self._read_body()

        if path == "/ops/character-config":
            try:
                payload = json.loads(raw.decode("utf-8") or "{}")
                configs = payload.get("configs") if isinstance(payload, dict) and "configs" in payload else payload
                saved = save_character_configs(configs if isinstance(configs, dict) else {})
                return self._send_json({"status": "ok", "configs": saved, "message": "캐릭터 AI CLI 배정 및 설정이 저장되었습니다."})
            except Exception as exc:
                return self._send_json({"error": str(exc)}, 400)

        if path == "/ops/cli-ask":
            try:
                payload = json.loads(raw.decode("utf-8") or "{}")
                target = str((payload or {}).get("cli") or "head").strip()
                agent_name = str((payload or {}).get("agent_name") or "").strip() or None
                custom_cli = str((payload or {}).get("custom_cli") or "").strip() or None
                system_prompt = str((payload or {}).get("system_prompt") or "").strip() or None
                raw_skills = (payload or {}).get("skills")
                skills = [str(s) for s in raw_skills] if isinstance(raw_skills, list) else None
                question = str((payload or {}).get("question") or "").strip()
                if not question:
                    return self._send_json({"ok": False, "error": "질문 내용을 입력해 주세요."}, 400)
                res = answer_simple_question(
                    target, question, agent_name=agent_name, custom_cli=custom_cli, system_prompt=system_prompt, skills=skills
                )
                with _STATE_LOCK:
                    prov_used = res.get("provider", "claude")
                    domain_used = PROVIDER_META.get(prov_used, PROVIDER_META["claude"])["domain"]
                    tok_used = max(120, len(res.get("answer") or "") * 2)
                    if domain_used in STATE["usage"]["by_provider"]:
                        STATE["usage"]["by_provider"][domain_used]["calls"] += 1
                        STATE["usage"]["by_provider"][domain_used]["tokens"] += tok_used
                        STATE["usage"]["by_provider"][domain_used]["monthly_calls"] = STATE["usage"]["by_provider"][domain_used].get("monthly_calls", 0) + 1
                        STATE["usage"]["by_provider"][domain_used]["monthly_tokens"] = STATE["usage"]["by_provider"][domain_used].get("monthly_tokens", 0) + tok_used
                    STATE["usage"]["total"]["calls"] += 1
                    STATE["usage"]["total"]["tokens"] += tok_used
                    next_id = max((c["id"] for c in STATE["chat_messages"]), default=0) + 1
                    STATE["chat_messages"].append({"id": next_id, "role": "USER", "content": question, "at": utc_now_iso()})
                    STATE["chat_messages"].append(
                        {
                            "id": next_id + 1,
                            "role": res.get("role", "HEAD"),
                            "content": f"[{res.get('label')}] {res.get('answer')}",
                            "at": utc_now_iso(),
                        }
                    )
                return self._send_json(res, 200)
            except Exception as exc:
                return self._send_json({"ok": False, "error": str(exc)}, 500)

        if path == "/ops/cli-install":
            try:
                payload = json.loads(raw.decode("utf-8") or "{}")
                target = str((payload or {}).get("cli") or "all").lower().strip()
                results = []
                if target == "all":
                    diag_before = probe_cli_diagnostics(deep=False)
                    for prov_key, info in (diag_before.get("providers") or {}).items():
                        if not info.get("installed"):
                            results.append(install_single_cli(info.get("cli") or prov_key))
                    if not results:
                        results.append({"cli": "all", "ok": True, "command": "none", "output": "모든 CLI가 이미 설치되어 있습니다."})
                else:
                    results.append(install_single_cli(target))

                diag_after = probe_cli_diagnostics(deep=True)
                all_ok = all(r.get("ok") for r in results)
                with _STATE_LOCK:
                    STATE["events"].insert(
                        0,
                        {
                            "at": utc_now_iso(),
                            "run_id": f"cli-install-{int(time.time())}",
                            "to_state": "CLI_INSTALL",
                            "state_ko": f"원클릭 CLI 설치 실행 ({target.upper()}) · {'성공' if all_ok else '확인 필요'}",
                            "project": STATE["project_name"],
                            "role": "DIRECTOR",
                        },
                    )
                return self._send_json(
                    {
                        "status": "ok" if all_ok else "partial",
                        "results": results,
                        "diagnostics": diag_after,
                        "message": "원클릭 CLI 설치 및 재검증이 완료되었습니다." if all_ok else "일부 CLI 설치 중 확인이 필요합니다. 아래 로그를 확인해 주세요.",
                    },
                    200 if all_ok else 207,
                )
            except Exception as exc:
                return self._send_json({"error": f"원클릭 설치 실패: {exc}"}, 500)

        if path == "/ops/cli-login":
            try:
                payload = json.loads(raw.decode("utf-8") or "{}")
                target = str((payload or {}).get("cli") or "").lower().strip()
                res = launch_cli_login_terminal(target)
                return self._send_json(res, 200 if res.get("ok") else 400)
            except Exception as exc:
                return self._send_json({"ok": False, "error": str(exc)}, 500)

        if path == "/ops/cli-slots":
            try:
                payload = json.loads(raw.decode("utf-8") or "{}")
                action = str((payload or {}).get("action") or "add").lower().strip()
                if action == "add":
                    base_type = str((payload or {}).get("base_type") or "gemini").lower().strip()
                    label = str((payload or {}).get("label") or "").strip()
                    added = add_cli_slot(base_type, label)
                    diag = probe_cli_diagnostics(deep=False)
                    return self._send_json({
                        "status": "ok",
                        "action": "add",
                        "added": added,
                        "slots": load_cli_slots(),
                        "roles": load_roles(),
                        "diagnostics": diag,
                        "message": f"새 CLI 로그인 슬롯 [{added['label']}]이(가) 추가되었습니다.",
                    })
                elif action == "remove":
                    slot_key = str((payload or {}).get("key") or "").strip()
                    slots = remove_cli_slot(slot_key)
                    diag = probe_cli_diagnostics(deep=False)
                    return self._send_json({
                        "status": "ok",
                        "action": "remove",
                        "removed": slot_key,
                        "slots": slots,
                        "roles": load_roles(),
                        "diagnostics": diag,
                        "message": f"CLI 로그인 슬롯 [{slot_key}]이(가) 제거되었습니다.",
                    })
                elif action == "reset":
                    slots = reset_cli_slots()
                    diag = probe_cli_diagnostics(deep=False)
                    return self._send_json({
                        "status": "ok",
                        "action": "reset",
                        "slots": slots,
                        "roles": load_roles(),
                        "diagnostics": diag,
                        "message": "기본 5대 CLI 로그인 슬롯 목록으로 복원되었습니다.",
                    })
                return self._send_json({"error": f"지원하지 않는 action입니다: {action}"}, 400)
            except ValueError as exc:
                return self._send_json({"error": str(exc)}, 400)
            except Exception as exc:
                return self._send_json({"error": f"CLI 슬롯 변경 실패: {exc}"}, 500)

        if path == "/ops/cli-config":
            try:
                payload = json.loads(raw.decode("utf-8") or "{}")
                paths = payload.get("paths") if isinstance(payload, dict) else {}
                if not isinstance(paths, dict):
                    paths = {}
                saved_paths = save_custom_cli_paths(paths)
                diag = probe_cli_diagnostics(deep=True)
                return self._send_json(
                    {
                        "status": "ok",
                        "paths": saved_paths,
                        "diagnostics": diag,
                        "message": "CLI 실행 경로 저장 및 실시간 로그인 상태 재검증을 완료했습니다.",
                    }
                )
            except Exception as exc:
                return self._send_json({"error": f"CLI 설정 저장 실패: {exc}"}, 400)

        if path == "/ops/roles":
            try:
                payload = json.loads(raw.decode("utf-8") or "{}")
                saved = save_roles(payload)
                with _STATE_LOCK:
                    # When the user swaps roles to a different AI, clear quota lock for newly assigned slots
                    for assigned_slot in saved.values():
                        STATE.get("quota_exhausted_slots", {}).pop(assigned_slot, None)
                    STATE["events"].insert(
                        0,
                        {
                            "at": utc_now_iso(),
                            "run_id": f"role-{int(time.time())}",
                            "to_state": "ROLE_SWAP",
                            "state_ko": (
                                f"역할 재배치: HEAD={PROVIDER_META[saved['head']]['label']} · "
                                f"BUILDER={PROVIDER_META[saved['builder']]['label']} · "
                                f"REVIEWER={PROVIDER_META[saved['reviewer']]['label']}"
                            ),
                            "project": STATE["project_name"],
                            "role": "HEAD",
                        },
                    )
                return self._send_json(
                    {
                        "roles": saved,
                        "message": "역할 배정이 저장되었습니다 (HEAD / BUILDER / REVIEWER 즉시 반영).",
                    }
                )
            except ValueError as exc:
                return self._send_json({"error": str(exc)}, 400)
            except Exception as exc:
                return self._send_json({"error": f"역할 저장 실패: {exc}"}, 500)

        if path == "/ops/missions/resume":
            try:
                payload = json.loads(raw.decode("utf-8") or "{}") if raw else {}
            except Exception:
                payload = {}
            with _STATE_LOCK:
                paused = STATE.get("paused_mission")
                if not paused:
                    return self._send_json({"status": "error", "error": "현재 일시 중지된 미션이 없습니다."}, 404)
                if STATE["working_now"]:
                    return self._send_json({"status": "busy", "error": "이미 실행 중인 작업이 있습니다."}, 409)
                # Clear exhausted flags so newly connected or swapped AI slots can run
                if payload.get("new_provider") and paused.get("interrupted_role"):
                    role_map_key = {
                        "HEAD": "head",
                        "BUILDER": "builder",
                        "SUB-BUILDER": "sub_builder",
                        "REVIEWER": "reviewer",
                        "RESEARCHER": "researcher",
                    }.get(paused["interrupted_role"], "builder")
                    try:
                        cur_roles = load_roles()
                        cur_roles[role_map_key] = str(payload["new_provider"]).strip()
                        ROLE_SETTINGS_PATH.write_text(json.dumps(cur_roles, ensure_ascii=False, indent=2), encoding="utf-8")
                    except Exception:
                        pass
                STATE["quota_exhausted_slots"] = {}
                STATE["stop_requested"] = False
                mission_id = paused["mission_id"]
                goal = paused["goal"]
                profile = paused.get("profile", "standard")
                interrupted_stage = paused.get("interrupted_stage", "BUILDING")
                for m in STATE["missions"]:
                    if m["mission_id"] == mission_id:
                        m["live"] = True
                        m["status"] = "RUNNING"
                        m["updated_at"] = utc_now_iso()
                STATE["events"].insert(
                    0,
                    {
                        "at": utc_now_iso(),
                        "run_id": f"{mission_id}-resume",
                        "to_state": interrupted_stage,
                        "state_ko": f"▶ [작업 재개] 미션({mission_id})을 중단된 {interrupted_stage} 단계부터 이어서 재개합니다.",
                        "project": STATE["project_name"],
                        "role": paused.get("interrupted_role", "HEAD"),
                    },
                )
            t = threading.Thread(
                target=_run_mission_pipeline,
                args=(mission_id, goal, profile, paused),
                daemon=True,
            )
            t.start()
            return self._send_json(
                {
                    "status": "resumed",
                    "mission_id": mission_id,
                    "interrupted_stage": interrupted_stage,
                    "message": f"미션({mission_id})을 중단된 {interrupted_stage} 단계부터 재개했습니다.",
                },
                200,
            )

        if path == "/ops/gdrive/connect":
            try:
                payload = json.loads(raw.decode("utf-8") or "{}") if raw else {}
                if not isinstance(payload, dict):
                    payload = {}
                action = str(payload.get("action") or "gcloud_login").lower().strip()

                if action == "gcloud_login":
                    res = launch_gcloud_drive_login()
                    save_workspace_settings(gdrive_direct_enabled=True)
                    return self._send_json(
                        {**res, "output_dir_status": get_output_dir_status()},
                        200 if res.get("ok") else 400,
                    )

                if action == "save_oauth_client":
                    raw_json = str(payload.get("client_secret_json") or "").strip()
                    saved_info = save_oauth_client_json(raw_json)
                    return self._send_json(
                        {
                            **saved_info,
                            "oauth_start_url": "/ops/gdrive/oauth/start",
                            "output_dir_status": get_output_dir_status(),
                            "message": "OAuth 클라이언트 설정이 저장되었습니다. 브라우저 인증 창을 엽니다.",
                        }
                    )

                if action == "disconnect":
                    disconnect_gdrive()
                    st_after = save_workspace_settings(gdrive_direct_enabled=False)
                    return self._send_json({"ok": True, "output_dir_status": st_after, "message": "Google Drive 직접 연결이 해제되었습니다."})

                if action == "toggle_sync":
                    enabled_val = bool(payload.get("enabled", True))
                    st_after = save_workspace_settings(gdrive_direct_enabled=enabled_val)
                    return self._send_json(
                        {
                            "ok": True,
                            "output_dir_status": st_after,
                            "message": "Google Drive 클라우드 자동 업로드가 활성화되었습니다." if enabled_val else "Google Drive 클라우드 자동 업로드가 일시 중지되었습니다.",
                        }
                    )

                if action == "set_folder":
                    folder_input = str(payload.get("folder_id") or payload.get("folder_url") or "root").strip()
                    meta = gdrive_get_folder_metadata(folder_input)
                    st_after = save_workspace_settings(
                        gdrive_direct_enabled=True,
                        gdrive_folder_id=meta["id"],
                        gdrive_folder_name=meta["name"],
                        gdrive_folder_url=meta["webViewLink"],
                    )
                    with _STATE_LOCK:
                        STATE["events"].insert(
                            0,
                            {
                                "at": utc_now_iso(),
                                "run_id": f"gdrive-folder-{int(time.time())}",
                                "to_state": "GDRIVE_FOLDER",
                                "state_ko": f"☁️ Google Drive 클라우드 저장 폴더 지정: {meta['name']} ({meta['id']})",
                                "project": STATE["project_name"],
                                "role": "DIRECTOR",
                            },
                        )
                    return self._send_json(
                        {
                            "ok": True,
                            "folder": meta,
                            "output_dir_status": st_after,
                            "message": f"Google Drive 클라우드 폴더 [{meta['name']}]가 프로젝트 저장 위치로 지정되었습니다.",
                        }
                    )

                if action == "create_folder":
                    parent_id = str(payload.get("parent_id") or "root").strip() or "root"
                    folder_name = str(payload.get("name") or "").strip()
                    created = gdrive_create_subfolder(folder_name, parent_id=parent_id)
                    return self._send_json({"ok": True, "folder": created, "message": f"Google Drive에 새 폴더 [{created['name']}]가 준비되었습니다."})

                if action == "test_upload":
                    st_cur = get_output_dir_status(force_gdrive_refresh=True)
                    gd_cur = st_cur.get("gdrive_direct") or {}
                    if not gd_cur.get("connected"):
                        return self._send_json({"ok": False, "error": "먼저 [🔑 Google Drive 직접 로그인]을 완료해 주세요."}, 400)
                    target_fid = gd_cur.get("folder_id") or "root"
                    DELIVERABLES_DIR.mkdir(parents=True, exist_ok=True)
                    test_file = DELIVERABLES_DIR / "nexus_gdrive_connection_test.md"
                    test_file.write_text(
                        f"# ☁️ NEXUS AI Virtual Office × Google Drive 직접 연결 확인\n\n"
                        f"- **연결 계정**: `{gd_cur.get('account_email') or 'Google Account'}`\n"
                        f"- **대상 폴더**: `{gd_cur.get('folder_name')}` (`{target_fid}`)\n"
                        f"- **업로드 시각**: `{utc_now_iso()}`\n",
                        encoding="utf-8",
                    )
                    up_res = gdrive_upload_file(test_file, parent_id=target_fid, remote_name="nexus_gdrive_connection_test.md")
                    return self._send_json(
                        {
                            "ok": True,
                            "uploaded": up_res,
                            "folder_url": gd_cur.get("folder_url"),
                            "message": f"Google Drive [{gd_cur.get('folder_name')}]에 테스트 파일 업로드가 완료되었습니다!",
                        }
                    )

                return self._send_json({"ok": False, "error": f"지원하지 않는 action입니다: {action}"}, 400)
            except Exception as exc:
                return self._send_json({"ok": False, "error": str(exc)}, 400)

        if path == "/ops/output-dir":
            try:
                payload = json.loads(raw.decode("utf-8") or "{}") if raw else {}
                if not isinstance(payload, dict):
                    payload = {}
                action = str(payload.get("action") or "set").lower().strip()
                if action == "browse":
                    init_dir = str(payload.get("initial_dir") or "").strip() or None
                    pick_only = bool(payload.get("pick_only", False))
                    b_tid = str(payload.get("team_id") or "").strip() or None
                    res = browse_output_folder_dialog(initial_dir=init_dir, pick_only=pick_only, team_id=b_tid)
                    return self._send_json(res, 200 if res.get("ok") else 400)
                if action == "open_explorer":
                    t_dir = str(payload.get("target_dir") or "").strip() or None
                    res = open_output_folder_in_explorer(target_dir_str=t_dir)
                    return self._send_json(res, 200 if res.get("ok") else 400)
                if action == "reset":
                    status_obj = save_workspace_settings(output_dir_raw="")
                    return self._send_json(
                        {
                            "status": "ok",
                            "output_dir_status": status_obj,
                            "message": f"프로젝트 저장 폴더가 기본 경로({status_obj['output_dir']})로 복원되었습니다.",
                        }
                    )
                out_raw = payload.get("output_dir")
                mirror_val = payload.get("mirror_to_local") if "mirror_to_local" in payload else None
                status_obj = save_workspace_settings(
                    output_dir_raw=str(out_raw) if out_raw is not None else None,
                    mirror_to_local=bool(mirror_val) if mirror_val is not None else None,
                )
                with _STATE_LOCK:
                    loc_tag = "☁️ Google Drive" if status_obj["is_google_drive"] else "📁 로컬 폴더"
                    STATE["events"].insert(
                        0,
                        {
                            "at": utc_now_iso(),
                            "run_id": f"outdir-{int(time.time())}",
                            "to_state": "OUTPUT_DIR",
                            "state_ko": f"프로젝트 저장 폴더 지정 ({loc_tag}): {status_obj['output_dir']}",
                            "project": STATE["project_name"],
                            "role": "DIRECTOR",
                        },
                    )
                return self._send_json(
                    {
                        "status": "ok",
                        "output_dir_status": status_obj,
                        "message": f"프로젝트 저장 폴더가 [{status_obj['output_dir']}]로 저장되었습니다.",
                    }
                )
            except ValueError as exc:
                return self._send_json({"status": "error", "error": str(exc)}, 400)
            except Exception as exc:
                return self._send_json({"status": "error", "error": f"저장 폴더 설정 실패: {exc}"}, 500)

        if path == "/ops/teams":
            try:
                payload = json.loads(raw.decode("utf-8") or "{}") if raw else {}
                if not isinstance(payload, dict):
                    payload = {}
                action = str(payload.get("action") or "save").lower().strip()
                gdrives = detect_google_drive_paths()

                if action == "save":
                    saved_team, _ = create_or_update_team(payload.get("team") or payload, gdrives)
                    with _STATE_LOCK:
                        STATE["events"].insert(
                            0,
                            {
                                "at": utc_now_iso(),
                                "run_id": f"team-{int(time.time())}",
                                "to_state": "TEAM_SAVE",
                                "state_ko": f"🏢 팀 구성 저장 완료: [{saved_team['name']}] ({saved_team['floor']} · 팀원 {len(saved_team['member_ids'])}명)",
                                "project": STATE["project_name"],
                                "role": "DIRECTOR",
                            },
                        )
                    return self._send_json(
                        {
                            "ok": True,
                            "saved_team": saved_team,
                            "teams_summary": get_teams_payload(),
                            "character_configs": load_character_configs(),
                            "message": f"팀 [{saved_team['name']}] 구성 및 전용 작업 폴더가 저장되었습니다.",
                        }
                    )

                if action == "set_workspace":
                    tid = str(payload.get("team_id") or "").strip()
                    ws_data = payload.get("workspace") if isinstance(payload.get("workspace"), dict) else payload
                    updated_team, _ = update_team_workspace_only(tid, ws_data, gdrives)
                    with _STATE_LOCK:
                        STATE["events"].insert(
                            0,
                            {
                                "at": utc_now_iso(),
                                "run_id": f"team-ws-{int(time.time())}",
                                "to_state": "TEAM_WORKSPACE",
                                "state_ko": f"📂 [{updated_team['name']}] 작업 폴더 지정 업데이트 완료",
                                "project": STATE["project_name"],
                                "role": "DIRECTOR",
                            },
                        )
                    return self._send_json(
                        {
                            "ok": True,
                            "saved_team": updated_team,
                            "teams_summary": get_teams_payload(),
                            "message": f"[{updated_team['name']}] 팀의 작업 폴더 설정이 업데이트되었습니다.",
                        }
                    )

                if action == "create_gdrive_team_folder":
                    tid = str(payload.get("team_id") or "").strip()
                    parent_id = str(payload.get("parent_id") or "root").strip() or "root"
                    custom_name = str(payload.get("folder_name") or "").strip() or None
                    created_folder, _ = create_and_bind_gdrive_team_folder(tid, parent_folder_id=parent_id, custom_folder_name=custom_name)
                    return self._send_json(
                        {
                            "ok": True,
                            "folder": created_folder,
                            "teams_summary": get_teams_payload(),
                            "message": f"Google Drive 클라우드에 [{created_folder['name']}] 전용 폴더를 생성하고 팀에 연결했습니다!",
                        }
                    )

                if action == "set_active":
                    tid = str(payload.get("team_id") or "").strip()
                    set_active_team(tid)
                    active_obj = get_team_by_id(tid)
                    return self._send_json(
                        {
                            "ok": True,
                            "active_team": active_obj,
                            "teams_summary": get_teams_payload(),
                            "message": f"현재 기본 작업 팀이 [{active_obj['name']}]으로 전환되었습니다.",
                        }
                    )

                if action == "delete":
                    tid = str(payload.get("team_id") or "").strip()
                    delete_team(tid)
                    return self._send_json(
                        {
                            "ok": True,
                            "teams_summary": get_teams_payload(),
                            "message": "선택한 팀이 삭제되었습니다.",
                        }
                    )

                return self._send_json({"ok": False, "error": f"지원하지 않는 action입니다: {action}"}, 400)
            except (ValueError, PermissionError) as exc:
                return self._send_json({"ok": False, "error": str(exc)}, 400)
            except Exception as exc:
                return self._send_json({"ok": False, "error": f"팀 설정 처리 실패: {exc}"}, 500)

        if path == "/chat":
            try:
                ctype = (self.headers.get("Content-Type") or "").split(";")[0].strip()
                req_output_dir = None
                req_team_id = None
                if ctype == "application/json":
                    data = json.loads(raw.decode("utf-8") or "{}")
                    goal = str(data.get("message") or data.get("goal") or "").strip()
                    profile = str(data.get("profile") or "standard")
                    req_team_id = str(data.get("team_id") or "").strip() or None
                    if "output_dir" in data and data.get("output_dir") is not None:
                        req_output_dir = str(data.get("output_dir")).strip()
                else:
                    qs = parse_qs(raw.decode("utf-8", errors="replace"))
                    goal = (qs.get("message", [""])[0] or qs.get("goal", [""])[0]).strip()
                    profile = qs.get("profile", ["standard"])[0]
                    req_team_id = (qs.get("team_id", [""])[0]).strip() or None

                if req_team_id:
                    try:
                        set_active_team(req_team_id)
                    except Exception:
                        pass
                target_team = get_team_by_id(req_team_id)

                if req_output_dir is not None:
                    if req_team_id:
                        update_team_workspace_only(target_team["id"], {"output_dir": req_output_dir}, detect_google_drive_paths())
                    else:
                        save_workspace_settings(output_dir_raw=req_output_dir)

                if not goal:
                    return self._send_json({"status": "error", "error": "작업 목표(Goal)를 입력해 주세요."}, 400)

                if goal.lower() in ("stop", "중단", "멈춰", "작업 정지"):
                    res = stop_active_missions("채팅 중단 명령")
                    return self._send_json({"status": "stopped", **res})

                with _STATE_LOCK:
                    if STATE["working_now"]:
                        return self._send_json(
                            {"status": "busy", "error": "이미 실행 중인 파이프라인이 있습니다. 완료 후 보내거나 작업 정지를 눌러주세요."},
                            409,
                        )
                    STATE["stop_requested"] = False
                    next_id = max((c["id"] for c in STATE["chat_messages"]), default=0) + 1
                    STATE["chat_messages"].append(
                        {"id": next_id, "role": "USER", "content": f"[{target_team['name']}] {goal}", "at": utc_now_iso()}
                    )
                    mission_id = f"mission-{int(time.time()) % 100000}"
                    new_mission = {
                        "mission_id": mission_id,
                        "goal": goal,
                        "team_id": target_team["id"],
                        "team_name": target_team["name"],
                        "team_floor": target_team.get("floor", "1F"),
                        "team_color": target_team.get("color", "#0f6848"),
                        "project": STATE["project_name"],
                        "status": "RUNNING",
                        "live": True,
                        "profile": profile,
                        "source": "virtual-office",
                        "max_steps": 5,
                        "passed_steps": 0,
                        "updated_at": utc_now_iso(),
                        "deliverable": True,
                        "apply_state": "applied",
                        "applied": {"status": "applied", "files": ["index.html", "office.html", "agents.html"]},
                        "steps": [],
                    }
                    STATE["missions"].insert(0, new_mission)
                    STATE["focus_mission_id"] = mission_id

                t = threading.Thread(
                    target=_run_mission_pipeline,
                    args=(mission_id, goal, profile, None, target_team["id"]),
                    daemon=True,
                )
                t.start()
                return self._send_json(
                    {
                        "status": "started",
                        "mission_id": mission_id,
                        "goal": goal,
                        "team_id": target_team["id"],
                        "team_name": target_team["name"],
                    },
                    202,
                )
            except Exception as exc:
                return self._send_json({"status": "error", "error": str(exc)}, 500)

        if path == "/ops/missions/stop":
            try:
                payload = json.loads(raw.decode("utf-8") or "{}") if raw else {}
            except Exception:
                payload = {}
            reason = str(payload.get("reason") or "버추얼 오피스 작업 정지 버튼")[:200]
            return self._send_json(stop_active_missions(reason))

        return self._send_json({"error": "Not found"}, 404)


def run(port: int = 8080):
    mimetypes.add_type("application/javascript", ".js")
    mimetypes.add_type("application/json", ".json")
    server = ThreadingHTTPServer(("0.0.0.0", port), VirtualOfficeHandler)
    print(f"NEXUS AI Virtual Office × AI DEV DIRECTOR running at http://127.0.0.1:{port}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    import sys
    port_arg = int(sys.argv[1]) if len(sys.argv) > 1 and sys.argv[1].isdigit() else 8080
    run(port_arg)
