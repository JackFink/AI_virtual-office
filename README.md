# VINCO AI Virtual Office × AI DEV DIRECTOR

한국어 AI 가상 오피스 UI(`index.html`, `office.html`, `agents.html`)를 그대로 유지하면서, 참조 저장소([digilogd-cmd/ai-dev-director](https://github.com/digilogd-cmd/ai-dev-director))의 **다중 AI 코딩 CLI(Claude Code, OpenAI Codex, Google Antigravity) 오케스트레이터**와 **Triad 역할 분담 체계(`HEAD` / `BUILDER` / `REVIEWER` + `DIRECTOR` Scope Guard)**를 연결·반영한 프로젝트입니다.

---

## 1. 다중 AI CLI 및 역할 분담 체계 (Triad System)

세 개의 구독형 AI 코딩 CLI가 서로 다른 역할을 맡아 한 회사처럼 협력하며, 모든 CLI 호출 시 종량제 API 키(`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `GOOGLE_API_KEY` 등)를 환경변수에서 자동 제거(`get_sanitized_env`)하여 구독 로그인 세션으로만 동작합니다.

| 역할 (Role) | 기본 담당 CLI | 핵심 책임 및 파이프라인 단계 |
|---|---|---|
| **HEAD · 총괄 지휘** | **Claude Code** (`claude`) | 한 줄 목표(Goal) 분석, 허용 경로·파일 수·Diff 상한이 명시된 작업 지시서(`ORDER`) 수립(`01 PLANNING`), 최종 `PASS / FAIL / 수정` 판정(`05 DECIDING`) |
| **BUILDER · 구현 코딩** | **Google Antigravity** (`agy`) | 격리 작업본(Git Worktree)에서 전체 파일을 JSON 형태로 제안 및 구현(`02 BUILDING`) |
| **DIRECTOR · 안전 검증** | **Director Core** (내장) | `Scope Guard` 경로/파일/Diff 상한 검사 및 격리 Worktree 테스트 실행(`03 VERIFYING`), 무응답 프로세스 트리 강제 종료 |
| **REVIEWER · 독립 검수** | **OpenAI Codex** (`codex`) | Read-only 샌드박스에서 `ORDER`, `git diff`, 테스트 결과를 독립 대조하여 Fail-Closed 검수(`04 REVIEWING`) |

> 대시보드(`index.html`), 3D 오피스(`office.html`), 직원 관리(`agents.html`) 어디서든 **HEAD / BUILDER / REVIEWER** 담당 CLI를 실시간으로 맞바꿀 수 있으며, 세 역할에는 항상 서로 다른 AI가 배정됩니다.

---

## 2. 페이지 구성 (기존 버추얼 오피스 UI 유지)

- **`index.html` (Overview · Triad 대시보드)**
  - `HEAD / BUILDER / REVIEWER` 실시간 역할 배정 카드 및 CLI 스왑 드롭다운
  - 한 줄 목표(Goal) 지시 입력창 및 5단계 파이프라인(`01 PLANNING → 02 BUILDING → 03 VERIFYING → 04 REVIEWING → 05 DECIDING`) 실시간 진행 표시
  - `■ 작업 정지` 버튼, 실시간 파이프라인 이벤트 로그, Triad 핵심 에이전트 현황 테이블 및 CLI 호출/토큰 통계
- **`office.html` (Three.js 3D 가상 오피스)**
  - 약 100평(330m²) 사무실 평면을 기반으로 한 3D 오피스와 층 추가/전환 UI
  - 1층 Triad 코어 워크스테이션에 `HEAD Director AI`, `Builder Dev AI`, `Reviewer Audit AI`, `Scope Guard AI`, `Triad Research AI` 2등신 치비 3D 캐릭터 배치
  - 캐릭터 클릭 시 우측 패널에서 담당 CLI 확인 및 즉시 역할 교체 가능
- **`agents.html` (AI 직원 & 역할 체계 관리 + 모듈형 캐릭터 스튜디오)**
  - 역할별(`HEAD`, `BUILDER`, `REVIEWER`, `DIRECTOR`) 및 상태별 필터칩과 실시간 검색
  - 20종 에이전트 프리셋과 `maples.im` 스타일 모듈형 픽셀/치비 캐릭터 커스터마이저(파츠 교체, 염색, 스탠스, PNG/JSON 내보내기)

---

## 3. 실행 방법

### 3.1 로컬 오케스트레이터 통합 서버 실행 (권장)

`server.py`는 정적 UI 서빙과 함께 `/ops/roles`, `/ops/activity`, `/status`, `/ops/cli-check`, `/chat`, `/ops/missions/stop` API를 제공하며, 로컬에 `ai-dev-director`의 `companion_server.py`(`127.0.0.1:8081`)가 실행 중일 경우 자동으로 상태를 브리지합니다.

```bash
python server.py 8080
```

브라우저에서 `http://127.0.0.1:8080`으로 접속하세요.

### 3.2 정적 서버 단독 실행 (프런트엔드 폴백 지원)

```bash
python -m http.server 8080
```

백엔드 API 없이 정적 서버로 열어도 브라우저 `localStorage`와 내장 파이프라인 시뮬레이터로 역할 교체 및 미션 실행 흐름을 확인할 수 있습니다.

---

## 4. 참조 링크

- **GitHub (AI Dev Director)**: [digilogd-cmd/ai-dev-director](https://github.com/digilogd-cmd/ai-dev-director) — 다중 AI 코딩 CLI(Claude Code, OpenAI Codex, Google Antigravity) 기반 로컬 개발 감독관 프로젝트
- **MapleStory.io (KMS v389 캐릭터 & 파츠 이미지/API)**: [https://maplestory.io](https://maplestory.io) ([API 문서](https://maplestory.io/api)) — 가상 오피스 AI 직원 캐릭터 전신 스프라이트 및 캐릭터 시뮬레이터 파츠(`character-images/` 내 헤어·성형·의상·신발·악세사리·가구·펫·장식 PNG 에셋) 원본 데이터 및 렌더링 참조
