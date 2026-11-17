"""
설정 및 데이터 폴더 경로 구조화 모듈 (Directory Structure Manager)
- config/cli/          : AI CLI 로그인 슬롯(cli_slots.json), 실행 경로(cli_paths.json), 역할 배정(role_settings.json)
- config/cli/login_scripts/ : 원클릭 CLI 로그인 도우미 스크립트(login_helper_*.cmd)
- config/characters/   : 캐릭터 시뮬레이터 코디·페르소나·스킬 설정(character_configs.json)
- deliverables/        : 5단계 파이프라인 미션 산출물 리포트(.md) 및 생성된 프로젝트 폴더(*_project/)
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"

# [1] AI CLI 로그인 · 슬롯 · 역할 · 실행경로 전용 폴더 (config/cli/)
CLI_CONFIG_DIR = ROOT / "config" / "cli"
LOGIN_SCRIPTS_DIR = CLI_CONFIG_DIR / "login_scripts"
ROLE_SETTINGS_PATH = CLI_CONFIG_DIR / "role_settings.json"
ROLE_SETTINGS_SAMPLE_PATH = CLI_CONFIG_DIR / "role_settings.sample.json"
CLI_PATHS_FILE = CLI_CONFIG_DIR / "cli_paths.json"
CLI_PATHS_SAMPLE_FILE = CLI_CONFIG_DIR / "cli_paths.sample.json"
CLI_SLOTS_FILE = CLI_CONFIG_DIR / "cli_slots.json"
CLI_SLOTS_SAMPLE_FILE = CLI_CONFIG_DIR / "cli_slots.sample.json"

# [2] 캐릭터 시뮬레이터 코디 · 페르소나 · 스킬 전용 폴더 (config/characters/)
CHAR_CONFIG_DIR = ROOT / "config" / "characters"
CHARACTER_CONFIGS_FILE = CHAR_CONFIG_DIR / "character_configs.json"
CHARACTER_CONFIGS_SAMPLE_FILE = CHAR_CONFIG_DIR / "character_configs.sample.json"

# [3] 아바타 파츠 및 산출물 폴더
PARTS_DIR = ROOT / "avatar" / "data" / "parts"
DELIVERABLES_DIR = ROOT / "deliverables"


def ensure_config_directories() -> None:
    """필요한 설정 폴더를 자동 생성하고, 설정 파일이 없을 경우 .sample.json 샘플 파일에서 자동 초기화합니다."""
    import shutil
    CLI_CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    LOGIN_SCRIPTS_DIR.mkdir(parents=True, exist_ok=True)
    CHAR_CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    DELIVERABLES_DIR.mkdir(parents=True, exist_ok=True)

    for target, sample in (
        (ROLE_SETTINGS_PATH, ROLE_SETTINGS_SAMPLE_PATH),
        (CLI_SLOTS_FILE, CLI_SLOTS_SAMPLE_FILE),
        (CHARACTER_CONFIGS_FILE, CHARACTER_CONFIGS_SAMPLE_FILE),
    ):
        if not target.exists() and sample.exists():
            try:
                shutil.copyfile(sample, target)
            except OSError:
                pass
