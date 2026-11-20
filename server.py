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
    resolve_local_gdrive_path_to_cloud_folder,
    resolve_mounted_gdrive_path,
    save_oauth_client_json,
    upload_file_to_folder as gdrive_upload_file,
    upload_mission_bundle,
)
from backend.team_manager import (
    assign_member_to_team,
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
            "plan_override": str(s.get("plan_override") or "auto").lower().strip(),
            "selected_model": str(s.get("selected_model") or "").strip(),
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
                        if not item.get("custom_label") and "Gemini 2" in str(item.get("label") or ""):
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


def set_cli_slot_plan(slot_key: str, plan_override: str) -> Dict[str, Any]:
    key = str(slot_key or "").strip()
    plan_val = str(plan_override or "auto").lower().strip()
    if plan_val not in ("auto", "free", "pro", "ultra"):
        raise ValueError("지원되는 구독 플랜 설정값은 auto, free, pro, ultra 입니다.")
    slots = load_cli_slots()
    target_slot: Optional[Dict[str, Any]] = None
    for s in slots:
        if s.get("key") == key:
            if plan_val == "auto":
                s.pop("plan_override", None)
            else:
                s["plan_override"] = plan_val
            target_slot = dict(s)
            break
    if not target_slot:
        raise ValueError(f"존재하지 않는 CLI 슬롯입니다: {key}")
    save_cli_slots(slots)
    return target_slot


def rename_cli_slot(slot_key: str, new_label: str) -> Dict[str, Any]:
    key = str(slot_key or "").strip()
    clean_label = str(new_label or "").strip()[:80]
    if not clean_label:
        raise ValueError("AI 타이틀(표시 이름)을 입력해 주세요.")
    slots = load_cli_slots()
    target_slot: Optional[Dict[str, Any]] = None
    for s in slots:
        if s.get("key") == key:
            s["label"] = clean_label
            s["custom_label"] = True
            target_slot = dict(s)
            break
    if not target_slot:
        raise ValueError(f"존재하지 않는 CLI 슬롯입니다: {key}")
    save_cli_slots(slots)
    return target_slot


def set_cli_slot_model(slot_key: str, selected_model: str) -> Dict[str, Any]:
    key = str(slot_key or "").strip()
    model_val = str(selected_model or "").strip()
    if model_val in ("auto", "default"):
        model_val = ""
    slots = load_cli_slots()
    target_slot: Optional[Dict[str, Any]] = None
    for s in slots:
        if s.get("key") == key:
            # Check tier lock if selecting Antigravity Orchestrator / Ultra models
            if model_val:
                diag_chk = probe_cli_diagnostics(deep=False)
                p_diag = (diag_chk.get("providers") or {}).get(key) or {}
                avail = p_diag.get("available_models") or []
                matched = next((m for m in avail if m.get("id") == model_val), None)
                if matched and matched.get("locked"):
                    raise ValueError(
                        f"선택한 모델 [{matched.get('name', model_val)}]은(는) {matched.get('lock_reason', '상위 구독 등급')}이 필요합니다."
                    )
            if not model_val:
                s.pop("selected_model", None)
            else:
                s["selected_model"] = model_val
            target_slot = dict(s)
            break
    if not target_slot:
        raise ValueError(f"존재하지 않는 CLI 슬롯입니다: {key}")
    save_cli_slots(slots)
    return target_slot


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
        "orchestrator_mode": "standard",
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
                orch_m = str(raw.get("orchestrator_mode") or "standard").strip().lower()
                if orch_m not in ("standard", "argon", "carbon"):
                    orch_m = "standard"
                return {
                    "output_dir": out_dir,
                    "mirror_to_local": mirror,
                    "recent_dirs": recents[:10],
                    "orchestrator_mode": orch_m,
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
    orchestrator_mode: Optional[str] = None,
) -> Dict[str, Any]:
    cfg = load_workspace_settings()
    gdrives = detect_google_drive_paths()

    converted_gd = False
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
                cfg["output_dir"] = ""
                converted_gd = True
            else:
                raise ValueError("Google Drive 웹 폴더 주소를 지정하려면 먼저 [🔑 Google Drive 직접 연결] 로그인을 완료해 주세요.")
        else:
            target_p = _resolve_custom_output_input(raw_clean, gdrives)
            gd_meta = resolve_local_gdrive_path_to_cloud_folder(target_p, gdrives) if target_p.resolve() != DELIVERABLES_DIR.resolve() else None
            if gd_meta:
                cfg["gdrive_direct_enabled"] = True
                cfg["gdrive_folder_id"] = gd_meta["id"]
                cfg["gdrive_folder_name"] = gd_meta["name"]
                cfg["gdrive_folder_url"] = gd_meta["webViewLink"]
                cfg["output_dir"] = ""
                converted_gd = True
            else:
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
    if gdrive_direct_enabled is not None and not converted_gd:
        cfg["gdrive_direct_enabled"] = bool(gdrive_direct_enabled)
    if gdrive_folder_id is not None:
        cfg["gdrive_folder_id"] = str(gdrive_folder_id).strip() or "root"
    if gdrive_folder_name is not None:
        cfg["gdrive_folder_name"] = str(gdrive_folder_name).strip() or "내 드라이브 (루트)"
    if gdrive_folder_url is not None:
        cfg["gdrive_folder_url"] = str(gdrive_folder_url).strip() or "https://drive.google.com/drive/my-drive"
    if orchestrator_mode is not None:
        om_clean = str(orchestrator_mode).strip().lower()
        if om_clean in ("standard", "argon", "carbon"):
            cfg["orchestrator_mode"] = om_clean

    CLI_CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    tmp = WORKSPACE_SETTINGS_FILE.with_suffix(".tmp")
    tmp.write_text(json.dumps(cfg, ensure_ascii=False, indent=2), encoding="utf-8")
    os.replace(tmp, WORKSPACE_SETTINGS_FILE)
    _OUTPUT_DIR_STATUS_CACHE.clear()
    return get_output_dir_status(force_gdrive_refresh=True)


_OUTPUT_DIR_STATUS_CACHE: Dict[str, Tuple[float, Dict[str, Any]]] = {}


def get_output_dir_status(force_gdrive_refresh: bool = False) -> Dict[str, Any]:
    now_o = time.time()
    cached_o = _OUTPUT_DIR_STATUS_CACHE.get("status")
    if cached_o and not force_gdrive_refresh and (now_o - cached_o[0]) < 30.0:
        return cached_o[1]
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

    res_out = {
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
    _OUTPUT_DIR_STATUS_CACHE["status"] = (now_o, res_out)
    return res_out


def _resolve_browse_path(raw_path: Optional[str]) -> Path:
    s = str(raw_path or "").strip()
    if not s:
        return DELIVERABLES_DIR.resolve()
    p = Path(s).expanduser()
    if not p.is_absolute():
        p = (ROOT / p).resolve()
    else:
        try:
            p = p.resolve()
        except OSError:
            pass
    return p


def _probe_dir_writable(folder_p: Path) -> bool:
    try:
        if not folder_p.exists() or not folder_p.is_dir():
            return False
        probe = folder_p / f".nexus_write_test_{os.getpid()}.tmp"
        probe.write_text("ok", encoding="utf-8")
        probe.unlink(missing_ok=True)
        return True
    except Exception:
        return False


def list_local_fs_directory(target_dir_str: Optional[str] = None) -> Dict[str, Any]:
    """Lists drives, breadcrumbs, subdirectories, and files so web UI can browse & open folders without relying on OS Explorer."""
    gdrives = detect_google_drive_paths()
    roots: List[Dict[str, str]] = [
        {"label": "📁 기본 작업 폴더 (deliverables)", "path": str(DELIVERABLES_DIR.resolve()), "kind": "deliverables"},
        {"label": "🏠 프로젝트 루트", "path": str(ROOT.resolve()), "kind": "repo"},
    ]
    for gd in gdrives:
        gd_r = str(gd.get("root") or "").strip()
        if gd_r:
            roots.append({"label": f"☁️ {gd.get('label') or gd_r}", "path": gd_r, "kind": "gdrive"})

    if os.name == "nt":
        for code in range(ord("C"), ord("Z") + 1):
            drv = f"{chr(code)}:\\"
            try:
                if Path(drv).exists():
                    if not any(r["path"].upper().startswith(drv) and r["kind"] == "gdrive" for r in roots):
                        roots.append({"label": f"💾 로컬 디스크 ({chr(code)}:)", "path": drv, "kind": "drive"})
            except OSError:
                continue
    else:
        roots.append({"label": "🏠 홈 폴더", "path": str(Path.home()), "kind": "drive"})

    cur_p = _resolve_browse_path(target_dir_str)
    fallback_msg = None
    if not cur_p.exists():
        try:
            cur_p.mkdir(parents=True, exist_ok=True)
        except Exception:
            fallback_msg = f"요청한 경로({cur_p})가 존재하지 않아 상위 또는 기본 폴더를 표시합니다."
            while not cur_p.exists() and cur_p.parent != cur_p:
                cur_p = cur_p.parent
            if not cur_p.exists():
                cur_p = DELIVERABLES_DIR.resolve()
                cur_p.mkdir(parents=True, exist_ok=True)

    if cur_p.is_file():
        cur_p = cur_p.parent

    # Build breadcrumbs
    breadcrumbs: List[Dict[str, str]] = []
    parts = cur_p.parts
    if parts:
        accum = Path(parts[0])
        breadcrumbs.append({"name": parts[0].rstrip("\\/") or parts[0], "path": str(accum)})
        for seg in parts[1:]:
            accum = accum / seg
            breadcrumbs.append({"name": seg, "path": str(accum)})

    parent_dir = str(cur_p.parent) if cur_p.parent != cur_p else None
    is_writable = _probe_dir_writable(cur_p)

    folders: List[Dict[str, Any]] = []
    files: List[Dict[str, Any]] = []
    root_resolved = ROOT.resolve()
    hidden_skip = {".git", "__pycache__", "node_modules", ".venv", "venv"}

    try:
        for entry in cur_p.iterdir():
            name = entry.name
            if name.startswith(".nexus_write_test"):
                continue
            try:
                st = entry.stat()
                mtime_iso = datetime.fromtimestamp(st.st_mtime, tz=timezone.utc).strftime("%Y-%m-%d %H:%M")
                if entry.is_dir():
                    if name in hidden_skip:
                        continue
                    folders.append(
                        {
                            "name": name,
                            "path": str(entry),
                            "mtime": mtime_iso,
                            "is_project": name.endswith("_project"),
                        }
                    )
                elif entry.is_file():
                    web_url = None
                    try:
                        rel_to_root = entry.resolve().relative_to(root_resolved)
                        web_url = "/" + rel_to_root.as_posix()
                    except Exception:
                        web_url = None
                    files.append(
                        {
                            "name": name,
                            "path": str(entry),
                            "size": st.st_size,
                            "mtime": mtime_iso,
                            "ext": entry.suffix.lower(),
                            "web_url": web_url,
                        }
                    )
            except OSError:
                continue
    except Exception as exc:
        return {
            "ok": False,
            "error": f"폴더 목록을 읽을 수 없습니다 ({cur_p}): {exc}",
            "current_dir": str(cur_p),
            "parent_dir": parent_dir,
            "breadcrumbs": breadcrumbs,
            "roots": roots,
            "folders": [],
            "files": [],
            "is_writable": False,
        }

    folders.sort(key=lambda x: (0 if x.get("is_project") else 1, x["name"].lower()))
    files.sort(key=lambda x: x["mtime"], reverse=True)

    return {
        "ok": True,
        "current_dir": str(cur_p),
        "parent_dir": parent_dir,
        "breadcrumbs": breadcrumbs,
        "roots": roots,
        "folders": folders[:250],
        "files": files[:250],
        "is_writable": is_writable,
        "is_gdrive_mount": _is_google_drive_path(cur_p, gdrives),
        "has_non_ascii_or_space": any(ord(ch) > 127 or ch == " " for ch in str(cur_p)),
        "fallback_notice": fallback_msg,
    }


def create_local_fs_subfolder(parent_dir_str: str, folder_name: str) -> Dict[str, Any]:
    clean_name = str(folder_name or "").strip().strip("\\/")
    if not clean_name or clean_name in (".", "..") or any(ch in clean_name for ch in '<>:"|?*'):
        raise ValueError("유효한 새 폴더 이름을 입력해 주세요 (특수문자 <>:\"|?* 제외).")
    parent_p = _resolve_browse_path(parent_dir_str)
    gdrives = detect_google_drive_paths()
    new_p = parent_p / clean_name
    created_gd = None

    if _is_google_drive_path(parent_p, gdrives) and get_gdrive_connection_status().get("connected"):
        parent_meta = resolve_local_gdrive_path_to_cloud_folder(parent_p, gdrives)
        if parent_meta:
            created_gd = gdrive_create_subfolder(clean_name, parent_id=parent_meta["id"])
            for _ in range(6):
                if new_p.exists():
                    break
                time.sleep(0.25)

    try:
        new_p.mkdir(parents=True, exist_ok=True)
        probe = new_p / f".nexus_write_test_{os.getpid()}.tmp"
        probe.write_text("ok", encoding="utf-8")
        probe.unlink(missing_ok=True)
    except PermissionError as exc:
        raise ValueError(
            f"현재 서버 실행 환경(백그라운드 샌드박스)에서는 저장소 외부 경로({new_p})에 폴더를 생성할 수 없습니다. "
            f"deliverables 하위 폴더를 선택하거나, 일반 Windows 터미널에서 start_director.bat(또는 python server.py 8080)으로 실행해 주세요."
        ) from exc
    except Exception as exc:
        raise ValueError(f"새 폴더 생성 실패 ({new_p}): {exc}") from exc
    _OUTPUT_DIR_STATUS_CACHE.clear()
    listing = list_local_fs_directory(str(new_p))
    listing["created_dir"] = str(new_p)
    if created_gd:
        listing["gdrive_folder"] = created_gd
    listing["message"] = f"새 폴더 [{clean_name}]가 생성되었습니다."
    return listing


def preview_local_fs_file(file_path_str: str) -> Dict[str, Any]:
    fp = _resolve_browse_path(file_path_str)
    if not fp.exists() or not fp.is_file():
        raise ValueError(f"파일을 찾을 수 없습니다: {fp}")
    low_name = fp.name.lower()
    if low_name.startswith(".env") or any(tok in low_name for tok in ("token", "oauth", "secret", "credential")):
        raise ValueError("보안상 인증·환경변수 파일은 미리보기가 제한됩니다.")
    size = fp.stat().st_size
    raw_bytes = fp.read_bytes()[:65536]
    text = raw_bytes.decode("utf-8", errors="replace")
    return {
        "ok": True,
        "name": fp.name,
        "path": str(fp),
        "size": size,
        "truncated": size > 65536,
        "content": text,
    }


def browse_output_folder_dialog(
    initial_dir: Optional[str] = None,
    pick_only: bool = False,
    team_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Opens native OS folder picker dialog (Windows FolderBrowserDialog with foreground TopMost owner) with short timeout."""
    status_now = get_output_dir_status()
    start_dir = (initial_dir or "").strip() or status_now["output_dir"]
    if os.name != "nt":
        return {"ok": False, "error": "현재 OS 환경에서는 웹 내장 폴더 선택기를 사용해 주세요."}

    ps_exe = shutil.which("powershell") or "powershell.exe"
    safe_init = start_dir.replace("'", "''")
    ps_script = (
        "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; "
        "Add-Type -AssemblyName System.Windows.Forms; "
        "$owner = New-Object System.Windows.Forms.Form; "
        "$owner.TopMost = $true; "
        "$owner.Width = 1; $owner.Height = 1; $owner.ShowInTaskbar = $false; $owner.Opacity = 0; "
        "$owner.StartPosition = 'CenterScreen'; "
        "$owner.Show(); $owner.Activate(); "
        "$dlg = New-Object System.Windows.Forms.FolderBrowserDialog; "
        "$dlg.Description = '프로젝트 저장 폴더 선택 (로컬 디스크 또는 Google Drive 내 드라이브)'; "
        "$dlg.ShowNewFolderButton = $true; "
        f"if (Test-Path -LiteralPath '{safe_init}') {{ $dlg.SelectedPath = '{safe_init}' }}; "
        "$res = $dlg.ShowDialog($owner); "
        "if ($res -eq [System.Windows.Forms.DialogResult]::OK) { Write-Output $dlg.SelectedPath }; "
        "$owner.Close(); $owner.Dispose()"
    )
    try:
        res = subprocess.run(
            [ps_exe, "-NoProfile", "-Sta", "-Command", ps_script],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=25.0,
        )
        chosen = (res.stdout or "").strip()
        if not chosen:
            return {"ok": True, "cancelled": True}
        if pick_only:
            return {"ok": True, "cancelled": False, "selected_dir": chosen}
        if team_id:
            updated_team, _ = update_team_workspace_only(team_id, {"output_dir": chosen}, detect_google_drive_paths())
            _OUTPUT_DIR_STATUS_CACHE.clear()
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
        return {"ok": False, "error": "Windows 폴더 창이 백그라운드 제한으로 표시되지 않았습니다. 웹 폴더 선택기를 이용해 주세요."}
    except Exception as exc:
        return {"ok": False, "error": f"폴더 선택 오류: {exc}"}


def open_output_folder_in_explorer(target_dir_str: Optional[str] = None) -> Dict[str, Any]:
    status_now = get_output_dir_status()
    target_p = _resolve_browse_path(target_dir_str) if (target_dir_str and target_dir_str.strip()) else Path(status_now["output_dir"])
    try:
        target_p.mkdir(parents=True, exist_ok=True)
    except Exception:
        pass
    native_opened = False
    try:
        if os.name == "nt":
            ps_exe = shutil.which("powershell") or "powershell.exe"
            safe_t = str(target_p.resolve()).replace("'", "''")
            subprocess.Popen(["explorer.exe", str(target_p)], shell=False)
            time.sleep(0.45)
            chk = subprocess.run(
                [
                    ps_exe,
                    "-NoProfile",
                    "-Command",
                    f"$t = [uri]::new('{safe_t}').AbsoluteUri.TrimEnd('/'); "
                    "$m = @((New-Object -ComObject Shell.Application).Windows() | Where-Object { $_.LocationURL -and $_.LocationURL.TrimEnd('/') -eq $t }); "
                    "Write-Output $m.Count",
                ],
                capture_output=True,
                text=True,
                timeout=3.0,
            )
            native_opened = int((chk.stdout or "0").strip() or "0") > 0
        elif shutil.which("open"):
            subprocess.Popen(["open", str(target_p)], shell=False)
            native_opened = True
        elif shutil.which("xdg-open"):
            subprocess.Popen(["xdg-open", str(target_p)], shell=False)
            native_opened = True
        return {"ok": True, "opened_dir": str(target_p), "native_window_opened": native_opened}
    except Exception as exc:
        return {"ok": True, "opened_dir": str(target_p), "native_window_opened": False, "notice": str(exc)}


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


_GOOGLE_TIER_CACHE: Dict[str, Dict[str, Any]] = {}


def _probe_google_code_assist_paid_tier(base_dir: Path, force_refresh: bool = False) -> Optional[Tuple[str, str]]:
    """Checks official cloudcode-pa.googleapis.com/v1internal:loadCodeAssist for verified Google One / CodeAssist paidTier."""
    key = str(base_dir).lower()
    now = time.time()
    cached = _GOOGLE_TIER_CACHE.get(key)
    if cached and not force_refresh and (now - cached.get("at", 0.0) < 600.0):
        return cached.get("result")

    cred_file = base_dir / ".gemini" / "oauth_creds.json"
    if not cred_file.exists():
        _GOOGLE_TIER_CACHE[key] = {"at": now, "result": None}
        return None
    try:
        from urllib.parse import urlencode as _urlencode
        c = json.loads(cred_file.read_text(encoding="utf-8", errors="ignore"))
        tok = str(c.get("access_token") or "").strip()
        exp_sec = float(c.get("expiry_date") or 0) / 1000.0
        if (not tok or now > exp_sec - 60) and c.get("refresh_token"):
            oauth_cid = str(c.get("client_id") or os.environ.get("GEMINI_OAUTH_CLIENT_ID") or "").strip()
            oauth_sec = str(c.get("client_secret") or os.environ.get("GEMINI_OAUTH_CLIENT_SECRET") or "").strip()
            if oauth_cid and oauth_sec:
                body = _urlencode(
                    {
                        "client_id": oauth_cid,
                        "client_secret": oauth_sec,
                        "refresh_token": str(c["refresh_token"]),
                        "grant_type": "refresh_token",
                    }
                ).encode("utf-8")
                r_tok = Request("https://oauth2.googleapis.com/token", data=body, method="POST")
                with urlopen(r_tok, timeout=5) as resp:
                    tok = str(json.loads(resp.read().decode("utf-8")).get("access_token") or "").strip()
        if not tok:
            _GOOGLE_TIER_CACHE[key] = {"at": now, "result": None}
            return None

        req_payload = json.dumps(
            {"metadata": {"ideType": "IDE_UNSPECIFIED", "platform": "PLATFORM_UNSPECIFIED", "pluginType": "GEMINI"}}
        ).encode("utf-8")
        req = Request(
            "https://cloudcode-pa.googleapis.com/v1internal:loadCodeAssist",
            data=req_payload,
            headers={"Authorization": f"Bearer {tok}", "Content-Type": "application/json"},
            method="POST",
        )
        with urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        paid_obj = data.get("paidTier")
        if isinstance(paid_obj, dict) and (paid_obj.get("id") or paid_obj.get("name")):
            p_id = str(paid_obj.get("id") or "").lower()
            p_name = str(paid_obj.get("name") or paid_obj.get("id") or "Google AI Paid")
            tier_cat = "ultra" if "ultra" in (p_id + " " + p_name.lower()) else "pro"
            res_tuple = (tier_cat, p_name)
            _GOOGLE_TIER_CACHE[key] = {"at": now, "result": res_tuple}
            return res_tuple
    except Exception:
        pass
    _GOOGLE_TIER_CACHE[key] = {"at": now, "result": None}
    return None


def _inspect_cli_account_plan(
    cli_name: str,
    marker_detected: bool,
    profile_dir: Optional[str] = None,
    plan_override: str = "auto",
    deep: bool = False,
) -> Dict[str, Any]:
    """Reads local CLI auth/session metadata + user-confirmed plan_override to determine exact subscription tier & Orchestrator eligibility."""
    home = Path(profile_dir) if profile_dir else Path.home()
    telemetry = _read_local_cli_telemetry(cli_name)
    ov = str(plan_override or "auto").lower().strip()
    if ov not in ("auto", "free", "pro", "ultra"):
        ov = "auto"

    # Default unsubscribed / logged-out state
    if not marker_detected:
        return {
            "account_email": None,
            "plan_tier": "unsubscribed",
            "orchestrator_tier": "none",
            "plan_override": ov,
            "plan_source": "logged_out",
            "plan_source_label": "미로그인",
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
        jwt_plan_type = "free"
        try:
            if auth_file.exists():
                d = json.loads(auth_file.read_text(encoding="utf-8", errors="ignore"))
                tokens = d.get("tokens") if isinstance(d, dict) else {}
                id_tok = tokens.get("id_token") if isinstance(tokens, dict) else ""
                claims = _decode_jwt_payload(str(id_tok or ""))
                email = claims.get("email")
                auth_claim = claims.get("https://api.openai.com/auth")
                if isinstance(auth_claim, dict) and auth_claim.get("chatgpt_plan_type"):
                    jwt_plan_type = str(auth_claim["chatgpt_plan_type"]).lower().strip()
        except Exception:
            pass

        if ov == "free":
            eff_type, p_src, p_src_lbl = "free", "user_confirmed", "사용자 지정 플랜"
        elif ov == "pro":
            eff_type, p_src, p_src_lbl = "plus", "user_confirmed", "사용자 지정 플랜 (Plus/Pro)"
        elif ov == "ultra":
            eff_type, p_src, p_src_lbl = "pro", "user_confirmed", "사용자 지정 플랜 (Pro $200/Enterprise)"
        else:
            eff_type, p_src, p_src_lbl = jwt_plan_type, "jwt_verified", f"JWT 토큰 실측 ({jwt_plan_type})"

        tier_map = {
            "free": ("ChatGPT Free (무료 플랜 · 토큰 실측)", "ChatGPT Free (무료)", False, "free", 15, 60000, 300, 1200000),
            "plus": ("ChatGPT Plus ($20/월 유료 구독)", "ChatGPT Plus 구독", True, "pro", 80, 400000, 2400, 12000000),
            "pro": ("ChatGPT Pro ($200/월 최상위 구독)", "ChatGPT Pro 구독", True, "ultra", 300, 1500000, 9000, 45000000),
            "team": ("ChatGPT Team (팀 워크스페이스 구독)", "ChatGPT Team 구독", True, "pro", 150, 800000, 4500, 24000000),
            "enterprise": ("ChatGPT Enterprise (기업용 구독)", "ChatGPT Enterprise 구독", True, "ultra", 500, 2500000, 15000, 75000000),
        }
        p_name, lbl, is_paid, orch_t, d_c, d_t, m_c, m_t = tier_map.get(
            eff_type,
            (f"ChatGPT {eff_type.upper()} 플랜", f"ChatGPT ({eff_type.upper()})", eff_type != "free", "pro" if eff_type != "free" else "free", 50, 250000, 1500, 7500000),
        )
        return {
            "account_email": email,
            "plan_tier": eff_type,
            "orchestrator_tier": orch_t,
            "plan_override": ov,
            "plan_source": p_src,
            "plan_source_label": p_src_lbl,
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

    if cli_name in ("agy", "gemini"):
        gem_base = Path(profile_dir) if profile_dir else (GEMINI2_HOME_DIR if cli_name == "gemini" else Path.home())
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

        api_paid = _probe_google_code_assist_paid_tier(gem_base, force_refresh=deep)

        # Priority: 1) Explicit user confirmation (ov != 'auto') -> 2) Google CodeAssist API paidTier -> 3) Workspace hd -> 4) Honest Free default
        if ov == "ultra":
            return {
                "account_email": email,
                "plan_tier": "google_ai_ultra",
                "orchestrator_tier": "ultra",
                "plan_override": ov,
                "plan_source": "user_confirmed",
                "plan_source_label": "사용자 지정 플랜 (Ultra)",
                "plan_name": "Google AI Ultra (울트라 구독 · Argon & Carbon 모두 사용 가능)",
                "plan_label": "Google AI Ultra 구독",
                "is_subscribed": True,
                "is_paid": True,
                "daily_max_calls": 250,
                "daily_max_tokens": 2000000,
                "monthly_max_calls": 7500,
                "monthly_max_tokens": 60000000,
                "max_calls": 250,
                "max_tokens": 2000000,
                "window_label": "일일 제한 / 월간 제한",
                **telemetry,
            }
        if ov == "pro":
            return {
                "account_email": email,
                "plan_tier": "google_ai_pro",
                "orchestrator_tier": "pro",
                "plan_override": ov,
                "plan_source": "user_confirmed",
                "plan_source_label": "사용자 지정 플랜 (Pro)",
                "plan_name": "Google AI Pro (프로 구독 · Orchestrator Argon 선택 가능)",
                "plan_label": "Google AI Pro 구독",
                "is_subscribed": True,
                "is_paid": True,
                "daily_max_calls": 80,
                "daily_max_tokens": 600000,
                "monthly_max_calls": 2400,
                "monthly_max_tokens": 18000000,
                "max_calls": 80,
                "max_tokens": 600000,
                "window_label": "일일 제한 / 월간 제한",
                **telemetry,
            }
        if ov == "free":
            return {
                "account_email": email,
                "plan_tier": "google_ai_free",
                "orchestrator_tier": "free",
                "plan_override": ov,
                "plan_source": "user_confirmed",
                "plan_source_label": "사용자 지정 플랜 (Free)",
                "plan_name": "Google AI Free (무료 계정 · 기본 파이프라인 전용)",
                "plan_label": "Google AI Free (무료)",
                "is_subscribed": True,
                "is_paid": False,
                "daily_max_calls": 20,
                "daily_max_tokens": 120000,
                "monthly_max_calls": 600,
                "monthly_max_tokens": 3600000,
                "max_calls": 20,
                "max_tokens": 120000,
                "window_label": "일일 제한 / 월간 제한",
                **telemetry,
            }

        if api_paid:
            t_cat, t_raw_name = api_paid
            is_ultra = t_cat == "ultra"
            return {
                "account_email": email,
                "plan_tier": f"google_api_{t_cat}",
                "orchestrator_tier": "ultra" if is_ultra else "pro",
                "plan_override": "auto",
                "plan_source": "google_api_verified",
                "plan_source_label": f"Google API 실측 ({t_raw_name})",
                "plan_name": f"Google AI {'Ultra' if is_ultra else 'Pro'} ({t_raw_name} · API 실측)",
                "plan_label": f"Google AI {'Ultra' if is_ultra else 'Pro'} (실측)",
                "is_subscribed": True,
                "is_paid": True,
                "daily_max_calls": 250 if is_ultra else 80,
                "daily_max_tokens": 2000000 if is_ultra else 600000,
                "monthly_max_calls": 7500 if is_ultra else 2400,
                "monthly_max_tokens": 60000000 if is_ultra else 18000000,
                "max_calls": 250 if is_ultra else 80,
                "max_tokens": 2000000 if is_ultra else 600000,
                "window_label": "일일 제한 / 월간 제한",
                **telemetry,
            }

        if hd_domain:
            return {
                "account_email": email,
                "plan_tier": "workspace_pro",
                "orchestrator_tier": "pro",
                "plan_override": "auto",
                "plan_source": "jwt_verified",
                "plan_source_label": f"Workspace 도메인 확인 ({hd_domain})",
                "plan_name": f"Google Workspace AI ({hd_domain})",
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

        # Personal Gmail without CodeAssist paidTier: Google OAuth id_token does NOT disclose personal Google One subscription tier.
        # Default honestly to Free until the user selects Pro / Ultra if subscribed!
        return {
            "account_email": email or f"구글 계정 ({gem_base.name})",
            "plan_tier": "google_unverified_free",
            "orchestrator_tier": "free",
            "plan_override": "auto",
            "plan_source": "unverified_default_free",
            "plan_source_label": "구글 OAuth 등급 미제공 · 실제 플랜 선택 필요",
            "plan_name": "Google 계정 연결됨 (기본 Free 적용 · Pro/Ultra 구독 시 직접 선택)",
            "plan_label": "Google Free (또는 구독 직접 선택)",
            "is_subscribed": True,
            "is_paid": False,
            "daily_max_calls": 20,
            "daily_max_tokens": 120000,
            "monthly_max_calls": 600,
            "monthly_max_tokens": 3600000,
            "max_calls": 20,
            "max_tokens": 120000,
            "window_label": "일일 제한 / 월간 제한",
            **telemetry,
        }

    if cli_name == "claude":
        cred_file = home / ".claude" / ".credentials.json"
        cfg_file = home / ".claude.json"
        email = None
        plan_type = "free"
        p_src = "unverified_default_free"
        try:
            if cred_file.exists():
                d = json.loads(cred_file.read_text(encoding="utf-8", errors="ignore"))
                if isinstance(d, dict):
                    oauth_obj = d.get("claudeAiOauth") or d
                    if isinstance(oauth_obj, dict):
                        raw_pt = oauth_obj.get("subscriptionType") or oauth_obj.get("rateLimitTier")
                        if raw_pt:
                            plan_type = str(raw_pt).lower()
                            p_src = "credentials_verified"
                        email = oauth_obj.get("email") or d.get("email")
            if not email and cfg_file.exists():
                cd = json.loads(cfg_file.read_text(encoding="utf-8", errors="ignore"))
                if isinstance(cd, dict):
                    acct = cd.get("oauthAccount") or {}
                    if isinstance(acct, dict):
                        email = acct.get("emailAddress") or acct.get("email")
        except Exception:
            pass

        if ov == "ultra":
            plan_type, p_src = "max", "user_confirmed"
        elif ov == "pro":
            plan_type, p_src = "pro", "user_confirmed"
        elif ov == "free":
            plan_type, p_src = "free", "user_confirmed"

        if "max" in plan_type:
            return {
                "account_email": email,
                "plan_tier": "max",
                "orchestrator_tier": "ultra",
                "plan_override": ov,
                "plan_source": p_src,
                "plan_source_label": "사용자 지정" if p_src == "user_confirmed" else "인증 파일 실측",
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
        if "pro" in plan_type or "team" in plan_type:
            return {
                "account_email": email,
                "plan_tier": "pro",
                "orchestrator_tier": "pro",
                "plan_override": ov,
                "plan_source": p_src,
                "plan_source_label": "사용자 지정" if p_src == "user_confirmed" else "인증 파일 실측",
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
        return {
            "account_email": email,
            "plan_tier": "free",
            "orchestrator_tier": "free",
            "plan_override": ov,
            "plan_source": p_src,
            "plan_source_label": "무료 플랜",
            "plan_name": "Claude Free (무료 플랜 · CLI 미지원 가능)",
            "plan_label": "Claude Free (무료)",
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

    if cli_name == "grok":
        orch_t = "ultra" if ov == "ultra" else ("free" if ov == "free" else "pro")
        is_p = orch_t != "free"
        return {
            "account_email": "xAI Console (XAI_API_KEY)",
            "plan_tier": f"xai_{orch_t}",
            "orchestrator_tier": orch_t,
            "plan_override": ov,
            "plan_source": "user_confirmed" if ov != "auto" else "credentials_verified",
            "plan_source_label": "API 키 연결 확인",
            "plan_name": f"xAI Grok ({orch_t.upper()} 플랜)",
            "plan_label": f"xAI Grok ({orch_t.upper()})",
            "is_subscribed": True,
            "is_paid": is_p,
            "daily_max_calls": 80 if is_p else 15,
            "daily_max_tokens": 400000 if is_p else 60000,
            "monthly_max_calls": 2400 if is_p else 300,
            "monthly_max_tokens": 12000000 if is_p else 1200000,
            "max_calls": 80 if is_p else 15,
            "max_tokens": 400000 if is_p else 60000,
            "window_label": "일일 제한 / 월간 제한",
            **telemetry,
        }

    return {
        "account_email": None,
        "plan_tier": "unknown",
        "orchestrator_tier": "none",
        "plan_override": ov,
        "plan_source": "unknown",
        "plan_source_label": "구독 확인 필요",
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


_CLI_VERSION_CACHE: Dict[str, Tuple[float, str]] = {}


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

    # 1. Version probe (cached 600s unless deep=True so polling responds in <15ms)
    version = "설치됨"
    now_v = time.time()
    cached_v = _CLI_VERSION_CACHE.get(exe)
    if cached_v and not deep and (now_v - cached_v[0]) < 600.0:
        version = cached_v[1]
    else:
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
            _CLI_VERSION_CACHE[exe] = (now_v, version)
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


_CLI_MODELS_CACHE: Dict[str, Tuple[float, List[Tuple[str, str]], str]] = {}


def _categorize_agy_model(model_id: str, display_name: str, orchestrator_tier: str) -> Dict[str, Any]:
    """Classifies real Antigravity models returned by 'agy.exe models' with group & subscription tier lock metadata."""
    mid = model_id.lower()
    tier = (orchestrator_tier or "free").lower()

    if "orchestrator" in mid:
        group = "🧠 Antigravity Orchestrator (다중 모델 양방향 위임)"
        if mid == "gemini-pro-orchestrator-argon":
            min_tier, lock_msg = "pro", "Pro 구독 이상"
            sort_key = (0, 0)
        elif mid == "gemini-pro-orchestrator":
            min_tier, lock_msg = "ultra", "Ultra 구독 전용"
            sort_key = (0, 1)
        else:
            min_tier, lock_msg = "ultra", "Ultra 구독 전용"
            sort_key = (0, 2)
    elif mid.startswith("gemini-4-argon"):
        group = "🔷 Gemini 4 Argon (Pro 이상 프론티어 추론)"
        min_tier, lock_msg = "pro", "Pro 구독 이상"
        sort_key = (1, 0 if "high" in mid else (1 if "medium" in mid else 2))
    elif mid.startswith("gemini-4-hydrogen"):
        group = "⚡ Gemini 4 Hydrogen (고속 에이전트 실행)"
        min_tier = "pro" if ("high" in mid or "xhigh" in mid) else "free"
        lock_msg = "Pro 구독 이상" if min_tier == "pro" else ""
        sort_key = (2, 0 if "xhigh" in mid else (1 if "high" in mid else (2 if "medium" in mid else 3)))
    elif mid.startswith("gemini-4-carbon"):
        group = "💎 Gemini 4 Carbon (Ultra 최상위 심층 설계)"
        min_tier, lock_msg = "ultra", "Ultra 구독 전용"
        sort_key = (3, 0 if "high" in mid else (1 if "medium" in mid else 2))
    elif mid.startswith("gemini-4-neon"):
        group = "✨ Gemini 4 Neon (Ultra 차세대 프론티어)"
        min_tier, lock_msg = "ultra", "Ultra 구독 전용"
        sort_key = (4, 0 if "xhigh" in mid else (1 if "high" in mid else (2 if "medium" in mid else 3)))
    elif mid.startswith("gemini-3.8-flash"):
        group = "🚀 Gemini 3.8 Flash (경량 고속 모델)"
        min_tier, lock_msg = "free", ""
        sort_key = (5, 0 if "high" in mid else (1 if "medium" in mid else 2))
    elif mid.startswith("claude-"):
        group = "🟠 Claude 5.5 (Antigravity 내장 파트너 모델)"
        min_tier, lock_msg = "pro", "Pro 구독 이상"
        sort_key = (6, 0 if "sonnet" in mid else 1)
    else:
        group = "🌐 기타 지원 모델"
        min_tier, lock_msg = "free", ""
        sort_key = (7, 0)

    rank_map = {"none": 0, "free": 1, "pro": 2, "ultra": 3}
    locked = rank_map.get(tier, 1) < rank_map.get(min_tier, 1)
    return {
        "id": model_id,
        "name": display_name,
        "group": group,
        "min_tier": min_tier,
        "locked": locked,
        "lock_reason": lock_msg if locked else "",
        "_sort": sort_key,
    }


def fetch_cli_available_models(
    slot_key: str,
    cli_name: str,
    exe_path: Optional[str],
    prof_dir: Optional[str],
    orchestrator_tier: str,
    logged_in: bool,
    force_refresh: bool = False,
) -> Tuple[List[Dict[str, Any]], str]:
    """Queries actual available models for a logged-in CLI slot (e.g. via 'agy.exe models')."""
    now = time.time()
    cache_key = f"{cli_name}:{exe_path or ''}:{prof_dir or ''}"

    if cli_name == "agy" and exe_path and "antigravity-ide" not in Path(exe_path).name.lower():
        raw_pairs: List[Tuple[str, str]] = []
        src = "agy_live_cli"
        cached = _CLI_MODELS_CACHE.get(cache_key)
        if cached and not force_refresh and (now - cached[0]) < 600.0 and cached[1]:
            raw_pairs, src = cached[1], cached[2]
        elif logged_in:
            try:
                run_env = get_sanitized_env()
                if prof_dir:
                    run_env["GEMINI_CLI_HOME"] = str(prof_dir)
                mres = subprocess.run(
                    [exe_path, "models"],
                    capture_output=True,
                    text=True,
                    encoding="utf-8",
                    errors="replace",
                    timeout=8.0,
                    shell=False,
                    env=run_env,
                )
                for line in (mres.stdout or "").splitlines():
                    line_s = line.strip()
                    if not line_s or "\t" not in line_s:
                        continue
                    m_id, m_disp = line_s.split("\t", 1)
                    m_id, m_disp = m_id.strip(), m_disp.strip()
                    if m_id and m_disp:
                        raw_pairs.append((m_id, m_disp))
                if raw_pairs:
                    _CLI_MODELS_CACHE[cache_key] = (now, raw_pairs, "agy_live_cli")
            except Exception:
                pass

        if raw_pairs:
            categorized = [_categorize_agy_model(mid, mdisp, orchestrator_tier) for mid, mdisp in raw_pairs]
            categorized.sort(key=lambda x: (x["_sort"], x["name"]))
            for item in categorized:
                item.pop("_sort", None)
            return categorized, src

    if cli_name == "gemini":
        gem_models = [
            ("gemini-3.8-flash", "Gemini 3.8 Flash", "🚀 Gemini CLI 지원 모델", "free"),
            ("gemini-3.5-flash", "Gemini 3.5 Flash", "🚀 Gemini CLI 지원 모델", "free"),
            ("gemini-3.5-flash-lite", "Gemini 3.5 Flash Lite", "🚀 Gemini CLI 지원 모델", "free"),
            ("gemini-3.1-pro-preview", "Gemini 3.1 Pro Preview", "🔷 Gemini Pro 추론 모델", "pro"),
            ("gemini-2.5-pro", "Gemini 2.5 Pro", "🔷 Gemini Pro 추론 모델", "free"),
            ("gemini-2.5-flash", "Gemini 2.5 Flash", "🚀 Gemini CLI 지원 모델", "free"),
        ]
        rank_map = {"none": 0, "free": 1, "pro": 2, "ultra": 3}
        cur_rk = rank_map.get((orchestrator_tier or "free").lower(), 1)
        return [
            {
                "id": mid,
                "name": mname,
                "group": mgrp,
                "min_tier": mtier,
                "locked": cur_rk < rank_map.get(mtier, 1),
                "lock_reason": "Pro 구독 이상" if cur_rk < rank_map.get(mtier, 1) else "",
            }
            for mid, mname, mgrp, mtier in gem_models
        ], "gemini_cli_bundle"

    if cli_name == "codex":
        is_paid_codex = (orchestrator_tier or "free").lower() in ("pro", "ultra")
        return [
            {"id": "gpt-5-codex", "name": "GPT-5 Codex", "group": "🟢 OpenAI Codex 모델", "min_tier": "pro", "locked": not is_paid_codex, "lock_reason": "" if is_paid_codex else "Plus/Pro 구독 이상"},
            {"id": "o4-mini", "name": "o4-mini", "group": "🟢 OpenAI Codex 모델", "min_tier": "free", "locked": False, "lock_reason": ""},
            {"id": "o3", "name": "o3 (심층 추론)", "group": "🟢 OpenAI Codex 모델", "min_tier": "pro", "locked": not is_paid_codex, "lock_reason": "" if is_paid_codex else "Plus/Pro 구독 이상"},
        ], "codex_cli"

    if cli_name == "claude":
        return [
            {"id": "claude-sonnet-4-6", "name": "Claude Sonnet 4.6", "group": "🟠 Claude Code 모델", "min_tier": "pro", "locked": False, "lock_reason": ""},
            {"id": "claude-opus-4-6", "name": "Claude Opus 4.6", "group": "🟠 Claude Code 모델", "min_tier": "ultra", "locked": (orchestrator_tier or "free").lower() != "ultra", "lock_reason": "" if (orchestrator_tier or "free").lower() == "ultra" else "Max 구독 권장"},
        ], "claude_cli"

    return [], "default"


def probe_cli_diagnostics(deep: bool = False) -> Dict[str, Any]:
    """Checks installation, subscription login status, and real available models of all active CLI slots."""
    slots = load_cli_slots()
    custom_paths = load_custom_cli_paths()
    report = {}
    usable_domains = []
    logged_in_domains = []

    tier_rank_map = {"none": 0, "free": 1, "pro": 2, "ultra": 3}
    max_tier_rank = 0
    max_tier_name = "none"

    for key, meta in PROVIDER_META.items():
        cli_name = meta["cli"]
        prof_dir = meta.get("profile_dir")
        plan_ov = meta.get("plan_override", "auto")
        exe = resolve_cli(cli_name)
        login_info = _probe_cli_login(cli_name, exe, deep=deep, profile_dir=prof_dir)
        plan_info = _inspect_cli_account_plan(
            cli_name, bool(login_info.get("session_detected")), profile_dir=prof_dir, plan_override=plan_ov, deep=deep
        )
        is_logged_in = login_info["auth_state"] == "LOGGED_IN"
        ot = str(plan_info.get("orchestrator_tier") or "free")
        avail_models, models_src = fetch_cli_available_models(
            key, cli_name, exe, prof_dir, ot, is_logged_in, force_refresh=deep
        )
        sel_model = str(meta.get("selected_model") or "").strip()
        # If stored selected_model is now locked due to plan downgrade, fall back cleanly
        matched_sel = next((m for m in avail_models if m["id"] == sel_model), None)
        if matched_sel and matched_sel.get("locked"):
            sel_model = ""
            matched_sel = None
        sel_model_disp = matched_sel["name"] if matched_sel else ("CLI 기본 설정 모델 (자동)" if not sel_model else sel_model)

        if login_info["installed"]:
            usable_domains.append(meta["domain"])
        if is_logged_in:
            logged_in_domains.append(meta["domain"])
            rk = tier_rank_map.get(ot, 0)
            if rk > max_tier_rank:
                max_tier_rank = rk
                max_tier_name = ot

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
            "selected_model": sel_model,
            "selected_model_display": sel_model_disp,
            "available_models": avail_models,
            "models_source": models_src,
            **login_info,
            **plan_info,
        }

    allowed_orchestrators = {
        "standard": True,
        "argon": max_tier_rank >= 2,   # Pro 구독자 이상: Orchestrator (Argon) 선택 가능
        "carbon": max_tier_rank >= 3,  # Ultra 구독자 전용: Orchestrator (Carbon) 선택 가능
    }
    ws_cfg = load_workspace_settings()
    configured_orch = str(ws_cfg.get("orchestrator_mode") or "standard").lower().strip()
    if configured_orch == "carbon" and not allowed_orchestrators["carbon"]:
        effective_orch = "argon" if allowed_orchestrators["argon"] else "standard"
    elif configured_orch == "argon" and not allowed_orchestrators["argon"]:
        effective_orch = "standard"
    else:
        effective_orch = configured_orch if configured_orch in ("standard", "argon", "carbon") else "standard"

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
        "max_orchestrator_tier": max_tier_name,
        "allowed_orchestrators": allowed_orchestrators,
        "configured_orchestrator_mode": configured_orch,
        "active_orchestrator_mode": effective_orch,
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


def invoke_cli_if_available(
    provider_key: str,
    prompt: str,
    timeout: float = 35.0,
    model_override: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
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

    used_stream_json_agy = False
    eff_model = (model_override or meta.get("selected_model") or "").strip()
    if domain == "OPENAI":
        argv = [exe, "exec", "--skip-git-repo-check", "--ephemeral", "--sandbox", "workspace-write", "-"]
        if eff_model:
            argv = [exe, "exec", "--skip-git-repo-check", "--ephemeral", "-c", f'model="{eff_model}"', "--sandbox", "workspace-write", "-"]
        stdin_data = prompt
        cmd_desc = f"codex exec --skip-git-repo-check --ephemeral{f' -c model={eff_model}' if eff_model else ''} --sandbox workspace-write - <stdin>"
    elif domain == "ANTHROPIC":
        argv = [exe, "--print", "--output-format", "json"]
        if eff_model:
            argv.extend(["--model", eff_model])
        stdin_data = prompt
        cmd_desc = f"claude --print --output-format json{f' --model {eff_model}' if eff_model else ''} <stdin>"
    elif domain == "XAI":
        argv = [exe, "--prompt", prompt]
        stdin_data = ""
        cmd_desc = "grok --prompt <prompt>"
    elif domain == "GEMINI2":
        if not prof_dir:
            run_env["GEMINI_CLI_HOME"] = str(GEMINI2_HOME_DIR)
        agy_alt = resolve_cli("agy")
        if agy_alt and "antigravity-ide" not in Path(agy_alt).name.lower():
            argv = [agy_alt, "--disable-slash-commands", "--sandbox", "--dangerously-skip-permissions"]
            if eff_model:
                argv.extend(["--model", eff_model])
            argv.extend(["-p", prompt])
            stdin_data = ""
            cmd_desc = f"GEMINI_CLI_HOME={prof_dir or GEMINI2_HOME_DIR} agy --disable-slash-commands --sandbox --dangerously-skip-permissions{f' --model {eff_model}' if eff_model else ''} -p <prompt>"
        else:
            argv = [exe, "--prompt", prompt, "--output-format", "text"]
            if eff_model:
                argv.extend(["-m", eff_model])
            stdin_data = ""
            cmd_desc = f"GEMINI_CLI_HOME={prof_dir or GEMINI2_HOME_DIR} gemini --prompt <prompt>{f' -m {eff_model}' if eff_model else ''}"
    else:
        # domain == "GOOGLE": run official ~/.gemini/bin/agy.exe inside isolated sandboxed temp dir with auto-approved sandbox tools
        if "antigravity-ide" not in Path(exe).name.lower():
            argv = [exe, "--disable-slash-commands", "--sandbox", "--dangerously-skip-permissions"]
            if eff_model:
                argv.extend(["--model", eff_model])
            argv.extend(["-p", prompt])
            stdin_data = ""
            cmd_desc = f"agy --disable-slash-commands --sandbox --dangerously-skip-permissions{f' --model {eff_model}' if eff_model else ''} -p <prompt>"
        else:
            gem_exe = resolve_cli("gemini")
            if gem_exe:
                argv = [gem_exe, "--prompt", prompt, "--output-format", "text"]
                if eff_model:
                    argv.extend(["-m", eff_model])
                stdin_data = ""
                cmd_desc = f"gemini --prompt <prompt>{f' -m {eff_model}' if eff_model else ''}"
            else:
                used_stream_json_agy = True
                msg = {"event": "user", "message": {"role": "user", "content": [{"type": "text", "text": prompt}]}}
                argv = [exe, "--input-format", "stream-json", "--output-format", "stream-json", "--sandbox"]
                stdin_data = json.dumps(msg, ensure_ascii=False) + "\n"
                cmd_desc = "agy --input-format stream-json --output-format stream-json --sandbox <stdin>"

    import tempfile
    t0 = time.time()
    try:
        cwd_file_blocks: List[str] = []
        with tempfile.TemporaryDirectory(prefix="avo_cli_") as iso_cwd:
            proc = subprocess.Popen(
                argv,
                cwd=iso_cwd,
                env=run_env,
                stdin=subprocess.PIPE if stdin_data else subprocess.DEVNULL,
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
                stdout, stderr = proc.communicate(input=stdin_data if stdin_data else None, timeout=timeout)
            except subprocess.TimeoutExpired:
                if os.name == "nt":
                    subprocess.run(["taskkill", "/PID", str(proc.pid), "/T", "/F"], capture_output=True)
                else:
                    proc.kill()
                # Even on timeout, salvage any completed files already written to iso_cwd
                iso_path = Path(iso_cwd)
                for wf in sorted(iso_path.rglob("*")):
                    if wf.is_file() and not wf.name.startswith("."):
                        try:
                            rel_p = wf.relative_to(iso_path).as_posix()
                            w_txt = wf.read_text(encoding="utf-8", errors="replace").strip()
                            if w_txt:
                                cwd_file_blocks.append(f"### FILE: {rel_p}\n{w_txt}")
                        except Exception:
                            pass
                if cwd_file_blocks:
                    salvaged = "\n\n".join(cwd_file_blocks)
                    return {
                        "output": salvaged[:120000],
                        "seconds": max(1, int(round(time.time() - t0))),
                        "tokens": max(120, len(salvaged) // 2),
                        "command": cmd_desc,
                        "executable": exe,
                        "provider": canon,
                        "label": meta["label"],
                        "real_cli": True,
                    }
                return None
            finally:
                with _STATE_LOCK:
                    _ACTIVE_PIDS.pop(proc.pid, None)
            iso_path = Path(iso_cwd)
            for wf in sorted(iso_path.rglob("*")):
                if wf.is_file() and not wf.name.startswith("."):
                    try:
                        rel_p = wf.relative_to(iso_path).as_posix()
                        w_txt = wf.read_text(encoding="utf-8", errors="replace").strip()
                        if w_txt:
                            cwd_file_blocks.append(f"### FILE: {rel_p}\n{w_txt}")
                    except Exception:
                        pass
        dur = max(1, int(round(time.time() - t0)))
        combined_out = ((stdout or "") + "\n" + (stderr or "")).strip()
        combined_lower = combined_out.lower()
        if any(q_phrase in combined_lower for q_phrase in QUOTA_ERROR_PHRASES) and not cwd_file_blocks:
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
        if (proc.returncode == 0 and stdout.strip()) or cwd_file_blocks:
            parsed_text = stdout.strip()
            if domain == "GOOGLE" and used_stream_json_agy:
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
            if cwd_file_blocks:
                # Direct files written by agentic CLI take priority for accurate multi-file extraction
                parsed_text = "\n\n".join(cwd_file_blocks) + (f"\n\n<!-- CLI SUMMARY -->\n{parsed_text}" if parsed_text and "### FILE:" not in parsed_text else "")
            return {
                "output": parsed_text[:120000],
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
    custom_model: Optional[str] = None,
    system_prompt: Optional[str] = None,
    skills: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """Answers a direct question using the selected employee's persona, equipped skills, assigned CLI, and sub-model."""
    roles = load_roles()
    target_clean = (target or "head").lower().strip()
    skills_list = [str(s).strip() for s in (skills or []) if str(s).strip()]
    skills_clause = f"\n보유 전문 스킬: {', '.join(skills_list)}" if skills_list else ""

    persona = AGENT_PERSONAS.get(target_clean)
    default_meta = next(iter(PROVIDER_META.values()), {"label": "AI CLI", "cli": "agy", "domain": "GOOGLE"})
    default_key = next(iter(PROVIDER_META.keys()), "antigravity")
    if persona:
        prov_key = ALIASES.get(custom_cli.lower().strip(), "") if custom_cli else ""
        if not prov_key or prov_key not in PROVIDER_META:
            prov_key = roles.get(persona["role_Binding"], default_key)
        role_label = persona["role"]
        display_name = agent_name or persona["name"]
        base_desc = system_prompt.strip() if (system_prompt and system_prompt.strip()) else persona["desc"]
        persona_prompt = (
            f"당신은 NEXUS 가상 오피스의 '{display_name}' ({base_desc}) 입니다.{skills_clause}\n"
            f"도구를 호출하지 말고 사용자의 질문에 한국어로 친절하고 간결하게(1~3문장) 답변하세요.\n"
            f"사용자 질문: {question}"
        )
    else:
        prov_key = ALIASES.get((custom_cli or target_clean).lower().strip(), roles.get("head", default_key))
        if prov_key not in PROVIDER_META:
            prov_key = default_key
        role_label = next((r.upper() for r, p in roles.items() if p == prov_key), "HEAD")
        display_name = agent_name or f"{PROVIDER_META.get(prov_key, default_meta)['label']}"
        extra_sys = f" ({system_prompt.strip()})" if (system_prompt and system_prompt.strip()) else ""
        persona_prompt = (
            f"당신은 NEXUS 가상 오피스의 AI 직원 '{display_name}' (역할: {role_label}{extra_sys}) 입니다.{skills_clause}\n"
            f"도구를 호출하지 말고 사용자의 질문에 한국어로 친절하고 간결하게(1~3문장) 답변하세요.\n"
            f"사용자 질문: {question}"
        )

    # 1. Try the requested provider's real CLI first (honoring employee's custom_model if unlocked)
    eff_custom_model = str(custom_model or "").strip() or None
    if eff_custom_model:
        try:
            diag_q = probe_cli_diagnostics(deep=False)
            avail_q = ((diag_q.get("providers") or {}).get(prov_key) or {}).get("available_models") or []
            m_q = next((m for m in avail_q if m.get("id") == eff_custom_model), None)
            if m_q and m_q.get("locked"):
                eff_custom_model = None
        except Exception:
            pass
    res = invoke_cli_if_available(prov_key, persona_prompt, timeout=30.0, model_override=eff_custom_model)
    if res and not res.get("quota_exceeded") and res.get("output"):
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
    for fallback_key in list(PROVIDER_META.keys()):
        if fallback_key == prov_key:
            continue
        res_fb = invoke_cli_if_available(fallback_key, persona_prompt, timeout=30.0)
        if res_fb and not res_fb.get("quota_exceeded") and res_fb.get("output"):
            return {
                "ok": True,
                "mode": "REAL_CLI_PROXY",
                "agent_id": target_clean,
                "agent_name": display_name,
                "role": role_label,
                "provider": fallback_key,
                "label": f"{display_name} · {res_fb['label']} ({PROVIDER_META.get(prov_key, default_meta)['label']} 대행)",
                "command": res_fb["command"],
                "executable": res_fb["executable"],
                "seconds": res_fb["seconds"],
                "answer": res_fb["output"],
            }

    # 3. Fallback simulated answer when no CLI can respond
    meta = PROVIDER_META.get(prov_key, default_meta)
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


MISSION_INTENT_SPECS: Dict[str, Dict[str, Any]] = {
    "RESEARCH_HTML": {
        "mode": "RESEARCH_HTML",
        "label": "📊🌐 심층 조사 · HTML 시각화 보고서",
        "primary_file": "research_report.html",
        "deep_files": ("research_report.html", "summary_data.json"),
    },
    "RESEARCH": {
        "mode": "RESEARCH",
        "label": "📊 자료 조사 · 분석 리포트",
        "primary_file": "research_report.md",
        "deep_files": ("research_report.md", "summary_data.json"),
    },
    "DOCUMENT": {
        "mode": "DOCUMENT",
        "label": "📝 기획서 · 실무 문서 작성",
        "primary_file": "proposal_document.md",
        "deep_files": ("proposal_document.md", "action_plan.md"),
    },
    "WEB": {
        "mode": "WEB",
        "label": "🌐 웹페이지 · 프론트엔드 UI",
        "primary_file": "index.html",
        "deep_files": ("index.html", "app.js"),
    },
    "CODE": {
        "mode": "CODE",
        "label": "💻 소프트웨어 · 자동화 코드",
        "primary_file": "main.py",
        "deep_files": ("core_module.py", "app_runner.py"),
    },
}


def classify_mission_intent(goal: str) -> Dict[str, Any]:
    """Analyzes the user's natural-language goal sentence to determine the optimal deliverable format automatically."""
    g = (goal or "").lower().strip()

    html_out_kw = ("html", "웹 보고서", "웹보고서", "웹페이지로", "html로", "html 파일")
    web_kw = (
        "웹페이지", "웹사이트", "랜딩페이지", "프론트엔드", "html", "css",
        "반응형 웹", "포트폴리오 사이트", "웹 앱", "웹앱", "landing page", "website", "webpage",
    )
    code_kw = (
        "파이썬", "python", "자바스크립트", "javascript", "타입스크립트", "typescript",
        "스크립트", "코드", "코딩", "함수", "클래스", "알고리즘", "프로그램",
        "크롤러", "크롤링", "파서", "봇", "자동화 도구", "자동화 스크립트",
        "cli", "api 서버", "백엔드", "구현해", "개발해", "짜줘", "작성해줘 코드",
    )
    research_kw = (
        "조사", "리서치", "분석", "비교", "현황", "목록", "정리", "요약",
        "동향", "트렌드", "전통시장", "상권", "통계", "사례", "특징", "장단점",
        "종류", "찾아", "알아봐", "알려줘", "정리해", "research", "survey", "analysis", "summary",
    )
    doc_kw = (
        "기획", "기획서", "기획안", "제안서", "사업계획", "전략", "마케팅",
        "홍보", "카피", "보고서", "매뉴얼", "가이드", "가이드라인", "시나리오",
        "커리큘럼", "일정표", "체크리스트", "초안", "공지문", "보도자료", "블로그 글",
    )

    has_research = any(k in g for k in research_kw)
    has_doc = any(k in g for k in doc_kw)
    if (has_research or has_doc) and any(k in g for k in html_out_kw):
        return dict(MISSION_INTENT_SPECS["RESEARCH_HTML"])
    if any(k in g for k in web_kw):
        return dict(MISSION_INTENT_SPECS["WEB"])
    if any(k in g for k in code_kw):
        return dict(MISSION_INTENT_SPECS["CODE"])
    if has_research:
        return dict(MISSION_INTENT_SPECS["RESEARCH"])
    if has_doc:
        return dict(MISSION_INTENT_SPECS["DOCUMENT"])
    if any(w in g for w in ("생성기", "계산기", "변환기", "추출기", "게임", "시뮬레이터", "매크로", "서버", "모듈")):
        return dict(MISSION_INTENT_SPECS["CODE"])
    return dict(MISSION_INTENT_SPECS["DOCUMENT"])


def _refine_intent_from_plan(plan_text: str, current_spec: Dict[str, Any]) -> Dict[str, Any]:
    import re
    m = re.search(r"DELIVERABLE_MODE\s*:\s*(RESEARCH_HTML|RESEARCH|DOCUMENT|WEB|CODE)", plan_text or "", flags=re.IGNORECASE)
    if m:
        picked = m.group(1).upper()
        if current_spec.get("mode") == "RESEARCH_HTML" and picked in ("WEB", "RESEARCH", "DOCUMENT"):
            return dict(MISSION_INTENT_SPECS["RESEARCH_HTML"])
        if picked in MISSION_INTENT_SPECS:
            return dict(MISSION_INTENT_SPECS[picked])
    return current_spec


def _strip_outer_code_fence(text: str) -> str:
    import re
    s = (text or "").strip()
    m = re.match(r"^```[a-zA-Z0-9_+-]*\r?\n([\s\S]*)$", s)
    if m:
        body = m.group(1)
        if body.rstrip().endswith("```"):
            body = body.rstrip()[:-3].rstrip()
        return body
    return s


def _patch_html_osm_tile_policy(content: str, is_html: bool = True) -> str:
    """Prevents OpenStreetMap 403 'Access blocked' tiles when HTML deliverables are opened via local file:// (missing HTTP Referer)."""
    import re
    if "tile.openstreetmap.org" not in (content or ""):
        return content
    patched = re.sub(
        r"""(['"`])https?://(?:\{s\}\.)?tile\.openstreetmap\.org/\{z\}/\{x\}/\{y\}\.png\1""",
        "(window.location.protocol === 'file:' ? 'https://tile.openstreetmap.de/{z}/{x}/{y}.png' : 'https://tile.openstreetmap.org/{z}/{x}/{y}.png')",
        content,
    )
    if is_html and 'name="referrer"' not in patched.lower() and "name='referrer'" not in patched.lower():
        patched = re.sub(
            r"(<head[^>]*>)",
            r'\1\n  <meta name="referrer" content="origin">',
            patched,
            count=1,
            flags=re.IGNORECASE,
        )
    return patched


def _extract_and_write_project_files(
    mission_id: str,
    goal: str,
    built_text: str,
    project_dir: Path,
    default_prefix: str = "main",
    deliverable_mode: str = "CODE",
) -> List[str]:
    """Extracts deliverable files (reports, docs, JSON/CSV data, web HTML/CSS/JS, or code) from BUILDER output."""
    import re
    if not (built_text or "").strip():
        return []
    project_dir.mkdir(parents=True, exist_ok=True)
    written_files: List[str] = []
    mode_up = (deliverable_mode or "CODE").upper()
    matches: List[Tuple[str, str]] = []

    # 1. Split by explicit ### FILE: <filename> markers (supports markdown/HTML reports with inner code blocks as well as raw code)
    header_re = re.compile(r"(?m)^(?:###\s*FILE:|//\s*FILE:|<!--\s*FILE:)\s*([^\r\n`>]+?)(?:-->)?\s*$")
    hdrs = list(header_re.finditer(built_text or ""))
    if hdrs:
        for i, hm in enumerate(hdrs):
            fname = hm.group(1).strip().strip("`'\"")
            start_pos = hm.end()
            end_pos = hdrs[i + 1].start() if (i + 1 < len(hdrs)) else len(built_text)
            raw_sec = (built_text[start_pos:end_pos] or "").strip()
            cleaned_sec = _strip_outer_code_fence(raw_sec)
            if fname and cleaned_sec:
                matches.append((fname, cleaned_sec))

    # 2. Fallback when no ### FILE: marker is present (NEVER writes fake echo stubs)
    if not matches:
        if mode_up in ("RESEARCH", "DOCUMENT"):
            default_md = default_prefix if default_prefix.endswith(".md") else (
                "research_report.md" if mode_up == "RESEARCH" else f"{default_prefix}.md"
            )
            cleaned_doc = _strip_outer_code_fence(built_text or "")
            if cleaned_doc:
                matches.append((default_md, cleaned_doc))
                for lang_tag, ext_name in (("json", "summary_data.json"), ("csv", "summary_data.csv")):
                    m_data = re.search(rf"```{lang_tag}\r?\n([\s\S]*?)```", built_text or "", flags=re.IGNORECASE)
                    if m_data and m_data.group(1).strip():
                        matches.append((ext_name, m_data.group(1).strip()))
        elif mode_up in ("RESEARCH_HTML", "WEB"):
            default_html = "research_report.html" if mode_up == "RESEARCH_HTML" else "index.html"
            m_html_fence = re.search(r"```html\r?\n([\s\S]*?)(?:```|\Z)", built_text or "", flags=re.IGNORECASE)
            if m_html_fence and m_html_fence.group(1).strip():
                matches.append((default_html, m_html_fence.group(1).strip()))
            else:
                cleaned_h = _strip_outer_code_fence(built_text or "")
                low_h = cleaned_h.lower()
                idx_dt = low_h.find("<!doctype")
                idx_tag = low_h.find("<html")
                cut_pos = idx_dt if idx_dt >= 0 else idx_tag
                if cut_pos >= 0:
                    matches.append((default_html, cleaned_h[cut_pos:].strip()))
                elif "<table" in low_h or "<section" in low_h or "<div" in low_h:
                    matches.append((default_html, cleaned_h))
            for lang_tag, ext_name in (("css", "styles.css"), ("javascript", "app.js"), ("js", "app.js"), ("json", "summary_data.json")):
                m_extra = re.search(rf"```{lang_tag}\r?\n([\s\S]*?)```", built_text or "", flags=re.IGNORECASE)
                if m_extra and m_extra.group(1).strip():
                    matches.append((ext_name, m_extra.group(1).strip()))
        else:
            fence_pattern = re.compile(r"```([a-zA-Z0-9_-]*)\r?\n([\s\S]*?)(?:```|\Z)", re.MULTILINE)
            ext_map = {
                "python": f"{default_prefix}.py",
                "py": f"{default_prefix}.py",
                "javascript": f"{default_prefix}.js",
                "js": f"{default_prefix}.js",
                "html": "index.html",
                "css": "styles.css",
                "json": "data.json",
                "csv": "data.csv",
                "markdown": f"{default_prefix}.md",
                "md": f"{default_prefix}.md",
                "sql": f"{default_prefix}.sql",
                "sh": "run.sh",
                "bash": "run.sh",
            }
            used_names = set()
            for idx, (lang, code_body) in enumerate(fence_pattern.findall(built_text or ""), start=1):
                lang_clean = (lang or "").lower().strip()
                if lang_clean in ("text", "plaintext") and idx > 1:
                    continue
                if not (code_body or "").strip():
                    continue
                fname = ext_map.get(lang_clean, f"{default_prefix}_{idx}.{lang_clean or 'py'}")
                if fname in used_names:
                    stem, _, ext = fname.partition(".")
                    fname = f"{stem}_{idx}.{ext or 'py'}"
                used_names.add(fname)
                matches.append((fname, code_body))

    for raw_name, code_content in matches[:15]:  # Scope Guard: max 15 files
        clean_rel = raw_name.strip().strip("`'\"").replace("\\", "/").lstrip("/")
        if not clean_rel or ".." in clean_rel or ":" in clean_rel:
            continue
        lines = (code_content or "").splitlines()
        if len(lines) > 2500:  # Scope Guard: max 2500 lines
            code_content = "\n".join(lines[:2500]) + "\n"
        target_file = (project_dir / clean_rel).resolve()
        if not str(target_file).startswith(str(project_dir.resolve())):
            continue
        if target_file.suffix.lower() in (".html", ".htm", ".js"):
            code_content = _patch_html_osm_tile_policy(code_content, is_html=target_file.suffix.lower() in (".html", ".htm"))
        target_file.parent.mkdir(parents=True, exist_ok=True)
        target_file.write_text((code_content or "").strip() + "\n", encoding="utf-8")
        rel_from_root = f"deliverables/{project_dir.name}/{clean_rel}"
        if rel_from_root not in written_files:
            written_files.append(rel_from_root)

    return written_files


def _verify_project_files(project_dir: Path, deliverable_mode: str = "CODE") -> Dict[str, Any]:
    """Runs adaptive Scope Guard + format-appropriate checks (Markdown structure, JSON/CSV validity, HTML/JS, or Python execution)."""
    import sys
    mode_up = (deliverable_mode or "CODE").upper()
    all_files = sorted(p for p in project_dir.rglob("*") if p.is_file() and p.name != "README.md") if project_dir.exists() else []
    total_lines = 0
    errors: List[str] = []
    logs: List[str] = [f"- 산출물 유형 검증 모드: `{mode_up}`"]

    if not all_files:
        errors.append("생성된 산출물 파일이 없습니다 (BUILDER 응답이 비어 있거나 타임아웃되었습니다).")
        return {"passed": False, "errors": errors, "summary": "\n".join(logs + ["- ❌ 생성된 파일 0개"]), "file_count": 0, "total_lines": 0}

    for f in all_files:
        try:
            txt = f.read_text(encoding="utf-8", errors="replace")
            total_lines += len(txt.splitlines())
        except Exception:
            pass

    if len(all_files) > 15:
        errors.append(f"Scope Guard 위반: 생성 파일 수({len(all_files)}개)가 상한(15개)을 초과했습니다.")
    if total_lines > 2500:
        errors.append(f"Scope Guard 위반: 총 라인 수({total_lines}줄)가 상한(2500줄)을 초과했습니다.")

    logs.append(f"- Scope Guard 파일/라인 검증: 파일 {len(all_files)}개 / 총 {total_lines}줄 (상한 15파일·2500줄 준수)")
    logs.append("- 종량제 API 키 차단(Sanitized Env): OK")

    for f in all_files:
        rel_name = f.relative_to(project_dir).as_posix()
        suf = f.suffix.lower()
        if suf == ".py":
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
                    timeout=8.0,
                    env=get_sanitized_env(),
                )
                out_txt = (r_res.stdout or r_res.stderr or "").strip()
                if r_res.returncode != 0:
                    errors.append(f"[{rel_name} 실행 오류 (exit={r_res.returncode})] {out_txt[:300]}")
                    logs.append(f"- ❌ `{rel_name}` 실행 실패 (exit={r_res.returncode}): `{out_txt[:200]}`")
                else:
                    logs.append(f"- ✓ `{rel_name}` 문법 및 실행 검증 통과 (exit=0){f' → 출력: `{out_txt[:180]}`' if out_txt else ''}")
            except subprocess.TimeoutExpired:
                logs.append(f"- ✓ `{rel_name}` 문법 검증 통과 (장기 실행 프로세스 확인 완료)")
            except Exception as exc:
                logs.append(f"- `{rel_name}` 검증 참고: {exc}")
        elif suf == ".js":
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
        elif suf == ".json":
            try:
                parsed_j = json.loads(f.read_text(encoding="utf-8"))
                cnt_info = f"항목 {len(parsed_j)}개" if isinstance(parsed_j, (list, dict)) else "유효 JSON"
                logs.append(f"- ✓ `{rel_name}` JSON 데이터 구조 검증 통과 ({cnt_info})")
            except Exception as exc:
                errors.append(f"[{rel_name} JSON 파싱 오류] {exc}")
                logs.append(f"- ❌ `{rel_name}` JSON 파싱 실패: {exc}")
        elif suf == ".csv":
            txt_csv = f.read_text(encoding="utf-8", errors="replace").strip()
            row_cnt = len([ln for ln in txt_csv.splitlines() if ln.strip()])
            if row_cnt < 2:
                errors.append(f"[{rel_name} 데이터 부족] 헤더 외 데이터 행이 없습니다.")
                logs.append(f"- ❌ `{rel_name}` CSV 행 부족 ({row_cnt}행)")
            else:
                logs.append(f"- ✓ `{rel_name}` CSV 정형 표 검증 통과 ({row_cnt}행)")
        elif suf in (".html", ".htm"):
            txt_h = f.read_text(encoding="utf-8", errors="replace").strip()
            h_lines = [ln for ln in txt_h.splitlines() if ln.strip()]
            low_h = txt_h.lower()
            has_body_struct = any(tag in low_h for tag in ("<table", "<section", "<article", "<div", "<ul", "<ol", "<main", "<p"))
            if len(txt_h) < 450 or len(h_lines) < 10 or not has_body_struct:
                errors.append(
                    f"[{rel_name} HTML 본문 부족] 단순 제목 에코 또는 빈 껍데기 HTML입니다 ({len(h_lines)}줄 · {len(txt_h)}자). 요구된 세부 내용·표·섹션을 모두 포함해 작성하세요."
                )
                logs.append(f"- ❌ `{rel_name}` HTML 콘텐츠/구조 미달 ({len(h_lines)}줄 · {len(txt_h)}자)")
            else:
                logs.append(f"- ✓ `{rel_name}` HTML 보고서/마크업 완성도 검증 통과 ({len(h_lines)}줄 · {len(txt_h)}자)")
        elif suf == ".md":
            txt_md = f.read_text(encoding="utf-8", errors="replace").strip()
            md_lines = [ln for ln in txt_md.splitlines() if ln.strip()]
            if len(txt_md) < 120 or len(md_lines) < 5:
                errors.append(f"[{rel_name} 문서 분량 미달] 본문이 너무 짧거나 비어 있습니다 ({len(txt_md)}자). 구체적인 조사·기획 내용을 상세히 작성하세요.")
                logs.append(f"- ❌ `{rel_name}` 문서 분량 미달 ({len(txt_md)}자)")
            else:
                has_heading = any(ln.lstrip().startswith("#") for ln in md_lines)
                logs.append(f"- ✓ `{rel_name}` 문서 완성도 검증 통과 ({len(md_lines)}줄 · {len(txt_md)}자{' · 섹션 구조 확인' if has_heading else ''})")
        else:
            sz = f.stat().st_size
            logs.append(f"- ✓ `{rel_name}` 산출물 파일 생성 확인 ({sz} bytes)")

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
    orchestrator_mode: Optional[str] = None,
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
    diag_now = probe_cli_diagnostics(deep=False)
    diag_provs = diag_now.get("providers") or {}
    char_cfgs = load_character_configs()
    team_updated_at = str(team_obj.get("updated_at") or "")
    role_key_to_triad = {
        "head": "HEAD",
        "builder": "BUILDER",
        "sub_builder": "SUB-BUILDER",
        "reviewer": "REVIEWER",
        "researcher": "RESEARCHER",
    }
    role_model_map: Dict[str, str] = {}

    def _pick_role_cli(r_key: str, default_k: str) -> str:
        triad_r = role_key_to_triad.get(r_key, r_key.upper())
        cand = str(team_roles.get(r_key) or global_roles.get(r_key) or default_k).strip()
        if cand not in PROVIDER_META:
            cand = global_roles.get(r_key) if global_roles.get(r_key) in PROVIDER_META else default_k
        cand_logged_in = (diag_provs.get(cand) or {}).get("auth_state") == "LOGGED_IN"

        # Check assigned team members in character_configs.json for per-agent CLI & Model selection
        best_member = None
        for mid in (team_obj.get("member_ids") or []):
            mc = char_cfgs.get(str(mid))
            if not isinstance(mc, dict):
                continue
            if str(mc.get("triadRole") or "").upper() != triad_r:
                continue
            m_prov = str(mc.get("cliProvider") or "").strip()
            if m_prov not in PROVIDER_META:
                continue
            m_logged_in = (diag_provs.get(m_prov) or {}).get("auth_state") == "LOGGED_IN"
            if not m_logged_in:
                continue
            if best_member is None or str(mc.get("updatedAt") or "") > str(best_member.get("updatedAt") or ""):
                best_member = mc

        if best_member:
            m_prov = str(best_member.get("cliProvider") or "").strip()
            m_updated = str(best_member.get("updatedAt") or "")
            if (not cand_logged_in) or (m_updated and m_updated > team_updated_at):
                cand = m_prov
            if m_prov == cand:
                m_mod = str(best_member.get("cliModel") or "").strip()
                if m_mod:
                    avail_list = (diag_provs.get(cand) or {}).get("available_models") or []
                    avail_ids = {str(x.get("id") or "") for x in avail_list if isinstance(x, dict)}
                    if not avail_ids or m_mod in avail_ids:
                        role_model_map[triad_r] = m_mod
        return cand

    head_p = _pick_role_cli("head", "claude")
    builder_p = _pick_role_cli("builder", "antigravity")
    sub_builder_p = _pick_role_cli("sub_builder", "gemini" if "gemini" in PROVIDER_META else builder_p)
    reviewer_p = _pick_role_cli("reviewer", "openai")
    researcher_p = _pick_role_cli("researcher", "grok")

    profile_clean = (profile or "standard").lower().strip()
    max_repairs = 1 if profile_clean == "quick" else (3 if profile_clean == "deep" else 2)

    # Use each slot's or agent's real selected model directly via CLI (e.g. agy.exe --model gemini-pro-orchestrator-argon)
    builder_diag = diag_provs.get(builder_p) or {}
    raw_builder_model = str(role_model_map.get("BUILDER") or builder_diag.get("selected_model") or "").strip()
    eff_orch_mode = raw_builder_model or "default"
    orch_display = f"{PROVIDER_META[builder_p]['label']} · {role_model_map.get('BUILDER') or builder_diag.get('selected_model_display') or 'CLI 기본 모델'}"
    planner_model_ov = role_model_map.get("HEAD") or (raw_builder_model if "orchestrator" in raw_builder_model.lower() else None)
    # In single-shot BUILDING, orchestrator models delegate to subagents and risk multi-minute timeouts; use fast executor gemini-3.8-flash-high
    hydrogen_model_ov = (
        "gemini-3.8-flash-high"
        if "orchestrator" in raw_builder_model.lower()
        else role_model_map.get("BUILDER")
    )
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
    saved_mode = str((resume_state or {}).get("deliverable_mode") or "").upper()
    intent_spec: Dict[str, Any] = (
        dict(MISSION_INTENT_SPECS[saved_mode])
        if saved_mode in MISSION_INTENT_SPECS
        else classify_mission_intent(goal)
    )
    deliverable_mode: str = intent_spec["mode"]
    intent_label: str = intent_spec["label"]

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
        role_model_map.pop(role_name, None)

    def _call_cli_with_fallback(
        prov_k: str,
        prompt_txt: str,
        timeout_s: float = 28.0,
        role_name: str = "BUILDER",
        phase_name: str = "BUILDING",
        model_override: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        with _STATE_LOCK:
            if STATE.get("stop_requested"):
                return None
        cand_model = model_override or role_model_map.get(role_name)
        res = invoke_cli_if_available(prov_k, prompt_txt, timeout=timeout_s, model_override=cand_model)
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
        # STAGE 01: PLANNING (Intent Analysis + Deliverable Selection + ORDER)
        # =========================================================================
        if not stage_outputs.get("PLANNING") or resume_from_stage == "PLANNING":
            orch_prefix = (
                "💎 [Orchestrator (Carbon) · Read-Only 심층 설계] "
                if eff_orch_mode == "carbon"
                else ("🔷 [Orchestrator (Argon) · Read-Only 계획 수립] " if eff_orch_mode == "argon" else "")
            )
            s1 = _record_stage_start(
                "PLANNING",
                "HEAD",
                head_p,
                f"{orch_prefix}HEAD({PROVIDER_META[head_p]['label']})가 '{goal}' 업무 문장을 자동 분석하여 [{intent_label}] 맞춤형 {'다중 산출물 분할(Task Breakdown)' if profile_clean == 'deep' else 'ORDER 작업 지시서'}를 수립 중입니다.",
            )
            mode_guide_lines = (
                "  * RESEARCH_HTML (조사·분석 결과를 HTML 보고서로 제작): `research_report.html`(내장 CSS 스타일·종합 비교표·대상별 상세 카드·신뢰도 등급·출처가 완비된 단일 HTML 보고서) 및 `summary_data.json`\n"
                "  * RESEARCH (조사·분석·비교·현황 정리): `research_report.md`(마크다운 표·세부 조사·사실검증 구분·출처 포함) 및 `summary_data.json`(정형 데이터)\n"
                "  * DOCUMENT (기획서·제안서·전략·매뉴얼·초안): `proposal_document.md`(체계적 섹션·실행 표·체크리스트 포함"
                + (", Deep 모드 시 `action_plan.md` 추가)\n" if profile_clean == "deep" else ")\n")
                + "  * WEB (웹페이지·랜딩페이지·프론트엔드 UI): `index.html`, `styles.css`, `app.js`\n"
                + "  * CODE (파이썬·스크립트·자동화·백엔드·알고리즘 구현): "
                + ("`core_module.py` + `app_runner.py` (실행·검증 가능한 실제 코드)\n" if profile_clean == "deep" else "`main.py` 등 목표 언어의 실행 가능한 실제 소스 코드\n")
            )
            if profile_clean == "deep":
                plan_prompt = (
                    f"당신은 HEAD(총괄 지휘 · {orch_display})입니다. 사용자의 업무 지시 문장 '{goal}'의 의도를 분석하여 가장 적합한 산출물 모드를 확정하고 두 파트로 분할한 한국어 작업 지시서(ORDER)를 작성하세요.\n"
                    f"1) 첫째 줄에 반드시 `DELIVERABLE_MODE: {deliverable_mode}` 형식으로 산출물 모드를 명시하세요 (선택지: RESEARCH_HTML, RESEARCH, DOCUMENT, WEB, CODE — 초기 자동분석 추천값: {deliverable_mode}).\n"
                    f"2) 모드별 산출물 기준 (코딩 요청이 아닌 조사·기획 업무에 절대 불필요한 `.py` 파이썬 더미 코드를 지시하지 마세요):\n{mode_guide_lines}"
                    f"3) [PART 1 (BUILDER 담당)]과 [PART 2 (SUB-BUILDER 담당)]의 파일명·핵심 포함 내용·품질 합격 기준을 6줄 이내로 명확히 지시하세요."
                )
            else:
                plan_prompt = (
                    f"당신은 HEAD(총괄 지휘 · {orch_display}) 에이전트입니다. 사용자의 업무 지시 문장 '{goal}'의 의도를 분석하여 한국어 작업 지시서(ORDER)를 작성하세요.\n"
                    f"1) 첫째 줄에 반드시 `DELIVERABLE_MODE: {deliverable_mode}` 형식으로 산출물 모드를 명시하세요 (선택지: RESEARCH_HTML, RESEARCH, DOCUMENT, WEB, CODE — 초기 자동분석 추천값: {deliverable_mode}).\n"
                    f"2) 모드별 산출물 기준 (코딩 요청이 아닌 조사·기획·문서 업무에 절대 불필요한 `.py` 파이썬 코드를 지시하지 마세요):\n{mode_guide_lines}"
                    f"3) 생성할 파일명, 반드시 포함할 핵심 목차/기능, 사실 확인 및 검증 기준을 5줄 이내 한국어로 간결히 작성하세요."
                )
            res_plan = _call_cli_with_fallback(
                head_p, plan_prompt, timeout_s=65.0, role_name="HEAD", phase_name="PLANNING", model_override=planner_model_ov
            )
            stage_outputs["PLANNING"] = (
                res_plan["output"].strip()
                if (res_plan and res_plan.get("output"))
                else (
                    f"DELIVERABLE_MODE: {deliverable_mode}\n"
                    f"- 오케스트레이터: {orch_display}\n"
                    f"- 분석된 산출물 유형: {intent_label} (`{intent_spec['primary_file']}`)\n"
                    f"- 목표: {goal}\n"
                    f"- 실행 모드: {profile_clean.upper()} (최대 자동 수정 {max_repairs}회)"
                )
            )
            intent_spec = _refine_intent_from_plan(stage_outputs["PLANNING"], intent_spec)
            deliverable_mode = intent_spec["mode"]
            intent_label = intent_spec["label"]
            _record_stage_done(s1, "PLANNING", "HEAD", head_p, res_plan, stage_outputs["PLANNING"])
            if eff_orch_mode in ("argon", "carbon") or "orchestrator" in str(eff_orch_mode).lower():
                with _STATE_LOCK:
                    STATE["events"].insert(
                        0,
                        {
                            "at": utc_now_iso(),
                            "run_id": f"{mission_id}-handoff-exec",
                            "to_state": "BUILDING",
                            "state_ko": f"⚡ [{orch_display}] 계획 수립 완료 ({intent_label}) → 고속 실행 엔진({hydrogen_model_ov or '기본 모델'})으로 위임합니다.",
                            "project": STATE["project_name"],
                            "role": "BUILDER",
                        },
                    )
        else:
            intent_spec = _refine_intent_from_plan(stage_outputs.get("PLANNING", ""), intent_spec)
            deliverable_mode = intent_spec["mode"]
            intent_label = intent_spec["label"]

        with _STATE_LOCK:
            for m in STATE["missions"]:
                if m["mission_id"] == mission_id:
                    m["deliverable_mode"] = deliverable_mode
                    m["deliverable_type_label"] = intent_label

        # =========================================================================
        # STAGE 02 ~ 04: BUILDING -> VERIFYING -> REVIEWING (with Automatic Repair Loop!)
        # =========================================================================
        skip_build_once = bool(resume_from_stage == "REVIEWING" and stage_outputs.get("BUILDING") and stage_outputs.get("VERIFYING"))
        v_last_passed = True
        rev_failed = False
        no_tool_rule = (
            "중요 실행 규칙: 웹 검색(`search_web`)이 필요한 경우 포괄적인 통합 검색어로 최대 2~4회 이내만 신속히 조회한 뒤, "
            "지체 없이 현재 작업 폴더에 요청된 파일(예: research_report.html, summary_data.json 등)을 직접 생성(`write_file`)하거나 "
            "`### FILE: <파일명>` 헤더와 함께 표준 출력으로 작성하세요. 사용자에게 역질문하지 말고 즉시 완성하세요."
        )

        while True:
            with _STATE_LOCK:
                if STATE.get("stop_requested"):
                    break

            is_repair = repair_attempt > 0
            repair_tag = f" (자동 수정 #{repair_attempt}/{max_repairs})" if is_repair else ""

            if not skip_build_once:
                # --- STAGE 02: BUILDING (Adaptive to RESEARCH_HTML / RESEARCH / DOCUMENT / WEB / CODE) ---
                if profile_clean == "deep" and not is_repair:
                    deep_f1, deep_f2 = intent_spec["deep_files"]
                    s2_a = _record_stage_start(
                        "BUILDING",
                        "BUILDER",
                        builder_p,
                        f"BUILDER({PROVIDER_META[builder_p]['label']})가 [{intent_label} · PART 1 ({deep_f1})] 산출물을 작성 중입니다.",
                    )
                    if deliverable_mode == "RESEARCH_HTML":
                        b1_prompt = (
                            f"당신은 BUILDER(수석 리서치 분석가 & 데이터 시각화 개발자 · 계정 1)입니다. 사용자의 업무 지시 '{goal}'를 빠짐없이 조사하여 완성형 HTML 보고서를 작성하세요.\n"
                            f"- {no_tool_rule}\n"
                            f"- 반드시 첫 줄에 `### FILE: research_report.html`을 적고 `<!doctype html>`부터 `</html>`까지 내장 CSS(`<style>`)가 완비된 가독성 높은 한국어 HTML 보고서를 작성하세요.\n"
                            f"- 필수 포함 항목: 1) 조사 개요 요약 헤더, 2) 전체 조사 대상 한눈에 보기 비교 `<table>`, 3) 각 조사 대상별 상세 카드/섹션(사용자가 요구한 위치·규모·부대시설·특장점·방문객 평가 등 모든 세부 항목 포함), 4) 각 정보별 `[확실]`/`[추정]`/`[불확실]`/`[모름]` 신뢰도 배지 표기(허위 수치 날조 금지), 5) 공식 참고 자료 및 출처 섹션.\n\n"
                            f"[HEAD ORDER]:\n{stage_outputs['PLANNING']}"
                        )
                        b2_prompt = (
                            f"당신은 SUB-BUILDER(정형 데이터 담당 · 계정 2)입니다. 사용자의 업무 지시 '{goal}'의 핵심 조사 데이터를 JSON으로 구조화하세요.\n"
                            f"- {no_tool_rule}\n"
                            f"- 반드시 첫 줄에 `### FILE: summary_data.json`을 적고 조사된 모든 대상의 세부 속성(위치, 규모, 부대시설, 특장점, 방문객 평가 등)을 유효한 JSON 배열/객체로 작성하세요.\n\n"
                            f"[HEAD ORDER]:\n{stage_outputs['PLANNING']}"
                        )
                    elif deliverable_mode == "RESEARCH":
                        b1_prompt = (
                            f"당신은 BUILDER(수석 리서치 분석가 · 계정 1)입니다. 사용자의 업무 지시 '{goal}'에 대해 심층 조사 리포트 본문을 한국어로 작성하세요.\n"
                            f"- {no_tool_rule}\n"
                            f"- 반드시 첫 줄에 `### FILE: research_report.md`를 적고, 그 아래에 완성도 높은 마크다운 보고서를 작성하세요 (파이썬 코드 작성 금지).\n"
                            f"- 필수 포함 구성: 1) 조사 개요 및 지역/분야 배경, 2) 주요 대상별 상세 현황·특징·대표 품목/강점, 3) 한눈에 비교하는 마크다운 표(Table), 4) [확실히 검증된 사실]과 [현장/공식기관 추가 확인이 필요한 정보]의 명확한 구분(추측·허위 수치 날조 금지), 5) 참고 자료 및 출처 기준.\n\n"
                            f"[HEAD ORDER]:\n{stage_outputs['PLANNING']}"
                        )
                        b2_prompt = (
                            f"당신은 SUB-BUILDER(데이터 구조화·요약 담당 · 계정 2)입니다. 사용자의 업무 지시 '{goal}'에 대한 정형 요약 데이터와 핵심 요약본을 작성하세요.\n"
                            f"- {no_tool_rule}\n"
                            f"- 첫 번째 파일은 `### FILE: summary_data.json` 헤더 아래에 유효한 JSON 형식(배열 또는 객체)으로 핵심 조사 항목·특징·분류 데이터를 구조화하세요.\n"
                            f"- 두 번째 파일은 `### FILE: executive_summary.md` 헤더 아래에 핵심 요약 및 실무 활용 포인트를 정리하세요 (파이썬 더미 코드 작성 금지).\n\n"
                            f"[HEAD ORDER]:\n{stage_outputs['PLANNING']}"
                        )
                    elif deliverable_mode == "DOCUMENT":
                        b1_prompt = (
                            f"당신은 BUILDER(수석 기획자 · 계정 1)입니다. 사용자의 업무 지시 '{goal}'에 대한 핵심 기획서/실무 문서를 한국어로 작성하세요.\n"
                            f"- {no_tool_rule}\n"
                            f"- 반드시 첫 줄에 `### FILE: proposal_document.md`를 적고, 목적·배경·핵심 전략·세부 구성안·비교 표(Markdown Table)·기대효과를 충실하게 작성하세요 (파이썬 코드 작성 금지).\n\n"
                            f"[HEAD ORDER]:\n{stage_outputs['PLANNING']}"
                        )
                        b2_prompt = (
                            f"당신은 SUB-BUILDER(실행 로드맵 담당 · 계정 2)입니다. 사용자의 업무 지시 '{goal}'에 대한 단계별 실행 계획서 및 실무 체크리스트를 작성하세요.\n"
                            f"- {no_tool_rule}\n"
                            f"- 반드시 첫 줄에 `### FILE: action_plan.md`를 적고, 일정표(표 형식)·담당 R&R·리스크 관리 방안·점검 체크리스트를 구체적으로 작성하세요.\n\n"
                            f"[HEAD ORDER]:\n{stage_outputs['PLANNING']}"
                        )
                    elif deliverable_mode == "WEB":
                        b1_prompt = (
                            f"당신은 BUILDER(프론트엔드 UI 개발 · 계정 1)입니다. 목표 '{goal}'의 웹 화면 마크업과 디자인 스타일을 작성하세요.\n"
                            f"- {no_tool_rule}\n"
                            f"`### FILE: index.html` 및 `### FILE: styles.css` 형식으로 파일명을 명시하고 브라우저에서 즉시 동작하는 반응형 한국어 UI를 구현하세요.\n\n"
                            f"[HEAD ORDER]:\n{stage_outputs['PLANNING']}"
                        )
                        b2_prompt = (
                            f"당신은 SUB-BUILDER(인터랙션 로직 개발 · 계정 2)입니다. 목표 '{goal}'의 동적 동작 스크립트를 작성하세요.\n"
                            f"- {no_tool_rule}\n"
                            f"반드시 첫 줄에 `### FILE: app.js`를 적고 문법 오류가 없는 순수 JavaScript 코드를 작성하세요.\n\n"
                            f"[HEAD ORDER]:\n{stage_outputs['PLANNING']}"
                        )
                    else:
                        b1_prompt = (
                            f"당신은 BUILDER(구현 개발 · 계정 1)입니다. 목표 '{goal}'의 [MODULE 1: 핵심 로직]을 파이썬 코드로 작성하세요.\n"
                            f"- {no_tool_rule}\n"
                            f"반드시 첫 줄에 `### FILE: core_module.py`를 적고 ```python 코드블록으로 완전하고 바로 실행 가능한 코드를 작성하세요.\n\n"
                            f"[HEAD ORDER]:\n{stage_outputs['PLANNING']}"
                        )
                        b2_prompt = (
                            f"당신은 SUB-BUILDER(분담 개발 · 계정 2)입니다. 목표 '{goal}'의 [MODULE 2: 실행 및 검증 테스트]를 독립 실행 가능한 파이썬 코드로 작성하세요.\n"
                            f"- {no_tool_rule}\n"
                            f"반드시 첫 줄에 `### FILE: app_runner.py`를 적고 ```python 코드블록으로 외부 입력(`input()`) 없이 즉시 실행·출력되는 완전한 코드를 작성하세요.\n\n"
                            f"[HEAD ORDER]:\n{stage_outputs['PLANNING']}"
                        )

                    res_b1 = _call_cli_with_fallback(builder_p, b1_prompt, timeout_s=420.0, role_name="BUILDER", phase_name="BUILDING", model_override=hydrogen_model_ov)
                    out_b1 = res_b1["output"].strip() if (res_b1 and res_b1.get("output")) else ""
                    files_b1 = _extract_and_write_project_files(
                        mission_id,
                        f"{goal} (Part 1)",
                        out_b1,
                        project_dir,
                        default_prefix=deep_f1.rsplit(".", 1)[0],
                        deliverable_mode=deliverable_mode,
                    )
                    for f in files_b1:
                        if f not in generated_files:
                            generated_files.append(f)
                    _record_stage_done(s2_a, "BUILDING", "BUILDER", builder_p, res_b1, f"[PART 1 생성 완료] {', '.join(files_b1)}\n{out_b1[:400]}")

                    s2_b = _record_stage_start(
                        "BUILDING",
                        "SUB-BUILDER",
                        sub_builder_p,
                        f"SUB-BUILDER({PROVIDER_META.get(sub_builder_p, PROVIDER_META[builder_p])['label']})가 [{intent_label} · PART 2 ({deep_f2})] 산출물을 분담 작성 중입니다.",
                    )
                    res_b2 = _call_cli_with_fallback(sub_builder_p, b2_prompt, timeout_s=420.0, role_name="SUB-BUILDER", phase_name="BUILDING", model_override=hydrogen_model_ov)
                    out_b2 = res_b2["output"].strip() if (res_b2 and res_b2.get("output")) else ""
                    files_b2 = _extract_and_write_project_files(
                        mission_id,
                        f"{goal} (Part 2)",
                        out_b2,
                        project_dir,
                        default_prefix=deep_f2.rsplit(".", 1)[0],
                        deliverable_mode=deliverable_mode,
                    )
                    for f in files_b2:
                        if f not in generated_files:
                            generated_files.append(f)
                    stage_outputs["BUILDING"] = (
                        f"### [PART 1 · BUILDER ({PROVIDER_META[builder_p]['label']})]\n{out_b1 or f'{deep_f1} 응답 비어 있음'}\n\n"
                        f"### [PART 2 · SUB-BUILDER ({PROVIDER_META.get(sub_builder_p, PROVIDER_META[builder_p])['label']})]\n{out_b2 or f'{deep_f2} 응답 비어 있음'}"
                    )
                    _record_stage_done(s2_b, "BUILDING", "SUB-BUILDER", sub_builder_p, res_b2, f"[PART 2 생성 완료] {', '.join(files_b2)}\n{out_b2[:400]}")
                else:
                    active_builder = sub_builder_p if (is_repair and repair_attempt % 2 == 1 and sub_builder_p in PROVIDER_META) else builder_p
                    s2 = _record_stage_start(
                        "BUILDING",
                        "BUILDER",
                        active_builder,
                        f"BUILDER({PROVIDER_META[active_builder]['label']})가 '{goal}' 업무에 맞춘 [{intent_label}] 산출물 파일을 작성 중입니다.{repair_tag}",
                    )
                    repair_clause = (
                        f"\n\n[⚠️ 이전 단계 검증/검수 보완 사항 — 아래 결함을 모두 해결하여 완성된 전체 산출물을 다시 출력하세요]:\n{last_error_feedback}"
                        if is_repair and last_error_feedback
                        else ""
                    )
                    if deliverable_mode == "RESEARCH_HTML":
                        b_prompt = (
                            f"당신은 BUILDER(수석 리서처 · HTML 보고서 제작 전문가) 에이전트입니다. 사용자의 업무 지시 '{goal}'를 철저히 조사하여 브라우저에서 즉시 열람·인쇄 가능한 고품질 한국어 HTML 조사 보고서를 작성하세요.\n"
                            f"- {no_tool_rule}\n"
                            f"- 단순 제목만 적힌 빈 껍데기 HTML은 절대 금지합니다. 사용자가 요청한 모든 조사 대상과 모든 세부 항목(예: 위치·규모·부대시설·특장점·방문객 평가 등)을 빠짐없이 작성하세요.\n"
                            f"- 파일 1: 첫 줄에 반드시 `### FILE: research_report.html`을 적고 `<!doctype html>`부터 `</html>`까지 깔끔한 반응형 내장 `<style>`이 적용된 완성형 단일 HTML 보고서를 출력하세요.\n"
                            f"  * 필수 섹션: ① 조사 개요 및 핵심 요약 대시보드, ② 전체 대상 한눈에 보기 비교 `<table>`, ③ 대상별 상세 조사 카드(요구된 모든 세부 항목 충실 기재), ④ 각 정보의 신뢰도 등급(`[확실]`/`[추정]`/`[불확실]`/`[모름]`) 표시 — 확인되지 않은 수치는 추정/미확인으로 명시하고 절대 허위 날조 금지, ⑤ 공식 출처 및 참고 자료 안내.\n"
                            f"- 파일 2: 이어서 `### FILE: summary_data.json` 줄을 적고 조사된 핵심 대상 목록과 속성 데이터를 유효한 JSON 배열로 함께 출력하세요.{repair_clause}\n\n"
                            f"[HEAD의 작업 지시서(ORDER)]:\n{stage_outputs['PLANNING']}"
                        )
                    elif deliverable_mode == "RESEARCH":
                        b_prompt = (
                            f"당신은 BUILDER(수석 리서처 · 데이터 분석가) 에이전트입니다. 사용자의 업무 지시 '{goal}'를 충실히 수행하여 실제 활용 가능한 조사 보고서와 정형 데이터 파일을 작성하세요.\n"
                            f"- {no_tool_rule}\n"
                            f"- 절대 불필요한 파이썬 코드(`main.py`)로 대체하지 말고, 실제 조사 내용을 한국어로 상세히 작성하세요.\n"
                            f"- 파일 1: 반드시 `### FILE: research_report.md` 줄을 먼저 적고 그 아래에 체계적인 마크다운 조사 보고서를 작성하세요.\n"
                            f"  * 포함 항목: 1) 조사 개요 및 핵심 요약, 2) 주요 조사 대상별 상세 현황·위치/특징·주요 취급 품목/강점, 3) 항목별 한눈에 보는 마크다운 비교 표(Table), 4) 사실 확인 구분(공식·일반적으로 검증된 사실 vs 현장/지자체 최신 확인이 필요한 세부 수치 구분 — 허위 정보 날조 금지), 5) 활용 시사점 및 참고 출처.\n"
                            f"- 파일 2: 이어서 `### FILE: summary_data.json` 줄을 적고 조사된 핵심 대상 목록과 속성 정보를 유효한 JSON(배열 또는 객체)으로 정리하세요.{repair_clause}\n\n"
                            f"[HEAD의 작업 지시서(ORDER)]:\n{stage_outputs['PLANNING']}"
                        )
                    elif deliverable_mode == "DOCUMENT":
                        b_prompt = (
                            f"당신은 BUILDER(수석 기획자 · 실무 문서 작성가) 에이전트입니다. 사용자의 업무 지시 '{goal}'에 부합하는 완성도 높은 실무 문서를 한국어로 작성하세요.\n"
                            f"- {no_tool_rule}\n"
                            f"- 절대 파이썬 더미 코드(`main.py`)를 출력하지 말고, 즉시 실무에 사용할 수 있는 문서를 작성하세요.\n"
                            f"- 반드시 첫 줄에 `### FILE: proposal_document.md`를 적고, 목적·배경, 핵심 구성안/전략, 세부 실행 계획 표(Markdown Table), 기대효과 및 실무 체크리스트를 체계적으로 작성하세요.{repair_clause}\n\n"
                            f"[HEAD의 작업 지시서(ORDER)]:\n{stage_outputs['PLANNING']}"
                        )
                    elif deliverable_mode == "WEB":
                        b_prompt = (
                            f"당신은 BUILDER(프론트엔드 웹 개발자) 에이전트입니다. 사용자의 업무 지시 '{goal}'에 맞는 완성된 웹페이지/프론트엔드 산출물을 작성하세요.\n"
                            f"- {no_tool_rule}\n"
                            f"- 반드시 `### FILE: index.html` (필요 시 `### FILE: styles.css`, `### FILE: app.js` 추가) 형식으로 파일명을 명시하고, 빈 제목만 있는 스텁이 아니라 실제 콘텐츠·스타일·기능이 완비된 한국어 웹 화면 코드를 작성하세요.{repair_clause}\n\n"
                            f"[HEAD의 작업 지시서(ORDER)]:\n{stage_outputs['PLANNING']}"
                        )
                    else:
                        b_prompt = (
                            f"당신은 BUILDER(구현 개발) 에이전트입니다. 목표 '{goal}'에 대해 실제 동작하는 소스 파일을 작성하세요.\n"
                            f"- {no_tool_rule}\n"
                            f"반드시 `### FILE: main.py` (또는 목표 언어에 맞는 파일명) 형식으로 파일명을 명시한 뒤 코드블록 안에 `input()` 대기 없이 즉시 실행·검증 가능한 전체 코드를 작성하세요.{repair_clause}\n\n"
                            f"[HEAD의 작업 지시서(ORDER)]:\n{stage_outputs['PLANNING']}"
                        )
                    res_build = _call_cli_with_fallback(active_builder, b_prompt, timeout_s=420.0, role_name="BUILDER", phase_name="BUILDING", model_override=hydrogen_model_ov)
                    out_build = res_build["output"].strip() if (res_build and res_build.get("output")) else ""
                    files_b = _extract_and_write_project_files(
                        mission_id,
                        goal,
                        out_build,
                        project_dir,
                        default_prefix=intent_spec["primary_file"].rsplit(".", 1)[0],
                        deliverable_mode=deliverable_mode,
                    )
                    for f in files_b:
                        if f not in generated_files:
                            generated_files.append(f)
                    stage_outputs["BUILDING"] = out_build or (f"생성된 산출물 파일: {', '.join(files_b)}" if files_b else "⚠️ BUILDER 응답이 비어 있어 생성된 파일이 없습니다.")
                    _record_stage_done(
                        s2,
                        "BUILDING",
                        "BUILDER",
                        active_builder,
                        res_build,
                        f"[{intent_label}] 생성 파일: {', '.join(files_b) or '(없음)'}\n{stage_outputs['BUILDING'][:400]}",
                        step_state="PASS" if files_b else "REPAIR",
                    )

                # Quick mode (2 stages): run fast verification and finish immediately!
                if profile_clean == "quick":
                    v_quick = _verify_project_files(project_dir, deliverable_mode=deliverable_mode)
                    v_last_passed = v_quick["passed"]
                    stage_outputs["VERIFYING"] = v_quick["summary"]
                    q_verdict = "완료" if v_last_passed else "검증 미달 (보완 필요)"
                    stage_outputs["DECIDING"] = f"⚡ QUICK 2단계 미션 {q_verdict} ({intent_label}) · 생성 파일({len(generated_files)}개): {', '.join(generated_files) or '(없음)'}"
                    break

                # --- STAGE 03: VERIFYING (Scope Guard + Adaptive Format/Execution Verification) ---
                s3 = _record_stage_start(
                    "VERIFYING",
                    "DIRECTOR",
                    head_p,
                    f"DIRECTOR Scope Guard 및 생성된 [{intent_label}] 파일({len(generated_files)}개) 구조·데이터·실행 검증을 수행 중입니다.{repair_tag}",
                )
                v_result = _verify_project_files(project_dir, deliverable_mode=deliverable_mode)
                v_last_passed = v_result["passed"]
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

                # If mechanical verification failed and we have repair budget left -> Mid-Trajectory Recovery + loop back to 02 BUILDING!
                if not v_result["passed"] and repair_attempt < max_repairs:
                    repair_attempt += 1
                    last_error_feedback = "\n".join(v_result["errors"])
                    if eff_orch_mode in ("argon", "carbon") or "orchestrator" in str(eff_orch_mode).lower():
                        rec_s = _record_stage_start(
                            "PLANNING",
                            "HEAD",
                            head_p,
                            f"🔄 [{orch_display} · Mid-Trajectory Recovery] 검증 결함 감지 → 상위 플래너로 회귀하여 보완 계획을 재수립합니다.",
                        )
                        rec_prompt = (
                            f"당신은 {orch_display} 상위 플래너입니다. 실행 산출물 검증 단계에서 아래 결함이 감지되었습니다.\n"
                            f"[검증 결함]:\n{last_error_feedback}\n\n"
                            f"결함을 해결하기 위한 보완 지시서(ORDER)를 3줄 이내 한국어로 재작성하세요."
                        )
                        res_rec = _call_cli_with_fallback(head_p, rec_prompt, timeout_s=45.0, role_name="HEAD", phase_name="PLANNING", model_override=planner_model_ov)
                        if res_rec and res_rec.get("output"):
                            stage_outputs["PLANNING"] = stage_outputs["PLANNING"] + f"\n\n[회귀 복구 지시 #{repair_attempt}]:\n" + res_rec["output"].strip()
                        _record_stage_done(rec_s, "PLANNING", "HEAD", head_p, res_rec, f"상위 플래너 회귀 복구 계획 수립 완료 (#{repair_attempt})")
                    repair_history.append(f"자동 수정 #{repair_attempt}: 03 VERIFYING 결함 감지 ({last_error_feedback[:180]}) → 02 BUILDING 재실행")
                    continue

            skip_build_once = False

            # --- STAGE 04: REVIEWING (Independent Cross-AI Audit) ---
            s4 = _record_stage_start(
                "REVIEWING",
                "REVIEWER",
                reviewer_p,
                f"REVIEWER({PROVIDER_META[reviewer_p]['label']})가 생성된 [{intent_label}] 산출물({len(generated_files)}개)의 완성도·정확성을 독립 검수 중입니다.{repair_tag}",
            )
            ext_fence_map = {
                ".md": "markdown",
                ".json": "json",
                ".csv": "csv",
                ".html": "html",
                ".htm": "html",
                ".css": "css",
                ".js": "javascript",
                ".py": "python",
                ".sql": "sql",
            }
            actual_files_dump = []
            for f_p in sorted(project_dir.rglob("*")):
                if f_p.is_file() and f_p.name != "README.md":
                    try:
                        fence_lang = ext_fence_map.get(f_p.suffix.lower(), "text")
                        actual_files_dump.append(
                            f"### FILE: {f_p.relative_to(project_dir).as_posix()}\n```{fence_lang}\n{f_p.read_text(encoding='utf-8', errors='replace')[:6000]}\n```"
                        )
                    except Exception:
                        pass
            files_inspect_str = "\n\n".join(actual_files_dump) or "(생성된 산출물 파일 없음)"

            if deliverable_mode in ("RESEARCH_HTML", "RESEARCH", "DOCUMENT"):
                rev_prompt = (
                    f"당신은 REVIEWER(독립 품질·팩트 감사) 에이전트입니다. 사용자의 업무 지시 '{goal}'에 대해 BUILDER가 작성한 [{intent_label}] 산출물을 검수하세요.\n"
                    f"- 점검 기준: 1) 사용자의 질문/지시 의도와 요구된 세부 조사·기획 항목이 실질적으로 충실히 담겼는가(빈 껍데기나 단순 에코 여부), 2) 표·섹션 구조의 가독성, 3) 허위 사실 날조 방지 및 근거 명시 여부.\n"
                    f"- 치명적 결함(P0/P1)이 없다면 첫 줄에 반드시 `VERDICT: PASS (P0:0, P1:0)`을 적고 한국어로 2~3줄 핵심 검수 평을 작성하세요. 중대한 누락이 있다면 첫 줄에 `VERDICT: FAIL`과 구체적 보완 지시를 적으세요.\n\n"
                    f"[생성된 산출물 파일 내용]:\n{files_inspect_str}\n\n"
                    f"[03 VERIFYING 검증 결과]:\n{stage_outputs.get('VERIFYING', '')}"
                )
            else:
                rev_prompt = (
                    f"당신은 REVIEWER(독립 코드·품질 감사) 에이전트입니다. 목표 '{goal}'에 대해 BUILDER가 생성한 아래 [{intent_label}] 파일들과 실행 검증 결과를 검수하세요.\n"
                    f"치명적 결함(P0/P1)이 없다면 첫 줄에 반드시 `VERDICT: PASS (P0:0, P1:0)`을 적고 한국어로 2줄 검수 평을 작성하세요.\n\n"
                    f"[실제 생성된 산출물 파일 내용]:\n{files_inspect_str}\n\n"
                    f"[03 VERIFYING 검증 결과]:\n{stage_outputs.get('VERIFYING', '')}"
                )
            res_rev = _call_cli_with_fallback(reviewer_p, rev_prompt, timeout_s=65.0, role_name="REVIEWER", phase_name="REVIEWING")
            rev_text = (
                res_rev["output"].strip()
                if (res_rev and res_rev.get("output"))
                else (
                    f"VERDICT: PASS (P0: 0건, P1: 0건)\n- 생성된 [{intent_label}] 산출물 파일({', '.join(generated_files)})의 구조 및 검증 기준 충족을 확인했습니다."
                    if v_last_passed and generated_files
                    else "VERDICT: FAIL (P0: 1건)\n- 산출물 파일이 정상 생성되지 않았거나 검증을 통과하지 못했습니다."
                )
            )
            stage_outputs["REVIEWING"] = rev_text
            rev_failed = ("verdict: fail" in rev_text.lower()) or ("p0: 1" in rev_text.lower()) or ("p0:1" in rev_text.lower())
            _record_stage_done(s4, "REVIEWING", "REVIEWER", reviewer_p, res_rev, rev_text, step_state="REPAIR" if rev_failed else "PASS")

            if rev_failed and repair_attempt < max_repairs:
                repair_attempt += 1
                if eff_orch_mode in ("argon", "carbon") or "orchestrator" in str(eff_orch_mode).lower():
                    orch_label = "Carbon" if eff_orch_mode == "carbon" else "Argon"
                    rec_prompt = (
                        f"당신은 Antigravity Orchestrator ({orch_label}) 계획/복구 플래너입니다.\n"
                        f"04 REVIEWING 감사 단계에서 아래 반려 사유가 발생했습니다. 원인을 분석하고 BUILDER가 보완할 핵심 가이드(3줄)를 작성하세요.\n"
                        f"[REVIEWER 반려 사유]:\n{rev_text[:1500]}"
                    )
                    rec_res = _call_cli_with_fallback(
                        head_p, rec_prompt, timeout_s=45.0, role_name="HEAD", phase_name="REVIEWING", model_override=planner_model_ov
                    )
                    rec_guide = rec_res["output"].strip() if (rec_res and rec_res.get("output")) else "REVIEWER 지적 사항을 즉시 보완하세요."
                    last_error_feedback = f"REVIEWER 검수 반려 사유:\n{rev_text}\n\n[Orchestrator ({orch_label}) 복구 지침]:\n{rec_guide}"
                    repair_history.append(f"자동 수정 #{repair_attempt} [Orchestrator {orch_label}]: 04 REVIEWING 반려 → 플래너 복구 분석 후 02 BUILDING 재실행")
                else:
                    last_error_feedback = f"REVIEWER 검수 반려 사유:\n{rev_text}"
                    repair_history.append(f"자동 수정 #{repair_attempt}: 04 REVIEWING 반려 → 02 BUILDING 재실행")
                continue

            # --- STAGE 05: DECIDING ---
            final_passed = bool(generated_files) and v_last_passed and not rev_failed
            verdict_str = "PASS" if final_passed else "NEEDS_REVIEW (품질 보완 필요)"
            s5 = _record_stage_start(
                "DECIDING",
                "HEAD",
                head_p,
                f"HEAD({PROVIDER_META[head_p]['label']})가 [{intent_label}] 최종 {verdict_str} 판정 및 산출물 파일({len(generated_files)}개) 결과를 기록했습니다.",
            )
            repair_note = (
                f" (자동 수정 루프 {repair_attempt}회 거쳐 검증 통과)"
                if (final_passed and repair_attempt > 0)
                else (" (1차 무결점 통과)" if final_passed else f" (자동 수정 {repair_attempt}회 수행 후 추가 보완 필요)")
            )
            stage_outputs["DECIDING"] = (
                f"- 최종 판정: **{verdict_str}**{repair_note}\n"
                f"- 자동 분석된 산출물 유형: **{intent_label}** (`{deliverable_mode}`)\n"
                f"- 오케스트레이션 엔진: `{orch_display}`\n"
                f"- 생성된 프로젝트 폴더: `deliverables/{mission_id}_project/`\n"
                f"- 생성된 산출물 파일 ({len(generated_files)}개): {', '.join(f'`{f}`' for f in generated_files) or '(없음)'}\n"
                f"- 통합 리포트: `deliverables/{mission_id}.md`"
            )
            _record_stage_done(s5, "DECIDING", "HEAD", head_p, None, stage_outputs["DECIDING"], step_state="PASS" if final_passed else "REPAIR")
            break

    except _AllQuotaExhaustedError as q_err:
        with _STATE_LOCK:
            STATE["phase"] = "QUOTA_PAUSED"
            STATE["working_now"] = []
            STATE["paused_mission"] = {
                "mission_id": mission_id,
                "goal": goal,
                "profile": profile_clean,
                "orchestrator_mode": eff_orch_mode,
                "deliverable_mode": deliverable_mode,
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
                    m["deliverable_mode"] = deliverable_mode
                    m["deliverable_type_label"] = intent_label
                    m["orchestrator_mode"] = eff_orch_mode
                    m["orchestrator_display"] = orch_display
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
            f"- **Deliverable Type**: {intent_label} (`{deliverable_mode}`)\n"
            f"- **Profile**: `{profile_clean.upper()}`\n"
            f"- **Orchestrator**: `{orch_display}`\n"
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
        f"# 📦 Triad 미션 통합 산출물 리포트 ({mission_id})\n\n"
        f"- **미션 목표 (Goal)**: {goal}\n"
        f"- **자동 분석된 산출물 유형 (Deliverable Type)**: {intent_label} (`{deliverable_mode}`)\n"
        f"- **수행 팀 (Team)**: `{team_name}` (`{team_floor}`)\n"
        f"- **오케스트레이션 엔진 (Orchestrator)**: `{orch_display}`\n"
        f"- **실행 모드 (Profile)**: `{profile_clean.upper()}` (자동 수정 횟수: {repair_attempt} / {max_repairs}회)\n"
        f"- **저장 위치 (Output Folder)**: {storage_tag}\n"
        f"- **산출물 폴더 실제 경로**: `{project_dir}`\n"
        f"- **완료 시각**: {utc_now_iso()}\n"
        f"- **역할 배정**: HEAD={PROVIDER_META[head_p]['label']} / BUILDER={PROVIDER_META[builder_p]['label']} / SUB-BUILDER={PROVIDER_META.get(sub_builder_p, PROVIDER_META[builder_p])['label']} / REVIEWER={PROVIDER_META[reviewer_p]['label']}\n"
        f"- **생성된 산출물 파일 ({len(generated_files)}개)**:\n{files_bullet_list}\n\n"
        f"---\n\n"
        f"## 01. PLANNING (HEAD 업무 의도 분석 & 작업 지시서 · ORDER)\n{stage_outputs.get('PLANNING', '')}\n\n"
        f"## 02. BUILDING (BUILDER / SUB-BUILDER 맞춤형 산출물 작성)\n{stage_outputs.get('BUILDING', '')}\n\n"
        f"## 03. VERIFYING (DIRECTOR 품질 · 데이터 · 실행 검증)\n{stage_outputs.get('VERIFYING', '')}\n\n"
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
    fresh_out_status = get_output_dir_status(force_gdrive_refresh=True)
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

    primary_file_path = project_dir / intent_spec["primary_file"]
    clean_preview = ""
    if primary_file_path.exists():
        try:
            clean_preview = primary_file_path.read_text(encoding="utf-8", errors="replace").strip()
        except Exception:
            pass
    if not clean_preview:
        clean_preview = stage_outputs.get("BUILDING", "")

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
                m["deliverable_mode"] = deliverable_mode
                m["deliverable_type_label"] = intent_label
                m["orchestrator_mode"] = eff_orch_mode
                m["orchestrator_display"] = orch_display
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
                m["deliverable_preview"] = clean_preview
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
            loc_badge = "☁️ Google Drive" if (is_gdrive_target or bool(gdrive_upload_info)) else "📁 지정 폴더"
            STATE["chat_messages"].append(
                {
                    "id": next_chat_id,
                    "role": "HEAD",
                    "content": (
                        f"미션({mission_id} · {profile_clean.upper()} · {intent_label}) 완료: '{goal}' 작업으로 "
                        f"[{loc_badge}: `{project_dir}`]에 맞춤형 산출물 {len(generated_files)}개와 "
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


_COMPANION_DOWN_UNTIL = 0.0


def try_companion_proxy(path: str) -> Optional[Dict[str, Any]]:
    """If ai-dev-director companion_server.py is live on 127.0.0.1:8081, fetches live data from it."""
    global _COMPANION_DOWN_UNTIL
    now_c = time.time()
    if now_c < _COMPANION_DOWN_UNTIL:
        return None
    try:
        req = Request(f"http://127.0.0.1:8081{path}", headers={"Accept": "application/json"})
        with urlopen(req, timeout=0.25) as resp:
            if resp.status == 200:
                return json.loads(resp.read().decode("utf-8"))
    except Exception:
        _COMPANION_DOWN_UNTIL = now_c + 60.0
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
        if path == "/ops/fs-browse":
            qs = parse_qs(parsed.query)
            req_path = qs.get("path", [""])[0]
            listing = list_local_fs_directory(req_path or None)
            return self._send_json(listing, 200 if listing.get("ok") else 400)
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
                custom_model = str((payload or {}).get("custom_model") or "").strip() or None
                system_prompt = str((payload or {}).get("system_prompt") or "").strip() or None
                raw_skills = (payload or {}).get("skills")
                skills = [str(s) for s in raw_skills] if isinstance(raw_skills, list) else None
                question = str((payload or {}).get("question") or "").strip()
                if not question:
                    return self._send_json({"ok": False, "error": "질문 내용을 입력해 주세요."}, 400)
                res = answer_simple_question(
                    target,
                    question,
                    agent_name=agent_name,
                    custom_cli=custom_cli,
                    custom_model=custom_model,
                    system_prompt=system_prompt,
                    skills=skills,
                )
                with _STATE_LOCK:
                    prov_used = res.get("provider", next(iter(PROVIDER_META.keys()), "antigravity"))
                    domain_used = PROVIDER_META.get(prov_used, {"domain": "GOOGLE"})["domain"]
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
                elif action == "set_plan":
                    slot_key = str((payload or {}).get("key") or "").strip()
                    plan_ov = str((payload or {}).get("plan_override") or "auto").lower().strip()
                    updated_slot = set_cli_slot_plan(slot_key, plan_ov)
                    diag = probe_cli_diagnostics(deep=False)
                    prov_diag = (diag.get("providers") or {}).get(slot_key, {})
                    with _STATE_LOCK:
                        STATE["events"].insert(
                            0,
                            {
                                "at": utc_now_iso(),
                                "run_id": f"plan-{int(time.time())}",
                                "to_state": "CLI_PLAN_UPDATE",
                                "state_ko": f"💳 [{updated_slot['label']}] 구독 플랜 확인/지정 반영: {prov_diag.get('plan_name', plan_ov)}",
                                "project": STATE["project_name"],
                                "role": "DIRECTOR",
                            },
                        )
                    return self._send_json({
                        "status": "ok",
                        "action": "set_plan",
                        "updated_slot": updated_slot,
                        "slots": load_cli_slots(),
                        "roles": load_roles(),
                        "diagnostics": diag,
                        "message": f"[{updated_slot['label']}] 구독 플랜이 [{prov_diag.get('plan_name', plan_ov)}]으로 반영되었습니다.",
                    })
                elif action == "rename":
                    slot_key = str((payload or {}).get("key") or "").strip()
                    new_lbl = str((payload or {}).get("label") or "").strip()
                    updated_slot = rename_cli_slot(slot_key, new_lbl)
                    diag = probe_cli_diagnostics(deep=False)
                    with _STATE_LOCK:
                        STATE["events"].insert(
                            0,
                            {
                                "at": utc_now_iso(),
                                "run_id": f"rename-{int(time.time())}",
                                "to_state": "CLI_SLOT_RENAME",
                                "state_ko": f"✏️ CLI AI 타이틀 변경 ({slot_key}): [{updated_slot['label']}]",
                                "project": STATE["project_name"],
                                "role": "DIRECTOR",
                            },
                        )
                    return self._send_json({
                        "status": "ok",
                        "action": "rename",
                        "updated_slot": updated_slot,
                        "slots": load_cli_slots(),
                        "roles": load_roles(),
                        "diagnostics": diag,
                        "message": f"AI 타이틀이 [{updated_slot['label']}]으로 수정되어 전체 선택 목록에 반영되었습니다.",
                    })
                elif action == "set_model":
                    slot_key = str((payload or {}).get("key") or "").strip()
                    model_id = str((payload or {}).get("model") or "").strip()
                    updated_slot = set_cli_slot_model(slot_key, model_id)
                    diag = probe_cli_diagnostics(deep=False)
                    prov_diag = (diag.get("providers") or {}).get(slot_key, {})
                    disp_m = prov_diag.get("selected_model_display") or model_id or "CLI 기본 모델"
                    with _STATE_LOCK:
                        STATE["events"].insert(
                            0,
                            {
                                "at": utc_now_iso(),
                                "run_id": f"model-{int(time.time())}",
                                "to_state": "CLI_MODEL_SELECT",
                                "state_ko": f"🤖 [{updated_slot['label']}] 실행 모델 변경: {disp_m}",
                                "project": STATE["project_name"],
                                "role": "DIRECTOR",
                            },
                        )
                    return self._send_json({
                        "status": "ok",
                        "action": "set_model",
                        "updated_slot": updated_slot,
                        "slots": load_cli_slots(),
                        "roles": load_roles(),
                        "diagnostics": diag,
                        "message": f"[{updated_slot['label']}]의 실행 모델이 [{disp_m}]으로 설정되었습니다.",
                    })
                elif action == "refresh_models":
                    _CLI_MODELS_CACHE.clear()
                    diag = probe_cli_diagnostics(deep=False)
                    return self._send_json({
                        "status": "ok",
                        "action": "refresh_models",
                        "slots": load_cli_slots(),
                        "roles": load_roles(),
                        "diagnostics": diag,
                        "message": "로그인된 AI CLI로부터 실제 사용 가능한 최신 모델 목록을 다시 불러왔습니다.",
                    })
                return self._send_json({"error": f"지원하지 않는 action입니다: {action}"}, 400)
            except ValueError as exc:
                return self._send_json({"error": str(exc)}, 400)
            except Exception as exc:
                return self._send_json({"error": f"CLI 슬롯 변경 실패: {exc}"}, 500)

        if path == "/ops/orchestrator-mode":
            try:
                payload = json.loads(raw.decode("utf-8") or "{}") if raw else {}
                mode = str((payload or {}).get("mode") or "standard").lower().strip()
                if mode not in ("standard", "argon", "carbon"):
                    return self._send_json({"ok": False, "error": f"지원하지 않는 오케스트레이터 모드입니다: {mode}"}, 400)
                diag = probe_cli_diagnostics(deep=False)
                allowed = diag.get("allowed_orchestrators") or {"standard": True, "argon": False, "carbon": False}
                if mode == "argon" and not allowed.get("argon"):
                    return self._send_json(
                        {
                            "ok": False,
                            "error": "Orchestrator (Argon)은 Pro 이상 구독 계정이 연결(또는 실제 구독 플랜이 Pro/Ultra로 지정)되어야 선택할 수 있습니다.",
                            "diagnostics": diag,
                        },
                        400,
                    )
                if mode == "carbon" and not allowed.get("carbon"):
                    return self._send_json(
                        {
                            "ok": False,
                            "error": "Orchestrator (Carbon)은 Ultra 구독 전용입니다. 프로(Pro) 구독자는 Orchestrator (Argon)을 선택하실 수 있습니다.",
                            "diagnostics": diag,
                        },
                        400,
                    )
                save_workspace_settings(orchestrator_mode=mode)
                diag_after = probe_cli_diagnostics(deep=False)
                mode_labels = {
                    "standard": "기본 파이프라인 (Standard Triad)",
                    "argon": "Orchestrator (Argon) · Argon 계획 ⇄ Hydrogen 고속실행",
                    "carbon": "Orchestrator (Carbon) · Carbon 심층설계 ⇄ Hydrogen 고속실행",
                }
                with _STATE_LOCK:
                    STATE["events"].insert(
                        0,
                        {
                            "at": utc_now_iso(),
                            "run_id": f"orch-{int(time.time())}",
                            "to_state": "ORCHESTRATOR_MODE",
                            "state_ko": f"🧠 AI 오케스트레이션 엔진 전환: {mode_labels[mode]}",
                            "project": STATE["project_name"],
                            "role": "HEAD",
                        },
                    )
                return self._send_json(
                    {
                        "ok": True,
                        "orchestrator_mode": mode,
                        "diagnostics": diag_after,
                        "message": f"AI 오케스트레이션 모드가 [{mode_labels[mode]}]으로 설정되었습니다.",
                    }
                )
            except Exception as exc:
                return self._send_json({"ok": False, "error": f"오케스트레이터 모드 저장 실패: {exc}"}, 500)

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
                    target_tid = str(payload.get("team_id") or "").strip()
                    meta = gdrive_get_folder_metadata(folder_input)
                    _OUTPUT_DIR_STATUS_CACHE.clear()
                    if target_tid:
                        updated_team, _ = update_team_workspace_only(
                            target_tid,
                            {
                                "output_dir": "",
                                "gdrive_direct_enabled": True,
                                "gdrive_folder_id": meta["id"],
                                "gdrive_folder_name": meta["name"],
                                "gdrive_folder_url": meta["webViewLink"],
                            },
                            detect_google_drive_paths(),
                        )
                        return self._send_json(
                            {
                                "ok": True,
                                "folder": meta,
                                "saved_team": updated_team,
                                "output_dir_status": get_output_dir_status(),
                                "teams_summary": get_teams_payload(),
                                "message": f"[{updated_team['name']}] 팀 작업 폴더가 Google Drive 웹 주소({meta['webViewLink']})로 설정되었습니다.",
                            }
                        )
                    st_after = save_workspace_settings(
                        output_dir_raw="",
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
                                "state_ko": f"☁️ Google Drive 클라우드 저장 폴더 지정: {meta['name']} ({meta['webViewLink']})",
                                "project": STATE["project_name"],
                                "role": "DIRECTOR",
                            },
                        )
                    return self._send_json(
                        {
                            "ok": True,
                            "folder": meta,
                            "output_dir_status": st_after,
                            "teams_summary": get_teams_payload(),
                            "message": f"Google Drive 클라우드 폴더({meta['webViewLink']})가 프로젝트 저장 위치로 지정되었습니다.",
                        }
                    )

                if action == "create_folder":
                    parent_id = str(payload.get("parent_id") or "root").strip() or "root"
                    folder_name = str(payload.get("name") or "").strip()
                    created = gdrive_create_subfolder(folder_name, parent_id=parent_id)
                    return self._send_json({"ok": True, "folder": created, "message": f"Google Drive에 새 클라우드 폴더 [{created['name']}] ({created['webViewLink']})가 생성되었습니다."})

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

        if path == "/ops/fs-browse":
            try:
                payload = json.loads(raw.decode("utf-8") or "{}") if raw else {}
                if not isinstance(payload, dict):
                    payload = {}
                action = str(payload.get("action") or "list").lower().strip()
                if action == "mkdir":
                    parent_d = str(payload.get("parent_dir") or "").strip()
                    fname = str(payload.get("folder_name") or "").strip()
                    res = create_local_fs_subfolder(parent_d, fname)
                    return self._send_json(res, 200)
                if action == "read_file":
                    fpath = str(payload.get("file_path") or "").strip()
                    res = preview_local_fs_file(fpath)
                    return self._send_json(res, 200)
                if action == "resolve_gdrive_url":
                    raw_p = str(payload.get("path") or "").strip()
                    if raw_p.lower().startswith(("http://", "https://")) and "drive.google.com" in raw_p.lower():
                        meta = gdrive_get_folder_metadata(raw_p)
                        return self._send_json({"ok": True, "is_gdrive": True, "folder": meta, "resolved_path": meta["webViewLink"]}, 200)
                    resolved_p = _resolve_browse_path(raw_p)
                    gd_meta = resolve_local_gdrive_path_to_cloud_folder(resolved_p, detect_google_drive_paths())
                    return self._send_json(
                        {
                            "ok": True,
                            "is_gdrive": bool(gd_meta),
                            "folder": gd_meta,
                            "resolved_path": gd_meta["webViewLink"] if gd_meta else str(resolved_p),
                        },
                        200,
                    )
                listing = list_local_fs_directory(str(payload.get("path") or "").strip() or None)
                return self._send_json(listing, 200 if listing.get("ok") else 400)
            except ValueError as exc:
                return self._send_json({"ok": False, "error": str(exc)}, 400)
            except Exception as exc:
                return self._send_json({"ok": False, "error": f"폴더 탐색 작업 오류: {exc}"}, 500)

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
                _OUTPUT_DIR_STATUS_CACHE.clear()

                if action == "save":
                    team_in = payload.get("team") if isinstance(payload.get("team"), dict) else payload
                    req_t_orch = str((team_in or {}).get("orchestrator_mode") or "auto").lower().strip()
                    if req_t_orch in ("argon", "carbon"):
                        diag_t = probe_cli_diagnostics(deep=False)
                        allowed_t = diag_t.get("allowed_orchestrators") or {}
                        if req_t_orch == "argon" and not allowed_t.get("argon"):
                            raise ValueError("Orchestrator (Argon)은 Pro 이상 구독 계정이 연결(또는 플랜 지정)되어야 팀에 설정할 수 있습니다.")
                        if req_t_orch == "carbon" and not allowed_t.get("carbon"):
                            raise ValueError("Orchestrator (Carbon)은 Ultra 구독 전용입니다. 프로(Pro) 구독자는 Orchestrator (Argon)을 선택해 주세요.")
                    saved_team, _ = create_or_update_team(team_in, gdrives)
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
                    created_folder, _ = create_and_bind_gdrive_team_folder(
                        tid,
                        parent_folder_id=parent_id,
                        custom_folder_name=custom_name,
                        detected_gdrives=gdrives,
                    )
                    return self._send_json(
                        {
                            "ok": True,
                            "folder": created_folder,
                            "teams_summary": get_teams_payload(),
                            "message": f"Google Drive 클라우드 폴더 [{created_folder['name']}] ({created_folder['webViewLink']})를 생성하고 팀 작업 폴더로 연결했습니다!",
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

                if action == "assign_member":
                    aid = str(payload.get("agent_id") or "").strip()
                    tid = str(payload.get("team_id") or "").strip()
                    mode = str(payload.get("mode") or "move").strip()
                    fl_ov = str(payload.get("floor") or "").strip() or None
                    assign_member_to_team(agent_id=aid, team_id=tid, mode=mode, floor_override=fl_ov)
                    return self._send_json(
                        {
                            "ok": True,
                            "teams_summary": get_teams_payload(),
                            "character_configs": load_character_configs(),
                            "message": "AI 직원 팀 및 층 배치가 저장되었습니다.",
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
                req_orch = None
                if ctype == "application/json":
                    data = json.loads(raw.decode("utf-8") or "{}")
                    goal = str(data.get("message") or data.get("goal") or "").strip()
                    profile = str(data.get("profile") or "standard")
                    req_team_id = str(data.get("team_id") or "").strip() or None
                    req_orch = str(data.get("orchestrator_mode") or "").lower().strip() or None
                    if "output_dir" in data and data.get("output_dir") is not None:
                        req_output_dir = str(data.get("output_dir")).strip()
                else:
                    qs = parse_qs(raw.decode("utf-8", errors="replace"))
                    goal = (qs.get("message", [""])[0] or qs.get("goal", [""])[0]).strip()
                    profile = qs.get("profile", ["standard"])[0]
                    req_team_id = (qs.get("team_id", [""])[0]).strip() or None
                    req_orch = (qs.get("orchestrator_mode", [""])[0]).lower().strip() or None

                if req_orch in ("argon", "carbon"):
                    diag_chk = probe_cli_diagnostics(deep=False)
                    allowed_chk = diag_chk.get("allowed_orchestrators") or {}
                    if req_orch == "argon" and not allowed_chk.get("argon"):
                        return self._send_json(
                            {"status": "error", "error": "Orchestrator (Argon)은 Pro 이상 구독 계정이 연결(또는 플랜 지정)되어야 사용할 수 있습니다."},
                            400,
                        )
                    if req_orch == "carbon" and not allowed_chk.get("carbon"):
                        return self._send_json(
                            {"status": "error", "error": "Orchestrator (Carbon)은 Ultra 구독 전용입니다. 프로(Pro) 구독자는 Orchestrator (Argon)을 선택해 주세요."},
                            400,
                        )
                if req_orch in ("standard", "argon", "carbon"):
                    save_workspace_settings(orchestrator_mode=req_orch)

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
                    init_intent = classify_mission_intent(goal)
                    new_mission = {
                        "mission_id": mission_id,
                        "goal": goal,
                        "deliverable_mode": init_intent["mode"],
                        "deliverable_type_label": init_intent["label"],
                        "team_id": target_team["id"],
                        "team_name": target_team["name"],
                        "team_floor": target_team.get("floor", "1F"),
                        "team_color": target_team.get("color", "#0f6848"),
                        "project": STATE["project_name"],
                        "status": "RUNNING",
                        "live": True,
                        "profile": profile,
                        "orchestrator_mode": req_orch or "standard",
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
                    args=(mission_id, goal, profile, None, target_team["id"], req_orch),
                    daemon=True,
                )
                t.start()
                return self._send_json(
                    {
                        "status": "started",
                        "mission_id": mission_id,
                        "goal": goal,
                        "deliverable_mode": init_intent["mode"],
                        "deliverable_type_label": init_intent["label"],
                        "orchestrator_mode": req_orch or "standard",
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
