# ⚙️ NEXUS AI Virtual Office 설정 폴더 (`config/`) 안내

이 폴더는 **AI CLI 로그인·역할 설정(`config/cli/`)**과 **캐릭터 코디·페르소나·스킬 설정(`config/characters/`)**을 분리하여 관리하는 전용 설정 디렉토리입니다.

---

## 1. 폴더 및 샘플 파일 구성

### 🔑 `config/cli/` (AI CLI 로그인 · 계정 격리 · 역할 배정)
| 실제 사용 파일 | 기본 샘플 파일 | 설명 |
| :--- | :--- | :--- |
| `cli_slots.json` | [`cli_slots.sample.json`](./cli/cli_slots.sample.json) | 등록된 AI CLI 로그인 슬롯 목록. 동일한 AI를 추가로 등록하면 `profile_dir`(`~/.gemini-acc2` 등)이 자동 할당되어 기존 계정과 충돌 없이 격리됩니다. |
| `role_settings.json` | [`role_settings.sample.json`](./cli/role_settings.sample.json) | `head`, `builder`, `sub_builder`, `reviewer`, `researcher` 5대 역할에 배정된 CLI 키 매핑 파일입니다. |
| `cli_paths.json` | [`cli_paths.sample.json`](./cli/cli_paths.sample.json) | CLI 실행 파일(`claude`, `agy`, `gemini`, `codex`, `grok`)의 로컬 절대 경로 설정 파일입니다. |
| `workspace_settings.json` | [`workspace_settings.sample.json`](./cli/workspace_settings.sample.json) | 미션 수행 결과물(프로젝트 폴더 및 `.md` 리포트)이 저장될 사용자 지정 경로(로컬 디스크 또는 Google Drive 마운트 폴더, 기본값은 `deliverables/`), 로컬 동시 백업(`mirror_to_local`), 최근 저장 폴더 이력(`recent_dirs`) 설정 파일입니다. |
| `teams.json` | [`teams.sample.json`](./cli/teams.sample.json) | 사용자 정의 팀 목록(`teams`), 소속 AI 직원(`member_ids`), 가상 오피스 담당 층(`floor`), 팀 전용 역할 배정(`roles`), 팀별 로컬/Google Drive 클라우드 작업 폴더(`workspace`) 매핑 설정 파일입니다. |
| `login_scripts/` | *(자동 생성)* | 웹 UI에서 `[🔑 원클릭 로그인 창 열기]`를 눌렀을 때 생성되는 계정별 격리 로그인 도우미(`.cmd`) 폴더입니다. |

### 🍁 `config/characters/` (캐릭터 시뮬레이터 코디 · 페르소나 · 스킬)
| 실제 사용 파일 | 기본 샘플 파일 | 설명 |
| :--- | :--- | :--- |
| `character_configs.json` | [`character_configs.sample.json`](./characters/character_configs.sample.json) | 각 AI 직원(`01`~`20`)의 KMS v389 파츠 코디(`mapleEquipped`), 동작 모션(`mapleAnim`), 담당 CLI(`cliProvider`), 시스템 프롬프트(`systemPrompt`), 장착 스킬(`skills`) 저장 파일입니다. |

---

## 2. 초기 환경에서 샘플 파일로 초기화하는 방법

서버(`python server.py 8080`) 실행 시 실제 설정 파일이 없으면 `*.sample.json` 또는 기본값을 기반으로 자동 생성됩니다. 직접 초기 상태로 되돌리고 싶을 때는 아래 명령어로 샘플 파일을 복사하면 됩니다:

```powershell
Copy-Item config\cli\cli_slots.sample.json config\cli\cli_slots.json -Force
Copy-Item config\cli\role_settings.sample.json config\cli\role_settings.json -Force
Copy-Item config\characters\character_configs.sample.json config\characters\character_configs.json -Force
```
