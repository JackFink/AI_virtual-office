"""
총괄팀장(LEAD) 및 동적 파트별 담당(PART_*) 역할 정의 · 순서 · 활성화 · CRUD 관리 모듈 (backend/part_roles.py)
- 프로젝트 총괄팀장 1인(LEAD) + 사용자가 자유롭게 추가·이름/지침 수정·순서 변경·활성 토글·삭제할 수 있는 파트 담당 목록을 관리합니다.
- 기본 제공 실무 파트:
  1) PART_RESEARCH  : 자료수집 파트 담당 (원천 자료·수치·위치·평판·출처 URL 수집 및 신뢰도 분류)
  2) PART_STRUCTURE : 기획·구조설계 파트 담당 (수집 데이터 정제, 비교표·JSON 스키마·목차 구조 설계)
  3) PART_BUILD     : 제작·구현 파트 담당 (완성형 보고서 HTML/MD, 웹 UI, 실행 코드 제작 및 기계 검증)
- 기존 고정 Triad 역할명(HEAD, RESEARCHER, SUB-BUILDER, BUILDER, REVIEWER, DIRECTOR, TRIAD)과의 하위 호환 매핑을 지원합니다.
"""
from __future__ import annotations

import json
import os
import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from backend.config_paths import CLI_CONFIG_DIR, PART_ROLES_FILE


def _utc_now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


DEFAULT_LEAD_ROLE: Dict[str, Any] = {
    "id": "LEAD",
    "name": "프로젝트 총괄팀장",
    "stage_label": "업무분장 · 통합보고",
    "icon": "👑",
    "is_lead": True,
    "enabled": True,
    "removable": False,
    "default_cli_role": "head",
    "legacy_aliases": ["HEAD", "LEAD", "DIRECTOR"],
    "instruction": (
        "프로젝트 전체 목표를 분석하여 각 파트 담당에게 명확한 업무 지시서를 배분하고, "
        "파트별 수행 및 파트 담당 간 상호 검증·검토 결과를 취합하여 사용자(최종 승인권자)에게 올릴 통합보고서를 작성합니다."
    ),
}

DEFAULT_PART_ROLES: List[Dict[str, Any]] = [
    {
        "id": "PART_RESEARCH",
        "name": "자료수집 파트 담당",
        "stage_label": "자료수집 · 팩트조사",
        "icon": "🔎",
        "part_kind": "research",
        "is_lead": False,
        "enabled": True,
        "removable": True,
        "default_cli_role": "researcher",
        "legacy_aliases": ["RESEARCHER", "TRIAD", "PART_RESEARCH"],
        "instruction": (
            "사용자의 업무 지시와 관련된 원천 자료·위치·규모·부대시설·평판·근거 출처를 조사하고, "
            "모든 정보를 [확실]/[추정]/[불확실]/[모름] 4단계로 검증·분류하여 후속 파트에 전달합니다."
        ),
    },
    {
        "id": "PART_STRUCTURE",
        "name": "기획·구조설계 파트 담당",
        "stage_label": "데이터정제 · 구조설계",
        "icon": "🗂️",
        "part_kind": "structure",
        "is_lead": False,
        "enabled": True,
        "removable": True,
        "default_cli_role": "sub_builder",
        "legacy_aliases": ["SUB-BUILDER", "SUB_BUILDER", "PART_STRUCTURE"],
        "instruction": (
            "자료수집 파트가 확보한 원천 데이터를 정제·구조화하고, 누락 없는 비교표·섹션 목차·정형 데이터(JSON 스키마) 및 "
            "시각화/코드 아키텍처 설계안을 수립합니다."
        ),
    },
    {
        "id": "PART_BUILD",
        "name": "제작·구현 파트 담당",
        "stage_label": "산출물 제작 · 구현",
        "icon": "🛠️",
        "part_kind": "build",
        "is_lead": False,
        "enabled": True,
        "removable": True,
        "default_cli_role": "builder",
        "legacy_aliases": ["BUILDER", "REVIEWER", "PART_BUILD"],
        "instruction": (
            "선행 파트들의 수집 데이터와 구조 설계안을 빠짐없이 반영하여 완성도 높은 최종 산출물 파일"
            "(HTML 보고서, 마크다운 문서, 웹 UI, 실행 가능한 소스 코드 등)을 실제 파일로 제작합니다."
        ),
    },
]

LEGACY_ROLE_TO_CANONICAL: Dict[str, str] = {
    "HEAD": "LEAD",
    "LEAD": "LEAD",
    "DIRECTOR": "LEAD",
    "RESEARCHER": "PART_RESEARCH",
    "TRIAD": "PART_RESEARCH",
    "RESEARCH": "PART_RESEARCH",
    "PART_RESEARCH": "PART_RESEARCH",
    "SUB-BUILDER": "PART_STRUCTURE",
    "SUB_BUILDER": "PART_STRUCTURE",
    "PART_STRUCTURE": "PART_STRUCTURE",
    "BUILDER": "PART_BUILD",
    "REVIEWER": "PART_BUILD",
    "PART_BUILD": "PART_BUILD",
}


def _normalize_part_item(raw: Dict[str, Any], idx: int = 1) -> Dict[str, Any]:
    rid = str(raw.get("id") or f"PART_CUSTOM_{idx}").strip().upper()
    rid = re.sub(r"[^A-Z0-9_-]", "_", rid)
    if not rid or rid == "LEAD":
        rid = f"PART_CUSTOM_{idx}"
    name = str(raw.get("name") or f"커스텀 파트 #{idx} 담당").strip()[:50]
    stage_lbl = str(raw.get("stage_label") or name.replace(" 담당", "")).strip()[:40]
    icon = str(raw.get("icon") or "🧩").strip()[:6] or "🧩"
    p_kind = str(raw.get("part_kind") or "custom").strip().lower()
    if p_kind not in ("research", "structure", "build", "custom"):
        p_kind = "custom"
    cli_r = str(raw.get("default_cli_role") or "builder").strip().lower()
    if cli_r not in ("head", "builder", "sub_builder", "reviewer", "researcher"):
        cli_r = "builder"
    aliases_raw = raw.get("legacy_aliases")
    aliases = [str(a).strip().upper() for a in aliases_raw if str(a).strip()] if isinstance(aliases_raw, list) else [rid]
    if rid not in aliases:
        aliases.append(rid)
    inst = str(
        raw.get("instruction")
        or f"'{name}' 역할을 맡아 앞선 파트의 작업 결과를 바탕으로 담당 파트 결과물을 작성하고 정확성을 검증합니다."
    ).strip()[:600]
    return {
        "id": rid,
        "name": name,
        "stage_label": stage_lbl,
        "icon": icon,
        "part_kind": p_kind,
        "is_lead": False,
        "enabled": bool(raw.get("enabled", True)),
        "removable": bool(raw.get("removable", True)),
        "default_cli_role": cli_r,
        "legacy_aliases": aliases,
        "instruction": inst,
    }


def _normalize_lead_item(raw: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    base = dict(DEFAULT_LEAD_ROLE)
    if isinstance(raw, dict):
        if str(raw.get("name") or "").strip():
            base["name"] = str(raw["name"]).strip()[:50]
        if str(raw.get("stage_label") or "").strip():
            base["stage_label"] = str(raw["stage_label"]).strip()[:40]
        if str(raw.get("icon") or "").strip():
            base["icon"] = str(raw["icon"]).strip()[:6]
        if str(raw.get("instruction") or "").strip():
            base["instruction"] = str(raw["instruction"]).strip()[:600]
    base["id"] = "LEAD"
    base["is_lead"] = True
    base["enabled"] = True
    base["removable"] = False
    return base


def load_part_roles_config() -> Dict[str, Any]:
    if PART_ROLES_FILE.exists():
        try:
            raw = json.loads(PART_ROLES_FILE.read_text(encoding="utf-8"))
            if isinstance(raw, dict) and isinstance(raw.get("parts"), list) and len(raw["parts"]) >= 1:
                lead = _normalize_lead_item(raw.get("lead"))
                parts: List[Dict[str, Any]] = []
                seen_ids = {"LEAD"}
                for idx, item in enumerate(raw["parts"]):
                    if not isinstance(item, dict):
                        continue
                    norm = _normalize_part_item(item, idx + 1)
                    if norm["id"] in seen_ids:
                        continue
                    seen_ids.add(norm["id"])
                    parts.append(norm)
                if parts:
                    if not any(p["enabled"] for p in parts):
                        parts[-1]["enabled"] = True
                    raw_sm = str(raw.get("staff_execution_mode") or "parallel").strip().lower()
                    doc = {
                        "lead": lead,
                        "parts": parts,
                        "staff_execution_mode": "sequential" if raw_sm == "sequential" else "parallel",
                        "require_user_approval": bool(raw.get("require_user_approval", True)),
                        "updated_at": str(raw.get("updated_at") or _utc_now()),
                    }
                    doc["assignable_roles"] = build_assignable_roles(doc)
                    doc["pipeline_stages"] = build_pipeline_stage_descriptors(doc)
                    return doc
        except Exception:
            pass

    default_doc = {
        "lead": _normalize_lead_item(DEFAULT_LEAD_ROLE),
        "parts": [_normalize_part_item(p, i + 1) for i, p in enumerate(DEFAULT_PART_ROLES)],
        "staff_execution_mode": "parallel",
        "require_user_approval": True,
        "updated_at": _utc_now(),
    }
    return save_part_roles_config(default_doc)


def save_part_roles_config(doc: Dict[str, Any]) -> Dict[str, Any]:
    lead = _normalize_lead_item((doc or {}).get("lead"))
    raw_parts = (doc or {}).get("parts") or []
    parts: List[Dict[str, Any]] = []
    seen = {"LEAD"}
    for idx, p in enumerate(raw_parts):
        if not isinstance(p, dict):
            continue
        norm = _normalize_part_item(p, idx + 1)
        if norm["id"] in seen:
            continue
        seen.add(norm["id"])
        parts.append(norm)
    if not parts:
        parts = [_normalize_part_item(p, i + 1) for i, p in enumerate(DEFAULT_PART_ROLES)]
    if not any(p["enabled"] for p in parts):
        parts[-1]["enabled"] = True

    raw_sm = str((doc or {}).get("staff_execution_mode") or "parallel").strip().lower()
    persisted = {
        "lead": lead,
        "parts": parts,
        "staff_execution_mode": "sequential" if raw_sm == "sequential" else "parallel",
        "require_user_approval": bool((doc or {}).get("require_user_approval", True)),
        "updated_at": _utc_now(),
    }
    CLI_CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    tmp = PART_ROLES_FILE.with_suffix(".tmp")
    tmp.write_text(json.dumps(persisted, ensure_ascii=False, indent=2), encoding="utf-8")
    os.replace(tmp, PART_ROLES_FILE)

    out = dict(persisted)
    out["assignable_roles"] = build_assignable_roles(persisted)
    out["pipeline_stages"] = build_pipeline_stage_descriptors(persisted)
    return out


def build_assignable_roles(doc: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
    cfg = doc or load_part_roles_config()
    lead = cfg["lead"]
    roles = [
        {
            "id": lead["id"],
            "name": lead["name"],
            "icon": lead["icon"],
            "stage_label": lead["stage_label"],
            "is_lead": True,
            "enabled": True,
            "default_cli_role": lead.get("default_cli_role", "head"),
            "instruction": lead.get("instruction", ""),
        }
    ]
    for p in cfg.get("parts") or []:
        roles.append(
            {
                "id": p["id"],
                "name": p["name"],
                "icon": p["icon"],
                "stage_label": p["stage_label"],
                "part_kind": p.get("part_kind", "custom"),
                "is_lead": False,
                "enabled": bool(p.get("enabled", True)),
                "default_cli_role": p.get("default_cli_role", "builder"),
                "instruction": p.get("instruction", ""),
            }
        )
    return roles


def build_pipeline_stage_descriptors(doc: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
    cfg = doc or load_part_roles_config()
    lead = cfg["lead"]
    enabled_parts = [p for p in (cfg.get("parts") or []) if p.get("enabled", True)]
    stages: List[Dict[str, Any]] = [
        {
            "stage": "LEAD_PLANNING",
            "index": 1,
            "title": "총괄팀장 분장",
            "role_id": "LEAD",
            "role_name": lead["name"],
            "icon": lead["icon"],
        }
    ]
    idx = 2
    for p in enabled_parts:
        stages.append(
            {
                "stage": p["id"],
                "index": idx,
                "title": p["stage_label"],
                "role_id": p["id"],
                "role_name": p["name"],
                "icon": p["icon"],
            }
        )
        idx += 1
    stages.append(
        {
            "stage": "PART_REVIEW",
            "index": idx,
            "title": "파트 상호검증·검토",
            "role_id": "PART_REVIEW",
            "role_name": "파트 담당 상호검토",
            "icon": "🤝",
        }
    )
    stages.append(
        {
            "stage": "LEAD_REPORT",
            "index": idx + 1,
            "title": "총괄팀장 통합보고",
            "role_id": "LEAD",
            "role_name": lead["name"],
            "icon": "📋",
        }
    )
    stages.append(
        {
            "stage": "AWAITING_APPROVAL",
            "index": idx + 2,
            "title": "내 최종 승인",
            "role_id": "USER",
            "role_name": "사용자(최종결재)",
            "icon": "✅",
        }
    )
    return stages


def resolve_canonical_part_role(raw_role: str, cfg: Optional[Dict[str, Any]] = None) -> str:
    cleaned = str(raw_role or "").strip().upper()
    if not cleaned:
        return "PART_BUILD"
    doc = cfg or load_part_roles_config()
    valid_ids = {"LEAD"} | {p["id"] for p in (doc.get("parts") or [])}
    if cleaned in valid_ids:
        return cleaned
    mapped = LEGACY_ROLE_TO_CANONICAL.get(cleaned)
    if mapped and mapped in valid_ids:
        return mapped
    for p in doc.get("parts") or []:
        if cleaned in (p.get("legacy_aliases") or []):
            return p["id"]
    return cleaned


def add_part_role(
    name: str,
    stage_label: str = "",
    icon: str = "🧩",
    instruction: str = "",
    default_cli_role: str = "builder",
    insert_before_build: bool = True,
) -> Dict[str, Any]:
    clean_name = str(name or "").strip()
    if not clean_name:
        raise ValueError("추가할 파트 담당 이름을 입력해 주세요.")
    cfg = load_part_roles_config()
    parts = list(cfg.get("parts") or [])
    existing_ids = {"LEAD"} | {p["id"] for p in parts}
    slug = re.sub(r"[^A-Z0-9]+", "_", clean_name.upper()).strip("_")
    base_id = f"PART_{slug}" if slug else f"PART_CUSTOM_{len(parts) + 1}"
    cand_id = base_id
    seq = 2
    while cand_id in existing_ids:
        cand_id = f"{base_id}_{seq}"
        seq += 1

    new_item = _normalize_part_item(
        {
            "id": cand_id,
            "name": clean_name if "담당" in clean_name or "파트" in clean_name else f"{clean_name} 파트 담당",
            "stage_label": stage_label.strip() or clean_name,
            "icon": icon or "🧩",
            "part_kind": "custom",
            "enabled": True,
            "removable": True,
            "default_cli_role": default_cli_role,
            "instruction": instruction.strip()
            or f"'{clean_name}' 전문 파트 담당으로서 선행 파트의 조사·설계 자료를 검토·보강하고 담당 파트의 핵심 결과물을 작성합니다.",
        },
        len(parts) + 1,
    )
    if insert_before_build and any(p.get("part_kind") == "build" for p in parts):
        build_idx = next(i for i, p in enumerate(parts) if p.get("part_kind") == "build")
        parts.insert(build_idx, new_item)
    else:
        parts.append(new_item)
    cfg["parts"] = parts
    saved = save_part_roles_config(cfg)
    saved["added_part"] = new_item
    return saved


def update_part_role(role_id: str, updates: Dict[str, Any]) -> Dict[str, Any]:
    rid = str(role_id or "").strip().upper()
    cfg = load_part_roles_config()
    if rid == "LEAD":
        lead = dict(cfg["lead"])
        for k in ("name", "stage_label", "icon", "instruction"):
            if k in updates and updates[k] is not None and str(updates[k]).strip():
                lead[k] = str(updates[k]).strip()
        cfg["lead"] = lead
        return save_part_roles_config(cfg)

    parts = list(cfg.get("parts") or [])
    matched = False
    for idx, p in enumerate(parts):
        if p["id"] == rid:
            merged = dict(p)
            for k in ("name", "stage_label", "icon", "instruction", "default_cli_role"):
                if k in updates and updates[k] is not None and str(updates[k]).strip():
                    merged[k] = str(updates[k]).strip()
            if "enabled" in updates and updates["enabled"] is not None:
                merged["enabled"] = bool(updates["enabled"])
            parts[idx] = _normalize_part_item(merged, idx + 1)
            matched = True
            break
    if not matched:
        raise ValueError(f"존재하지 않는 파트 역할 ID입니다: {rid}")
    if not any(p.get("enabled") for p in parts):
        raise ValueError("최소 1개 이상의 실무 파트는 활성화(ON) 상태여야 합니다.")
    cfg["parts"] = parts
    return save_part_roles_config(cfg)


def delete_part_role(role_id: str) -> Dict[str, Any]:
    rid = str(role_id or "").strip().upper()
    if rid == "LEAD":
        raise ValueError("프로젝트 총괄팀장(LEAD) 역할은 삭제할 수 없습니다 (이름·지침 수정은 가능합니다).")
    cfg = load_part_roles_config()
    parts = list(cfg.get("parts") or [])
    if len(parts) <= 1:
        raise ValueError("최소 1개 이상의 실무 파트 담당은 유지되어야 합니다.")
    next_parts = [p for p in parts if p["id"] != rid]
    if len(next_parts) == len(parts):
        raise ValueError(f"존재하지 않는 파트 역할입니다: {rid}")
    if not any(p.get("enabled") for p in next_parts):
        next_parts[-1]["enabled"] = True
    cfg["parts"] = next_parts
    return save_part_roles_config(cfg)


def reorder_part_role(role_id: str, direction: str) -> Dict[str, Any]:
    rid = str(role_id or "").strip().upper()
    cfg = load_part_roles_config()
    parts = list(cfg.get("parts") or [])
    idx = next((i for i, p in enumerate(parts) if p["id"] == rid), -1)
    if idx < 0:
        raise ValueError(f"존재하지 않는 파트 역할입니다: {rid}")
    if direction == "up" and idx > 0:
        parts[idx - 1], parts[idx] = parts[idx], parts[idx - 1]
    elif direction == "down" and idx < len(parts) - 1:
        parts[idx + 1], parts[idx] = parts[idx], parts[idx + 1]
    cfg["parts"] = parts
    return save_part_roles_config(cfg)


def reset_part_roles() -> Dict[str, Any]:
    default_doc = {
        "lead": _normalize_lead_item(DEFAULT_LEAD_ROLE),
        "parts": [_normalize_part_item(p, i + 1) for i, p in enumerate(DEFAULT_PART_ROLES)],
        "staff_execution_mode": "parallel",
        "require_user_approval": True,
        "updated_at": _utc_now(),
    }
    return save_part_roles_config(default_doc)


def set_staff_execution_mode(mode: str) -> Dict[str, Any]:
    cfg = load_part_roles_config()
    cfg["staff_execution_mode"] = "sequential" if str(mode or "").strip().lower() == "sequential" else "parallel"
    return save_part_roles_config(cfg)


# ---------------------------------------------------------------------------
# 10인 Antigravity SDK 고정 · 세부 모델 차별화 표준 편제 (총괄 1 + 3개 파트 × [파트장 1 + 사원 2])
# 모든 cliModel은 연결 계정에서 잠금 해제(locked=False) 검증된 실제 실행 가능 모델로 구성
# ---------------------------------------------------------------------------
DEFAULT_SDK_SQUAD_10: List[Dict[str, Any]] = [
    {
        "id": "01",
        "name": "총괄팀장 AI",
        "floor": "1F",
        "triadRole": "LEAD",
        "orgRank": "LEAD",
        "staffOrder": 0,
        "cliProvider": "antigravity_sdk",
        "cliModel": "claude-opus-5-5-high",
        "sandboxMode": "read-only",
        "timeoutSec": "auto",
        "skills": ["프로젝트 업무분장", "파트 통합조율", "최종 결재 통합보고"],
        "systemPrompt": (
            "당신은 프로젝트를 총괄 지휘하는 '총괄팀장 AI'(LEAD)입니다. "
            "사용자의 목표를 분석해 각 파트장에게 명확히 업무를 분장하고, 전 파트 수행 및 상호검토 결과를 취합해 사용자 결재용 통합보고서를 작성합니다."
        ),
        "defaultMaple": {"skin": 2000, "hair": 30061, "face": 20000, "top": 1040119, "bottom": 1060076, "shoes": 1072000},
    },
    {
        "id": "02",
        "name": "자료수집 파트장 AI",
        "floor": "1F",
        "triadRole": "PART_RESEARCH",
        "orgRank": "PART_LEAD",
        "staffOrder": 0,
        "cliProvider": "antigravity_sdk",
        "cliModel": "gemini-4-argon-high",
        "sandboxMode": "read-only",
        "timeoutSec": "auto",
        "skills": ["팩트 최종검증", "사원 조사본 취합", "파트 상호 교차검토"],
        "systemPrompt": (
            "당신은 '자료수집 파트장 AI'(PART_LEAD)입니다. 소속 일반 사원 2명이 수집·교차검증한 자료를 취합·검증하여 "
            "[확실]/[추정]/[불확실]/[모름] 등급과 출처가 정리된 파트 공식 조사 결과를 확정하고 타 파트 산출물을 상호 검토합니다."
        ),
        "defaultMaple": {"skin": 2000, "hair": 30005, "face": 20001, "overall": 1050004, "shoes": 1070004, "hat": 1000004},
    },
    {
        "id": "03",
        "name": "자료수집 사원 1 (광역탐색)",
        "floor": "1F",
        "triadRole": "PART_RESEARCH",
        "orgRank": "STAFF",
        "staffOrder": 1,
        "cliProvider": "antigravity_sdk",
        "cliModel": "gemini-3.8-flash-high",
        "sandboxMode": "read-only",
        "timeoutSec": "auto",
        "skills": ["광역 팩트 수집", "공식 출처 탐색", "기초 현황 조사"],
        "systemPrompt": (
            "당신은 자료수집 파트의 일반 사원 '자료수집 사원 1 (광역탐색)'입니다. "
            "빠른 탐색으로 업무 지시와 관련된 핵심 팩트·위치·규모·현황·공식 출처를 폭넓게 1차 조사해 파트장에게 보고합니다."
        ),
        "defaultMaple": {"skin": 2000, "hair": 30047, "face": 20002, "overall": 1050000, "shoes": 1070001},
    },
    {
        "id": "04",
        "name": "자료수집 사원 2 (교차검증)",
        "floor": "1F",
        "triadRole": "PART_RESEARCH",
        "orgRank": "STAFF",
        "staffOrder": 2,
        "cliProvider": "antigravity_sdk",
        "cliModel": "gpt-oss-120b-medium",
        "sandboxMode": "read-only",
        "timeoutSec": "auto",
        "skills": ["누락 항목 발굴", "수치 교차 대조", "엣지케이스 점검"],
        "systemPrompt": (
            "당신은 자료수집 파트의 일반 사원 '자료수집 사원 2 (교차검증)'입니다. "
            "이기종 모델 시각에서 사원 1의 1차 조사 내용 중 누락된 비교 기준·수치 오류 가능성·예외 조건을 보완해 파트장에게 보고합니다."
        ),
        "defaultMaple": {"skin": 2000, "hair": 30030, "face": 20000, "overall": 1050003, "shoes": 1070005},
    },
    {
        "id": "05",
        "name": "기획·구조 파트장 AI",
        "floor": "2F",
        "triadRole": "PART_STRUCTURE",
        "orgRank": "PART_LEAD",
        "staffOrder": 0,
        "cliProvider": "antigravity_sdk",
        "cliModel": "gemini-4-hydrogen-xhigh",
        "sandboxMode": "read-only",
        "timeoutSec": "auto",
        "skills": ["아키텍처 확정", "데이터 스키마 통합", "설계 정합성 검증"],
        "systemPrompt": (
            "당신은 '기획·구조 파트장 AI'(PART_LEAD)입니다. 소속 일반 사원 2명이 작성한 정형 데이터 스키마와 문서/화면 목차 초안을 "
            "고밀도 추론으로 통합·검증하여 제작 파트가 즉시 구현할 수 있는 최종 구조 설계서를 확정합니다."
        ),
        "defaultMaple": {"skin": 2000, "hair": 30004, "face": 20001, "overall": 1050005, "shoes": 1070003, "hat": 1000005},
    },
    {
        "id": "06",
        "name": "기획·구조 사원 1 (데이터정제)",
        "floor": "2F",
        "triadRole": "PART_STRUCTURE",
        "orgRank": "STAFF",
        "staffOrder": 1,
        "cliProvider": "antigravity_sdk",
        "cliModel": "gemini-3.8-flash-medium",
        "sandboxMode": "read-only",
        "timeoutSec": "auto",
        "skills": ["JSON 스키마 설계", "비교표 정규화", "핵심 필드 추출"],
        "systemPrompt": (
            "당신은 기획·구조설계 파트의 일반 사원 '기획·구조 사원 1 (데이터정제)'입니다. "
            "자료수집 파트의 결과물에서 정형 JSON 데이터 필드와 비교표 컬럼 구조를 빠르고 일관되게 정제해 파트장에게 보고합니다."
        ),
        "defaultMaple": {"skin": 2000, "hair": 30005, "face": 20000, "overall": 1050005, "shoes": 1070005, "hat": 1000005},
    },
    {
        "id": "07",
        "name": "기획·구조 사원 2 (목차·UX설계)",
        "floor": "2F",
        "triadRole": "PART_STRUCTURE",
        "orgRank": "STAFF",
        "staffOrder": 2,
        "cliProvider": "antigravity_sdk",
        "cliModel": "claude-sonnet-5-5-medium",
        "sandboxMode": "read-only",
        "timeoutSec": "auto",
        "skills": ["섹션 목차 구성", "시각화/UX 흐름", "컴포넌트 모듈 분할"],
        "systemPrompt": (
            "당신은 기획·구조설계 파트의 일반 사원 '기획·구조 사원 2 (목차·UX설계)'입니다. "
            "사원 1의 정제 데이터를 바탕으로 가독성 높은 문서 섹션 구성·화면 레이아웃·코드 모듈 분할 구조를 설계해 파트장에게 보고합니다."
        ),
        "defaultMaple": {"skin": 2000, "hair": 30001, "face": 20002, "overall": 1050001, "shoes": 1070001, "hat": 1000001},
    },
    {
        "id": "08",
        "name": "제작·구현 파트장 AI",
        "floor": "2F",
        "triadRole": "PART_BUILD",
        "orgRank": "PART_LEAD",
        "staffOrder": 0,
        "cliProvider": "antigravity_sdk",
        "cliModel": "claude-sonnet-5-5-high",
        "sandboxMode": "proposal",
        "timeoutSec": "auto",
        "skills": ["최종 산출물 통합구현", "완성형 HTML/코드 작성", "파트 자체 기계검증"],
        "systemPrompt": (
            "당신은 '제작·구현 파트장 AI'(PART_LEAD)입니다. 선행 파트 설계안과 소속 사원 2명의 핵심 로직·품질 마감안을 통합하여 "
            "즉시 실행·열람 가능한 고완성도 최종 산출물 파일을 실제 생성하고 자체 기계·구조 검증을 책임집니다."
        ),
        "defaultMaple": {"skin": 2000, "hair": 30002, "face": 20003, "overall": 1050002, "shoes": 1070002, "hat": 1000002},
    },
    {
        "id": "09",
        "name": "제작·구현 사원 1 (핵심구현)",
        "floor": "2F",
        "triadRole": "PART_BUILD",
        "orgRank": "STAFF",
        "staffOrder": 1,
        "cliProvider": "antigravity_sdk",
        "cliModel": "gemini-4-hydrogen-high",
        "sandboxMode": "proposal",
        "timeoutSec": "auto",
        "skills": ["핵심 로직 코딩", "데이터 바인딩", "본문 섹션 초안"],
        "systemPrompt": (
            "당신은 제작·구현 파트의 일반 사원 '제작·구현 사원 1 (핵심구현)'입니다. "
            "확정된 구조 설계서에 맞춰 핵심 실행 로직·알고리즘·본문 데이터 바인딩 구성을 구체적으로 작성해 파트장에게 전달합니다."
        ),
        "defaultMaple": {"skin": 2000, "hair": 30003, "face": 20004, "overall": 1050003, "shoes": 1070003, "hat": 1000003},
    },
    {
        "id": "10",
        "name": "제작·구현 사원 2 (품질·마감)",
        "floor": "2F",
        "triadRole": "PART_BUILD",
        "orgRank": "STAFF",
        "staffOrder": 2,
        "cliProvider": "antigravity_sdk",
        "cliModel": "gemini-4-argon-medium",
        "sandboxMode": "proposal",
        "timeoutSec": "auto",
        "skills": ["UI 스타일 마감", "예외처리·경계값 점검", "출력 포맷 검증"],
        "systemPrompt": (
            "당신은 제작·구현 파트의 일반 사원 '제작·구현 사원 2 (품질·마감)'입니다. "
            "사원 1의 구현 초안을 검토해 누락된 예외 처리, UI/출력 포맷 품질, 경계 조건 보강 사항을 파트장에게 제안합니다."
        ),
        "defaultMaple": {"skin": 2000, "hair": 30004, "face": 20000, "overall": 1050004, "shoes": 1070004, "hat": 1000004},
    },
]

RECOMMENDED_SDK_STAFF_MODELS: List[str] = [
    "gemini-3.8-flash-high",
    "gpt-oss-120b-medium",
    "claude-sonnet-5-5-medium",
    "gemini-4-hydrogen-high",
    "gemini-4-argon-medium",
    "gemini-3.8-flash-medium",
    "gemini-4-hydrogen-medium",
]


def build_sdk_squad_character_configs(existing_configs: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Builds 10-employee Antigravity SDK squad (#01~#10) while preserving any existing user-customized mapleEquipped avatars."""
    merged = dict(existing_configs or {})
    now_iso = _utc_now()
    for spec in DEFAULT_SDK_SQUAD_10:
        cid = spec["id"]
        prev = merged.get(cid) if isinstance(merged.get(cid), dict) else {}
        prev_eq = prev.get("mapleEquipped")
        maple_eq = (
            dict(prev_eq)
            if isinstance(prev_eq, dict) and len(prev_eq) > 0
            else dict(spec["defaultMaple"])
        )
        merged[cid] = {
            **prev,
            "id": cid,
            "name": spec["name"],
            "floor": spec["floor"],
            "dept": f"{spec['triadRole']} ({spec['orgRank']}) · Antigravity SDK ({spec['cliModel']})",
            "triadRole": spec["triadRole"],
            "orgRank": spec["orgRank"],
            "staffOrder": spec["staffOrder"],
            "cliProvider": spec["cliProvider"],
            "cliModel": spec["cliModel"],
            "sandboxMode": spec["sandboxMode"],
            "timeoutSec": spec["timeoutSec"],
            "mapleEquipped": maple_eq,
            "mapleAnim": prev.get("mapleAnim") or "stand1",
            "mapleAnimated": bool(prev.get("mapleAnimated", False)),
            "mapleFlipped": bool(prev.get("mapleFlipped", False)),
            "skills": list(spec["skills"]),
            "systemPrompt": spec["systemPrompt"],
            "updatedAt": now_iso,
        }
    return merged
