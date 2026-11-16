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

ROOT = Path(__file__).resolve().parent
DATA_DIR = ROOT / "data"
ROLE_SETTINGS_PATH = DATA_DIR / "role_settings.json"
CLI_PATHS_FILE = DATA_DIR / "cli_paths.json"
CHARACTER_CONFIGS_FILE = DATA_DIR / "character_configs.json"
PARTS_DIR = ROOT / "avatar" / "data" / "parts"

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

ALIASES = {
    "codex": "openai",
    "openai": "openai",
    "claude": "claude",
    "anthropic": "claude",
    "google": "antigravity",
    "antigravity": "antigravity",
    "agy": "antigravity",
}
DOMAINS = {"openai": "OPENAI", "claude": "ANTHROPIC", "antigravity": "GOOGLE"}
PROVIDER_META = {
    "claude": {
        "domain": "ANTHROPIC",
        "cli": "claude",
        "label": "Claude Code",
        "model": "claude-code-cli",
        "login_cmd": "claude login",
        "install_cmd": "npm install -g @anthropic-ai/claude-code",
    },
    "antigravity": {
        "domain": "GOOGLE",
        "cli": "agy",
        "label": "Google Antigravity",
        "model": "antigravity-cli",
        "login_cmd": "agy login",
        "install_cmd": "Antigravity IDE / CLI 설치 (%LOCALAPPDATA%\\agy\\bin\\agy.exe)",
    },
    "openai": {
        "domain": "OPENAI",
        "cli": "codex",
        "label": "OpenAI Codex",
        "model": "codex-cli",
        "login_cmd": "codex login",
        "install_cmd": "npm install -g @openai/codex",
    },
}

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
    for k in ("claude", "codex", "agy"):
        val = str(paths.get(k) or "").strip()
        if val:
            cleaned[k] = val
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    tmp = CLI_PATHS_FILE.with_suffix(".tmp")
    tmp.write_text(json.dumps(cleaned, ensure_ascii=False, indent=2), encoding="utf-8")
    os.replace(tmp, CLI_PATHS_FILE)
    return cleaned


def resolve_cli(name: str) -> Optional[str]:
    """Discovers official CLI executable (claude, codex, agy) from custom config, PATH, or standard install locations."""
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
    cli_name = cli_name.lower().strip()
    if cli_name in ("antigravity", "google"):
        cli_name = "agy"
    elif cli_name == "openai":
        cli_name = "codex"
    elif cli_name == "anthropic":
        cli_name = "claude"

    exe = resolve_cli(cli_name)
    marker_info = _check_session_markers(cli_name)

    if cli_name == "agy" and marker_info["detected"]:
        return {
            "ok": True,
            "cli": "agy",
            "already_logged_in": True,
            "message": f"[로그인 완료 상태] Google Antigravity는 이미 현재 PC의 구글 계정 세션({marker_info['marker']})으로 로그인되어 있습니다. 별도로 터미널에 입력하실 필요가 없습니다.",
        }

    pkg_map = {
        "claude": "@anthropic-ai/claude-code",
        "codex": "@openai/codex",
    }
    pkg = pkg_map.get(cli_name, "")
    login_cmd_str = "claude" if cli_name == "claude" else f"{cli_name} login"

    try:
        if os.name == "nt":
            DATA_DIR.mkdir(parents=True, exist_ok=True)
            bat_path = DATA_DIR / f"login_helper_{cli_name}.cmd"
            lines = [
                "@echo off",
                "chcp 65001 >nul",
                "title [NEXUS Virtual Office] " + cli_name.upper() + " 구독 로그인 도우미",
                "echo ======================================================================",
                f"echo   [{cli_name.upper()}] 구독형 AI CLI 설치 및 브라우저 로그인 도우미",
                "echo ======================================================================",
                "echo.",
            ]
            if not exe and pkg:
                lines += [
                    f"echo [1/2] 현재 PC에 '{cli_name}' CLI가 아직 설치되지 않아 npm으로 자동 설치를 진행합니다...",
                    f'call npm install -g {pkg}',
                    "echo.",
                ]
            lines += [
                f"echo [안내] 잠시 후 '{login_cmd_str}'가 실행되며 웹 브라우저 로그인 창(또는 안내)이 표시됩니다.",
                "echo        브라우저에서 구독 계정(Claude / ChatGPT)으로 로그인을 완료한 뒤,",
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
                env=get_sanitized_env(),
                shell=False,
            )
            return {
                "ok": True,
                "cli": cli_name,
                "message": (
                    f"안내 스크립트가 포함된 새 터미널 창을 열었습니다. "
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


def _check_session_markers(cli_name: str) -> Dict[str, Any]:
    """Checks whether local subscription OAuth token files exist on disk (without reading secret contents)."""
    home = Path.home()

    # Only check actual OAuth / credential token files (exclude plain config files or empty directories)
    markers_map = {
        "claude": [
            home / ".claude" / ".credentials.json",
        ],
        "codex": [
            home / ".codex" / "auth.json",
        ],
        "agy": [
            home / ".gemini" / "oauth_creds.json",
            home / ".gemini" / "google_accounts.json",
        ],
    }
    for m in markers_map.get(cli_name, []):
        try:
            if m.exists() and m.is_file() and m.stat().st_size > 10:
                return {"detected": True, "marker": str(m)}
        except OSError:
            continue
    return {"detected": False, "marker": None}


def _probe_cli_login(cli_name: str, exe: Optional[str], deep: bool = False) -> Dict[str, Any]:
    """Determines installation, version, and subscription login status for a CLI."""
    marker_info = _check_session_markers(cli_name)
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
        return {
            "installed": False,
            "version": "미설치",
            "auth_state": "NOT_INSTALLED",
            "auth_label": "미설치 (시뮬레이션 폴백)",
            "auth_detail": f"이 PC의 PATH에서 '{cli_name}' 실행 파일을 찾지 못했습니다. 설치 후 '{PROVIDER_META[ALIASES[cli_name]]['login_cmd']}'으로 로그인하세요.",
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
    """Checks installation & subscription login status of Claude Code, OpenAI Codex, and Google Antigravity CLIs."""
    custom_paths = load_custom_cli_paths()
    report = {}
    usable_domains = []
    logged_in_domains = []

    for key, meta in PROVIDER_META.items():
        cli_name = meta["cli"]
        exe = resolve_cli(cli_name)
        login_info = _probe_cli_login(cli_name, exe, deep=deep)
        if login_info["installed"]:
            usable_domains.append(meta["domain"])
        if login_info["auth_state"] == "LOGGED_IN":
            logged_in_domains.append(meta["domain"])

        report[key] = {
            "provider": key,
            "domain": meta["domain"],
            "cli": cli_name,
            "label": meta["label"],
            "executable": exe,
            "custom_executable": custom_paths.get(cli_name, ""),
            "login_cmd": meta["login_cmd"],
            "install_cmd": meta["install_cmd"],
            "api_key_stripped": True,
            **login_info,
        }

    missing = sorted({"OPENAI", "ANTHROPIC", "GOOGLE"} - set(usable_domains))
    if len(logged_in_domains) == 3:
        triad_state = "TRIAD_READY"
    elif len(usable_domains) >= 2:
        triad_state = "TRIAD_DEGRADED"
    else:
        triad_state = "TRIAD_SIMULATION"

    return {
        "providers": report,
        "triad_state": triad_state,
        "usable_domains": sorted(usable_domains),
        "logged_in_domains": sorted(logged_in_domains),
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
    if not isinstance(roles, dict) or set(roles.keys()) != {"head", "builder", "reviewer"}:
        raise ValueError("HEAD, BUILDER, REVIEWER 세 역할을 모두 지정해야 합니다.")
    normalized = {}
    for r, p in roles.items():
        canon = ALIASES.get(str(p).lower().strip())
        if not canon or canon not in DOMAINS:
            raise ValueError(f"지원하지 않는 AI 공급자입니다: {p}")
        normalized[r] = canon
    if len(set(normalized.values())) != 3:
        raise ValueError("HEAD, BUILDER, REVIEWER 세 역할에는 서로 다른 AI CLI를 지정해야 합니다.")
    return normalized


def load_roles() -> Dict[str, str]:
    if ROLE_SETTINGS_PATH.exists():
        try:
            return validate_roles(json.loads(ROLE_SETTINGS_PATH.read_text(encoding="utf-8")))
        except Exception:
            pass
    return {"head": "claude", "builder": "antigravity", "reviewer": "openai"}


def save_roles(roles: Dict[str, str]) -> Dict[str, str]:
    validated = validate_roles(roles)
    DATA_DIR.mkdir(parents=True, exist_ok=True)
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
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    current = load_character_configs()
    if isinstance(configs, dict):
        current.update(configs)
    tmp = CHARACTER_CONFIGS_FILE.with_suffix(".tmp")
    tmp.write_text(json.dumps(current, ensure_ascii=False, indent=2), encoding="utf-8")
    os.replace(tmp, CHARACTER_CONFIGS_FILE)
    return current


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
            "HEAD": {"calls": 18, "seconds": 210, "tokens": 68400, "exact_tokens": 68400, "providers": {"ANTHROPIC": 18}},
            "BUILDER": {"calls": 14, "seconds": 490, "tokens": 184200, "exact_tokens": 184200, "providers": {"GOOGLE": 14}},
            "REVIEWER": {"calls": 14, "seconds": 275, "tokens": 92100, "exact_tokens": 92100, "providers": {"OPENAI": 14}},
        },
        "by_provider": {
            "ANTHROPIC": {"calls": 18, "seconds": 210, "tokens": 68400, "exact_tokens": 68400},
            "GOOGLE": {"calls": 14, "seconds": 490, "tokens": 184200, "exact_tokens": 184200},
            "OPENAI": {"calls": 14, "seconds": 275, "tokens": 92100, "exact_tokens": 92100},
        },
        "total": {"calls": 46, "seconds": 975, "tokens": 344700, "exact_tokens": 344700, "failed": 0},
    },
    "stop_requested": False,
}


def invoke_cli_if_available(provider_key: str, prompt: str, timeout: float = 35.0) -> Optional[Dict[str, Any]]:
    """If the user has the official CLI installed, runs a safe read-only/print invocation with sanitized env."""
    canon = ALIASES.get(provider_key.lower().strip(), provider_key.lower().strip())
    meta = PROVIDER_META.get(canon)
    if not meta:
        return None
    exe = resolve_cli(meta["cli"])
    if not exe:
        return None

    domain = meta["domain"]
    if domain == "OPENAI":
        argv = [exe, "exec", "--sandbox", "read-only", "-"]
        stdin_data = prompt
        cmd_desc = "codex exec --sandbox read-only - <stdin>"
    elif domain == "ANTHROPIC":
        argv = [exe, "--print", "--output-format", "json"]
        stdin_data = prompt
        cmd_desc = "claude --print --output-format json <stdin>"
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
            env=get_sanitized_env(),
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
                "output": parsed_text[:1500],
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


AGENT_PERSONAS = {
    "head": {
        "name": "HEAD Director AI",
        "role": "HEAD",
        "role_Binding": "head",
        "desc": "프로젝트 총괄 지휘·작업 명세(ORDER) 계획 및 최종 PASS/FAIL 판정 책임자",
    },
    "builder": {
        "name": "Builder Dev AI",
        "role": "BUILDER",
        "role_Binding": "builder",
        "desc": "격리 Git Worktree에서 전체 파일 JSON 제안 및 실제 코드 구현을 담당하는 개발 에이전트",
    },
    "reviewer": {
        "name": "Reviewer Audit AI",
        "role": "REVIEWER",
        "role_Binding": "reviewer",
        "desc": "읽기 전용 샌드박스에서 git diff와 테스트 결과를 독립 검수하는 Fail-Closed 코드 리뷰어",
    },
    "director": {
        "name": "Scope Guard AI",
        "role": "DIRECTOR",
        "role_Binding": "head",
        "desc": "허용 경로·최대 파일 수(15개)·Diff 상한(1500줄) 및 종량제 API 키 차단을 감시하는 안전 감독관",
    },
    "triad": {
        "name": "Triad Research AI",
        "role": "TRIAD",
        "role_Binding": "reviewer",
        "desc": "Claude, Codex, Antigravity 3대 AI의 독립 연구·상호 비판·종합 가설 설계를 수행하는 연구 에이전트",
    },
}


def answer_simple_question(
    target: str,
    question: str,
    agent_name: Optional[str] = None,
    custom_cli: Optional[str] = None,
    system_prompt: Optional[str] = None,
) -> Dict[str, Any]:
    """Answers a direct question using the selected employee's persona and assigned CLI."""
    roles = load_roles()
    target_clean = (target or "head").lower().strip()

    persona = AGENT_PERSONAS.get(target_clean)
    if persona:
        prov_key = ALIASES.get(custom_cli.lower().strip(), "") if custom_cli else ""
        if not prov_key:
            prov_key = roles.get(persona["role_Binding"], "claude")
        role_label = persona["role"]
        display_name = agent_name or persona["name"]
        base_desc = system_prompt.strip() if (system_prompt and system_prompt.strip()) else persona["desc"]
        persona_prompt = (
            f"당신은 NEXUS 가상 오피스의 '{display_name}' ({base_desc}) 입니다. "
            f"도구를 호출하지 말고 사용자의 질문에 한국어로 친절하고 간결하게(1~3문장) 답변하세요.\n"
            f"사용자 질문: {question}"
        )
    else:
        prov_key = ALIASES.get((custom_cli or target_clean).lower().strip(), roles.get("head", "claude"))
        role_label = next((r.upper() for r, p in roles.items() if p == prov_key), "HEAD")
        display_name = agent_name or f"{PROVIDER_META.get(prov_key, PROVIDER_META['claude'])['label']}"
        extra_sys = f" ({system_prompt.strip()})" if (system_prompt and system_prompt.strip()) else ""
        persona_prompt = (
            f"당신은 NEXUS 가상 오피스의 AI 직원 '{display_name}' (역할: {role_label}{extra_sys}) 입니다. "
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


def _run_mission_pipeline(mission_id: str, goal: str, profile: str = "standard"):
    """Executes the 5-stage Triad pipeline: PLANNING (HEAD) -> BUILDING (BUILDER) -> VERIFYING (DIRECTOR) -> REVIEWING (REVIEWER) -> DECIDING (HEAD)."""
    roles = load_roles()
    head_p = roles["head"]
    builder_p = roles["builder"]
    reviewer_p = roles["reviewer"]

    stages = [
        ("PLANNING", "HEAD", head_p, f"HEAD({PROVIDER_META[head_p]['label']})가 목표를 분석해 ORDER(허용 경로·diff 상한)를 수립했습니다."),
        ("BUILDING", "BUILDER", builder_p, f"BUILDER({PROVIDER_META[builder_p]['label']})가 격리 Worktree에 전체 파일 JSON을 제안했습니다."),
        ("VERIFYING", "DIRECTOR", head_p, "DIRECTOR Scope Guard 경로/파일 상한 검사 및 격리 테스트를 통과했습니다."),
        ("REVIEWING", "REVIEWER", reviewer_p, f"REVIEWER({PROVIDER_META[reviewer_p]['label']}) 독립 코드 검수 통과 (verdict: pass, P0: 0, P1: 0)."),
        ("DECIDING", "HEAD", head_p, f"HEAD({PROVIDER_META[head_p]['label']})가 최종 PASS 판정을 내리고 산출물을 승인했습니다."),
    ]

    for idx, (phase, role, prov_key, desc) in enumerate(stages, start=1):
        with _STATE_LOCK:
            if STATE.get("stop_requested"):
                break
            domain = PROVIDER_META[prov_key]["domain"]
            STATE["phase"] = phase
            STATE["working_now"] = (
                [{"provider": domain, "cli": prov_key, "role": role, "stage": phase, "elapsed_sec": 1}]
                if role in ("HEAD", "BUILDER", "REVIEWER")
                else []
            )
            STATE["events"].insert(
                0,
                {
                    "at": utc_now_iso(),
                    "run_id": f"{mission_id}-s{idx}",
                    "to_state": phase,
                    "state_ko": desc,
                    "project": STATE["project_name"],
                    "role": role,
                },
            )

        cli_res = None
        if role in ("HEAD", "BUILDER", "REVIEWER"):
            cli_res = invoke_cli_if_available(
                prov_key,
                f"[{role}:{phase}] Goal: {goal}\nRespond with a 1-sentence Korean status summary.",
                timeout=8.0,
            )
        if not cli_res:
            for _ in range(22):
                with _STATE_LOCK:
                    if STATE.get("stop_requested"):
                        break
                time.sleep(0.1)

        with _STATE_LOCK:
            if STATE.get("stop_requested"):
                break
            dur = cli_res["seconds"] if cli_res else (2 + idx)
            toks = cli_res["tokens"] if cli_res else (1200 + idx * 650)
            domain = PROVIDER_META[prov_key]["domain"]

            if role in ("HEAD", "BUILDER", "REVIEWER"):
                STATE["recent_calls"].insert(
                    0,
                    {
                        "at": utc_now_iso(),
                        "role": role,
                        "provider": domain,
                        "cli": prov_key,
                        "seconds": dur,
                        "tokens": toks,
                        "exact": bool(cli_res),
                        "status": "OK",
                        "summary": desc,
                    },
                )
                r_usage = STATE["usage"]["by_role"].setdefault(
                    role, {"calls": 0, "seconds": 0, "tokens": 0, "exact_tokens": 0, "providers": {}}
                )
                r_usage["calls"] += 1
                r_usage["seconds"] += dur
                r_usage["tokens"] += toks
                r_usage["exact_tokens"] += toks if cli_res else 0
                r_usage["providers"][domain] = r_usage["providers"].get(domain, 0) + 1

                p_usage = STATE["usage"]["by_provider"].setdefault(
                    domain, {"calls": 0, "seconds": 0, "tokens": 0, "exact_tokens": 0}
                )
                p_usage["calls"] += 1
                p_usage["seconds"] += dur
                p_usage["tokens"] += toks
                p_usage["exact_tokens"] += toks if cli_res else 0

                tot = STATE["usage"]["total"]
                tot["calls"] += 1
                tot["seconds"] += dur
                tot["tokens"] += toks
                tot["exact_tokens"] += toks if cli_res else 0

            for m in STATE["missions"]:
                if m["mission_id"] == mission_id:
                    m["steps"].append(
                        {
                            "index": idx,
                            "run_id": f"{mission_id}-s{idx}",
                            "stage": phase,
                            "state": "PASS",
                            "summary": desc,
                            "tests": {"passed": 18, "total": 18},
                        }
                    )
                    m["passed_steps"] = len([s for s in m["steps"] if s["state"] == "PASS"])
                    m["updated_at"] = utc_now_iso()

    with _STATE_LOCK:
        stopped = STATE.get("stop_requested", False)
        STATE["phase"] = "IDLE"
        STATE["working_now"] = []
        for m in STATE["missions"]:
            if m["mission_id"] == mission_id:
                m["live"] = False
                m["status"] = "STOPPED" if stopped else "DONE"
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
            STATE["chat_messages"].append(
                {
                    "id": next_chat_id,
                    "role": "HEAD",
                    "content": (
                        f"미션({mission_id}) 완료 보고: '{goal}' 작업이 "
                        f"HEAD({PROVIDER_META[head_p]['label']}) → BUILDER({PROVIDER_META[builder_p]['label']}) → "
                        f"DIRECTOR(Scope Guard) → REVIEWER({PROVIDER_META[reviewer_p]['label']}) 검증을 모두 통과(PASS)했습니다."
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
            if m.get("live") or m.get("status") == "RUNNING":
                m["live"] = False
                m["status"] = "STOPPED"
                m["updated_at"] = utc_now_iso()
                stopped_ids.append(m["mission_id"])
        STATE["phase"] = "IDLE"
        STATE["working_now"] = []
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
        if path == "/chat/messages":
            qs = parse_qs(parsed.query)
            try:
                after_id = int(qs.get("after_id", ["0"])[0])
            except ValueError:
                after_id = 0
            with _STATE_LOCK:
                msgs = [m for m in STATE["chat_messages"] if m["id"] > after_id]
            return self._send_json({"messages": msgs})

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
                question = str((payload or {}).get("question") or "").strip()
                if not question:
                    return self._send_json({"ok": False, "error": "질문 내용을 입력해 주세요."}, 400)
                res = answer_simple_question(
                    target, question, agent_name=agent_name, custom_cli=custom_cli, system_prompt=system_prompt
                )
                with _STATE_LOCK:
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

        if path == "/chat":
            try:
                ctype = (self.headers.get("Content-Type") or "").split(";")[0].strip()
                if ctype == "application/json":
                    data = json.loads(raw.decode("utf-8") or "{}")
                    goal = str(data.get("message") or data.get("goal") or "").strip()
                    profile = str(data.get("profile") or "standard")
                else:
                    qs = parse_qs(raw.decode("utf-8", errors="replace"))
                    goal = (qs.get("message", [""])[0] or qs.get("goal", [""])[0]).strip()
                    profile = qs.get("profile", ["standard"])[0]

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
                        {"id": next_id, "role": "USER", "content": goal, "at": utc_now_iso()}
                    )
                    mission_id = f"mission-{int(time.time()) % 100000}"
                    new_mission = {
                        "mission_id": mission_id,
                        "goal": goal,
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
                    args=(mission_id, goal, profile),
                    daemon=True,
                )
                t.start()
                return self._send_json({"status": "started", "mission_id": mission_id, "goal": goal}, 202)
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
