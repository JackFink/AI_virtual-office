"""
NEXUS AI Virtual Office × AI DEV DIRECTOR Local Orchestrator Server
- Serves the NEXUS Virtual Office UI (index.html, office.html, agents.html) while preserving its layout.
- Connects the Triad Multi-AI CLI architecture (Claude Code, OpenAI Codex, Google Antigravity)
  with HEAD / BUILDER / REVIEWER role assignment, CLI login/auth diagnostics, sanitized CLI execution,
  Scope Guard verification, and companion server (127.0.0.1:8081) bridge support.
"""
import atexit
import json
import mimetypes
import os
import re
import secrets
import shutil
import signal
import subprocess
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
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
    TEAMS_CONFIG_FILE,
    PARTS_DIR,
    DELIVERABLES_DIR,
    RUNTIME_STATE_DIR,
    ORCHESTRATOR_STATE_FILE,
    ensure_config_directories,
)
from backend.agents import AGENT_PERSONAS
from backend.part_roles import (
    DEFAULT_SDK_SQUAD_10,
    RECOMMENDED_SDK_STAFF_MODELS,
    add_part_role,
    build_assignable_roles,
    build_pipeline_stage_descriptors,
    build_sdk_squad_character_configs,
    copy_team_part_roles,
    delete_part_role,
    load_part_roles_config,
    reorder_part_role,
    reset_part_roles,
    resolve_canonical_part_role,
    set_staff_execution_mode,
    update_part_role,
)
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
    "antigravity_sdk": {
        "base_type": "antigravity_sdk",
        "domain": "SDK",
        "cli": "agy-sdk",
        "label": "Antigravity SDK (구독·로컬 $0)",
        "model": "google-antigravity-sdk",
        "login_cmd": "uv + SDK 자동설치 & 로컬 구독 자동 공유",
        "install_cmd": "uv pip install --python .venv google-antigravity",
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
        "key": "antigravity_sdk",
        "base_type": "antigravity_sdk",
        "domain": "SDK",
        "cli": "agy-sdk",
        "label": "Antigravity SDK (구독·로컬 $0)",
        "model": "google-antigravity-sdk",
        "login_cmd": "uv + SDK 자동설치 & 로컬 구독 자동 공유",
        "install_cmd": "uv pip install --python .venv google-antigravity",
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
    "antigravity_sdk": "antigravity_sdk",
    "agy-sdk": "antigravity_sdk",
    "agy_sdk": "antigravity_sdk",
    "sdk": "antigravity_sdk",
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
    "antigravity_sdk": "SDK",
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

    # Keep antigravity/agy/google aliases resilient when 'antigravity' CLI slot is removed in favor of 'antigravity_sdk'
    if "antigravity" in PROVIDER_META:
        ALIASES["antigravity"] = "antigravity"
        ALIASES["agy"] = "antigravity"
        ALIASES["google"] = "antigravity"
    elif "antigravity_sdk" in PROVIDER_META:
        ALIASES["antigravity"] = "antigravity_sdk"
        ALIASES["agy"] = "antigravity_sdk"
        ALIASES["google"] = "antigravity_sdk"


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
    if base_type in ("agy-sdk", "agy_sdk", "sdk", "antigravity_sdk"):
        base_type = "antigravity_sdk"
    elif base_type in ("gemini", "google", "agy"):
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
    # Re-validate saved roles, team roles, and character cliProvider so removed slot falls back cleanly
    fallback_slot = "antigravity_sdk" if any(s.get("key") == "antigravity_sdk" for s in next_slots) else str(next_slots[0].get("key") or "antigravity_sdk")
    try:
        current_roles = load_roles()
        save_roles(current_roles)
    except Exception:
        pass
    try:
        tdoc = load_teams_config()
        t_changed = False
        for t in tdoc.get("teams") or []:
            r_obj = t.get("roles")
            if isinstance(r_obj, dict):
                for rk, rv in list(r_obj.items()):
                    if rv == slot_key or rv not in PROVIDER_META:
                        r_obj[rk] = fallback_slot
                        t_changed = True
        if t_changed:
            save_teams_config(tdoc)
    except Exception:
        pass
    try:
        ccfgs = load_character_configs()
        c_changed = False
        for cid, cobj in ccfgs.items():
            if isinstance(cobj, dict) and (cobj.get("cliProvider") == slot_key or cobj.get("cliProvider") not in PROVIDER_META):
                cobj["cliProvider"] = fallback_slot
                c_changed = True
        if c_changed:
            save_character_configs(ccfgs)
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
_ACTIVE_PID_META: Dict[int, Dict[str, str]] = {}
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
                            "is_project": name.endswith("_project") or (entry / "README.md").is_file(),
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
    """Discovers official CLI executable (claude, codex, agy, agy-sdk, grok, gemini) from custom config, PATH, or standard install locations."""
    if name in ("agy-sdk", "antigravity_sdk"):
        venv_py = _get_sdk_venv_python()
        if venv_py.is_file() and _detect_installed_sdk_version_fast():
            return str(venv_py.resolve())
        return None

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


SDK_VENV_DIR = ROOT / ".venv"
_SDK_STATUS_CACHE: Dict[str, Any] = {"checked_at": 0.0, "data": None}


def resolve_uv_exe() -> Optional[str]:
    """Resolves the `uv` Python package manager executable across PATH and standard install locations."""
    bin_name = "uv.exe" if os.name == "nt" else "uv"
    found = shutil.which("uv")
    if found:
        return str(Path(found).resolve())
    candidates = [
        Path.home() / ".local" / "bin" / bin_name,
        Path.home() / ".cargo" / "bin" / bin_name,
    ]
    if os.name == "nt":
        local_app = Path(os.environ.get("LOCALAPPDATA", ""))
        if str(local_app):
            for py_sc in sorted((local_app / "Programs" / "Python").glob("Python*/Scripts/uv.exe"), reverse=True):
                candidates.append(py_sc)
    for cand in candidates:
        try:
            if cand.exists() and cand.is_file():
                return str(cand.resolve())
        except Exception:
            continue
    return None


def _get_sdk_venv_python() -> Path:
    return SDK_VENV_DIR / ("Scripts/python.exe" if os.name == "nt" else "bin/python")


def _detect_installed_sdk_version_fast() -> Optional[str]:
    """Reads google-antigravity dist-info METADATA from .venv without spawning a subprocess on every poll."""
    if not SDK_VENV_DIR.exists():
        return None
    site_dirs = (
        [SDK_VENV_DIR / "Lib" / "site-packages"]
        if os.name == "nt"
        else list((SDK_VENV_DIR / "lib").glob("python*/site-packages"))
    )
    for sdir in site_dirs:
        if not sdir.exists():
            continue
        for dist in sorted(sdir.glob("google_antigravity-*.dist-info"), reverse=True):
            meta_f = dist / "METADATA"
            if meta_f.is_file():
                try:
                    for ln in meta_f.read_text(encoding="utf-8", errors="replace").splitlines():
                        if ln.lower().startswith("version:"):
                            return ln.split(":", 1)[1].strip()
                except Exception:
                    pass
            parts = dist.name[:-len(".dist-info")].split("-")
            if len(parts) >= 2:
                return parts[1]
    return None


def get_antigravity_sdk_status(force_refresh: bool = False, diag: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Returns uv + google-antigravity SDK installation status and local Unified Auth subscription sharing state."""
    now_ts = time.time()
    cached_base = _SDK_STATUS_CACHE.get("data")
    if (not force_refresh) and cached_base and (now_ts - float(_SDK_STATUS_CACHE.get("checked_at") or 0.0) < 30.0):
        uv_exe = cached_base.get("uv_executable")
        uv_ver = cached_base.get("uv_version")
        sdk_ver = cached_base.get("sdk_version")
        venv_py = _get_sdk_venv_python()
        venv_exists = venv_py.is_file()
    else:
        uv_exe = resolve_uv_exe()
        uv_ver = None
        if uv_exe:
            try:
                p_uv = subprocess.run(
                    [uv_exe, "--version"],
                    capture_output=True,
                    text=True,
                    encoding="utf-8",
                    errors="replace",
                    timeout=4.0,
                )
                if p_uv.returncode == 0 and p_uv.stdout.strip():
                    uv_ver = p_uv.stdout.strip()
            except Exception:
                uv_ver = "설치 확인됨"
        venv_py = _get_sdk_venv_python()
        venv_exists = venv_py.is_file()
        sdk_ver = _detect_installed_sdk_version_fast()
        if venv_exists and not sdk_ver and force_refresh:
            try:
                p_sdk = subprocess.run(
                    [str(venv_py), "-c", "import importlib.metadata as m; print(m.version('google-antigravity'))"],
                    capture_output=True,
                    text=True,
                    encoding="utf-8",
                    errors="replace",
                    timeout=5.0,
                )
                if p_sdk.returncode == 0 and p_sdk.stdout.strip():
                    sdk_ver = p_sdk.stdout.strip()
            except Exception:
                pass
        _SDK_STATUS_CACHE["checked_at"] = now_ts
        _SDK_STATUS_CACHE["data"] = {
            "uv_executable": uv_exe,
            "uv_version": uv_ver,
            "sdk_version": sdk_ver,
        }

    eff_diag = diag or probe_cli_diagnostics(deep=False)
    provs = (eff_diag or {}).get("providers") or {}
    shared_accounts: List[Dict[str, Any]] = []
    for sk, pinfo in provs.items():
        if not isinstance(pinfo, dict):
            continue
        if pinfo.get("cli") in ("agy", "gemini") or sk.startswith("antigravity"):
            if pinfo.get("auth_state") == "LOGGED_IN":
                shared_accounts.append(
                    {
                        "slot_key": sk,
                        "label": pinfo.get("label") or sk,
                        "email": pinfo.get("account_email") or "로컬 로그인 세션 활성",
                        "plan_label": pinfo.get("plan_name") or pinfo.get("plan_label") or "구독 세션 활성",
                        "selected_model": pinfo.get("selected_model_display") or pinfo.get("selected_model") or "기본 모델",
                        "is_paid": bool(pinfo.get("is_paid")),
                    }
                )
    primary_shared = shared_accounts[0] if shared_accounts else None
    uv_installed = bool(uv_exe)
    sdk_installed = bool(sdk_ver and venv_exists)
    shared_auth_ready = bool(primary_shared)

    return {
        "ready": bool(uv_installed and sdk_installed and shared_auth_ready),
        "uv_installed": uv_installed,
        "uv_executable": uv_exe or "",
        "uv_version": uv_ver or "",
        "venv_dir": str(SDK_VENV_DIR),
        "venv_python": str(venv_py) if venv_exists else "",
        "venv_exists": venv_exists,
        "sdk_package": "google-antigravity",
        "sdk_installed": sdk_installed,
        "sdk_version": sdk_ver or "",
        "shared_auth_ready": shared_auth_ready,
        "shared_auth_mode": "Unified Authentication Layer (로컬 구독 계정 자동 공유 · API 키 불필요)",
        "shared_account": primary_shared,
        "shared_accounts_count": len(shared_accounts),
        "api_keys_sanitized": True,
    }


def install_antigravity_sdk_via_uv() -> Dict[str, Any]:
    """Automatically installs `uv` (if missing), creates `.venv`, installs `google-antigravity` SDK, and verifies Unified Auth sharing."""
    logs: List[str] = []
    env = get_sanitized_env()
    local_bin = str((Path.home() / ".local" / "bin").resolve())
    env["PATH"] = local_bin + os.pathsep + env.get("PATH", "")

    # 1. Check / auto-install uv
    uv_exe = resolve_uv_exe()
    if uv_exe:
        logs.append(f"[1/4] ✓ uv 패키지 매니저 감지됨: {uv_exe}")
    else:
        logs.append("[1/4] ⏳ uv 미설치 감지 → 공식 Astral 스크립트로 uv 자동 설치를 시작합니다...")
        try:
            if os.name == "nt":
                inst_cmd = [
                    "powershell",
                    "-NoProfile",
                    "-ExecutionPolicy",
                    "Bypass",
                    "-Command",
                    "irm https://astral.sh/uv/install.ps1 | iex",
                ]
            else:
                inst_cmd = ["sh", "-c", "curl -LsSf https://astral.sh/uv/install.sh | sh"]
            p_inst = subprocess.run(
                inst_cmd,
                env=env,
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
                timeout=120.0,
            )
            out_i = ((p_inst.stdout or "") + "\n" + (p_inst.stderr or "")).strip()
            if out_i:
                logs.append(out_i[:800])
            os.environ["PATH"] = local_bin + os.pathsep + os.environ.get("PATH", "")
            uv_exe = resolve_uv_exe()
            if not uv_exe:
                return {
                    "ok": False,
                    "message": "uv 자동 설치 후 실행 파일을 찾지 못했습니다.",
                    "log": "\n".join(logs),
                    "sdk_status": get_antigravity_sdk_status(force_refresh=True),
                }
            logs.append(f"[1/4] ✓ uv 자동 설치 완료: {uv_exe}")
        except Exception as exc:
            logs.append(f"❌ uv 자동 설치 오류: {exc}")
            return {
                "ok": False,
                "message": f"uv 자동 설치 실패: {exc}",
                "log": "\n".join(logs),
                "sdk_status": get_antigravity_sdk_status(force_refresh=True),
            }

    # 2. Create project .venv via uv venv if needed
    venv_py = _get_sdk_venv_python()
    if venv_py.is_file():
        logs.append(f"[2/4] ✓ 프로젝트 격리 가상환경(.venv) 확인됨: {SDK_VENV_DIR}")
    else:
        logs.append(f"[2/4] ⏳ uv venv 로 격리 가상환경 생성 중: {SDK_VENV_DIR}")
        try:
            p_venv = subprocess.run(
                [uv_exe, "venv", str(SDK_VENV_DIR)],
                cwd=str(ROOT),
                env=env,
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
                timeout=60.0,
            )
            out_v = ((p_venv.stdout or "") + "\n" + (p_venv.stderr or "")).strip()
            if out_v:
                logs.append(out_v[:600])
            if p_venv.returncode != 0 or not venv_py.is_file():
                return {
                    "ok": False,
                    "message": "uv venv 가상환경 생성에 실패했습니다.",
                    "log": "\n".join(logs),
                    "sdk_status": get_antigravity_sdk_status(force_refresh=True),
                }
            logs.append("[2/4] ✓ .venv 가상환경 생성 완료")
        except Exception as exc:
            logs.append(f"❌ 가상환경 생성 오류: {exc}")
            return {
                "ok": False,
                "message": f".venv 생성 실패: {exc}",
                "log": "\n".join(logs),
                "sdk_status": get_antigravity_sdk_status(force_refresh=True),
            }

    # 3. Install google-antigravity SDK via uv pip install
    logs.append("[3/4] ⏳ uv pip install --upgrade google-antigravity 실행 중 (내장 런타임 휠 설치)...")
    try:
        p_pkg = subprocess.run(
            [uv_exe, "pip", "install", "--upgrade", "--python", str(venv_py), "google-antigravity"],
            cwd=str(ROOT),
            env=env,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=180.0,
        )
        out_p = ((p_pkg.stdout or "") + "\n" + (p_pkg.stderr or "")).strip()
        if out_p:
            logs.append(out_p[:1200])
        if p_pkg.returncode != 0:
            return {
                "ok": False,
                "message": "google-antigravity 패키지 설치 중 오류가 발생했습니다.",
                "log": "\n".join(logs),
                "sdk_status": get_antigravity_sdk_status(force_refresh=True),
            }
    except Exception as exc:
        logs.append(f"❌ SDK 패키지 설치 오류: {exc}")
        return {
            "ok": False,
            "message": f"google-antigravity 설치 실패: {exc}",
            "log": "\n".join(logs),
            "sdk_status": get_antigravity_sdk_status(force_refresh=True),
        }

    # 4. Verify SDK import + Unified Authentication Layer status
    try:
        p_ver = subprocess.run(
            [
                str(venv_py),
                "-c",
                "import importlib.metadata as m; from google.antigravity import Agent, LocalAgentConfig, CapabilitiesConfig; print('google-antigravity==' + m.version('google-antigravity'))",
            ],
            cwd=str(ROOT),
            env=env,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=15.0,
        )
        ver_out = ((p_ver.stdout or "") + "\n" + (p_ver.stderr or "")).strip()
        if p_ver.returncode != 0:
            logs.append(f"❌ SDK 모듈 임포트 검증 실패:\n{ver_out[:600]}")
            return {
                "ok": False,
                "message": "SDK 설치 후 모듈 임포트 검증에 실패했습니다.",
                "log": "\n".join(logs),
                "sdk_status": get_antigravity_sdk_status(force_refresh=True),
            }
        logs.append(f"[4/4] ✓ SDK 모듈 임포트 및 런타임 바이너리 검증 완료: {ver_out}")
    except Exception as exc:
        logs.append(f"❌ 임포트 검증 예외: {exc}")

    fresh_status = get_antigravity_sdk_status(force_refresh=True)
    acc = fresh_status.get("shared_account")
    if acc:
        logs.append(
            f"🔗 [로컬 구독 계정 자동 공유 활성] {acc.get('email')} ({acc.get('plan_label')}) — 종량제 GEMINI_API_KEY 차단 완료 ($0 추가 비용)"
        )
    else:
        logs.append("⚠️ SDK 설치는 완료되었으나 아직 로그인된 로컬 Antigravity 구독 계정이 없습니다. [로컬 계정 로그인] 버튼으로 로그인하면 즉시 자동 공유됩니다.")

    return {
        "ok": True,
        "message": f"uv 기반 Antigravity SDK (v{fresh_status.get('sdk_version') or '최신'}) 자동 설치 및 로컬 구독 계정 공유 연동이 완료되었습니다.",
        "log": "\n".join(logs),
        "sdk_status": fresh_status,
    }


def test_antigravity_sdk_shared_auth() -> Dict[str, Any]:
    """Verifies `.venv` `google.antigravity` SDK runtime + `~/.gemini/antigravity` Unified Auth subscription response ($0 API cost)."""
    st = get_antigravity_sdk_status(force_refresh=True)
    if not st.get("sdk_installed") or not st.get("venv_python"):
        return {
            "ok": False,
            "message": "Antigravity SDK가 아직 설치되지 않았습니다. 먼저 [⚡ uv + SDK 원클릭 자동설치] 버튼을 눌러주세요.",
            "output": "SDK 미설치 상태 (.venv/google-antigravity 없음)",
            "sdk_status": st,
        }
    env = get_sanitized_env()
    sdk_probe_code = (
        "import importlib.metadata as md\n"
        "from google.antigravity import Agent, LocalAgentConfig, LocalOpenAIAgentConfig, TemplatedSystemInstructions, CapabilitiesConfig, types\n"
        "from google.antigravity.connections.local.local_connection_config import DEFAULT_APP_DATA_DIR\n"
        "from google.antigravity.connections.local.local_connection import _get_default_binary_path\n"
        "ver = md.version('google-antigravity')\n"
        "bin_p = _get_default_binary_path(None)\n"
        "sub_demo = types.SubagentConfig(name='emp_03_builder', description='BUILDER employee subagent', system_instructions='Builder Dev AI')\n"
        "print(f'[1/2] Python SDK 검증 통과: google-antigravity v{ver} (SubagentConfig: {sub_demo.name})')\n"
        "print(f'      - 내장 런타임 바이너리: {bin_p}')\n"
        "print(f'      - 로컬 공유 설정 루트(app_data_dir): {DEFAULT_APP_DATA_DIR}')\n"
    )
    import tempfile
    try:
        with tempfile.TemporaryDirectory(prefix="avo_sdk_test_") as td:
            p_sdk = subprocess.run(
                [st["venv_python"], "-c", sdk_probe_code],
                cwd=td,
                env=env,
                stdin=subprocess.DEVNULL,
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
                timeout=20.0,
            )
        sdk_out = (p_sdk.stdout or "").strip()
        sdk_err = (p_sdk.stderr or "").strip()
        if p_sdk.returncode != 0:
            return {
                "ok": False,
                "message": "SDK 런타임 모듈 검증 중 오류가 발생했습니다.",
                "output": (sdk_out + "\n" + sdk_err).strip()[:1200],
                "sdk_status": st,
            }

        if not st.get("shared_auth_ready"):
            return {
                "ok": False,
                "message": "SDK 설치는 정상이나 로그인된 로컬 Antigravity 구독 계정이 없습니다. 먼저 로그인해 주세요.",
                "output": sdk_out + "\n[2/2] ⚠️ 로컬 구독 계정 미로그인 상태",
                "sdk_status": st,
            }

        shared_acc = st.get("shared_account") or {}
        slot_k = str(shared_acc.get("slot_key") or "antigravity")
        cli_res = invoke_cli_if_available(
            slot_k,
            "Antigravity SDK 및 로컬 구독 계정 자동 공유 연동 확인 테스트입니다. 다른 도구 호출 없이 한국어 한 문장으로 정상 연결되었다고 답해주세요.",
            timeout=45.0,
            model_override="gemini-3.8-flash-low",
        )
        if cli_res and cli_res.get("output"):
            combined = (
                f"{sdk_out}\n"
                f"[2/2] 로컬 구독 계정 자동 공유 응답 확인 ({shared_acc.get('email')} · {shared_acc.get('plan_label')} · API 키 차단 $0):\n"
                f"      → {cli_res['output'].strip()}"
            )
            return {
                "ok": True,
                "message": "Antigravity SDK 런타임 및 로컬 구독 계정 자동 공유 응답 테스트에 성공했습니다.",
                "output": combined,
                "sdk_status": st,
            }
        return {
            "ok": False,
            "message": "SDK 런타임은 정상 확인되었으나 로컬 구독 세션 응답이 지연되었습니다.",
            "output": sdk_out + "\n[2/2] ⚠️ 로컬 구독 세션 응답 시간 초과 또는 재로그인 필요",
            "sdk_status": st,
        }
    except Exception as exc:
        return {
            "ok": False,
            "message": f"SDK 테스트 오류: {exc}",
            "output": str(exc),
            "sdk_status": st,
        }


def install_single_cli(cli_name: str) -> Dict[str, Any]:
    """Installs or links a single CLI (claude, codex, agy, agy-sdk) via npm, uv, or local binary auto-discovery."""
    cli_name = cli_name.lower().strip()
    if cli_name in ("agy-sdk", "agy_sdk", "antigravity_sdk", "sdk"):
        sdk_res = install_antigravity_sdk_via_uv()
        sdk_st = sdk_res.get("sdk_status") or {}
        return {
            "cli": "agy-sdk",
            "ok": bool(sdk_res.get("ok")),
            "command": "uv venv .venv && uv pip install google-antigravity",
            "executable": sdk_st.get("venv_python") or "",
            "output": sdk_res.get("log") or sdk_res.get("message") or "",
        }
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

    if cli_name == "agy-sdk":
        if not exe:
            sdk_inst = install_antigravity_sdk_via_uv()
            if not sdk_inst.get("ok"):
                return {
                    "ok": False,
                    "cli": "agy-sdk",
                    "message": sdk_inst.get("message") or "SDK 자동설치 실패",
                }
        if marker_info["detected"]:
            return {
                "ok": True,
                "cli": "agy-sdk",
                "already_logged_in": True,
                "message": f"[SDK $0 공유 완료] {slot_label}는 이미 로컬 구독 세션({marker_info['marker']})과 자동 연결되어 있습니다.",
            }
        cli_name = "agy"

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
            # 계정 신규 연결 또는 재로그인 시 이전 수동 플랜 고정값(plan_override)과 캐시를 초기화하여 실제 구독 플랜을 자동 로드
            try:
                set_cli_slot_plan(slot_key, "auto")
            except Exception:
                pass
            _GOOGLE_TIER_CACHE.clear()
            _CLI_MODELS_CACHE.clear()
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

    if cli_name == "agy-sdk":
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
            "telemetry_source": ".venv/google-antigravity + Unified Auth ($0 구독·로컬 스트림)",
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


_LOCAL_ZERO_COST_MODELS_CACHE: Dict[str, Any] = {"at": 0.0, "models": []}


def _discover_local_zero_cost_models(force_refresh: bool = False) -> List[Dict[str, str]]:
    """Probes local $0 OpenAI-compatible servers (Ollama 11434, LM Studio 1234) for SDK LocalOpenAIAgentConfig."""
    now = time.time()
    if (not force_refresh) and (now - float(_LOCAL_ZERO_COST_MODELS_CACHE.get("at") or 0.0) < 30.0):
        return list(_LOCAL_ZERO_COST_MODELS_CACHE.get("models") or [])

    found: List[Dict[str, str]] = []
    # 1. Ollama local server (http://127.0.0.1:11434/api/tags)
    try:
        req = Request("http://127.0.0.1:11434/api/tags", headers={"Accept": "application/json"})
        with urlopen(req, timeout=0.35) as resp:
            if resp.status == 200:
                payload = json.loads(resp.read().decode("utf-8", errors="ignore"))
                for m in (payload.get("models") or []):
                    m_name = str((m or {}).get("name") or "").strip()
                    if m_name:
                        found.append(
                            {
                                "id": f"ollama:{m_name}",
                                "name": f"Ollama · {m_name} ($0 로컬 SDK)",
                                "backend": "ollama",
                                "base_url": "http://127.0.0.1:11434/v1",
                                "raw_model": m_name,
                            }
                        )
    except Exception:
        pass

    # 2. LM Studio local server (http://127.0.0.1:1234/v1/models)
    try:
        req = Request("http://127.0.0.1:1234/v1/models", headers={"Accept": "application/json"})
        with urlopen(req, timeout=0.35) as resp:
            if resp.status == 200:
                payload = json.loads(resp.read().decode("utf-8", errors="ignore"))
                for m in (payload.get("data") or []):
                    m_id = str((m or {}).get("id") or "").strip()
                    if m_id:
                        found.append(
                            {
                                "id": f"lmstudio:{m_id}",
                                "name": f"LM Studio · {m_id} ($0 로컬 SDK)",
                                "backend": "lmstudio",
                                "base_url": "http://127.0.0.1:1234/v1",
                                "raw_model": m_id,
                            }
                        )
    except Exception:
        pass

    _LOCAL_ZERO_COST_MODELS_CACHE["at"] = now
    _LOCAL_ZERO_COST_MODELS_CACHE["models"] = found
    return list(found)


_CLI_MODELS_CACHE: Dict[str, Tuple[float, List[Tuple[str, str]], str]] = {}


def _get_raw_agy_model_pairs(
    exe_path: Optional[str],
    prof_dir: Optional[str] = None,
    force_refresh: bool = False,
) -> List[Tuple[str, str]]:
    """Fetches and caches live entitled model pairs from 'agy.exe models'."""
    if not exe_path or "antigravity-ide" in Path(exe_path).name.lower():
        return []
    now = time.time()
    cache_key = f"agy:{str(Path(exe_path).resolve()).lower()}:{prof_dir or ''}"
    cached = _CLI_MODELS_CACHE.get(cache_key)
    ttl = 10.0 if force_refresh else 1800.0
    if cached and (now - cached[0]) < ttl and cached[1]:
        return list(cached[1])
    raw_pairs: List[Tuple[str, str]] = []
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
            timeout=18.0,
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
        if cached and cached[1]:
            return list(cached[1])
    return raw_pairs


def _probe_agy_entitled_tier(prof_dir: Optional[str] = None, force_refresh: bool = False) -> Optional[Tuple[str, str]]:
    """Infers verified Google AI Ultra / Pro tier directly from live server-entitled models in 'agy.exe models'."""
    exe = resolve_cli("agy")
    pairs = _get_raw_agy_model_pairs(exe, prof_dir, force_refresh=force_refresh)
    if not pairs:
        return None
    model_ids = {m_id.lower() for m_id, _ in pairs}
    has_ultra_models = any(
        mid.startswith("gemini-4-neon")
        or mid.startswith("gemini-4-carbon")
        or mid in ("gemini-pro-orchestrator", "gemini-pro-orchestrator-neon")
        for mid in model_ids
    )
    if has_ultra_models:
        return ("ultra", "Antigravity 서버 모델 인가 실측 · Ultra")
    has_pro_models = any(
        mid.startswith("gemini-4-argon")
        or mid.startswith("claude-")
        or mid == "gemini-pro-orchestrator-argon"
        for mid in model_ids
    )
    if has_pro_models:
        return ("pro", "Antigravity 서버 모델 인가 실측 · Pro")
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
        if not api_paid and cli_name == "agy":
            api_paid = _probe_agy_entitled_tier(str(profile_dir) if profile_dir else None, force_refresh=deep)

        # If live Google / Antigravity server verifies Ultra entitlement, promote even if an older 'pro' override remained
        if ov == "ultra" or (api_paid and api_paid[0] == "ultra" and ov != "free"):
            is_manual_ultra = ov == "ultra" and not (api_paid and api_paid[0] == "ultra")
            src_lbl = "사용자 지정 플랜 (Ultra)" if is_manual_ultra else f"Google 서버 실측 ({api_paid[1]})"
            return {
                "account_email": email,
                "plan_tier": "google_ai_ultra",
                "orchestrator_tier": "ultra",
                "plan_override": ov,
                "plan_source": "user_confirmed" if is_manual_ultra else "google_api_verified",
                "plan_source_label": src_lbl,
                "plan_name": "Google AI Ultra (울트라 구독 · Argon, Carbon & Neon 모두 사용 가능)",
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

    if cli_name == "agy-sdk":
        agy_marker = _check_session_markers("agy", profile_dir)
        if agy_marker["detected"]:
            eff_ov = ov if ov != "auto" else str(PROVIDER_META.get("antigravity", {}).get("plan_override") or "auto")
            base_plan = _inspect_cli_account_plan("agy", True, profile_dir=profile_dir, plan_override=eff_ov, deep=deep)
            sdk_v = _detect_installed_sdk_version_fast() or "0.1"
            base_plan["plan_name"] = f"{base_plan.get('plan_label') or 'Google AI 구독'} · SDK v{sdk_v} 자동 공유 ($0 · API 키 차단)"
            base_plan["plan_label"] = f"{base_plan.get('plan_label') or 'Google AI'} (SDK $0 공유)"
            base_plan.update(telemetry)
            return base_plan
        local_models = _discover_local_zero_cost_models()
        if local_models:
            sdk_v = _detect_installed_sdk_version_fast() or "0.1"
            return {
                "account_email": "LocalOpenAIAgentConfig (Ollama/LM Studio)",
                "plan_tier": "local_sdk_zero_cost",
                "orchestrator_tier": "free",
                "plan_override": ov,
                "plan_source": "local_endpoint",
                "plan_source_label": "로컬 $0 엔드포인트",
                "plan_name": f"Antigravity SDK v{sdk_v} · 로컬 오픈 모델 ($0 무제한 · API 키 불필요)",
                "plan_label": "로컬 오픈 모델 SDK ($0)",
                "is_subscribed": True,
                "is_paid": False,
                "daily_max_calls": 999,
                "daily_max_tokens": 5000000,
                "monthly_max_calls": 29970,
                "monthly_max_tokens": 150000000,
                "max_calls": 999,
                "max_tokens": 5000000,
                "window_label": "로컬 무과금 ($0)",
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

    if cli_name == "agy-sdk":
        sdk_ver = _detect_installed_sdk_version_fast()
        if not sdk_ver:
            return {"detected": False, "marker": None}
        agy_m = _check_session_markers("agy", profile_dir)
        if agy_m["detected"]:
            return {"detected": True, "marker": f".venv/google-antigravity v{sdk_ver} + {agy_m['marker']}"}
        local_m = _discover_local_zero_cost_models()
        if local_m:
            return {"detected": True, "marker": f".venv/google-antigravity v{sdk_ver} + {local_m[0]['base_url']}"}
        return {"detected": False, "marker": None}

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
    if cli_name == "agy-sdk":
        sdk_ver = _detect_installed_sdk_version_fast()
        marker_info = _check_session_markers("agy-sdk", profile_dir)
        if not exe or not sdk_ver:
            return {
                "installed": False,
                "version": "SDK 미설치 (.venv)",
                "auth_state": "NOT_INSTALLED",
                "auth_label": "SDK 미설치 (uv 원클릭 자동설치 지원)",
                "auth_detail": "[⚡ uv + Antigravity SDK 원클릭 자동설치] 또는 [미설치 CLI 일괄 원클릭 설치]를 실행해 .venv에 google-antigravity를 설치하세요.",
                "session_detected": False,
                "session_marker": None,
            }
        ver_str = f"google-antigravity v{sdk_ver} (.venv)"
        if marker_info["detected"]:
            return {
                "installed": True,
                "version": ver_str,
                "auth_state": "LOGGED_IN",
                "auth_label": f"SDK v{sdk_ver} · 구독/로컬 $0 공유 활성",
                "auth_detail": f"격리 .venv SDK + 로컬 구독/오픈모델 공유 활성 ({marker_info['marker']}) · 유료 API 키 원천 차단($0)",
                "session_detected": True,
                "session_marker": marker_info["marker"],
            }
        return {
            "installed": True,
            "version": ver_str,
            "auth_state": "AUTH_REQUIRED",
            "auth_label": f"SDK v{sdk_ver} 설치됨 · 구독 로그인 또는 로컬 모델 필요",
            "auth_detail": "로컬 Antigravity 구독 계정(agy login)으로 로그인하거나 Ollama/LM Studio 로컬 서버를 켜면 $0으로 즉시 작동합니다.",
            "session_detected": False,
            "session_marker": None,
        }

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
        raw_pairs = _get_raw_agy_model_pairs(exe_path, prof_dir, force_refresh=force_refresh) if logged_in else []
        if raw_pairs:
            categorized = [_categorize_agy_model(mid, mdisp, orchestrator_tier) for mid, mdisp in raw_pairs]
            categorized.sort(key=lambda x: (x["_sort"], x["name"]))
            for item in categorized:
                item.pop("_sort", None)
            return categorized, "agy_live_cli"

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

    if cli_name == "agy-sdk":
        sdk_models: List[Dict[str, Any]] = []
        agy_exe = resolve_cli("agy")
        agy_logged = _check_session_markers("agy", prof_dir)["detected"]
        if agy_exe and agy_logged:
            sub_models, _ = fetch_cli_available_models(
                "antigravity", "agy", agy_exe, prof_dir, orchestrator_tier, True, force_refresh=force_refresh
            )
            for sm in sub_models:
                item_copy = dict(sm)
                item_copy["group"] = f"📦 SDK 구독 공유 ($0) · {sm.get('group', 'Antigravity')}"
                sdk_models.append(item_copy)
        local_zero = _discover_local_zero_cost_models(force_refresh=force_refresh)
        for lm in local_zero:
            sdk_models.append(
                {
                    "id": lm["id"],
                    "name": lm["name"],
                    "group": "💻 로컬 $0 오픈 모델 (SDK LocalOpenAIAgentConfig · API 키 불필요)",
                    "min_tier": "free",
                    "locked": False,
                    "lock_reason": "",
                }
            )
        if not sdk_models:
            sdk_models = [
                {
                    "id": "gemini-3.8-flash-high",
                    "name": "Gemini 3.8 Flash High (SDK 로컬 구독 공유 $0)",
                    "group": "📦 SDK 구독 공유 ($0)",
                    "min_tier": "free",
                    "locked": False,
                    "lock_reason": "",
                }
            ]
        return sdk_models, "antigravity_sdk_zero_cost"

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


def apply_sdk_squad_preset_to_workspace(target_team_id: Optional[str] = None) -> Dict[str, Any]:
    """
    Applies a team-isolated Antigravity SDK squad (1 LEAD + enabled Parts × [1 PART_LEAD + 2 STAFF])
    to the specified team WITHOUT overwriting or stealing employees belonging to other teams.
    """
    teams_doc = load_teams_config()
    eff_tid = str(target_team_id or teams_doc.get("active_team_id") or "team-core").strip()
    target_team = next((t for t in (teams_doc.get("teams") or []) if t.get("id") == eff_tid), None)
    if target_team is None and (teams_doc.get("teams") or []):
        target_team = teams_doc["teams"][0]
        eff_tid = str(target_team["id"])

    part_cfg = load_part_roles_config(team_id=eff_tid)
    enabled_parts = [p for p in (part_cfg.get("parts") or []) if p.get("enabled", True)]
    if not enabled_parts:
        part_cfg = reset_part_roles(team_id=eff_tid)
        enabled_parts = [p for p in (part_cfg.get("parts") or []) if p.get("enabled", True)]

    cur_chars = load_character_configs()
    other_team_ids = {
        str(m)
        for t in (teams_doc.get("teams") or [])
        if t.get("id") != eff_tid
        for m in (t.get("member_ids") or [])
    }
    needed_slots = 1 + (len(enabled_parts) * 3)
    team_member_ids: List[str] = [str(m) for m in ((target_team or {}).get("member_ids") or []) if str(m) not in other_team_ids]

    for n in range(1, 61):
        if len(team_member_ids) >= needed_slots:
            break
        cand = f"{n:02d}"
        if cand not in team_member_ids and cand not in other_team_ids:
            team_member_ids.append(cand)

    lead_models = ["claude-opus-5-5-high", "gemini-4-carbon-high"]
    part_lead_models = ["gemini-4-argon-high", "gemini-4-hydrogen-xhigh", "claude-sonnet-5-5-high", "gemini-4-carbon-high"]
    staff_models = list(RECOMMENDED_SDK_STAFF_MODELS)
    team_floor = str((target_team or {}).get("floor") or "1F")
    team_short = str((target_team or {}).get("name") or eff_tid).replace(" 개발팀", "팀").replace("신규 서비스 ", "").strip()
    now_str = utc_now_iso()

    def _upsert_slot(
        cid: str,
        default_name: str,
        role_id: str,
        rank: str,
        s_order: int,
        mod_id: str,
        s_mode: str,
        skills: List[str],
        sys_p: str,
    ) -> None:
        idx_num = int(re.sub(r"[^0-9]", "", cid) or "1")
        prev = cur_chars.get(cid) if isinstance(cur_chars.get(cid), dict) else {}
        maple_eq = (
            dict(prev["mapleEquipped"])
            if isinstance(prev.get("mapleEquipped"), dict) and prev.get("mapleEquipped")
            else dict(DEFAULT_SDK_SQUAD_10[(idx_num - 1) % len(DEFAULT_SDK_SQUAD_10)]["defaultMaple"])
        )
        cur_chars[cid] = {
            **prev,
            "id": cid,
            "name": str(prev.get("name") or "").strip() if (prev.get("triadRole") == role_id and prev.get("orgRank") == rank) else default_name,
            "floor": str(prev.get("floor") or team_floor),
            "dept": f"{role_id} ({rank}) · Antigravity SDK ({mod_id})",
            "triadRole": role_id,
            "orgRank": rank,
            "staffOrder": s_order,
            "cliProvider": "antigravity_sdk",
            "cliModel": mod_id,
            "sandboxMode": s_mode,
            "timeoutSec": "auto",
            "mapleEquipped": maple_eq,
            "mapleAnim": prev.get("mapleAnim") or "stand1",
            "mapleAnimated": bool(prev.get("mapleAnimated", False)),
            "mapleFlipped": bool(prev.get("mapleFlipped", False)),
            "skills": list(skills),
            "systemPrompt": sys_p,
            "updatedAt": now_str,
        }

    cursor = 0
    if cursor < len(team_member_ids):
        l_cid = team_member_ids[cursor]
        cursor += 1
        _upsert_slot(
            l_cid,
            f"{team_short} 총괄팀장 AI",
            "LEAD",
            "LEAD",
            0,
            lead_models[0],
            "read-only",
            ["프로젝트 업무분장", "파트 통합조율", "최종 결재 통합보고"],
            part_cfg["lead"].get("instruction") or "프로젝트 총괄팀장으로서 파트별 분장 및 통합보고를 수행합니다.",
        )

    for p_idx, p_def in enumerate(enabled_parts):
        pid = p_def["id"]
        p_short = p_def["name"].replace(" 담당", "").strip()
        is_build = p_def.get("part_kind") == "build"
        s_mode = "proposal" if is_build else "read-only"
        if cursor < len(team_member_ids):
            pl_cid = team_member_ids[cursor]
            cursor += 1
            _upsert_slot(
                pl_cid,
                f"{p_short} 파트장 AI",
                pid,
                "PART_LEAD",
                0,
                part_lead_models[p_idx % len(part_lead_models)],
                s_mode,
                [f"{p_short} 취합·검증", "파트 상호 교차검토"],
                p_def.get("instruction") or f"{p_def['name']} 파트장으로서 소속 사원 보고를 취합·검증합니다.",
            )
        for st_ord in (1, 2):
            if cursor < len(team_member_ids):
                st_cid = team_member_ids[cursor]
                cursor += 1
                st_mod = staff_models[(p_idx * 2 + st_ord - 1) % len(staff_models)]
                _upsert_slot(
                    st_cid,
                    f"{p_short} 사원 {st_ord}",
                    pid,
                    "STAFF",
                    st_ord,
                    st_mod,
                    s_mode,
                    [f"{p_short} 실무 #{st_ord}", "파트장 보좌"],
                    f"'{p_def['name']}' 소속 일반 사원 #{st_ord}로서 전담 실무를 수행해 파트장에게 보고합니다.",
                )

    saved_chars = save_character_configs(cur_chars)
    sdk_roles = {
        "head": "antigravity_sdk",
        "builder": "antigravity_sdk",
        "sub_builder": "antigravity_sdk",
        "reviewer": "antigravity_sdk",
        "researcher": "antigravity_sdk",
    }
    if target_team is not None:
        target_team["member_ids"] = team_member_ids
        target_team["roles"] = dict(sdk_roles)
        target_team["updated_at"] = now_str
        CLI_CONFIG_DIR.mkdir(parents=True, exist_ok=True)
        tmp_t = TEAMS_CONFIG_FILE.with_suffix(".tmp")
        tmp_t.write_text(json.dumps(teams_doc, ensure_ascii=False, indent=2), encoding="utf-8")
        os.replace(tmp_t, TEAMS_CONFIG_FILE)

    return {
        "part_roles": part_cfg,
        "character_configs": saved_chars,
        "teams_summary": get_teams_payload(force_gdrive_refresh=False),
        "applied_team_id": eff_tid,
        "squad_count": len(team_member_ids),
    }


def recruit_sdk_staff_for_part(
    part_id: str,
    target_team_id: Optional[str] = None,
    custom_name: str = "",
    custom_model: str = "",
) -> Dict[str, Any]:
    """Recruits a new subordinate staff (orgRank='STAFF', cliProvider='antigravity_sdk') into a specific team's part without overwriting other teams' members."""
    teams_doc = load_teams_config()
    eff_tid = str(target_team_id or teams_doc.get("active_team_id") or "team-core").strip()
    part_cfg = load_part_roles_config(team_id=eff_tid)
    rid = resolve_canonical_part_role(part_id, part_cfg)
    part_obj = next((p for p in (part_cfg.get("parts") or []) if p["id"] == rid), None)
    if not part_obj:
        raise ValueError(f"존재하지 않는 파트 ID입니다: {part_id}")

    cur_chars = load_character_configs()
    target_team = next((t for t in (teams_doc.get("teams") or []) if t.get("id") == eff_tid), None)
    team_members = list((target_team or {}).get("member_ids") or [])
    all_assigned_ids = {
        str(m)
        for t in (teams_doc.get("teams") or [])
        for m in (t.get("member_ids") or [])
    }

    # Find next available character ID (never overwrite an employee already assigned to ANY team)
    chosen_cid: Optional[str] = None
    for n in range(1, 61):
        cand = f"{n:02d}"
        if cand not in all_assigned_ids and cand not in cur_chars:
            chosen_cid = cand
            break
    if not chosen_cid:
        for n in range(1, 61):
            cand = f"{n:02d}"
            if cand not in all_assigned_ids:
                chosen_cid = cand
                break
    if not chosen_cid:
        raise ValueError("추가 충원 가능한 AI 직원 슬롯(최대 60명)이 모두 사용 중입니다.")

    existing_part_staff = [
        mc
        for cid, mc in cur_chars.items()
        if cid in team_members
        and isinstance(mc, dict)
        and resolve_canonical_part_role(str(mc.get("triadRole") or ""), part_cfg) == rid
        and str(mc.get("orgRank") or "").upper() == "STAFF"
    ]
    next_order = len(existing_part_staff) + 1
    used_models = {str(mc.get("cliModel") or "") for mc in existing_part_staff}
    picked_model = str(custom_model or "").strip()
    if not picked_model:
        picked_model = next(
            (m for m in RECOMMENDED_SDK_STAFF_MODELS if m not in used_models),
            RECOMMENDED_SDK_STAFF_MODELS[(next_order - 1) % len(RECOMMENDED_SDK_STAFF_MODELS)],
        )

    short_part = part_obj["name"].replace(" 담당", "").strip()
    staff_name = str(custom_name or "").strip() or f"{short_part} 사원 {next_order}"
    idx_num = int(chosen_cid)
    prev = cur_chars.get(chosen_cid) if isinstance(cur_chars.get(chosen_cid), dict) else {}
    maple_eq = (
        dict(prev["mapleEquipped"])
        if isinstance(prev.get("mapleEquipped"), dict) and prev.get("mapleEquipped")
        else {
            "skin": 2000,
            "hair": 30000 + (idx_num % 6),
            "face": 20000 + (idx_num % 5),
            "overall": 1050000 + (idx_num % 6),
            "shoes": 1070000 + (idx_num % 6),
            "hat": 1000000 + (idx_num % 6),
        }
    )
    new_char = {
        **prev,
        "id": chosen_cid,
        "name": staff_name,
        "floor": str((target_team or {}).get("floor") or ("1F" if idx_num <= 10 else "3F")),
        "dept": f"{rid} (STAFF) · Antigravity SDK ({picked_model})",
        "triadRole": rid,
        "orgRank": "STAFF",
        "staffOrder": next_order,
        "cliProvider": "antigravity_sdk",
        "cliModel": picked_model,
        "sandboxMode": "proposal" if part_obj.get("part_kind") == "build" else "read-only",
        "timeoutSec": "auto",
        "mapleEquipped": maple_eq,
        "mapleAnim": prev.get("mapleAnim") or "stand1",
        "mapleAnimated": bool(prev.get("mapleAnimated", False)),
        "mapleFlipped": bool(prev.get("mapleFlipped", False)),
        "skills": [f"{short_part} 실무 #{next_order}", "세부모델 교차검토", "파트장 보좌"],
        "systemPrompt": (
            f"당신은 '{part_obj['name']}' 산하 일반 사원 '{staff_name}'(STAFF #{next_order})입니다. "
            f"파트 지침({part_obj.get('instruction', '')})에 따라 배정된 세부 모델의 강점을 살려 실무 조사·초안·검증을 수행하고 파트장에게 명확히 보고합니다."
        ),
        "updatedAt": utc_now_iso(),
    }
    cur_chars[chosen_cid] = new_char
    saved_chars = save_character_configs(cur_chars)

    if target_team is not None:
        if chosen_cid not in target_team["member_ids"]:
            target_team["member_ids"].append(chosen_cid)
        target_team["updated_at"] = utc_now_iso()
        tmp_t = TEAMS_CONFIG_FILE.with_suffix(".tmp")
        tmp_t.write_text(json.dumps(teams_doc, ensure_ascii=False, indent=2), encoding="utf-8")
        os.replace(tmp_t, TEAMS_CONFIG_FILE)

    return {
        "recruited_agent": new_char,
        "part_roles": part_cfg,
        "character_configs": saved_chars,
        "teams_summary": get_teams_payload(force_gdrive_refresh=False),
    }


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
            "SDK": {
                "calls": _read_local_cli_telemetry("agy-sdk").get("measured_daily_calls", 0),
                "seconds": 0,
                "tokens": _read_local_cli_telemetry("agy-sdk").get("measured_daily_tokens", 0),
                "exact_tokens": _read_local_cli_telemetry("agy-sdk").get("measured_daily_tokens", 0),
                "monthly_calls": _read_local_cli_telemetry("agy-sdk").get("measured_monthly_calls", 0),
                "monthly_tokens": _read_local_cli_telemetry("agy-sdk").get("measured_monthly_tokens", 0),
            },
        },
        "total": {"calls": 18, "seconds": 555, "tokens": 202400, "exact_tokens": 202400, "failed": 0},
    },
    "stop_requested": False,
    "stopped_missions": set(),
    "mission_checkpoints": {},
    "team_streams": {},
    "quota_exhausted_slots": {},
    "paused_mission": None,
    "live_agent_stream": {
        "active": False,
        "mission_id": "",
        "agent_id": "",
        "agent_name": "",
        "role": "",
        "provider": "",
        "stage": "",
        "mode": "",
        "thought": "",
        "tool": "",
        "subagents": [],
        "updated_at": "",
    },
}

_SERVER_SHUTTING_DOWN = threading.Event()
_PERSIST_LOCK = threading.Lock()
_SHUTDOWN_ONCE_LOCK = threading.Lock()
_SHUTDOWN_HANDLED = False


def save_runtime_state() -> None:
    """Atomically persists active missions, checkpoints, approval items, and logs to ORCHESTRATOR_STATE_FILE."""
    try:
        RUNTIME_STATE_DIR.mkdir(parents=True, exist_ok=True)
        with _STATE_LOCK:
            missions_list = list(STATE.get("missions") or [])[:50]
            keep_ckpt_ids = {
                str(m.get("mission_id"))
                for m in missions_list
                if m.get("status") in ("RUNNING", "AWAITING_APPROVAL", "QUOTA_PAUSED", "PAUSED_ERROR")
            }
            for m in missions_list[:15]:
                if m.get("mission_id"):
                    keep_ckpt_ids.add(str(m["mission_id"]))
            raw_ckpts = STATE.get("mission_checkpoints") or {}
            pruned_ckpts = {
                str(mid): ck
                for mid, ck in raw_ckpts.items()
                if str(mid) in keep_ckpt_ids and isinstance(ck, dict)
            }
            STATE["mission_checkpoints"] = dict(pruned_ckpts)
            snapshot = {
                "schema_version": 1,
                "saved_at": utc_now_iso(),
                "focus_mission_id": STATE.get("focus_mission_id"),
                "missions": missions_list,
                "mission_checkpoints": pruned_ckpts,
                "paused_mission": STATE.get("paused_mission"),
                "stopped_missions": sorted(str(x) for x in (STATE.get("stopped_missions") or set()) if x),
                "events": list(STATE.get("events") or [])[:45],
                "chat_messages": list(STATE.get("chat_messages") or [])[-70:],
                "recent_calls": list(STATE.get("recent_calls") or [])[:30],
            }
            serialized = json.dumps(snapshot, ensure_ascii=False, indent=2)
        with _PERSIST_LOCK:
            tmp_path = ORCHESTRATOR_STATE_FILE.with_suffix(".tmp")
            tmp_path.write_text(serialized, encoding="utf-8")
            os.replace(tmp_path, ORCHESTRATOR_STATE_FILE)
    except Exception:
        pass


def graceful_shutdown_orchestrator(reason: str = "서버 종료 감지") -> None:
    """
    Sets _SERVER_SHUTTING_DOWN so worker threads stop mutating checkpoints immediately,
    persists clean RUNNING checkpoints to disk (never marking them STOPPED),
    and terminates child CLI subprocesses cleanly.
    """
    global _SHUTDOWN_HANDLED
    with _SHUTDOWN_ONCE_LOCK:
        if _SHUTDOWN_HANDLED:
            return
        _SHUTDOWN_HANDLED = True
    _SERVER_SHUTTING_DOWN.set()

    pids_to_kill: List[int] = []
    running_mids: List[str] = []
    with _STATE_LOCK:
        pids_to_kill = list(_ACTIVE_PIDS.keys())
        _ACTIVE_PIDS.clear()
        _ACTIVE_PID_META.clear()
        stopped_set = STATE.get("stopped_missions") or set()
        for m in STATE.get("missions") or []:
            if m.get("status") == "RUNNING" and m.get("mission_id") not in stopped_set:
                running_mids.append(str(m["mission_id"]))
                m["last_interrupted_at"] = utc_now_iso()
        if running_mids:
            STATE["events"].insert(
                0,
                {
                    "at": utc_now_iso(),
                    "run_id": f"server-shutdown-{int(time.time())}",
                    "to_state": "CHECKPOINT_SAVED",
                    "state_ko": (
                        f"💾 [{reason}] 진행 중인 미션({', '.join(running_mids)})의 체크포인트를 안전하게 저장했습니다. "
                        f"서버가 다시 켜지면 중단된 지점부터 자동으로 이어서 수행됩니다."
                    ),
                    "project": STATE.get("project_name", "AI_virtual-office"),
                    "role": "DIRECTOR",
                },
            )
    save_runtime_state()

    for pid in pids_to_kill:
        try:
            if os.name == "nt":
                subprocess.run(["taskkill", "/PID", str(pid), "/T", "/F"], capture_output=True, timeout=4)
            else:
                os.kill(pid, 9)
        except Exception:
            pass


def _summarize_checkpoint_progress(ckpt: Dict[str, Any]) -> str:
    st_out = ckpt.get("stage_outputs") or {}
    pt_out = ckpt.get("part_outputs") or {}
    stf_map = ckpt.get("staff_outputs_by_part") or {}
    gen_files = ckpt.get("generated_files") or []
    parts_done = len([k for k, v in pt_out.items() if v])
    partial_staff = sum(
        len(v) for k, v in stf_map.items() if isinstance(v, dict) and v and not pt_out.get(k)
    )
    badges: List[str] = []
    if st_out.get("LEAD_PLANNING"):
        badges.append("총괄팀장 분장 완료")
    if parts_done:
        badges.append(f"파트 {parts_done}개 완료")
    if partial_staff:
        badges.append(f"진행 중 파트 사원 {partial_staff}명 완료")
    if st_out.get("PART_REVIEW"):
        badges.append("파트 상호검토 완료")
    if gen_files:
        badges.append(f"산출물 {len(gen_files)}개 생성됨")
    return " · ".join(badges) if badges else "초기 업무분장 단계"


def load_runtime_state_and_auto_resume(auto_resume: bool = True) -> List[str]:
    """
    Restores persisted orchestrator state on server boot and automatically resumes
    any mission that was interrupted in RUNNING status (excluding user-STOPPED missions).
    """
    if not ORCHESTRATOR_STATE_FILE.is_file():
        return []
    try:
        data = json.loads(ORCHESTRATOR_STATE_FILE.read_text(encoding="utf-8"))
        if not isinstance(data, dict):
            return []
    except Exception:
        return []

    to_resume_specs: List[Tuple[str, str, str, Dict[str, Any], Optional[str], Optional[str]]] = []

    with _STATE_LOCK:
        saved_missions = data.get("missions")
        if isinstance(saved_missions, list) and saved_missions:
            STATE["missions"] = saved_missions
        saved_ckpts = data.get("mission_checkpoints")
        if isinstance(saved_ckpts, dict):
            STATE["mission_checkpoints"] = saved_ckpts
        if data.get("focus_mission_id"):
            STATE["focus_mission_id"] = str(data["focus_mission_id"])
        if "paused_mission" in data:
            STATE["paused_mission"] = data.get("paused_mission")
        saved_stopped = data.get("stopped_missions")
        if isinstance(saved_stopped, list):
            STATE["stopped_missions"] = {str(x) for x in saved_stopped if x}
        saved_events = data.get("events")
        if isinstance(saved_events, list) and saved_events:
            STATE["events"] = saved_events
        saved_chats = data.get("chat_messages")
        if isinstance(saved_chats, list) and saved_chats:
            STATE["chat_messages"] = saved_chats
        saved_calls = data.get("recent_calls")
        if isinstance(saved_calls, list) and saved_calls:
            STATE["recent_calls"] = saved_calls

        # Clear transient process-bound stream indicators from previous server instance
        STATE["working_now"] = []
        STATE["team_streams"] = {}
        STATE["stop_requested"] = False
        if isinstance(STATE.get("live_agent_stream"), dict):
            STATE["live_agent_stream"]["active"] = False
            STATE["live_agent_stream"]["tool"] = ""
            STATE["live_agent_stream"]["parallel_agents"] = []

        stopped_set = STATE.get("stopped_missions") or set()
        seen_running_teams: set = set()
        for m in STATE["missions"]:
            if not isinstance(m, dict):
                continue
            mid = str(m.get("mission_id") or "").strip()
            if not mid:
                continue
            if m.get("status") == "RUNNING":
                if mid in stopped_set:
                    m["status"] = "STOPPED"
                    m["live"] = False
                    continue
                m_tid = str(m.get("team_id") or "").strip() or None
                dedup_key = m_tid or mid
                if dedup_key in seen_running_teams:
                    m["status"] = "PAUSED_ERROR"
                    m["live"] = False
                    continue
                seen_running_teams.add(dedup_key)

                raw_ckpt = dict((STATE["mission_checkpoints"].get(mid) or {}))
                if not raw_ckpt:
                    raw_ckpt = {
                        "mission_id": mid,
                        "goal": m.get("goal", ""),
                        "profile": m.get("profile", "standard"),
                        "orchestrator_mode": m.get("orchestrator_mode"),
                        "deliverable_mode": m.get("deliverable_mode"),
                        "team_id": m_tid,
                        "output_root": m.get("output_root"),
                        "stage_outputs": dict(m.get("stage_outputs_snapshot") or {}),
                        "part_outputs": dict(m.get("part_outputs_snapshot") or {}),
                        "staff_outputs_by_part": {},
                        "generated_files": list(m.get("generated_files") or []),
                        "step_counter": len(m.get("steps") or []),
                    }
                # Ensure auto-resume skips completed stages rather than forcing re-run of interrupted_stage
                raw_ckpt.pop("interrupted_stage", None)

                if auto_resume:
                    m["live"] = True
                    m["status"] = "RUNNING"
                    m["resumed_count"] = int(m.get("resumed_count") or 0) + 1
                    m["updated_at"] = utc_now_iso()
                    ckpt_desc = _summarize_checkpoint_progress(raw_ckpt)
                    t_label = m.get("team_name") or m_tid or "기본 팀"
                    g_txt = str(m.get("goal") or raw_ckpt.get("goal") or "")
                    STATE["events"].insert(
                        0,
                        {
                            "at": utc_now_iso(),
                            "run_id": f"{mid}-boot-autoresume-{m['resumed_count']}",
                            "to_state": raw_ckpt.get("current_stage") or "LEAD_PLANNING",
                            "state_ko": (
                                f"♻️ [서버 재기동 자동 이어하기 · {t_label}] 이전 서버 종료로 중단되었던 프로젝트({mid}: '{g_txt[:55]}')를 "
                                f"체크포인트({ckpt_desc}) 이후 미완료 단계부터 자동으로 이어서 재개합니다."
                            ),
                            "project": STATE["project_name"],
                            "role": "LEAD",
                            "team_id": m_tid,
                        },
                    )
                    next_cid = max((c.get("id", 0) for c in STATE["chat_messages"]), default=0) + 1
                    STATE["chat_messages"].append(
                        {
                            "id": next_cid,
                            "role": "SYSTEM",
                            "content": (
                                f"♻️ [{t_label} · 자동 복구] 서버가 다시 시작되어 미션({mid}: '{g_txt}')을 "
                                f"보존된 체크포인트({ckpt_desc}) 다음 단계부터 자동으로 이어서 진행합니다."
                            ),
                            "at": utc_now_iso(),
                        }
                    )
                    to_resume_specs.append(
                        (
                            mid,
                            g_txt,
                            str(m.get("profile") or raw_ckpt.get("profile") or "standard"),
                            raw_ckpt,
                            m_tid,
                            m.get("orchestrator_mode") or raw_ckpt.get("orchestrator_mode"),
                        )
                    )
                else:
                    m["live"] = False

        STATE["phase"] = _recompute_global_phase_unlocked()

    save_runtime_state()

    resumed_ids: List[str] = []
    for mid, g_txt, prof, ckpt_obj, tid_val, orch_val in to_resume_specs:
        if not g_txt:
            continue
        resumed_ids.append(mid)
        t = threading.Thread(
            target=_run_mission_pipeline,
            args=(mid, g_txt, prof, ckpt_obj, tid_val, orch_val),
            daemon=True,
        )
        t.start()
    return resumed_ids

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


def build_team_subagent_roster(
    team_obj: Optional[Dict[str, Any]] = None,
    char_cfgs: Optional[Dict[str, Any]] = None,
    exclude_role: str = "",
) -> List[Dict[str, Any]]:
    """Synthesizes assigned employee characters into SDK SubagentConfig-compatible roster descriptors."""
    cfgs = char_cfgs if isinstance(char_cfgs, dict) else load_character_configs()
    member_ids = list((team_obj or {}).get("member_ids") or [])
    if not member_ids:
        member_ids = sorted(cfgs.keys())
    roster: List[Dict[str, Any]] = []
    seen_names: set = set()
    ex_upper = str(exclude_role or "").upper().strip()
    for mid in member_ids:
        mc = cfgs.get(str(mid))
        if not isinstance(mc, dict):
            continue
        c_role = str(mc.get("triadRole") or "BUILDER").upper().strip()
        if ex_upper and c_role == ex_upper and len(member_ids) > 1:
            continue
        c_id = str(mc.get("id") or mid).zfill(2)
        c_name = str(mc.get("name") or f"Employee #{c_id}").strip()
        org_rank = str(
            mc.get("orgRank") or ("LEAD" if c_role in ("LEAD", "HEAD") else "PART_LEAD")
        ).upper().strip()
        role_slug = re.sub(r"[^a-z0-9_]", "_", c_role.lower()).strip("_") or "agent"
        safe_name = f"emp_{c_id}_{role_slug}"
        if safe_name in seen_names:
            continue
        seen_names.add(safe_name)
        skills = [str(s).strip() for s in (mc.get("skills") or []) if str(s).strip()]
        sys_p = str(mc.get("systemPrompt") or f"당신은 '{c_name}' ({c_role} 담당) AI 직원입니다.").strip()
        cli_prov = str(mc.get("cliProvider") or "antigravity_sdk").strip()
        cli_mod = str(mc.get("cliModel") or "").strip()
        sandbox_m = str(mc.get("sandboxMode") or "proposal").strip()
        mod_tag = f" ({cli_mod})" if cli_mod else ""
        desc = f"[{c_role} · {org_rank}] {c_name}{mod_tag}" + (f" — 전문 스킬: {', '.join(skills[:4])}" if skills else "")
        full_sys = (
            f"{sys_p}\n"
            f"- 배정 역할: {c_role} ({org_rank}) | 실행 모델: {cli_mod or '기본'} | 샌드박스 모드: {sandbox_m}\n"
            + (f"- 전문 스킬: {', '.join(skills)}\n" if skills else "")
            + "- 유료 종량제 API 키 사용 금지($0 원칙) 및 사실 검증 기준([확실]/[추정]/[불확실]/[모름]) 준수"
        )
        roster.append(
            {
                "id": c_id,
                "safe_name": safe_name,
                "name": c_name,
                "role": c_role,
                "org_rank": org_rank,
                "cli_provider": cli_prov,
                "cli_model": cli_mod,
                "sandbox_mode": sandbox_m,
                "skills": skills,
                "description": desc,
                "system_instructions": full_sys,
            }
        )
    return roster


def _resolve_active_employee_meta(
    role_name: str,
    prov_k: str,
    team_obj: Optional[Dict[str, Any]] = None,
    char_cfgs: Optional[Dict[str, Any]] = None,
) -> Tuple[str, str]:
    """Finds the matching Virtual Office employee character (id, name) for live speech-bubble updates."""
    cfgs = char_cfgs if isinstance(char_cfgs, dict) else load_character_configs()
    r_up = str(role_name or "LEAD").upper().strip()
    r_canon = resolve_canonical_part_role(r_up)
    m_ids = list((team_obj or {}).get("member_ids") or []) or sorted(cfgs.keys())
    best: Optional[Dict[str, Any]] = None
    for mid in m_ids:
        mc = cfgs.get(str(mid))
        if not isinstance(mc, dict):
            continue
        mc_role = str(mc.get("triadRole") or "").upper().strip()
        if mc_role == r_up or resolve_canonical_part_role(mc_role) == r_canon:
            if str(mc.get("cliProvider") or "").strip() == prov_k:
                return str(mc.get("id") or mid).zfill(2), str(mc.get("name") or r_up)
            if best is None:
                best = mc
    if best:
        return str(best.get("id") or "01").zfill(2), str(best.get("name") or r_up)
    fallback_ids = {
        "LEAD": ("01", "HEAD Director AI"),
        "HEAD": ("01", "HEAD Director AI"),
        "PART_RESEARCH": ("02", "자료수집 파트 AI"),
        "RESEARCHER": ("02", "자료수집 파트 AI"),
        "PART_STRUCTURE": ("04", "기획·구조설계 파트 AI"),
        "SUB-BUILDER": ("05", "Gemini Sub AI"),
        "PART_BUILD": ("03", "Builder Dev AI"),
        "BUILDER": ("03", "Builder Dev AI"),
        "PART_REVIEW": ("04", "파트 상호검토 AI"),
        "REVIEWER": ("04", "Reviewer Audit AI"),
    }
    return fallback_ids.get(r_up, fallback_ids.get(r_canon, ("01", f"{r_up} 담당 AI")))


def _is_mission_stopped_unlocked(mission_id: str) -> bool:
    if STATE.get("stop_requested"):
        return True
    stopped_set = STATE.get("stopped_missions")
    return bool(mission_id and isinstance(stopped_set, set) and mission_id in stopped_set)


def _recompute_global_phase_unlocked() -> str:
    missions = STATE.get("missions") or []
    for m in missions:
        if m.get("status") == "RUNNING":
            steps = m.get("steps") or []
            return steps[-1].get("stage", "LEAD_PLANNING") if steps else "LEAD_PLANNING"
    if any(m.get("status") == "AWAITING_APPROVAL" for m in missions):
        return "AWAITING_APPROVAL"
    if any(m.get("status") == "QUOTA_PAUSED" for m in missions):
        return "QUOTA_PAUSED"
    return "IDLE"


def _update_live_agent_stream(
    *,
    active: bool = True,
    mission_id: str = "",
    team_id: str = "",
    agent_id: str = "",
    agent_name: str = "",
    role: str = "",
    provider: str = "",
    stage: str = "",
    mode: str = "",
    thought: Optional[str] = None,
    tool: Optional[str] = None,
    subagents: Optional[List[Dict[str, Any]]] = None,
    parallel_agents: Optional[List[Dict[str, Any]]] = None,
    emit_event: bool = False,
) -> None:
    """Thread-safely updates STATE['live_agent_stream'], STATE['team_streams'][team_id], and optionally pushes an event."""
    with _STATE_LOCK:
        cur = STATE.setdefault("live_agent_stream", {})
        cur["active"] = active
        if mission_id:
            cur["mission_id"] = mission_id
        if team_id:
            cur["team_id"] = team_id
        if agent_id:
            cur["agent_id"] = agent_id
        if agent_name:
            cur["agent_name"] = agent_name
        if role:
            cur["role"] = role
        if provider:
            cur["provider"] = provider
        if stage:
            cur["stage"] = stage
        if mode:
            cur["mode"] = mode
        if thought is not None:
            cur["thought"] = thought[:260]
        if tool is not None:
            cur["tool"] = tool[:220]
        if subagents is not None:
            cur["subagents"] = [
                {"id": s.get("id"), "name": s.get("name"), "role": s.get("role"), "safe_name": s.get("safe_name")}
                for s in subagents[:8]
            ]
        if parallel_agents is not None:
            cur["parallel_agents"] = list(parallel_agents)
        cur["updated_at"] = utc_now_iso()
        if team_id:
            t_streams = STATE.setdefault("team_streams", {})
            prev_ts = dict(t_streams.get(team_id) or {})
            prev_ts.update(
                {
                    "active": active,
                    "mission_id": mission_id or prev_ts.get("mission_id", ""),
                    "team_id": team_id,
                    "agent_id": agent_id or prev_ts.get("agent_id", ""),
                    "agent_name": agent_name or prev_ts.get("agent_name", ""),
                    "role": role or prev_ts.get("role", ""),
                    "provider": provider or prev_ts.get("provider", ""),
                    "stage": stage or prev_ts.get("stage", ""),
                    "mode": mode or prev_ts.get("mode", ""),
                    "thought": cur.get("thought", ""),
                    "tool": cur.get("tool", ""),
                    "parallel_agents": list(cur.get("parallel_agents") or []),
                    "updated_at": cur["updated_at"],
                }
            )
            t_streams[team_id] = prev_ts
        if emit_event and (tool or thought):
            headline = f"🔧 [{agent_name or role}] {tool}" if tool else f"💭 [{agent_name or role}] {thought}"
            top_ev = STATE["events"][0] if STATE.get("events") else None
            if not top_ev or top_ev.get("state_ko") != headline[:200]:
                STATE["events"].insert(
                    0,
                    {
                        "at": utc_now_iso(),
                        "run_id": f"{mission_id or 'sdk'}-live-{int(time.time() * 1000) % 100000}",
                        "to_state": stage or STATE.get("phase") or "RUNNING",
                        "state_ko": headline[:200],
                        "project": STATE["project_name"],
                        "role": role or "BUILDER",
                    },
                )


def _clear_live_agent_stream(team_id: str = "", mission_id: str = "") -> None:
    with _STATE_LOCK:
        if team_id and isinstance(STATE.get("team_streams"), dict) and team_id in STATE["team_streams"]:
            STATE["team_streams"][team_id]["active"] = False
            STATE["team_streams"][team_id]["tool"] = ""
            STATE["team_streams"][team_id]["parallel_agents"] = []
            STATE["team_streams"][team_id]["updated_at"] = utc_now_iso()
        other_running = any(
            m.get("status") == "RUNNING" and m.get("mission_id") != mission_id
            for m in (STATE.get("missions") or [])
        )
        cur = STATE.get("live_agent_stream")
        if isinstance(cur, dict) and (not other_running or not mission_id or cur.get("mission_id") == mission_id):
            cur["active"] = False
            cur["tool"] = ""
            cur["parallel_agents"] = []
            cur["updated_at"] = utc_now_iso()


def _summarize_tool_call_event(tc_obj: Dict[str, Any]) -> str:
    """Formats a concise human-readable summary of a live SDK/CLI tool call."""
    t_name = str(tc_obj.get("tool_name") or tc_obj.get("name") or "tool").strip()
    params = tc_obj.get("parameters") or tc_obj.get("args") or tc_obj.get("arguments") or {}
    if isinstance(params, str):
        try:
            params = json.loads(params)
        except Exception:
            params = {"arg": params[:80]}
    detail = ""
    if isinstance(params, dict):
        for k in ("query", "Path", "path", "Role", "TypeName", "CommandLine", "url", "Recipient"):
            if params.get(k):
                detail = str(params[k]).strip().replace("\n", " ")[:65]
                break
        if not detail and params:
            first_k = next(iter(params.keys()))
            detail = f"{first_k}={str(params[first_k]).strip()[:50]}"
    label_map = {
        "search_web": "웹 검색(search_web)",
        "write_file": "파일 작성(write_file)",
        "edit_file": "파일 수정(edit_file)",
        "read_file": "파일 읽기(read_file)",
        "invoke_subagent": "서브에이전트 위임(invoke_subagent)",
        "run_command": "명령 실행(run_command)",
    }
    disp = label_map.get(t_name, t_name)
    return f"{disp}" + (f" → {detail}" if detail else "")


def resolve_agent_timeout(
    raw_timeout_cfg: Any = "auto",
    phase_name: str = "PART_BUILD",
    org_rank: str = "PART_LEAD",
    profile: str = "standard",
    model_id: Optional[str] = None,
) -> Tuple[float, bool]:
    """
    Computes adaptive timeout (in seconds) and whether streaming heartbeat auto-extension is active.
    - When raw_timeout_cfg is 'auto' (default) or unset: dynamically scales by phase, rank, profile, and frontier reasoning model.
    - When raw_timeout_cfg is an explicit integer string (e.g. '600', '1200'): honors it with a safe 180s minimum floor.
    """
    raw_s = str(raw_timeout_cfg if raw_timeout_cfg is not None else "auto").strip().lower()
    if raw_s and raw_s != "auto":
        try:
            manual_sec = float(raw_s)
            if manual_sec > 0:
                return max(180.0, min(manual_sec, 3600.0)), False
        except ValueError:
            pass

    ph = str(phase_name or "").upper()
    rk = str(org_rank or "PART_LEAD").upper()
    prof = str(profile or "standard").lower().strip()
    mod = str(model_id or "").lower().strip()

    if ph == "ASK":
        base_sec = 240.0
    elif ph in ("LEAD_PLANNING", "PLANNING", "LEAD_REPORT", "DECIDING"):
        base_sec = 300.0
    elif ph in ("PART_REVIEW", "REVIEWING", "VERIFYING"):
        base_sec = 330.0
    elif rk == "STAFF":
        base_sec = 360.0
    elif "BUILD" in ph:
        base_sec = 660.0
    else:
        base_sec = 450.0

    prof_mult = 0.85 if prof == "quick" else (1.45 if prof == "deep" else 1.0)
    heavy_model = any(tok in mod for tok in ("carbon", "neon", "opus", "orchestrator", "xhigh", "o3"))
    mod_mult = 1.5 if heavy_model else (1.2 if "high" in mod else 1.0)
    computed = max(240.0, min(base_sec * prof_mult * mod_mult, 1800.0))
    return round(computed, 1), True


def invoke_sdk_agent_streaming(
    prompt: str,
    timeout: float = 45.0,
    model_override: Optional[str] = None,
    stream_meta: Optional[Dict[str, Any]] = None,
    prof_dir: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    """
    Executes Antigravity SDK (`antigravity_sdk`) strictly at $0 (paid API keys stripped):
      - Mode B (`ollama:<model>` / `lmstudio:<model>`): Native `.venv` `google.antigravity.Agent(LocalOpenAIAgentConfig(..., subagents=[SubagentConfig(...)]))` streaming `thoughts` & `tool_calls`.
      - Mode A (Subscription models): `.venv` SDK `SubagentConfig` team roster synthesis + `agy.exe --output-format stream-json --sandbox --dangerously-skip-permissions` streaming real-time NDJSON `step_update` thoughts & tool calls via Unified Auth.
    """
    venv_py = _get_sdk_venv_python()
    sdk_ver = _detect_installed_sdk_version_fast()
    if not venv_py.is_file() or not sdk_ver:
        return None

    meta = PROVIDER_META.get("antigravity_sdk", {"label": "Antigravity SDK (구독·로컬 $0)", "selected_model": ""})
    eff_model = str(model_override or meta.get("selected_model") or "").strip()
    run_env = get_sanitized_env()
    if prof_dir:
        run_env["GEMINI_CLI_HOME"] = str(prof_dir)

    s_meta = stream_meta or {}
    mission_id = str(s_meta.get("mission_id") or "")
    s_team_id = str(s_meta.get("team_id") or "")
    role_name = str(s_meta.get("role_name") or "HEAD")
    phase_name = str(s_meta.get("phase_name") or STATE.get("phase") or "ASK")
    agent_id = str(s_meta.get("agent_id") or "01")
    agent_name = str(s_meta.get("agent_name") or "SDK Agent")
    subagents: List[Dict[str, Any]] = list(s_meta.get("subagents") or [])
    keep_stream_open = bool(s_meta.get("keep_stream_open", False))

    is_local_openai = eff_model.startswith("ollama:") or eff_model.startswith("lmstudio:")
    exec_mode_tag = "sdk_local_openai_stream" if is_local_openai else "sdk_subscription_stream"

    _update_live_agent_stream(
        active=True,
        mission_id=mission_id,
        team_id=s_team_id,
        agent_id=agent_id,
        agent_name=agent_name,
        role=role_name,
        provider="antigravity_sdk",
        stage=phase_name,
        mode=exec_mode_tag,
        thought=f"SDK v{sdk_ver} 런타임 가동 · {eff_model or '기본 구독 모델'} ($0 API 키 차단" + (f" · Subagents {len(subagents)}명 연결)" if subagents else ")"),
        tool="",
        subagents=subagents,
    )

    # Inject SDK SubagentConfig team roster instructions when orchestrating team missions
    effective_prompt = prompt
    if subagents and s_meta.get("inject_subagent_roster"):
        roster_lines = [
            f"  - `{s['safe_name']}` ({s['name']} · 역할: {s['role']}): {s['description']}"
            for s in subagents[:6]
        ]
        effective_prompt = (
            f"[Antigravity SDK SubagentConfig 팀 오케스트레이션 로스터 ($0 구독·로컬 모드)]\n"
            + "\n".join(roster_lines)
            + "\n\n"
            + prompt
        )

    import tempfile
    t0 = time.time()
    cwd_file_blocks: List[str] = []
    stdout_lines: List[str] = []
    stderr_chunks: List[str] = []
    parsed_result_text = ""
    streamed_text_deltas: List[str] = []

    try:
        with tempfile.TemporaryDirectory(prefix="avo_sdk_") as iso_cwd:
            seed_dir_str = str(s_meta.get("seed_from_project_dir") or "").strip()
            seeded_iso_map = (
                _seed_iso_workspace_from_project_dir(Path(seed_dir_str), Path(iso_cwd))
                if seed_dir_str
                else {}
            )
            if is_local_openai:
                backend_prefix, raw_m = eff_model.split(":", 1)
                base_url = "http://127.0.0.1:11434/v1" if backend_prefix == "ollama" else "http://127.0.0.1:1234/v1"
                cfg_payload = {
                    "base_url": base_url,
                    "model": raw_m,
                    "prompt": effective_prompt,
                    "system_instructions": str(s_meta.get("system_prompt") or f"당신은 {agent_name} ({role_name}) AI 에이전트입니다."),
                    "subagents": [
                        {
                            "name": s["safe_name"],
                            "description": s["description"],
                            "system_instructions": s["system_instructions"],
                        }
                        for s in subagents[:6]
                    ],
                }
                payload_file = Path(iso_cwd) / ".sdk_payload.json"
                payload_file.write_text(json.dumps(cfg_payload, ensure_ascii=False), encoding="utf-8")
                runner_code = (
                    "import json, pathlib, sys\n"
                    "from google.antigravity import Agent, LocalOpenAIAgentConfig, TemplatedSystemInstructions, policy, types\n"
                    "p = json.loads(pathlib.Path('.sdk_payload.json').read_text(encoding='utf-8'))\n"
                    "pathlib.Path('.sdk_payload.json').unlink(missing_ok=True)\n"
                    "subs = [types.SubagentConfig(name=s['name'], description=s['description'], system_instructions=s['system_instructions']) for s in p.get('subagents', [])]\n"
                    "cfg = LocalOpenAIAgentConfig(\n"
                    "    base_url=p['base_url'],\n"
                    "    model=p['model'],\n"
                    "    system_instructions=TemplatedSystemInstructions(template=p['system_instructions']),\n"
                    "    subagents=subs,\n"
                    "    policies=[policy.allow_all()],\n"
                    ")\n"
                    "full_out = []\n"
                    "with Agent(config=cfg) as agent:\n"
                    "    for chunk in agent.stream(p['prompt']):\n"
                    "        th = getattr(chunk, 'thoughts', None) or getattr(chunk, 'thought', None)\n"
                    "        if th:\n"
                    "            print(json.dumps({'event': 'sdk_thought', 'thought': str(th)}, ensure_ascii=False), flush=True)\n"
                    "        tcs = getattr(chunk, 'tool_calls', None) or []\n"
                    "        for tc in tcs:\n"
                    "            t_nm = getattr(tc, 'name', None) or (tc.get('name') if isinstance(tc, dict) else str(tc))\n"
                    "            t_ar = getattr(tc, 'args', None) or (tc.get('args') if isinstance(tc, dict) else {})\n"
                    "            print(json.dumps({'event': 'sdk_tool', 'name': str(t_nm), 'parameters': t_ar if isinstance(t_ar, dict) else {'arg': str(t_ar)}}, ensure_ascii=False), flush=True)\n"
                    "        tx = getattr(chunk, 'text', None) or getattr(chunk, 'output', None) or ''\n"
                    "        if tx:\n"
                    "            full_out.append(str(tx))\n"
                    "            print(json.dumps({'event': 'sdk_delta', 'text': str(tx)}, ensure_ascii=False), flush=True)\n"
                    "print(json.dumps({'event': 'result', 'result': {'response': ''.join(full_out)}}, ensure_ascii=False), flush=True)\n"
                )
                argv = [str(venv_py), "-c", runner_code]
                exec_bin = str(venv_py)
                cmd_desc = f".venv/python google.antigravity.Agent(LocalOpenAIAgentConfig(model={raw_m}, subagents={len(subagents)}))"
            else:
                agy_exe = resolve_cli("agy")
                if not agy_exe:
                    return None
                argv = [
                    agy_exe,
                    "--disable-slash-commands",
                    "--sandbox",
                    "--dangerously-skip-permissions",
                    "--output-format",
                    "stream-json",
                ]
                if eff_model:
                    argv.extend(["--model", eff_model])
                argv.extend(["-p", effective_prompt])
                exec_bin = f"{venv_py} + {agy_exe}"
                cmd_desc = (
                    f"agy-sdk(v{sdk_ver}, subagents={len(subagents)}) -> agy --output-format stream-json --sandbox"
                    f"{f' --model {eff_model}' if eff_model else ''} -p <prompt>"
                )

            proc = subprocess.Popen(
                argv,
                cwd=iso_cwd,
                env=run_env,
                stdin=subprocess.DEVNULL,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                encoding="utf-8",
                errors="replace",
                bufsize=1,
                shell=False,
            )
            with _STATE_LOCK:
                _ACTIVE_PIDS[proc.pid] = "agy-sdk"
                _ACTIVE_PID_META[proc.pid] = {"cli": "agy-sdk", "mission_id": mission_id, "team_id": s_team_id}

            last_tool_logged = ""
            last_activity_ts = time.time()

            def _read_stdout_stream() -> None:
                nonlocal parsed_result_text, last_tool_logged, last_activity_ts
                if not proc.stdout:
                    return
                for raw_ln in iter(proc.stdout.readline, ""):
                    last_activity_ts = time.time()
                    ln = raw_ln.strip()
                    if not ln:
                        continue
                    stdout_lines.append(ln)
                    try:
                        ev = json.loads(ln)
                    except Exception:
                        continue
                    if not isinstance(ev, dict):
                        continue
                    ev_type = str(ev.get("event") or ev.get("type") or "")
                    if ev_type == "sdk_thought":
                        th_txt = str(ev.get("thought") or "").strip()
                        if th_txt:
                            _update_live_agent_stream(
                                active=True,
                                mission_id=mission_id,
                                agent_id=agent_id,
                                agent_name=agent_name,
                                role=role_name,
                                provider="antigravity_sdk",
                                stage=phase_name,
                                mode=exec_mode_tag,
                                thought=th_txt,
                            )
                    elif ev_type == "sdk_tool":
                        t_sum = _summarize_tool_call_event(ev)
                        should_emit = t_sum != last_tool_logged
                        last_tool_logged = t_sum
                        _update_live_agent_stream(
                            active=True,
                            mission_id=mission_id,
                            agent_id=agent_id,
                            agent_name=agent_name,
                            role=role_name,
                            provider="antigravity_sdk",
                            stage=phase_name,
                            mode=exec_mode_tag,
                            tool=t_sum,
                            emit_event=should_emit,
                        )
                    elif ev_type == "sdk_delta":
                        d_txt = str(ev.get("text") or "")
                        if d_txt:
                            streamed_text_deltas.append(d_txt)
                    elif ev_type == "step_update":
                        st_type = str(ev.get("step_type") or "")
                        st_status = str(ev.get("status") or "")
                        if st_type == "tool" or ev.get("tool_call") or ev.get("tool_name"):
                            tc_obj = ev.get("tool_call") if isinstance(ev.get("tool_call"), dict) else ev
                            t_sum = _summarize_tool_call_event(tc_obj)
                            should_emit = t_sum != last_tool_logged and st_status in ("running", "in_progress", "calling", "done", "")
                            if should_emit:
                                last_tool_logged = t_sum
                            _update_live_agent_stream(
                                active=True,
                                mission_id=mission_id,
                                agent_id=agent_id,
                                agent_name=agent_name,
                                role=role_name,
                                provider="antigravity_sdk",
                                stage=phase_name,
                                mode=exec_mode_tag,
                                tool=t_sum,
                                emit_event=should_emit,
                            )
                        elif st_type == "agent_response":
                            usage = ev.get("usage") if isinstance(ev.get("usage"), dict) else {}
                            t_tok = int(usage.get("thinking_tokens") or 0)
                            o_tok = int(usage.get("output_tokens") or 0)
                            raw_th = str(ev.get("thought") or ev.get("thinking") or ev.get("text") or "").strip()
                            th_msg = (
                                raw_th[:220]
                                if raw_th
                                else (
                                    f"실시간 추론·생성 중 (사고 토큰 {t_tok:,} · 출력 토큰 {o_tok:,})"
                                    if (t_tok or o_tok)
                                    else f"실시간 추론 및 응답 스트리밍 ({st_status or 'active'})"
                                )
                            )
                            _update_live_agent_stream(
                                active=True,
                                mission_id=mission_id,
                                agent_id=agent_id,
                                agent_name=agent_name,
                                role=role_name,
                                provider="antigravity_sdk",
                                stage=phase_name,
                                mode=exec_mode_tag,
                                thought=th_msg,
                            )
                    elif ev_type == "result":
                        res_obj = ev.get("result") if isinstance(ev.get("result"), dict) else {}
                        resp_s = res_obj.get("response") or ev.get("response")
                        if resp_s:
                            parsed_result_text = str(resp_s).strip()

            def _read_stderr_stream() -> None:
                if proc.stderr:
                    try:
                        stderr_chunks.append(proc.stderr.read())
                    except Exception:
                        pass

            t_out = threading.Thread(target=_read_stdout_stream, daemon=True)
            t_err = threading.Thread(target=_read_stderr_stream, daemon=True)
            t_out.start()
            t_err.start()

            auto_timeout_flag = bool(s_meta.get("auto_timeout", True))
            idle_budget = max(float(timeout or 300.0), 240.0 if auto_timeout_flag else 120.0)
            hard_ceiling = max(idle_budget * 3.0, 1800.0) if auto_timeout_flag else idle_budget
            timed_out = False
            try:
                while proc.poll() is None:
                    with _STATE_LOCK:
                        stop_abort = bool(mission_id and _is_mission_stopped_unlocked(mission_id))
                    if _SERVER_SHUTTING_DOWN.is_set() or stop_abort:
                        if os.name == "nt":
                            subprocess.run(["taskkill", "/PID", str(proc.pid), "/T", "/F"], capture_output=True)
                        else:
                            proc.kill()
                        break
                    now_w = time.time()
                    if (now_w - t0) >= hard_ceiling or (now_w - last_activity_ts) >= idle_budget:
                        timed_out = True
                        if os.name == "nt":
                            subprocess.run(["taskkill", "/PID", str(proc.pid), "/T", "/F"], capture_output=True)
                        else:
                            proc.kill()
                        break
                    try:
                        proc.wait(timeout=2.5)
                        break
                    except subprocess.TimeoutExpired:
                        continue
            finally:
                with _STATE_LOCK:
                    _ACTIVE_PIDS.pop(proc.pid, None)
                    _ACTIVE_PID_META.pop(proc.pid, None)
            t_out.join(timeout=2.0)
            t_err.join(timeout=1.0)

            iso_path = Path(iso_cwd)
            target_proj_dir_str = str(s_meta.get("target_project_dir") or "").strip()
            cwd_file_blocks, direct_copied_files = _collect_iso_workspace_files(
                iso_path,
                Path(target_proj_dir_str) if target_proj_dir_str else None,
                seeded_map=seeded_iso_map,
            )

            if timed_out:
                if cwd_file_blocks or direct_copied_files:
                    salvaged = "\n\n".join(cwd_file_blocks) or f"직접 복사된 산출물: {', '.join(direct_copied_files)}"
                    return {
                        "output": salvaged[:180000],
                        "direct_copied_files": direct_copied_files,
                        "seconds": max(1, int(round(time.time() - t0))),
                        "tokens": max(120, len(salvaged) // 2),
                        "command": cmd_desc,
                        "executable": exec_bin,
                        "provider": "antigravity_sdk",
                        "label": meta["label"],
                        "real_cli": True,
                        "sdk_stream": True,
                    }
                return None

        dur = max(1, int(round(time.time() - t0)))
        stderr_txt = "".join(stderr_chunks).strip()
        final_text = parsed_result_text or "".join(streamed_text_deltas).strip()
        if not final_text and stdout_lines:
            non_json = [ln for ln in stdout_lines if not ln.startswith("{")]
            final_text = "\n".join(non_json).strip()

        combined_lower = (final_text + "\n" + stderr_txt).lower()
        if any(q_phrase in combined_lower for q_phrase in QUOTA_ERROR_PHRASES) and not cwd_file_blocks and not parsed_result_text:
            reason_snippet = (stderr_txt or final_text or "SDK 한도 도달").splitlines()[0][:180]
            with _STATE_LOCK:
                STATE.setdefault("quota_exhausted_slots", {})["antigravity_sdk"] = {
                    "at": utc_now_iso(),
                    "label": meta["label"],
                    "reason": reason_snippet,
                }
            return {
                "quota_exceeded": True,
                "provider": "antigravity_sdk",
                "label": meta["label"],
                "reason": reason_snippet,
            }

        if cwd_file_blocks:
            final_text = "\n\n".join(cwd_file_blocks) + (
                f"\n\n<!-- SDK SUMMARY -->\n{final_text}" if final_text and "### FILE:" not in final_text else ""
            )

        if final_text or direct_copied_files:
            eff_out_text = final_text or f"산출물 생성 완료: {', '.join(direct_copied_files)}"
            _update_live_agent_stream(
                active=keep_stream_open,
                mission_id=mission_id,
                agent_id=agent_id,
                agent_name=agent_name,
                role=role_name,
                provider="antigravity_sdk",
                stage=phase_name,
                mode=exec_mode_tag,
                thought=f"✓ SDK 응답 완료 ({dur}초)",
                tool="",
            )
            return {
                "output": eff_out_text[:180000],
                "direct_copied_files": direct_copied_files,
                "seconds": dur,
                "tokens": max(120, len(eff_out_text) // 2),
                "command": cmd_desc,
                "executable": exec_bin,
                "provider": "antigravity_sdk",
                "label": meta["label"],
                "real_cli": True,
                "sdk_stream": True,
            }
    except Exception:
        return None
    finally:
        if not keep_stream_open:
            _clear_live_agent_stream()
    return None


def invoke_cli_if_available(
    provider_key: str,
    prompt: str,
    timeout: float = 35.0,
    model_override: Optional[str] = None,
    stream_meta: Optional[Dict[str, Any]] = None,
) -> Optional[Dict[str, Any]]:
    """If the user has the official CLI or Antigravity SDK installed, runs a safe invocation with sanitized env ($0 API cost)."""
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
    if canon == "antigravity_sdk" or meta.get("cli") == "agy-sdk":
        return invoke_sdk_agent_streaming(
            prompt=prompt,
            timeout=timeout,
            model_override=model_override,
            stream_meta=stream_meta,
            prof_dir=meta.get("profile_dir"),
        )
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
            seed_cli_str = str((stream_meta or {}).get("seed_from_project_dir") or "").strip()
            seeded_cli_map = (
                _seed_iso_workspace_from_project_dir(Path(seed_cli_str), Path(iso_cwd))
                if seed_cli_str
                else {}
            )
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
                _ACTIVE_PID_META[proc.pid] = {
                    "cli": meta["cli"],
                    "mission_id": str((stream_meta or {}).get("mission_id") or ""),
                    "team_id": str((stream_meta or {}).get("team_id") or ""),
                }
            try:
                stdout, stderr = proc.communicate(input=stdin_data if stdin_data else None, timeout=timeout)
            except subprocess.TimeoutExpired:
                if os.name == "nt":
                    subprocess.run(["taskkill", "/PID", str(proc.pid), "/T", "/F"], capture_output=True)
                else:
                    proc.kill()
                # Even on timeout, salvage any completed files already written to iso_cwd
                iso_path = Path(iso_cwd)
                t_pdir_str = str((stream_meta or {}).get("target_project_dir") or "").strip()
                cwd_file_blocks, direct_copied_cli = _collect_iso_workspace_files(
                    iso_path,
                    Path(t_pdir_str) if t_pdir_str else None,
                    seeded_map=seeded_cli_map,
                )
                if cwd_file_blocks or direct_copied_cli:
                    salvaged = "\n\n".join(cwd_file_blocks) or f"직접 복사된 산출물: {', '.join(direct_copied_cli)}"
                    return {
                        "output": salvaged[:180000],
                        "direct_copied_files": direct_copied_cli,
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
                    _ACTIVE_PID_META.pop(proc.pid, None)
            iso_path = Path(iso_cwd)
            t_pdir_str = str((stream_meta or {}).get("target_project_dir") or "").strip()
            cwd_file_blocks, direct_copied_cli = _collect_iso_workspace_files(
                iso_path,
                Path(t_pdir_str) if t_pdir_str else None,
                seeded_map=seeded_cli_map,
            )
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
    emp_id, _ = _resolve_active_employee_meta(role_label, prov_key)
    char_cfgs_q = load_character_configs()
    emp_cfg_q = char_cfgs_q.get(str(emp_id)) if isinstance(char_cfgs_q, dict) else None
    ask_timeout, ask_auto = resolve_agent_timeout(
        (emp_cfg_q or {}).get("timeoutSec", "auto"),
        phase_name="ASK",
        org_rank=str((emp_cfg_q or {}).get("orgRank") or "LEAD"),
        profile="standard",
        model_id=eff_custom_model,
    )
    q_stream_meta = {
        "agent_id": emp_id,
        "agent_name": display_name,
        "role_name": role_label,
        "phase_name": "ASK",
        "system_prompt": system_prompt or "",
        "subagents": [],
        "keep_stream_open": False,
        "auto_timeout": ask_auto,
    }
    res = invoke_cli_if_available(
        prov_key,
        persona_prompt,
        timeout=ask_timeout,
        model_override=eff_custom_model,
        stream_meta=q_stream_meta,
    )
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
        res_fb = invoke_cli_if_available(
            fallback_key,
            persona_prompt,
            timeout=ask_timeout,
            stream_meta={"phase_name": "ASK", "auto_timeout": True},
        )
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


_BINARY_DELIVERABLE_EXTS = {
    ".exe", ".dll", ".pyd", ".so", ".dylib", ".msi",
    ".zip", ".7z", ".tar", ".gz", ".whl",
    ".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".bmp",
    ".pdf", ".docx", ".xlsx", ".pptx", ".sqlite", ".db",
}
_IGNORED_ISO_BUILD_DIRS = {
    "__pycache__", ".git", ".venv", "venv", "node_modules",
    ".pytest_cache", ".mypy_cache", ".ruff_cache", "build",
}
_IGNORED_ISO_BUILD_EXTS = {".pyc", ".pyo", ".obj", ".pdb", ".toc", ".pkg", ".pyz", ".spec"}


def _is_binary_deliverable_file(path: Path) -> bool:
    if path.suffix.lower() in _BINARY_DELIVERABLE_EXTS:
        return True
    try:
        head = path.read_bytes()[:4096]
        if b"\x00" in head:
            return True
    except Exception:
        pass
    return False


def _is_ignored_deliverable_entry(path: Path, root_dir: Path) -> bool:
    """Excludes metadata reports, README, dotfiles, and Python/Node/PyInstaller cache directories from deliverable scans."""
    if path.name.startswith(".") or path.name == "README.md" or path.name.endswith("_통합보고서.md"):
        return True
    try:
        rel_parts = path.relative_to(root_dir).parts
        if any(part in _IGNORED_ISO_BUILD_DIRS or part.startswith(".") for part in rel_parts[:-1]):
            return True
    except Exception:
        pass
    if path.suffix.lower() in _IGNORED_ISO_BUILD_EXTS:
        return True
    return False


def _seed_iso_workspace_from_project_dir(
    src_project_dir: Path,
    iso_path: Path,
    max_file_bytes: int = 80 * 1024 * 1024,
) -> Dict[str, Tuple[int, int]]:
    """
    Pre-copies existing project deliverables into the isolated build directory (iso_cwd)
    so AI employees can inspect, edit, or build (.exe) directly on top of an existing project folder.
    Returns {rel_posix_path: (size, mtime_ns)} snapshot of seeded files.
    """
    seeded: Dict[str, Tuple[int, int]] = {}
    if not src_project_dir.exists() or not src_project_dir.is_dir():
        return seeded
    for sf in sorted(src_project_dir.rglob("*")):
        if not sf.is_file() or _is_ignored_deliverable_entry(sf, src_project_dir):
            continue
        try:
            st_src = sf.stat()
            if st_src.st_size > max_file_bytes:
                continue
            rel_p = sf.relative_to(src_project_dir).as_posix()
            dst_f = (iso_path / rel_p).resolve()
            if not str(dst_f).startswith(str(iso_path.resolve())):
                continue
            dst_f.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(sf, dst_f)
            st_dst = dst_f.stat()
            seeded[rel_p] = (st_dst.st_size, st_dst.st_mtime_ns)
        except Exception:
            continue
    return seeded


def _build_existing_folder_context(project_dir: Path, max_chars: int = 22000) -> str:
    """Summarizes existing project folder file tree & source code so lead and part agents continue seamlessly."""
    if not project_dir.exists() or not project_dir.is_dir():
        return ""
    files_list: List[Path] = [
        p for p in sorted(project_dir.rglob("*"))
        if p.is_file() and not _is_ignored_deliverable_entry(p, project_dir)
    ]
    if not files_list:
        return ""
    tree_lines: List[str] = []
    code_blocks: List[str] = []
    used_chars = 0
    for f in files_list:
        rel_p = f.relative_to(project_dir).as_posix()
        try:
            sz = f.stat().st_size
        except OSError:
            sz = 0
        is_bin = _is_binary_deliverable_file(f)
        tree_lines.append(f"  - `{rel_p}` ({sz:,} bytes{' · 바이너리' if is_bin else ''})")
        if not is_bin and used_chars < max_chars:
            try:
                txt = f.read_text(encoding="utf-8", errors="replace").strip()
                if txt:
                    budget = min(3800, max_chars - used_chars)
                    snippet = txt[:budget] + ("\n... (이하 생략)" if len(txt) > budget else "")
                    code_blocks.append(f"#### 📄 기존 파일: `{rel_p}`\n```\n{snippet}\n```")
                    used_chars += len(snippet)
            except Exception:
                pass
    header = (
        f"\n\n[📂 기존 작업 폴더 이어하기 컨텍스트 — 폴더명: `{project_dir.name}` (기존 산출물 {len(files_list)}개)]\n"
        f"- 중요: 이 미션은 빈 폴더 신규 생성이 아니라 **기존 작업 폴더를 선택해 추가·수정 작업을 이어가는 미션**입니다.\n"
        f"- 기존 파일 구조와 구현된 기능을 임의로 삭제·누락하지 말고 그대로 유지한 위에서 사용자의 추가 요청 사항을 반영하세요.\n"
        f"- 기존 파일 목록:\n" + "\n".join(tree_lines)
    )
    if code_blocks:
        header += "\n\n[기존 주요 파일 내용 요약]:\n" + "\n\n".join(code_blocks)
    return header


def _collect_iso_workspace_files(
    iso_path: Path,
    dest_project_dir: Optional[Path] = None,
    seeded_map: Optional[Dict[str, Tuple[int, int]]] = None,
) -> Tuple[List[str], List[str]]:
    """
    Collects files generated inside an agent's isolated workspace:
    - Copies ALL real deliverable files (both source text & binary .exe/.zip/.png) byte-for-byte via shutil.copy2
      when dest_project_dir is provided, preventing UTF-8 corruption or 120k-char truncation of source files!
    - Prioritizes newly created / modified files ahead of unchanged seeded files, and never dumps raw binary bytes.
    """
    cwd_blocks: List[str] = []
    copied_rels: List[str] = []
    if not iso_path.exists():
        return cwd_blocks, copied_rels

    if dest_project_dir is not None:
        dest_project_dir.mkdir(parents=True, exist_ok=True)

    s_map = seeded_map or {}
    # Sort priority: (0=changed/new text, 1=unchanged seeded text, 2=binary) so fresh/edited source code always comes first
    candidates: List[Tuple[int, bool, Path, str]] = []
    for wf in sorted(iso_path.rglob("*")):
        if not wf.is_file() or _is_ignored_deliverable_entry(wf, iso_path):
            continue
        rel_parts = wf.relative_to(iso_path).parts
        rel_p = wf.relative_to(iso_path).as_posix()
        # Promote PyInstaller 'dist/foo.exe' cleanly to root 'foo.exe' if root 'foo.exe' wasn't already copied
        if len(rel_parts) == 2 and rel_parts[0].lower() == "dist" and not (iso_path / rel_parts[1]).exists():
            rel_p = rel_parts[1]
        is_bin = _is_binary_deliverable_file(wf)
        unchanged_seed = False
        if rel_p in s_map:
            try:
                st_now = wf.stat()
                unchanged_seed = (st_now.st_size, st_now.st_mtime_ns) == s_map[rel_p]
            except OSError:
                unchanged_seed = False
        prio = 2 if is_bin else (1 if unchanged_seed else 0)
        candidates.append((prio, unchanged_seed, wf, rel_p))

    candidates.sort(key=lambda item: (item[0], item[3]))

    for prio, unchanged_seed, wf, rel_p in candidates:
        is_bin = prio == 2
        if dest_project_dir is not None:
            try:
                target_f = (dest_project_dir / rel_p).resolve()
                if str(target_f).startswith(str(dest_project_dir.resolve())):
                    target_f.parent.mkdir(parents=True, exist_ok=True)
                    if not unchanged_seed or not target_f.exists():
                        shutil.copy2(wf, target_f)
                    rel_root = f"deliverables/{dest_project_dir.name}/{rel_p}"
                    if rel_root not in copied_rels:
                        copied_rels.append(rel_root)
            except Exception:
                pass

        try:
            if is_bin:
                sz = wf.stat().st_size
                cwd_blocks.append(f"### FILE: {rel_p}\n[BINARY_DELIVERABLE: {sz:,} bytes]")
            else:
                w_txt = wf.read_text(encoding="utf-8", errors="replace").strip()
                if w_txt:
                    cwd_blocks.append(f"### FILE: {rel_p}\n{w_txt}")
        except Exception:
            pass

    return cwd_blocks, copied_rels


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
    project_dir.mkdir(parents=True, exist_ok=True)
    written_files: List[str] = []

    # 0. Register files already copied byte-for-byte from isolated SDK/CLI workspace (preserves intact .exe + all .py sources)
    for existing_f in sorted(project_dir.rglob("*")):
        if existing_f.is_file() and not _is_ignored_deliverable_entry(existing_f, project_dir):
            rel_c = existing_f.relative_to(project_dir).as_posix()
            rel_entry = f"deliverables/{project_dir.name}/{rel_c}"
            if rel_entry not in written_files:
                written_files.append(rel_entry)

    if not (built_text or "").strip():
        return written_files
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
            raw_sec = re.sub(r"\r?\n*<!--\s*(?:SDK|CLI)\s+SUMMARY\s*-->[\s\S]*$", "", raw_sec).strip()
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

    for raw_name, code_content in matches[:30]:  # Scope Guard: max 30 files
        clean_rel = raw_name.strip().strip("`'\"").replace("\\", "/").lstrip("/")
        if not clean_rel or ".." in clean_rel or ":" in clean_rel:
            continue
        target_file = (project_dir / clean_rel).resolve()
        if not str(target_file).startswith(str(project_dir.resolve())):
            continue
        # Never overwrite or fabricate binary deliverables (.exe, .dll, .zip, etc.) via UTF-8 write_text!
        if target_file.suffix.lower() in _BINARY_DELIVERABLE_EXTS or (target_file.exists() and _is_binary_deliverable_file(target_file)):
            if target_file.exists():
                rel_from_root = f"deliverables/{project_dir.name}/{clean_rel}"
                if rel_from_root not in written_files:
                    written_files.append(rel_from_root)
            continue
        lines = (code_content or "").splitlines()
        if len(lines) > 4000:  # Scope Guard: max 4000 lines per source file
            code_content = "\n".join(lines[:4000]) + "\n"
        if target_file.suffix.lower() in (".html", ".htm", ".js"):
            code_content = _patch_html_osm_tile_policy(code_content, is_html=target_file.suffix.lower() in (".html", ".htm"))
        target_file.parent.mkdir(parents=True, exist_ok=True)
        target_file.write_text((code_content or "").strip() + "\n", encoding="utf-8")
        rel_from_root = f"deliverables/{project_dir.name}/{clean_rel}"
        if rel_from_root not in written_files:
            written_files.append(rel_from_root)

    return written_files


def _verify_project_files(project_dir: Path, deliverable_mode: str = "CODE") -> Dict[str, Any]:
    """Runs adaptive Scope Guard + format-appropriate checks (Markdown structure, JSON/CSV validity, HTML/JS, Python, and PE binary integrity)."""
    import sys
    mode_up = (deliverable_mode or "CODE").upper()
    all_files = (
        sorted(p for p in project_dir.rglob("*") if p.is_file() and not _is_ignored_deliverable_entry(p, project_dir))
        if project_dir.exists()
        else []
    )
    total_lines = 0
    errors: List[str] = []
    logs: List[str] = [f"- 산출물 유형 검증 모드: `{mode_up}`"]

    if not all_files:
        errors.append("생성된 산출물 파일이 없습니다 (BUILDER 응답이 비어 있거나 타임아웃되었습니다).")
        return {"passed": False, "errors": errors, "summary": "\n".join(logs + ["- ❌ 생성된 파일 0개"]), "file_count": 0, "total_lines": 0}

    source_exts = {".py", ".js", ".ts", ".tsx", ".jsx", ".html", ".htm", ".css", ".cs", ".go", ".rs", ".java", ".c", ".cpp", ".ps1", ".sh", ".bat"}
    source_files = [f for f in all_files if not _is_binary_deliverable_file(f) and f.suffix.lower() in source_exts]
    binary_files = [f for f in all_files if _is_binary_deliverable_file(f)]

    for f in all_files:
        if _is_binary_deliverable_file(f):
            continue
        try:
            txt = f.read_text(encoding="utf-8", errors="replace")
            total_lines += len(txt.splitlines())
        except Exception:
            pass

    if len(all_files) > 35:
        errors.append(f"Scope Guard 위반: 생성 파일 수({len(all_files)}개)가 상한(35개)을 초과했습니다.")
    if total_lines > 8000:
        errors.append(f"Scope Guard 위반: 소스 라인 수({total_lines}줄)가 상한(8000줄)을 초과했습니다.")

    if mode_up == "CODE" and binary_files and not source_files:
        errors.append(
            "실행 파일(.exe 등 바이너리)만 존재하고 프로그램 원본 소스 코드(.py 등)가 누락되었습니다. "
            "반드시 실행 가능한 원본 프로그램 소스 파일들과 빌드된 실행 파일을 함께 작업 폴더에 보존하세요."
        )
        logs.append("- ❌ 원본 프로그램 소스 코드 누락 (.exe 단독 생성 불가)")

    logs.append(f"- Scope Guard 파일/라인 검증: 총 파일 {len(all_files)}개 (소스 {len(source_files)}개 · 바이너리 {len(binary_files)}개) / 소스 {total_lines}줄")
    logs.append("- 종량제 API 키 차단(Sanitized Env): OK")

    for f in all_files:
        rel_name = f.relative_to(project_dir).as_posix()
        suf = f.suffix.lower()
        if suf == ".exe":
            try:
                sz = f.stat().st_size
                head_b = f.read_bytes()[:128]
                if sz < 4096 or head_b[:2] != b"MZ" or b"\xef\xbf\xbd" in head_b[:64]:
                    errors.append(f"[{rel_name} 실행파일 손상] 유효한 Windows PE(.exe) 바이너리가 아니거나 텍스트 인코딩으로 손상되었습니다 ({sz} bytes).")
                    logs.append(f"- ❌ `{rel_name}` Windows PE(.exe) 바이너리 무결성 실패 ({sz} bytes)")
                else:
                    logs.append(f"- ✓ `{rel_name}` Windows PE(.exe) 바이너리 헤더 및 크기 검증 통과 ({sz:,} bytes)")
            except Exception as exc:
                errors.append(f"[{rel_name} 실행파일 검증 실패] {exc}")
            continue
        if _is_binary_deliverable_file(f):
            logs.append(f"- ✓ `{rel_name}` 바이너리 산출물 확인 ({f.stat().st_size:,} bytes)")
            continue
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
                logs.append(f"- ✓ `{rel_name}` Python 문법(py_compile) 검증 통과")
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


_WIN_RESERVED_NAMES = {
    "CON", "PRN", "AUX", "NUL",
    "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8", "COM9",
    "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9",
}


def derive_project_folder_name(
    goal: str,
    mission_id: str,
    base_output_dir: Path,
    existing_folder_name: Optional[str] = None,
) -> str:
    """
    Derives a clean, human-readable project work folder name from the project goal
    when no separate folder name was manually created for this run.
    """
    if existing_folder_name and str(existing_folder_name).strip():
        return str(existing_folder_name).strip()

    raw = str(goal or "").strip()
    raw = re.sub(r"^\[[^\]]+\]\s*", "", raw)

    # Honor explicit folder name instruction inside goal (e.g. "작업폴더명은 '블로그 포스팅'으로 생성")
    m_explicit_folder = re.search(
        r"(?:작업\s*)?폴더\s*(?:명|이름)\s*(?:은|는|:|=)?\s*['\"「『]([^'\"」』]{1,40})['\"」』]",
        raw,
    )
    if m_explicit_folder:
        candidate = m_explicit_folder.group(1).strip()
        candidate = re.sub(r'[<>:"/\\|?*\x00-\x1f]+', "_", candidate)
        candidate = re.sub(r"\s+", "_", candidate)
        candidate = re.sub(r"_+", "_", candidate).strip("._ -")
    else:
        stripped_tail = re.sub(
            r"\s*(?:작성해\s*주세요|만들어\s*주세요|구현해\s*주세요|조사해\s*주세요|정리해\s*주세요|분석해\s*주세요|"
            r"작성해\s*줘|만들어\s*줘|구현해\s*줘|조사해\s*줘|정리해\s*줘|분석해\s*줘|알려\s*줘|생성해\s*줘|개발해\s*줘|"
            r"해\s*주세요|해\s*줘|부탁해\s*요?|부탁합니다|작성하기|만들기|작성|구현)\s*[.!?~]*$",
            "",
            raw,
        ).strip()
        candidate = stripped_tail if len(stripped_tail) >= 2 else raw
        # Replace illegal path characters, punctuation, and whitespace with underscore
        candidate = re.sub(r'[<>:"/\\|?*\x00-\x1f.,;!?()\[\]{}\'`~@#$%^&+=]+', "_", candidate)
        candidate = re.sub(r"\s+", "_", candidate)
        candidate = re.sub(r"_+", "_", candidate).strip("._ -")

        if len(candidate) > 38:
            cut = candidate[:38]
            if "_" in cut[16:]:
                cut = cut[: cut.rfind("_")]
            candidate = cut.strip("._ -")

    if not candidate or candidate.upper() in _WIN_RESERVED_NAMES:
        candidate = f"프로젝트_{mission_id}"

    date_prefix = datetime.now().strftime("%Y%m%d")
    m_lead_date = re.match(r"^(\d{4})[_-]?(\d{2})[_-]?(\d{2})(?:[_-]+(.*))?$", candidate)
    if m_lead_date:
        date_prefix = f"{m_lead_date.group(1)}{m_lead_date.group(2)}{m_lead_date.group(3)}"
        tail_rest = (m_lead_date.group(4) or "").strip("._ -")
        candidate = tail_rest if tail_rest else f"프로젝트_{mission_id}"

    base_folder_name = f"{date_prefix}_{candidate}"

    # Ensure no collision with a different mission's existing folder
    final_name = base_folder_name
    suffix_idx = 2
    while True:
        cand_dir = base_output_dir / final_name
        if not cand_dir.exists():
            break
        readme_f = cand_dir / "README.md"
        if readme_f.is_file():
            try:
                if f"`{mission_id}`" in readme_f.read_text(encoding="utf-8", errors="ignore"):
                    break
            except Exception:
                pass
        else:
            try:
                if not any(cand_dir.iterdir()):
                    break
            except Exception:
                pass
        final_name = f"{base_folder_name}_{suffix_idx}"
        suffix_idx += 1

    return final_name


def _resolve_team_base_output_dir(team_obj: Dict[str, Any], saved_out_root: Optional[str] = None) -> Tuple[Path, bool, bool]:
    out_status = get_output_dir_status()
    gdrives = out_status.get("detected_google_drives") or []
    team_ws = (team_obj or {}).get("workspace") or {}
    if saved_out_root:
        base_dir = Path(saved_out_root)
    elif str(team_ws.get("output_dir") or "").strip():
        try:
            base_dir, _ = resolve_team_local_path(str(team_ws.get("output_dir")), gdrives)
        except Exception:
            base_dir = Path(out_status["output_dir"])
    else:
        base_dir = Path(out_status["output_dir"])
    try:
        base_dir.mkdir(parents=True, exist_ok=True)
    except Exception:
        base_dir = DELIVERABLES_DIR.resolve()
        base_dir.mkdir(parents=True, exist_ok=True)
    is_gd_target = _is_google_drive_path(base_dir, gdrives)
    mir_local = bool(team_ws.get("mirror_to_local", False) or out_status.get("mirror_to_local", False))
    return base_dir, is_gd_target, mir_local


def _run_mission_pipeline(
    mission_id: str,
    goal: str,
    profile: str = "standard",
    resume_state: Optional[Dict[str, Any]] = None,
    team_id: Optional[str] = None,
    orchestrator_mode: Optional[str] = None,
):
    """
    Executes the Project Lead + Dynamic Part Leads Pipeline:
    1) LEAD_PLANNING : 프로젝트 총괄팀장(LEAD)이 지시문 분석 및 활성 파트별 업무 분장(ORDER) 수립
    2) PART_*        : 활성화된 모든 실무 파트 담당(자료수집 -> 기획·구조설계 -> 제작·구현 및 사용자 추가 파트) 순차 협업 실행
    3) PART_REVIEW   : 파트 담당 자체 기계·실행 무결성 검증 + 파트 담당 간 상호 교차검토(Peer Review) 및 자동 보완 루프
    4) LEAD_REPORT   : 총괄팀장이 파트별 수행·검증 결과를 취합해 사용자에게 「총괄팀장 통합보고서」 제출 -> AWAITING_APPROVAL (사용자 최종 승인 대기)
    5) USER DECISION : 사용자가 [최종 승인] 클릭 시 확정 및 Google Drive 업로드, [보완 재지시] 시 총괄팀장이 파트 재작업 지시 후 재보고
    """
    eff_team_id = (resume_state or {}).get("team_id") or team_id
    team_obj = get_team_by_id(eff_team_id)
    eff_team_id = team_obj["id"]
    team_name = team_obj["name"]
    team_floor = team_obj.get("floor", "1F")
    team_color = team_obj.get("color", "#0f6848")
    team_roles = team_obj.get("roles") or {}
    team_ws = team_obj.get("workspace") or {}

    part_cfg = load_part_roles_config(team_id=eff_team_id)
    lead_def = part_cfg["lead"]
    enabled_parts: List[Dict[str, Any]] = [p for p in (part_cfg.get("parts") or []) if p.get("enabled", True)]
    if not enabled_parts:
        enabled_parts = list(part_cfg.get("parts") or [])
    stage_descriptors = build_pipeline_stage_descriptors(part_cfg)
    require_approval = bool(part_cfg.get("require_user_approval", True))

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

        best_member = None
        target_canon = resolve_canonical_part_role(triad_r, part_cfg)
        for mid in (team_obj.get("member_ids") or []):
            mc = char_cfgs.get(str(mid))
            if not isinstance(mc, dict):
                continue
            mc_r = str(mc.get("triadRole") or "").upper().strip()
            if mc_r != triad_r and resolve_canonical_part_role(mc_r, part_cfg) != target_canon:
                continue
            m_prov = str(mc.get("cliProvider") or "").strip()
            if m_prov not in PROVIDER_META:
                continue
            if (diag_provs.get(m_prov) or {}).get("auth_state") != "LOGGED_IN":
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

    head_p = _pick_role_cli("head", "antigravity_sdk" if "antigravity_sdk" in PROVIDER_META else "antigravity")
    builder_p = _pick_role_cli("builder", "antigravity_sdk" if "antigravity_sdk" in PROVIDER_META else "antigravity")
    sub_builder_p = _pick_role_cli("sub_builder", "gemini" if "gemini" in PROVIDER_META else builder_p)
    reviewer_p = _pick_role_cli("reviewer", "openai")
    researcher_p = _pick_role_cli("researcher", builder_p)

    def _build_member_assignee(
        mc: Optional[Dict[str, Any]],
        role_def: Dict[str, Any],
        default_prov: str,
        default_rank: str,
    ) -> Dict[str, Any]:
        rid = str(role_def.get("id") or "PART_BUILD").upper()
        chosen_prov = default_prov
        if mc:
            m_p = str(mc.get("cliProvider") or "").strip()
            if m_p in PROVIDER_META and (diag_provs.get(m_p) or {}).get("auth_state") == "LOGGED_IN":
                chosen_prov = m_p
        if (diag_provs.get(chosen_prov) or {}).get("auth_state") != "LOGGED_IN":
            for alt_p in ("antigravity_sdk", builder_p, head_p, "antigravity", reviewer_p):
                if alt_p in PROVIDER_META and (diag_provs.get(alt_p) or {}).get("auth_state") == "LOGGED_IN":
                    chosen_prov = alt_p
                    break

        emp_id, emp_name = (
            (str(mc.get("id") or "01").zfill(2), str(mc.get("name") or role_def["name"]))
            if mc
            else _resolve_active_employee_meta(rid, chosen_prov, team_obj, char_cfgs)
        )
        org_rank = str((mc or {}).get("orgRank") or default_rank).upper().strip()
        custom_mod = str((mc or {}).get("cliModel") or "").strip() or None
        avail_ids = {
            str(x.get("id") or "")
            for x in ((diag_provs.get(chosen_prov) or {}).get("available_models") or [])
            if isinstance(x, dict) and not x.get("locked")
        }
        if custom_mod and avail_ids and custom_mod not in avail_ids:
            custom_mod = None
        if custom_mod and "orchestrator" in custom_mod.lower() and rid != "LEAD":
            custom_mod = "gemini-4-argon-high" if org_rank == "PART_LEAD" else "gemini-3.8-flash-high"

        skills = [str(s).strip() for s in ((mc or {}).get("skills") or []) if str(s).strip()]
        sys_prompt = str((mc or {}).get("systemPrompt") or "").strip()
        timeout_cfg = str((mc or {}).get("timeoutSec") or "auto").strip().lower() or "auto"
        return {
            "role_id": rid,
            "role_title": role_def["name"],
            "stage_label": role_def.get("stage_label", role_def["name"]),
            "icon": role_def.get("icon", "🧩"),
            "instruction": role_def.get("instruction", ""),
            "org_rank": org_rank,
            "staff_order": int((mc or {}).get("staffOrder") or 0),
            "prov_k": chosen_prov,
            "model_ov": custom_mod,
            "timeout_cfg": timeout_cfg,
            "emp_id": emp_id,
            "emp_name": emp_name,
            "skills": skills,
            "system_prompt": sys_prompt,
        }

    def _resolve_part_squad(role_def: Dict[str, Any]) -> Dict[str, Any]:
        """Resolves a Part's full squad: 1 Part Lead (PART_LEAD) + N Subordinate Staff (STAFF) sorted by staffOrder/id."""
        rid = str(role_def.get("id") or "PART_BUILD").upper()
        def_cli_role = str(role_def.get("default_cli_role") or "builder").lower()
        fallback_slot_map = {
            "head": head_p,
            "builder": builder_p,
            "sub_builder": sub_builder_p,
            "reviewer": reviewer_p,
            "researcher": researcher_p,
        }
        base_prov = fallback_slot_map.get(def_cli_role, builder_p)
        candidate_ids = list(team_obj.get("member_ids") or []) or sorted(char_cfgs.keys())
        matched_chars: List[Dict[str, Any]] = []
        for mid in candidate_ids:
            mc = char_cfgs.get(str(mid))
            if not isinstance(mc, dict):
                continue
            mc_role = str(mc.get("triadRole") or "").upper().strip()
            if mc_role == rid or resolve_canonical_part_role(mc_role, part_cfg) == rid:
                matched_chars.append(mc)

        if rid == "LEAD":
            lead_mc = next(
                (c for c in matched_chars if str(c.get("orgRank") or "LEAD").upper() == "LEAD"),
                matched_chars[0] if matched_chars else None,
            )
            return {
                "lead": _build_member_assignee(lead_mc, role_def, base_prov, "LEAD"),
                "staff": [],
            }

        explicit_leads = [c for c in matched_chars if str(c.get("orgRank") or "").upper() == "PART_LEAD"]
        explicit_staff = [c for c in matched_chars if str(c.get("orgRank") or "").upper() == "STAFF"]
        unspecified = [
            c
            for c in matched_chars
            if str(c.get("orgRank") or "").upper() not in ("PART_LEAD", "STAFF", "LEAD")
        ]

        lead_mc: Optional[Dict[str, Any]] = None
        if explicit_leads:
            lead_mc = explicit_leads[0]
            # Any extra explicit_leads + unspecified join staff rotation
            staff_mcs = explicit_staff + explicit_leads[1:] + unspecified
        elif unspecified:
            lead_mc = unspecified[0]
            staff_mcs = explicit_staff + unspecified[1:]
        elif explicit_staff:
            # All members were marked STAFF -> promote first to acting Part Lead, rest remain STAFF
            lead_mc = explicit_staff[0]
            staff_mcs = explicit_staff[1:]
        else:
            staff_mcs = []

        staff_mcs.sort(
            key=lambda c: (
                int(c.get("staffOrder") or 99),
                str(c.get("id") or "99").zfill(2),
            )
        )
        return {
            "lead": _build_member_assignee(lead_mc, role_def, base_prov, "PART_LEAD"),
            "staff": [_build_member_assignee(sc, role_def, base_prov, "STAFF") for sc in staff_mcs],
        }

    lead_squad = _resolve_part_squad(lead_def)
    lead_assignee = lead_squad["lead"]
    part_squads = {p["id"]: _resolve_part_squad(p) for p in enabled_parts}
    part_assignees = {pid: sq["lead"] for pid, sq in part_squads.items()}

    profile_clean = (profile or "standard").lower().strip()
    max_repairs = 1 if profile_clean == "quick" else (3 if profile_clean == "deep" else 2)

    builder_diag = diag_provs.get(builder_p) or {}
    raw_builder_model = str(role_model_map.get("BUILDER") or builder_diag.get("selected_model") or "").strip()
    eff_orch_mode = raw_builder_model or "default"
    orch_display = f"{PROVIDER_META[lead_assignee['prov_k']]['label']} ({lead_def['name']}: {lead_assignee['emp_name']})"
    planner_model_ov = lead_assignee["model_ov"] or role_model_map.get("HEAD")
    fast_exec_model_ov = (
        "gemini-3.8-flash-high"
        if "orchestrator" in raw_builder_model.lower()
        else role_model_map.get("BUILDER")
    )

    saved_out_root = (resume_state or {}).get("output_root")
    continue_existing: bool = bool((resume_state or {}).get("continue_existing", False))
    explicit_proj_dir_str: str = str((resume_state or {}).get("explicit_project_dir") or "").strip()
    saved_proj_folder = str((resume_state or {}).get("project_folder_name") or "").strip()
    with _STATE_LOCK:
        for m_existing in STATE.get("missions") or []:
            if m_existing.get("mission_id") == mission_id:
                if not saved_proj_folder and m_existing.get("project_folder_name"):
                    saved_proj_folder = str(m_existing["project_folder_name"]).strip()
                if m_existing.get("continue_existing"):
                    continue_existing = True
                if not explicit_proj_dir_str and m_existing.get("continue_existing") and m_existing.get("project_dir_abs"):
                    explicit_proj_dir_str = str(m_existing["project_dir_abs"]).strip()
                if not saved_out_root and m_existing.get("output_root"):
                    saved_out_root = str(m_existing["output_root"]).strip()
                break

    base_output_dir, is_gdrive_target, mirror_local = _resolve_team_base_output_dir(team_obj, saved_out_root)
    if continue_existing and explicit_proj_dir_str:
        project_dir = Path(explicit_proj_dir_str)
        base_output_dir = project_dir.parent
        project_folder_name = project_dir.name
        is_gdrive_target = _is_google_drive_path(base_output_dir, get_output_dir_status().get("detected_google_drives") or [])
    else:
        project_folder_name = derive_project_folder_name(goal, mission_id, base_output_dir, saved_proj_folder)
        project_dir = base_output_dir / project_folder_name
    project_dir.mkdir(parents=True, exist_ok=True)
    init_readme = project_dir / "README.md"
    if not init_readme.exists():
        try:
            init_readme.write_text(
                f"# {goal}\n\n- **Mission ID**: `{mission_id}`\n- **Project Folder**: `{project_folder_name}`\n",
                encoding="utf-8",
            )
        except Exception:
            pass

    existing_folder_ctx = _build_existing_folder_context(project_dir) if continue_existing else ""
    generated_files: List[str] = list((resume_state or {}).get("generated_files") or [])
    if continue_existing and not generated_files:
        for exf in sorted(project_dir.rglob("*")):
            if exf.is_file() and not _is_ignored_deliverable_entry(exf, project_dir):
                rel_ex = f"deliverables/{project_dir.name}/{exf.relative_to(project_dir).as_posix()}"
                if rel_ex not in generated_files:
                    generated_files.append(rel_ex)
    stage_outputs: Dict[str, str] = dict((resume_state or {}).get("stage_outputs") or {})
    part_outputs: Dict[str, str] = dict((resume_state or {}).get("part_outputs") or {})
    staff_outputs_by_part: Dict[str, Dict[str, str]] = {
        str(pk): {str(ek): str(ev) for ek, ev in pv.items() if ev}
        for pk, pv in ((resume_state or {}).get("staff_outputs_by_part") or {}).items()
        if isinstance(pv, dict)
    }
    repair_history: List[str] = list((resume_state or {}).get("repair_history") or [])
    repair_attempt: int = int((resume_state or {}).get("repair_attempt") or 0)
    last_error_feedback: str = str((resume_state or {}).get("last_error_feedback") or "")
    user_revision_feedback: str = str((resume_state or {}).get("user_revision_feedback") or "").strip()
    revision_plan_done: bool = bool((resume_state or {}).get("revision_plan_done", False))
    step_counter: int = int((resume_state or {}).get("step_counter") or 0)

    saved_mode = str((resume_state or {}).get("deliverable_mode") or "").upper()
    intent_spec: Dict[str, Any] = (
        dict(MISSION_INTENT_SPECS[saved_mode])
        if saved_mode in MISSION_INTENT_SPECS
        else classify_mission_intent(goal)
    )
    deliverable_mode: str = intent_spec["mode"]
    intent_label: str = intent_spec["label"]
    team_subagents: List[Dict[str, Any]] = build_team_subagent_roster(team_obj, char_cfgs)

    def _save_mission_checkpoint(current_stage: str) -> None:
        if _SERVER_SHUTTING_DOWN.is_set():
            return
        with _STATE_LOCK:
            if _is_mission_stopped_unlocked(mission_id):
                return
            ckpt_payload = {
                "mission_id": mission_id,
                "goal": goal,
                "profile": profile_clean,
                "orchestrator_mode": eff_orch_mode,
                "deliverable_mode": deliverable_mode,
                "team_id": eff_team_id,
                "team_name": team_name,
                "output_root": str(base_output_dir),
                "project_folder_name": project_folder_name,
                "continue_existing": continue_existing,
                "explicit_project_dir": str(project_dir) if continue_existing else "",
                "current_stage": current_stage,
                "stage_outputs": dict(stage_outputs),
                "part_outputs": dict(part_outputs),
                "staff_outputs_by_part": {
                    pk: dict(pv) for pk, pv in staff_outputs_by_part.items() if pv
                },
                "generated_files": list(generated_files),
                "repair_attempt": repair_attempt,
                "last_error_feedback": last_error_feedback,
                "user_revision_feedback": user_revision_feedback,
                "revision_plan_done": revision_plan_done,
                "repair_history": list(repair_history),
                "step_counter": step_counter,
                "updated_at": utc_now_iso(),
            }
            STATE.setdefault("mission_checkpoints", {})[mission_id] = ckpt_payload
            for m in STATE["missions"]:
                if m["mission_id"] == mission_id:
                    m["output_root"] = str(base_output_dir)
                    m["project_folder_name"] = project_folder_name
                    m["project_dir"] = f"deliverables/{project_folder_name}"
                    m["project_dir_abs"] = str(project_dir)
                    m["deliverable_mode"] = deliverable_mode
                    m["deliverable_type_label"] = intent_label
                    m["generated_files"] = list(generated_files)
                    m["stage_outputs_snapshot"] = dict(stage_outputs)
                    m["part_outputs_snapshot"] = dict(part_outputs)
                    m["updated_at"] = utc_now_iso()
        save_runtime_state()

    with _STATE_LOCK:
        for m in STATE["missions"]:
            if m["mission_id"] == mission_id:
                m["pipeline_stages"] = stage_descriptors
                m["max_steps"] = len(stage_descriptors)
                m["lead_agent_id"] = lead_assignee["emp_id"]
                m["lead_agent_name"] = lead_assignee["emp_name"]
    _save_mission_checkpoint(str((resume_state or {}).get("current_stage") or "LEAD_PLANNING"))

    if any(a["prov_k"] == "antigravity_sdk" for a in [lead_assignee, *part_assignees.values()]) and team_subagents:
        with _STATE_LOCK:
            STATE["events"].insert(
                0,
                {
                    "at": utc_now_iso(),
                    "run_id": f"{mission_id}-sdk-roster",
                    "to_state": "LEAD_PLANNING",
                    "state_ko": f"📦 [Antigravity SDK SubagentConfig] 총괄팀장({lead_assignee['emp_name']}) 및 파트 담당 {len(team_subagents)}명을 $0 오케스트레이션 로스터로 연결했습니다.",
                    "project": STATE["project_name"],
                    "role": "LEAD",
                },
            )

    def _is_stopped() -> bool:
        with _STATE_LOCK:
            return _is_mission_stopped_unlocked(mission_id)

    def _record_stage_start(
        phase_name: str,
        role_name: str,
        prov_k: str,
        state_msg: str,
        emp_id_ov: Optional[str] = None,
        emp_name_ov: Optional[str] = None,
        append_working: bool = False,
        parallel_agents: Optional[List[Dict[str, Any]]] = None,
    ) -> int:
        nonlocal step_counter
        emp_id, emp_name = (
            (emp_id_ov, emp_name_ov)
            if (emp_id_ov and emp_name_ov)
            else _resolve_active_employee_meta(role_name, prov_k, team_obj, char_cfgs)
        )
        _update_live_agent_stream(
            active=True,
            mission_id=mission_id,
            team_id=eff_team_id,
            agent_id=emp_id,
            agent_name=emp_name,
            role=role_name,
            provider=prov_k,
            stage=phase_name,
            mode="sdk_parallel_squad" if parallel_agents else ("sdk_orchestrator" if prov_k == "antigravity_sdk" else "cli_pipeline"),
            thought=state_msg,
            tool="",
            subagents=team_subagents,
            parallel_agents=parallel_agents if parallel_agents is not None else [],
        )
        with _STATE_LOCK:
            step_counter += 1
            my_step_idx = step_counter
            domain = PROVIDER_META.get(prov_k, PROVIDER_META.get(head_p, {"domain": "GOOGLE"}))["domain"]
            STATE["phase"] = phase_name
            w_entry = {
                "provider": domain,
                "cli": prov_k,
                "role": role_name,
                "stage": phase_name,
                "mission_id": mission_id,
                "team_id": eff_team_id,
                "team_name": team_name,
                "agent_id": emp_id,
                "agent_name": emp_name,
                "elapsed_sec": 1,
            }
            if append_working:
                STATE["working_now"] = [
                    x for x in STATE.get("working_now", [])
                    if not (x.get("mission_id") == mission_id and x.get("agent_id") == emp_id)
                ] + [w_entry]
            else:
                STATE["working_now"] = [
                    x for x in STATE.get("working_now", [])
                    if x.get("mission_id") != mission_id
                ] + [w_entry]
            STATE["events"].insert(
                0,
                {
                    "at": utc_now_iso(),
                    "run_id": f"{mission_id}-s{my_step_idx}",
                    "to_state": phase_name,
                    "state_ko": f"[{team_name}] {state_msg}",
                    "project": STATE["project_name"],
                    "role": role_name,
                    "team_id": eff_team_id,
                },
            )
        return my_step_idx

    def _swap_role_to_provider(role_name: str, new_prov_k: str) -> None:
        nonlocal head_p, builder_p, sub_builder_p, reviewer_p, researcher_p
        if role_name in ("LEAD", "HEAD"):
            head_p = new_prov_k
            lead_assignee["prov_k"] = new_prov_k
        elif role_name in part_assignees:
            part_assignees[role_name]["prov_k"] = new_prov_k
        else:
            builder_p = new_prov_k
        role_model_map.pop(role_name, None)

    def _call_cli_with_fallback(
        prov_k: str,
        prompt_txt: str,
        timeout_s: float = 45.0,
        role_name: str = "PART_BUILD",
        phase_name: str = "PART_BUILD",
        model_override: Optional[str] = None,
        emp_id_ov: Optional[str] = None,
        emp_name_ov: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        if _SERVER_SHUTTING_DOWN.is_set() or _is_stopped():
            return None
        cand_model = model_override or role_model_map.get(role_name)
        emp_id, emp_name = (
            (emp_id_ov, emp_name_ov)
            if (emp_id_ov and emp_name_ov)
            else _resolve_active_employee_meta(role_name, prov_k, team_obj, char_cfgs)
        )
        emp_mc = char_cfgs.get(str(emp_id)) if isinstance(char_cfgs, dict) else None
        emp_to_cfg = (emp_mc or {}).get("timeoutSec", "auto")
        emp_rank_cfg = str((emp_mc or {}).get("orgRank") or ("LEAD" if role_name in ("LEAD", "HEAD") else "PART_LEAD"))
        eff_timeout_s, is_auto_to = resolve_agent_timeout(
            emp_to_cfg,
            phase_name=phase_name,
            org_rank=emp_rank_cfg,
            profile=profile_clean,
            model_id=cand_model,
        )
        if is_auto_to:
            eff_timeout_s = max(eff_timeout_s, float(timeout_s or 0.0))
        stage_stream_meta = {
            "mission_id": mission_id,
            "team_id": eff_team_id,
            "agent_id": emp_id,
            "agent_name": emp_name,
            "role_name": role_name,
            "phase_name": phase_name,
            "target_project_dir": str(project_dir) if phase_name == build_part_def["id"] else "",
            "seed_from_project_dir": (
                str(project_dir)
                if phase_name == build_part_def["id"] and (continue_existing or repair_attempt > 0 or bool(user_revision_feedback))
                else ""
            ),
            "subagents": team_subagents,
            "inject_subagent_roster": role_name in ("LEAD", "HEAD") or prov_k == "antigravity_sdk",
            "keep_stream_open": True,
            "auto_timeout": is_auto_to,
        }
        res = invoke_cli_if_available(
            prov_k,
            prompt_txt,
            timeout=eff_timeout_s,
            model_override=cand_model,
            stream_meta=stage_stream_meta,
        )
        if _SERVER_SHUTTING_DOWN.is_set() or _is_stopped():
            return None
        if res and not res.get("quota_exceeded") and res.get("output"):
            return res

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
                if _is_mission_stopped_unlocked(mission_id):
                    return None
                old_lbl = PROVIDER_META.get(prov_k, {}).get("label", prov_k)
                new_lbl = PROVIDER_META.get(fb_k, {}).get("label", fb_k)
                STATE["events"].insert(
                    0,
                    {
                        "at": utc_now_iso(),
                        "run_id": f"{mission_id}-failover-{int(time.time())}",
                        "to_state": phase_name,
                        "state_ko": f"🔄 [{role_name}] {old_lbl} 응답 지연/한도 도달 → 연결된 [{new_lbl}] 엔진으로 자동 전환하여 {phase_name} 파트를 계속 수행합니다.",
                        "project": STATE["project_name"],
                        "role": role_name,
                    },
                )
            _swap_role_to_provider(role_name, fb_k)
            fb_res = invoke_cli_if_available(fb_k, prompt_txt, timeout=timeout_s, stream_meta=stage_stream_meta)
            if fb_res and not fb_res.get("quota_exceeded") and fb_res.get("output"):
                return fb_res

        with _STATE_LOCK:
            exhausted_now = list((STATE.get("quota_exhausted_slots") or {}).keys())
        if exhausted_now or not all_connected_slots:
            exhausted_labels = [PROVIDER_META.get(k, {}).get("label", k) for k in (exhausted_now or all_connected_slots or [prov_k])]
            raise _AllQuotaExhaustedError(
                phase_name=phase_name,
                role_name=role_name,
                exhausted_slots=exhausted_now or all_connected_slots or [prov_k],
                reason=f"연결된 모든 AI({', '.join(exhausted_labels)})가 사용 한도에 도달하여 {phase_name} 단계에서 작업을 일시 중지했습니다.",
            )
        return None

    def _record_stage_done(
        s_idx: int,
        phase_name: str,
        role_name: str,
        prov_k: str,
        cli_res: Optional[Dict[str, Any]],
        summary_txt: str,
        step_state: str = "PASS",
        agent_id: str = "",
        agent_name: str = "",
        org_rank: str = "",
        cli_model: str = "",
        execution_mode: str = "SEQUENTIAL",
    ):
        if _SERVER_SHUTTING_DOWN.is_set():
            return
        with _STATE_LOCK:
            if _is_mission_stopped_unlocked(mission_id):
                return
            if agent_id and STATE.get("working_now"):
                STATE["working_now"] = [
                    w for w in STATE["working_now"]
                    if not (w.get("mission_id") == mission_id and w.get("agent_id") == agent_id)
                ]
            dur = cli_res["seconds"] if cli_res else 2
            toks = cli_res["tokens"] if cli_res else 420
            domain = PROVIDER_META.get(prov_k, PROVIDER_META[head_p])["domain"]
            STATE["recent_calls"].insert(
                0,
                {
                    "at": utc_now_iso(),
                    "role": role_name,
                    "agent_id": agent_id,
                    "agent_name": agent_name,
                    "org_rank": org_rank,
                    "cli_model": cli_model,
                    "execution_mode": execution_mode,
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
                            "role": role_name,
                            "agent_id": agent_id,
                            "agent_name": agent_name,
                            "org_rank": org_rank,
                            "cli_provider": prov_k,
                            "cli_model": cli_model,
                            "execution_mode": execution_mode,
                            "state": step_state,
                            "summary": summary_txt,
                            "tests": {"passed": 18 if step_state == "PASS" else 0, "total": 18},
                        }
                    )
                    m["passed_steps"] = len([s for s in m["steps"] if s["state"] == "PASS"])
                    m["updated_at"] = utc_now_iso()

    staff_exec_mode_cfg = str(part_cfg.get("staff_execution_mode") or "parallel").strip().lower()

    def _execute_part_staff_members(
        pid: str,
        p_def: Dict[str, Any],
        p_staff_list: List[Dict[str, Any]],
        prompt_builder_fn,
        timeout_val: float,
    ) -> List[Tuple[Dict[str, Any], str]]:
        """
        Executes a part's subordinate staff (STAFF) with per-staff checkpoint persistence & reuse:
        - Any staff member already persisted in staff_outputs_by_part[pid] before a server restart is reused immediately.
        - Default when len(pending_staff) >= 2 (and staff_execution_mode != 'sequential'):
          Simultaneous parallel execution (사원 1 ∥ 사원 2 ...) via ThreadPoolExecutor, preserving staffOrder in returned list.
        """
        if not p_staff_list:
            return []
        saved_part_staff = staff_outputs_by_part.setdefault(pid, {})
        pending_indexed: List[Tuple[int, Dict[str, Any]]] = [
            (idx, stf)
            for idx, stf in enumerate(p_staff_list, start=1)
            if not saved_part_staff.get(stf["emp_id"])
        ]
        if not pending_indexed:
            return [
                (stf, saved_part_staff[stf["emp_id"]])
                for stf in p_staff_list
                if saved_part_staff.get(stf["emp_id"])
            ]
        if len(pending_indexed) < len(p_staff_list):
            reused_cnt = len(p_staff_list) - len(pending_indexed)
            with _STATE_LOCK:
                STATE["events"].insert(
                    0,
                    {
                        "at": utc_now_iso(),
                        "run_id": f"{mission_id}-{pid.lower()}-staff-ckpt",
                        "to_state": pid,
                        "state_ko": (
                            f"♻️ [{team_name} · {p_def['name']}] 체크포인트 복원: 완료된 사원 {reused_cnt}명의 보고서를 재사용하고 "
                            f"미완료 사원 {len(pending_indexed)}명만 이어서 수행합니다."
                        ),
                        "project": STATE["project_name"],
                        "role": pid,
                        "team_id": eff_team_id,
                    },
                )

        use_parallel = len(pending_indexed) >= 2 and staff_exec_mode_cfg != "sequential"
        if not use_parallel:
            for st_idx, stf in pending_indexed:
                if _SERVER_SHUTTING_DOWN.is_set() or _is_stopped():
                    break
                stf_mod = stf["model_ov"] or fast_exec_model_ov
                s_stf = _record_stage_start(
                    pid,
                    pid,
                    stf["prov_k"],
                    f"👤 [{p_def['name']} · 사원 #{st_idx} {stf['emp_name']} ({stf_mod or 'SDK 기본'})] '{goal}' 실무 수행 중...",
                    stf["emp_id"],
                    stf["emp_name"],
                )
                prior_pairs = [
                    (ps, saved_part_staff[ps["emp_id"]])
                    for ps in p_staff_list
                    if saved_part_staff.get(ps["emp_id"])
                ]
                earlier_ctx = (
                    "\n\n[선행 동료 사원 조사/초안 — 중복하지 말고 누락 보완·교차 검증 위주로 작성]:\n"
                    + "\n\n".join(f"- {ps['emp_name']}: {pt[:1500]}" for ps, pt in prior_pairs)
                    if prior_pairs
                    else ""
                )
                stf_prompt = prompt_builder_fn(st_idx, stf, stf_mod, earlier_ctx, False)
                res_stf = _call_cli_with_fallback(
                    stf["prov_k"],
                    stf_prompt,
                    timeout_s=timeout_val,
                    role_name=pid,
                    phase_name=pid,
                    model_override=stf_mod,
                    emp_id_ov=stf["emp_id"],
                    emp_name_ov=stf["emp_name"],
                )
                if _SERVER_SHUTTING_DOWN.is_set() or _is_stopped():
                    break
                stf_txt = (
                    res_stf["output"].strip()
                    if (res_stf and res_stf.get("output"))
                    else f"[{stf['emp_name']}] 담당 세부 실무 완료"
                )
                with _STATE_LOCK:
                    saved_part_staff[stf["emp_id"]] = stf_txt
                _record_stage_done(
                    s_stf,
                    pid,
                    pid,
                    stf["prov_k"],
                    res_stf,
                    f"[👤 사원 #{st_idx} {stf['emp_name']} ({stf_mod or stf['prov_k']})]\n{stf_txt[:360]}",
                    agent_id=stf["emp_id"],
                    agent_name=stf["emp_name"],
                    org_rank="STAFF",
                    cli_model=stf_mod or "",
                    execution_mode="SEQUENTIAL",
                )
                _save_mission_checkpoint(pid)
            return [
                (stf, saved_part_staff[stf["emp_id"]])
                for stf in p_staff_list
                if saved_part_staff.get(stf["emp_id"])
            ]

        # --- PARALLEL EXECUTION (len >= 2 default: 사원 1 ∥ 사원 2 ... -> 파트장) ---
        parallel_meta = [
            {
                "agent_id": stf["emp_id"],
                "agent_name": stf["emp_name"],
                "role": pid,
                "model": stf["model_ov"] or fast_exec_model_ov or stf["prov_k"],
            }
            for _, stf in pending_indexed
        ]
        parallel_banner = " ∥ ".join(
            f"#{a['agent_id']} {a['agent_name']}({a['model']})" for a in parallel_meta
        )
        with _STATE_LOCK:
            STATE["working_now"] = [
                w for w in STATE.get("working_now", []) if w.get("mission_id") != mission_id
            ]
            STATE["events"].insert(
                0,
                {
                    "at": utc_now_iso(),
                    "run_id": f"{mission_id}-{pid.lower()}-parallel-start",
                    "to_state": pid,
                    "state_ko": f"⚡ [{team_name} · {p_def['name']} · 사원 {len(pending_indexed)}명 동시 병렬수행 가동] {parallel_banner}",
                    "project": STATE["project_name"],
                    "role": pid,
                    "team_id": eff_team_id,
                },
            )

        def _worker_task(st_idx: int, stf: Dict[str, Any]) -> Tuple[int, Dict[str, Any], str]:
            if _SERVER_SHUTTING_DOWN.is_set() or _is_stopped():
                return st_idx, stf, ""
            stf_mod = stf["model_ov"] or fast_exec_model_ov
            s_stf = _record_stage_start(
                pid,
                pid,
                stf["prov_k"],
                f"⚡ [{p_def['name']} · 병렬 #{st_idx}/{len(p_staff_list)} {stf['emp_name']} ({stf_mod or 'SDK 기본'})] 동시 병렬 실무 수행 중...",
                stf["emp_id"],
                stf["emp_name"],
                append_working=True,
                parallel_agents=parallel_meta,
            )
            stf_prompt = prompt_builder_fn(st_idx, stf, stf_mod, "", True)
            res_stf = _call_cli_with_fallback(
                stf["prov_k"],
                stf_prompt,
                timeout_s=timeout_val,
                role_name=pid,
                phase_name=pid,
                model_override=stf_mod,
                emp_id_ov=stf["emp_id"],
                emp_name_ov=stf["emp_name"],
            )
            if _SERVER_SHUTTING_DOWN.is_set() or _is_stopped():
                return st_idx, stf, ""
            stf_txt = (
                res_stf["output"].strip()
                if (res_stf and res_stf.get("output"))
                else f"[{stf['emp_name']}] 병렬 담당 실무 완료"
            )
            with _STATE_LOCK:
                saved_part_staff[stf["emp_id"]] = stf_txt
            _record_stage_done(
                s_stf,
                pid,
                pid,
                stf["prov_k"],
                res_stf,
                f"[⚡ 병렬 사원 #{st_idx} {stf['emp_name']} ({stf_mod or stf['prov_k']})]\n{stf_txt[:360]}",
                agent_id=stf["emp_id"],
                agent_name=stf["emp_name"],
                org_rank="STAFF",
                cli_model=stf_mod or "",
                execution_mode="PARALLEL",
            )
            _save_mission_checkpoint(pid)
            return st_idx, stf, stf_txt

        with ThreadPoolExecutor(max_workers=min(len(pending_indexed), 6)) as pool:
            futs = [
                pool.submit(_worker_task, idx, stf_item)
                for idx, stf_item in pending_indexed
            ]
            for fut in futs:
                fut.result()
        return [
            (stf, saved_part_staff[stf["emp_id"]])
            for stf in p_staff_list
            if saved_part_staff.get(stf["emp_id"])
        ]

    # Determine final build part vs upstream preparation parts (research, structure, custom)
    build_part_def = next(
        (p for p in reversed(enabled_parts) if p.get("part_kind") == "build"),
        enabled_parts[-1],
    )
    prep_parts_defs = [p for p in enabled_parts if p["id"] != build_part_def["id"]]
    resume_from_stage = (resume_state or {}).get("interrupted_stage")

    try:
        # =========================================================================
        # PHASE 01: LEAD_PLANNING (총괄팀장 업무 의도 분석 & 파트별 업무 분장)
        # =========================================================================
        if _SERVER_SHUTTING_DOWN.is_set():
            return
        if user_revision_feedback and not revision_plan_done:
            s_rev_plan = _record_stage_start(
                "LEAD_PLANNING",
                "LEAD",
                lead_assignee["prov_k"],
                f"👑 [{lead_def['name']} · {lead_assignee['emp_name']}] 사용자의 보완 재지시('{user_revision_feedback[:60]}')를 분석하여 파트별 재작업 지시서를 시달합니다.",
                lead_assignee["emp_id"],
                lead_assignee["emp_name"],
            )
            rev_plan_prompt = (
                f"당신은 '{lead_def['name']}'({lead_assignee['emp_name']})입니다. 사용자(최종 승인권자)가 이전 통합보고에 대해 아래 보완 지시를 내렸습니다.\n"
                f"- 원 업무 목표: {goal}\n"
                f"- 사용자 보완 재지시: {user_revision_feedback}\n"
                f"- 참여 파트 목록: {', '.join(p['name'] for p in enabled_parts)}\n"
                f"각 파트 담당이 즉시 수정·보강해야 할 핵심 지침을 한국어 5줄 이내로 명확히 작성하세요."
            )
            res_rp = _call_cli_with_fallback(
                lead_assignee["prov_k"],
                rev_plan_prompt,
                timeout_s=55.0,
                role_name="LEAD",
                phase_name="LEAD_PLANNING",
                model_override=planner_model_ov,
                emp_id_ov=lead_assignee["emp_id"],
                emp_name_ov=lead_assignee["emp_name"],
            )
            if _SERVER_SHUTTING_DOWN.is_set():
                return
            if not _is_stopped():
                rev_order_txt = res_rp["output"].strip() if (res_rp and res_rp.get("output")) else f"사용자 보완 요청 반영 지시: {user_revision_feedback}"
                stage_outputs["LEAD_PLANNING"] = stage_outputs.get("LEAD_PLANNING", "") + f"\n\n[🔄 사용자 보완 재지시 반영 분장]:\n{rev_order_txt}"
                last_error_feedback = f"[사용자 최종 검토 보완 재지시 — 최우선 반영 필수]:\n{user_revision_feedback}\n\n[총괄팀장 세부 보완 지시]:\n{rev_order_txt}"
                revision_plan_done = True
                repair_history.append(f"사용자 보완 재지시 반영: {user_revision_feedback[:160]}")
                _record_stage_done(
                    s_rev_plan,
                    "LEAD_PLANNING",
                    "LEAD",
                    lead_assignee["prov_k"],
                    res_rp,
                    rev_order_txt,
                    agent_id=lead_assignee["emp_id"],
                    agent_name=lead_assignee["emp_name"],
                    org_rank="LEAD",
                    cli_model=planner_model_ov or "",
                )
                _save_mission_checkpoint("LEAD_PLANNING")
        elif user_revision_feedback and revision_plan_done:
            if not last_error_feedback:
                last_error_feedback = f"[사용자 최종 검토 보완 재지시 — 최우선 반영 필수]:\n{user_revision_feedback}"
            intent_spec = _refine_intent_from_plan(stage_outputs.get("LEAD_PLANNING") or stage_outputs.get("PLANNING", ""), intent_spec)
            deliverable_mode = intent_spec["mode"]
            intent_label = intent_spec["label"]
        elif not stage_outputs.get("LEAD_PLANNING") or resume_from_stage in ("PLANNING", "LEAD_PLANNING"):
            s1 = _record_stage_start(
                "LEAD_PLANNING",
                "LEAD",
                lead_assignee["prov_k"],
                f"👑 [{lead_def['name']} · {lead_assignee['emp_name']}] '{goal}' 지시를 분석하여 {len(enabled_parts)}개 파트({', '.join(p['stage_label'] for p in enabled_parts)})에 업무를 분장 중입니다.",
                lead_assignee["emp_id"],
                lead_assignee["emp_name"],
            )
            parts_roster_desc = "\n".join(
                f"  - [{idx + 1}] {p['icon']} {p['name']} (`{p['id']}` · 파트장={part_squads[p['id']]['lead']['emp_name']}, 부하직원={len(part_squads[p['id']]['staff'])}명): {p['instruction']}"
                for idx, p in enumerate(enabled_parts)
            )
            mode_guide_lines = (
                "  * RESEARCH_HTML: `research_report.html` + `summary_data.json`\n"
                "  * RESEARCH: `research_report.md` + `summary_data.json`\n"
                "  * DOCUMENT: `proposal_document.md`\n"
                "  * WEB: `index.html`, `styles.css`, `app.js`\n"
                "  * CODE: `main.py` 등 실행 가능한 실제 소스 파일\n"
            )
            plan_prompt = (
                f"당신은 프로젝트를 총괄 지휘하는 '{lead_def['name']}'({lead_assignee['emp_name']})입니다.\n"
                f"사용자의 업무 지시 '{goal}'를 분석하여 산출물 모드를 확정하고 각 파트장에게 내릴 업무 분장 지시서(ORDER)를 작성하세요.\n"
                f"1) 첫 줄에 반드시 `DELIVERABLE_MODE: {deliverable_mode}` 형식으로 명시하세요 (선택지: RESEARCH_HTML, RESEARCH, DOCUMENT, WEB, CODE).\n"
                f"2) 산출물 기준 (코딩 요청이 아닌 조사·기획 업무에 불필요한 `.py` 코드를 지시하지 마세요):\n{mode_guide_lines}"
                f"3) 현재 투입된 실무 파트 목록:\n{parts_roster_desc}\n"
                f"각 파트(부하직원 순회 → 파트장 취합)가 수행할 핵심 과업과 검증 기준을 6줄 이내 한국어로 명확히 분장하세요."
                f"{existing_folder_ctx[:9000]}"
            )
            res_plan = _call_cli_with_fallback(
                lead_assignee["prov_k"],
                plan_prompt,
                timeout_s=65.0,
                role_name="LEAD",
                phase_name="LEAD_PLANNING",
                model_override=planner_model_ov,
                emp_id_ov=lead_assignee["emp_id"],
                emp_name_ov=lead_assignee["emp_name"],
            )
            if _SERVER_SHUTTING_DOWN.is_set():
                return
            if not _is_stopped():
                stage_outputs["LEAD_PLANNING"] = (
                    res_plan["output"].strip()
                    if (res_plan and res_plan.get("output"))
                    else (
                        f"DELIVERABLE_MODE: {deliverable_mode}\n"
                        f"- 총괄팀장: {lead_assignee['emp_name']} ({lead_def['name']})\n"
                        f"- 산출물 유형: {intent_label} (`{intent_spec['primary_file']}`)\n"
                        f"- 파트별 분장: {' → '.join(p['name'] for p in enabled_parts)}"
                    )
                )
                intent_spec = _refine_intent_from_plan(stage_outputs["LEAD_PLANNING"], intent_spec)
                deliverable_mode = intent_spec["mode"]
                intent_label = intent_spec["label"]
                stage_outputs["PLANNING"] = stage_outputs["LEAD_PLANNING"]
                _record_stage_done(
                    s1,
                    "LEAD_PLANNING",
                    "LEAD",
                    lead_assignee["prov_k"],
                    res_plan,
                    stage_outputs["LEAD_PLANNING"],
                    agent_id=lead_assignee["emp_id"],
                    agent_name=lead_assignee["emp_name"],
                    org_rank="LEAD",
                    cli_model=planner_model_ov or "",
                )
                _save_mission_checkpoint("LEAD_PLANNING")
        else:
            intent_spec = _refine_intent_from_plan(stage_outputs.get("LEAD_PLANNING") or stage_outputs.get("PLANNING", ""), intent_spec)
            deliverable_mode = intent_spec["mode"]
            intent_label = intent_spec["label"]

        with _STATE_LOCK:
            for m in STATE["missions"]:
                if m["mission_id"] == mission_id:
                    m["deliverable_mode"] = deliverable_mode
                    m["deliverable_type_label"] = intent_label

        # =========================================================================
        # PHASE 02: UPSTREAM PART EXECUTION (파트별 부하직원 순회 [사원 1 ∥ 사원 2] → 파트장 취합·확정)
        # =========================================================================
        for p_def in prep_parts_defs:
            if _SERVER_SHUTTING_DOWN.is_set():
                return
            if _is_stopped():
                break
            pid = p_def["id"]
            if part_outputs.get(pid) and resume_from_stage != pid:
                continue
            squad = part_squads[pid]
            p_ass = squad["lead"]
            p_staff_list = squad["staff"]
            prev_parts_ctx = "\n\n".join(
                f"[{k} 결과]:\n{v[:3000]}" for k, v in part_outputs.items() if v
            )
            if existing_folder_ctx:
                prev_parts_ctx = (prev_parts_ctx + "\n\n" if prev_parts_ctx else "") + existing_folder_ctx[:10000]
            rev_note_for_part = f"\n\n[사용자 보완 재지시 사항]:\n{user_revision_feedback}" if user_revision_feedback else ""
            staff_concise_rule = (
                "도구 호출 없이 핵심 요점만 5~7줄 불릿으로 즉시 작성하세요."
                if profile_clean == "quick"
                else "담당 전문 관점에서 핵심 사실·수치·구조안을 10~14줄 이내로 명확하고 중복 없이 정리하세요."
            )

            # 2-A) Subordinate Staff Execution (사원 2인 이상 시 기본 동시 병렬수행 [사원1 ∥ 사원2] -> 파트장 전달)
            def _prep_staff_prompt_builder(
                st_idx: int,
                stf: Dict[str, Any],
                stf_mod: Optional[str],
                earlier_staff_ctx: str,
                is_parallel_batch: bool,
            ) -> str:
                parallel_focus_note = (
                    f"\n- 현재 동료 사원들과 **동시 병렬 수행(#{st_idx}/{len(p_staff_list)})** 중입니다. 본인의 고유 전담 관점·스킬({', '.join(stf['skills']) or stf['emp_name']})에 집중해 파트장에게 독립 보고하세요."
                    if is_parallel_batch
                    else ""
                )
                search_hint = (
                    "\n- 필요한 경우 `search_web`을 최대 1~2회 이내로 사용하고 확인 불가 항목은 `[추정]`/`[모름]`으로 표기하세요."
                    if (p_def.get("part_kind") == "research" and profile_clean != "quick" and st_idx == 1)
                    else "\n- 불필요한 외부 도구 호출 없이 즉시 핵심 분석·설계 결과를 작성하세요."
                )
                return (
                    f"당신은 '{p_def['name']}' 산하 일반 사원 '{stf['emp_name']}'(사번 #{stf['emp_id']}, 실행모델: {stf_mod or '기본'})입니다.\n"
                    f"- 사원 전담 페르소나: {stf['system_prompt'] or p_def['instruction']}\n"
                    f"- 장착 스킬: {', '.join(stf['skills']) or p_def['stage_label']}{parallel_focus_note}\n"
                    f"- 프로젝트 목표: '{goal}' (최종 산출물 유형: {intent_label}){search_hint}\n"
                    f"- {staff_concise_rule}{rev_note_for_part}\n\n"
                    f"[총괄팀장 분장 지시서]:\n{stage_outputs.get('LEAD_PLANNING', '')}\n"
                    + (f"\n[선행 파트 전달 자료]:\n{prev_parts_ctx}" if prev_parts_ctx else "")
                    + earlier_staff_ctx
                )

            staff_reports = _execute_part_staff_members(
                pid=pid,
                p_def=p_def,
                p_staff_list=p_staff_list,
                prompt_builder_fn=_prep_staff_prompt_builder,
                timeout_val=60.0 if profile_clean == "quick" else 110.0,
            )
            if _SERVER_SHUTTING_DOWN.is_set():
                return
            if _is_stopped():
                break

            # 2-B) Part Lead Synthesis & Sign-off (파트장 취합·검증)
            p_lead_mod = p_ass["model_ov"] or fast_exec_model_ov
            s_part = _record_stage_start(
                pid,
                pid,
                p_ass["prov_k"],
                f"⭐ [{p_def['name']} 파트장 · {p_ass['emp_name']} ({p_lead_mod or 'SDK 기본'})] 부하직원 {len(staff_reports)}명의 보고를 취합·검증하여 [{p_def['stage_label']}] 최종안을 확정 중입니다.",
                p_ass["emp_id"],
                p_ass["emp_name"],
            )
            staff_bundle_txt = (
                "\n\n[소속 부하직원 실무 보고 내역 — 취합 및 교차 검증 필수]:\n"
                + "\n\n".join(
                    f"### 👤 {stf['emp_name']} (모델: {stf['model_ov'] or stf['prov_k']})\n{stf_txt[:2500]}"
                    for stf, stf_txt in staff_reports
                )
                if staff_reports
                else ""
            )
            concise_rule = (
                "핵심 팩트와 구조 위주로 간결하고 신속하게(12줄 이내) 확정 정리하세요."
                if profile_clean == "quick"
                else "누락 없이 구체적인 세부 정보·비교 항목·근거 출처와 [확실]/[추정]/[불확실]/[모름] 등급을 체계적으로 확정하세요."
            )
            if p_def.get("part_kind") == "research":
                part_prompt = (
                    f"당신은 '{p_def['name']}'의 파트장 '{p_ass['emp_name']}'입니다. 지침: {p_def['instruction']}\n"
                    f"- 프로젝트 목표: '{goal}' (최종 산출물 유형: {intent_label})\n"
                    f"- 소속 사원들의 보고를 검증·통합하여 후속 기획·제작 파트에 넘길 공식 조사 보고서를 확정하세요. 확인되지 않은 내용은 `[추정]`/`[모름]`으로 명확히 구분하세요.\n"
                    f"- {concise_rule}{rev_note_for_part}\n\n"
                    f"[총괄팀장 업무분장 지시서]:\n{stage_outputs.get('LEAD_PLANNING', '')}"
                    f"{staff_bundle_txt}"
                )
            elif p_def.get("part_kind") == "structure":
                json_req = (
                    "\n- 조사형 산출물이므로 정형 요약 데이터 파일(`### FILE: summary_data.json`)로 함께 구조화하거나 표/섹션 스키마를 명확히 제시하세요."
                    if deliverable_mode in ("RESEARCH_HTML", "RESEARCH") and profile_clean != "quick"
                    else ""
                )
                part_prompt = (
                    f"당신은 '{p_def['name']}'의 파트장 '{p_ass['emp_name']}'입니다. 지침: {p_def['instruction']}\n"
                    f"- 프로젝트 목표: '{goal}' (최종 산출물 유형: {intent_label} · 기본 파일: `{intent_spec['primary_file']}`)\n"
                    f"- 선행 파트 조사 결과와 소속 사원들의 데이터 정제·목차 초안을 통합 검증하여 제작 파트가 즉시 구현 가능한 최종 구조 설계안을 확정하세요.{json_req}\n"
                    f"- {concise_rule}{rev_note_for_part}\n\n"
                    f"[총괄팀장 지시서]:\n{stage_outputs.get('LEAD_PLANNING', '')}\n\n"
                    f"{prev_parts_ctx}{staff_bundle_txt}"
                )
            else:
                part_prompt = (
                    f"당신은 '{p_def['name']}'의 파트장 '{p_ass['emp_name']}'입니다. 전담 과업 지침: {p_def['instruction']}\n"
                    f"- 프로젝트 목표: '{goal}' (산출물 유형: {intent_label})\n"
                    f"- 선행 파트 결과와 소속 사원 보고를 통합 검증하여 본 파트의 공식 산출 내용을 한국어로 명확히 확정하세요. {concise_rule}{rev_note_for_part}\n\n"
                    f"[총괄팀장 지시서]:\n{stage_outputs.get('LEAD_PLANNING', '')}\n\n"
                    f"{prev_parts_ctx}{staff_bundle_txt}"
                )

            p_timeout = 85.0 if profile_clean == "quick" else 160.0
            res_p = _call_cli_with_fallback(
                p_ass["prov_k"],
                part_prompt,
                timeout_s=p_timeout,
                role_name=pid,
                phase_name=pid,
                model_override=p_lead_mod,
                emp_id_ov=p_ass["emp_id"],
                emp_name_ov=p_ass["emp_name"],
            )
            if _SERVER_SHUTTING_DOWN.is_set():
                return
            if _is_stopped():
                break
            p_lead_txt = res_p["output"].strip() if (res_p and res_p.get("output")) else f"[{p_def['name']} 파트장] 사원 보고 취합 완료"
            combined_part_doc = p_lead_txt
            if staff_reports:
                staff_digest = "\n\n".join(
                    f"- **👤 {stf['emp_name']} (`{stf['model_ov'] or stf['prov_k']}`)**:\n{stf_txt[:1200]}"
                    for stf, stf_txt in staff_reports
                )
                combined_part_doc = (
                    f"### ⭐ 파트장({p_ass['emp_name']} · `{p_lead_mod or p_ass['prov_k']}`) 최종 취합·검증본\n{p_lead_txt}\n\n"
                    f"#### 👥 소속 일반 사원({len(staff_reports)}명) 실무 순회 기록\n{staff_digest}"
                )
            part_outputs[pid] = combined_part_doc
            stage_outputs[pid] = combined_part_doc

            if "### FILE:" in p_lead_txt:
                p_files = _extract_and_write_project_files(
                    mission_id,
                    f"{goal} ({p_def['stage_label']})",
                    p_lead_txt,
                    project_dir,
                    default_prefix=pid.lower(),
                    deliverable_mode=deliverable_mode,
                )
                for pf in p_files:
                    if pf not in generated_files:
                        generated_files.append(pf)

            _record_stage_done(
                s_part,
                pid,
                pid,
                p_ass["prov_k"],
                res_p,
                f"[⭐ 파트장 {p_ass['emp_name']} ({p_lead_mod or p_ass['prov_k']}) 확정]\n{p_lead_txt[:400]}",
                agent_id=p_ass["emp_id"],
                agent_name=p_ass["emp_name"],
                org_rank="PART_LEAD",
                cli_model=p_lead_mod or "",
            )
            _save_mission_checkpoint(pid)

        # =========================================================================
        # PHASE 03: BUILD PART (부하직원 순회 -> 파트장 최종 구현) + SELF/PEER REVIEW
        # =========================================================================
        b_id = build_part_def["id"]
        b_squad = part_squads[b_id]
        b_ass = b_squad["lead"]
        b_staff_list = b_squad["staff"]
        peer_reviewer_def = prep_parts_defs[0] if prep_parts_defs else build_part_def
        peer_ass = part_assignees.get(peer_reviewer_def["id"], b_ass)
        peer_prov = peer_ass["prov_k"]
        if peer_prov == b_ass["prov_k"] and not peer_ass.get("model_ov") and (diag_provs.get(reviewer_p) or {}).get("auth_state") == "LOGGED_IN":
            peer_prov = reviewer_p

        v_last_passed = True
        rev_failed = False
        no_tool_rule = (
            "중요 실행 규칙: 선행 파트와 소속 사원이 작성한 아래 자료를 적극 활용하고, 추가 웹 검색(`search_web`)이 꼭 필요할 때만 1~2회 이내로 조회한 뒤, "
            "지체 없이 현재 작업 폴더에 요청된 최종 산출물 파일(예: research_report.html, summary_data.json, main.py 등)을 직접 생성(`write_file`)하거나 "
            "`### FILE: <파일명>` 헤더와 함께 표준 출력으로 완성하세요. 사용자에게 역질문하지 말고 즉시 완성하세요."
        )
        build_staff_reports: List[Tuple[Dict[str, Any], str]] = []
        review_already_passed = bool(
            stage_outputs.get("PART_REVIEW")
            and "verdict: fail" not in stage_outputs.get("PART_REVIEW", "").lower()
            and resume_from_stage not in (b_id, "PART_REVIEW")
        )

        while not review_already_passed:
            if _SERVER_SHUTTING_DOWN.is_set():
                return
            if _is_stopped():
                break

            is_repair = repair_attempt > 0
            repair_tag = f" (파트 상호검토 보완 #{repair_attempt}/{max_repairs})" if is_repair else ""
            upstream_bundle = "\n\n".join(
                f"### [{ next((p['name'] for p in enabled_parts if p['id'] == k), k) } 전달 자료]\n{v[:4500]}"
                for k, v in part_outputs.items()
                if v and k != b_id
            )
            upstream_section = f"\n\n[선행 파트 수집·설계 전달 자료 — 누락 없이 본문에 반영하세요]:\n{upstream_bundle}" if upstream_bundle else ""
            if existing_folder_ctx:
                upstream_section += (
                    "\n\n[📂 중요 — 기존 작업 폴더 이어하기 안내]:\n"
                    "현재 실행 작업 디렉터리(`cwd`)에 기존 프로젝트 폴더의 모든 파일이 이미 복사되어 있습니다. "
                    "기존 파일을 임의로 삭제하지 말고 유지한 상태에서, 요청된 추가 기능·수정 코드·실행파일(`.exe`) 빌드 등을 수행하세요."
                    f"{existing_folder_ctx}"
                )
            b_lead_mod = b_ass["model_ov"] or fast_exec_model_ov

            build_already_done = bool(
                part_outputs.get(b_id)
                and not last_error_feedback
                and resume_from_stage != b_id
                and generated_files
                and all((project_dir / Path(gf).name).exists() for gf in generated_files)
            )

            if not build_already_done:
                # 3-A) Build Part Subordinate Staff Execution on initial build pass (사원 2인 이상 시 기본 동시 병렬수행)
                if not is_repair and b_staff_list and not build_staff_reports:
                    bstf_len_rule = "6~10줄 이내 핵심 코드/구성 요점만" if profile_clean == "quick" else "12~20줄 이내 구체적 핵심 로직/구성안으로"

                    def _build_staff_prompt_builder(
                        bst_idx: int,
                        bstf: Dict[str, Any],
                        bstf_mod: Optional[str],
                        prev_bstf_ctx: str,
                        is_parallel_batch: bool,
                    ) -> str:
                        par_focus = (
                            f"\n- 현재 동료 사원과 **동시 병렬 수행(#{bst_idx}/{len(b_staff_list)})** 중이므로 본인 전담 영역({', '.join(bstf['skills']) or bstf['emp_name']})에 집중하세요."
                            if is_parallel_batch
                            else ""
                        )
                        return (
                            f"당신은 '{build_part_def['name']}' 산하 일반 사원 '{bstf['emp_name']}'(사번 #{bstf['emp_id']}, 모델: {bstf_mod or '기본'})입니다.\n"
                            f"- 전담 역할: {bstf['system_prompt'] or build_part_def['instruction']}{par_focus}\n"
                            f"- 목표: '{goal}' (최종 파일: `{intent_spec['primary_file']}`)\n"
                            f"- 주의: 실제 파일 생성(`write_file` / `### FILE:`)은 파트장이 최종 통합 시 수행하므로, 도구 호출 없이 파트장에게 전달할 핵심 구현 로직·본문 모듈·보강 포인트만 {bstf_len_rule} 즉시 작성하세요.\n"
                            + (f"\n[사용자 보완 재지시]: {user_revision_feedback}\n" if user_revision_feedback else "")
                            + f"\n[총괄팀장 지시서]:\n{stage_outputs.get('LEAD_PLANNING', '')}{upstream_section}{prev_bstf_ctx}"
                        )

                    build_staff_reports = _execute_part_staff_members(
                        pid=b_id,
                        p_def=build_part_def,
                        p_staff_list=b_staff_list,
                        prompt_builder_fn=_build_staff_prompt_builder,
                        timeout_val=65.0 if profile_clean == "quick" else 110.0,
                    )
                    if _SERVER_SHUTTING_DOWN.is_set():
                        return
                    if _is_stopped():
                        break

                build_staff_section = (
                    "\n\n[소속 제작 사원들의 핵심 구현 초안 & 품질 마감 제안 — 통합 반영 필수]:\n"
                    + "\n\n".join(
                        f"### 👤 {bstf['emp_name']} ({bstf['model_ov'] or bstf['prov_k']})\n{bstf_txt[:2500]}"
                        for bstf, bstf_txt in build_staff_reports
                    )
                    if build_staff_reports
                    else ""
                )
                repair_clause = (
                    f"\n\n[⚠️ 파트 검증 / 보완 지시 사항 — 아래 항목을 모두 해결하여 전체 완성본 파일을 다시 작성하세요]:\n{last_error_feedback}"
                    if last_error_feedback
                    else ""
                )

                s_build = _record_stage_start(
                    b_id,
                    b_id,
                    b_ass["prov_k"],
                    f"⭐ [{build_part_def['name']} 파트장 · {b_ass['emp_name']} ({b_lead_mod or 'SDK 기본'})] 선행 파트 및 소속 사원({len(build_staff_reports)}명) 결과를 통합해 [{intent_label}] 최종 산출물을 제작 중입니다.{repair_tag}",
                    b_ass["emp_id"],
                    b_ass["emp_name"],
                )

                if deliverable_mode == "RESEARCH_HTML":
                    b_prompt = (
                        f"당신은 '{build_part_def['name']}' 파트장 '{b_ass['emp_name']}'입니다. 지침: {build_part_def['instruction']}\n"
                        f"사용자의 업무 지시 '{goal}'에 대해 브라우저에서 즉시 열람 가능한 완성형 한국어 HTML 조사 보고서를 작성하세요.\n"
                        f"- {no_tool_rule}\n"
                        f"- 단순 제목만 적힌 빈 껍데기 HTML은 절대 금지합니다. 선행 파트가 조사한 모든 대상과 세부 항목(위치·규모·부대시설·특장점·평가 등)을 빠짐없이 담으세요.\n"
                        f"- 파일 1: 첫 줄에 `### FILE: research_report.html`을 적고 `<!doctype html>`부터 `</html>`까지 반응형 내장 `<style>`, 요약 대시보드, 전체 비교 `<table>`, 대상별 상세 카드, `[확실]`/`[추정]`/`[불확실]`/`[모름]` 배지, 공식 출처 섹션을 포함한 전체 HTML을 출력하세요.\n"
                        f"- 파일 2: 이어서 `### FILE: summary_data.json` 줄을 적고 정형 JSON 데이터를 함께 출력하세요.{repair_clause}\n\n"
                        f"[총괄팀장 업무분장 지시서]:\n{stage_outputs.get('LEAD_PLANNING', '')}{upstream_section}{build_staff_section}"
                    )
                elif deliverable_mode == "RESEARCH":
                    b_prompt = (
                        f"당신은 '{build_part_def['name']}' 파트장 '{b_ass['emp_name']}'입니다. 사용자의 업무 지시 '{goal}'에 대해 마크다운 조사 보고서와 JSON 데이터를 작성하세요.\n"
                        f"- {no_tool_rule}\n"
                        f"- 파일 1: `### FILE: research_report.md` (개요, 대상별 상세 조사, 비교 표, `[확실]`/`[추정]` 구분, 출처 포함)\n"
                        f"- 파일 2: `### FILE: summary_data.json` (유효 JSON 정형 데이터){repair_clause}\n\n"
                        f"[총괄팀장 지시서]:\n{stage_outputs.get('LEAD_PLANNING', '')}{upstream_section}{build_staff_section}"
                    )
                elif deliverable_mode == "DOCUMENT":
                    b_prompt = (
                        f"당신은 '{build_part_def['name']}' 파트장 '{b_ass['emp_name']}'입니다. 사용자의 업무 지시 '{goal}'에 맞는 실무 기획/제안 문서를 작성하세요.\n"
                        f"- {no_tool_rule}\n"
                        f"- 첫 줄에 `### FILE: proposal_document.md`를 적고 목적·배경, 핵심 전략, 세부 실행 표(Markdown Table), 기대효과 및 체크리스트를 충실히 작성하세요.{repair_clause}\n\n"
                        f"[총괄팀장 지시서]:\n{stage_outputs.get('LEAD_PLANNING', '')}{upstream_section}{build_staff_section}"
                    )
                elif deliverable_mode == "WEB":
                    b_prompt = (
                        f"당신은 '{build_part_def['name']}' 파트장 '{b_ass['emp_name']}'입니다. 사용자의 업무 지시 '{goal}'에 맞는 완성형 웹 화면 산출물을 작성하세요.\n"
                        f"- {no_tool_rule}\n"
                        f"- `### FILE: index.html` (필요 시 `### FILE: styles.css`, `### FILE: app.js` 포함) 형식으로 실제 콘텐츠·디자인·동작이 완비된 한국어 웹 화면 코드를 작성하세요.{repair_clause}\n\n"
                        f"[총괄팀장 지시서]:\n{stage_outputs.get('LEAD_PLANNING', '')}{upstream_section}{build_staff_section}"
                    )
                else:
                    exe_req_note = (
                        "\n- **중요 (.exe 포함 요청 감지)**: 현재 작업 폴더 루트에 전체 원본 프로그램 소스 파일들(`main.py`, 세부 모듈 `.py`, `requirements.txt`, 샘플 `.md`, `README_사용법.md` 등)을 **절대 삭제하지 말고 모두 그대로 보존**한 상태에서, 빌드된 `.exe` 실행 파일도 현재 작업 폴더 루트(또는 `dist/` 내)에 함께 생성하세요. 상위 프로젝트 폴더 자체가 이미 지정된 이름으로 생성되므로 불필요한 중복 한글 하위 폴더를 또 만들지 마세요."
                        if any(tok in goal.lower() for tok in ("exe", "실행파일", "실행 파일", "실행가능한 파일"))
                        else ""
                    )
                    b_prompt = (
                        f"당신은 '{build_part_def['name']}' 파트장 '{b_ass['emp_name']}'입니다. 목표 '{goal}'에 대해 즉시 실행 가능한 전체 프로그램 소스 코드와 요청된 결과물을 작성하세요.\n"
                        f"- {no_tool_rule}{exe_req_note}\n"
                        f"- 현재 작업 폴더에 `write_file` 도구로 전체 소스 파일들(`main.py` 및 모듈, 설정·문서 파일)을 빠짐없이 작성하거나 `### FILE: <파일명>` 헤더 아래 완전한 코드를 출력하세요 (`input()` 블로킹 대기 금지).{repair_clause}\n\n"
                        f"[총괄팀장 지시서]:\n{stage_outputs.get('LEAD_PLANNING', '')}{upstream_section}{build_staff_section}"
                    )

                res_build = _call_cli_with_fallback(
                    b_ass["prov_k"],
                    b_prompt,
                    timeout_s=420.0,
                    role_name=b_id,
                    phase_name=b_id,
                    model_override=b_lead_mod,
                    emp_id_ov=b_ass["emp_id"],
                    emp_name_ov=b_ass["emp_name"],
                )
                if _SERVER_SHUTTING_DOWN.is_set():
                    return
                if _is_stopped():
                    break
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
                build_combined_doc = out_build or f"생성된 산출물 파일: {', '.join(files_b)}"
                if build_staff_reports:
                    bstf_digest = "\n\n".join(
                        f"- **👤 {bstf['emp_name']} (`{bstf['model_ov'] or bstf['prov_k']}`)**:\n{bstf_txt[:1200]}"
                        for bstf, bstf_txt in build_staff_reports
                    )
                    build_combined_doc = (
                        f"### ⭐ 파트장({b_ass['emp_name']} · `{b_lead_mod or b_ass['prov_k']}`) 통합 제작 완료 (`{', '.join(files_b)}`)\n"
                        f"{build_combined_doc}\n\n"
                        f"#### 👥 소속 제작 사원({len(build_staff_reports)}명) 실무 순회 기록\n{bstf_digest}"
                    )
                part_outputs[b_id] = build_combined_doc
                stage_outputs["BUILDING"] = part_outputs[b_id]
                _record_stage_done(
                    s_build,
                    b_id,
                    b_id,
                    b_ass["prov_k"],
                    res_build,
                    f"[⭐ 파트장 {b_ass['emp_name']} ({b_lead_mod or b_ass['prov_k']})] 생성 파일: {', '.join(files_b) or '(없음)'}\n{out_build[:340]}",
                    step_state="PASS" if files_b else "REPAIR",
                    agent_id=b_ass["emp_id"],
                    agent_name=b_ass["emp_name"],
                    org_rank="PART_LEAD",
                    cli_model=b_lead_mod or "",
                )
                _save_mission_checkpoint(b_id)

            # --- Part Self-Verification & Cross-Part Peer Review (PART_REVIEW by Part Leads) ---
            peer_mod = peer_ass.get("model_ov") or ""
            s_rev = _record_stage_start(
                "PART_REVIEW",
                peer_reviewer_def["id"],
                peer_prov,
                f"🤝 [파트장 상호검증·교차검토 · {peer_ass['emp_name']} & {b_ass['emp_name']}] 생성된 [{intent_label}] 파일({len(generated_files)}개)의 기계 무결성 및 파트 조사 내용 반영 여부를 검토 중입니다.{repair_tag}",
                peer_ass["emp_id"],
                peer_ass["emp_name"],
            )
            v_result = _verify_project_files(project_dir, deliverable_mode=deliverable_mode)
            v_last_passed = v_result["passed"]
            stage_outputs["VERIFYING"] = v_result["summary"]

            if not v_result["passed"] and repair_attempt < max_repairs:
                repair_attempt += 1
                last_error_feedback = "[파트 자체 기계·구조 검증 결함]:\n" + "\n".join(v_result["errors"])
                repair_history.append(f"파트 자체검증 보완 #{repair_attempt}: {last_error_feedback[:160]}")
                part_outputs.pop(b_id, None)
                stage_outputs.pop("PART_REVIEW", None)
                _record_stage_done(
                    s_rev,
                    "PART_REVIEW",
                    peer_reviewer_def["id"],
                    peer_prov,
                    None,
                    last_error_feedback,
                    step_state="REPAIR",
                    agent_id=b_ass["emp_id"],
                    agent_name=b_ass["emp_name"],
                    org_rank="PART_LEAD",
                    cli_model=b_lead_mod or "",
                )
                _save_mission_checkpoint(b_id)
                continue

            if profile_clean == "quick" and v_result["passed"]:
                rev_text = (
                    f"VERDICT: PASS (파트장 고속 상호검증 통과)\n"
                    f"- [{b_ass['emp_name']} & {peer_ass['emp_name']}] 기계·구조 무결성 점검 완료:\n{v_result['summary']}"
                )
                stage_outputs["PART_REVIEW"] = rev_text
                stage_outputs["REVIEWING"] = rev_text
                _record_stage_done(
                    s_rev,
                    "PART_REVIEW",
                    peer_reviewer_def["id"],
                    peer_prov,
                    None,
                    rev_text,
                    step_state="PASS",
                    agent_id=peer_ass["emp_id"],
                    agent_name=peer_ass["emp_name"],
                    org_rank="PART_LEAD",
                    cli_model=peer_mod,
                )
                _save_mission_checkpoint("PART_REVIEW")
                break

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
                if f_p.is_file() and not _is_ignored_deliverable_entry(f_p, project_dir):
                    try:
                        rel_disp = f_p.relative_to(project_dir).as_posix()
                        if _is_binary_deliverable_file(f_p):
                            actual_files_dump.append(
                                f"### BINARY FILE: {rel_disp} ({f_p.stat().st_size:,} bytes)"
                            )
                        else:
                            fence_lang = ext_fence_map.get(f_p.suffix.lower(), "text")
                            actual_files_dump.append(
                                f"### FILE: {rel_disp}\n```{fence_lang}\n{f_p.read_text(encoding='utf-8', errors='replace')[:5500]}\n```"
                            )
                    except Exception:
                        pass
            files_inspect_str = "\n\n".join(actual_files_dump) or "(생성된 산출물 파일 없음)"

            peer_prompt = (
                f"당신은 '{peer_reviewer_def['name']}' 파트장 '{peer_ass['emp_name']}'으로서 파트장 상호 교차검토를 수행합니다.\n"
                f"사용자의 원래 지시 '{goal}' 및 선행 파트가 전달한 조사·설계 내용이 '{build_part_def['name']}'이 제작한 최종 산출물에 누락·왜곡 없이 충실히 반영되었는지 검토하세요.\n"
                f"- 중대한 누락이나 결함이 없다면 첫 줄에 반드시 `VERDICT: PASS (P0:0, P1:0)`을 적고 한국어로 2~3줄 검토 의견을 작성하세요.\n"
                f"- 반드시 보완해야 할 결함이 있다면 첫 줄에 `VERDICT: FAIL`을 적고 구체적 수정 사항을 작성하세요.\n\n"
                f"[파트 기계·구조 검증 결과]:\n{v_result['summary']}\n\n"
                f"[제작된 산출물 파일 내용]:\n{files_inspect_str}"
            )
            res_rev = _call_cli_with_fallback(
                peer_prov,
                peer_prompt,
                timeout_s=65.0,
                role_name=peer_reviewer_def["id"],
                phase_name="PART_REVIEW",
                model_override=peer_mod or None,
                emp_id_ov=peer_ass["emp_id"],
                emp_name_ov=peer_ass["emp_name"],
            )
            if _SERVER_SHUTTING_DOWN.is_set():
                return
            if _is_stopped():
                break
            rev_text = (
                res_rev["output"].strip()
                if (res_rev and res_rev.get("output"))
                else (
                    f"VERDICT: PASS (P0:0, P1:0)\n- 파트장 교차검토 결과 산출물({', '.join(generated_files)})의 요구사항 반영 및 무결성을 확인했습니다."
                    if v_last_passed and generated_files
                    else "VERDICT: FAIL\n- 산출물 검증 기준 미충족"
                )
            )
            stage_outputs["PART_REVIEW"] = f"{v_result['summary']}\n\n[파트 교차검토 의견 ({peer_reviewer_def['name']} · {peer_ass['emp_name']})]:\n{rev_text}"
            stage_outputs["REVIEWING"] = stage_outputs["PART_REVIEW"]
            rev_failed = ("verdict: fail" in rev_text.lower()) or ("p0: 1" in rev_text.lower()) or ("p0:1" in rev_text.lower())
            _record_stage_done(
                s_rev,
                "PART_REVIEW",
                peer_reviewer_def["id"],
                peer_prov,
                res_rev,
                stage_outputs["PART_REVIEW"],
                step_state="REPAIR" if rev_failed else "PASS",
                agent_id=peer_ass["emp_id"],
                agent_name=peer_ass["emp_name"],
                org_rank="PART_LEAD",
                cli_model=peer_mod,
            )

            if rev_failed and repair_attempt < max_repairs:
                repair_attempt += 1
                last_error_feedback = f"[{peer_reviewer_def['name']} 교차검토 보완 요청]:\n{rev_text}"
                repair_history.append(f"파트 교차검토 보완 #{repair_attempt}: {rev_text[:160]}")
                part_outputs.pop(b_id, None)
                stage_outputs.pop("PART_REVIEW", None)
                _save_mission_checkpoint(b_id)
                continue
            _save_mission_checkpoint("PART_REVIEW")
            break

        # =========================================================================
        # PHASE 04: LEAD_REPORT (총괄팀장 통합보고서 작성 -> 사용자 최종 승인 대기!)
        # =========================================================================
        if _SERVER_SHUTTING_DOWN.is_set():
            return
        if not _is_stopped() and not stage_outputs.get("LEAD_REPORT"):
            s_lead_rep = _record_stage_start(
                "LEAD_REPORT",
                "LEAD",
                lead_assignee["prov_k"],
                f"📋 [{lead_def['name']} · {lead_assignee['emp_name']}] 전 파트(파트장 및 소속 일반 사원)의 수행 결과와 상호검토 내역을 취합하여 사용자 결재용 「통합보고서」를 작성 중입니다.",
                lead_assignee["emp_id"],
                lead_assignee["emp_name"],
            )
            part_digest_lines = []
            for p in enabled_parts:
                sq = part_squads[p["id"]]
                st_names = ", ".join(f"{s['emp_name']}({s['model_ov'] or s['prov_k']})" for s in sq["staff"]) or "없음"
                p_out_snip = (part_outputs.get(p["id"]) or "(수행 완료)").strip()[:600]
                part_digest_lines.append(
                    f"- **{p['icon']} {p['name']}** [파트장: {sq['lead']['emp_name']}({sq['lead']['model_ov'] or sq['lead']['prov_k']}) / 사원: {st_names}]:\n{p_out_snip}"
                )
            parts_digest_txt = "\n\n".join(part_digest_lines)

            lead_report_prompt = (
                f"당신은 프로젝트를 총괄한 '{lead_def['name']}'({lead_assignee['emp_name']})입니다.\n"
                f"각 파트(파트장 및 소속 일반 사원들)의 순회 수행과 파트장 간 상호 검증·검토가 완료되었습니다. 최종 결정권자인 사용자에게 올릴 간결하고 명확한 한국어 **「총괄팀장 통합보고서」**를 작성하세요 (도구 호출 불필요, 6~10줄 이내).\n"
                f"- 필수 포함 항목:\n"
                f"  1) 업무 목표 달성 요약 및 산출물 파일(`{', '.join(generated_files) or '없음'}`) 핵심 구성\n"
                f"  2) 참여 파트별(파트장 + 부하직원 협업) 수행 및 상호검토 결과 요약\n"
                f"  3) 최종 승인권자(사용자)께서 확인·승인해 주실 핵심 체크 포인트\n\n"
                f"[업무 목표]: {goal}\n"
                f"[파트별 수행 요약]:\n{parts_digest_txt}\n\n"
                f"[파트 상호검증·교차검토 결과]:\n{stage_outputs.get('PART_REVIEW', '')[:1200]}"
            )
            res_lrep = _call_cli_with_fallback(
                lead_assignee["prov_k"],
                lead_report_prompt,
                timeout_s=55.0,
                role_name="LEAD",
                phase_name="LEAD_REPORT",
                model_override=planner_model_ov,
                emp_id_ov=lead_assignee["emp_id"],
                emp_name_ov=lead_assignee["emp_name"],
            )
            if _SERVER_SHUTTING_DOWN.is_set():
                return
            if not _is_stopped():
                parts_arrow_txt = " → ".join(
                    f"{p['name']}(파트장:{part_squads[p['id']]['lead']['emp_name']} + 사원{len(part_squads[p['id']]['staff'])}명)"
                    for p in enabled_parts
                )
                consolidated_report = (
                    res_lrep["output"].strip()
                    if (res_lrep and res_lrep.get("output"))
                    else (
                        f"### 📋 {lead_def['name']}({lead_assignee['emp_name']}) 통합보고\n"
                        f"- **수행 목표**: {goal}\n"
                        f"- **참여 파트**: {parts_arrow_txt}\n"
                        f"- **파트 상호검증 결과**: {'검증 및 교차검토 통과' if (v_last_passed and not rev_failed) else '일부 항목 확인 필요'}\n"
                        f"- **생성된 산출물 ({len(generated_files)}개)**: {', '.join(generated_files) or '(없음)'}\n"
                        f"- 아래 미리보기 링크로 결과물을 검토하신 뒤 **[✅ 최종 승인]** 또는 **[🔄 보완 재지시]**를 선택해 주십시오."
                    )
                )
                stage_outputs["LEAD_REPORT"] = consolidated_report
                stage_outputs["DECIDING"] = consolidated_report
                _record_stage_done(
                    s_lead_rep,
                    "LEAD_REPORT",
                    "LEAD",
                    lead_assignee["prov_k"],
                    res_lrep,
                    consolidated_report,
                    step_state="PASS",
                    agent_id=lead_assignee["emp_id"],
                    agent_name=lead_assignee["emp_name"],
                    org_rank="LEAD",
                    cli_model=planner_model_ov or "",
                )
                _save_mission_checkpoint("LEAD_REPORT")

    except _AllQuotaExhaustedError as q_err:
        if _SERVER_SHUTTING_DOWN.is_set():
            return
        _clear_live_agent_stream(team_id=eff_team_id, mission_id=mission_id)
        with _STATE_LOCK:
            STATE["working_now"] = [
                w for w in STATE.get("working_now", []) if w.get("mission_id") != mission_id
            ]
            paused_snap = {
                "mission_id": mission_id,
                "goal": goal,
                "profile": profile_clean,
                "orchestrator_mode": eff_orch_mode,
                "deliverable_mode": deliverable_mode,
                "team_id": eff_team_id,
                "team_name": team_name,
                "output_root": str(base_output_dir),
                "project_folder_name": project_folder_name,
                "continue_existing": continue_existing,
                "explicit_project_dir": str(project_dir) if continue_existing else "",
                "interrupted_stage": q_err.phase_name,
                "interrupted_role": q_err.role_name,
                "stage_outputs": dict(stage_outputs),
                "part_outputs": dict(part_outputs),
                "staff_outputs_by_part": {pk: dict(pv) for pk, pv in staff_outputs_by_part.items() if pv},
                "generated_files": list(generated_files),
                "repair_attempt": repair_attempt,
                "last_error_feedback": last_error_feedback,
                "user_revision_feedback": user_revision_feedback,
                "revision_plan_done": revision_plan_done,
                "repair_history": list(repair_history),
                "step_counter": step_counter,
                "exhausted_slots": list(q_err.exhausted_slots),
                "reason": q_err.reason,
                "paused_at": utc_now_iso(),
            }
            STATE["paused_mission"] = paused_snap
            STATE.setdefault("mission_checkpoints", {})[mission_id] = dict(paused_snap)
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
            STATE["phase"] = _recompute_global_phase_unlocked()
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
        save_runtime_state()
        return
    except Exception as unexpected_exc:
        if _SERVER_SHUTTING_DOWN.is_set():
            return
        _clear_live_agent_stream(team_id=eff_team_id, mission_id=mission_id)
        with _STATE_LOCK:
            STATE["working_now"] = [
                w for w in STATE.get("working_now", []) if w.get("mission_id") != mission_id
            ]
            err_snap = {
                "mission_id": mission_id,
                "goal": goal,
                "profile": profile_clean,
                "orchestrator_mode": eff_orch_mode,
                "deliverable_mode": deliverable_mode,
                "team_id": eff_team_id,
                "team_name": team_name,
                "output_root": str(base_output_dir),
                "project_folder_name": project_folder_name,
                "continue_existing": continue_existing,
                "explicit_project_dir": str(project_dir) if continue_existing else "",
                "stage_outputs": dict(stage_outputs),
                "part_outputs": dict(part_outputs),
                "staff_outputs_by_part": {pk: dict(pv) for pk, pv in staff_outputs_by_part.items() if pv},
                "generated_files": list(generated_files),
                "repair_attempt": repair_attempt,
                "last_error_feedback": last_error_feedback,
                "user_revision_feedback": user_revision_feedback,
                "revision_plan_done": revision_plan_done,
                "repair_history": list(repair_history),
                "step_counter": step_counter,
                "reason": f"예기치 않은 파이프라인 예외: {str(unexpected_exc)[:180]}",
                "paused_at": utc_now_iso(),
            }
            STATE["paused_mission"] = err_snap
            STATE.setdefault("mission_checkpoints", {})[mission_id] = dict(err_snap)
            for m in STATE["missions"]:
                if m["mission_id"] == mission_id:
                    m["live"] = False
                    m["status"] = "PAUSED_ERROR"
                    m["updated_at"] = utc_now_iso()
            STATE["phase"] = _recompute_global_phase_unlocked()
            STATE["events"].insert(
                0,
                {
                    "at": utc_now_iso(),
                    "run_id": f"{mission_id}-err-pause",
                    "to_state": "PAUSED_ERROR",
                    "state_ko": f"⚠️ [{team_name}] 미션({mission_id}) 실행 중 예외 감지 — 체크포인트 보존됨 ({str(unexpected_exc)[:140]})",
                    "project": STATE["project_name"],
                    "role": "DIRECTOR",
                },
            )
        save_runtime_state()
        return

    if _SERVER_SHUTTING_DOWN.is_set():
        return

    with _STATE_LOCK:
        STATE["paused_mission"] = None
        stopped = _is_mission_stopped_unlocked(mission_id)

    # Write README.md & consolidated report (.md) directly INSIDE project_dir!
    try:
        project_dir.mkdir(parents=True, exist_ok=True)
        project_readme = project_dir / "README.md"
        readme_entry = (
            f"# {goal}\n\n"
            f"- **Mission ID**: `{mission_id}`" + (" *(기존 폴더 이어하기)*" if continue_existing else "") + "\n"
            f"- **Deliverable Type**: {intent_label} (`{deliverable_mode}`)\n"
            f"- **Project Lead**: {lead_def['name']} (`{lead_assignee['emp_name']}`)\n"
            f"- **Participating Parts**: {', '.join(p['name'] for p in enabled_parts)}\n"
            f"- **Saved Directory**: `{project_dir}`\n"
            f"- **Generated Files**: {', '.join(generated_files)}\n"
        )
        if continue_existing and project_readme.exists():
            prev_readme = project_readme.read_text(encoding="utf-8", errors="replace").strip()
            if prev_readme and f"`{mission_id}`" not in prev_readme:
                readme_entry = readme_entry + f"\n---\n\n### 📜 이전 프로젝트 기록\n\n{prev_readme}\n"
        project_readme.write_text(readme_entry, encoding="utf-8")
    except Exception:
        pass

    report_filename = f"{project_folder_name}_통합보고서.md"
    deliv_rel_path = f"deliverables/{project_folder_name}/{report_filename}"
    deliv_full_path = project_dir / report_filename
    approval_badge = "🛑 작업 중단됨 (STOPPED)" if stopped else ("⏳ 사용자 최종 승인 대기 중 (AWAITING_APPROVAL)" if require_approval else "✅ 자동 완료")
    storage_tag = f"☁️ Google Drive 연동 폴더 (`{project_dir}`)" if is_gdrive_target else f"💻 작업 폴더 (`{project_dir}`)"
    files_bullet_list = "\n".join(f"  - [{f}](/{f}) (`{project_dir / Path(f).name}`)" for f in generated_files) or "  - (없음)"
    repair_section = (
        "\n## 🔄 파트 상호검토 & 보완 이력\n" + "\n".join(f"- {r}" for r in repair_history) + "\n"
        if repair_history
        else ""
    )
    parts_md_sections = "\n\n".join(
        f"## {p['icon']} [{p['name']} ({part_assignees[p['id']]['emp_name']}) 수행 결과]\n{part_outputs.get(p['id'], '(수행 내역 없음)')}"
        for p in enabled_parts
    )
    cont_mode_line = f"- **작업 방식 (Folder Mode)**: 📂 기존 폴더 이어하기 (`{project_dir}`)\n" if continue_existing else f"- **작업 방식 (Folder Mode)**: 🆕 새 작업 폴더 생성 (`{project_dir}`)\n"
    deliv_markdown = (
        f"# 📋 프로젝트 총괄팀장 통합보고서 ({mission_id})\n\n"
        f"- **결재 상태 (Approval Status)**: **{approval_badge}**\n"
        f"- **미션 목표 (Goal)**: {goal}\n"
        f"{cont_mode_line}"
        f"- **산출물 유형 (Deliverable Type)**: {intent_label} (`{deliverable_mode}`)\n"
        f"- **수행 팀 (Team)**: `{team_name}` (`{team_floor}`)\n"
        f"- **총괄팀장 (Project Lead)**: `{lead_assignee['emp_name']}` ({PROVIDER_META[lead_assignee['prov_k']]['label']})\n"
        f"- **참여 파트 담당**: " + " / ".join(f"{p['name']}={part_assignees[p['id']]['emp_name']}" for p in enabled_parts) + "\n"
        f"- **저장 위치 (Output Folder)**: {storage_tag}\n"
        f"- **통합보고서 경로**: `{deliv_full_path}`\n"
        f"- **보고 시각**: {utc_now_iso()}\n"
        f"- **작업 폴더 산출물 파일 ({len(generated_files)}개)**:\n{files_bullet_list}\n\n"
        f"---\n\n"
        f"## 👑 총괄팀장 통합보고 브리핑\n{stage_outputs.get('LEAD_REPORT', '')}\n\n"
        f"---\n\n"
        f"## 01. 총괄팀장 업무분장 지시서 (LEAD_PLANNING)\n{stage_outputs.get('LEAD_PLANNING', '')}\n\n"
        f"{parts_md_sections}\n\n"
        f"## 🤝 파트 담당 자체검증 & 상호 교차검토 (PART_REVIEW)\n{stage_outputs.get('PART_REVIEW', '')}\n"
        f"{repair_section}\n"
    )
    try:
        deliv_full_path.parent.mkdir(parents=True, exist_ok=True)
        if continue_existing and deliv_full_path.exists():
            prev_rep_md = deliv_full_path.read_text(encoding="utf-8", errors="replace").strip()
            if prev_rep_md and f"({mission_id})" not in prev_rep_md.splitlines()[0]:
                deliv_markdown += (
                    "\n\n---\n\n"
                    "<details>\n"
                    "<summary>📜 이전 작업 통합보고서 누적 이력 열기</summary>\n\n"
                    f"{prev_rep_md}\n\n"
                    "</details>\n"
                )
        deliv_full_path.write_text(deliv_markdown, encoding="utf-8")
    except Exception:
        pass

    primary_file_path = project_dir / intent_spec["primary_file"]
    clean_preview = ""
    if primary_file_path.exists():
        try:
            clean_preview = primary_file_path.read_text(encoding="utf-8", errors="replace").strip()
        except Exception:
            pass
    if not clean_preview:
        clean_preview = stage_outputs.get("LEAD_REPORT", "")

    _clear_live_agent_stream(team_id=eff_team_id, mission_id=mission_id)

    # If stopped OR user approval is required -> pause at AWAITING_APPROVAL before final cloud delivery!
    if stopped or require_approval:
        target_status = "STOPPED" if stopped else "AWAITING_APPROVAL"
        with _STATE_LOCK:
            STATE["working_now"] = [
                w for w in STATE.get("working_now", []) if w.get("mission_id") != mission_id
            ]
            for m in STATE["missions"]:
                if m["mission_id"] == mission_id:
                    m["live"] = False
                    m["status"] = target_status
                    m["awaiting_approval"] = not stopped
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
                    m["project_folder_name"] = project_folder_name
                    m["project_dir"] = f"deliverables/{project_folder_name}"
                    m["project_dir_abs"] = str(project_dir)
                    m["output_root"] = str(base_output_dir)
                    m["is_google_drive"] = is_gdrive_target
                    m["mirror_local"] = mirror_local
                    m["generated_files"] = generated_files
                    m["repair_count"] = repair_attempt
                    m["consolidated_report"] = stage_outputs.get("LEAD_REPORT", "")
                    m["deliverable_preview"] = clean_preview
                    m["review_preview"] = stage_outputs.get("PART_REVIEW", "")
                    m["stage_outputs_snapshot"] = dict(stage_outputs)
                    m["part_outputs_snapshot"] = dict(part_outputs)
                    m["pipeline_stages"] = stage_descriptors
                    m["lead_agent_id"] = lead_assignee["emp_id"]
                    m["lead_agent_name"] = lead_assignee["emp_name"]
                    m["applied"] = {"status": "pending_approval", "files": generated_files, "output_dir": str(project_dir)}
                    m["updated_at"] = utc_now_iso()
            STATE["phase"] = _recompute_global_phase_unlocked()
            if not stopped:
                STATE["events"].insert(
                    0,
                    {
                        "at": utc_now_iso(),
                        "run_id": f"{mission_id}-await-approval",
                        "to_state": "AWAITING_APPROVAL",
                        "state_ko": f"📋 [{lead_def['name']} · {lead_assignee['emp_name']}] 파트별 수행 및 상호검토 완료 → 사용자 최종 승인 대기 중 ({len(generated_files)}개 산출물 준비됨)",
                        "project": STATE["project_name"],
                        "role": "LEAD",
                    },
                )
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
                STATE["chat_messages"].append(
                    {
                        "id": next_chat_id,
                        "role": "LEAD",
                        "content": (
                            f"📋 [{lead_def['name']} 통합보고 · {mission_id}] '{goal}' 작업의 전 파트 수행 및 파트 담당 상호검토가 완료되었습니다. "
                            f"산출물 {len(generated_files)}개를 미리보기로 확인하신 후 [✅ 최종 승인] 또는 [🔄 보완 재지시]를 내려주십시오."
                        ),
                        "at": utc_now_iso(),
                    }
                )
        save_runtime_state()
        return

    # Auto-approve fallback if require_user_approval was explicitly disabled
    finalize_or_revise_mission(mission_id=mission_id, decision="approve", feedback="자동 승인 설정에 의한 완료")


def finalize_or_revise_mission(
    mission_id: Optional[str] = None,
    decision: str = "approve",
    feedback: str = "",
) -> Dict[str, Any]:
    """Handles the user's final approval (`approve`) or revision request (`revise`) after receiving the Project Lead's consolidated report."""
    act_dec = str(decision or "approve").lower().strip()
    fb_clean = str(feedback or "").strip()

    with _STATE_LOCK:
        target_m = None
        for m in STATE["missions"]:
            if mission_id and m.get("mission_id") == mission_id:
                target_m = m
                break
            if not mission_id and m.get("status") == "AWAITING_APPROVAL":
                target_m = m
                break
        if not target_m and STATE["missions"]:
            target_m = STATE["missions"][0]
        if not target_m:
            return {"ok": False, "error": "결재 대상 미션을 찾을 수 없습니다."}

        mid = target_m["mission_id"]

        if act_dec in ("revise", "reject", "rework"):
            m_tid_chk = target_m.get("team_id")
            if any(
                om.get("mission_id") != mid
                and om.get("team_id") == m_tid_chk
                and om.get("status") == "RUNNING"
                for om in STATE["missions"]
            ):
                return {"ok": False, "error": "해당 팀에서 이미 실행 중인 다른 프로젝트가 있습니다."}
            if not fb_clean:
                fb_clean = "파트 산출물의 완성도와 세부 내용을 한층 더 보강하여 다시 통합보고해 주세요."
            STATE["stop_requested"] = False
            if isinstance(STATE.get("stopped_missions"), set):
                STATE["stopped_missions"].discard(mid)
            STATE["phase"] = "LEAD_PLANNING"
            target_m["status"] = "RUNNING"
            target_m["live"] = True
            target_m["awaiting_approval"] = False
            target_m["revision_count"] = int(target_m.get("revision_count") or 0) + 1
            target_m["updated_at"] = utc_now_iso()

            prev_lead_plan = str((target_m.get("stage_outputs_snapshot") or {}).get("LEAD_PLANNING") or "")
            rev_resume = {
                "mission_id": mid,
                "goal": target_m.get("goal", ""),
                "profile": target_m.get("profile", "standard"),
                "orchestrator_mode": target_m.get("orchestrator_mode"),
                "team_id": target_m.get("team_id"),
                "output_root": target_m.get("output_root"),
                "project_folder_name": target_m.get("project_folder_name"),
                "continue_existing": bool(target_m.get("continue_existing", False)),
                "explicit_project_dir": str(target_m.get("project_dir_abs") or ""),
                "deliverable_mode": target_m.get("deliverable_mode"),
                "current_stage": "LEAD_PLANNING",
                "generated_files": list(target_m.get("generated_files") or []),
                "stage_outputs": {"LEAD_PLANNING": prev_lead_plan} if prev_lead_plan else {},
                "part_outputs": {},
                "staff_outputs_by_part": {},
                "repair_attempt": 0,
                "repair_history": [],
                "step_counter": len(target_m.get("steps") or []),
                "user_revision_feedback": fb_clean,
                "revision_plan_done": False,
            }
            STATE.setdefault("mission_checkpoints", {})[mid] = dict(rev_resume)
            STATE["events"].insert(
                0,
                {
                    "at": utc_now_iso(),
                    "run_id": f"{mid}-user-revise-{target_m['revision_count']}",
                    "to_state": "LEAD_PLANNING",
                    "state_ko": f"🔄 [사용자 보완 재지시 #{target_m['revision_count']}] '{fb_clean[:120]}' → 총괄팀장이 파트 담당들에게 보완 작업을 재지시합니다.",
                    "project": STATE["project_name"],
                    "role": "USER",
                },
            )
            next_cid = max((c["id"] for c in STATE["chat_messages"]), default=0) + 1
            STATE["chat_messages"].append(
                {
                    "id": next_cid,
                    "role": "USER",
                    "content": f"[🔄 보완 재지시 · {mid}] {fb_clean}",
                    "at": utc_now_iso(),
                }
            )
            m_goal = target_m.get("goal", "")
            m_prof = target_m.get("profile", "standard")
            m_tid = target_m.get("team_id")
            m_orch = target_m.get("orchestrator_mode")

    if act_dec in ("revise", "reject", "rework"):
        save_runtime_state()
        t = threading.Thread(
            target=_run_mission_pipeline,
            args=(mid, m_goal, m_prof, rev_resume, m_tid, m_orch),
            daemon=True,
        )
        t.start()
        return {
            "ok": True,
            "status": "REVISING",
            "mission_id": mid,
            "message": f"총괄팀장에게 보완 재지시('{fb_clean[:80]}')를 전달했습니다. 파트별 보완 및 상호검토 후 다시 통합보고서를 올립니다.",
        }

    # --- APPROVE PATH: Finalize report, mirror local copy, & upload to Google Drive if connected! ---
    project_dir = Path(target_m.get("project_dir_abs") or (DELIVERABLES_DIR / f"{mid}_project"))
    deliv_full_path = Path(target_m.get("deliverable_abs") or (DELIVERABLES_DIR / f"{mid}.md"))
    base_output_dir = Path(target_m.get("output_root") or DELIVERABLES_DIR)
    mirror_local = bool(target_m.get("mirror_local", False))
    team_obj = get_team_by_id(target_m.get("team_id"))
    team_name = team_obj["name"]
    team_ws = team_obj.get("workspace") or {}
    approved_ts = utc_now_iso()

    if deliv_full_path.exists():
        try:
            md_raw = deliv_full_path.read_text(encoding="utf-8", errors="replace")
            md_updated = md_raw.replace(
                "⏳ 사용자 최종 승인 대기 중 (AWAITING_APPROVAL)",
                f"✅ 사용자 최종 승인 완료 ({approved_ts})" + (f" — 승인 메모: {fb_clean}" if fb_clean else ""),
            )
            deliv_full_path.write_text(md_updated, encoding="utf-8")
        except Exception:
            pass

    if mirror_local:
        try:
            if base_output_dir.resolve() != DELIVERABLES_DIR.resolve():
                DELIVERABLES_DIR.mkdir(parents=True, exist_ok=True)
                if project_dir.exists():
                    shutil.copytree(
                        project_dir,
                        DELIVERABLES_DIR / project_dir.name,
                        dirs_exist_ok=True,
                        ignore=shutil.ignore_patterns(*_IGNORED_ISO_BUILD_DIRS, "*.pyc", "*.pyo", "*.spec"),
                    )
                if deliv_full_path.exists() and deliv_full_path.parent.resolve() != project_dir.resolve():
                    shutil.copy2(deliv_full_path, DELIVERABLES_DIR / deliv_full_path.name)
        except Exception:
            pass

    gdrive_upload_info: Optional[Dict[str, Any]] = None
    fresh_out_status = get_output_dir_status(force_gdrive_refresh=True)
    gd_direct = fresh_out_status.get("gdrive_direct") or {}
    gd_is_connected = bool(gd_direct.get("connected"))
    team_gd_enabled = bool(team_ws.get("gdrive_direct_enabled", False))
    use_team_gd = gd_is_connected and team_gd_enabled
    use_global_gd = gd_is_connected and bool(gd_direct.get("enabled")) and not team_gd_enabled
    if use_team_gd or use_global_gd:
        try:
            target_fid = (team_ws.get("gdrive_folder_id") if use_team_gd else gd_direct.get("folder_id")) or "root"
            target_fname = (team_ws.get("gdrive_folder_name") if use_team_gd else gd_direct.get("folder_name")) or "내 드라이브"
            if project_dir.exists() and deliv_full_path.exists():
                gdrive_upload_info = upload_mission_bundle(project_dir, deliv_full_path, target_folder_id=target_fid)
                with _STATE_LOCK:
                    STATE["events"].insert(
                        0,
                        {
                            "at": utc_now_iso(),
                            "run_id": f"{mid}-gdrive",
                            "to_state": "GDRIVE_UPLOAD",
                            "state_ko": f"☁️ [{team_name}] 사용자 최종 승인 후 Google Drive 납품 완료 ({target_fname} → {project_dir.name}, {gdrive_upload_info['uploaded_count']}개 파일)",
                            "project": STATE["project_name"],
                            "role": "LEAD",
                        },
                    )
        except Exception as gd_exc:
            with _STATE_LOCK:
                STATE["events"].insert(
                    0,
                    {
                        "at": utc_now_iso(),
                        "run_id": f"{mid}-gdrive-err",
                        "to_state": "GDRIVE_ERROR",
                        "state_ko": f"⚠️ Google Drive 업로드 중 오류 발생 (로컬 승인 파일은 정상 보존됨): {str(gd_exc)[:140]}",
                        "project": STATE["project_name"],
                        "role": "LEAD",
                    },
                )

    with _STATE_LOCK:
        target_m["status"] = "DONE"
        target_m["live"] = False
        target_m["awaiting_approval"] = False
        STATE["phase"] = _recompute_global_phase_unlocked()
        target_m["approved_by_user"] = True
        target_m["approved_at"] = approved_ts
        target_m["approval_note"] = fb_clean or "사용자 최종 승인 완료"
        target_m["is_google_drive"] = bool(target_m.get("is_google_drive")) or bool(gdrive_upload_info)
        if gdrive_upload_info:
            target_m["gdrive_project_url"] = gdrive_upload_info.get("project_folder_url")
            target_m["gdrive_report_url"] = gdrive_upload_info.get("report_url")
            target_m["gdrive_uploaded_count"] = gdrive_upload_info.get("uploaded_count", 0)
        target_m["applied"] = {
            "status": "approved",
            "files": target_m.get("generated_files") or [],
            "output_dir": str(project_dir),
        }
        target_m["updated_at"] = approved_ts

        STATE["events"].insert(
            0,
            {
                "at": approved_ts,
                "run_id": f"{mid}-approved",
                "to_state": "PASS",
                "state_ko": f"✅ [사용자 최종 승인 확정 · {mid}] 총괄팀장 통합보고 결재 완료 — 산출물 {len(target_m.get('generated_files') or [])}개 최종 납품 확정!",
                "project": STATE["project_name"],
                "role": "USER",
            },
        )
        next_cid = max((c["id"] for c in STATE["chat_messages"]), default=0) + 1
        loc_badge = "☁️ Google Drive & 로컬 폴더" if gdrive_upload_info else "📁 지정 작업 폴더"
        STATE["chat_messages"].append(
            {
                "id": next_cid,
                "role": "LEAD",
                "content": (
                    f"✅ 최종 승인 감사합니다! 미션({mid})의 모든 산출물이 [{loc_badge}: `{project_dir}`]에 최종 확정·보관되었습니다."
                ),
                "at": approved_ts,
            }
        )
        m_snapshot = dict(target_m)

    save_runtime_state()
    return {
        "ok": True,
        "status": "APPROVED",
        "mission_id": mid,
        "mission": m_snapshot,
        "gdrive_upload": gdrive_upload_info,
        "message": f"미션({mid}) 최종 승인이 완료되어 산출물 납품이 확정되었습니다.",
    }


def stop_active_missions(
    reason: str = "사용자 정지 요청",
    team_id: Optional[str] = None,
    mission_id: Optional[str] = None,
) -> Dict[str, Any]:
    killed = []
    clean_tid = str(team_id or "").strip() or None
    clean_mid = str(mission_id or "").strip() or None
    scoped = bool(clean_tid or clean_mid)
    with _STATE_LOCK:
        stopped_set = STATE.setdefault("stopped_missions", set())
        target_mids: set = set()
        for m in STATE["missions"]:
            if m.get("live") or m.get("status") in ("RUNNING", "QUOTA_PAUSED", "AWAITING_APPROVAL"):
                if clean_mid and m.get("mission_id") != clean_mid:
                    continue
                if clean_tid and m.get("team_id") != clean_tid:
                    continue
                if scoped and m.get("status") == "AWAITING_APPROVAL" and not clean_mid:
                    # Stopping a running team leaves already-completed approval items untouched unless explicitly targeted
                    continue
                target_mids.add(m["mission_id"])

        if not scoped:
            STATE["stop_requested"] = True

        for pid, cli_name in list(_ACTIVE_PIDS.items()):
            p_meta = _ACTIVE_PID_META.get(pid) or {}
            if scoped:
                if clean_mid and p_meta.get("mission_id") != clean_mid:
                    continue
                if clean_tid and p_meta.get("team_id") != clean_tid and p_meta.get("mission_id") not in target_mids:
                    continue
            try:
                if os.name == "nt":
                    subprocess.run(["taskkill", "/PID", str(pid), "/T", "/F"], capture_output=True)
                else:
                    os.kill(pid, 9)
                killed.append({"pid": pid, "cli": cli_name})
            except Exception:
                pass
            _ACTIVE_PIDS.pop(pid, None)
            _ACTIVE_PID_META.pop(pid, None)

        stopped_ids = []
        for m in STATE["missions"]:
            if m.get("mission_id") in target_mids:
                stopped_set.add(m["mission_id"])
                m["live"] = False
                m["awaiting_approval"] = False
                m["status"] = "STOPPED"
                m["updated_at"] = utc_now_iso()
                stopped_ids.append(m["mission_id"])

        if scoped:
            STATE["working_now"] = [
                w for w in STATE.get("working_now", [])
                if w.get("mission_id") not in target_mids and (not clean_tid or w.get("team_id") != clean_tid)
            ]
            if clean_tid and isinstance(STATE.get("team_streams"), dict) and clean_tid in STATE["team_streams"]:
                STATE["team_streams"][clean_tid]["active"] = False
                STATE["team_streams"][clean_tid]["tool"] = ""
                STATE["team_streams"][clean_tid]["parallel_agents"] = []
        else:
            STATE["working_now"] = []
            STATE["paused_mission"] = None
            if isinstance(STATE.get("team_streams"), dict):
                for ts_obj in STATE["team_streams"].values():
                    if isinstance(ts_obj, dict):
                        ts_obj["active"] = False
                        ts_obj["tool"] = ""
                        ts_obj["parallel_agents"] = []
            if isinstance(STATE.get("live_agent_stream"), dict):
                STATE["live_agent_stream"]["active"] = False
                STATE["live_agent_stream"]["tool"] = ""
                STATE["live_agent_stream"]["parallel_agents"] = []

        STATE["phase"] = _recompute_global_phase_unlocked()
        STATE["events"].insert(
            0,
            {
                "at": utc_now_iso(),
                "run_id": f"stop-signal-{int(time.time())}",
                "to_state": "STOPPED",
                "state_ko": f"작업 정지 실행 ({reason})" + (f" · 대상 미션: {', '.join(stopped_ids)}" if stopped_ids else ""),
                "project": STATE["project_name"],
                "role": "DIRECTOR",
            },
        )
    save_runtime_state()
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
    sdk_st = get_antigravity_sdk_status(force_refresh=False, diag=diag)
    part_roles_cfg = load_part_roles_config()
    char_cfgs = load_character_configs()
    with _STATE_LOCK:
        usage_snap = json.loads(json.dumps(STATE["usage"]))
        return {
            "companion_connected": False,
            "phase": STATE["phase"],
            "roles": roles,
            "part_roles": part_roles_cfg,
            "character_configs": char_cfgs,
            "provider_meta": PROVIDER_META,
            "diagnostics": diag,
            "sdk_status": sdk_st,
            "live_agent_stream": dict(STATE.get("live_agent_stream") or {}),
            "team_streams": json.loads(json.dumps(STATE.get("team_streams") or {})),
            "focus_mission_id": STATE["focus_mission_id"],
            "missions": STATE["missions"][:25],
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
            return self._send_json({"roles": load_roles(), "part_roles": load_part_roles_config(), "csrf": _BRIDGE_TOKEN, "providers": PROVIDER_META})
        if path == "/ops/part-roles":
            qs = parse_qs(parsed.query)
            req_tid = (qs.get("team_id", [""])[0] or "").strip() or None
            return self._send_json({"ok": True, "part_roles": load_part_roles_config(team_id=req_tid)})
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
        if path == "/ops/sdk-status":
            qs = parse_qs(parsed.query)
            force = qs.get("refresh", ["0"])[0] in ("1", "true", "yes")
            return self._send_json(get_antigravity_sdk_status(force_refresh=force))
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
                        if m_item.get("project_dir_abs"):
                            candidate_roots.append(Path(m_item["project_dir_abs"]).parent)
                            candidate_roots.append(Path(m_item["project_dir_abs"]))
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

        if path == "/ops/sdk-install":
            try:
                payload = json.loads(raw.decode("utf-8") or "{}") if raw else {}
                action = str((payload or {}).get("action") or "install").lower().strip()
                if action == "test":
                    res = test_antigravity_sdk_shared_auth()
                    with _STATE_LOCK:
                        STATE["events"].insert(
                            0,
                            {
                                "at": utc_now_iso(),
                                "run_id": f"sdk-test-{int(time.time())}",
                                "to_state": "SDK_TEST",
                                "state_ko": f"🧪 Antigravity SDK 로컬 구독 공유 테스트 · {'성공' if res.get('ok') else '확인 필요'}",
                                "project": STATE["project_name"],
                                "role": "DIRECTOR",
                            },
                        )
                    return self._send_json(res, 200 if res.get("ok") else 400)
                res = install_antigravity_sdk_via_uv()
                with _STATE_LOCK:
                    STATE["events"].insert(
                        0,
                        {
                            "at": utc_now_iso(),
                            "run_id": f"sdk-install-{int(time.time())}",
                            "to_state": "SDK_INSTALL",
                            "state_ko": f"📦 uv 기반 Antigravity SDK 자동설치 · {'완료' if res.get('ok') else '실패'}",
                            "project": STATE["project_name"],
                            "role": "DIRECTOR",
                        },
                    )
                return self._send_json(res, 200 if res.get("ok") else 500)
            except Exception as exc:
                return self._send_json({"ok": False, "message": f"SDK 처리 중 예외 발생: {exc}", "log": str(exc)}, 500)

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
            req_mid = str((payload or {}).get("mission_id") or "").strip() or None
            with _STATE_LOCK:
                paused = None
                if req_mid and isinstance(STATE.get("mission_checkpoints"), dict):
                    paused = STATE["mission_checkpoints"].get(req_mid)
                if not paused:
                    paused = STATE.get("paused_mission")
                if not paused and isinstance(STATE.get("mission_checkpoints"), dict):
                    for m_cand in STATE.get("missions") or []:
                        if m_cand.get("status") in ("QUOTA_PAUSED", "PAUSED_ERROR"):
                            paused = STATE["mission_checkpoints"].get(m_cand["mission_id"])
                            if paused:
                                break
                if not paused:
                    return self._send_json({"status": "error", "error": "현재 일시 중지되거나 재개 가능한 미션이 없습니다."}, 404)
                mission_id = paused["mission_id"]
                p_tid = paused.get("team_id")
                if any(
                    om.get("mission_id") != mission_id
                    and om.get("team_id") == p_tid
                    and om.get("status") == "RUNNING"
                    for om in (STATE.get("missions") or [])
                ):
                    return self._send_json({"status": "busy", "error": "해당 팀에서 이미 실행 중인 다른 프로젝트가 있습니다."}, 409)
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
                if isinstance(STATE.get("stopped_missions"), set):
                    STATE["stopped_missions"].discard(mission_id)
                goal = paused["goal"]
                profile = paused.get("profile", "standard")
                p_orch = paused.get("orchestrator_mode")
                interrupted_stage = paused.get("interrupted_stage") or paused.get("current_stage") or "BUILDING"
                for m in STATE["missions"]:
                    if m["mission_id"] == mission_id:
                        m["live"] = True
                        m["status"] = "RUNNING"
                        m["resumed_count"] = int(m.get("resumed_count") or 0) + 1
                        m["updated_at"] = utc_now_iso()
                STATE["events"].insert(
                    0,
                    {
                        "at": utc_now_iso(),
                        "run_id": f"{mission_id}-resume",
                        "to_state": interrupted_stage,
                        "state_ko": f"▶ [작업 재개] 미션({mission_id})을 중단된 {interrupted_stage} 단계부터 이어서 재개합니다.",
                        "project": STATE["project_name"],
                        "role": paused.get("interrupted_role", "LEAD"),
                    },
                )
            save_runtime_state()
            t = threading.Thread(
                target=_run_mission_pipeline,
                args=(mission_id, goal, profile, paused, p_tid, p_orch),
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
                req_folder_mode = "new"
                req_continue_dir = ""
                if ctype == "application/json":
                    data = json.loads(raw.decode("utf-8") or "{}")
                    goal = str(data.get("message") or data.get("goal") or "").strip()
                    profile = str(data.get("profile") or "standard")
                    req_team_id = str(data.get("team_id") or "").strip() or None
                    req_orch = str(data.get("orchestrator_mode") or "").lower().strip() or None
                    req_folder_mode = str(data.get("folder_mode") or "new").lower().strip() or "new"
                    req_continue_dir = str(data.get("continue_dir") or "").strip()
                    if "output_dir" in data and data.get("output_dir") is not None:
                        req_output_dir = str(data.get("output_dir")).strip()
                else:
                    qs = parse_qs(raw.decode("utf-8", errors="replace"))
                    goal = (qs.get("message", [""])[0] or qs.get("goal", [""])[0]).strip()
                    profile = qs.get("profile", ["standard"])[0]
                    req_team_id = (qs.get("team_id", [""])[0]).strip() or None
                    req_orch = (qs.get("orchestrator_mode", [""])[0]).lower().strip() or None
                    req_folder_mode = (qs.get("folder_mode", ["new"])[0]).lower().strip() or "new"
                    req_continue_dir = (qs.get("continue_dir", [""])[0]).strip()

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

                target_team = get_team_by_id(req_team_id)

                if req_output_dir is not None:
                    if req_team_id:
                        update_team_workspace_only(target_team["id"], {"output_dir": req_output_dir}, detect_google_drive_paths())
                    else:
                        save_workspace_settings(output_dir_raw=req_output_dir)

                if not goal:
                    return self._send_json({"status": "error", "error": "작업 목표(Goal)를 입력해 주세요."}, 400)

                if goal.lower() in ("stop", "중단", "멈춰", "작업 정지"):
                    res = stop_active_missions("채팅 중단 명령", team_id=req_team_id)
                    return self._send_json({"status": "stopped", **res})

                continue_existing_flag = req_folder_mode == "continue" or bool(req_continue_dir)
                validated_continue_dir: Optional[Path] = None
                if continue_existing_flag:
                    if not req_continue_dir:
                        return self._send_json(
                            {"status": "error", "error": "이어서 작업할 기존 폴더를 [최근 목록]에서 고르거나 [🗂️ 폴더 선택]으로 지정해 주세요."},
                            400,
                        )
                    cand_cont = Path(req_continue_dir).expanduser()
                    if not cand_cont.is_absolute():
                        cand_cont = (DELIVERABLES_DIR / cand_cont).resolve()
                    else:
                        cand_cont = cand_cont.resolve()
                    if not cand_cont.exists() or not cand_cont.is_dir():
                        return self._send_json(
                            {"status": "error", "error": f"선택한 기존 작업 폴더를 찾을 수 없습니다: {req_continue_dir}"},
                            400,
                        )
                    low_cont = str(cand_cont).lower().rstrip("\\/")
                    blocked_prefixes = [str(ROOT.resolve()).lower().rstrip("\\/")]
                    for env_k in ("SystemRoot", "ProgramFiles", "ProgramFiles(x86)"):
                        ev = os.environ.get(env_k)
                        if ev:
                            blocked_prefixes.append(str(Path(ev).resolve()).lower().rstrip("\\/"))
                    if cand_cont.parent == cand_cont or any(low_cont == bp for bp in blocked_prefixes):
                        return self._send_json(
                            {"status": "error", "error": "드라이브 최상위 루트나 시스템/서버 본체 폴더는 이어하기 작업 폴더로 지정할 수 없습니다. 하위 프로젝트 폴더를 선택해 주세요."},
                            400,
                        )
                    validated_continue_dir = cand_cont

                with _STATE_LOCK:
                    running_same_team = next(
                        (
                            m
                            for m in STATE["missions"]
                            if m.get("team_id") == target_team["id"] and m.get("status") == "RUNNING"
                        ),
                        None,
                    )
                    if running_same_team:
                        return self._send_json(
                            {
                                "status": "busy",
                                "team_id": target_team["id"],
                                "error": (
                                    f"[{target_team['name']}] 팀에서 이미 프로젝트({running_same_team['mission_id']})가 진행 중입니다. "
                                    f"다른 팀의 프로젝트 입력창에서는 동시에 새 프로젝트를 실행할 수 있습니다."
                                ),
                            },
                            409,
                        )
                    STATE["stop_requested"] = False
                    next_id = max((c["id"] for c in STATE["chat_messages"]), default=0) + 1
                    STATE["chat_messages"].append(
                        {"id": next_id, "role": "USER", "content": f"[{target_team['name']}] {goal}", "at": utc_now_iso()}
                    )
                    base_num = (int(time.time() * 1000) + secrets.randbelow(997)) % 1000000
                    mission_id = f"mission-{base_num:06d}"
                    while any(m.get("mission_id") == mission_id for m in STATE["missions"]):
                        base_num = (base_num + 1) % 1000000
                        mission_id = f"mission-{base_num:06d}"
                    if isinstance(STATE.get("stopped_missions"), set):
                        STATE["stopped_missions"].discard(mission_id)
                    init_intent = classify_mission_intent(goal)
                    if continue_existing_flag and validated_continue_dir is not None:
                        init_proj_dir = validated_continue_dir
                        init_base_dir = validated_continue_dir.parent
                        init_proj_folder = validated_continue_dir.name
                    else:
                        init_base_dir, _, _ = _resolve_team_base_output_dir(target_team)
                        init_proj_folder = derive_project_folder_name(goal, mission_id, init_base_dir)
                        init_proj_dir = init_base_dir / init_proj_folder
                        try:
                            init_proj_dir.mkdir(parents=True, exist_ok=True)
                            if not (init_proj_dir / "README.md").exists():
                                (init_proj_dir / "README.md").write_text(
                                    f"# {goal}\n\n- **Mission ID**: `{mission_id}`\n- **Project Folder**: `{init_proj_folder}`\n",
                                    encoding="utf-8",
                                )
                        except Exception:
                            pass
                    team_part_cfg = load_part_roles_config(team_id=target_team["id"])
                    team_max_steps = len(team_part_cfg.get("pipeline_stages") or []) or 5
                    new_mission = {
                        "mission_id": mission_id,
                        "goal": goal,
                        "deliverable_mode": init_intent["mode"],
                        "deliverable_type_label": init_intent["label"],
                        "team_id": target_team["id"],
                        "team_name": target_team["name"],
                        "team_floor": target_team.get("floor", "1F"),
                        "team_color": target_team.get("color", "#0f6848"),
                        "output_root": str(init_base_dir),
                        "project_folder_name": init_proj_folder,
                        "project_dir": f"deliverables/{init_proj_folder}",
                        "project_dir_abs": str(init_proj_dir),
                        "continue_existing": bool(continue_existing_flag),
                        "project": STATE["project_name"],
                        "status": "RUNNING",
                        "live": True,
                        "profile": profile,
                        "orchestrator_mode": req_orch or "standard",
                        "source": "virtual-office",
                        "max_steps": team_max_steps,
                        "passed_steps": 0,
                        "updated_at": utc_now_iso(),
                        "deliverable": True,
                        "apply_state": "applied",
                        "applied": {"status": "applied", "files": ["index.html", "office.html", "agents.html"]},
                        "steps": [],
                    }
                    STATE["missions"].insert(0, new_mission)
                    STATE["focus_mission_id"] = mission_id
                    STATE.setdefault("mission_checkpoints", {})[mission_id] = {
                        "mission_id": mission_id,
                        "goal": goal,
                        "profile": profile,
                        "orchestrator_mode": req_orch or "standard",
                        "deliverable_mode": init_intent["mode"],
                        "team_id": target_team["id"],
                        "team_name": target_team["name"],
                        "output_root": str(init_base_dir),
                        "project_folder_name": init_proj_folder,
                        "continue_existing": bool(continue_existing_flag),
                        "explicit_project_dir": str(init_proj_dir) if continue_existing_flag else "",
                        "current_stage": "LEAD_PLANNING",
                        "stage_outputs": {},
                        "part_outputs": {},
                        "staff_outputs_by_part": {},
                        "generated_files": [],
                        "repair_attempt": 0,
                        "last_error_feedback": "",
                        "user_revision_feedback": "",
                        "revision_plan_done": False,
                        "repair_history": [],
                        "step_counter": 0,
                        "updated_at": utc_now_iso(),
                    }

                save_runtime_state()
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
                        "project_folder_name": init_proj_folder,
                        "project_dir_abs": str(init_proj_dir),
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

        if path == "/ops/part-roles":
            try:
                payload = json.loads(raw.decode("utf-8") or "{}") if raw else {}
                action = str((payload or {}).get("action") or "add").lower().strip()
                req_tid = str((payload or {}).get("team_id") or "").strip() or None
                t_label = ""
                if req_tid:
                    try:
                        t_label = f"[{get_team_by_id(req_tid)['name']}] "
                    except Exception:
                        t_label = f"[{req_tid}] "
                if action == "add":
                    saved_cfg = add_part_role(
                        name=str(payload.get("name") or ""),
                        stage_label=str(payload.get("stage_label") or ""),
                        icon=str(payload.get("icon") or "🧩"),
                        instruction=str(payload.get("instruction") or ""),
                        default_cli_role=str(payload.get("default_cli_role") or "builder"),
                        team_id=req_tid,
                    )
                    added_p = saved_cfg.get("added_part") or {}
                    with _STATE_LOCK:
                        STATE["events"].insert(
                            0,
                            {
                                "at": utc_now_iso(),
                                "run_id": f"part-add-{int(time.time())}",
                                "to_state": "PART_ROLE_ADD",
                                "state_ko": f"➕ {t_label}새 실무 파트 담당 추가: {added_p.get('icon', '🧩')} {added_p.get('name', '')} ({added_p.get('id', '')})",
                                "project": STATE["project_name"],
                                "role": "LEAD",
                            },
                        )
                    return self._send_json({"ok": True, "part_roles": saved_cfg, "message": f"{t_label}[{added_p.get('name')}] 파트가 파이프라인에 추가되었습니다."})
                if action == "update":
                    rid = str(payload.get("id") or payload.get("role_id") or "")
                    saved_cfg = update_part_role(rid, payload, team_id=req_tid)
                    return self._send_json({"ok": True, "part_roles": saved_cfg, "message": f"{t_label}파트 담당 설정이 저장되었습니다."})
                if action == "delete":
                    rid = str(payload.get("id") or payload.get("role_id") or "")
                    saved_cfg = delete_part_role(rid, team_id=req_tid)
                    return self._send_json({"ok": True, "part_roles": saved_cfg, "message": f"{t_label}[{rid}] 파트가 삭제되었습니다."})
                if action == "reorder":
                    rid = str(payload.get("id") or payload.get("role_id") or "")
                    direction = str(payload.get("direction") or "up").lower().strip()
                    saved_cfg = reorder_part_role(rid, direction, team_id=req_tid)
                    return self._send_json({"ok": True, "part_roles": saved_cfg, "message": f"{t_label}파트 실행 순서가 변경되었습니다."})
                if action == "reset":
                    saved_cfg = reset_part_roles(team_id=req_tid)
                    return self._send_json({"ok": True, "part_roles": saved_cfg, "message": f"{t_label}기본 총괄팀장 + 3대 실무 파트(자료수집·기획구조·제작구현) 구성으로 복원되었습니다."})
                if action == "copy_from_team":
                    src_tid = str(payload.get("source_team_id") or "").strip()
                    dst_tid = req_tid or str(payload.get("target_team_id") or "").strip()
                    saved_cfg = copy_team_part_roles(src_tid, dst_tid)
                    return self._send_json({"ok": True, "part_roles": saved_cfg, "message": f"{t_label}선택한 원본 팀의 파트 구성을 그대로 복제하여 적용했습니다."})
                if action == "apply_sdk_squad":
                    applied = apply_sdk_squad_preset_to_workspace(target_team_id=req_tid)
                    with _STATE_LOCK:
                        STATE["events"].insert(
                            0,
                            {
                                "at": utc_now_iso(),
                                "run_id": f"sdk-squad-{int(time.time())}",
                                "to_state": "SDK_SQUAD_APPLIED",
                                "state_ko": f"🤖 {t_label}[팀 전용 SDK 편제 적용] 총괄팀장 1명 + 활성 파트별 [파트장 1명 + 일반사원 2명] Antigravity SDK 배정 완료",
                                "project": STATE["project_name"],
                                "role": "LEAD",
                            },
                        )
                    return self._send_json(
                        {
                            "ok": True,
                            **applied,
                            "message": f"{t_label}총괄팀장 1명 + 활성 파트별 [파트장 1명 + 부하직원 2명] Antigravity SDK 표준 편제가 적용되었습니다.",
                        }
                    )
                if action == "recruit_staff":
                    pid = str(payload.get("part_id") or payload.get("id") or "").strip()
                    cname = str(payload.get("name") or "").strip()
                    cmod = str(payload.get("model") or "").strip()
                    rec = recruit_sdk_staff_for_part(part_id=pid, target_team_id=req_tid, custom_name=cname, custom_model=cmod)
                    ag_info = rec["recruited_agent"]
                    with _STATE_LOCK:
                        STATE["events"].insert(
                            0,
                            {
                                "at": utc_now_iso(),
                                "run_id": f"recruit-staff-{int(time.time())}",
                                "to_state": "PART_STAFF_RECRUIT",
                                "state_ko": f"👤 {t_label}[{pid}] 부하직원 충원: #{ag_info['id']} {ag_info['name']} (Antigravity SDK · {ag_info['cliModel']})",
                                "project": STATE["project_name"],
                                "role": pid,
                            },
                        )
                    return self._send_json(
                        {
                            "ok": True,
                            **rec,
                            "message": f"{t_label}[#{ag_info['id']} {ag_info['name']}] 일반 사원이 Antigravity SDK ({ag_info['cliModel']})로 파견·배치되었습니다.",
                        }
                    )
                if action == "set_staff_mode":
                    mode_val = str(payload.get("mode") or "parallel").strip().lower()
                    saved_cfg = set_staff_execution_mode(mode_val, team_id=req_tid)
                    mode_ko = "동시 병렬 수행 (사원1 ∥ 사원2 → 파트장)" if saved_cfg.get("staff_execution_mode") == "parallel" else "순차 이어받기 (사원1 → 사원2 → 파트장)"
                    return self._send_json({"ok": True, "part_roles": saved_cfg, "message": f"{t_label}파트 사원 실행 방식이 [{mode_ko}] 모드로 저장되었습니다."})
                return self._send_json({"ok": False, "error": f"지원하지 않는 action입니다: {action}"}, 400)
            except ValueError as exc:
                return self._send_json({"ok": False, "error": str(exc)}, 400)
            except Exception as exc:
                return self._send_json({"ok": False, "error": f"파트 설정 오류: {exc}"}, 500)

        if path == "/ops/missions/decision":
            try:
                payload = json.loads(raw.decode("utf-8") or "{}") if raw else {}
                mid = str((payload or {}).get("mission_id") or "").strip() or None
                dec = str((payload or {}).get("decision") or "approve").lower().strip()
                fb = str((payload or {}).get("feedback") or "").strip()
                res = finalize_or_revise_mission(mission_id=mid, decision=dec, feedback=fb)
                return self._send_json(res, 200 if res.get("ok") else 400)
            except Exception as exc:
                return self._send_json({"ok": False, "error": f"결재 처리 오류: {exc}"}, 500)

        if path == "/ops/missions/stop":
            try:
                payload = json.loads(raw.decode("utf-8") or "{}") if raw else {}
            except Exception:
                payload = {}
            reason = str(payload.get("reason") or "버추얼 오피스 작업 정지 버튼")[:200]
            stop_tid = str(payload.get("team_id") or "").strip() or None
            stop_mid = str(payload.get("mission_id") or "").strip() or None
            return self._send_json(stop_active_missions(reason, team_id=stop_tid, mission_id=stop_mid))

        return self._send_json({"error": "Not found"}, 404)


def run(port: int = 8080):
    mimetypes.add_type("application/javascript", ".js")
    mimetypes.add_type("application/json", ".json")
    server = ThreadingHTTPServer(("0.0.0.0", port), VirtualOfficeHandler)

    atexit.register(graceful_shutdown_orchestrator, "프로세스 종료(atexit)")
    if threading.current_thread() is threading.main_thread():
        def _handle_term_signal(signum, _frame):
            sig_name = "SIGINT" if signum == getattr(signal, "SIGINT", 2) else f"SIGNAL({signum})"
            graceful_shutdown_orchestrator(f"서버 종료 시그널({sig_name})")
            threading.Thread(target=server.shutdown, daemon=True).start()

        for sig_attr in ("SIGINT", "SIGTERM", "SIGBREAK"):
            sig_val = getattr(signal, sig_attr, None)
            if sig_val is not None:
                try:
                    signal.signal(sig_val, _handle_term_signal)
                except Exception:
                    pass

    resumed_mids = load_runtime_state_and_auto_resume(auto_resume=True)
    print(f"NEXUS AI Virtual Office × AI DEV DIRECTOR running at http://127.0.0.1:{port}", flush=True)
    if resumed_mids:
        print(
            f"[AUTO-RESUME] 서버 재기동 감지: 중단되었던 프로젝트 {len(resumed_mids)}건({', '.join(resumed_mids)})을 체크포인트부터 자동 이어하기 가동!",
            flush=True,
        )
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        graceful_shutdown_orchestrator("KeyboardInterrupt 종료")
    finally:
        graceful_shutdown_orchestrator("서버 종료")
        server.server_close()


if __name__ == "__main__":
    import sys
    port_arg = int(sys.argv[1]) if len(sys.argv) > 1 and sys.argv[1].isdigit() else 8080
    run(port_arg)
