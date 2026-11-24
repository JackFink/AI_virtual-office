"""
팀(Team) 구성 · 팀별 작업 폴더 매핑 · 연결된 작업 폴더 전체 현황 집계 모듈
- 자유 팀 생성/편집/삭제 및 가상 오피스 층(1F~10F)·소속 AI 직원·팀 전용 역할(HEAD/BUILDER/REVIEWER 등) 연동
- 팀별 로컬 디스크/마운트 드라이브 폴더 + Google Drive 클라우드 직접 연결 폴더 개별 지정
- 연결되어 있는 모든 작업 폴더(팀별 로컬 폴더, 클라우드 폴더, 전역 폴더, 마운트 드라이브) 통합 집계
"""
from __future__ import annotations

import json
import os
import re
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from backend.config_paths import (
    CHARACTER_CONFIGS_FILE,
    CLI_CONFIG_DIR,
    DELIVERABLES_DIR,
    ROOT,
    TEAMS_CONFIG_FILE,
    TEAMS_CONFIG_SAMPLE_FILE,
)
from backend.gdrive_client import (
    create_subfolder as gdrive_create_subfolder,
    get_folder_metadata as gdrive_get_folder_metadata,
    get_gdrive_connection_status,
    resolve_local_gdrive_path_to_cloud_folder,
    resolve_mounted_gdrive_path,
)


DEFAULT_ROLES = {
    "head": "claude",
    "builder": "antigravity",
    "sub_builder": "gemini",
    "reviewer": "openai",
    "researcher": "grok",
}

DEFAULT_WORKSPACE = {
    "output_dir": "",
    "mirror_to_local": False,
    "gdrive_direct_enabled": False,
    "gdrive_folder_id": "root",
    "gdrive_folder_name": "내 드라이브 (루트)",
    "gdrive_folder_url": "https://drive.google.com/drive/my-drive",
}


def _utc_now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _default_teams_doc() -> Dict[str, Any]:
    if TEAMS_CONFIG_SAMPLE_FILE.exists():
        try:
            data = json.loads(TEAMS_CONFIG_SAMPLE_FILE.read_text(encoding="utf-8"))
            if isinstance(data, dict) and isinstance(data.get("teams"), list) and data["teams"]:
                return data
        except Exception:
            pass
    now = _utc_now()
    return {
        "active_team_id": "team-core",
        "teams": [
            {
                "id": "team-core",
                "name": "코어 플랫폼 개발팀",
                "description": "웹·백엔드 아키텍처 설계, 핵심 구현 및 독립 코드 검수 전담 본부팀",
                "color": "#0f6848",
                "floor": "1F",
                "member_ids": ["01", "02", "03", "04", "05"],
                "roles": dict(DEFAULT_ROLES),
                "workspace": dict(DEFAULT_WORKSPACE),
                "created_at": now,
                "updated_at": now,
            }
        ],
    }


def _normalize_team_item(raw_team: Dict[str, Any], idx: int = 1) -> Dict[str, Any]:
    tid = str(raw_team.get("id") or f"team-{idx}").strip()
    name = str(raw_team.get("name") or f"팀 {idx}").strip()
    desc = str(raw_team.get("description") or "").strip()
    color = str(raw_team.get("color") or "#0f6848").strip()
    floor = str(raw_team.get("floor") or "1F").strip().upper()
    if not re.fullmatch(r"\d+F", floor):
        floor = "1F"

    raw_members = raw_team.get("member_ids")
    members: List[str] = []
    if isinstance(raw_members, list):
        for m in raw_members:
            ms = str(m).strip().zfill(2) if str(m).strip().isdigit() else str(m).strip()
            if ms and ms not in members:
                members.append(ms)
    if not members:
        members = ["01", "03", "04"]

    raw_roles = raw_team.get("roles") if isinstance(raw_team.get("roles"), dict) else {}
    roles = {
        "head": str(raw_roles.get("head") or DEFAULT_ROLES["head"]).strip(),
        "builder": str(raw_roles.get("builder") or DEFAULT_ROLES["builder"]).strip(),
        "sub_builder": str(raw_roles.get("sub_builder") or DEFAULT_ROLES["sub_builder"]).strip(),
        "reviewer": str(raw_roles.get("reviewer") or DEFAULT_ROLES["reviewer"]).strip(),
        "researcher": str(raw_roles.get("researcher") or DEFAULT_ROLES["researcher"]).strip(),
    }

    raw_ws = raw_team.get("workspace") if isinstance(raw_team.get("workspace"), dict) else {}
    ws = {
        "output_dir": str(raw_ws.get("output_dir") or "").strip(),
        "mirror_to_local": bool(raw_ws.get("mirror_to_local", False)),
        "gdrive_direct_enabled": bool(raw_ws.get("gdrive_direct_enabled", False)),
        "gdrive_folder_id": str(raw_ws.get("gdrive_folder_id") or "root").strip() or "root",
        "gdrive_folder_name": str(raw_ws.get("gdrive_folder_name") or "내 드라이브 (루트)").strip() or "내 드라이브 (루트)",
        "gdrive_folder_url": str(raw_ws.get("gdrive_folder_url") or "https://drive.google.com/drive/my-drive").strip()
        or "https://drive.google.com/drive/my-drive",
    }

    orch_mode = str(raw_team.get("orchestrator_mode") or "auto").strip().lower()
    if orch_mode not in ("auto", "standard", "argon", "carbon"):
        orch_mode = "auto"

    now = _utc_now()
    return {
        "id": tid,
        "name": name,
        "description": desc,
        "color": color,
        "floor": floor,
        "orchestrator_mode": orch_mode,
        "member_ids": members,
        "roles": roles,
        "workspace": ws,
        "created_at": str(raw_team.get("created_at") or now),
        "updated_at": str(raw_team.get("updated_at") or now),
    }


def load_teams_config() -> Dict[str, Any]:
    if TEAMS_CONFIG_FILE.exists():
        try:
            raw = json.loads(TEAMS_CONFIG_FILE.read_text(encoding="utf-8"))
            if isinstance(raw, dict) and isinstance(raw.get("teams"), list) and len(raw["teams"]) > 0:
                teams = [
                    _normalize_team_item(t, idx + 1)
                    for idx, t in enumerate(raw["teams"])
                    if isinstance(t, dict)
                ]
                if teams:
                    active_id = str(raw.get("active_team_id") or teams[0]["id"]).strip()
                    if not any(t["id"] == active_id for t in teams):
                        active_id = teams[0]["id"]
                    return {"active_team_id": active_id, "teams": teams}
        except Exception:
            pass

    default_doc = _default_teams_doc()
    teams = [_normalize_team_item(t, i + 1) for i, t in enumerate(default_doc["teams"])]
    active_id = str(default_doc.get("active_team_id") or teams[0]["id"])
    saved = {"active_team_id": active_id, "teams": teams}
    save_teams_config(saved)
    return saved


def save_teams_config(doc: Dict[str, Any]) -> Dict[str, Any]:
    teams_raw = doc.get("teams") if isinstance(doc, dict) else []
    teams = [_normalize_team_item(t, i + 1) for i, t in enumerate(teams_raw or []) if isinstance(t, dict)]
    if not teams:
        teams = [_normalize_team_item(_default_teams_doc()["teams"][0], 1)]
    active_id = str((doc or {}).get("active_team_id") or teams[0]["id"]).strip()
    if not any(t["id"] == active_id for t in teams):
        active_id = teams[0]["id"]

    normalized = {"active_team_id": active_id, "teams": teams}
    CLI_CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    tmp = TEAMS_CONFIG_FILE.with_suffix(".tmp")
    tmp.write_text(json.dumps(normalized, ensure_ascii=False, indent=2), encoding="utf-8")
    os.replace(tmp, TEAMS_CONFIG_FILE)
    return normalized


def get_team_by_id(team_id: Optional[str] = None) -> Dict[str, Any]:
    doc = load_teams_config()
    target_id = (team_id or "").strip() or doc["active_team_id"]
    for t in doc["teams"]:
        if t["id"] == target_id:
            return t
    return doc["teams"][0]


def _is_gdrive_local_path(target_path: Path, detected_gdrives: List[Dict[str, str]]) -> bool:
    s_low = str(target_path).lower().replace("/", "\\")
    for gd in detected_gdrives:
        gd_root = gd.get("root", "").lower().replace("/", "\\").rstrip("\\")
        gd_drive = gd.get("drive", "").lower().replace("/", "\\").rstrip("\\")
        if (gd_root and s_low.startswith(gd_root)) or (gd_drive and len(gd_drive) >= 2 and s_low.startswith(gd_drive)):
            return True
    return any(tok in s_low for tok in ("google drive", "googledrive", "내 드라이브", "my drive", ".shortcut-targets-by-id"))


def resolve_team_local_path(raw_dir: str, detected_gdrives: List[Dict[str, str]]) -> Tuple[Path, bool]:
    cleaned = (raw_dir or "").strip().strip('"').strip("'")
    if not cleaned or cleaned.replace("\\", "/").rstrip("/") == "deliverables":
        return DELIVERABLES_DIR.resolve(), True

    if cleaned.lower().startswith(("http://", "https://")) and "drive.google.com" in cleaned.lower():
        m = re.search(r"/folders/([a-zA-Z0-9_-]+)", cleaned)
        folder_id = m.group(1) if m else ""
        if folder_id:
            for gd in detected_gdrives:
                drv = Path(gd.get("drive", ""))
                by_id = drv / ".shortcut-targets-by-id" / folder_id
                try:
                    if by_id.exists() and by_id.is_dir():
                        return by_id.resolve(), False
                except OSError:
                    pass
        raise ValueError(
            "Google Drive 클라우드 폴더 URL은 먼저 [🔑 Google Drive 직접 연결] 로그인을 완료하거나 로컬 폴더 경로를 입력해 주세요."
        )

    cand = Path(cleaned).expanduser()
    if not cand.is_absolute():
        cand = (ROOT / cand).resolve()
    is_def = cand.resolve() == DELIVERABLES_DIR.resolve()
    return cand, is_def


_IGNORED_SCAN_DIRS = {"__pycache__", ".git", ".venv", "venv", "node_modules", ".pytest_cache", ".mypy_cache", "build"}


def scan_folder_quick_stats(folder_path: Path) -> Dict[str, Any]:
    accessible = False
    project_count = 0
    report_count = 0
    file_count = 0
    latest_mtime = 0.0

    try:
        folder_path.mkdir(parents=True, exist_ok=True)
        accessible = True
        for idx, entry in enumerate(folder_path.iterdir()):
            if idx >= 300:
                break
            try:
                if entry.name.startswith(".") or entry.name in _IGNORED_SCAN_DIRS:
                    continue
                st = entry.stat()
                if st.st_mtime > latest_mtime:
                    latest_mtime = st.st_mtime
                if entry.is_dir():
                    has_proj_marker = entry.name.endswith("_project") or (entry / "README.md").is_file()
                    sub_files_seen = 0
                    for sub_i, sub in enumerate(entry.iterdir()):
                        if sub_i >= 80:
                            break
                        if sub.is_file() and not sub.name.startswith("."):
                            sub_files_seen += 1
                            file_count += 1
                            if sub.name.endswith("_통합보고서.md"):
                                report_count += 1
                                has_proj_marker = True
                    if has_proj_marker or sub_files_seen > 0:
                        project_count += 1
                elif entry.is_file():
                    if not entry.name.startswith(".nexus_write_test"):
                        file_count += 1
                    if entry.suffix.lower() == ".md":
                        report_count += 1
            except OSError:
                continue
    except Exception:
        accessible = False

    eff_str = str(folder_path)
    has_non_ascii_or_space = any(ord(ch) > 127 or ch == " " for ch in eff_str)
    updated_iso = (
        datetime.fromtimestamp(latest_mtime, tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        if latest_mtime > 0
        else None
    )
    return {
        "is_accessible": accessible,
        "project_count": project_count,
        "report_count": report_count,
        "file_count": file_count,
        "has_non_ascii_or_space": has_non_ascii_or_space,
        "last_modified_at": updated_iso,
    }


def list_recent_project_folders(
    eff_path: Path,
    team_missions: List[Dict[str, Any]],
    limit: int = 20,
) -> List[Dict[str, Any]]:
    """Lists existing project folders in the team's workspace + recent mission directories for continuing work."""
    candidates: Dict[str, Path] = {}
    try:
        if eff_path.exists() and eff_path.is_dir():
            for entry in eff_path.iterdir():
                if not entry.is_dir() or entry.name.startswith(".") or entry.name in _IGNORED_SCAN_DIRS:
                    continue
                try:
                    candidates[str(entry.resolve()).lower()] = entry.resolve()
                except OSError:
                    continue
    except OSError:
        pass

    for m in team_missions or []:
        raw_abs = str(m.get("project_dir_abs") or "").strip()
        if not raw_abs:
            continue
        try:
            mp = Path(raw_abs)
            if mp.exists() and mp.is_dir() and mp.name not in _IGNORED_SCAN_DIRS:
                candidates.setdefault(str(mp.resolve()).lower(), mp.resolve())
        except OSError:
            continue

    items: List[Tuple[float, Dict[str, Any]]] = []
    for p in candidates.values():
        try:
            st = p.stat()
            f_cnt = 0
            for idx_f, sub in enumerate(p.rglob("*")):
                if idx_f >= 250:
                    break
                if not sub.is_file() or sub.name.startswith(".") or sub.name == "README.md" or sub.name.endswith("_통합보고서.md"):
                    continue
                rel_parts = sub.relative_to(p).parts
                if any(pt in _IGNORED_SCAN_DIRS for pt in rel_parts[:-1]):
                    continue
                if sub.suffix.lower() in {".pyc", ".pyo", ".spec"}:
                    continue
                f_cnt += 1
            upd_iso = datetime.fromtimestamp(st.st_mtime, tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
            items.append(
                (
                    st.st_mtime,
                    {
                        "name": p.name,
                        "path": str(p),
                        "file_count": f_cnt,
                        "updated_at": upd_iso,
                    },
                )
            )
        except OSError:
            continue

    items.sort(key=lambda x: x[0], reverse=True)
    return [x[1] for x in items[:limit]]


def _validate_and_apply_workspace_dict(
    existing_ws: Dict[str, Any],
    incoming_ws: Dict[str, Any],
    detected_gdrives: List[Dict[str, str]],
) -> Dict[str, Any]:
    ws = dict(DEFAULT_WORKSPACE)
    ws.update(existing_ws or {})
    converted_local_gdrive = False

    if "output_dir" in incoming_ws and incoming_ws["output_dir"] is not None:
        raw_out = str(incoming_ws["output_dir"]).strip()
        if not raw_out or raw_out.replace("\\", "/").rstrip("/") == "deliverables":
            ws["output_dir"] = ""
        elif raw_out.lower().startswith(("http://", "https://")) and "drive.google.com" in raw_out.lower():
            gd_conn = get_gdrive_connection_status()
            if gd_conn.get("connected"):
                meta = gdrive_get_folder_metadata(raw_out)
                ws["gdrive_direct_enabled"] = True
                ws["gdrive_folder_id"] = meta["id"]
                ws["gdrive_folder_name"] = meta["name"]
                ws["gdrive_folder_url"] = meta["webViewLink"]
                ws["output_dir"] = ""
                converted_local_gdrive = True
            else:
                raise ValueError("Google Drive 웹 폴더 주소를 지정하려면 먼저 [🔑 Google Drive 직접 연결] 로그인을 완료해 주세요.")
        else:
            target_p, is_def = resolve_team_local_path(raw_out, detected_gdrives)
            gd_cloud_meta = resolve_local_gdrive_path_to_cloud_folder(target_p, detected_gdrives) if not is_def else None
            if gd_cloud_meta:
                # Google Drive 내 폴더를 선택한 경우 자동으로 Google Drive 웹 URL로 연결!
                ws["gdrive_direct_enabled"] = True
                ws["gdrive_folder_id"] = gd_cloud_meta["id"]
                ws["gdrive_folder_name"] = gd_cloud_meta["name"]
                ws["gdrive_folder_url"] = gd_cloud_meta["webViewLink"]
                ws["output_dir"] = ""
                converted_local_gdrive = True
            else:
                try:
                    target_p.mkdir(parents=True, exist_ok=True)
                    probe = target_p / f".nexus_write_test_{os.getpid()}.tmp"
                    probe.write_text("ok", encoding="utf-8")
                    probe.unlink(missing_ok=True)
                except PermissionError as exc:
                    raise ValueError(
                        f"현재 서버가 IDE 백그라운드 샌드박스 환경에서 실행 중이어서 저장소 외부 폴더({target_p}) 쓰기가 제한됩니다. "
                        f"deliverables 하위 폴더(예: deliverables/team_app)를 선택하거나, 일반 터미널에서 start_director.bat(또는 python server.py 8080)으로 실행해 주세요."
                    ) from exc
                except Exception as exc:
                    raise ValueError(f"팀 작업 폴더에 접근하거나 파일을 쓸 수 없습니다 ({target_p}): {exc}") from exc

                if is_def:
                    ws["output_dir"] = ""
                else:
                    if "gdrive_direct_enabled" not in incoming_ws:
                        ws["gdrive_direct_enabled"] = False
                    # Preserve clean relative path if inside deliverables/, else full path
                    try:
                        rel_root = target_p.resolve().relative_to(ROOT.resolve())
                        ws["output_dir"] = rel_root.as_posix() if str(raw_out).startswith("deliverables") else str(target_p)
                    except ValueError:
                        ws["output_dir"] = str(target_p)

    if "mirror_to_local" in incoming_ws and incoming_ws["mirror_to_local"] is not None:
        ws["mirror_to_local"] = bool(incoming_ws["mirror_to_local"])

    if "gdrive_direct_enabled" in incoming_ws and incoming_ws["gdrive_direct_enabled"] is not None and not converted_local_gdrive:
        ws["gdrive_direct_enabled"] = bool(incoming_ws["gdrive_direct_enabled"])

    if "gdrive_folder_input" in incoming_ws and incoming_ws["gdrive_folder_input"]:
        raw_gd = str(incoming_ws["gdrive_folder_input"]).strip()
        gd_conn = get_gdrive_connection_status()
        if gd_conn.get("connected"):
            meta = gdrive_get_folder_metadata(raw_gd)
            ws["gdrive_folder_id"] = meta["id"]
            ws["gdrive_folder_name"] = meta["name"]
            ws["gdrive_folder_url"] = meta["webViewLink"]
            if not str(incoming_ws.get("output_dir") or "").strip():
                ws["output_dir"] = ""
        else:
            ws["gdrive_folder_id"] = raw_gd

    for k in ("gdrive_folder_id", "gdrive_folder_name", "gdrive_folder_url"):
        if k in incoming_ws and incoming_ws[k]:
            ws[k] = str(incoming_ws[k]).strip()

    return ws


def _sync_members_floor_in_character_configs(member_ids: List[str], floor: str, team_id: str, team_name: str) -> None:
    try:
        cur: Dict[str, Any] = {}
        if CHARACTER_CONFIGS_FILE.exists():
            cur = json.loads(CHARACTER_CONFIGS_FILE.read_text(encoding="utf-8"))
            if not isinstance(cur, dict):
                cur = {}
        changed = False
        for mid in member_ids:
            entry = cur.get(mid)
            if not isinstance(entry, dict):
                entry = {"id": mid}
            entry["floor"] = floor
            entry["teamId"] = team_id
            entry["teamName"] = team_name
            cur[mid] = entry
            changed = True
        if changed:
            CHARACTER_CONFIGS_FILE.parent.mkdir(parents=True, exist_ok=True)
            tmp = CHARACTER_CONFIGS_FILE.with_suffix(".tmp")
            tmp.write_text(json.dumps(cur, ensure_ascii=False, indent=2), encoding="utf-8")
            os.replace(tmp, CHARACTER_CONFIGS_FILE)
    except Exception:
        pass


def create_or_update_team(
    payload: Dict[str, Any],
    detected_gdrives: List[Dict[str, str]],
) -> Tuple[Dict[str, Any], Dict[str, Any]]:
    doc = load_teams_config()
    teams = doc["teams"]

    raw_id = str(payload.get("id") or "").strip()
    name = str(payload.get("name") or "").strip()
    if not name:
        raise ValueError("팀 이름을 입력해 주세요.")

    existing = next((t for t in teams if t["id"] == raw_id), None) if raw_id else None
    now = _utc_now()

    if existing is None:
        slug = re.sub(r"[^a-zA-Z0-9_-]+", "-", name.lower()).strip("-")
        tid = raw_id or f"team-{slug or int(time.time()) % 100000}"
        if any(t["id"] == tid for t in teams):
            tid = f"{tid}-{int(time.time()) % 10000}"
        base_team = {
            "id": tid,
            "name": name,
            "description": str(payload.get("description") or "").strip(),
            "color": str(payload.get("color") or "#0f6848").strip(),
            "floor": str(payload.get("floor") or "1F").strip().upper(),
            "orchestrator_mode": str(payload.get("orchestrator_mode") or "auto").strip().lower(),
            "member_ids": payload.get("member_ids") or ["01", "03", "04"],
            "roles": payload.get("roles") or dict(DEFAULT_ROLES),
            "workspace": dict(DEFAULT_WORKSPACE),
            "created_at": now,
            "updated_at": now,
        }
        norm_team = _normalize_team_item(base_team, len(teams) + 1)
        if isinstance(payload.get("workspace"), dict):
            norm_team["workspace"] = _validate_and_apply_workspace_dict(
                norm_team["workspace"], payload["workspace"], detected_gdrives
            )
        teams.append(norm_team)
        saved_team = norm_team
        if payload.get("set_active", True):
            doc["active_team_id"] = saved_team["id"]
    else:
        existing["name"] = name
        if "description" in payload:
            existing["description"] = str(payload.get("description") or "").strip()
        if "color" in payload and payload.get("color"):
            existing["color"] = str(payload["color"]).strip()
        if "floor" in payload and payload.get("floor"):
            fl = str(payload["floor"]).strip().upper()
            if re.fullmatch(r"\d+F", fl):
                existing["floor"] = fl
        if "orchestrator_mode" in payload and payload.get("orchestrator_mode"):
            om = str(payload["orchestrator_mode"]).strip().lower()
            if om in ("auto", "standard", "argon", "carbon"):
                existing["orchestrator_mode"] = om
        if isinstance(payload.get("member_ids"), list) and payload["member_ids"]:
            existing["member_ids"] = [
                str(m).strip().zfill(2) if str(m).strip().isdigit() else str(m).strip()
                for m in payload["member_ids"]
                if str(m).strip()
            ]
        if isinstance(payload.get("roles"), dict):
            for rk in ("head", "builder", "sub_builder", "reviewer", "researcher"):
                if payload["roles"].get(rk):
                    existing["roles"][rk] = str(payload["roles"][rk]).strip()
        if isinstance(payload.get("workspace"), dict):
            existing["workspace"] = _validate_and_apply_workspace_dict(
                existing["workspace"], payload["workspace"], detected_gdrives
            )
        existing["updated_at"] = now
        saved_team = _normalize_team_item(existing)
        idx = next(i for i, t in enumerate(teams) if t["id"] == saved_team["id"])
        teams[idx] = saved_team
        if payload.get("set_active"):
            doc["active_team_id"] = saved_team["id"]

    if payload.get("sync_floor_to_members", True):
        _sync_members_floor_in_character_configs(
            saved_team["member_ids"], saved_team["floor"], saved_team["id"], saved_team["name"]
        )

    saved_doc = save_teams_config(doc)
    return saved_team, saved_doc


def update_team_workspace_only(
    team_id: str,
    ws_updates: Dict[str, Any],
    detected_gdrives: List[Dict[str, str]],
) -> Tuple[Dict[str, Any], Dict[str, Any]]:
    doc = load_teams_config()
    target = next((t for t in doc["teams"] if t["id"] == team_id), None)
    if not target:
        raise ValueError(f"존재하지 않는 팀입니다: {team_id}")
    target["workspace"] = _validate_and_apply_workspace_dict(target["workspace"], ws_updates, detected_gdrives)
    target["updated_at"] = _utc_now()
    saved_doc = save_teams_config(doc)
    return target, saved_doc


def create_and_bind_gdrive_team_folder(
    team_id: str,
    parent_folder_id: str = "root",
    custom_folder_name: Optional[str] = None,
    detected_gdrives: Optional[List[Dict[str, str]]] = None,
) -> Tuple[Dict[str, Any], Dict[str, Any]]:
    doc = load_teams_config()
    target = next((t for t in doc["teams"] if t["id"] == team_id), None)
    if not target:
        raise ValueError(f"존재하지 않는 팀입니다: {team_id}")
    gd_conn = get_gdrive_connection_status(force_refresh=True)
    if not gd_conn.get("connected"):
        raise PermissionError("먼저 [🔑 Google Drive 직접 연결] 로그인을 완료해 주세요.")
    folder_title = (custom_folder_name or f"NEXUS_{target['name']}").strip()
    created = gdrive_create_subfolder(folder_title, parent_id=parent_folder_id or "root")
    target["workspace"]["gdrive_direct_enabled"] = True
    target["workspace"]["gdrive_folder_id"] = created["id"]
    target["workspace"]["gdrive_folder_name"] = created["name"]
    target["workspace"]["gdrive_folder_url"] = created["webViewLink"]
    # 클라우드 전용폴더 생성 시 작업 폴더 주소는 로컬 디스크 경로가 아닌 Google Drive 웹 URL을 주 경로로 사용
    target["workspace"]["output_dir"] = ""
    target["updated_at"] = _utc_now()
    saved_doc = save_teams_config(doc)
    return created, saved_doc


def delete_team(team_id: str) -> Dict[str, Any]:
    doc = load_teams_config()
    if len(doc["teams"]) <= 1:
        raise ValueError("최소 1개 이상의 팀은 유지되어야 합니다.")
    before = len(doc["teams"])
    doc["teams"] = [t for t in doc["teams"] if t["id"] != team_id]
    if len(doc["teams"]) == before:
        raise ValueError(f"존재하지 않는 팀입니다: {team_id}")
    if doc["active_team_id"] == team_id:
        doc["active_team_id"] = doc["teams"][0]["id"]
    return save_teams_config(doc)


def set_active_team(team_id: str) -> Dict[str, Any]:
    doc = load_teams_config()
    if not any(t["id"] == team_id for t in doc["teams"]):
        raise ValueError(f"존재하지 않는 팀입니다: {team_id}")
    doc["active_team_id"] = team_id
    return save_teams_config(doc)


def assign_member_to_team(
    agent_id: str,
    team_id: str = "",
    mode: str = "move",
    floor_override: Optional[str] = None,
) -> Dict[str, Any]:
    raw_aid = str(agent_id or "").strip()
    if not raw_aid:
        raise ValueError("배정할 AI 직원 ID를 지정해 주세요.")
    aid = raw_aid.zfill(2) if raw_aid.isdigit() else raw_aid
    tid = str(team_id or "").strip()
    act = str(mode or "move").lower().strip()

    doc = load_teams_config()
    teams = doc["teams"]
    now = _utc_now()

    if act == "remove":
        target = next((t for t in teams if t["id"] == tid), None)
        if not target:
            raise ValueError(f"존재하지 않는 팀입니다: {tid}")
        if aid in target["member_ids"]:
            if len(target["member_ids"]) <= 1:
                raise ValueError(f"[{target['name']}] 팀에는 최소 1명 이상의 직원이 유지되어야 합니다.")
            target["member_ids"] = [m for m in target["member_ids"] if m != aid]
            target["updated_at"] = now
        return save_teams_config(doc)

    if act == "move":
        for t in teams:
            if t["id"] != tid and aid in t["member_ids"] and len(t["member_ids"]) > 1:
                t["member_ids"] = [m for m in t["member_ids"] if m != aid]
                t["updated_at"] = now

    if tid:
        target = next((t for t in teams if t["id"] == tid), None)
        if not target:
            raise ValueError(f"존재하지 않는 팀입니다: {tid}")
        if aid not in target["member_ids"]:
            target["member_ids"].append(aid)
            target["updated_at"] = now
        eff_floor = str(floor_override or target["floor"] or "1F").strip().upper()
        _sync_members_floor_in_character_configs([aid], eff_floor, target["id"], target["name"])
    elif floor_override:
        _sync_members_floor_in_character_configs([aid], str(floor_override).strip().upper(), "", "")

    return save_teams_config(doc)


def get_all_team_workspace_paths(detected_gdrives: List[Dict[str, str]]) -> List[Path]:
    doc = load_teams_config()
    paths: List[Path] = []
    for t in doc["teams"]:
        try:
            p, _ = resolve_team_local_path(t["workspace"].get("output_dir", ""), detected_gdrives)
            if p not in paths:
                paths.append(p)
        except Exception:
            continue
    return paths


def build_teams_and_workspaces_payload(
    missions: List[Dict[str, Any]],
    detected_gdrives: List[Dict[str, str]],
    gdrive_conn: Dict[str, Any],
    global_out_status: Dict[str, Any],
    character_configs: Dict[str, Any],
) -> Dict[str, Any]:
    doc = load_teams_config()
    active_id = doc["active_team_id"]
    enriched_teams: List[Dict[str, Any]] = []

    # Map normalized local path -> connected workspace entry
    local_ws_map: Dict[str, Dict[str, Any]] = {}
    cloud_ws_list: List[Dict[str, Any]] = []
    auto_cleaned = False

    for t in doc["teams"]:
        ws = t["workspace"]
        cur_out_str = str(ws.get("output_dir") or "").strip()
        gd_fname_chk = str(ws.get("gdrive_folder_name") or "").strip()
        if (
            ws.get("gdrive_direct_enabled")
            and (ws.get("gdrive_folder_id") or "root") != "root"
            and cur_out_str
            and (
                cur_out_str.replace("\\", "/").startswith("deliverables")
                or (gd_fname_chk and cur_out_str.endswith(gd_fname_chk))
            )
        ):
            ws["output_dir"] = ""
            auto_cleaned = True
        elif cur_out_str and gdrive_conn.get("connected") and detected_gdrives:
            try:
                cand_local_p = Path(cur_out_str)
                if _is_gdrive_local_path(cand_local_p, detected_gdrives):
                    migrated_meta = resolve_local_gdrive_path_to_cloud_folder(cand_local_p, detected_gdrives)
                    if migrated_meta:
                        ws["gdrive_direct_enabled"] = True
                        ws["gdrive_folder_id"] = migrated_meta["id"]
                        ws["gdrive_folder_name"] = migrated_meta["name"]
                        ws["gdrive_folder_url"] = migrated_meta["webViewLink"]
                        ws["output_dir"] = ""
                        auto_cleaned = True
            except Exception:
                pass

        try:
            eff_path, is_def = resolve_team_local_path(ws.get("output_dir", ""), detected_gdrives)
        except Exception:
            eff_path, is_def = DELIVERABLES_DIR.resolve(), True

        stats = scan_folder_quick_stats(eff_path)
        is_gd_local = _is_gdrive_local_path(eff_path, detected_gdrives)

        team_missions = [
            m for m in missions
            if m.get("team_id") == t["id"]
            or (not m.get("team_id") and t["id"] == active_id and m.get("source") == "virtual-office")
        ]
        latest_m = team_missions[0] if team_missions else None
        active_or_latest_m = next(
            (m for m in team_missions if m.get("status") in ("RUNNING", "AWAITING_APPROVAL")),
            latest_m,
        )
        raw_proj_abs = str((active_or_latest_m or {}).get("project_dir_abs") or "").strip()
        active_project_dir = raw_proj_abs if (raw_proj_abs and Path(raw_proj_abs).exists()) else ""
        active_project_folder_name = str(
            (active_or_latest_m or {}).get("project_folder_name")
            or (Path(active_project_dir).name if active_project_dir else "")
        ).strip()

        member_details = []
        for mid in t["member_ids"]:
            c_cfg = character_configs.get(mid) if isinstance(character_configs, dict) else None
            member_details.append(
                {
                    "id": mid,
                    "name": (c_cfg or {}).get("name") or f"Agent #{mid}",
                    "role": (c_cfg or {}).get("triadRole") or "BUILDER",
                    "cli": (c_cfg or {}).get("cliProvider") or "antigravity",
                    "floor": (c_cfg or {}).get("floor") or t["floor"],
                }
            )

        gd_fid = ws.get("gdrive_folder_id") or "root"
        gd_fname_val = ws.get("gdrive_folder_name") or "내 드라이브 (루트)"
        gd_web_url = ws.get("gdrive_folder_url") or (
            "https://drive.google.com/drive/my-drive"
            if gd_fid == "root"
            else f"https://drive.google.com/drive/folders/{gd_fid}"
        )
        is_cloud_primary = bool(ws.get("gdrive_direct_enabled") and is_def)
        effective_work_dir = active_project_dir if (is_def and not is_cloud_primary and active_project_dir) else str(eff_path)
        recent_proj_folders = list_recent_project_folders(eff_path, team_missions, limit=20)

        ws_status = {
            "configured_dir": ws.get("output_dir") or "",
            "effective_dir": str(eff_path),
            "active_project_dir": active_project_dir,
            "active_project_folder_name": active_project_folder_name,
            "recent_project_folders": recent_proj_folders,
            "folder_naming_mode": "project_based" if (is_def and not is_cloud_primary) else "custom_fixed",
            "display_path": gd_web_url if is_cloud_primary else effective_work_dir,
            "is_cloud_primary": is_cloud_primary,
            "is_default": is_def,
            "is_google_drive_local": is_gd_local,
            "mirror_to_local": bool(ws.get("mirror_to_local", False)),
            **stats,
            "gdrive_direct": {
                "connected": bool(gdrive_conn.get("connected")),
                "account_email": gdrive_conn.get("account_email"),
                "enabled": bool(ws.get("gdrive_direct_enabled", False) and gdrive_conn.get("connected")),
                "configured_enabled": bool(ws.get("gdrive_direct_enabled", False)),
                "folder_id": gd_fid,
                "folder_name": gd_fname_val,
                "folder_url": gd_web_url,
            },
        }

        active_team_missions = [
            m for m in team_missions
            if m.get("team_id") == t["id"]
            and m.get("status") in ("RUNNING", "AWAITING_APPROVAL", "QUOTA_PAUSED", "PAUSED_ERROR")
        ]

        enriched_team = {
            **t,
            "is_active": t["id"] == active_id,
            "member_details": member_details,
            "workspace_status": ws_status,
            "active_mission_count": len(active_team_missions),
            "mission_count": len(team_missions),
            "latest_mission": {
                "mission_id": latest_m.get("mission_id"),
                "goal": latest_m.get("goal"),
                "status": latest_m.get("status"),
                "deliverable_file": latest_m.get("deliverable_file"),
                "gdrive_project_url": latest_m.get("gdrive_project_url"),
            }
            if latest_m
            else None,
        }
        enriched_teams.append(enriched_team)

        # Register into connected_workspaces map (skip default deliverables for cloud-primary teams unless mirror_to_local is ON)
        if not is_cloud_primary or bool(ws.get("mirror_to_local")):
            norm_key = str(eff_path).lower()
            if norm_key not in local_ws_map:
                local_ws_map[norm_key] = {
                    "id": f"ws-local-{len(local_ws_map) + 1}",
                    "kind": "gdrive_mounted" if is_gd_local else ("default_local" if is_def else "custom_local"),
                    "kind_label": "☁️ Google Drive (로컬 마운트)" if is_gd_local else ("📁 기본 로컬 폴더" if is_def else "📂 팀 전용 로컬 폴더"),
                    "path": str(eff_path),
                    "display_name": eff_path.name or str(eff_path),
                    "is_accessible": stats["is_accessible"],
                    "has_non_ascii_or_space": stats["has_non_ascii_or_space"],
                    "project_count": stats["project_count"],
                    "report_count": stats["report_count"],
                    "file_count": stats["file_count"],
                    "last_modified_at": stats["last_modified_at"],
                    "teams": [],
                    "web_url": None,
                }
            local_ws_map[norm_key]["teams"].append(
                {"id": t["id"], "name": t["name"], "color": t["color"], "floor": t["floor"], "is_active": t["id"] == active_id}
            )

        # Add direct cloud folder with its real Google Drive web URL
        if ws.get("gdrive_direct_enabled") or (ws.get("gdrive_folder_id") and ws.get("gdrive_folder_id") != "root"):
            fid = ws.get("gdrive_folder_id") or "root"
            existing_cloud = next((c for c in cloud_ws_list if c.get("folder_id") == fid), None)
            if not existing_cloud:
                existing_cloud = {
                    "id": f"ws-cloud-{len(cloud_ws_list) + 1}",
                    "kind": "gdrive_cloud",
                    "kind_label": f"☁️ Google Drive 웹 폴더 ({gd_fname_val})",
                    "path": gd_web_url,
                    "display_name": gd_fname_val,
                    "folder_id": fid,
                    "is_accessible": bool(gdrive_conn.get("connected")),
                    "has_non_ascii_or_space": False,
                    "project_count": len([m for m in team_missions if m.get("gdrive_project_url")]),
                    "report_count": len([m for m in team_missions if m.get("gdrive_report_url")]),
                    "file_count": sum(int(m.get("gdrive_uploaded_count") or 0) for m in team_missions),
                    "last_modified_at": t.get("updated_at"),
                    "teams": [],
                    "web_url": gd_web_url,
                    "account_email": gdrive_conn.get("account_email"),
                }
                cloud_ws_list.append(existing_cloud)
            existing_cloud["teams"].append(
                {"id": t["id"], "name": t["name"], "color": t["color"], "floor": t["floor"], "is_active": t["id"] == active_id}
            )

    if auto_cleaned:
        try:
            save_teams_config(doc)
        except Exception:
            pass

    # Ensure global custom output_dir (if set and distinct) is also visible in connected_workspaces
    glob_dir_str = str(global_out_status.get("output_dir") or "").strip()
    if glob_dir_str and glob_dir_str.lower() not in local_ws_map:
        gp = Path(glob_dir_str)
        g_stats = scan_folder_quick_stats(gp)
        is_gd_loc = _is_gdrive_local_path(gp, detected_gdrives)
        local_ws_map[glob_dir_str.lower()] = {
            "id": f"ws-global-{len(local_ws_map) + 1}",
            "kind": "gdrive_mounted" if is_gd_loc else "global_custom",
            "kind_label": "☁️ 전역 Google Drive 폴더" if is_gd_loc else "📂 전역 지정 저장 폴더",
            "path": glob_dir_str,
            "display_name": gp.name or glob_dir_str,
            "is_accessible": g_stats["is_accessible"],
            "has_non_ascii_or_space": g_stats["has_non_ascii_or_space"],
            "project_count": g_stats["project_count"],
            "report_count": g_stats["report_count"],
            "file_count": g_stats["file_count"],
            "last_modified_at": g_stats["last_modified_at"],
            "teams": [],
            "web_url": None,
        }

    # Include global Google Drive Direct connection if enabled and not yet in cloud_ws_list
    glob_gd = global_out_status.get("gdrive_direct") or {}
    if glob_gd.get("configured_enabled") or (glob_gd.get("connected") and glob_gd.get("folder_id") != "root"):
        gfid = glob_gd.get("folder_id") or "root"
        if not any(c.get("folder_id") == gfid for c in cloud_ws_list):
            cloud_ws_list.append(
                {
                    "id": f"ws-cloud-global",
                    "kind": "gdrive_cloud",
                    "kind_label": f"☁️ Google Drive 전역 웹 폴더 ({glob_gd.get('folder_name') or '내 드라이브'})",
                    "path": glob_gd.get("folder_url") or "https://drive.google.com/drive/my-drive",
                    "display_name": glob_gd.get("folder_name") or "내 드라이브 (루트)",
                    "folder_id": gfid,
                    "is_accessible": bool(glob_gd.get("connected")),
                    "has_non_ascii_or_space": False,
                    "project_count": 0,
                    "report_count": 0,
                    "file_count": 0,
                    "last_modified_at": None,
                    "teams": [],
                    "web_url": glob_gd.get("folder_url") or "https://drive.google.com/drive/my-drive",
                    "account_email": glob_gd.get("account_email"),
                }
            )

    # Also include detected mounted Google Drive roots (e.g. F:\내 드라이브) as available/mounted drives if not yet bound
    mounted_drives_unbound: List[Dict[str, Any]] = []
    for gd_item in detected_gdrives:
        gd_root = str(gd_item.get("root") or "").strip()
        if gd_root and gd_root.lower() not in local_ws_map:
            mounted_drives_unbound.append(
                {
                    "drive": gd_item.get("drive"),
                    "root": gd_root,
                    "suggested": gd_item.get("suggested"),
                    "label": gd_item.get("label"),
                }
            )

    connected_workspaces = list(local_ws_map.values()) + cloud_ws_list

    return {
        "active_team_id": active_id,
        "teams": enriched_teams,
        "connected_workspaces": connected_workspaces,
        "available_mounted_gdrives": mounted_drives_unbound,
        "gdrive_direct_status": gdrive_conn,
    }
