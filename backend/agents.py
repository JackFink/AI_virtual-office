"""
AI DEV DIRECTOR 스타일 에이전트 계층 및 페르소나 모듈 (backend/agents.py)
- digilogd-cmd/ai-dev-director/agents/head.py 구조를 기반으로
  가상 오피스의 7대 AI 에이전트 페르소나와 역할(HEAD, BUILDER, SUB-BUILDER, REVIEWER, RESEARCHER, DIRECTOR, TRIAD)을 관리합니다.
"""
from typing import Dict

AGENT_PERSONAS: Dict[str, Dict[str, str]] = {
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
        "desc": "격리 Worktree 코드 작성 및 전체 파일 JSON 제안 구현 엔지니어 (구글 계정 1)",
    },
    "sub_builder": {
        "name": "Gemini Sub AI",
        "role": "SUB-BUILDER",
        "role_Binding": "sub_builder",
        "desc": "두 번째 구글 제미나이 계정(.gemini-acc2)으로 동작하는 독립 보조 구현 및 교차 코딩 에이전트",
    },
    "reviewer": {
        "name": "Reviewer Audit AI",
        "role": "REVIEWER",
        "role_Binding": "reviewer",
        "desc": "read-only 샌드박스 독립 코드 검수 및 P0/P1 결함 감사 에이전트",
    },
    "researcher": {
        "name": "Grok Scout AI",
        "role": "RESEARCHER",
        "role_Binding": "researcher",
        "desc": "xAI Grok 기반 실시간 기술 탐색·심층 추론 및 다각도 가설 검증 에이전트",
    },
    "director": {
        "name": "Scope Guard AI",
        "role": "DIRECTOR",
        "role_Binding": "head",
        "desc": "경로 이탈 차단·파일 변경 상한(15파일/1500줄) 및 테스트 검증 감독관",
    },
    "triad": {
        "name": "Triad Research AI",
        "role": "RESEARCH",
        "role_Binding": "reviewer",
        "desc": "Claude·Codex·Antigravity·Grok 교차 비교 및 아키텍처 리서치 분석가",
    },
}
