(() => {
  const page = document.body.dataset.page;

  // ==========================================================================
  // [1] KMS v389 PNG 캐릭터 렌더링 엔진 (레거시 SVG 코드 제거 및 PNG 전용 경량화)
  // ==========================================================================
  const CharacterEngine = {
    parts: {},

    render(agent, options = {}) {
      const eq = (agent && agent.mapleEquipped && Object.keys(agent.mapleEquipped).length > 0)
        ? agent.mapleEquipped
        : { skin: 2000, hair: 30000, face: 20000, top: 1040036, bottom: 1060026, shoes: 1072001 };
      const skinId = eq.skin || 2000;
      const anim = options.stance || (agent && agent.mapleAnim) || 'stand1';
      const isAnimated = Boolean(options.animated !== undefined ? options.animated : (agent && agent.mapleAnimated));
      const isFlip = Boolean(options.flipped !== undefined ? options.flipped : (agent && agent.mapleFlipped));
      const visualSlots = [
        'hair', 'face', 'overall', 'top', 'bottom', 'shoes',
        'hat', 'faceAccessory', 'eyeDecoration', 'earrings', 'cape', 'glove',
        'furniture', 'ring', 'decoration', 'petEquip'
      ];
      const itemIds = [];
      visualSlots.forEach(s => {
        if (s === 'furniture' && anim !== 'sit') return;
        if (eq[s]) itemIds.push(eq[s]);
      });
      const itemsParam = itemIds.join(',');
      const safeItems = itemIds.length > 0 ? itemIds.join('_') : 'none';
      const ext = isAnimated ? 'gif' : 'png';
      const localCharSrc = `character-images/images/characters/${skinId}_${safeItems}_${anim}.${ext}`;
      const serverSyncSrc = `/ops/maple-avatar?skin=${skinId}&items=${itemsParam}&anim=${anim}&animated=${isAnimated ? 1 : 0}`;
      const flipStyle = isFlip ? 'transform:scaleX(-1);' : '';
      return `
        <div class="kms389-avatar-wrap" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;position:relative">
          <img src="${localCharSrc}" alt="${(agent && agent.name) || 'Avatar'}" onerror="if(!this.dataset.fb){this.dataset.fb='1';this.src='${serverSyncSrc}';}else if(this.dataset.fb==='1'){this.dataset.fb='2';this.src='character-images/0.png';}" style="max-width:100%;max-height:100%;object-fit:contain;image-rendering:pixelated;filter:drop-shadow(0 3px 6px rgba(15,23,42,0.18));${flipStyle}" />
        </div>
      `.trim();
    }
  };

  // ==========================================================================
  // [2] 에이전트 프리셋 (초기 활성 캐릭터는 5명으로 설정 · 필요 시 최대 20종까지 추가 가능)
  // ==========================================================================
  const ALL_AGENT_PRESETS = [
    { id: '01', name: 'HEAD Director AI', triadRole: 'HEAD', floor: '1F', dept: 'HEAD · 총괄 지휘 (Claude Code)', gender: '픽셀 치비', skin: '#f8cfbe', hairColor: '#1e1e24', eyeColor: '#1e293b', parts: { base: 'BASE_PIXEL', hair: 'H02', face: 'F07', outfit: 'O01', bottom: 'B01', acc: 'A03' } },
    { id: '02', name: 'Grok Scout AI', triadRole: 'RESEARCHER', floor: '1F', dept: 'RESEARCHER · 심층 추론 (xAI Grok)', gender: '픽셀 치비', skin: '#ebb99a', hairColor: '#4a3525', eyeColor: '#2563eb', parts: { base: 'BASE_PIXEL', hair: 'H04', face: 'F02', outfit: 'O01', bottom: 'B01', acc: 'A01' } },
    { id: '03', name: 'Builder Dev AI', triadRole: 'BUILDER', floor: '1F', dept: 'BUILDER · 구현 (Antigravity · 계정1)', gender: '픽셀 치비', skin: '#f8cfbe', hairColor: '#4a3525', eyeColor: '#2563eb', parts: { base: 'BASE_PIXEL', hair: 'H03', face: 'F02', outfit: 'O02', bottom: 'B02', acc: 'A04' } },
    { id: '04', name: 'Reviewer Audit AI', triadRole: 'REVIEWER', floor: '1F', dept: 'REVIEWER · 독립 검수 (Codex)', gender: '픽셀 치비', skin: '#fde2d2', hairColor: '#4a3525', eyeColor: '#2563eb', parts: { base: 'BASE_PIXEL', hair: 'H05', face: 'F02', outfit: 'O01', bottom: 'B03', acc: 'A01' } },
    { id: '05', name: 'Gemini Sub AI', triadRole: 'SUB-BUILDER', floor: '1F', dept: 'SUB-BUILDER · 멀티 제미나이 (Google 계정2)', gender: '픽셀 치비', skin: '#e3e8ee', hairColor: '#1e1e24', eyeColor: '#1e293b', parts: { base: 'BASE_PIXEL', hair: 'H02', face: 'F06', outfit: 'O02', bottom: 'B02', acc: 'A01' } },
    { id: '06', name: 'HEAD Proxy Autopilot', triadRole: 'HEAD', floor: '2F', dept: 'HEAD · 자율 프록시 제어', gender: '픽셀 치비', skin: '#fde2d2', hairColor: '#7c4a2d', eyeColor: '#1e293b', parts: { base: 'BASE_PIXEL', hair: 'H02', face: 'F04', outfit: 'O03', bottom: 'B01', acc: 'A03' } },
    { id: '07', name: 'UI/UX Builder AI', triadRole: 'BUILDER', floor: '2F', dept: 'BUILDER · 프런트엔드 구현', gender: '픽셀 치비', skin: '#fde2d2', hairColor: '#d4a359', eyeColor: '#059669', parts: { base: 'BASE_PIXEL', hair: 'H07', face: 'F03', outfit: 'O05', bottom: 'B02', acc: 'A07' } },
    { id: '08', name: '3D Scene Builder AI', triadRole: 'BUILDER', floor: '2F', dept: 'BUILDER · Three.js 3D 구현', gender: '픽셀 치비', skin: '#fff0e6', hairColor: '#d4a359', eyeColor: '#9333ea', parts: { base: 'BASE_PIXEL', hair: 'H01', face: 'F01', outfit: 'O05', bottom: 'B03', acc: 'A03' } },
    { id: '09', name: 'Worktree Sandbox AI', triadRole: 'BUILDER', floor: '2F', dept: 'BUILDER · 격리 Git Worktree', gender: '픽셀 치비', skin: '#f8cfbe', hairColor: '#7c4a2d', eyeColor: '#dc2626', parts: { base: 'BASE_PIXEL', hair: 'H03', face: 'F03', outfit: 'O03', bottom: 'B01', acc: 'A03' } },
    { id: '10', name: 'JSON Proposal AI', triadRole: 'BUILDER', floor: '2F', dept: 'BUILDER · 전체 파일 JSON 제안', gender: '픽셀 치비', skin: '#ebb99a', hairColor: '#1e1e24', eyeColor: '#1e293b', parts: { base: 'BASE_PIXEL', hair: 'H04', face: 'F01', outfit: 'O07', bottom: 'B02', acc: 'A06' } },
    { id: '11', name: 'Solomon Bridge AI', triadRole: 'HEAD', floor: '3F', dept: 'HEAD · 외부 브리지 연동', gender: '픽셀 치비', skin: '#cf9571', hairColor: '#1e1e24', eyeColor: '#d97706', parts: { base: 'BASE_PIXEL', hair: 'H04', face: 'F03', outfit: 'O01', bottom: 'B01', acc: 'A05' } },
    { id: '12', name: 'Provider Failover AI', triadRole: 'HEAD', floor: '3F', dept: 'HEAD · 다중 CLI 장애 조치', gender: '픽셀 치비', skin: '#cf9571', hairColor: '#1e1e24', eyeColor: '#1e293b', parts: { base: 'BASE_PIXEL', hair: 'H01', face: 'F01', outfit: 'O01', bottom: 'B03', acc: 'A03' } },
    { id: '13', name: 'Mission Coordinator', triadRole: 'HEAD', floor: '3F', dept: 'HEAD · 마일스톤 관리', gender: '픽셀 치비', skin: '#fff0e6', hairColor: '#f472b6', eyeColor: '#059669', parts: { base: 'BASE_PIXEL', hair: 'H05', face: 'F01', outfit: 'O03', bottom: 'B03', acc: 'A06' } },
    { id: '14', name: 'Fail-Closed Gate AI', triadRole: 'REVIEWER', floor: '3F', dept: 'REVIEWER · P0/P1 결함 감사', gender: '픽셀 치비', skin: '#e3e8ee', hairColor: '#94a3b8', eyeColor: '#1e293b', parts: { base: 'BASE_PIXEL', hair: 'H06', face: 'F06', outfit: 'O01', bottom: 'B01', acc: 'A01' } },
    { id: '15', name: 'Test Verifier AI', triadRole: 'REVIEWER', floor: '3F', dept: 'REVIEWER · pytest 격리 검증', gender: '픽셀 치비', skin: '#fde2d2', hairColor: '#4a3525', eyeColor: '#1e293b', parts: { base: 'BASE_PIXEL', hair: 'H02', face: 'F04', outfit: 'O03', bottom: 'B01', acc: 'A02' } },
    { id: '16', name: 'Provenance Logger AI', triadRole: 'REVIEWER', floor: '4F', dept: 'REVIEWER · 실행 증거 기록', gender: '픽셀 치비', skin: '#fff0e6', hairColor: '#7c4a2d', eyeColor: '#059669', parts: { base: 'BASE_PIXEL', hair: 'H05', face: 'F01', outfit: 'O03', bottom: 'B03', acc: 'A02' } },
    { id: '17', name: 'Triad Research AI', triadRole: 'REVIEWER', floor: '4F', dept: 'TRIAD · 3-CLI 독립 연구/비판', gender: '픽셀 치비', skin: '#f8cfbe', hairColor: '#4a3525', eyeColor: '#2563eb', parts: { base: 'BASE_PIXEL', hair: 'H01', face: 'F02', outfit: 'O04', bottom: 'B01', acc: 'A03' } },
    { id: '18', name: 'Hypothesis Synth AI', triadRole: 'HEAD', floor: '4F', dept: 'TRIAD · 종합 가설 설계', gender: '픽셀 치비', skin: '#ebb99a', hairColor: '#94a3b8', eyeColor: '#1e293b', parts: { base: 'BASE_PIXEL', hair: 'H08', face: 'F04', outfit: 'O04', bottom: 'B01', acc: 'A04' } },
    { id: '19', name: 'Delivery Merger AI', triadRole: 'BUILDER', floor: '4F', dept: 'BUILDER · 무충돌 자동 반영', gender: '픽셀 치비', skin: '#cf9571', hairColor: '#1e1e24', eyeColor: '#d97706', parts: { base: 'BASE_PIXEL', hair: 'H04', face: 'F03', outfit: 'O06', bottom: 'B04', acc: 'A05' } },
    { id: '20', name: 'Sanitized Env Guard', triadRole: 'REVIEWER', floor: '4F', dept: 'DIRECTOR · API 키 차단 감시', gender: '픽셀 치비', skin: '#cf9571', hairColor: '#3b82f6', eyeColor: '#1e293b', parts: { base: 'BASE_PIXEL', hair: 'H03', face: 'F01', outfit: 'O06', bottom: 'B02', acc: 'A04' } }
  ];

  const ACTIVE_AGENT_COUNT_KEY = 'nexus-active-agent-count-v1';
  const INITIAL_AGENT_COUNT = 10;
  let activeAgentCount = INITIAL_AGENT_COUNT;
  try {
    const savedCnt = parseInt(localStorage.getItem(ACTIVE_AGENT_COUNT_KEY) || '', 10);
    if (!isNaN(savedCnt) && savedCnt >= 1 && savedCnt <= ALL_AGENT_PRESETS.length) {
      activeAgentCount = savedCnt;
    }
  } catch (_) { }

  const modularAgents = ALL_AGENT_PRESETS.slice(0, activeAgentCount);
  window.CharacterEngine = CharacterEngine;
  window.ALL_AGENT_PRESETS = ALL_AGENT_PRESETS;
  window.modularAgents = modularAgents;

  // Initialize default AI CLI & configuration fields on all 20 modularAgents
  const CHAR_AI_STORAGE_KEY = 'nexus-character-ai-configs-v1';
  const CLI_BADGE_LABELS = {
    claude: 'Claude Code',
    antigravity: 'Google Antigravity (계정 1)',
    antigravity_sdk: 'Antigravity SDK ($0)',
    gemini: 'Google Antigravity (계정 2)',
    openai: 'OpenAI Codex',
    grok: 'xAI Grok'
  };
  let backendAvailable = true;
  let lastDiagnostics = null;
  let latestTeamsSummary = null;
  let initialQueryTeamApplied = false;
  let lastTeamsGridHash = '';
  let lastConnWsHash = '';
  let lastAgentsBoardHash = '';
  let localFsModalState = {
    mode: 'explore',
    currentDir: '',
    teamId: null,
    teamName: '',
    onPicked: null,
    isWritable: true
  };
  let savedCharAiConfigs = {};
  try {
    savedCharAiConfigs = JSON.parse(localStorage.getItem(CHAR_AI_STORAGE_KEY) || '{}') || {};
  } catch (_) { }

  const DEFAULT_SKILLS_BY_ROLE = {
    HEAD: ['ORDER 명세 수립', '아키텍처 설계', 'PASS/FAIL 최종 판정'],
    BUILDER: ['풀스택 코드 구현', 'UI/UX & SVG', '격리 Worktree 제안'],
    'SUB-BUILDER': ['구글 서브계정 병렬 구현', '멀티 제미나이 교차 검증', '코드 생성'],
    REVIEWER: ['코드 리뷰(P0/P1)', '자동화 테스트', 'Scope Guard 검증']
  };

  const PERSONA_TEMPLATES = {
    head: "당신은 NEXUS 오피스의 총괄 디렉터(HEAD)입니다. 사용자의 목표를 분석하여 명확한 작업 범위(ORDER)를 정의하고, 구조적이고 핵심 위주로 결단력 있게 답변하세요.",
    builder: "당신은 NEXUS 오피스의 수석 개발자(BUILDER)입니다. 클린 코드, 모듈화, 실행 가능한 구현 방법을 최우선으로 제시하며 실용적인 엔지니어 톤으로 답변하세요.",
    reviewer: "당신은 NEXUS 오피스의 독립 감사관(REVIEWER)입니다. Fail-Closed 원칙에 따라 잠재적 버그(P0/P1), 엣지 케이스, 보안 취약점을 꼼꼼히 짚어내며 객관적으로 답변하세요.",
    security: "당신은 NEXUS 오피스의 Scope Guard 안전 감독관입니다. 허용 경로 준수, 파일 변경 상한, API 키 노출 차단 등 안전성과 규정 준수 관점에서 엄격하게 답변하세요."
  };

  const DEFAULT_MAPLE_EQUIPPED_BY_ID = {
    '01': { skin: 2000, hair: 30000, face: 20000, overall: 1050018, shoes: 1072000, hat: 1002140 },
    '02': { skin: 2000, hair: 30005, face: 20001, overall: 1050004, shoes: 1070004, hat: 1000004 },
    '03': { skin: 2000, hair: 30002, face: 20002, overall: 1050000, shoes: 1070001, hat: 1000000 },
    '04': { skin: 2000, hair: 30001, face: 20000, overall: 1050003, shoes: 1070005, hat: 1000002 },
    '05': { skin: 2000, hair: 30004, face: 20001, overall: 1050005, shoes: 1070003, hat: 1000005 }
  };

  function formatOrgRankBadge(orgRank, triadRole = '') {
    const r = String(orgRank || (triadRole === 'LEAD' || triadRole === 'HEAD' ? 'LEAD' : 'PART_LEAD')).toUpperCase();
    if (r === 'LEAD') return '👑 총괄팀장';
    if (r === 'STAFF') return '👤 일반사원';
    return '⭐ 파트장';
  }

  function formatAgentTimeoutBadge(timeoutSec) {
    const t = String(timeoutSec || 'auto').trim().toLowerCase();
    if (!t || t === 'auto') return '🔄 AUTO (자동연장)';
    return `⏱️ ${t}초`;
  }

  var currentPartRoles = null;
  var LEGACY_ROLE_MAP = {
    HEAD: 'LEAD',
    LEAD: 'LEAD',
    DIRECTOR: 'LEAD',
    RESEARCHER: 'PART_RESEARCH',
    TRIAD: 'PART_RESEARCH',
    'SUB-BUILDER': 'PART_STRUCTURE',
    SUB_BUILDER: 'PART_STRUCTURE',
    BUILDER: 'PART_BUILD',
    REVIEWER: 'PART_BUILD'
  };
  var VERIFIED_SDK_SUBMODELS = [
    { id: 'gemini-4-carbon-high', label: 'Gemini 4 Carbon High (Ultra 최상위 심층설계)' },
    { id: 'gemini-4-carbon-medium', label: 'Gemini 4 Carbon Medium (Ultra)' },
    { id: 'gemini-4-neon-xhigh', label: 'Gemini 4 Neon XHigh (Ultra 차세대 프론티어)' },
    { id: 'gemini-4-neon-high', label: 'Gemini 4 Neon High (Ultra)' },
    { id: 'claude-opus-5-5-high', label: 'Claude Opus 5.5 High (총괄·심층판단)' },
    { id: 'claude-opus-5-5-medium', label: 'Claude Opus 5.5 Medium' },
    { id: 'claude-opus-5-5-low', label: 'Claude Opus 5.5 Low' },
    { id: 'claude-sonnet-5-5-high', label: 'Claude Sonnet 5.5 High (수석구현·검수)' },
    { id: 'claude-sonnet-5-5-medium', label: 'Claude Sonnet 5.5 Medium (구조·설계)' },
    { id: 'claude-sonnet-5-5-low', label: 'Claude Sonnet 5.5 Low' },
    { id: 'gemini-4-argon-high', label: 'Gemini 4 Argon High (파트장·취합)' },
    { id: 'gemini-4-argon-medium', label: 'Gemini 4 Argon Medium (품질·마감)' },
    { id: 'gemini-4-argon-low', label: 'Gemini 4 Argon Low' },
    { id: 'gemini-4-hydrogen-xhigh', label: 'Gemini 4 Hydrogen XHigh (정밀설계)' },
    { id: 'gemini-4-hydrogen-high', label: 'Gemini 4 Hydrogen High (핵심구현)' },
    { id: 'gemini-4-hydrogen-medium', label: 'Gemini 4 Hydrogen Medium' },
    { id: 'gemini-4-hydrogen-low', label: 'Gemini 4 Hydrogen Low' },
    { id: 'gemini-3.8-flash-high', label: 'Gemini 3.8 Flash High (고속탐색 사원)' },
    { id: 'gemini-3.8-flash-medium', label: 'Gemini 3.8 Flash Medium (데이터정제 사원)' },
    { id: 'gemini-3.8-flash-low', label: 'Gemini 3.8 Flash Low' },
    { id: 'gpt-oss-120b-medium', label: 'GPT-OSS 120B Medium (이기종 교차검증 사원)' },
    { id: 'gemini-pro-orchestrator-argon', label: 'Orchestrator Argon (듀얼 플래너)' },
    { id: 'gemini-pro-orchestrator', label: 'Orchestrator Carbon (Ultra 플래너)' },
    { id: 'gemini-pro-orchestrator-neon', label: 'Orchestrator Neon (Ultra 플래너)' }
  ];

  function normalizeAgentPartRoleId(rawRole) {
    const up = String(rawRole || '').trim().toUpperCase();
    if (!up) return 'PART_BUILD';
    if (currentPartRoles && Array.isArray(currentPartRoles.assignable_roles)) {
      if (currentPartRoles.assignable_roles.some(r => r.id === up)) return up;
    }
    return (LEGACY_ROLE_MAP && LEGACY_ROLE_MAP[up]) || up;
  }

  function getPartRoleDisplayLabel(rawRole) {
    const canon = normalizeAgentPartRoleId(rawRole);
    if (currentPartRoles && Array.isArray(currentPartRoles.assignable_roles)) {
      const found = currentPartRoles.assignable_roles.find(r => r.id === canon);
      if (found) return `${found.icon || '🧩'} ${found.name}`;
    }
    const defaults = {
      LEAD: '👑 프로젝트 총괄팀장',
      PART_RESEARCH: '🔎 자료수집 파트 담당',
      PART_STRUCTURE: '🗂️ 기획·구조설계 파트 담당',
      PART_BUILD: '🛠️ 제작·구현 파트 담당'
    };
    return defaults[canon] || rawRole;
  }

  function getActiveCliProvidersMap() {
    if (lastDiagnostics && lastDiagnostics.providers && Object.keys(lastDiagnostics.providers).length > 0) {
      return lastDiagnostics.providers;
    }
    try {
      const cached = JSON.parse(localStorage.getItem('nexus-cli-slots-v1') || 'null');
      if (Array.isArray(cached) && cached.length > 0) {
        const obj = {};
        cached.forEach(s => {
          if (s && s.key) {
            obj[s.key] = {
              provider: s.key,
              base_type: s.base_type || s.key,
              domain: s.domain || (s.key === 'antigravity_sdk' ? 'SDK' : s.key.toUpperCase()),
              cli: s.cli || (s.key === 'antigravity_sdk' ? 'agy-sdk' : s.key),
              label: String(s.label || s.key).replace(/\s*\([^)]*\)\s*$/, '') || s.label || s.key,
              auth_state: s.auth_state || 'LOGGED_IN',
              selected_model_display: s.selected_model_display || '기본 모델'
            };
          }
        });
        if (Object.keys(obj).length > 0) return obj;
      }
    } catch (_) { }
    return {
      antigravity_sdk: {
        provider: 'antigravity_sdk',
        base_type: 'antigravity_sdk',
        domain: 'SDK',
        cli: 'agy-sdk',
        label: 'Antigravity SDK (구독·로컬 $0)',
        auth_state: 'LOGGED_IN',
        selected_model_display: 'Gemini 4 Carbon (High)'
      }
    };
  }

  function applySavedConfigToAgent(a, idx = 0) {
    const defCli = 'antigravity_sdk';
    const defSandbox = (a.triadRole === 'BUILDER' || a.triadRole === 'PART_BUILD') ? 'proposal' : 'read-only';
    const defTimeout = 'auto';
    const saved = savedCharAiConfigs[a.id] || {};
    const defMaple = DEFAULT_MAPLE_EQUIPPED_BY_ID[a.id] || {
      skin: 2000,
      hair: 30000 + (idx % 6),
      face: 20000 + (idx % 5),
      overall: 1050000 + (idx % 6),
      shoes: 1070000 + (idx % 6),
      hat: 1000000 + (idx % 6)
    };
    a.name = saved.name || a.name;
    a.floor = saved.floor || a.floor;
    a.triadRole = saved.triadRole || a.triadRole || 'HEAD';
    a.orgRank = saved.orgRank || (a.triadRole === 'LEAD' || a.triadRole === 'HEAD' ? 'LEAD' : 'PART_LEAD');
    a.staffOrder = Number(saved.staffOrder || 0);
    a.cliProvider = saved.cliProvider || defCli;
    a.cliModel = saved.cliModel || '';
    a.sandboxMode = saved.sandboxMode || defSandbox;
    const rawTimeout = String(saved.timeoutSec || defTimeout).trim().toLowerCase();
    a.timeoutSec = (!rawTimeout || rawTimeout === 'auto') ? 'auto' : rawTimeout;
    a.mapleEquipped = (saved.mapleEquipped && typeof saved.mapleEquipped === 'object' && Object.keys(saved.mapleEquipped).length > 0)
      ? { ...saved.mapleEquipped }
      : { ...defMaple };
    a.mapleAnim = saved.mapleAnim || 'stand1';
    a.mapleAnimated = Boolean(saved.mapleAnimated);
    a.mapleFlipped = Boolean(saved.mapleFlipped);
    a.skills = Array.isArray(saved.skills) && saved.skills.length
      ? [...saved.skills]
      : [...(DEFAULT_SKILLS_BY_ROLE[a.triadRole] || DEFAULT_SKILLS_BY_ROLE.HEAD)];
    a.systemPrompt = saved.systemPrompt || `당신은 ${a.floor} 소속 '${a.name}' (${a.triadRole} · ${a.orgRank}) 에이전트입니다. 맡은 전문 분야에 맞게 명확하고 정확하게 답변하세요.`;
  }

  ALL_AGENT_PRESETS.forEach((a, idx) => applySavedConfigToAgent(a, idx));

  function persistCharacterAiConfig(agent) {
    if (!agent) return;
    savedCharAiConfigs[agent.id] = {
      id: agent.id,
      name: agent.name,
      floor: agent.floor,
      dept: agent.dept,
      triadRole: agent.triadRole,
      orgRank: agent.orgRank || (agent.triadRole === 'LEAD' ? 'LEAD' : 'PART_LEAD'),
      staffOrder: Number(agent.staffOrder || 0),
      cliProvider: agent.cliProvider,
      cliModel: agent.cliModel || '',
      sandboxMode: agent.sandboxMode,
      timeoutSec: agent.timeoutSec,
      mapleEquipped: agent.mapleEquipped ? { ...agent.mapleEquipped } : {},
      mapleAnim: agent.mapleAnim || 'stand1',
      mapleAnimated: Boolean(agent.mapleAnimated),
      mapleFlipped: Boolean(agent.mapleFlipped),
      skills: Array.isArray(agent.skills) ? agent.skills : [],
      systemPrompt: agent.systemPrompt,
      updatedAt: new Date().toISOString()
    };
    try {
      localStorage.setItem(CHAR_AI_STORAGE_KEY, JSON.stringify(savedCharAiConfigs));
    } catch (_) { }
  }

  let lastServerCharConfigSig = '';
  let renderConfiguredAgentsRosterFn = null;
  let renderConfiguredTeamsSectionFn = null;
  let renderDashboardAgentsAndStatsFn = null;

  function syncServerCharConfigsIntoRuntime(srvConfigs, forceServerWin = false) {
    if (!srvConfigs || typeof srvConfigs !== 'object') return false;
    const srvKeys = Object.keys(srvConfigs).filter(cid => srvConfigs[cid] && typeof srvConfigs[cid] === 'object');
    if (!srvKeys.length) return false;

    const studioBox = document.getElementById('characters');
    const userEditingStudio = Boolean(
      !forceServerWin && studioBox && studioBox.contains(document.activeElement)
    );
    const incomingSig = JSON.stringify(srvKeys.sort().map(k => [
      k,
      srvConfigs[k].name,
      srvConfigs[k].triadRole,
      srvConfigs[k].orgRank,
      srvConfigs[k].staffOrder,
      srvConfigs[k].cliProvider,
      srvConfigs[k].cliModel,
      srvConfigs[k].timeoutSec,
      srvConfigs[k].floor,
      srvConfigs[k].updatedAt
    ]));
    if (!forceServerWin && incomingSig === lastServerCharConfigSig) {
      return false;
    }
    if (userEditingStudio) {
      return false;
    }
    lastServerCharConfigSig = incomingSig;

    let maxConfiguredIdx = 5;
    // Adopt server character_configs.json as Single Source of Truth
    Object.keys(savedCharAiConfigs).forEach(k => {
      if (!srvConfigs[k]) delete savedCharAiConfigs[k];
    });
    srvKeys.forEach(cid => {
      const srv = srvConfigs[cid];
      const numId = parseInt(cid, 10);
      if (!isNaN(numId) && numId > maxConfiguredIdx && numId <= ALL_AGENT_PRESETS.length) {
        maxConfiguredIdx = numId;
      }
      savedCharAiConfigs[cid] = { ...srv };
    });

    modularAgents.length = 0;
    for (let i = 0; i < maxConfiguredIdx && i < ALL_AGENT_PRESETS.length; i++) {
      modularAgents.push(ALL_AGENT_PRESETS[i]);
    }
    activeAgentCount = modularAgents.length;
    try {
      localStorage.setItem(ACTIVE_AGENT_COUNT_KEY, String(modularAgents.length));
      localStorage.setItem(CHAR_AI_STORAGE_KEY, JSON.stringify(savedCharAiConfigs));
    } catch (_) { }

    ALL_AGENT_PRESETS.forEach((a, idx) => applySavedConfigToAgent(a, idx));

    // Sync server character floor & seatIndex into virtual office floor/seat map so new R&D staff (#11~#20) appear cleanly
    try {
      const floors = loadOfficeFloorsMap();
      const placements = loadOfficePlacementsMap();
      srvKeys.sort().forEach((cid, idx) => {
        const srv = srvConfigs[cid] || {};
        const fNum = Math.max(1, Math.min(10, parseInt(String(srv.floor || '1F'), 10) || 1));
        for (let f = 1; f <= fNum; f++) {
          if (!floors.some(fl => fl.id === f)) {
            floors.push({ id: f, name: `${f}층`, description: `${f}F 팀 오피스`, seatCount: 6 });
          }
        }
        const targetFl = floors.find(fl => fl.id === fNum);
        let sIdx = typeof srv.seatIndex === 'number'
          ? Math.max(0, Math.min(9, srv.seatIndex))
          : (placements[cid] && placements[cid].floorId === fNum ? placements[cid].seatIndex : (idx % 10));
        if (targetFl && sIdx >= (targetFl.seatCount || 6)) {
          targetFl.seatCount = Math.min(10, sIdx + 1);
        }
        placements[cid] = { floorId: fNum, seatIndex: sIdx };
      });
      floors.sort((a, b) => a.id - b.id);
      localStorage.setItem(OFFICE_FLOORS_KEY, JSON.stringify(floors));
      localStorage.setItem(OFFICE_PLACEMENTS_KEY, JSON.stringify(placements));
    } catch (_) { }

    const statReg = document.getElementById('statRegisteredAgents');
    if (statReg) statReg.textContent = String(modularAgents.length).padStart(2, '0');
    const totBadge = document.getElementById('studioTotalBadge');
    if (totBadge) totBadge.innerHTML = `<span class="character-total-dot"></span> ${String(modularAgents.length).padStart(2, '0')} AGENTS`;
    const libCnt = document.getElementById('studioLibraryCount');
    if (libCnt) libCnt.textContent = `${modularAgents.length} AGENTS`;
    renderTopRosterAvatars();
    if (studioRefreshDirectoryFn) studioRefreshDirectoryFn();
    if (renderConfiguredAgentsRosterFn) renderConfiguredAgentsRosterFn(true);
    if (renderConfiguredTeamsSectionFn && window.NEXUS_TEAMS_SUMMARY) {
      renderConfiguredTeamsSectionFn(window.NEXUS_TEAMS_SUMMARY, true);
    }
    window.dispatchEvent(new CustomEvent('nexus:character-configs-updated', { detail: { configs: savedCharAiConfigs } }));
    return true;
  }

  async function saveCharacterConfigsToServer(targetAgent = null) {
    if (targetAgent) {
      persistCharacterAiConfig(targetAgent);
    } else {
      modularAgents.forEach(a => persistCharacterAiConfig(a));
    }
    try {
      const res = await fetch('/ops/character-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ configs: savedCharAiConfigs })
      });
      const d = await res.json().catch(() => ({}));
      if (d && d.configs) {
        lastServerCharConfigSig = '';
        syncServerCharConfigsIntoRuntime(d.configs, true);
      }
    } catch (_) { }
    renderTopRosterAvatars();
    if (renderConfiguredAgentsRosterFn) renderConfiguredAgentsRosterFn(true);
    if (renderConfiguredTeamsSectionFn && window.NEXUS_TEAMS_SUMMARY) {
      renderConfiguredTeamsSectionFn(window.NEXUS_TEAMS_SUMMARY, true);
    }
    window.dispatchEvent(new CustomEvent('nexus:character-configs-updated', { detail: { configs: savedCharAiConfigs } }));
  }

  function renderTopRosterAvatars() {
    if (renderConfiguredAgentsRosterFn) renderConfiguredAgentsRosterFn(false);
    if (renderDashboardAgentsAndStatsFn) renderDashboardAgentsAndStatsFn(false);
  }

  // 페이지 로드 시 서버(config/characters/character_configs.json)에 저장된 실제 직원 설정을 기준(forceServerWin=true)으로 동기화
  fetch('/ops/character-config')
    .then(r => r.ok ? r.json() : null)
    .then(data => {
      if (data && data.configs && typeof data.configs === 'object' && Object.keys(data.configs).length > 0) {
        syncServerCharConfigsIntoRuntime(data.configs, true);
        if (currentPartRoles) syncPartRolesToDOM(currentPartRoles, true);
      }
    })
    .catch(() => { });

  renderTopRosterAvatars();

  function formatPartCode(parts, agent = null) {
    if (agent && agent.mapleEquipped && Object.keys(agent.mapleEquipped).length > 0) {
      const eq = agent.mapleEquipped;
      return `KMS389 · H:${eq.hair || '-'} / F:${eq.face || '-'} / C:${eq.overall || eq.top || '-'}`;
    }
    return `${parts.base}/${parts.hair}/${parts.face}/${parts.outfit}/${parts.bottom}/${parts.acc}`;
  }

  // ==========================================================================
  // [2-B] 3D 가상 오피스(office.js) 층(Floor) & 좌석(Seat #1~#10) 실시간 배치 동기화 헬퍼
  // ==========================================================================
  const OFFICE_FLOORS_KEY = 'nexus-office-floors-v6';
  const OFFICE_PLACEMENTS_KEY = 'nexus-gm-office-svg-placements-v6';
  const OFFICE_SEAT_LABELS = [
    '#1번석 · 좌측 뒷줄 (앞면)',
    '#2번석 · 좌측 앞줄 (마주보기)',
    '#3번석 · 중앙 뒷줄 (앞면)',
    '#4번석 · 중앙 앞줄 (마주보기)',
    '#5번석 · 우측 뒷줄 (앞면)',
    '#6번석 · 우측 앞줄 (마주보기)',
    '#7번석 · 서브A 뒷줄 (확장석)',
    '#8번석 · 서브A 앞줄 (확장석)',
    '#9번석 · 서브B 뒷줄 (확장석)',
    '#10번석 · 서브B 앞줄 (확장석)'
  ];

  let studioSelectAgentFn = null;
  let studioRefreshDirectoryFn = null;

  function loadOfficeFloorsMap() {
    try {
      const parsed = JSON.parse(localStorage.getItem(OFFICE_FLOORS_KEY) || 'null');
      if (Array.isArray(parsed) && parsed.length) return parsed;
    } catch (_) { }
    return [
      { id: 1, name: '1층', description: 'GM 본관 · 마주보는 6석', seatCount: 6 },
      { id: 2, name: '2층', description: '개발 스튜디오 · 마주보는 6석', seatCount: 6 }
    ];
  }

  function loadOfficePlacementsMap() {
    try {
      const parsed = JSON.parse(localStorage.getItem(OFFICE_PLACEMENTS_KEY) || 'null');
      if (parsed && typeof parsed === 'object' && Object.keys(parsed).length >= 1) return parsed;
    } catch (_) { }
    const def = {};
    modularAgents.forEach((ag, idx) => {
      const fNum = parseInt(String(ag.floor || '1F'), 10) || (Math.floor(idx / 6) + 1);
      def[ag.id] = { floorId: fNum, seatIndex: idx % 6 };
    });
    return def;
  }

  function getAgentOfficePlacement(agentId, fallbackFloorStr = '1F') {
    const savedCfg = savedCharAiConfigs[agentId] || null;
    const map = loadOfficePlacementsMap();
    const p = map[agentId];
    if (p && Number.isInteger(p.floorId) && typeof p.seatIndex === 'number') {
      return { floorId: p.floorId, floorStr: `${p.floorId}F`, seatIndex: Math.max(0, Math.min(9, p.seatIndex)) };
    }
    const effFlStr = savedCfg?.floor || fallbackFloorStr || '1F';
    const fNum = Math.max(1, Math.min(10, parseInt(String(effFlStr), 10) || 1));
    const sIdx = typeof savedCfg?.seatIndex === 'number'
      ? Math.max(0, Math.min(9, savedCfg.seatIndex))
      : ((Math.max(1, parseInt(agentId, 10) || 1) - 1) % 10);
    return { floorId: fNum, floorStr: `${fNum}F`, seatIndex: sIdx };
  }

  function syncAgentOfficePlacement(agentId, floorStr, preferredSeatIdx = null, persistServer = true) {
    const fNum = Math.max(1, Math.min(10, parseInt(String(floorStr || '1F'), 10) || 1));
    const normFloorStr = `${fNum}F`;

    // 1. Ensure target floor exists in nexus-office-floors-v6 (and expand seatCount if seat >= 6)
    const floors = loadOfficeFloorsMap();
    for (let i = 1; i <= fNum; i++) {
      if (!floors.some(f => f.id === i)) {
        floors.push({ id: i, name: `${i}층`, description: `${i}F 팀 오피스 · 마주보는 6석`, seatCount: 6 });
      }
    }
    floors.sort((a, b) => a.id - b.id);
    const targetFl = floors.find(f => f.id === fNum);

    // 2. Assign or swap seat cleanly without overlapping two agents
    const placements = loadOfficePlacementsMap();
    const prev = placements[agentId] || null;
    let finalSeat = 0;

    if (preferredSeatIdx !== null && preferredSeatIdx !== undefined && !isNaN(Number(preferredSeatIdx))) {
      finalSeat = Math.max(0, Math.min(9, Number(preferredSeatIdx)));
      if (targetFl && finalSeat >= (targetFl.seatCount || 6)) {
        targetFl.seatCount = Math.min(10, finalSeat + 1);
      }
      // If another agent was sitting at (fNum, finalSeat), swap or move them to an open seat
      const occupantId = Object.keys(placements).find(
        cid => cid !== agentId && placements[cid]?.floorId === fNum && placements[cid]?.seatIndex === finalSeat
      );
      if (occupantId) {
        if (prev && prev.floorId === fNum && typeof prev.seatIndex === 'number') {
          placements[occupantId] = { floorId: fNum, seatIndex: prev.seatIndex };
        } else {
          const used = new Set(
            Object.entries(placements)
              .filter(([cid, pl]) => cid !== agentId && cid !== occupantId && pl?.floorId === fNum)
              .map(([, pl]) => pl.seatIndex)
          );
          used.add(finalSeat);
          let openS = 0;
          while (used.has(openS) && openS < 9) openS++;
          if (targetFl && openS >= (targetFl.seatCount || 6)) targetFl.seatCount = Math.min(10, openS + 1);
          placements[occupantId] = { floorId: fNum, seatIndex: openS };
        }
      }
    } else {
      if (prev && prev.floorId === fNum && typeof prev.seatIndex === 'number') {
        finalSeat = prev.seatIndex;
      } else {
        const used = new Set(
          Object.entries(placements)
            .filter(([cid, pl]) => cid !== agentId && pl?.floorId === fNum)
            .map(([, pl]) => pl.seatIndex)
        );
        let openS = 0;
        while (used.has(openS) && openS < 9) openS++;
        finalSeat = openS;
        if (targetFl && finalSeat >= (targetFl.seatCount || 6)) {
          targetFl.seatCount = Math.min(10, finalSeat + 1);
        }
      }
    }

    placements[agentId] = { floorId: fNum, seatIndex: finalSeat };
    try {
      localStorage.setItem(OFFICE_FLOORS_KEY, JSON.stringify(floors));
      localStorage.setItem(OFFICE_PLACEMENTS_KEY, JSON.stringify(placements));
    } catch (_) { }

    // 3. Sync in-memory agent preset + savedCharAiConfigs
    const agPreset = ALL_AGENT_PRESETS.find(a => a.id === agentId);
    if (agPreset) agPreset.floor = normFloorStr;
    const modAg = modularAgents.find(a => a.id === agentId);
    if (modAg) modAg.floor = normFloorStr;
    if (!savedCharAiConfigs[agentId]) savedCharAiConfigs[agentId] = { id: agentId };
    savedCharAiConfigs[agentId].floor = normFloorStr;
    savedCharAiConfigs[agentId].seatIndex = finalSeat;
    try {
      localStorage.setItem(CHAR_AI_STORAGE_KEY, JSON.stringify(savedCharAiConfigs));
    } catch (_) { }

    if (persistServer) {
      fetch('/ops/character-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ configs: savedCharAiConfigs })
      }).catch(() => { });
    }
    return { floorId: fNum, floorStr: normFloorStr, seatIndex: finalSeat };
  }

  // ==========================================================================
  // [3] KMS v389 (maplestory-characters-scraper · 29,491 Parts) 시뮬레이터 컨트롤러
  // ==========================================================================
  if (page === 'dashboard' || page === 'agents') {
    const gridEl = document.getElementById('charDirectoryGrid');
    const floorFilter = document.getElementById('floorFilter');
    const stageEl = document.getElementById('customizerStage');
    const canvasArea = document.getElementById('simCanvasArea');
    const nameEl = document.getElementById('customizerName');
    const deptEl = document.getElementById('customizerDept');
    const pillEl = document.getElementById('customizerCodePill');
    const badgeEl = document.getElementById('selectedCharBadge');
    const codeOutputEl = document.querySelector('#charCodeOutput code');
    const copyBtn = document.getElementById('copyCharCode');
    const btnCopyJson = document.getElementById('btnCopyJson');
    const btnFlipDir = document.getElementById('btnFlipDir');
    const selStance = document.getElementById('selStance');
    const btnSimMotionPlay = document.getElementById('btnSimMotionPlay');
    const simMotionIcon = document.getElementById('simMotionIcon');
    const simMotionLabel = document.getElementById('simMotionLabel');
    const simBgLayer = document.getElementById('simBgLayer');
    const simBgImg = document.getElementById('simBgImg');
    const simBgBadge = document.getElementById('simBgBadge');
    const simPetBox = document.getElementById('simPetBox');
    const simPetImg = document.getElementById('simPetImg');
    const simPetName = document.getElementById('simPetName');
    const btnBackdrop = document.getElementById('btnBackdrop');
    const btnRandomize = document.getElementById('btnRandomize');
    const btnLoadDefault = document.getElementById('btnLoadDefault');
    const btnResetParts = document.getElementById('btnResetParts');
    const btnExportPng = document.getElementById('btnExportPng');
    const layerListEl = document.getElementById('equippedLayerList');
    const simEquippedCountEl = document.getElementById('simEquippedCount');

    // KMS v389 29,491개 파츠 브라우저 DOM
    const mapleSimSearchInput = document.getElementById('mapleSimSearchInput');
    const btnMapleSimClearSearch = document.getElementById('btnMapleSimClearSearch');
    const mapleSimOnlyEquipped = document.getElementById('mapleSimOnlyEquipped');
    const mapleSimSubFilters = document.getElementById('mapleSimSubFilters');
    const mapleSimCategoryTitle = document.getElementById('mapleSimCategoryTitle');
    const mapleSimResultCount = document.getElementById('mapleSimResultCount');
    const mapleSimPartsGrid = document.getElementById('mapleSimPartsGrid');
    const mapleSimLoadMoreWrap = document.getElementById('mapleSimLoadMoreWrap');
    const mapleSimLoadMoreInfo = document.getElementById('mapleSimLoadMoreInfo');
    const btnMapleSimLoadMore = document.getElementById('btnMapleSimLoadMore');
    const btnUnequipAllMaple = document.getElementById('btnUnequipAllMaple');

    // AI CLI Studio Controls
    const studioQuickRole = document.getElementById('studioQuickRole');
    const studioQuickRank = document.getElementById('studioQuickRank');
    const studioQuickCli = document.getElementById('studioQuickCli');
    const studioAiModelSelect = document.getElementById('studioAiModelSelect');
    const studioAiModelSourceHint = document.getElementById('studioAiModelSourceHint');
    const studioAiNameInput = document.getElementById('studioAiNameInput');
    const studioAiTeamSelect = document.getElementById('studioAiTeamSelect');
    const btnStudioEditTeam = document.getElementById('btnStudioEditTeam');
    const studioAiFloorSelect = document.getElementById('studioAiFloorSelect');
    const studioAiSeatSelect = document.getElementById('studioAiSeatSelect');
    const studioAiSandboxSelect = document.getElementById('studioAiSandboxSelect');
    const studioAiTimeoutSelect = document.getElementById('studioAiTimeoutSelect');
    const studioAiPromptInput = document.getElementById('studioAiPromptInput');
    const btnSaveCharAiConfig = document.getElementById('btnSaveCharAiConfig');
    const btnApplyCharToGlobalRole = document.getElementById('btnApplyCharToGlobalRole');
    const studioCharAskForm = document.getElementById('studioCharAskForm');
    const studioCharAskInput = document.getElementById('studioCharAskInput');
    const studioCharAskBtn = document.getElementById('studioCharAskBtn');
    const studioCharAskReply = document.getElementById('studioCharAskReply');

    let selectedId = '01';
    let isFlipped = false;
    let currentZoom = 1.8;
    let currentStance = 'stand1';
    let isMotionAnimated = false;
    const backdrops = ['backdrop-checker', 'backdrop-white', 'backdrop-dark', 'backdrop-henesys'];
    let backdropIdx = 0;

    // ========================================================================
    // KMS v389 (maplestory-characters-scraper) 29,491개 파츠 데이터 및 슬롯 정의
    // ========================================================================
    const SLOT_INFO = {
      skin: { label: '피부', icon: '🎨', order: 1 },
      hair: { label: '헤어', icon: '💇', order: 2 },
      face: { label: '표정/성형', icon: '👀', order: 3 },
      hat: { label: '모자', icon: '🎩', order: 4 },
      overall: { label: '한벌옷', icon: '👗', order: 5 },
      top: { label: '상의', icon: '👕', order: 6 },
      bottom: { label: '하의', icon: '👖', order: 7 },
      shoes: { label: '신발', icon: '👟', order: 8 },
      cape: { label: '망토', icon: '🧣', order: 9 },
      glove: { label: '장갑', icon: '🧤', order: 10 },
      faceAccessory: { label: '얼굴장식', icon: '🎭', order: 11 },
      eyeDecoration: { label: '눈장식', icon: '👓', order: 12 },
      earrings: { label: '귀고리', icon: '💎', order: 13 },
      ring: { label: '반지/명찰', icon: '💍', order: 15 },
      decoration: { label: '설치장식', icon: '🎀', order: 17 },
      furniture: { label: '가구/의자', icon: '🪑', order: 18 },
      pet: { label: '동행 펫', icon: '🐾', order: 19 },
      petEquip: { label: '펫 장비', icon: '🔔', order: 20 }
    };

    const CATEGORY_NAMES = {
      all: '전체 항목',
      hair: '💇 헤어 (Hair)',
      face: '👀 표정/성형 (Face)',
      clothes: '👗 의상 (한벌옷/상의/하의)',
      accessories: '👑 모자/악세사리',
      shoes: '👟 신발 (Shoes)',
      furniture: '🪑 가구/의자 (Chair)',
      pet: '🐾 펫/반려동물 (Pet)',
      decoration: '💍 장식 (Ring/Decoration)',
      skin: '🎨 피부 (Skin)'
    };

    const SKIN_COLORS = {
      2000: '#fcd7b6', 2001: '#c99765', 2002: '#8d6139', 2003: '#fff2e6',
      2004: '#d3d6e2', 2009: '#e8eaed', 2010: '#ffd2c4', 2011: '#dcb897',
      2012: '#fff1e6', 2013: '#dcd8e6', 2015: '#ffebe6', 2016: '#ffd8de',
      2018: '#f7f0ff', 2019: '#f3e0ff', 2024: '#d9eb52', 2025: '#ffdd47'
    };

    // 사용자 요청에 따라 파츠/서브필터에서 제거할 항목 목록 (지역명 + 건물/공간 + 이펙트/타이틀)
    const EXCLUDED_MAPLE_TERMS = [
      '메이플로드', '헤네시스', '히든스트리트', '유타네 집', '골렘사원',
      '파르템', '엘리니아', '요정의 숲', '루엔의 집', '페리온'
    ];
    const EXCLUDED_MAPLE_SET = new Set(EXCLUDED_MAPLE_TERMS);
    const EXCLUDED_DECO_SUBS = new Set(['Effect', 'Title']);

    function isExcludedMaplePart(p) {
      if (!p) return true;
      if (p.category === 'building') return true;
      const sub = (p.subCategory || '').trim();
      if (EXCLUDED_DECO_SUBS.has(sub)) return true;
      const name = (p.name || '').trim();
      if (EXCLUDED_MAPLE_SET.has(sub) || EXCLUDED_MAPLE_SET.has(name)) return true;
      return EXCLUDED_MAPLE_TERMS.some(term => sub.includes(term) || name.includes(term));
    }

    const rawInitialParts = (typeof window !== 'undefined' && window.__MAPLE_DATA__ && Array.isArray(window.__MAPLE_DATA__.parts))
      ? window.__MAPLE_DATA__.parts
      : [];
    let allMapleParts = rawInitialParts.filter(p => !isExcludedMaplePart(p));
    const maplePartById = new Map();
    allMapleParts.forEach(p => maplePartById.set(p.id, p));

    function updateMapleTabCategoryCounts() {
      const counts = {
        all: allMapleParts.length,
        hair: 0, face: 0, clothes: 0, accessories: 0,
        shoes: 0, furniture: 0, pet: 0, building: 0, decoration: 0, skin: 0
      };
      allMapleParts.forEach(p => {
        if (counts[p.category] !== undefined) counts[p.category]++;
      });
      document.querySelectorAll('[data-maple-count]').forEach(el => {
        const key = el.dataset.mapleCount;
        if (counts[key] !== undefined) el.textContent = counts[key].toLocaleString();
      });
    }

    const simAgentSelect = document.getElementById('simAgentSelect');
    function syncSimAgentSelect() {
      if (!simAgentSelect) return;
      simAgentSelect.innerHTML = modularAgents.map(a => {
        const cliLabel = CLI_BADGE_LABELS[a.cliProvider] || a.cliProvider;
        return `<option value="${a.id}" ${a.id === selectedId ? 'selected' : ''}>#${a.id} ${a.name} (${a.floor} · ${a.triadRole} / ${cliLabel})</option>`;
      }).join('');
    }
    simAgentSelect?.addEventListener('change', (e) => {
      selectedId = e.target.value;
      const agent = modularAgents.find(a => a.id === selectedId);
      if (agent) {
        currentStance = agent.mapleAnim || 'stand1';
        isMotionAnimated = Boolean(agent.mapleAnimated);
        isFlipped = Boolean(agent.mapleFlipped);
        if (selStance) selStance.value = currentStance;
      }
      renderDirectory();
      updateCustomizer();
      updateMapleCardEquippedHighlight();
    });

    let mapleBrowserState = {
      category: 'all',
      subCategory: 'all',
      searchQuery: '',
      onlyEquipped: false,
      pageSize: 60,
      currentPage: 1,
      filtered: []
    };

    function getMaplePartLocalIcon(part) {
      if (!part) return '';
      if (part.icon) return `character-images/${part.icon}`;
      return `character-images/images/${part.category}/${part.id}.png`;
    }

    function getMapleItemSlot(part) {
      if (!part) return 'unknown';
      if (part.category === 'skin') return 'skin';
      if (part.category === 'hair') return 'hair';
      if (part.category === 'face') return 'face';
      if (part.category === 'shoes') return 'shoes';
      if (part.category === 'furniture') return 'furniture';
      if (part.category === 'building') return 'building';
      if (part.category === 'clothes') {
        if (part.subCategory === 'Overall') return 'overall';
        if (part.subCategory === 'Top') return 'top';
        if (part.subCategory === 'Bottom') return 'bottom';
        return 'overall';
      }
      if (part.category === 'accessories') {
        if (part.subCategory === 'Hat') return 'hat';
        if (part.subCategory === 'Face Accessory') return 'faceAccessory';
        if (part.subCategory === 'Eye Decoration') return 'eyeDecoration';
        if (part.subCategory === 'Earrings') return 'earrings';
        if (part.subCategory === 'Cape') return 'cape';
        if (part.subCategory === 'Glove') return 'glove';
        return 'hat';
      }
      if (part.category === 'pet') {
        if (part.subCategory === 'Pet Equipment') return 'petEquip';
        return 'pet';
      }
      if (part.category === 'decoration') {
        if (part.subCategory === 'Effect') return 'effect';
        if (part.subCategory === 'Ring') return 'ring';
        if (part.subCategory === 'Title') return 'title';
        if (part.subCategory === 'Decoration') return 'decoration';
        return 'effect';
      }
      return part.category;
    }

    function renderDirectory() {
      syncSimAgentSelect();
      if (!gridEl) return;
      const filterVal = floorFilter?.value || 'all';
      gridEl.innerHTML = '';

      const totalBadge = document.getElementById('studioTotalBadge');
      if (totalBadge) totalBadge.innerHTML = `<span class="character-total-dot"></span> ${String(modularAgents.length).padStart(2, '0')} AGENTS`;
      const libCount = document.getElementById('studioLibraryCount');
      if (libCount) libCount.textContent = `${modularAgents.length} AGENTS`;
      const statReg = document.getElementById('statRegisteredAgents');
      if (statReg) statReg.textContent = String(modularAgents.length).padStart(2, '0');

      const teamsArr = (window.NEXUS_TEAMS_SUMMARY && Array.isArray(window.NEXUS_TEAMS_SUMMARY.teams))
        ? window.NEXUS_TEAMS_SUMMARY.teams
        : [];
      if (floorFilter && teamsArr.length > 0) {
        const prevFilter = floorFilter.value || 'all';
        floorFilter.querySelectorAll('option[data-team-opt="1"]').forEach(o => o.remove());
        teamsArr.forEach(t => {
          const opt = document.createElement('option');
          opt.value = `team:${t.id}`;
          opt.dataset.teamOpt = '1';
          opt.textContent = `🏢 팀: ${t.name} (${t.floor})`;
          floorFilter.insertBefore(opt, floorFilter.children[1] || null);
        });
        if (Array.from(floorFilter.options).some(o => o.value === prevFilter)) {
          floorFilter.value = prevFilter;
        }
      }
      const effFilterVal = floorFilter?.value || 'all';

      modularAgents
        .filter(a => {
          if (effFilterVal === 'all') return true;
          if (effFilterVal.startsWith('team:')) {
            const tid = effFilterVal.slice(5);
            const tObj = teamsArr.find(x => x.id === tid);
            return Boolean(tObj && Array.isArray(tObj.member_ids) && tObj.member_ids.includes(a.id));
          }
          const normAgRole = typeof normalizeAgentPartRoleId === 'function' ? normalizeAgentPartRoleId(a.triadRole) : a.triadRole;
          const effRankAg = normAgRole === 'LEAD' ? 'LEAD' : (a.orgRank === 'STAFF' ? 'STAFF' : 'PART_LEAD');
          return a.floor === effFilterVal || a.triadRole === effFilterVal || normAgRole === effFilterVal || effRankAg === effFilterVal;
        })
        .forEach(agent => {
          const card = document.createElement('div');
          card.className = `char-card${agent.id === selectedId ? ' active' : ''}`;
          card.dataset.id = agent.id;
          const cliKey = agent.cliProvider || 'claude';
          const cliLabel = CLI_BADGE_LABELS[cliKey] || cliKey;
          const skillCount = Array.isArray(agent.skills) ? agent.skills.length : 0;
          const plc = getAgentOfficePlacement(agent.id, agent.floor || '1F');
          const agentTeams = teamsArr.filter(t => Array.isArray(t.member_ids) && t.member_ids.includes(agent.id));
          const teamTagHtml = agentTeams.length > 0
            ? `<div style="font-size:8px;font-weight:800;color:${agentTeams[0].color || '#0f6848'};background:${(agentTeams[0].color || '#0f6848')}14;border:1px solid ${(agentTeams[0].color || '#0f6848')}36;padding:1.5px 5px;border-radius:4px;margin-bottom:3px;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">🏢 ${agentTeams[0].name}${agentTeams.length > 1 ? ` +${agentTeams.length - 1}` : ''}</div>`
            : `<div style="font-size:8px;color:#94a3b8;margin-bottom:3px">미배정 팀</div>`;
          const rankLbl = formatOrgRankBadge(agent.orgRank, agent.triadRole);
          card.innerHTML = `
            <div class="char-card-top">
              <span>#${agent.id} · ${rankLbl}</span>
              <span class="char-floor-tag">${plc.floorStr} · #${plc.seatIndex + 1}석</span>
            </div>
            <div class="char-svg-wrap">${CharacterEngine.render(agent, { stance: agent.mapleAnim || 'stand1', animated: false })}</div>
            <div class="char-card-name">${agent.name}</div>
            <div style="font-size:8px;font-weight:800;color:#0369a1;margin-bottom:2px">${escHtml(agent.triadRole || 'PART_BUILD')}</div>
            ${teamTagHtml}
            <span class="char-cli-badge ${cliKey}">${cliLabel} · ⚡${skillCount}</span>
            ${agent.cliModel ? `<div style="font-size:7.5px;font-weight:800;color:#0f6848;margin-bottom:2px;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="실제 실행 모델: ${escHtml(agent.cliModel)}">✨ ${escHtml(agent.cliModel)}</div>` : ''}
            <div class="char-card-code">${formatPartCode(agent.parts, agent)}</div>
          `;
          card.addEventListener('click', () => {
            selectedId = agent.id;
            currentStance = agent.mapleAnim || 'stand1';
            isMotionAnimated = Boolean(agent.mapleAnimated);
            isFlipped = Boolean(agent.mapleFlipped);
            if (selStance) selStance.value = currentStance;
            renderDirectory();
            updateCustomizer();
            updateMapleCardEquippedHighlight();
          });
          gridEl.appendChild(card);
        });
      renderTopRosterAvatars();
    }

    studioRefreshDirectoryFn = () => {
      renderDirectory();
      updateCustomizer();
    };
    studioSelectAgentFn = (aid, scrollIntoStudio = false) => {
      const found = modularAgents.find(a => a.id === aid);
      if (!found) return;
      selectedId = found.id;
      currentStance = found.mapleAnim || 'stand1';
      isMotionAnimated = Boolean(found.mapleAnimated);
      isFlipped = Boolean(found.mapleFlipped);
      if (selStance) selStance.value = currentStance;
      renderDirectory();
      updateCustomizer();
      updateMapleCardEquippedHighlight();
      if (scrollIntoStudio) {
        document.getElementById('characters')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    };

    document.getElementById('btnAddStudioCharacter')?.addEventListener('click', () => {
      if (modularAgents.length >= ALL_AGENT_PRESETS.length) {
        alert(`최대 ${ALL_AGENT_PRESETS.length}명까지 직원을 추가할 수 있습니다.`);
        return;
      }
      const nextAgent = ALL_AGENT_PRESETS[modularAgents.length];
      modularAgents.push(nextAgent);
      selectedId = nextAgent.id;
      syncAgentOfficePlacement(nextAgent.id, nextAgent.floor || '2F', null, true);
      try {
        localStorage.setItem(ACTIVE_AGENT_COUNT_KEY, String(modularAgents.length));
      } catch (_) { }
      renderDirectory();
      updateCustomizer();
      if (window.NEXUS_TEAMS_SUMMARY) renderTeamsAndWorkspacesDashboard(window.NEXUS_TEAMS_SUMMARY);
    });

    function updateMotionButtonUI() {
      if (!btnSimMotionPlay) return;
      if (isMotionAnimated) {
        btnSimMotionPlay.style.background = '#dcfce7';
        btnSimMotionPlay.style.color = '#15803d';
        btnSimMotionPlay.style.borderColor = '#86efac';
        if (simMotionIcon) simMotionIcon.textContent = '⏸';
        if (simMotionLabel) simMotionLabel.textContent = '모션 정지';
      } else {
        btnSimMotionPlay.style.background = '#ecfdf5';
        btnSimMotionPlay.style.color = '#047857';
        btnSimMotionPlay.style.borderColor = '#a7f3d0';
        if (simMotionIcon) simMotionIcon.textContent = '▶';
        if (simMotionLabel) simMotionLabel.textContent = '모션 재생';
      }
    }

    function updateCustomizer() {
      const agent = modularAgents.find(a => a.id === selectedId) || modularAgents[0];
      if (!agent || !stageEl) return;
      if (!agent.mapleEquipped) {
        agent.mapleEquipped = { ...(DEFAULT_MAPLE_EQUIPPED_BY_ID[agent.id] || { skin: 2000, hair: 30000, face: 20000, overall: 1050018, shoes: 1072000, hat: 1002140 }) };
      }

      agent.mapleAnim = currentStance;
      agent.mapleAnimated = isMotionAnimated;
      updateMotionButtonUI();

      // 1. 프리뷰 뷰포트 렌더링 (KMS v389 캐릭터 + 건물 배경 + 동행 펫)
      stageEl.innerHTML = CharacterEngine.render(agent, { stance: currentStance, animated: isMotionAnimated });
      stageEl.className = `customizer-stage stance-${currentStance}${isFlipped ? ' flip-x' : ''}`;
      stageEl.style.transform = `scale(${currentZoom})`;

      // 건물 배경 반영
      if (simBgLayer && simBgImg && simBgBadge) {
        const bId = agent.mapleEquipped.building;
        const bPart = bId ? maplePartById.get(bId) : null;
        if (bPart) {
          simBgLayer.style.display = 'flex';
          simBgImg.src = getMaplePartLocalIcon(bPart);
          simBgBadge.textContent = `🏛️ ${bPart.name}`;
        } else {
          simBgLayer.style.display = 'none';
        }
      }

      // 동행 펫 반영
      if (simPetBox && simPetImg && simPetName) {
        const pId = agent.mapleEquipped.pet;
        const pPart = pId ? maplePartById.get(pId) : null;
        if (pPart) {
          simPetBox.style.display = 'flex';
          simPetImg.src = getMaplePartLocalIcon(pPart);
          simPetName.textContent = `🐾 ${pPart.name}`;
        } else {
          simPetBox.style.display = 'none';
        }
      }

      const cliLabel = CLI_BADGE_LABELS[agent.cliProvider] || agent.cliProvider;
      if (nameEl) nameEl.textContent = `Agent #${agent.id} · ${agent.name}`;
      if (deptEl) deptEl.textContent = `${agent.floor} · ${agent.triadRole} (${cliLabel})`;
      if (pillEl) pillEl.textContent = `${agent.triadRole}/${cliLabel} · ${formatPartCode(agent.parts, agent)}`;
      if (badgeEl) badgeEl.textContent = `#${agent.id}`;

      // 1-2. AI CLI & 팀 · 층 · 좌석 설정 탭 동기화
      const curPlc = getAgentOfficePlacement(agent.id, agent.floor || '1F');
      agent.floor = curPlc.floorStr;
      if (deptEl) deptEl.textContent = `${curPlc.floorStr} · #${curPlc.seatIndex + 1}석 · ${agent.triadRole} (${cliLabel})`;

      if (studioQuickRole) {
        const mappedRole = normalizeAgentPartRoleId(agent.triadRole || 'LEAD');
        if (Array.from(studioQuickRole.options).some(o => o.value === mappedRole)) {
          studioQuickRole.value = mappedRole;
        } else {
          studioQuickRole.value = agent.triadRole || 'LEAD';
        }
      }
      if (studioQuickRank && document.activeElement !== studioQuickRank) {
        const normRole = normalizeAgentPartRoleId(agent.triadRole || 'LEAD');
        const effRank = normRole === 'LEAD' ? 'LEAD' : (agent.orgRank === 'STAFF' ? 'STAFF' : 'PART_LEAD');
        studioQuickRank.value = effRank;
      }
      const provMapNow = (typeof lastDiagnostics !== 'undefined' && lastDiagnostics?.providers) ? lastDiagnostics.providers : null;
      if (provMapNow && Object.keys(provMapNow).length > 0 && !provMapNow[agent.cliProvider]) {
        agent.cliProvider = provMapNow.antigravity ? 'antigravity' : Object.keys(provMapNow)[0];
      }
      if (studioQuickCli) studioQuickCli.value = agent.cliProvider || 'antigravity';
      if (studioAiModelSelect && document.activeElement !== studioAiModelSelect) {
        const provDiag = provMapNow ? (provMapNow[agent.cliProvider] || null) : null;
        const avail = Array.isArray(provDiag?.available_models) ? provDiag.available_models : [];
        const slotDefDisp = provDiag?.selected_model_display || 'CLI 기본값';
        const curAgModel = (agent.cliModel || '').trim();
        const defOpt = `<option value="" ${!curAgModel ? 'selected' : ''}>🔄 계정 기본 실행 모델 따름 (${escHtml(slotDefDisp)})</option>`;
        if (avail.length > 0) {
          const grpMap = new Map();
          avail.forEach(m => {
            const g = m.group || '실제 실행 가능 모델';
            if (!grpMap.has(g)) grpMap.set(g, []);
            grpMap.get(g).push(m);
          });
          const grpHtml = Array.from(grpMap.entries()).map(([gName, items]) => {
            const opts = items.map(m => {
              const isSel = m.id === curAgModel && !m.locked;
              const lk = m.locked ? '🔒 ' : '';
              const lkNote = m.locked && m.lock_reason ? ` — [${m.lock_reason}]` : '';
              return `<option value="${escHtml(m.id)}" ${isSel ? 'selected' : ''} ${m.locked ? 'disabled' : ''}>${lk}${escHtml(m.name)} (${escHtml(m.id)})${escHtml(lkNote)}</option>`;
            }).join('');
            return `<optgroup label="${escHtml(gName)}">${opts}</optgroup>`;
          }).join('');
          studioAiModelSelect.innerHTML = defOpt + grpHtml;
        } else {
          studioAiModelSelect.innerHTML = defOpt + (curAgModel ? `<option value="${escHtml(curAgModel)}" selected>${escHtml(curAgModel)}</option>` : '');
        }
        if (studioAiModelSourceHint) {
          if (provDiag?.models_source === 'agy_live_cli') {
            studioAiModelSourceHint.textContent = `✓ agy.exe 실시간 ${avail.length}종 연동`;
          } else if (avail.length > 0) {
            studioAiModelSourceHint.textContent = `✓ 실행 가능 모델 ${avail.length}종`;
          } else {
            studioAiModelSourceHint.textContent = provDiag?.auth_state === 'LOGGED_IN' ? '기본 모델 사용' : '미로그인 계정';
          }
        }
      }
      if (studioAiNameInput && document.activeElement !== studioAiNameInput) studioAiNameInput.value = agent.name || '';
      if (studioAiFloorSelect) studioAiFloorSelect.value = curPlc.floorStr;
      if (studioAiSeatSelect) studioAiSeatSelect.value = String(curPlc.seatIndex);
      if (studioAiTeamSelect) {
        const tsTeams = (window.NEXUS_TEAMS_SUMMARY && Array.isArray(window.NEXUS_TEAMS_SUMMARY.teams))
          ? window.NEXUS_TEAMS_SUMMARY.teams
          : [];
        const belongTeam = tsTeams.find(t => Array.isArray(t.member_ids) && t.member_ids.includes(agent.id));
        studioAiTeamSelect.innerHTML = [
          `<option value="" ${!belongTeam ? 'selected' : ''}>— 미배정 (독립 직원) —</option>`,
          ...tsTeams.map(t => `<option value="${t.id}" ${belongTeam && belongTeam.id === t.id ? 'selected' : ''}>🏢 [${t.floor}] ${t.name}</option>`),
          `<option value="__create_new_team__">➕ 새 팀 추가 후 배정...</option>`
        ].join('');
      }
      if (studioAiSandboxSelect) studioAiSandboxSelect.value = agent.sandboxMode || 'read-only';
      if (studioAiTimeoutSelect && document.activeElement !== studioAiTimeoutSelect) {
        const tv = (!agent.timeoutSec || String(agent.timeoutSec).toLowerCase() === 'auto') ? 'auto' : String(agent.timeoutSec);
        if (!Array.from(studioAiTimeoutSelect.options).some(o => o.value === tv)) {
          const customOpt = document.createElement('option');
          customOpt.value = tv;
          customOpt.textContent = `${tv}초 (사용자 지정)`;
          studioAiTimeoutSelect.appendChild(customOpt);
        }
        studioAiTimeoutSelect.value = tv;
      }
      if (studioAiPromptInput && document.activeElement !== studioAiPromptInput) studioAiPromptInput.value = agent.systemPrompt || '';
      if (studioCharAskInput) studioCharAskInput.placeholder = `${agent.name} (${cliLabel})에게 시험 질문하기...`;

      // 1-3. 캐릭터 장착 스킬 칩 렌더링
      const skillListEl = document.getElementById('studioSkillChipList');
      const skillCountLbl = document.getElementById('studioSkillCountLabel');
      const skills = Array.isArray(agent.skills) ? agent.skills : [];
      if (skillCountLbl) skillCountLbl.textContent = `${skills.length} Skills`;
      if (skillListEl) {
        if (!skills.length) {
          skillListEl.innerHTML = `<span style="font-size:9px;color:#94a3b8">장착된 스킬이 없습니다. 아래 입력창이나 추천 버튼을 눌러 스킬을 추가하세요.</span>`;
        } else {
          skillListEl.innerHTML = skills.map((sk, idx) => `
            <span class="skill-chip">
              <span>⚡ ${sk}</span>
              <button type="button" data-remove-skill="${idx}" title="스킬 제거">✕</button>
            </span>
          `).join('');
          skillListEl.querySelectorAll('[data-remove-skill]').forEach(btn => {
            btn.addEventListener('click', () => {
              const rIdx = Number(btn.dataset.removeSkill);
              updateSelectedAgentAiField(a => {
                if (!Array.isArray(a.skills)) a.skills = [];
                a.skills.splice(rIdx, 1);
              });
            });
          });
        }
      }

      document.querySelectorAll('#studioCliCardGroup .studio-cli-card').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.cliVal === agent.cliProvider);
      });

      // 2. KMS v389 장착 슬롯 목록 렌더링
      renderLayerStack(agent);

      // 3. KMS v389 + AI CLI 통합 JSON 프리셋 코드 생성
      if (codeOutputEl) {
        const presetObj = {
          app: "maples-virtual-office-triad-kms389",
          version: "389.0",
          character: {
            id: `AGENT_${agent.id}`,
            name: agent.name,
            floor: agent.floor,
            dept: agent.dept,
            aiConfig: {
              triadRole: agent.triadRole,
              cliProvider: agent.cliProvider,
              cliModel: agent.cliModel || '',
              cliLabel: cliLabel,
              sandboxMode: agent.sandboxMode,
              timeoutSec: (!agent.timeoutSec || String(agent.timeoutSec).toLowerCase() === 'auto') ? 'auto' : (Number(agent.timeoutSec) || 'auto'),
              skills: Array.isArray(agent.skills) ? agent.skills : [],
              systemPrompt: agent.systemPrompt
            },
            mapleEquipped: agent.mapleEquipped,
            stance: currentStance,
            animated: isMotionAnimated,
            flipped: isFlipped
          }
        };
        codeOutputEl.textContent = JSON.stringify(presetObj, null, 2);
      }
    }

    // [이벤트] 캐릭터 스튜디오 AI CLI & 역할 설정 바인딩
    function updateSelectedAgentAiField(updater) {
      const agent = modularAgents.find(a => a.id === selectedId);
      if (!agent) return;
      updater(agent);
      agent.dept = `${agent.triadRole} · ${CLI_BADGE_LABELS[agent.cliProvider] || agent.cliProvider}`;
      persistCharacterAiConfig(agent);
      renderDirectory();
      updateCustomizer();
    }

    studioQuickRole?.addEventListener('change', async (e) => {
      if (e.target.value === '__add_new_part__') {
        const agent = modularAgents.find(a => a.id === selectedId);
        e.target.value = normalizeAgentPartRoleId(agent?.triadRole || 'LEAD');
        const newName = prompt('새로 추가할 실무 파트 담당 이름을 입력하세요 (예: 디자인·시각화 파트 담당):', '');
        if (!newName || !newName.trim()) return;
        const newInst = prompt('이 파트 담당의 핵심 업무·검증 지침을 입력하세요 (비워두면 자동 생성):', '') || '';
        try {
          const res = await apiFetch('/ops/part-roles', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'add', name: newName.trim(), instruction: newInst.trim() })
          });
          const d = await res.json().catch(() => ({}));
          if (res.ok && d.part_roles) {
            syncPartRolesToDOM(d.part_roles, true);
            const addedId = d.part_roles.added_part?.id || e.target.value;
            updateSelectedAgentAiField(a => { a.triadRole = addedId; });
            saveCharacterConfigsToServer(modularAgents.find(x => x.id === selectedId)).catch(() => { });
          }
        } catch (_) { }
        return;
      }
      updateSelectedAgentAiField(a => {
        a.triadRole = e.target.value;
        if (e.target.value === 'LEAD') a.orgRank = 'LEAD';
        else if (a.orgRank === 'LEAD') a.orgRank = 'PART_LEAD';
      });
      saveCharacterConfigsToServer(modularAgents.find(x => x.id === selectedId)).catch(() => { });
      if (currentPartRoles) syncPartRolesToDOM(currentPartRoles, true);
    });
    studioQuickRank?.addEventListener('change', (e) => {
      const nextRank = e.target.value;
      updateSelectedAgentAiField(a => {
        a.orgRank = nextRank;
        if (nextRank === 'LEAD') a.triadRole = 'LEAD';
        else if (a.triadRole === 'LEAD' || a.triadRole === 'HEAD') a.triadRole = 'PART_RESEARCH';
      });
      saveCharacterConfigsToServer(modularAgents.find(x => x.id === selectedId)).catch(() => { });
      if (currentPartRoles) syncPartRolesToDOM(currentPartRoles, true);
    });
    studioQuickCli?.addEventListener('change', async (e) => {
      if (e.target.value === '__add_new_cli__') {
        const agent = modularAgents.find(a => a.id === selectedId);
        e.target.value = agent?.cliProvider || 'claude';
        await promptAndAddCliSlotFromSelect((addedKey) => {
          updateSelectedAgentAiField(a => { a.cliProvider = addedKey; });
        });
        return;
      }
      updateSelectedAgentAiField(a => {
        a.cliProvider = e.target.value;
        a.cliModel = '';
      });
      saveCharacterConfigsToServer(modularAgents.find(x => x.id === selectedId)).catch(() => { });
    });
    studioAiModelSelect?.addEventListener('change', (e) => {
      const chosenModel = (e.target.value || '').trim();
      updateSelectedAgentAiField(a => { a.cliModel = chosenModel; });
      saveCharacterConfigsToServer(modularAgents.find(x => x.id === selectedId)).catch(() => { });
    });
    document.getElementById('btnStudioRefreshModels')?.addEventListener('click', (e) => {
      if (typeof handleRefreshRealModels === 'function') {
        handleRefreshRealModels(e.currentTarget);
      }
    });
    document.querySelectorAll('#studioCliCardGroup .studio-cli-card').forEach(btn => {
      btn.addEventListener('click', () => {
        updateSelectedAgentAiField(a => {
          a.cliProvider = btn.dataset.cliVal;
          a.cliModel = '';
        });
        saveCharacterConfigsToServer(modularAgents.find(x => x.id === selectedId)).catch(() => { });
      });
    });
    studioAiNameInput?.addEventListener('input', (e) => {
      updateSelectedAgentAiField(a => { a.name = e.target.value.trim() || a.name; });
    });
    studioAiTeamSelect?.addEventListener('change', async (e) => {
      const chosenTid = e.target.value;
      if (chosenTid === '__create_new_team__') {
        updateCustomizer();
        if (window.openTeamBuilderModal) window.openTeamBuilderModal(null);
        return;
      }
      if (typeof assignAgentToTeamAndPlace === 'function') {
        await assignAgentToTeamAndPlace(selectedId, chosenTid, 'move');
      }
    });
    btnStudioEditTeam?.addEventListener('click', () => {
      const tid = studioAiTeamSelect?.value && studioAiTeamSelect.value !== '__create_new_team__'
        ? studioAiTeamSelect.value
        : null;
      if (window.openTeamBuilderModal) window.openTeamBuilderModal(tid || null);
    });
    studioAiFloorSelect?.addEventListener('change', (e) => {
      const placed = syncAgentOfficePlacement(selectedId, e.target.value, null, true);
      updateSelectedAgentAiField(a => { a.floor = placed.floorStr; });
      if (window.NEXUS_TEAMS_SUMMARY && typeof renderAgentsTeamPlacementBoard === 'function') {
        renderAgentsTeamPlacementBoard(window.NEXUS_TEAMS_SUMMARY);
      }
    });
    studioAiSeatSelect?.addEventListener('change', (e) => {
      const curFloor = studioAiFloorSelect?.value || '1F';
      const placed = syncAgentOfficePlacement(selectedId, curFloor, Number(e.target.value), true);
      updateSelectedAgentAiField(a => { a.floor = placed.floorStr; });
      if (window.NEXUS_TEAMS_SUMMARY && typeof renderAgentsTeamPlacementBoard === 'function') {
        renderAgentsTeamPlacementBoard(window.NEXUS_TEAMS_SUMMARY);
      }
    });
    studioAiSandboxSelect?.addEventListener('change', (e) => {
      updateSelectedAgentAiField(a => { a.sandboxMode = e.target.value; });
      saveCharacterConfigsToServer(modularAgents.find(x => x.id === selectedId)).catch(() => { });
    });
    studioAiTimeoutSelect?.addEventListener('change', (e) => {
      updateSelectedAgentAiField(a => { a.timeoutSec = e.target.value || 'auto'; });
      saveCharacterConfigsToServer(modularAgents.find(x => x.id === selectedId)).catch(() => { });
    });
    studioAiPromptInput?.addEventListener('input', (e) => {
      updateSelectedAgentAiField(a => { a.systemPrompt = e.target.value; });
    });

    // 페르소나 프리셋 칩 클릭 시 자동 입력
    document.querySelectorAll('#studioPersonaPresetBar .persona-preset-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.persona;
        const tpl = PERSONA_TEMPLATES[key];
        if (!tpl) return;
        updateSelectedAgentAiField(a => {
          a.systemPrompt = tpl;
          if (studioAiPromptInput) studioAiPromptInput.value = tpl;
        });
      });
    });

    // 스킬 추가 함수 및 이벤트 바인딩
    function addSkillToSelectedAgent(rawSkill) {
      const sk = (rawSkill || '').trim();
      if (!sk) return;
      updateSelectedAgentAiField(a => {
        if (!Array.isArray(a.skills)) a.skills = [];
        if (!a.skills.includes(sk)) a.skills.push(sk);
      });
    }

    const studioSkillInput = document.getElementById('studioSkillInput');
    document.getElementById('btnAddStudioSkill')?.addEventListener('click', () => {
      if (!studioSkillInput) return;
      addSkillToSelectedAgent(studioSkillInput.value);
      studioSkillInput.value = '';
    });
    studioSkillInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addSkillToSelectedAgent(studioSkillInput.value);
        studioSkillInput.value = '';
      }
    });
    document.querySelectorAll('#studioSkillPresetBar .skill-preset-btn').forEach(btn => {
      btn.addEventListener('click', () => addSkillToSelectedAgent(btn.dataset.skill));
    });

    btnSaveCharAiConfig?.addEventListener('click', async () => {
      const agent = modularAgents.find(a => a.id === selectedId);
      if (!agent) return;
      persistCharacterAiConfig(agent);
      const orig = btnSaveCharAiConfig.textContent;
      btnSaveCharAiConfig.textContent = '✓ 저장 완료 (오피스 연동됨)';
      try {
        await fetch('/ops/character-config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ configs: savedCharAiConfigs })
        });
      } catch (_) { }
      setTimeout(() => { btnSaveCharAiConfig.textContent = orig; }, 1500);
    });

    btnApplyCharToGlobalRole?.addEventListener('click', () => {
      const agent = modularAgents.find(a => a.id === selectedId);
      if (!agent) return;
      const roleKey = (agent.triadRole || 'HEAD').toLowerCase().replace('-', '_');
      if (!['head', 'builder', 'sub_builder', 'reviewer', 'researcher'].includes(roleKey)) {
        alert('전역 오케스트레이터 역할 반영은 HEAD, BUILDER, SUB-BUILDER, REVIEWER, RESEARCHER 역할일 때 적용됩니다.');
        return;
      }
      const sel = document.querySelector(`[data-role-select="${roleKey}"]`);
      if (sel) {
        sel.value = agent.cliProvider;
        sel.dispatchEvent(new Event('change'));
      }
      const orig = btnApplyCharToGlobalRole.textContent;
      btnApplyCharToGlobalRole.textContent = `✓ 전역 ${agent.triadRole}=${CLI_BADGE_LABELS[agent.cliProvider]} 반영됨`;
      setTimeout(() => { btnApplyCharToGlobalRole.textContent = orig; }, 1600);
    });

    studioCharAskForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const agent = modularAgents.find(a => a.id === selectedId);
      const q = (studioCharAskInput?.value || '').trim();
      if (!agent || !q) return;
      studioCharAskInput.value = '';
      if (studioCharAskBtn) { studioCharAskBtn.disabled = true; studioCharAskBtn.textContent = '응답 중...'; }
      if (studioCharAskReply) {
        studioCharAskReply.style.display = 'block';
        studioCharAskReply.textContent = `💭 [${agent.name} · ${CLI_BADGE_LABELS[agent.cliProvider]}] 질문에 대한 답변을 생성하고 있습니다...`;
      }
      try {
        const res = await fetch('/ops/cli-ask', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cli: (agent.triadRole || 'head').toLowerCase(),
            agent_name: agent.name,
            custom_cli: agent.cliProvider,
            custom_model: agent.cliModel || '',
            system_prompt: agent.systemPrompt,
            skills: Array.isArray(agent.skills) ? agent.skills : [],
            question: q
          })
        });
        if (res.ok) {
          const data = await res.json();
          if (studioCharAskReply) {
            studioCharAskReply.textContent = `💬 [${data.label || agent.name}] ${data.answer || ''} (${data.seconds || 1}초)`;
          }
        }
      } catch (_) {
        if (studioCharAskReply) {
          studioCharAskReply.textContent = `💬 [${agent.name} · ${CLI_BADGE_LABELS[agent.cliProvider]}] '${q}' 질문을 확인했습니다!`;
        }
      } finally {
        if (studioCharAskBtn) { studioCharAskBtn.disabled = false; studioCharAskBtn.textContent = '💬 시험 질문 ↗'; }
      }
    });

    // ========================================================================
    // KMS v389 21개 장착 슬롯 목록 렌더링
    // ========================================================================
    function renderLayerStack(agent) {
      if (!layerListEl) return;
      const eq = agent.mapleEquipped || {};
      const equippedKeys = Object.keys(eq)
        .filter(k => eq[k] !== null && eq[k] !== undefined && eq[k] !== '')
        .sort((a, b) => ((SLOT_INFO[a]?.order || 99) - (SLOT_INFO[b]?.order || 99)));

      if (simEquippedCountEl) simEquippedCountEl.textContent = String(equippedKeys.length);

      if (equippedKeys.length === 0) {
        layerListEl.innerHTML = `<div style="padding:18px;text-align:center;color:#94a3b8;font-size:10px">현재 장착된 파츠가 없습니다. 상단 카테고리 탭에서 파츠를 클릭해 장착해 보세요.</div>`;
        return;
      }

      layerListEl.innerHTML = '';
      equippedKeys.forEach(slotKey => {
        const itemId = eq[slotKey];
        const slotDef = SLOT_INFO[slotKey] || { label: slotKey, icon: '✨' };
        const part = maplePartById.get(itemId);
        const nameText = part ? part.name : `아이템 #${itemId}`;
        const localIcon = part ? getMaplePartLocalIcon(part) : '';

        let thumbHtml = `<span>${slotDef.icon}</span>`;
        if (slotKey === 'skin') {
          const bg = SKIN_COLORS[itemId] || (part && part.color) || '#fcd7b6';
          const skinImg = localIcon || `character-images/images/skin/${itemId}.png`;
          thumbHtml = `<span style="position:relative;display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px"><img src="${skinImg}" alt="${nameText}" style="width:22px;height:22px;object-fit:contain;image-rendering:pixelated" onerror="this.style.display='none'" /><span style="position:absolute;right:-2px;bottom:-2px;width:9px;height:9px;border-radius:50%;background:${bg};border:1px solid #334155"></span></span>`;
        } else if (part) {
          thumbHtml = `<img src="${localIcon}" alt="${nameText}" style="width:22px;height:22px;object-fit:contain;image-rendering:pixelated" onerror="this.src='character-images/0.png'" />`;
        }

        const row = document.createElement('div');
        row.className = 'layer-row';
        row.innerHTML = `
          <div class="layer-info" style="display:flex;align-items:center;gap:7px">
            ${thumbHtml}
            <span class="layer-tag">${slotDef.label}</span>
            <span class="layer-name" title="${nameText} (#${itemId})">${nameText} <small style="color:#94a3b8">#${itemId}</small></span>
          </div>
          <div class="layer-actions">
            ${slotKey !== 'skin' ? `<button type="button" class="layer-btn btn-remove-layer" title="${nameText} 해제">✕</button>` : ''}
          </div>
        `;
        row.querySelector('.btn-remove-layer')?.addEventListener('click', () => {
          delete agent.mapleEquipped[slotKey];
          if (slotKey === 'furniture') {
            currentStance = 'stand1';
            if (selStance) selStance.value = 'stand1';
          }
          persistCharacterAiConfig(agent);
          renderDirectory();
          updateCustomizer();
          updateMapleCardEquippedHighlight();
        });
        layerListEl.appendChild(row);
      });
    }

    btnUnequipAllMaple?.addEventListener('click', () => {
      const agent = modularAgents.find(a => a.id === selectedId);
      if (!agent) return;
      agent.mapleEquipped = { skin: 2000 };
      currentStance = 'stand1';
      if (selStance) selStance.value = 'stand1';
      persistCharacterAiConfig(agent);
      renderDirectory();
      updateCustomizer();
      updateMapleCardEquippedHighlight();
    });

    // ========================================================================
    // KMS v389 29,491개 파츠 브라우저 렌더링 & 장착 토글
    // ========================================================================
    function toggleEquipMaplePart(part) {
      const agent = modularAgents.find(a => a.id === selectedId);
      if (!agent || !part) return;
      if (!agent.mapleEquipped) agent.mapleEquipped = { skin: 2000 };

      const slot = getMapleItemSlot(part);
      const isCurrentlyEquipped = agent.mapleEquipped[slot] === part.id;

      if (isCurrentlyEquipped) {
        if (slot === 'skin') return;
        delete agent.mapleEquipped[slot];
        if (slot === 'furniture') {
          currentStance = 'stand1';
          if (selStance) selStance.value = 'stand1';
        }
      } else {
        if (slot === 'overall') {
          delete agent.mapleEquipped.top;
          delete agent.mapleEquipped.bottom;
        } else if (slot === 'top' || slot === 'bottom') {
          delete agent.mapleEquipped.overall;
        }
        agent.mapleEquipped[slot] = part.id;
        if (slot === 'furniture') {
          currentStance = 'sit';
          if (selStance) selStance.value = 'sit';
        }
      }

      persistCharacterAiConfig(agent);
      renderDirectory();
      updateCustomizer();
      updateMapleCardEquippedHighlight();
    }

    function updateMapleCardEquippedHighlight() {
      if (!mapleSimPartsGrid) return;
      const agent = modularAgents.find(a => a.id === selectedId);
      const equippedIds = new Set(Object.values(agent?.mapleEquipped || {}));
      mapleSimPartsGrid.querySelectorAll('.maples-item-card').forEach(card => {
        const pid = Number(card.dataset.mapleId);
        card.classList.toggle('active', equippedIds.has(pid));
      });
    }

    function renderMapleSubFilters() {
      if (!mapleSimSubFilters) return;
      const subCats = new Set();
      // 'all'(전체) 탭일 때는 건물/공간(building) 지역명이 파츠 서브필터에 섞이지 않도록 제외하고, 요청된 10개 제외 항목도 원천 차단
      const targetParts = mapleBrowserState.category === 'all'
        ? allMapleParts.filter(p => p.category !== 'building')
        : allMapleParts.filter(p => p.category === mapleBrowserState.category);
      targetParts.forEach(p => {
        const sub = (p.subCategory || '').trim();
        if (!sub || EXCLUDED_MAPLE_SET.has(sub)) return;
        if (EXCLUDED_MAPLE_TERMS.some(term => sub.includes(term))) return;
        subCats.add(sub);
      });

      if (subCats.size <= 1) {
        mapleSimSubFilters.innerHTML = '';
        mapleSimSubFilters.style.display = 'none';
        return;
      }
      mapleSimSubFilters.style.display = 'flex';

      let html = `<button type="button" class="persona-preset-chip ${mapleBrowserState.subCategory === 'all' ? 'active' : ''}" data-sub="all" style="${mapleBrowserState.subCategory === 'all' ? 'background:#ea580c;color:#fff;border-color:#ea580c' : ''}">전체</button>`;
      Array.from(subCats).slice(0, 25).forEach(sub => {
        const isOn = mapleBrowserState.subCategory === sub;
        html += `<button type="button" class="persona-preset-chip" data-sub="${sub}" style="${isOn ? 'background:#ea580c;color:#fff;border-color:#ea580c' : ''}">${sub}</button>`;
      });
      mapleSimSubFilters.innerHTML = html;
      mapleSimSubFilters.querySelectorAll('[data-sub]').forEach(btn => {
        btn.addEventListener('click', () => {
          mapleBrowserState.subCategory = btn.dataset.sub;
          renderMapleSubFilters();
          filterMapleParts();
        });
      });
    }

    function renderMaplePartsChunk() {
      if (!mapleSimPartsGrid) return;
      const agent = modularAgents.find(a => a.id === selectedId);
      const equippedIds = new Set(Object.values(agent?.mapleEquipped || {}));
      const start = (mapleBrowserState.currentPage - 1) * mapleBrowserState.pageSize;
      const end = start + mapleBrowserState.pageSize;
      const chunk = mapleBrowserState.filtered.slice(start, end);

      const frag = document.createDocumentFragment();
      chunk.forEach(part => {
        const isEq = equippedIds.has(part.id);
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `maples-item-card${isEq ? ' active' : ''}`;
        btn.dataset.mapleId = String(part.id);

        let iconHtml = '';
        if (part.category === 'skin') {
          const bg = SKIN_COLORS[part.id] || part.color || '#fcd7b6';
          const localSrc = getMaplePartLocalIcon(part);
          iconHtml = `<span style="position:relative;display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px"><img src="${localSrc}" alt="${part.name}" loading="lazy" style="width:30px;height:30px;object-fit:contain;image-rendering:pixelated" onerror="this.style.display='none'" /><span style="position:absolute;right:-2px;bottom:-2px;width:11px;height:11px;border-radius:50%;background:${bg};border:1.5px solid #334155;box-shadow:0 1px 2px rgba(0,0,0,0.2)"></span></span>`;
        } else {
          const localSrc = getMaplePartLocalIcon(part);
          iconHtml = `<img src="${localSrc}" alt="${part.name}" loading="lazy" style="width:32px;height:32px;object-fit:contain;image-rendering:pixelated" onerror="this.src='character-images/0.png'" />`;
        }

        btn.innerHTML = `
          <div class="sim-part-icon-box">${iconHtml}</div>
          <span class="item-title" title="${part.name}">${part.name}</span>
          <span class="item-code">${part.subCategory || part.category} · #${part.id}</span>
        `;
        btn.addEventListener('click', () => toggleEquipMaplePart(part));
        frag.appendChild(btn);
      });

      mapleSimPartsGrid.appendChild(frag);

      const displayed = Math.min(end, mapleBrowserState.filtered.length);
      if (mapleSimLoadMoreWrap) {
        if (displayed < mapleBrowserState.filtered.length) {
          mapleSimLoadMoreWrap.style.display = 'flex';
          if (mapleSimLoadMoreInfo) {
            mapleSimLoadMoreInfo.textContent = `표시 중: ${displayed.toLocaleString()} / 전체 ${mapleBrowserState.filtered.length.toLocaleString()}개`;
          }
        } else {
          mapleSimLoadMoreWrap.style.display = 'none';
        }
      }
    }

    function filterMapleParts() {
      if (!mapleSimPartsGrid) return;
      mapleBrowserState.currentPage = 1;
      const q = mapleBrowserState.searchQuery.toLowerCase();
      const agent = modularAgents.find(a => a.id === selectedId);
      const equippedIds = new Set(Object.values(agent?.mapleEquipped || {}));

      mapleBrowserState.filtered = allMapleParts.filter(p => {
        if (mapleBrowserState.category !== 'all' && p.category !== mapleBrowserState.category) return false;
        if (mapleBrowserState.subCategory !== 'all' && p.subCategory !== mapleBrowserState.subCategory) return false;
        if (q) {
          const matchName = (p.name || '').toLowerCase().includes(q);
          const matchId = String(p.id).includes(q);
          const matchSub = (p.subCategory || '').toLowerCase().includes(q);
          if (!matchName && !matchId && !matchSub) return false;
        }
        if (mapleBrowserState.onlyEquipped && !equippedIds.has(p.id)) return false;
        return true;
      });

      if (mapleSimCategoryTitle) {
        mapleSimCategoryTitle.textContent = CATEGORY_NAMES[mapleBrowserState.category] || '아이템 목록';
      }
      if (mapleSimResultCount) {
        mapleSimResultCount.textContent = `${mapleBrowserState.filtered.length.toLocaleString()} Items`;
      }

      mapleSimPartsGrid.innerHTML = '';
      if (mapleBrowserState.filtered.length === 0) {
        mapleSimPartsGrid.innerHTML = `<div style="grid-column:1/-1;padding:24px;text-align:center;color:#94a3b8;font-size:10.5px">🔍 조건에 맞는 KMS v389 파츠가 없습니다.</div>`;
        if (mapleSimLoadMoreWrap) mapleSimLoadMoreWrap.style.display = 'none';
        return;
      }
      renderMaplePartsChunk();
    }

    btnMapleSimLoadMore?.addEventListener('click', () => {
      if (mapleBrowserState.currentPage * mapleBrowserState.pageSize < mapleBrowserState.filtered.length) {
        mapleBrowserState.currentPage++;
        renderMaplePartsChunk();
      }
    });

    mapleSimPartsGrid?.addEventListener('scroll', () => {
      if (mapleSimPartsGrid.scrollTop + mapleSimPartsGrid.clientHeight >= mapleSimPartsGrid.scrollHeight - 120) {
        if (mapleBrowserState.currentPage * mapleBrowserState.pageSize < mapleBrowserState.filtered.length) {
          mapleBrowserState.currentPage++;
          renderMaplePartsChunk();
        }
      }
    });

    let mapleSearchTimer = null;
    mapleSimSearchInput?.addEventListener('input', (e) => {
      clearTimeout(mapleSearchTimer);
      mapleSearchTimer = setTimeout(() => {
        mapleBrowserState.searchQuery = (e.target.value || '').trim();
        if (btnMapleSimClearSearch) btnMapleSimClearSearch.style.display = mapleBrowserState.searchQuery ? 'block' : 'none';
        filterMapleParts();
      }, 140);
    });

    btnMapleSimClearSearch?.addEventListener('click', () => {
      if (mapleSimSearchInput) mapleSimSearchInput.value = '';
      mapleBrowserState.searchQuery = '';
      btnMapleSimClearSearch.style.display = 'none';
      filterMapleParts();
    });

    mapleSimOnlyEquipped?.addEventListener('change', (e) => {
      mapleBrowserState.onlyEquipped = e.target.checked;
      filterMapleParts();
    });

    // [이벤트] 캐릭터 시뮬레이터 파츠 카테고리 탭 전환
    document.querySelectorAll('.maples-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const parentBar = tab.closest('.maples-tab-bar');
        if (parentBar) {
          parentBar.querySelectorAll('.maples-tab').forEach(t => t.classList.remove('active'));
        } else {
          document.querySelectorAll('.maples-tab').forEach(t => t.classList.remove('active'));
        }
        tab.classList.add('active');
        if (tab.dataset.tab) {
          const targetPanel = document.getElementById(tab.dataset.tab);
          if (targetPanel) targetPanel.classList.add('active');
        }
        if (tab.dataset.mapleCat) {
          mapleBrowserState.category = tab.dataset.mapleCat;
          mapleBrowserState.subCategory = 'all';
          renderMapleSubFilters();
          filterMapleParts();
        }
      });
    });

    // [이벤트] 방향 좌우 반전
    btnFlipDir?.addEventListener('click', () => {
      isFlipped = !isFlipped;
      const agent = modularAgents.find(a => a.id === selectedId);
      if (agent) {
        agent.mapleFlipped = isFlipped;
        persistCharacterAiConfig(agent);
      }
      renderDirectory();
      updateCustomizer();
    });

    // [이벤트] 모션/스탠스 변경
    selStance?.addEventListener('change', (e) => {
      currentStance = e.target.value;
      const agent = modularAgents.find(a => a.id === selectedId);
      if (agent && currentStance !== 'sit' && agent.mapleEquipped?.furniture) {
        delete agent.mapleEquipped.furniture;
      }
      if (agent) persistCharacterAiConfig(agent);
      renderDirectory();
      updateCustomizer();
    });

    // [이벤트] ▶ 모션 재생 / ⏸ 정지 토글
    btnSimMotionPlay?.addEventListener('click', () => {
      isMotionAnimated = !isMotionAnimated;
      const agent = modularAgents.find(a => a.id === selectedId);
      if (agent) {
        agent.mapleAnimated = isMotionAnimated;
        persistCharacterAiConfig(agent);
      }
      updateCustomizer();
    });

    // [이벤트] 줌 배율 (기본 1x 크기를 기존 2배율 크기인 1.8로 상향)
    document.querySelectorAll('.zoom-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.zoom-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentZoom = parseFloat(btn.dataset.zoom || '1.8');
        updateCustomizer();
      });
    });

    // [이벤트] 배경 전환
    btnBackdrop?.addEventListener('click', () => {
      if (!canvasArea) return;
      canvasArea.classList.remove(...backdrops);
      backdropIdx = (backdropIdx + 1) % backdrops.length;
      canvasArea.classList.add(backdrops[backdropIdx]);
    });

    // [이벤트] 🎲 랜덤 코디 생성 (29,218개 KMS v389 파츠 무작위 조합)
    btnRandomize?.addEventListener('click', () => {
      const agent = modularAgents.find(a => a.id === selectedId);
      if (!agent || !allMapleParts.length) return;
      const pickRandom = (cat, sub = null) => {
        const items = allMapleParts.filter(p => p.category === cat && (!sub || p.subCategory === sub));
        if (!items.length) return null;
        return items[Math.floor(Math.random() * items.length)].id;
      };
      const shouldChair = Math.random() < 0.25;
      const nextEq = {
        skin: pickRandom('skin') || 2000,
        hair: pickRandom('hair'),
        face: pickRandom('face'),
        overall: pickRandom('clothes', 'Overall'),
        shoes: pickRandom('shoes'),
        hat: pickRandom('accessories', 'Hat'),
        cape: pickRandom('accessories', 'Cape'),
        faceAccessory: pickRandom('accessories', 'Face Accessory'),
        furniture: shouldChair ? pickRandom('furniture') : null,
        pet: pickRandom('pet', 'Pet')
      };
      Object.keys(nextEq).forEach(k => { if (!nextEq[k]) delete nextEq[k]; });
      agent.mapleEquipped = nextEq;
      currentStance = nextEq.furniture ? 'sit' : 'stand1';
      if (selStance) selStance.value = currentStance;
      persistCharacterAiConfig(agent);
      renderDirectory();
      updateCustomizer();
      updateMapleCardEquippedHighlight();
    });

    // [이벤트] ⭐ 기본 코디 로드
    btnLoadDefault?.addEventListener('click', () => {
      const agent = modularAgents.find(a => a.id === selectedId);
      if (!agent) return;
      agent.mapleEquipped = { ...(DEFAULT_MAPLE_EQUIPPED_BY_ID[agent.id] || { skin: 2000, hair: 30000, face: 20000, overall: 1050018, shoes: 1072000, hat: 1002140 }) };
      currentStance = 'stand1';
      if (selStance) selStance.value = 'stand1';
      persistCharacterAiConfig(agent);
      renderDirectory();
      updateCustomizer();
      updateMapleCardEquippedHighlight();
    });

    // [이벤트] 🔄 초기화
    btnResetParts?.addEventListener('click', () => {
      const agent = modularAgents.find(a => a.id === selectedId);
      if (!agent) return;
      agent.mapleEquipped = { skin: 2000, hair: 30000, face: 20000, overall: 1050018, shoes: 1072000, hat: 1002140 };
      currentStance = 'stand1';
      isMotionAnimated = false;
      isFlipped = false;
      agent.mapleFlipped = false;
      if (selStance) selStance.value = 'stand1';
      persistCharacterAiConfig(agent);
      renderDirectory();
      updateCustomizer();
      updateMapleCardEquippedHighlight();
    });

    // [이벤트] 💾 캐릭터 시뮬레이터 코디 저장 & 오피스 적용 (개별 / 전체)
    const btnSaveSimCharacter = document.getElementById('btnSaveSimCharacter');
    const btnSaveAllSimCharacters = document.getElementById('btnSaveAllSimCharacters');
    const simSaveStatusBanner = document.getElementById('simSaveStatusBanner');
    const simSaveStatusText = document.getElementById('simSaveStatusText');

    btnSaveSimCharacter?.addEventListener('click', async () => {
      const agent = modularAgents.find(a => a.id === selectedId);
      if (!agent) return;
      agent.mapleAnim = currentStance;
      agent.mapleAnimated = isMotionAnimated;
      agent.mapleFlipped = isFlipped;
      const origLabel = btnSaveSimCharacter.innerHTML;
      btnSaveSimCharacter.disabled = true;
      btnSaveSimCharacter.textContent = '⏳ 저장 및 적용 중...';

      await saveCharacterConfigsToServer(agent);
      renderDirectory();
      updateCustomizer();

      const slotCnt = Object.keys(agent.mapleEquipped || {}).length;
      btnSaveSimCharacter.textContent = `✓ #${agent.id} ${agent.name} 코디 적용 완료!`;
      if (simSaveStatusBanner) simSaveStatusBanner.classList.add('saved');
      if (simSaveStatusText) {
        simSaveStatusText.innerHTML = `<strong>✓ 저장 완료:</strong> <strong>#${agent.id} ${agent.name}</strong>의 KMS v389 파츠(${slotCnt}슬롯 · 모션: ${currentStance})가 <strong>AI 직원 디렉토리 · 서버 · <a href="office.html" style="color:#047857;text-decoration:underline">가상 오피스 ↗</a></strong>에 즉시 적용되었습니다.`;
      }
      setTimeout(() => {
        btnSaveSimCharacter.disabled = false;
        btnSaveSimCharacter.innerHTML = origLabel;
      }, 1800);
    });

    btnSaveAllSimCharacters?.addEventListener('click', async () => {
      const agent = modularAgents.find(a => a.id === selectedId);
      if (agent) {
        agent.mapleAnim = currentStance;
        agent.mapleAnimated = isMotionAnimated;
        agent.mapleFlipped = isFlipped;
      }
      const origLabel = btnSaveAllSimCharacters.innerHTML;
      btnSaveAllSimCharacters.disabled = true;
      btnSaveAllSimCharacters.textContent = '⏳ 저장 중...';

      await saveCharacterConfigsToServer(null);
      renderDirectory();
      updateCustomizer();

      btnSaveAllSimCharacters.textContent = `✓ 전체 ${modularAgents.length}명 저장됨`;
      if (simSaveStatusBanner) simSaveStatusBanner.classList.add('saved');
      if (simSaveStatusText) {
        simSaveStatusText.innerHTML = `<strong>✓ 전체 일괄 저장 완료:</strong> 등록된 <strong>전체 AI 직원 ${modularAgents.length}명</strong>의 코디 및 설정이 서버(<code>data/character_configs.json</code>)와 <a href="office.html" style="color:#047857;text-decoration:underline">가상 오피스 ↗</a>에 모두 반영되었습니다.`;
      }
      setTimeout(() => {
        btnSaveAllSimCharacters.disabled = false;
        btnSaveAllSimCharacters.innerHTML = origLabel;
      }, 1800);
    });

    window.addEventListener('nexus:character-configs-updated', () => {
      const agent = modularAgents.find(a => a.id === selectedId);
      if (agent) {
        currentStance = agent.mapleAnim || 'stand1';
        isMotionAnimated = Boolean(agent.mapleAnimated);
        isFlipped = Boolean(agent.mapleFlipped);
        if (selStance) selStance.value = currentStance;
      }
      renderDirectory();
      updateCustomizer();
      updateMapleCardEquippedHighlight();
    });

    // [이벤트] 🖼️ 아바타 이미지 다운로드 (PNG / GIF)
    btnExportPng?.addEventListener('click', async () => {
      const imgEl = stageEl?.querySelector('img');
      if (imgEl && imgEl.src) {
        try {
          const res = await fetch(imgEl.src);
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          const ext = isMotionAnimated ? 'gif' : 'png';
          a.href = url;
          a.download = `maple_kms389_agent_${selectedId}_${currentStance}.${ext}`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          return;
        } catch (_) {
          window.open(imgEl.src, '_blank');
          return;
        }
      }
    });

    // [이벤트] JSON 복사
    function copyJsonHandler(btn) {
      if (!codeOutputEl) return;
      navigator.clipboard?.writeText(codeOutputEl.textContent);
      const prev = btn.textContent;
      btn.textContent = '복사됨 ✓';
      setTimeout(() => { btn.textContent = prev; }, 1200);
    }
    copyBtn?.addEventListener('click', () => copyJsonHandler(copyBtn));
    btnCopyJson?.addEventListener('click', () => copyJsonHandler(btnCopyJson));

    floorFilter?.addEventListener('change', renderDirectory);

    // 만약 window.__MAPLE_DATA__가 아직 로드되지 않았을 경우 fetch 폴백
    if (!allMapleParts.length) {
      fetch('character-images/data/parts.json')
        .then(r => r.json())
        .then(data => {
          if (Array.isArray(data)) {
            allMapleParts = data.filter(p => !isExcludedMaplePart(p));
            maplePartById.clear();
            allMapleParts.forEach(p => maplePartById.set(p.id, p));
            updateMapleTabCategoryCounts();
            renderMapleSubFilters();
            filterMapleParts();
            updateCustomizer();
          }
        })
        .catch(() => { });
    } else {
      updateMapleTabCategoryCounts();
      renderMapleSubFilters();
      filterMapleParts();
    }

    renderDirectory();
    updateCustomizer();
  }

  // ==========================================================================
  // [4] agents.html 전체 등록 AI 직원 목록 실시간 동기화 & 구성된 팀·팀원 목록 섹션
  // ==========================================================================
  let activeAgentsRosterFilter = 'all';
  let lastAgentsRosterSig = '';
  let lastConfiguredTeamsSectionSig = '';

  function updateAgentsPageSummaryCards() {
    const statReg = document.getElementById('statRegisteredAgents');
    const statRegSub = document.getElementById('statRegisteredAgentsSub');
    const statTeams = document.getElementById('statConfiguredTeams');
    const statTeamsSub = document.getElementById('statConfiguredTeamsSub');
    const statParts = document.getElementById('statActivePartsValue');
    const statPartsSub = document.getElementById('statActivePartsSub');
    const statToVal = document.getElementById('statTimeoutModeValue');
    const statToSub = document.getElementById('statTimeoutModeSub');

    const leadCnt = modularAgents.filter(a => normalizeAgentPartRoleId(a.triadRole) === 'LEAD' || a.orgRank === 'LEAD').length;
    const pLeadCnt = modularAgents.filter(a => normalizeAgentPartRoleId(a.triadRole) !== 'LEAD' && a.orgRank !== 'LEAD' && a.orgRank !== 'STAFF').length;
    const staffCnt = modularAgents.filter(a => a.orgRank === 'STAFF').length;
    if (statReg) statReg.textContent = String(modularAgents.length).padStart(2, '0');
    if (statRegSub) statRegSub.textContent = `총괄 ${leadCnt} · 파트장 ${pLeadCnt} · 일반사원 ${staffCnt}명`;

    const teamsArr = Array.isArray(window.NEXUS_TEAMS_SUMMARY?.teams) ? window.NEXUS_TEAMS_SUMMARY.teams : [];
    if (statTeams && teamsArr.length > 0) {
      statTeams.innerHTML = `${String(teamsArr.length).padStart(2, '0')} <span style="font-size:12px;color:#98a5b2;font-weight:600">TEAMS</span>`;
    }
    if (statTeamsSub && teamsArr.length > 0) {
      statTeamsSub.textContent = teamsArr.map(t => `${t.name}(${(t.member_ids || []).length}명)`).join(' · ').slice(0, 48);
    }

    const enabledParts = Array.isArray(currentPartRoles?.parts)
      ? currentPartRoles.parts.filter(p => p.enabled !== false)
      : [];
    if (statParts && enabledParts.length > 0) {
      statParts.textContent = String(enabledParts.length).padStart(2, '0');
    }
    if (statPartsSub && enabledParts.length > 0) {
      statPartsSub.textContent = enabledParts.map(p => p.name.replace(' 담당', '')).join(' → ').slice(0, 46);
    }

    const autoCnt = modularAgents.filter(a => !a.timeoutSec || String(a.timeoutSec).toLowerCase() === 'auto').length;
    if (statToVal) statToVal.textContent = autoCnt === modularAgents.length ? 'AUTO' : `AUTO ${autoCnt}/${modularAgents.length}`;
    if (statToSub) statToSub.textContent = `스트림 활동 감지 자동 연장 (${autoCnt}/${modularAgents.length}명 Auto)`;
  }

  function renderConfiguredAgentsRoster(forceRebuild = false) {
    updateAgentsPageSummaryCards();
    const listEl = document.getElementById('agentList');
    const filtersEl = document.getElementById('filters');
    const searchEl = document.getElementById('agentSearch');
    const countEl = document.getElementById('agentCount');
    if (!listEl) return;

    const teamsArr = Array.isArray(window.NEXUS_TEAMS_SUMMARY?.teams) ? window.NEXUS_TEAMS_SUMMARY.teams : [];
    const partsList = Array.isArray(currentPartRoles?.parts) ? currentPartRoles.parts : [];
    const workingIds = new Set(
      Array.isArray(latestActivitySnapshot?.working_now)
        ? latestActivitySnapshot.working_now.map(w => String(w.agent_id || '').padStart(2, '0'))
        : []
    );

    const rosterSig = JSON.stringify([
      modularAgents.map(a => [a.id, a.name, a.triadRole, a.orgRank, a.cliProvider, a.cliModel, a.timeoutSec, a.floor, a.skills]),
      teamsArr.map(t => [t.id, t.name, t.floor, t.color, t.member_ids]),
      partsList.map(p => [p.id, p.name, p.icon]),
      Array.from(workingIds)
    ]);

    if (forceRebuild || rosterSig !== lastAgentsRosterSig || !listEl.querySelector('.agent-card-row')) {
      lastAgentsRosterSig = rosterSig;

      // 1) Dynamic Filter Chips (#filters)
      if (filtersEl) {
        const chipDefs = [
          { key: 'all', label: `전체 (${modularAgents.length})` },
          { key: 'RANK_LEAD', label: '👑 총괄팀장' },
          { key: 'RANK_PART_LEAD', label: '⭐ 파트장' },
          { key: 'RANK_STAFF', label: '👤 일반사원' },
          ...partsList.map(p => ({ key: p.id, label: `${p.icon || '🧩'} ${p.name.replace(' 담당', '')}` })),
          ...teamsArr.map(t => ({ key: `TEAM_${t.id}`, label: `🏢 ${t.name}` }))
        ];
        if (!chipDefs.some(c => c.key === activeAgentsRosterFilter)) {
          activeAgentsRosterFilter = 'all';
        }
        filtersEl.innerHTML = chipDefs.map(c =>
          `<button type="button" class="filter-chip ${c.key === activeAgentsRosterFilter ? 'active' : ''}" data-filter="${escHtml(c.key)}">${escHtml(c.label)}</button>`
        ).join('');
        filtersEl.querySelectorAll('.filter-chip').forEach(chip => {
          chip.addEventListener('click', () => {
            activeAgentsRosterFilter = chip.dataset.filter || 'all';
            filtersEl.querySelectorAll('.filter-chip').forEach(x => x.classList.toggle('active', x === chip));
            applyAgentsRosterFilter();
          });
        });
      }

      // 2) Render all configured employees (#01..#N) accurately matching character_configs.json
      const rankWeight = { LEAD: 0, PART_LEAD: 1, STAFF: 2 };
      const sortedAgents = [...modularAgents].sort((a, b) => {
        const numA = parseInt(a.id, 10) || 99;
        const numB = parseInt(b.id, 10) || 99;
        return numA - numB;
      });

      listEl.innerHTML = sortedAgents.map(ag => {
        const canonRole = normalizeAgentPartRoleId(ag.triadRole);
        const effRank = canonRole === 'LEAD' ? 'LEAD' : (ag.orgRank === 'STAFF' ? 'STAFF' : 'PART_LEAD');
        const rankLabel = formatOrgRankBadge(effRank, canonRole);
        const partLabel = getPartRoleDisplayLabel(canonRole);
        const cliKey = ag.cliProvider || 'antigravity_sdk';
        const cliLabel = CLI_BADGE_LABELS[cliKey] || cliKey;
        const modelStr = ag.cliModel || '계정 기본 모델';
        const timeoutBadge = formatAgentTimeoutBadge(ag.timeoutSec);
        const belongTeams = teamsArr.filter(t => Array.isArray(t.member_ids) && t.member_ids.includes(ag.id));
        const teamBadgesHtml = belongTeams.length
          ? belongTeams.map(t => `<span style="display:inline-flex;align-items:center;padding:1.5px 7px;border-radius:999px;background:${escHtml(t.color || '#0f6848')}15;color:${escHtml(t.color || '#0f6848')};border:1px solid ${escHtml(t.color || '#0f6848')}40;font-size:9.5px;font-weight:800">🏢 ${escHtml(t.floor)} · ${escHtml(t.name)}</span>`).join(' ')
          : `<span style="display:inline-flex;padding:1.5px 7px;border-radius:999px;background:#f1f5f9;color:#64748b;font-size:9.5px;font-weight:700">팀 미배정</span>`;
        const skillsArr = Array.isArray(ag.skills) ? ag.skills : [];
        const skillsTxt = skillsArr.length ? `⚡ ${skillsArr.join(' · ')}` : (ag.systemPrompt || '').slice(0, 70);
        const isWorkingNow = workingIds.has(String(ag.id).padStart(2, '0'));
        const plc = getAgentOfficePlacement(ag.id, ag.floor || '1F');
        const searchBlob = [
          ag.id, `#${ag.id}`, ag.name, rankLabel, partLabel, canonRole, cliKey, cliLabel, modelStr,
          ...skillsArr, ...belongTeams.map(t => t.name)
        ].join(' ').toLowerCase();

        return `
          <div class="agent-card-row" data-aid="${escHtml(ag.id)}" data-role="${escHtml(canonRole)}" data-rank="${escHtml(effRank)}" data-teams="${escHtml(belongTeams.map(t => t.id).join(','))}" data-name="${escHtml(searchBlob)}" data-status="${isWorkingNow ? 'running' : 'ready'}">
            <div class="agent-cell">
              <div class="agent-avatar" style="overflow:hidden;padding:1px;background:#f8fafc;border:1px solid #e2e8f0">${CharacterEngine.render(ag, { stance: ag.mapleAnim || 'stand1', animated: false })}</div>
              <div>
                <div class="agent-name" style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
                  <span>#${escHtml(ag.id)} ${escHtml(ag.name)}</span>
                  <span style="font-size:9.5px;padding:1.5px 6px;border-radius:5px;background:${effRank === 'LEAD' ? '#fef3c7' : (effRank === 'PART_LEAD' ? '#e0f2fe' : '#f1f5f9')};color:${effRank === 'LEAD' ? '#92400e' : (effRank === 'PART_LEAD' ? '#0369a1' : '#334155')};font-weight:800">${escHtml(rankLabel)}</span>
                </div>
                <div class="agent-type" style="display:flex;align-items:center;gap:5px;flex-wrap:wrap;margin-top:3px">
                  <span style="font-weight:700;color:#0f6848">${escHtml(partLabel)}</span>
                  <span>·</span>
                  <span>${escHtml(plc.floorStr)} #${plc.seatIndex + 1}석</span>
                  <span>·</span>
                  ${teamBadgesHtml}
                </div>
              </div>
            </div>
            <div class="agent-task" style="font-size:11.5px;color:#334155">
              <div style="font-weight:800;color:#0f172a">🤖 ${escHtml(cliLabel)} · <code style="color:#0f6848;font-weight:800">${escHtml(modelStr)}</code></div>
              <div style="font-size:10.5px;color:#64748b;margin-top:2px">${escHtml(skillsTxt)}</div>
            </div>
            <div>
              <div style="display:inline-flex;align-items:center;gap:5px;padding:3px 8px;border-radius:6px;background:#f0fdf4;border:1px solid #bbf7d0;color:#166534;font-size:10px;font-weight:800">${escHtml(timeoutBadge)}</div>
              <div class="agent-type" style="margin-top:4px">${ag.sandboxMode === 'proposal' ? '격리 제안(proposal)' : '읽기 안전(read-only)'}</div>
            </div>
            <div style="display:flex;align-items:center;gap:6px;justify-content:flex-end;flex-wrap:wrap">
              <span class="status ${isWorkingNow ? 'running' : 'review'}" style="${isWorkingNow ? '' : 'background:#ecfdf5;color:#0f6848'}">${isWorkingNow ? '⚡ 수행 중' : '✓ 준비됨'}</span>
              <button type="button" class="btn small btn-roster-edit-agent" data-aid="${escHtml(ag.id)}" style="height:26px;padding:0 9px;font-size:10px">⚙ 편집 ↓</button>
            </div>
          </div>
        `;
      }).join('');

      listEl.querySelectorAll('.btn-roster-edit-agent').forEach(btn => {
        btn.addEventListener('click', () => {
          if (studioSelectAgentFn) studioSelectAgentFn(btn.dataset.aid, true);
        });
      });
    }

    function applyAgentsRosterFilter() {
      const q = (searchEl?.value || '').trim().toLowerCase();
      let visible = 0;
      listEl.querySelectorAll('.agent-card-row').forEach(row => {
        const rRole = row.dataset.role || '';
        const rRank = row.dataset.rank || '';
        const rTeams = (row.dataset.teams || '').split(',').filter(Boolean);
        let matchFilter = true;
        if (activeAgentsRosterFilter === 'RANK_LEAD') matchFilter = rRank === 'LEAD';
        else if (activeAgentsRosterFilter === 'RANK_PART_LEAD') matchFilter = rRank === 'PART_LEAD';
        else if (activeAgentsRosterFilter === 'RANK_STAFF') matchFilter = rRank === 'STAFF';
        else if (activeAgentsRosterFilter.startsWith('TEAM_')) matchFilter = rTeams.includes(activeAgentsRosterFilter.slice(5));
        else if (activeAgentsRosterFilter !== 'all') matchFilter = rRole === activeAgentsRosterFilter;

        const matchSearch = !q || (row.dataset.name || '').includes(q) || (row.textContent || '').toLowerCase().includes(q);
        const show = matchFilter && matchSearch;
        row.style.display = show ? 'grid' : 'none';
        if (show) visible++;
      });
      if (countEl) {
        countEl.textContent = `전체 등록 AI 직원 ${modularAgents.length}명 중 ${visible}명 표시 중 (character_configs.json 실시간 일치)`;
      }
      const empty = document.getElementById('noAgents');
      if (!visible && !empty) {
        const node = document.createElement('div');
        node.id = 'noAgents';
        node.className = 'empty-state';
        node.textContent = '선택한 필터/검색어에 해당하는 AI 직원이 없습니다.';
        listEl.appendChild(node);
      } else if (visible && empty) {
        empty.remove();
      }
    }

    if (searchEl && !searchEl.dataset.boundRoster) {
      searchEl.dataset.boundRoster = '1';
      searchEl.addEventListener('input', applyAgentsRosterFilter);
    }
    applyAgentsRosterFilter();
  }

  function renderConfiguredTeamsAndMembersSection(ts, forceRender = false) {
    const detailBox = document.getElementById('configuredTeamsDetailList');
    const chipsBox = document.getElementById('configuredTeamsSummaryChips');
    const sumBadge = document.getElementById('configuredTeamsSummaryBadge');
    const addTeamBtn = document.getElementById('btnConfiguredTeamsAddTeam');
    const syncBtn = document.getElementById('btnRefreshAgentsSync');
    if (addTeamBtn && !addTeamBtn.dataset.bound) {
      addTeamBtn.dataset.bound = '1';
      addTeamBtn.addEventListener('click', () => {
        if (typeof openTeamBuilderModal === 'function') openTeamBuilderModal(null);
      });
    }
    if (syncBtn && !syncBtn.dataset.bound) {
      syncBtn.dataset.bound = '1';
      syncBtn.addEventListener('click', async () => {
        syncBtn.disabled = true;
        try {
          const [cRes, pRes, tRes] = await Promise.all([
            apiFetch('/ops/character-config', { cache: 'no-store' }),
            apiFetch('/ops/part-roles', { cache: 'no-store' }),
            apiFetch('/ops/teams?refresh=1', { cache: 'no-store' })
          ]);
          const cData = cRes.ok ? await cRes.json() : null;
          const pData = pRes.ok ? await pRes.json() : null;
          const tData = tRes.ok ? await tRes.json() : null;
          if (cData?.configs) {
            lastServerCharConfigSig = '';
            syncServerCharConfigsIntoRuntime(cData.configs, true);
          }
          if (pData?.part_roles) syncPartRolesToDOM(pData.part_roles, true);
          if (tData) renderTeamsAndWorkspacesDashboard(tData, true);
        } finally {
          syncBtn.disabled = false;
        }
      });
    }

    if (!detailBox) return;
    const teams = Array.isArray(ts?.teams) ? ts.teams : [];
    const assignedSet = new Set();
    teams.forEach(t => (t.member_ids || []).forEach(mid => assignedSet.add(String(mid).padStart(2, '0'))));
    const unassignedAgents = modularAgents.filter(a => !assignedSet.has(a.id));

    if (sumBadge) {
      sumBadge.textContent = `구성된 팀 ${teams.length}개 · 등록 직원 ${modularAgents.length}명${unassignedAgents.length ? ` (미배정 ${unassignedAgents.length}명)` : ''}`;
    }

    const sig = JSON.stringify([
      teams.map(t => [t.id, t.name, t.floor, t.color, t.is_active, t.member_ids, t.workspace_status?.display_path]),
      modularAgents.map(a => [a.id, a.name, a.triadRole, a.orgRank, a.cliProvider, a.cliModel, a.timeoutSec, a.floor])
    ]);
    const hasRenderedTeamCards = Boolean(detailBox.querySelector('[id^="confTeamCard_"]'));
    if (!forceRender && sig === lastConfiguredTeamsSectionSig && (teams.length === 0 || hasRenderedTeamCards)) {
      return;
    }
    lastConfiguredTeamsSectionSig = sig;

    if (chipsBox) {
      chipsBox.innerHTML = teams.map(t => {
        const c = t.color || '#0f6848';
        const cnt = Array.isArray(t.member_ids) ? t.member_ids.length : 0;
        return `
          <a href="#confTeamCard_${escHtml(t.id)}" style="text-decoration:none;display:inline-flex;align-items:center;gap:6px;padding:6px 11px;border-radius:999px;background:#ffffff;border:1.5px solid ${escHtml(c)}55;color:#0f172a;font-size:11px;font-weight:800;box-shadow:0 2px 6px rgba(15,23,42,0.04)">
            <span style="width:8px;height:8px;border-radius:50%;background:${escHtml(c)}"></span>
            <span>[${escHtml(t.floor || '1F')}] ${escHtml(t.name)}</span>
            <span style="background:${escHtml(c)}16;color:${escHtml(c)};padding:1px 7px;border-radius:999px;font-size:10px">팀원 ${cnt}명</span>
            ${t.is_active ? '<span style="color:#b45309;font-size:10px">★ 기본</span>' : ''}
          </a>
        `;
      }).join('');
    }

    const rankOrderVal = (ag) => {
      const cr = normalizeAgentPartRoleId(ag.triadRole);
      if (cr === 'LEAD' || ag.orgRank === 'LEAD') return 0;
      if (ag.orgRank === 'STAFF') return 2;
      return 1;
    };

    const cardsHtml = teams.map(t => {
      const c = t.color || '#0f6848';
      const ws = t.workspace_status || {};
      const gd = ws.gdrive_direct || {};
      const isCloud = Boolean(ws.is_cloud_primary && gd.folder_url);
      const memIds = Array.isArray(t.member_ids) ? t.member_ids : [];
      const memberObjs = memIds.map(mid => {
        const normId = String(mid).padStart(2, '0');
        const found = modularAgents.find(a => a.id === normId) || ALL_AGENT_PRESETS.find(a => a.id === normId) || { id: normId, name: `직원 #${normId}`, triadRole: 'PART_BUILD', orgRank: 'STAFF', cliProvider: 'antigravity_sdk', timeoutSec: 'auto', floor: t.floor };
        const saved = savedCharAiConfigs[normId] || {};
        return { ...found, ...saved, id: normId };
      }).sort((a, b) => (rankOrderVal(a) - rankOrderVal(b)) || ((parseInt(a.id, 10) || 99) - (parseInt(b.id, 10) || 99)));

      const leadCount = memberObjs.filter(m => rankOrderVal(m) === 0).length;
      const pLeadCount = memberObjs.filter(m => rankOrderVal(m) === 1).length;
      const staffCount = memberObjs.filter(m => rankOrderVal(m) === 2).length;

      const folderDisp = isCloud
        ? `☁️ Google Drive: <a href="${escHtml(gd.folder_url)}" target="_blank" rel="noopener" style="color:#0284c7;text-decoration:underline">${escHtml(gd.folder_name || gd.folder_url)} ↗</a>`
        : `📂 작업 폴더: <code style="font-size:10px;color:#1e293b">${escHtml(ws.display_path || ws.effective_dir || 'deliverables/')}</code>`;

      const rowsHtml = memberObjs.map(m => {
        const cr = normalizeAgentPartRoleId(m.triadRole);
        const effRank = cr === 'LEAD' ? 'LEAD' : (m.orgRank === 'STAFF' ? 'STAFF' : 'PART_LEAD');
        const rkBadge = formatOrgRankBadge(effRank, cr);
        const partLbl = getPartRoleDisplayLabel(cr);
        const cliKey = m.cliProvider || 'antigravity_sdk';
        const cliLbl = CLI_BADGE_LABELS[cliKey] || cliKey;
        const modLbl = m.cliModel || '계정 기본 모델';
        const toLbl = formatAgentTimeoutBadge(m.timeoutSec);
        const plc = getAgentOfficePlacement(m.id, m.floor || t.floor || '1F');
        return `
          <tr style="border-top:1px solid #eef2f6">
            <td style="padding:7px 10px">
              <div style="display:flex;align-items:center;gap:8px">
                <div style="width:28px;height:32px;flex-shrink:0">${CharacterEngine.render(m, { stance: m.mapleAnim || 'stand1', animated: false })}</div>
                <div>
                  <strong style="font-size:11.5px;color:#0f172a">#${escHtml(m.id)} ${escHtml(m.name)}</strong>
                  ${(Array.isArray(m.skills) && m.skills.length) ? `<div style="font-size:9.5px;color:#64748b">⚡ ${escHtml(m.skills.slice(0, 3).join(' · '))}</div>` : ''}
                </div>
              </div>
            </td>
            <td style="padding:7px 8px;white-space:nowrap">
              <span style="padding:2px 7px;border-radius:5px;font-size:10px;font-weight:800;background:${effRank === 'LEAD' ? '#fef3c7' : (effRank === 'PART_LEAD' ? '#e0f2fe' : '#f1f5f9')};color:${effRank === 'LEAD' ? '#92400e' : (effRank === 'PART_LEAD' ? '#0369a1' : '#334155')}">${escHtml(rkBadge)}</span>
            </td>
            <td style="padding:7px 8px;font-size:11px;font-weight:700;color:#0f6848;white-space:nowrap">${escHtml(partLbl)}</td>
            <td style="padding:7px 8px;font-size:11px">
              <span class="char-cli-badge ${escHtml(cliKey)}" style="margin:0 4px 0 0">${escHtml(cliLbl)}</span>
              <code style="font-size:10.5px;color:#0f172a;font-weight:800">${escHtml(modLbl)}</code>
            </td>
            <td style="padding:7px 8px;white-space:nowrap"><span style="font-size:10px;font-weight:800;color:#166534;background:#f0fdf4;border:1px solid #bbf7d0;padding:2px 6px;border-radius:5px">${escHtml(toLbl)}</span></td>
            <td style="padding:7px 8px;font-size:10.5px;color:#475569;white-space:nowrap">${escHtml(plc.floorStr)} · #${plc.seatIndex + 1}석</td>
            <td style="padding:7px 10px;text-align:right;white-space:nowrap">
              <button type="button" class="btn small btn-conf-team-edit-member" data-aid="${escHtml(m.id)}" style="height:24px;padding:0 8px;font-size:9.5px">⚙ 직원 편집 ↓</button>
              ${memIds.length > 1 ? `<button type="button" class="btn small btn-conf-team-rem-member" data-tid="${escHtml(t.id)}" data-aid="${escHtml(m.id)}" style="height:24px;padding:0 7px;font-size:9.5px;color:#b91c1c;border-color:#fecaca;background:#fef2f2">제외</button>` : ''}
            </td>
          </tr>
        `;
      }).join('');

      return `
        <div id="confTeamCard_${escHtml(t.id)}" style="border-radius:12px;background:#ffffff;border:1px solid #cbd5e1;border-left:5px solid ${escHtml(c)};overflow:hidden;box-shadow:0 3px 10px rgba(15,23,42,0.03)">
          <div style="padding:11px 14px;background:#f8fafc;border-bottom:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">
            <div style="display:flex;flex-direction:column;gap:3px">
              <div style="display:flex;align-items:center;gap:7px;flex-wrap:wrap">
                <span style="background:${escHtml(c)}18;color:${escHtml(c)};border:1px solid ${escHtml(c)}44;padding:2px 8px;border-radius:6px;font-size:10.5px;font-weight:800">🏢 ${escHtml(t.floor || '1F')}</span>
                <strong style="font-size:13.5px;color:#0f172a">${escHtml(t.name)}</strong>
                ${t.is_active ? '<span class="team-active-pill">★ 현재 기본 작업팀</span>' : ''}
                <span style="background:#eef2ff;color:#3730a3;padding:2px 8px;border-radius:999px;font-size:10px;font-weight:800">소속 팀원 ${memberObjs.length}명 (총괄 ${leadCount} · 파트장 ${pLeadCount} · 사원 ${staffCount})</span>
              </div>
              <div style="font-size:10.5px;color:#475569;display:flex;gap:10px;flex-wrap:wrap;align-items:center">
                ${t.description ? `<span>${escHtml(t.description)}</span><span>·</span>` : ''}
                <span>${folderDisp}</span>
              </div>
            </div>
            <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
              <button type="button" class="btn small btn-conf-team-open-dir" data-dir="${escHtml(ws.active_project_dir || ws.effective_dir || '')}" data-cloud-url="${isCloud ? escHtml(gd.folder_url) : ''}" data-tname="${escHtml(t.name)}" data-tid="${escHtml(t.id)}" style="height:26px;padding:0 9px;font-size:10px">${isCloud ? '☁️ 웹 폴더 열기 ↗' : '🗂️ 작업폴더 열기'}</button>
              <button type="button" class="btn small btn-conf-team-edit" data-tid="${escHtml(t.id)}" style="height:26px;padding:0 9px;font-size:10px;background:#f0fdf4;color:#0f6848;border-color:#86efac">✏️ 팀 설정·팀원 편집</button>
            </div>
          </div>
          <div style="overflow-x:auto">
            <table style="width:100%;border-collapse:collapse;text-align:left">
              <thead>
                <tr style="background:#ffffff;font-size:10px;color:#64748b;text-transform:uppercase">
                  <th style="padding:7px 10px">소속 팀원 (사번 · 이름 · 스킬)</th>
                  <th style="padding:7px 8px">직급</th>
                  <th style="padding:7px 8px">담당 파트</th>
                  <th style="padding:7px 8px">AI 엔진 · 세부 실행 모델</th>
                  <th style="padding:7px 8px">타임아웃</th>
                  <th style="padding:7px 8px">오피스 좌석</th>
                  <th style="padding:7px 10px;text-align:right">빠른 관리</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml || '<tr><td colspan="7" style="padding:14px;text-align:center;color:#94a3b8;font-size:11px">배정된 팀원이 없습니다.</td></tr>'}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }).join('');

    const unassignedHtml = unassignedAgents.length
      ? `
        <div style="padding:11px 14px;border-radius:11px;background:#fffbeb;border:1px dashed #f59e0b;display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">
          <div style="font-size:11px;color:#92400e">
            <strong>📌 아직 팀에 배정되지 않은 등록 AI 직원 (${unassignedAgents.length}명):</strong>
            ${unassignedAgents.map(ua => `<span style="margin-left:6px;font-weight:800">#${escHtml(ua.id)} ${escHtml(ua.name)} (${escHtml(ua.cliModel || ua.cliProvider)})</span>`).join(',')}
          </div>
          <a href="#agentsTeamPlacementSection" class="btn small" style="height:25px;padding:0 9px;font-size:10px;background:#fef3c7;color:#92400e;border-color:#f59e0b">팀 배치 보드에서 배정 ↓</a>
        </div>
      `
      : '';

    detailBox.innerHTML = cardsHtml + unassignedHtml;

    detailBox.querySelectorAll('.btn-conf-team-edit').forEach(b => {
      b.addEventListener('click', () => {
        if (typeof openTeamBuilderModal === 'function') openTeamBuilderModal(b.dataset.tid);
      });
    });
    detailBox.querySelectorAll('.btn-conf-team-open-dir').forEach(b => {
      b.addEventListener('click', () => {
        if (b.dataset.cloudUrl) {
          window.open(b.dataset.cloudUrl, '_blank', 'noopener');
          return;
        }
        openLocalFolderExplorer(b.dataset.dir || '', b.dataset.tname || '', b.dataset.tid || null);
      });
    });
    detailBox.querySelectorAll('.btn-conf-team-edit-member').forEach(b => {
      b.addEventListener('click', () => {
        if (studioSelectAgentFn) studioSelectAgentFn(b.dataset.aid, true);
      });
    });
    detailBox.querySelectorAll('.btn-conf-team-rem-member').forEach(b => {
      b.addEventListener('click', () => {
        assignAgentToTeamAndPlace(b.dataset.aid, b.dataset.tid, 'remove');
      });
    });
  }

  let activeDashboardTeamFilter = 'all';
  let lastDashboardAgentsSig = '';
  let lastDeliverablesSummarySig = '';
  let showAllDeliverablesSummary = false;
  const expandedDeliverableIds = new Set();

  function renderDashboardAgentsAndStats(forceRender = false) {
    const provMap = getActiveCliProvidersMap();
    const provKeys = Object.keys(provMap);
    const loggedInKeys = provKeys.filter(k => (provMap[k]?.auth_state || 'LOGGED_IN') === 'LOGGED_IN');
    const teamsArr = Array.isArray(window.NEXUS_TEAMS_SUMMARY?.teams) ? window.NEXUS_TEAMS_SUMMARY.teams : [];
    const missionsArr = Array.isArray(latestActivitySnapshot?.missions) ? latestActivitySnapshot.missions : [];
    const workingArr = Array.isArray(latestActivitySnapshot?.working_now) ? latestActivitySnapshot.working_now : [];
    const workingMap = new Map();
    workingArr.forEach(w => {
      if (w && w.agent_id) workingMap.set(String(w.agent_id).padStart(2, '0'), w);
    });

    // 1. Sync Top Dashboard Stat Cards & Hero Subtitle on index.html
    const statTotal = document.getElementById('statTotalAgents');
    const statBadge = document.getElementById('statTotalAgentsBadge');
    const statDesc = document.getElementById('statTotalAgentsDesc');
    const heroSub = document.getElementById('dashboardHeroSubtitle');
    const statRevCnt = document.getElementById('statReviewCount');
    const statRevFoot = document.getElementById('statReviewFoot');
    const statGuardVal = document.getElementById('statDashGuardValue');
    const statGuardBadge = document.getElementById('statDashGuardBadge');
    const statGuardSub = document.getElementById('statDashGuardSub');

    if (statTotal) {
      statTotal.innerHTML = `${String(modularAgents.length).padStart(2, '0')}<span style="font-size:13px;color:#98a5b2;font-weight:700;margin-left:3px">명</span>`;
    }
    const primaryProv = provMap[provKeys[0]] || {};
    const tierUp = String(primaryProv.orchestrator_tier || '').toUpperCase();
    const engineSummaryTxt = provKeys.map(k => {
      const p = provMap[k] || {};
      const shortLbl = (p.label || k).replace(/\s*\(.*?\)\s*/g, '').trim();
      return p.orchestrator_tier && p.orchestrator_tier !== 'none'
        ? `${shortLbl} (${String(p.orchestrator_tier).toUpperCase()})`
        : shortLbl;
    }).join(' · ');

    if (statBadge) {
      statBadge.textContent = `${loggedInKeys.length || provKeys.length}개 엔진 · ${teamsArr.length || 2}개 팀`;
    }
    if (statDesc) {
      statDesc.textContent = workingMap.size > 0
        ? `⚡ 현재 ${workingMap.size}명 실시간 작업 중 · ${engineSummaryTxt}`
        : (engineSummaryTxt || 'Antigravity SDK ($0)');
    }
    if (heroSub) {
      const teamNamesTxt = teamsArr.length
        ? teamsArr.map(t => `${t.name}(${(t.member_ids || []).length}명)`).join(', ')
        : `등록 에이전트 ${modularAgents.length}명`;
      heroSub.textContent = `연동된 AI 엔진 ${provKeys.length}개(${engineSummaryTxt || 'Antigravity SDK'})와 ${teamsArr.length || 2}개 전담 팀[${teamNamesTxt}] 총 ${modularAgents.length}명의 AI 에이전트가 실시간 연동되어 있습니다.`;
    }
    if (statRevCnt || statRevFoot) {
      const awaitingCnt = missionsArr.filter(m => m && m.status === 'AWAITING_APPROVAL').length;
      const doneCnt = missionsArr.filter(m => m && m.status === 'DONE').length;
      if (statRevCnt) {
        statRevCnt.textContent = awaitingCnt > 0 ? `대기 ${awaitingCnt}건` : (doneCnt > 0 ? `완료 ${doneCnt}건` : 'PASS');
      }
      if (statRevFoot) {
        statRevFoot.textContent = awaitingCnt > 0
          ? `대표님 최종 결재 대기 ${awaitingCnt}건`
          : `최종 승인 완료 ${doneCnt}건 · 상호검토 활성`;
      }
    }
    if (statGuardVal) {
      const autoCnt = modularAgents.filter(a => !a.timeoutSec || String(a.timeoutSec).toLowerCase() === 'auto').length;
      statGuardVal.textContent = autoCnt === modularAgents.length ? 'AUTO' : `AUTO ${autoCnt}/${modularAgents.length}`;
      if (statGuardBadge) statGuardBadge.textContent = tierUp === 'ULTRA' ? '💎 Ultra · $0' : '$0 구독전용';
      if (statGuardSub) statGuardSub.textContent = `스트림 활동 자동 연장 (${modularAgents.length}명 연동)`;
    }

    // 2. Sync Bottom Dashboard Agent Table (#dashboardAgentTableBody)
    const tbody = document.getElementById('dashboardAgentTableBody');
    const filtersWrap = document.getElementById('dashboardAgentTeamFilters');
    const subCap = document.getElementById('dashboardAgentsSubCaption');
    if (!tbody) return;

    if (subCap) {
      subCap.textContent = `연결 엔진: ${engineSummaryTxt || 'Antigravity SDK'} · 총 ${teamsArr.length}개 팀 · 등록 에이전트 ${modularAgents.length}명${workingMap.size ? ` (⚡ 실시간 작업 ${workingMap.size}명)` : ''}`;
    }

    const sig = JSON.stringify([
      activeDashboardTeamFilter,
      provKeys.map(k => [k, provMap[k]?.label, provMap[k]?.auth_state, provMap[k]?.orchestrator_tier]),
      teamsArr.map(t => [t.id, t.name, t.floor, t.color, t.member_ids]),
      modularAgents.map(a => [a.id, a.name, a.triadRole, a.orgRank, a.cliProvider, a.cliModel, a.timeoutSec, a.floor]),
      Array.from(workingMap.entries())
    ]);
    if (!forceRender && sig === lastDashboardAgentsSig && tbody.querySelector('tr[data-dash-aid]')) {
      return;
    }
    lastDashboardAgentsSig = sig;

    if (filtersWrap) {
      const validFilters = ['all', 'working', ...teamsArr.map(t => `team:${t.id}`)];
      if (!validFilters.includes(activeDashboardTeamFilter)) activeDashboardTeamFilter = 'all';
      const chipItems = [
        { key: 'all', label: `전체 (${modularAgents.length})` },
        ...teamsArr.map(t => ({ key: `team:${t.id}`, label: `🏢 ${t.name} (${(t.member_ids || []).length})` })),
        ...(workingMap.size > 0 ? [{ key: 'working', label: `⚡ 작업 중 (${workingMap.size})` }] : [])
      ];
      filtersWrap.innerHTML = chipItems.map(c => {
        const isOn = c.key === activeDashboardTeamFilter;
        return `<button type="button" class="btn small dash-agent-filter-btn" data-dfilter="${escHtml(c.key)}" style="height:25px;padding:0 9px;font-size:10px;${isOn ? 'background:#0f6848;color:#fff;border-color:#0f6848;font-weight:800' : 'background:#fff;color:#334155'}">${escHtml(c.label)}</button>`;
      }).join('');
      filtersWrap.querySelectorAll('.dash-agent-filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          activeDashboardTeamFilter = btn.dataset.dfilter || 'all';
          renderDashboardAgentsAndStats(true);
        });
      });
    }

    const rankOrder = (ag) => {
      const cr = normalizeAgentPartRoleId(ag.triadRole);
      if (cr === 'LEAD' || ag.orgRank === 'LEAD') return 0;
      if (ag.orgRank === 'STAFF') return 2;
      return 1;
    };

    const filteredAgents = [...modularAgents]
      .filter(ag => {
        if (activeDashboardTeamFilter === 'working') return workingMap.has(ag.id);
        if (activeDashboardTeamFilter.startsWith('team:')) {
          const tid = activeDashboardTeamFilter.slice(5);
          const tObj = teamsArr.find(t => t.id === tid);
          return Boolean(tObj && Array.isArray(tObj.member_ids) && tObj.member_ids.includes(ag.id));
        }
        return true;
      })
      .sort((a, b) => (parseInt(a.id, 10) || 99) - (parseInt(b.id, 10) || 99));

    if (!filteredAgents.length) {
      tbody.innerHTML = `<tr><td colspan="5" style="padding:18px;text-align:center;color:#94a3b8;font-size:11.5px">선택한 조건에 해당하는 AI 에이전트가 없습니다.</td></tr>`;
      return;
    }

    tbody.innerHTML = filteredAgents.map(ag => {
      const canonRole = normalizeAgentPartRoleId(ag.triadRole);
      const effRank = canonRole === 'LEAD' ? 'LEAD' : (ag.orgRank === 'STAFF' ? 'STAFF' : 'PART_LEAD');
      const rankLbl = formatOrgRankBadge(effRank, canonRole);
      const partLbl = getPartRoleDisplayLabel(canonRole);
      const cliKey = (ag.cliProvider && provMap[ag.cliProvider]) ? ag.cliProvider : (provKeys[0] || 'antigravity_sdk');
      const provInfo = provMap[cliKey] || {};
      const cliLbl = provInfo.label || CLI_BADGE_LABELS[cliKey] || cliKey;
      const isLogged = (provInfo.auth_state || 'LOGGED_IN') === 'LOGGED_IN';
      const modStr = ag.cliModel || provInfo.selected_model || '기본 모델';
      const toStr = formatAgentTimeoutBadge(ag.timeoutSec);
      const plc = getAgentOfficePlacement(ag.id, ag.floor || '1F');
      const belongTeams = teamsArr.filter(t => Array.isArray(t.member_ids) && t.member_ids.includes(ag.id));
      const teamBadges = belongTeams.length
        ? belongTeams.map(t => `<span style="display:inline-flex;align-items:center;padding:1.5px 7px;border-radius:999px;background:${escHtml(t.color || '#0f6848')}15;color:${escHtml(t.color || '#0f6848')};border:1px solid ${escHtml(t.color || '#0f6848')}40;font-size:10px;font-weight:800">🏢 ${escHtml(t.name)}</span>`).join(' ')
        : `<span style="font-size:10px;color:#94a3b8">미배정</span>`;
      const workInfo = workingMap.get(ag.id) || null;
      const statusHtml = workInfo
        ? `<span class="status running" title="${escHtml(workInfo.task || workInfo.stage || '')}">⚡ 수행 중 · ${escHtml((workInfo.stage || 'ACTIVE').slice(0, 18))}</span>`
        : `<span class="status review" style="background:${isLogged ? '#ecfdf5' : '#fef2f2'};color:${isLogged ? '#0f6848' : '#b91c1c'}">${isLogged ? '✓ 연동 대기' : '미로그인'}</span>`;

      return `
        <tr data-dash-aid="${escHtml(ag.id)}">
          <td>
            <div class="agent-cell">
              <div class="agent-avatar" style="overflow:hidden;padding:1px;background:#f8fafc;border:1px solid #e2e8f0">${CharacterEngine.render(ag, { stance: ag.mapleAnim || 'stand1', animated: false })}</div>
              <div>
                <div class="agent-name">#${escHtml(ag.id)} ${escHtml(ag.name)}</div>
                <div class="agent-type">${Array.isArray(ag.skills) && ag.skills.length ? `⚡ ${escHtml(ag.skills.slice(0, 2).join(' · '))}` : escHtml(canonRole)}</div>
              </div>
            </div>
          </td>
          <td>
            <div style="display:flex;flex-direction:column;gap:3px;align-items:flex-start">
              ${teamBadges}
              <span style="font-size:10px;color:#64748b">${escHtml(plc.floorStr)} · #${plc.seatIndex + 1}석</span>
            </div>
          </td>
          <td>
            <div style="display:flex;flex-direction:column;gap:2px;align-items:flex-start">
              <span style="padding:1.5px 6px;border-radius:5px;font-size:10px;font-weight:800;background:${effRank === 'LEAD' ? '#fef3c7' : (effRank === 'PART_LEAD' ? '#e0f2fe' : '#f1f5f9')};color:${effRank === 'LEAD' ? '#92400e' : (effRank === 'PART_LEAD' ? '#0369a1' : '#334155')}">${escHtml(rankLbl)}</span>
              <span style="font-size:10.5px;font-weight:700;color:#0f6848">${escHtml(partLbl)}</span>
            </div>
          </td>
          <td>
            <div style="display:flex;flex-direction:column;gap:3px;align-items:flex-start">
              <span class="cli-pill ${escHtml(cliKey)}" style="font-size:10px;padding:2px 7px">${escHtml(cliLbl)}</span>
              <code style="font-size:10.5px;color:#0f172a;font-weight:800">${escHtml(modStr)}</code>
            </div>
          </td>
          <td>
            <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
              <span style="font-size:9.5px;font-weight:800;color:#166534;background:#f0fdf4;border:1px solid #bbf7d0;padding:2px 6px;border-radius:5px">${escHtml(toStr)}</span>
              ${statusHtml}
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  function renderDashboardDeliverablesSummary(missions, forceRender = false) {
    const delivBox = document.getElementById('deliverablesListBox');
    const sumBadge = document.getElementById('deliverablesSummaryBadge');
    if (!delivBox) return;

    const list = Array.isArray(missions) ? missions : [];
    const doneMissions = list.filter(m => m && m.status === 'DONE' && (m.deliverable_file || (Array.isArray(m.generated_files) && m.generated_files.length > 0)));
    const totalFilesCount = doneMissions.reduce((acc, m) => acc + (Array.isArray(m.generated_files) ? m.generated_files.length : 0), 0);

    if (sumBadge) {
      sumBadge.textContent = doneMissions.length > 0
        ? `완료 ${doneMissions.length}건 · 파일 ${totalFilesCount}개`
        : '완료 0건';
    }

    const sig = JSON.stringify([
      showAllDeliverablesSummary,
      Array.from(expandedDeliverableIds).sort(),
      doneMissions.map(m => [m.mission_id, m.updated_at, m.deliverable_file, (m.generated_files || []).length, m.gdrive_project_url])
    ]);
    if (!forceRender && sig === lastDeliverablesSummarySig) {
      return;
    }
    lastDeliverablesSummarySig = sig;

    if (doneMissions.length === 0) {
      delivBox.innerHTML = `
        <div style="padding:16px;border-radius:10px;background:#f8fafc;border:1px dashed #cbd5e1;text-align:center;color:#64748b;font-size:11.5px">
          아직 최종 승인 확정된 프로젝트 산출물이 없습니다. 대표 결재함에서 승인하면 이곳에 요약 목록으로 정리됩니다.
        </div>
      `;
      return;
    }

    const SUMMARY_LIMIT = 5;
    const visibleList = showAllDeliverablesSummary ? doneMissions : doneMissions.slice(0, SUMMARY_LIMIT);
    const hiddenCount = Math.max(0, doneMissions.length - visibleList.length);

    const rowsHtml = visibleList.map(mItem => {
      const mid = mItem.mission_id || '';
      const genFiles = Array.isArray(mItem.generated_files) ? mItem.generated_files : [];
      const absProjDir = mItem.project_dir_abs || mItem.output_root || '';
      const isGdMission = Boolean(mItem.is_google_drive);
      const gdCloudUrl = mItem.gdrive_project_url || mItem.gdrive_report_url || '';
      const folderShort = mItem.project_folder_name
        || (absProjDir ? absProjDir.replace(/\\/g, '/').split('/').filter(Boolean).pop() : '')
        || (mItem.deliverable_file ? mItem.deliverable_file.replace(/\.md$/i, '').split('/').pop() : mid);
      const goalFull = String(mItem.goal || folderShort || mid).trim();
      const goalShort = goalFull.length > 44 ? `${goalFull.slice(0, 44)}…` : goalFull;
      const tColor = mItem.team_color || '#0f6848';
      const isExpanded = expandedDeliverableIds.has(mid);

      const teamTag = mItem.team_name
        ? `<span style="background:${escHtml(tColor)}15;color:${escHtml(tColor)};border:1px solid ${escHtml(tColor)}38;padding:1px 6px;border-radius:5px;font-size:9.5px;font-weight:800;white-space:nowrap">${escHtml(mItem.team_name.replace(' 개발팀', '팀').replace('신규 서비스 ', ''))}</span>`
        : '';
      const fileCountTag = `<span style="background:#f1f5f9;color:#334155;padding:1px 6px;border-radius:5px;font-size:9.5px;font-weight:800;white-space:nowrap">파일 ${genFiles.length}개</span>`;
      const contTag = mItem.continue_existing
        ? `<span style="background:#e0f2fe;color:#0369a1;border:1px solid #7dd3fc;padding:1px 6px;border-radius:5px;font-size:9px;font-weight:800;white-space:nowrap">📂 이어하기</span>`
        : '';

      const expandedDetailHtml = isExpanded
        ? `
          <div style="margin-top:6px;padding-top:6px;border-top:1px dashed #cbd5e1;display:flex;flex-direction:column;gap:5px;font-size:10px">
            <div style="color:#475569;font-family:var(--font-mono,monospace);word-break:break-all">📂 폴더: ${escHtml(folderShort)}${absProjDir ? ` (${escHtml(absProjDir)})` : ''}</div>
            ${genFiles.length
          ? `<div style="display:flex;flex-wrap:wrap;gap:4px">${genFiles.map(f => {
            const baseName = String(f).split('/').pop() || f;
            return `<a href="${escHtml(f)}" target="_blank" style="background:#ffffff;border:1px solid #bbf7d0;color:#166534;padding:1.5px 6px;border-radius:4px;font-size:9.5px;font-weight:700" title="${escHtml(f)}">📄 ${escHtml(baseName)}</a>`;
          }).join('')}</div>`
          : ''}
          </div>
        `
        : '';

      return `
        <div data-mission-id="${escHtml(mid)}" style="padding:8px 11px;border-radius:9px;border:1px solid #d1fae5;background:#f8fefb;display:flex;flex-direction:column">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">
            <div style="display:flex;align-items:center;gap:6px;min-width:0;flex:1;flex-wrap:wrap">
              ${teamTag}
              ${contTag}
              <strong style="font-size:11.5px;color:#0f172a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escHtml(goalFull)}">${isGdMission ? '☁️ ' : '📁 '}${escHtml(goalShort)}</strong>
              ${fileCountTag}
            </div>
            <div style="display:flex;align-items:center;gap:4px;flex-shrink:0;flex-wrap:wrap">
              ${mItem.deliverable_file ? `<a href="${escHtml(mItem.deliverable_file)}" target="_blank" class="btn small" style="height:23px;padding:0 8px;font-size:9.5px;background:#ecfdf5;color:#0f6848;border-color:#86efac;font-weight:800">📄 리포트 ↗</a>` : ''}
              ${absProjDir ? `<button type="button" class="btn small btn-open-deliv-dir" data-dir="${escHtml(absProjDir)}" style="height:23px;padding:0 7px;font-size:9.5px">🗂️ 폴더</button>` : ''}
              ${gdCloudUrl ? `<a href="${escHtml(gdCloudUrl)}" target="_blank" class="btn small" style="height:23px;padding:0 7px;font-size:9.5px;background:#e0f2fe;color:#0369a1;border-color:#7dd3fc">☁️ Drive ↗</a>` : ''}
              ${genFiles.length > 0 ? `<button type="button" class="btn small btn-toggle-deliv-detail" data-mid="${escHtml(mid)}" style="height:23px;padding:0 7px;font-size:9.5px;color:#475569">${isExpanded ? '접기 ▴' : '상세 ▾'}</button>` : ''}
            </div>
          </div>
          ${expandedDetailHtml}
        </div>
      `;
    }).join('');

    const moreToggleHtml = (doneMissions.length > SUMMARY_LIMIT)
      ? `<button type="button" id="btnToggleAllDeliverablesSummary" class="btn small" style="align-self:center;height:25px;padding:0 12px;font-size:10px;color:#475569">${showAllDeliverablesSummary ? '▴ 최근 5건만 요약 보기' : `▾ 이전 완료 산출물 ${hiddenCount}건 더보기`}</button>`
      : '';

    delivBox.innerHTML = rowsHtml + moreToggleHtml;

    delivBox.querySelectorAll('.btn-open-deliv-dir').forEach(b => {
      b.addEventListener('click', () => {
        openLocalFolderExplorer(b.dataset.dir || '', '프로젝트 산출물 폴더');
      });
    });
    delivBox.querySelectorAll('.btn-toggle-deliv-detail').forEach(b => {
      b.addEventListener('click', () => {
        const mid = b.dataset.mid;
        if (!mid) return;
        if (expandedDeliverableIds.has(mid)) expandedDeliverableIds.delete(mid);
        else expandedDeliverableIds.add(mid);
        renderDashboardDeliverablesSummary(missions, true);
      });
    });
    document.getElementById('btnToggleAllDeliverablesSummary')?.addEventListener('click', () => {
      showAllDeliverablesSummary = !showAllDeliverablesSummary;
      renderDashboardDeliverablesSummary(missions, true);
    });
  }

  renderConfiguredAgentsRosterFn = renderConfiguredAgentsRoster;
  renderConfiguredTeamsSectionFn = renderConfiguredTeamsAndMembersSection;
  renderDashboardAgentsAndStatsFn = renderDashboardAgentsAndStats;

  // ==========================================================================
  // [5] AI DEV DIRECTOR × NEXUS Virtual Office (Triad Role & Multi-CLI 연동)
  // ==========================================================================
  const CLI_LABELS = {
    claude: 'Claude Code (claude)',
    antigravity: 'Google Antigravity (계정 1)',
    antigravity_sdk: 'Antigravity SDK (구독·로컬 $0)',
    gemini: 'Google Antigravity (계정 2)',
    openai: 'OpenAI Codex (codex)',
    grok: 'xAI Grok (grok)'
  };
  const CLI_SHORT = {
    claude: 'Claude',
    antigravity: 'Antigravity 1',
    antigravity_sdk: 'AGY SDK',
    gemini: 'Antigravity 2',
    openai: 'Codex',
    grok: 'Grok'
  };
  const ROLE_STORAGE_KEY = 'nexus-triad-roles-v1';

  function loadStoredRoles() {
    try {
      const parsed = JSON.parse(localStorage.getItem(ROLE_STORAGE_KEY) || 'null');
      if (parsed && parsed.head && parsed.builder && parsed.reviewer) {
        return { sub_builder: 'gemini', researcher: 'grok', ...parsed };
      }
    } catch (_) { }
    return { head: 'claude', builder: 'antigravity', sub_builder: 'gemini', reviewer: 'openai', researcher: 'grok' };
  }

  let currentRoles = loadStoredRoles();
  let localPipelineTimer = null;
  let selectedOrchestratorMode = 'standard';

  if (page === 'agents') {
    renderConfiguredAgentsRoster(true);
  }

  function buildSdkModelOptionsHtml(selectedModel = '', cliProvider = 'antigravity_sdk') {
    const cur = String(selectedModel || '').trim();
    const provDiag = lastDiagnostics?.providers?.[cliProvider] || lastDiagnostics?.providers?.antigravity_sdk || null;
    const dynModels = Array.isArray(provDiag?.available_models)
      ? provDiag.available_models.filter(m => m && m.id && !m.locked)
      : [];
    const mergedMap = new Map();
    VERIFIED_SDK_SUBMODELS.forEach(m => mergedMap.set(m.id, m.label));
    dynModels.forEach(m => {
      if (!mergedMap.has(m.id)) {
        mergedMap.set(m.id, m.name || m.label || m.id);
      }
    });
    if (cur && !mergedMap.has(cur)) {
      mergedMap.set(cur, `${cur} (현재 지정됨)`);
    }
    const opts = [`<option value="" ${!cur ? 'selected' : ''}>🔄 계정 기본 모델</option>`];
    mergedMap.forEach((lbl, id) => {
      opts.push(`<option value="${escHtml(id)}" ${id === cur ? 'selected' : ''}>🤖 ${escHtml(lbl)}</option>`);
    });
    return opts.join('');
  }

  async function applyQuickAgentModelOrRank(agentId, patch, feedbackTarget = 'part') {
    const ag = modularAgents.find(a => a.id === agentId) || ALL_AGENT_PRESETS.find(a => a.id === agentId);
    if (!ag) return;
    if (patch.cliModel !== undefined) {
      ag.cliModel = String(patch.cliModel || '').trim();
      if (ag.cliModel && VERIFIED_SDK_SUBMODELS.some(m => m.id === ag.cliModel)) {
        ag.cliProvider = 'antigravity_sdk';
      }
    }
    if (patch.orgRank !== undefined) {
      ag.orgRank = patch.orgRank;
      if (ag.orgRank === 'LEAD') ag.triadRole = 'LEAD';
      else if (ag.triadRole === 'LEAD' || ag.triadRole === 'HEAD') ag.triadRole = 'PART_RESEARCH';
    }
    if (patch.triadRole !== undefined) {
      ag.triadRole = patch.triadRole;
      if (ag.triadRole === 'LEAD') ag.orgRank = 'LEAD';
      else if (ag.orgRank === 'LEAD') ag.orgRank = 'PART_LEAD';
    }
    ag.dept = `${ag.triadRole} (${ag.orgRank || 'STAFF'}) · ${CLI_BADGE_LABELS[ag.cliProvider] || ag.cliProvider}${ag.cliModel ? ` (${ag.cliModel})` : ''}`;
    await saveCharacterConfigsToServer(ag);
    if (studioRefreshDirectoryFn) studioRefreshDirectoryFn();
    if (currentPartRoles) syncPartRolesToDOM(currentPartRoles, true);
    if (latestTeamsSummary) renderAgentsTeamPlacementBoard(latestTeamsSummary, true);
    const msg = `✓ [#${ag.id} ${ag.name}] 직급(${formatOrgRankBadge(ag.orgRank, ag.triadRole)}) · 세부 모델(${ag.cliModel || '기본 모델'}) 설정이 즉시 저장되었습니다.`;
    if (feedbackTarget === 'table') {
      showAgentsPlacementFeedback(msg);
    } else {
      const fbBar = document.getElementById('partRolesFeedbackBar');
      if (fbBar) {
        fbBar.style.display = 'block';
        fbBar.textContent = msg;
      }
    }
  }

  function syncPartRolesToDOM(partRolesCfg, forceGridRender = false) {
    if (!partRolesCfg || typeof partRolesCfg !== 'object') return;
    currentPartRoles = partRolesCfg;
    if (renderConfiguredAgentsRosterFn) renderConfiguredAgentsRosterFn(forceGridRender);
    if (renderConfiguredTeamsSectionFn && window.NEXUS_TEAMS_SUMMARY) {
      renderConfiguredTeamsSectionFn(window.NEXUS_TEAMS_SUMMARY, forceGridRender);
    }
    try {
      localStorage.setItem('nexus-part-roles-v1', JSON.stringify(partRolesCfg));
    } catch (_) { }

    const assignable = Array.isArray(partRolesCfg.assignable_roles) ? partRolesCfg.assignable_roles : [];
    const stages = Array.isArray(partRolesCfg.pipeline_stages) ? partRolesCfg.pipeline_stages : [];
    const parts = Array.isArray(partRolesCfg.parts) ? partRolesCfg.parts : [];
    const lead = partRolesCfg.lead || { id: 'LEAD', name: '프로젝트 총괄팀장', icon: '👑', instruction: '' };

    const staffExecMode = partRolesCfg.staff_execution_mode === 'sequential' ? 'sequential' : 'parallel';
    const staffModeSel = document.getElementById('staffExecModeSelect');
    if (staffModeSel && document.activeElement !== staffModeSel) {
      staffModeSel.value = staffExecMode;
      if (!staffModeSel.dataset.bound) {
        staffModeSel.dataset.bound = '1';
        staffModeSel.addEventListener('change', async (ev) => {
          const nextMode = ev.currentTarget.value;
          const fbBar = document.getElementById('partRolesFeedbackBar');
          const res = await apiFetch('/ops/part-roles', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'set_staff_mode', mode: nextMode })
          });
          const d = await res.json().catch(() => ({}));
          if (res.ok && d.part_roles) {
            syncPartRolesToDOM(d.part_roles, true);
            if (fbBar) {
              fbBar.style.display = 'block';
              fbBar.textContent = `✓ ${d.message || '사원 실행 모드가 변경되었습니다.'}`;
            }
          }
        });
      }
    }

    // 1. Update #partRolesCountBadge & #partRolesCardsGrid on agents.html
    const cntBadge = document.getElementById('partRolesCountBadge');
    if (cntBadge) {
      const activeCnt = parts.filter(p => p.enabled !== false).length;
      cntBadge.textContent = `총괄팀장 1 · 활성 파트 ${activeCnt}/${parts.length}개`;
    }

    const cardsGrid = document.getElementById('partRolesCardsGrid');
    if (cardsGrid && (forceGridRender || !cardsGrid.contains(document.activeElement))) {
      const teamsLookup = Array.isArray(window.NEXUS_TEAMS_SUMMARY?.teams) ? window.NEXUS_TEAMS_SUMMARY.teams : [];
      const renderMemberTeamTag = (aid) => {
        const bt = teamsLookup.filter(t => Array.isArray(t.member_ids) && t.member_ids.includes(aid));
        if (!bt.length) return '';
        return bt.map(t => `<span style="font-size:8px;padding:1px 5px;border-radius:4px;background:${escHtml(t.color || '#0f6848')}18;color:${escHtml(t.color || '#0f6848')};font-weight:800;white-space:nowrap">${escHtml(t.name.replace(' 개발팀', '팀').replace('신규 서비스 ', ''))}</span>`).join(' ');
      };
      const leadAgents = modularAgents.filter(a => normalizeAgentPartRoleId(a.triadRole) === 'LEAD');
      const leadRosterHtml = leadAgents.length
        ? leadAgents.map(la => `
          <div style="font-size:10px;padding:5px 7px;border-radius:7px;background:#fff7ed;border:1px solid #fed7aa;display:flex;flex-direction:column;gap:4px">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;flex-wrap:wrap">
              <span class="part-member-chip" data-focus-aid="${escHtml(la.id)}" style="cursor:pointer;display:inline-flex;align-items:center;gap:4px;flex-wrap:wrap" title="클릭하여 하단 스튜디오에서 상세 페르소나 편집">👑 <b>#${escHtml(la.id)} ${escHtml(la.name)}</b> ${renderMemberTeamTag(la.id)}</span>
              <small style="color:#0f6848;font-weight:800">SDK</small>
            </div>
            <select class="triad-cli-select sel-inline-agent-model" data-aid="${escHtml(la.id)}" style="height:25px;font-size:9.5px;font-weight:700;background:#fff;width:100%" aria-label="${escHtml(la.name)} 세부 모델 선택">
              ${buildSdkModelOptionsHtml(la.cliModel, la.cliProvider)}
            </select>
          </div>
        `).join('')
        : `<div style="font-size:9.5px;color:#94a3b8">배정된 총괄팀장 캐릭터 없음 (자동 위임)</div>`;

      const leadCardHtml = `
        <div style="padding:12px 14px;border-radius:11px;border:1.5px solid #f59e0b;background:linear-gradient(180deg,#fffbeb,#ffffff);display:flex;flex-direction:column;gap:7px">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:6px">
            <span style="font-size:10px;font-weight:800;padding:2px 7px;border-radius:5px;background:#fef3c7;color:#92400e">총괄 지휘 · 통합보고 (고정 코어)</span>
            <button type="button" class="btn small btn-edit-part-role" data-role-id="LEAD" style="height:24px;padding:0 8px;font-size:9.5px">✏️ 이름·지침 수정</button>
          </div>
          <strong style="font-size:13px;color:#0f172a">${escHtml(lead.icon || '👑')} ${escHtml(lead.name)} <code style="font-size:9.5px;color:#64748b">(LEAD)</code></strong>
          <div style="font-size:10.5px;color:#475569;line-height:1.45">${escHtml(lead.instruction || '')}</div>
          <div style="margin-top:auto;padding-top:6px;border-top:1px dashed #fde68a;display:flex;flex-direction:column;gap:4px">
            <span style="font-size:9.5px;font-weight:800;color:#92400e">팀별 총괄팀장 세부 실행 모델 설정 (${leadAgents.length}명)</span>
            ${leadRosterHtml}
          </div>
        </div>
      `;
      const partsCardsHtml = parts.map((p, idx) => {
        const isOn = p.enabled !== false;
        const pMembers = modularAgents.filter(a => normalizeAgentPartRoleId(a.triadRole) === p.id);
        const pLeads = pMembers.filter(a => String(a.orgRank || '').toUpperCase() !== 'STAFF');
        const pStaff = pMembers.filter(a => String(a.orgRank || '').toUpperCase() === 'STAFF');
        const effLeadsList = pLeads.length ? pLeads : (pStaff[0] ? [pStaff[0]] : []);
        const effStaffList = pLeads.length ? pStaff : pStaff.slice(1);

        const leadRowHtml = effLeadsList.length
          ? effLeadsList.map(plObj => `
            <div style="font-size:10px;padding:5px 7px;border-radius:7px;background:#ecfdf5;border:1px solid #86efac;display:flex;flex-direction:column;gap:3.5px">
              <div style="display:flex;justify-content:space-between;align-items:center;gap:5px;flex-wrap:wrap">
                <span class="part-member-chip" data-focus-aid="${escHtml(plObj.id)}" style="cursor:pointer;display:inline-flex;align-items:center;gap:4px;flex-wrap:wrap" title="클릭하여 파트장 상세 페르소나 편집">⭐ 파트장 · <b>#${escHtml(plObj.id)} ${escHtml(plObj.name)}</b> ${renderMemberTeamTag(plObj.id)}</span>
                <span style="font-size:8.5px;color:#0f6848;font-weight:800">SDK 고정</span>
              </div>
              <select class="triad-cli-select sel-inline-agent-model" data-aid="${escHtml(plObj.id)}" style="height:24px;font-size:9.5px;font-weight:700;background:#fff;width:100%" aria-label="${escHtml(plObj.name)} 파트장 세부 모델 선택">
                ${buildSdkModelOptionsHtml(plObj.cliModel, plObj.cliProvider)}
              </select>
            </div>
          `).join('')
          : `<div style="font-size:9.5px;color:#94a3b8;padding:3px 0">파트장 미지정 (자동 배정)</div>`;

        const isPartParallel = effStaffList.length >= 2 && staffExecMode !== 'sequential';
        const staffRowsHtml = effStaffList.length
          ? effStaffList.map((st, sIdx) => `
            <div style="font-size:9.5px;padding:5px 7px 5px 12px;border-radius:7px;background:#f8fafc;border:1px solid #cbd5e1;display:flex;flex-direction:column;gap:3.5px">
              <div style="display:flex;justify-content:space-between;align-items:center;gap:5px;flex-wrap:wrap">
                <span class="part-member-chip" data-focus-aid="${escHtml(st.id)}" style="cursor:pointer;display:inline-flex;align-items:center;gap:4px;flex-wrap:wrap" title="클릭하여 일반 사원 상세 페르소나·스킬 편집">↳ 👤 사원 · <b>#${escHtml(st.id)} ${escHtml(st.name)}</b> ${renderMemberTeamTag(st.id)}</span>
                <span style="font-size:8px;color:${isPartParallel ? '#0f6848' : '#0369a1'};font-weight:800;background:${isPartParallel ? '#dcfce7' : '#e0f2fe'};padding:1px 5px;border-radius:4px">${isPartParallel ? `⚡ 병렬 #${(st.staffOrder || (sIdx % 2) + 1)}` : `순차 #${sIdx + 1}`}</span>
              </div>
              <select class="triad-cli-select sel-inline-agent-model" data-aid="${escHtml(st.id)}" style="height:24px;font-size:9.5px;font-weight:700;background:#fff;color:#0f172a;width:100%" aria-label="${escHtml(st.name)} 사원 세부 모델 선택">
                ${buildSdkModelOptionsHtml(st.cliModel, st.cliProvider)}
              </select>
            </div>
          `).join('')
          : `<div style="font-size:9.5px;color:#94a3b8;padding-left:8px">↳ 소속 부하직원 없음 (아래에서 모델 선택 후 [＋ 사원 충원] 클릭)</div>`;

        return `
          <div style="padding:12px 14px;border-radius:11px;border:1.5px solid ${isOn ? '#86efac' : '#cbd5e1'};background:${isOn ? '#f8fefb' : '#f8fafc'};opacity:${isOn ? '1' : '0.68'};display:flex;flex-direction:column;gap:7px">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:5px;flex-wrap:wrap">
              <label style="display:inline-flex;align-items:center;gap:5px;font-size:10px;font-weight:800;color:${isOn ? '#0f6848' : '#64748b'};cursor:pointer">
                <input type="checkbox" class="chk-toggle-part-role" data-role-id="${escHtml(p.id)}" ${isOn ? 'checked' : ''} style="accent-color:#0f6848">
                <span>실무 파트 #${idx + 1} (${isOn ? '활성' : '비활성'})</span>
              </label>
              <div style="display:flex;gap:4px;align-items:center">
                <button type="button" class="btn small btn-move-part-role" data-role-id="${escHtml(p.id)}" data-dir="up" ${idx === 0 ? 'disabled' : ''} style="height:22px;padding:0 6px;font-size:9px" title="순서 앞으로">▲</button>
                <button type="button" class="btn small btn-move-part-role" data-role-id="${escHtml(p.id)}" data-dir="down" ${idx === parts.length - 1 ? 'disabled' : ''} style="height:22px;padding:0 6px;font-size:9px" title="순서 뒤로">▼</button>
                <button type="button" class="btn small btn-edit-part-role" data-role-id="${escHtml(p.id)}" style="height:22px;padding:0 7px;font-size:9px">✏️ 수정</button>
                ${parts.length > 1 ? `<button type="button" class="btn-remove-cli-slot btn-delete-part-role" data-role-id="${escHtml(p.id)}" style="height:22px;padding:0 6px;font-size:9px">🗑️</button>` : ''}
              </div>
            </div>
            <strong style="font-size:12.5px;color:#0f172a">${escHtml(p.icon || '🧩')} ${escHtml(p.name)} <small style="color:#0369a1;font-weight:700">[${escHtml(p.stage_label || p.name)}]</small></strong>
            <div style="font-size:10.5px;color:#475569;line-height:1.45">${escHtml(p.instruction || '')}</div>
            <div style="margin-top:auto;padding-top:7px;border-top:1px dashed #cbd5e1;display:flex;flex-direction:column;gap:5px">
              <div style="font-size:9.5px;font-weight:800;color:#0f6848">${isPartParallel ? `⚡ 사원 ${effStaffList.length}명 동시 병렬수행 (사원1 ∥ 사원2 → 파트장 취합)` : `파이프라인 진행: 일반사원(${effStaffList.length}명) → 파트장 취합`}</div>
              ${leadRowHtml}
              ${staffRowsHtml}
              <div style="display:flex;gap:4px;align-items:center;margin-top:2px;padding-top:4px;border-top:1px dotted #e2e8f0">
                <select class="triad-cli-select sel-recruit-staff-model" data-role-id="${escHtml(p.id)}" style="height:24px;font-size:9px;background:#fff;flex:1;min-width:0" aria-label="신규 충원 사원 세부 모델 선택">
                  ${buildSdkModelOptionsHtml('gemini-3.8-flash-high', 'antigravity_sdk')}
                </select>
                <button type="button" class="btn small btn-recruit-part-staff" data-role-id="${escHtml(p.id)}" style="height:24px;padding:0 8px;font-size:8.5px;background:#f0fdf4;color:#0f6848;border-color:#86efac;white-space:nowrap;flex-shrink:0" title="선택한 SDK 세부 모델로 일반 사원을 이 파트에 즉시 추가합니다">＋ 사원 충원</button>
              </div>
            </div>
          </div>
        `;
      }).join('');
      cardsGrid.innerHTML = leadCardHtml + partsCardsHtml;

      cardsGrid.querySelectorAll('.sel-inline-agent-model').forEach(sel => {
        sel.addEventListener('change', async (ev) => {
          const aid = ev.currentTarget.dataset.aid;
          const nextModel = ev.currentTarget.value;
          await applyQuickAgentModelOrRank(aid, { cliModel: nextModel }, 'part');
        });
      });

      cardsGrid.querySelectorAll('.part-member-chip').forEach(chip => {
        chip.addEventListener('click', () => {
          const aid = chip.dataset.focusAid;
          if (aid && studioSelectAgentFn) studioSelectAgentFn(aid, true);
        });
      });

      cardsGrid.querySelectorAll('.btn-recruit-part-staff').forEach(btn => {
        btn.addEventListener('click', async (ev) => {
          const pid = ev.currentTarget.dataset.roleId;
          const modSel = cardsGrid.querySelector(`.sel-recruit-staff-model[data-role-id="${pid}"]`);
          const chosenMod = (modSel?.value || '').trim();
          const fbBar = document.getElementById('partRolesFeedbackBar');
          ev.currentTarget.disabled = true;
          try {
            const res = await apiFetch('/ops/part-roles', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'recruit_staff', part_id: pid, model: chosenMod })
            });
            const d = await res.json().catch(() => ({}));
            if (res.ok && d.ok) {
              if (d.character_configs) syncServerCharConfigsIntoRuntime(d.character_configs, true);
              if (d.teams_summary) renderTeamsAndWorkspacesDashboard(d.teams_summary, true);
              if (d.part_roles) syncPartRolesToDOM(d.part_roles, true);
              if (fbBar) {
                fbBar.style.display = 'block';
                fbBar.textContent = `✓ ${d.message || '새 SDK 부하직원이 파트에 배치되었습니다.'}`;
              }
            } else {
              alert(d.error || '사원 충원에 실패했습니다.');
            }
          } finally {
            ev.currentTarget.disabled = false;
          }
        });
      });

      cardsGrid.querySelectorAll('.chk-toggle-part-role').forEach(chk => {
        chk.addEventListener('change', async (ev) => {
          const rid = ev.currentTarget.dataset.roleId;
          const enabled = ev.currentTarget.checked;
          const res = await apiFetch('/ops/part-roles', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'update', id: rid, enabled })
          });
          const d = await res.json().catch(() => ({}));
          if (res.ok && d.part_roles) syncPartRolesToDOM(d.part_roles, true);
          else {
            alert(d.error || '최소 1개 이상의 파트는 활성 상태여야 합니다.');
            ev.currentTarget.checked = !enabled;
          }
        });
      });

      cardsGrid.querySelectorAll('.btn-move-part-role').forEach(btn => {
        btn.addEventListener('click', async (ev) => {
          const rid = ev.currentTarget.dataset.roleId;
          const direction = ev.currentTarget.dataset.dir;
          const res = await apiFetch('/ops/part-roles', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'reorder', id: rid, direction })
          });
          const d = await res.json().catch(() => ({}));
          if (res.ok && d.part_roles) syncPartRolesToDOM(d.part_roles, true);
        });
      });

      cardsGrid.querySelectorAll('.btn-edit-part-role').forEach(btn => {
        btn.addEventListener('click', async (ev) => {
          const rid = ev.currentTarget.dataset.roleId;
          const targetObj = rid === 'LEAD' ? lead : parts.find(x => x.id === rid);
          if (!targetObj) return;
          const nextName = prompt(`[${targetObj.name}] 표시 이름을 수정하세요:`, targetObj.name);
          if (nextName === null) return;
          const nextStage = rid === 'LEAD'
            ? targetObj.stage_label
            : prompt(`[${nextName || targetObj.name}] 파이프라인 단계 라벨을 수정하세요:`, targetObj.stage_label || targetObj.name);
          if (nextStage === null) return;
          const nextInst = prompt(`[${nextName || targetObj.name}] 전담 업무 및 검증 지침을 수정하세요:`, targetObj.instruction || '');
          if (nextInst === null) return;
          const res = await apiFetch('/ops/part-roles', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'update',
              id: rid,
              name: nextName.trim() || targetObj.name,
              stage_label: (nextStage || '').trim() || targetObj.stage_label,
              instruction: nextInst.trim() || targetObj.instruction
            })
          });
          const d = await res.json().catch(() => ({}));
          if (res.ok && d.part_roles) syncPartRolesToDOM(d.part_roles, true);
        });
      });

      cardsGrid.querySelectorAll('.btn-delete-part-role').forEach(btn => {
        btn.addEventListener('click', async (ev) => {
          const rid = ev.currentTarget.dataset.roleId;
          const targetObj = parts.find(x => x.id === rid);
          if (!confirm(`[${targetObj?.name || rid}] 파트를 파이프라인에서 제거하시겠습니까?`)) return;
          const res = await apiFetch('/ops/part-roles', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'delete', id: rid })
          });
          const d = await res.json().catch(() => ({}));
          if (res.ok && d.part_roles) syncPartRolesToDOM(d.part_roles, true);
          else if (d.error) alert(d.error);
        });
      });
    }

    // 2. Bind #partRoleAddForm & #btnResetPartRoles once
    const addForm = document.getElementById('partRoleAddForm');
    if (addForm && !addForm.dataset.bound) {
      addForm.dataset.bound = '1';
      addForm.addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const iconVal = document.getElementById('newPartIconSelect')?.value || '🧩';
        const nameInp = document.getElementById('newPartNameInput');
        const stageInp = document.getElementById('newPartStageInput');
        const instInp = document.getElementById('newPartInstInput');
        const fbBar = document.getElementById('partRolesFeedbackBar');
        const nameVal = (nameInp?.value || '').trim();
        if (!nameVal) return;
        const res = await apiFetch('/ops/part-roles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'add',
            icon: iconVal,
            name: nameVal,
            stage_label: (stageInp?.value || '').trim(),
            instruction: (instInp?.value || '').trim()
          })
        });
        const d = await res.json().catch(() => ({}));
        if (res.ok && d.part_roles) {
          if (nameInp) nameInp.value = '';
          if (stageInp) stageInp.value = '';
          if (instInp) instInp.value = '';
          syncPartRolesToDOM(d.part_roles, true);
          if (fbBar) {
            fbBar.style.display = 'block';
            fbBar.textContent = `✓ ${d.message || '새 파트가 파이프라인에 추가되었습니다.'}`;
          }
        }
      });
    }
    const sdkSquadBtn = document.getElementById('btnApplySdkSquadPreset');
    if (sdkSquadBtn && !sdkSquadBtn.dataset.bound) {
      sdkSquadBtn.dataset.bound = '1';
      sdkSquadBtn.addEventListener('click', async () => {
        const fbBar = document.getElementById('partRolesFeedbackBar');
        sdkSquadBtn.disabled = true;
        try {
          const res = await apiFetch('/ops/part-roles', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'apply_sdk_squad' })
          });
          const d = await res.json().catch(() => ({}));
          if (res.ok && d.ok) {
            if (d.character_configs) syncServerCharConfigsIntoRuntime(d.character_configs, true);
            if (d.teams_summary) renderTeamsAndWorkspacesDashboard(d.teams_summary, true);
            if (d.part_roles) syncPartRolesToDOM(d.part_roles, true);
            if (fbBar) {
              fbBar.style.display = 'block';
              fbBar.textContent = `✓ ${d.message || '10인 Antigravity SDK 표준 편제가 적용되었습니다.'}`;
            }
          } else if (d.error) {
            alert(d.error);
          }
        } finally {
          sdkSquadBtn.disabled = false;
        }
      });
    }
    const resetBtn = document.getElementById('btnResetPartRoles');
    if (resetBtn && !resetBtn.dataset.bound) {
      resetBtn.dataset.bound = '1';
      resetBtn.addEventListener('click', async () => {
        if (!confirm('총괄팀장 + 기본 3대 파트(자료수집 · 기획구조 · 제작구현) 구성으로 복원하시겠습니까?')) return;
        const res = await apiFetch('/ops/part-roles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'reset' })
        });
        const d = await res.json().catch(() => ({}));
        if (res.ok && d.part_roles) syncPartRolesToDOM(d.part_roles, true);
      });
    }

    // 3. Sync #studioQuickRole dropdown dynamically
    const quickRoleSel = document.getElementById('studioQuickRole');
    if (quickRoleSel && document.activeElement !== quickRoleSel && assignable.length) {
      const curVal = normalizeAgentPartRoleId(quickRoleSel.value || 'LEAD');
      quickRoleSel.innerHTML = assignable.map(r => {
        const offTag = r.enabled === false ? ' [비활성]' : '';
        return `<option value="${escHtml(r.id)}" ${r.id === curVal ? 'selected' : ''}>${escHtml(r.icon || '🧩')} ${escHtml(r.name)} (${escHtml(r.id)})${offTag}</option>`;
      }).join('') + `<option value="__add_new_part__">➕ 새 실무 파트 직접 추가...</option>`;
    }

    // 4. Sync #triadPipelineSteps dynamically on settings.html
    const stepsWrap = document.getElementById('triadPipelineSteps');
    if (stepsWrap && stages.length) {
      stepsWrap.innerHTML = stages.map(st => {
        const idxStr = String(st.index).padStart(2, '0');
        return `<div class="triad-step" data-stage="${escHtml(st.stage)}"><b>${idxStr} · ${escHtml(st.title)}</b><span>${escHtml(st.icon || '')} ${escHtml(st.role_name || '')}</span></div>`;
      }).join('');
    }
  }

  // 각 AI CLI의 로그인 계정 요금제(Plan) 자동 감지 및 일일 제한(Daily) / 월간 제한(Monthly) 구분 계산
  // 주의: 구글 개인 계정(@gmail.com) OAuth 토큰은 Google One 개인 구독 등급을 노출하지 않으므로 임의로 Pro로 단정하지 않고 기본 Free로 표시 후 직접 선택 지원
  const CLI_QUOTA_CAPS = {
    claude: { domain: 'ANTHROPIC', dailyCalls: 0, dailyTokens: 0, monthlyCalls: 0, monthlyTokens: 0, planName: '미구독 (연결된 플랜 없음)', planLabel: '미구독 (로그인 안 됨)', isSubscribed: false, isPaid: false, accountEmail: null },
    antigravity: { domain: 'GOOGLE', dailyCalls: 20, dailyTokens: 120000, monthlyCalls: 600, monthlyTokens: 3600000, planName: 'Google 계정 연결됨 (기본 Free 적용 · Pro/Ultra 구독 시 직접 선택)', planLabel: 'Google Free (또는 구독 직접 선택)', isSubscribed: true, isPaid: false, accountEmail: null },
    antigravity_sdk: { domain: 'SDK', dailyCalls: 80, dailyTokens: 600000, monthlyCalls: 2400, monthlyTokens: 18000000, planName: 'Antigravity SDK · 로컬 구독/오픈모델 공유 ($0 · API 키 차단)', planLabel: 'SDK 구독·로컬 공유 ($0)', isSubscribed: true, isPaid: false, accountEmail: null },
    gemini: { domain: 'GEMINI2', dailyCalls: 0, dailyTokens: 0, monthlyCalls: 0, monthlyTokens: 0, planName: '서브 구글 계정 (계정 2) 로그인 필요', planLabel: '미로그인 (계정 2 로그인 대기)', isSubscribed: false, isPaid: false, accountEmail: null },
    openai: { domain: 'OPENAI', dailyCalls: 15, dailyTokens: 60000, monthlyCalls: 300, monthlyTokens: 1200000, planName: 'ChatGPT Free (무료 플랜 · 유료 미구독)', planLabel: 'ChatGPT Free (무료 플랜)', isSubscribed: true, isPaid: false, accountEmail: null },
    grok: { domain: 'XAI', dailyCalls: 0, dailyTokens: 0, monthlyCalls: 0, monthlyTokens: 0, planName: '미구독 (연결된 플랜 없음)', planLabel: '미구독 (로그인 안 됨)', isSubscribed: false, isPaid: false, accountEmail: null }
  };
  let latestUsageByProvider = {
    ANTHROPIC: { calls: 0, tokens: 0, monthly_calls: 0, monthly_tokens: 0 },
    GOOGLE: { calls: 1, tokens: 0, monthly_calls: 1, monthly_tokens: 0 },
    SDK: { calls: 0, tokens: 0, monthly_calls: 0, monthly_tokens: 0 },
    GEMINI2: { calls: 0, tokens: 0, monthly_calls: 0, monthly_tokens: 0 },
    OPENAI: { calls: 2, tokens: 53475, monthly_calls: 2, monthly_tokens: 53475 },
    XAI: { calls: 0, tokens: 0, monthly_calls: 0, monthly_tokens: 0 }
  };

  function getCliQuotaStatus(cliKey) {
    const diagProv = lastDiagnostics?.providers?.[cliKey] || null;
    const baseCap = CLI_QUOTA_CAPS[cliKey] || CLI_QUOTA_CAPS[diagProv?.base_type] || CLI_QUOTA_CAPS.gemini || CLI_QUOTA_CAPS.claude;

    const isSubscribed = diagProv && typeof diagProv.is_subscribed === 'boolean' ? diagProv.is_subscribed : baseCap.isSubscribed;
    const isPaid = diagProv && typeof diagProv.is_paid === 'boolean' ? diagProv.is_paid : baseCap.isPaid;
    const planName = (diagProv && diagProv.plan_name) ? diagProv.plan_name : baseCap.planName;
    const planLabel = (diagProv && diagProv.plan_label) ? diagProv.plan_label : baseCap.planLabel;
    const accountEmail = (diagProv && diagProv.account_email) ? diagProv.account_email : baseCap.accountEmail;

    const dailyMaxCalls = (diagProv && typeof diagProv.daily_max_calls === 'number') ? diagProv.daily_max_calls : baseCap.dailyCalls;
    const dailyMaxTokens = (diagProv && typeof diagProv.daily_max_tokens === 'number') ? diagProv.daily_max_tokens : baseCap.dailyTokens;
    const monthlyMaxCalls = (diagProv && typeof diagProv.monthly_max_calls === 'number') ? diagProv.monthly_max_calls : baseCap.monthlyCalls;
    const monthlyMaxTokens = (diagProv && typeof diagProv.monthly_max_tokens === 'number') ? diagProv.monthly_max_tokens : baseCap.monthlyTokens;

    const used = latestUsageByProvider[baseCap.domain] || { calls: 0, tokens: 0, monthly_calls: 0, monthly_tokens: 0 };
    const dailyUsedCalls = (diagProv && typeof diagProv.measured_daily_calls === 'number') ? Math.max(used.calls || 0, diagProv.measured_daily_calls) : (used.calls || 0);
    const dailyUsedTokens = (diagProv && typeof diagProv.measured_daily_tokens === 'number') ? Math.max(used.tokens || 0, diagProv.measured_daily_tokens) : (used.tokens || 0);
    const monthlyUsedCalls = (diagProv && typeof diagProv.measured_monthly_calls === 'number') ? Math.max(used.monthly_calls || 0, diagProv.measured_monthly_calls) : (used.monthly_calls || dailyUsedCalls);
    const monthlyUsedTokens = (diagProv && typeof diagProv.measured_monthly_tokens === 'number') ? Math.max(used.monthly_tokens || 0, diagProv.measured_monthly_tokens) : (used.monthly_tokens || dailyUsedTokens);

    const hasServerRatePct = Boolean(diagProv && typeof diagProv.server_primary_used_percent === 'number');
    const serverUsedPct = hasServerRatePct ? Number(diagProv.server_primary_used_percent) : null;
    const serverResetsAt = diagProv?.server_primary_resets_at || null;
    const telemetrySource = diagProv?.telemetry_source || null;

    // 1) 미구독 / 미로그인 상태인 경우
    if (!isSubscribed || dailyMaxCalls <= 0) {
      return {
        cliKey,
        isSubscribed: false,
        isPaid: false,
        planName,
        planLabel,
        accountEmail,
        calls: 0,
        maxCalls: 0,
        tokens: 0,
        maxTokens: 0,
        dailyPct: 0,
        dailyRemainPct: 0,
        monthlyUsedCalls: 0,
        monthlyMaxCalls: 0,
        monthlyPct: 0,
        monthlyRemainPct: 0,
        pct: 0,
        remainPct: 0,
        hasServerRatePct: false,
        serverResetsAt: null,
        telemetrySource,
        level: 'unsub',
        statusBadgeText: '미구독 · 일일 0% / 월간 0%',
        topSummaryText: '일일 0/0회 · 월간 0/0회',
        bottomMetaText: `플랜: ${planName} · 클릭해 로그인`
      };
    }

    // 2) 일일 제한(Daily Limit) 및 월간 제한(Monthly Limit) 각각 계산
    const dCallPct = (dailyUsedCalls / dailyMaxCalls) * 100;
    const dTokPct = dailyMaxTokens > 0 ? (dailyUsedTokens / dailyMaxTokens) * 100 : 0;
    const dailyPct = Math.min(100, Math.max(0, Math.round(Math.max(dCallPct, dTokPct))));
    const dailyRemainPct = Math.max(0, 100 - dailyPct);

    const mCallPct = monthlyMaxCalls > 0 ? (monthlyUsedCalls / monthlyMaxCalls) * 100 : 0;
    const mTokPct = monthlyMaxTokens > 0 ? (monthlyUsedTokens / monthlyMaxTokens) * 100 : 0;
    const monthlyPct = hasServerRatePct
      ? Math.min(100, Math.max(0, Math.round(serverUsedPct)))
      : Math.min(100, Math.max(0, Math.round(Math.max(mCallPct, mTokPct))));
    const monthlyRemainPct = Math.max(0, 100 - monthlyPct);

    const pct = dailyPct;
    const remainPct = dailyRemainPct;
    const level = pct >= 85 ? 'danger' : pct >= 65 ? 'warn' : (!isPaid ? 'free' : 'safe');

    return {
      cliKey,
      isSubscribed: true,
      isPaid,
      planName,
      planLabel,
      accountEmail,
      calls: dailyUsedCalls,
      maxCalls: dailyMaxCalls,
      tokens: dailyUsedTokens,
      maxTokens: dailyMaxTokens,
      dailyPct,
      dailyRemainPct,
      monthlyUsedCalls,
      monthlyMaxCalls,
      monthlyUsedTokens,
      monthlyMaxTokens,
      monthlyPct,
      monthlyRemainPct,
      pct,
      remainPct,
      hasServerRatePct,
      serverUsedPct,
      serverResetsAt,
      telemetrySource,
      level,
      statusBadgeText: `일일 잔여 ${dailyRemainPct}% · 월간 잔여 ${monthlyRemainPct}%${hasServerRatePct ? ' (서버실측)' : ''}`,
      topSummaryText: `일일 ${dailyUsedCalls}/${dailyMaxCalls}회 (${(dailyUsedTokens / 1000).toFixed(1)}k tok) · 월간 ${monthlyUsedCalls}/${monthlyMaxCalls}회`,
      bottomMetaText: `구독 플랜: ${planName}${serverResetsAt ? ` · 리셋: ${serverResetsAt}` : ''}`
    };
  }

  function renderCliQuotaGauges(usageObj = null) {
    if (usageObj && usageObj.by_provider) {
      latestUsageByProvider = { ...latestUsageByProvider, ...usageObj.by_provider };
    }
    ['head', 'builder', 'sub_builder', 'reviewer', 'researcher'].forEach(roleKey => {
      const cliKey = currentRoles[roleKey] || (roleKey === 'researcher' ? 'grok' : roleKey === 'sub_builder' ? 'gemini' : 'claude');
      const q = getCliQuotaStatus(cliKey);

      document.querySelectorAll(`[data-quota-role="${roleKey}"] .cli-quota-top > span`).forEach(el => {
        el.textContent = q.isSubscribed
          ? (q.isPaid ? `✓ 구독 플랜: ${q.planLabel}` : `● 무료 플랜: ${q.planLabel}`)
          : `✕ ${q.planLabel}`;
      });
      document.querySelectorAll(`[data-quota-text="${roleKey}"]`).forEach(el => {
        el.textContent = q.topSummaryText;
      });
      document.querySelectorAll(`[data-quota-bar="${roleKey}"]`).forEach(el => {
        el.className = `cli-quota-fill ${q.level}`;
        el.style.width = q.isSubscribed ? `${q.dailyRemainPct}%` : '0%';
      });
      document.querySelectorAll(`[data-quota-tokens="${roleKey}"]`).forEach(el => {
        el.textContent = q.bottomMetaText;
      });
      document.querySelectorAll(`[data-quota-badge="${roleKey}"]`).forEach(el => {
        el.className = `cli-quota-pct ${q.level}`;
        el.textContent = q.statusBadgeText;
      });
    });

    // 캐릭터 스튜디오의 3대 CLI 선택 카드에도 구독 플랜 + 일일/월간 잔여 한도 표시
    document.querySelectorAll('#studioCliCardGroup .studio-cli-card').forEach(btn => {
      const cliKey = btn.dataset.cliVal;
      if (!cliKey) return;
      const q = getCliQuotaStatus(cliKey);
      let gaugeWrap = btn.querySelector('.studio-card-quota');
      if (!gaugeWrap) {
        gaugeWrap = document.createElement('div');
        gaugeWrap.className = 'studio-card-quota';
        gaugeWrap.style.marginTop = '4px';
        btn.appendChild(gaugeWrap);
      }
      const badgeCol = !q.isSubscribed ? '#64748b' : q.level === 'danger' ? '#dc2626' : q.level === 'warn' ? '#d97706' : !q.isPaid ? '#0284c7' : '#15803d';
      gaugeWrap.innerHTML = `
        <div style="font-size:7.5px;font-weight:800;color:${badgeCol};margin-bottom:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${q.planName}">${q.planLabel}</div>
        <div class="cli-quota-track" style="height:5px"><span class="cli-quota-fill ${q.level}" style="width:${q.isSubscribed ? q.dailyRemainPct : 0}%"></span></div>
        <div style="display:flex;justify-content:space-between;font-size:7px;color:#475569;margin-top:2px">
          <span>${q.isSubscribed ? `일일 잔여 ${q.dailyRemainPct}%` : '미구독/미로그인'}</span>
          <b style="color:${badgeCol}">${q.isSubscribed ? `월간 잔여 ${q.monthlyRemainPct}%` : '한도 0'}</b>
        </div>
      `;
    });

    window.NEXUS_CLI_QUOTA = { getCliQuotaStatus, latestUsageByProvider, CLI_QUOTA_CAPS };
    if (typeof renderConnectedAccountsList === 'function') {
      renderConnectedAccountsList(lastDiagnostics);
    }
  }

  function renderConnectedAccountsList(diag) {
    const gridEl = document.getElementById('connectedAccountsGrid');
    const countBadge = document.getElementById('connectedAccountsCountBadge');
    if (!gridEl) return;

    const providers = (diag || lastDiagnostics || {}).providers || {};
    const connectedEntries = Object.entries(providers).filter(([, p]) => p && p.auth_state === 'LOGGED_IN');

    if (countBadge) {
      countBadge.textContent = connectedEntries.length > 0
        ? `연결된 계정 ${connectedEntries.length}개 활성`
        : '연결된 계정 없음';
    }

    if (connectedEntries.length === 0) {
      gridEl.innerHTML = `
        <div style="grid-column:1/-1;padding:18px 20px;border-radius:12px;border:1px dashed #cbd5e1;background:#f8fafc;display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
          <div style="font-size:12px;color:#475569">현재 로그인(연결)된 AI 계정이 없습니다. 아래 CLI 설정 섹션에서 계정을 로그인해 주세요.</div>
          <a href="#cliAuthSection" class="btn small primary">🔑 AI 계정 로그인하러 가기 ↓</a>
        </div>
      `;
      return;
    }

    gridEl.innerHTML = connectedEntries.map(([key, p]) => {
      const q = getCliQuotaStatus(key);
      const dispTitle = p.label || key;
      const emailTxt = p.account_email || '로그인 계정 확인됨';
      const curModelTxt = p.selected_model_display || 'CLI 기본 설정 모델';
      return `
        <div class="triad-role-card" data-connected-slot="${escHtml(key)}">
          <div class="triad-role-top">
            <strong style="font-size:12.5px;font-weight:800;color:#0f172a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escHtml(dispTitle)}">${escHtml(dispTitle)}</strong>
            <span class="cli-auth-badge LOGGED_IN" style="flex-shrink:0">✓ 연결됨</span>
          </div>
          <div class="triad-role-meta" style="gap:6px;flex-wrap:wrap">
            <span title="로그인 계정 이메일">👤 ${escHtml(emailTxt)}</span>
            <strong style="color:#0f6848;font-size:10px" title="현재 선택된 세부 모델">🤖 ${escHtml(curModelTxt)}</strong>
          </div>
          <div class="cli-quota-box" style="margin-top:0">
            <div class="cli-quota-top">
              <span>${q.isPaid ? `✓ 유료 구독: ${escHtml(q.planLabel)}` : `● 무료 플랜: ${escHtml(q.planLabel)}`}</span>
              <strong>${escHtml(q.topSummaryText)}</strong>
            </div>
            <div class="cli-quota-track"><span class="cli-quota-fill ${q.level}" style="width:${q.isSubscribed ? q.dailyRemainPct : 0}%"></span></div>
            <div class="cli-quota-meta">
              <span>${escHtml(q.bottomMetaText)}</span>
              <span class="cli-quota-pct ${q.level}">${escHtml(q.statusBadgeText)}</span>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  function applyRolesToDOM(roles) {
    currentRoles = { ...currentRoles, ...roles };
    try { localStorage.setItem(ROLE_STORAGE_KEY, JSON.stringify(currentRoles)); } catch (_) { }

    // 1. Update role select dropdowns
    document.querySelectorAll('[data-role-select]').forEach(sel => {
      const rKey = sel.dataset.roleSelect;
      if (currentRoles[rKey]) sel.value = currentRoles[rKey];
    });

    // 2. Update pipeline labels on index.html
    const pHead1 = document.getElementById('pipeLabelHead1');
    const pBuilder = document.getElementById('pipeLabelBuilder');
    const pReviewer = document.getElementById('pipeLabelReviewer');
    const pHead2 = document.getElementById('pipeLabelHead2');
    if (pHead1) pHead1.textContent = `HEAD · ${CLI_SHORT[currentRoles.head] || currentRoles.head}`;
    if (pBuilder) pBuilder.textContent = `BUILDER · ${CLI_SHORT[currentRoles.builder] || currentRoles.builder}`;
    if (pReviewer) pReviewer.textContent = `REVIEWER · ${CLI_SHORT[currentRoles.reviewer] || currentRoles.reviewer}`;
    if (pHead2) pHead2.textContent = `HEAD · ${CLI_SHORT[currentRoles.head] || currentRoles.head}`;

    // 3. Update dashboard table CLI pills
    const updatePill = (id, cliKey) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.className = `cli-pill ${cliKey}`;
      el.textContent = CLI_LABELS[cliKey] || cliKey;
    };
    updatePill('tableCliHead', currentRoles.head);
    updatePill('tableCliBuilder', currentRoles.builder);
    updatePill('tableCliSubBuilder', currentRoles.sub_builder || 'gemini');
    updatePill('tableCliReviewer', currentRoles.reviewer);
    updatePill('tableCliResearcher', currentRoles.researcher || 'grok');

    // 4. Update agents.html role badges
    document.querySelectorAll('[data-role-badge]').forEach(badge => {
      const rKey = badge.dataset.roleBadge;
      const cliKey = currentRoles[rKey];
      if (!cliKey) return;
      const num = (badge.textContent.match(/#\d+/) || ['#001'])[0];
      badge.textContent = `${rKey.toUpperCase()} · ${CLI_LABELS[cliKey]} · ${num}`;
    });

    // 5. Sync modularAgents #01 (HEAD), #05 (BUILDER), #13 (REVIEWER)
    const mHead = modularAgents.find(a => a.id === '01');
    const mBuilder = modularAgents.find(a => a.id === '05');
    const mReviewer = modularAgents.find(a => a.id === '13');
    if (mHead) mHead.dept = `HEAD · 총괄 지휘 (${CLI_SHORT[currentRoles.head]})`;
    if (mBuilder) mBuilder.dept = `BUILDER · 구현 (${CLI_SHORT[currentRoles.builder]})`;
    if (mReviewer) mReviewer.dept = `REVIEWER · 독립 검수 (${CLI_SHORT[currentRoles.reviewer]})`;
    renderCliQuotaGauges();
  }

  function updatePipelinePhaseDOM(phase, events = [], usage = null) {
    const dynStages = (currentPartRoles && Array.isArray(currentPartRoles.pipeline_stages) && currentPartRoles.pipeline_stages.length)
      ? currentPartRoles.pipeline_stages.map(s => s.stage)
      : ['LEAD_PLANNING', 'PART_RESEARCH', 'PART_STRUCTURE', 'PART_BUILD', 'PART_REVIEW', 'LEAD_REPORT', 'AWAITING_APPROVAL'];
    const legacyAliasPhase = {
      PLANNING: 'LEAD_PLANNING',
      BUILDING: 'PART_BUILD',
      VERIFYING: 'PART_REVIEW',
      REVIEWING: 'PART_REVIEW',
      DECIDING: 'LEAD_REPORT'
    }[phase] || phase;
    const atIdx = dynStages.indexOf(legacyAliasPhase);

    document.querySelectorAll('#triadPipelineSteps .triad-step').forEach(stepEl => {
      const st = stepEl.dataset.stage;
      const idx = dynStages.indexOf(st);
      stepEl.classList.toggle('on', idx === atIdx && atIdx >= 0);
      stepEl.classList.toggle('done', atIdx > idx && atIdx >= 0);
    });

    // Highlight active role card
    const cardHead = document.getElementById('roleCardHead');
    const cardBuilder = document.getElementById('roleCardBuilder');
    const cardReviewer = document.getElementById('roleCardReviewer');
    cardHead?.classList.toggle('active-stage', phase === 'PLANNING' || phase === 'DECIDING');
    cardBuilder?.classList.toggle('active-stage', phase === 'BUILDING');
    cardReviewer?.classList.toggle('active-stage', phase === 'REVIEWING');

    const lblHead = document.getElementById('headStatusLabel');
    const lblBuilder = document.getElementById('builderStatusLabel');
    const lblReviewer = document.getElementById('reviewerStatusLabel');
    if (lblHead) lblHead.textContent = (phase === 'PLANNING' || phase === 'DECIDING') ? `실행 중 (${phase})` : '대기 (STANDBY)';
    if (lblBuilder) lblBuilder.textContent = phase === 'BUILDING' ? '실행 중 (BUILDING)' : '대기 (STANDBY)';
    if (lblReviewer) lblReviewer.textContent = phase === 'REVIEWING' ? '실행 중 (REVIEWING)' : '대기 (STANDBY)';

    const statPhase = document.getElementById('statActivePhase');
    const statSub = document.getElementById('statActiveSub');
    const activeProvsNow = getActiveCliProvidersMap();
    const activeEngineNames = Object.keys(activeProvsNow)
      .map(k => CLI_SHORT[k] || (activeProvsNow[k]?.label || k).replace(/\s*\(.*?\)\s*/g, '').trim())
      .join(' · ') || 'AGY SDK';
    const runningMissionsCnt = Array.isArray(latestActivitySnapshot?.missions)
      ? latestActivitySnapshot.missions.filter(m => m && m.status === 'RUNNING').length
      : 0;
    const teamsCnt = Array.isArray(window.NEXUS_TEAMS_SUMMARY?.teams) ? window.NEXUS_TEAMS_SUMMARY.teams.length : 2;
    if (statPhase) statPhase.textContent = phase === 'IDLE' ? 'STANDBY' : phase;
    if (statSub) {
      statSub.textContent = (phase === 'IDLE' && runningMissionsCnt === 0)
        ? `${teamsCnt}개 팀 · ${modularAgents.length}명 에이전트 대기 (${activeEngineNames})`
        : `${runningMissionsCnt > 0 ? `${runningMissionsCnt}개 팀 가동 중 · ` : ''}${phase} 단계 실행 중`;
    }

    const topText = document.getElementById('topSystemText');
    if (topText) {
      topText.textContent = (phase === 'IDLE' && runningMissionsCnt === 0)
        ? `STANDBY · ${activeEngineNames} (${teamsCnt}팀 · ${modularAgents.length}명 연동)`
        : `LIVE · ${phase} 실행 중 (${activeEngineNames})`;
    }

    // Update dashboard activity feed if events provided
    if (Array.isArray(events) && events.length > 0) {
      const dashFeed = document.getElementById('dashboardActivity');
      if (dashFeed) {
        dashFeed.innerHTML = events.slice(0, 5).map(ev => {
          const icoClass = ev.role === 'REVIEWER' ? 'ico-amber' : ev.role === 'BUILDER' ? 'ico-blue' : ev.role === 'DIRECTOR' ? 'ico-purple' : 'ico-mint';
          const icoChar = ev.to_state === 'PASS' ? '✓' : ev.role === 'REVIEWER' ? '◷' : ev.role === 'BUILDER' ? '↗' : '⌁';
          return `<div class="activity-item">
            <div class="event-icon ${icoClass}">${icoChar}</div>
            <div class="event-main">
              <div class="event-title">${ev.state_ko || ev.to_state}</div>
              <div class="event-desc">${ev.role || 'TRIAD'} · ${ev.run_id || 'mission'}</div>
            </div>
            <div class="event-time">실시간</div>
          </div>`;
        }).join('');
      }
      const agentLog = document.getElementById('activity');
      if (agentLog) {
        agentLog.innerHTML = events.slice(0, 8).map(ev => {
          const icoClass = ev.role === 'REVIEWER' ? 'ico-amber' : ev.role === 'BUILDER' ? 'ico-blue' : ev.role === 'DIRECTOR' ? 'ico-purple' : 'ico-mint';
          const icoChar = ev.to_state === 'PASS' ? '✓' : ev.role === 'REVIEWER' ? '◷' : ev.role === 'BUILDER' ? '↗' : '⌁';
          return `<div class="log-row">
            <div class="log-marker ${icoClass}">${icoChar}</div>
            <div class="log-copy">
              <strong>${ev.role || 'TRIAD'} · ${ev.to_state}</strong>
              <p>${ev.state_ko || ''}</p>
              <time>실시간 · ${ev.run_id || 'triad'}</time>
            </div>
          </div>`;
        }).join('');
      }
    }

    if (usage && usage.total) {
      const usageSummary = document.getElementById('usageTotalSummary');
      if (usageSummary) {
        const tokMan = (usage.total.tokens / 10000).toFixed(1);
        usageSummary.textContent = `전체 ${usage.total.calls}회 CLI 호출 · ~${tokMan}만 토큰 (구독 세션 · API 비용 $0)`;
      }
      renderCliQuotaGauges(usage);
    }
  }

  // Bind Role Swap Dropdowns (supports selecting "+ 새 CLI 로그인 추가..." directly from dropdown)
  document.querySelectorAll('[data-role-select]').forEach(sel => {
    sel.addEventListener('change', async (e) => {
      const changedRole = e.target.dataset.roleSelect;
      const newCli = e.target.value;
      if (newCli === '__add_new_cli__') {
        e.target.value = currentRoles[changedRole] || 'claude';
        await promptAndAddCliSlotFromSelect(async (addedKey) => {
          const nextR = { ...currentRoles, [changedRole]: addedKey };
          applyRolesToDOM(nextR);
          try {
            await apiFetch('/ops/roles', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(nextR)
            });
          } catch (_) { }
        });
        return;
      }
      const nextRoles = { ...currentRoles };
      const conflictRole = Object.keys(nextRoles).find(r => nextRoles[r] === newCli && r !== changedRole);
      if (conflictRole) {
        nextRoles[conflictRole] = currentRoles[changedRole];
      }
      nextRoles[changedRole] = newCli;
      applyRolesToDOM(nextRoles);

      try {
        await apiFetch('/ops/roles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(nextRoles)
        });
        pollOrchestrator();
      } catch (_) { }
    });
  });

  // Fallback client-side pipeline runner when running under static file server
  function startLocalPipelineFallback(goal) {
    if (localPipelineTimer) clearInterval(localPipelineTimer);
    const stages = [
      { phase: 'PLANNING', role: 'HEAD', msg: `HEAD(${CLI_LABELS[currentRoles.head]})가 '${goal}' 목표의 ORDER를 수립했습니다.` },
      { phase: 'BUILDING', role: 'BUILDER', msg: `BUILDER(${CLI_LABELS[currentRoles.builder]})가 격리 Worktree에 전체 파일 JSON을 제안했습니다.` },
      { phase: 'VERIFYING', role: 'DIRECTOR', msg: `DIRECTOR Scope Guard 경로·파일 상한 및 테스트 검증을 통과했습니다.` },
      { phase: 'REVIEWING', role: 'REVIEWER', msg: `REVIEWER(${CLI_LABELS[currentRoles.reviewer]}) 독립 검수 통과 (verdict: pass).` },
      { phase: 'DECIDING', role: 'HEAD', msg: `HEAD(${CLI_LABELS[currentRoles.head]}) 최종 PASS 판정 및 산출물 안전 반영 완료.` }
    ];
    let stepIdx = 0;
    const localEvents = [];
    const stepFn = () => {
      if (stepIdx < stages.length) {
        const s = stages[stepIdx];
        localEvents.unshift({ to_state: s.phase, state_ko: s.msg, role: s.role, run_id: `local-s${stepIdx + 1}` });
        updatePipelinePhaseDOM(s.phase, localEvents);
        stepIdx++;
      } else {
        clearInterval(localPipelineTimer);
        localPipelineTimer = null;
        localEvents.unshift({ to_state: 'PASS', state_ko: `미션 완료: '${goal}' 검증 통과`, role: 'HEAD', run_id: 'local-done' });
        updatePipelinePhaseDOM('IDLE', localEvents);
      }
    };
    stepFn();
    localPipelineTimer = setInterval(stepFn, 1600);
  }

  const teamContinueFolderState = {};

  function getTeamContinueState(stateKey) {
    const k = stateKey || '__global__';
    if (!teamContinueFolderState[k]) {
      teamContinueFolderState[k] = { mode: 'new', dir: '' };
    }
    return teamContinueFolderState[k];
  }

  function formatShortFolderLabel(rawPath) {
    const s = String(rawPath || '').replace(/[\\/]+$/, '');
    if (!s) return '';
    const parts = s.split(/[\\/]/);
    return parts[parts.length - 1] || s;
  }

  function buildDispatchFolderSwitchButtonsHtml(stateKey) {
    const st = getTeamContinueState(stateKey);
    const isCont = st.mode === 'continue';
    return `
      <div class="dispatch-folder-mode-switch" data-fmode-switch="${escHtml(stateKey)}" role="group" aria-label="작업 폴더 연결 방식 선택">
        <button type="button" class="dispatch-fmode-btn ${!isCont ? 'active' : ''}" data-state-key="${escHtml(stateKey)}" data-fmode="new" title="새 프로젝트 작업 폴더(YYYYMMDD_프로젝트명)를 자동 생성하여 시작합니다">🆕 새 폴더로 시작</button>
        <button type="button" class="dispatch-fmode-btn ${isCont ? 'active' : ''}" data-state-key="${escHtml(stateKey)}" data-fmode="continue" title="기존에 작업했던 폴더를 선택해 파일들을 유지한 채 추가·수정 작업을 이어갑니다">📂 기존 폴더 이어하기</button>
      </div>
    `;
  }

  function buildDispatchContinueBarHtml(stateKey, teamName, initBrowseDir, recentFolders) {
    const st = getTeamContinueState(stateKey);
    const isCont = st.mode === 'continue';
    const recList = Array.isArray(recentFolders) ? recentFolders : [];
    const normCur = String(st.dir || '').trim();
    const inRec = normCur && recList.some(r => String(r.path || '').toLowerCase() === normCur.toLowerCase());
    const customOptHtml = (normCur && !inRec)
      ? `<option value="${escHtml(normCur)}" selected>📌 직접 선택: ${escHtml(formatShortFolderLabel(normCur))} (${escHtml(normCur)})</option>`
      : '';
    const recOptsHtml = recList.map(r => {
      const rPath = String(r.path || '');
      const isSel = normCur && rPath.toLowerCase() === normCur.toLowerCase();
      return `<option value="${escHtml(rPath)}" ${isSel ? 'selected' : ''}>📂 ${escHtml(r.name || formatShortFolderLabel(rPath))} (파일 ${Number(r.file_count || 0)}개)</option>`;
    }).join('');
    const chipHtml = normCur
      ? `<span class="dispatch-picked-chip" data-continue-chip="${escHtml(stateKey)}" style="background:#dcfce7;color:#166534;border:1px solid #86efac" title="${escHtml(normCur)}">✓ 이어할 폴더: <b>${escHtml(formatShortFolderLabel(normCur))}</b> <button type="button" class="btn-clear-continue-dir" data-state-key="${escHtml(stateKey)}" style="border:0;background:transparent;color:#15803d;font-weight:900;cursor:pointer;padding:0 2px;font-size:10px" title="선택 해제">✕</button></span>`
      : `<span class="dispatch-picked-chip" data-continue-chip="${escHtml(stateKey)}" style="background:#fffbeb;color:#b45309;border:1px solid #fde68a">최근 목록에서 고르거나 [🗂️ 폴더 선택]으로 기존 폴더를 지정하세요</span>`;

    return `
      <div class="dispatch-continue-bar" data-continue-bar="${escHtml(stateKey)}" style="display:${isCont ? 'flex' : 'none'}">
        <span style="font-size:10px;font-weight:800;color:#0369a1;white-space:nowrap">📂 기존 폴더 이어하기:</span>
        <select class="dispatch-recent-folder-select" data-state-key="${escHtml(stateKey)}" aria-label="${escHtml(teamName || '팀')} 최근 작업 폴더 목록">
          <option value="">📋 최근 작업 폴더 목록 (${recList.length}개)...</option>
          ${customOptHtml}
          ${recOptsHtml}
        </select>
        <button type="button" class="btn small btn-pick-continue-dir" data-state-key="${escHtml(stateKey)}" data-tname="${escHtml(teamName || '팀')}" data-init-dir="${escHtml(normCur || initBrowseDir || '')}" style="height:29px;padding:0 10px;font-size:10px;background:#ffffff;color:#0369a1;border-color:#38bdf8;font-weight:800;white-space:nowrap">🗂️ 폴더 선택...</button>
        ${chipHtml}
      </div>
    `;
  }

  function syncDispatchContinueUiForKey(rootEl, stateKey) {
    if (!rootEl) return;
    const st = getTeamContinueState(stateKey);
    const isCont = st.mode === 'continue';
    rootEl.querySelectorAll(`.dispatch-fmode-btn[data-state-key="${stateKey}"]`).forEach(b => {
      b.classList.toggle('active', b.dataset.fmode === st.mode);
    });
    const bar = rootEl.querySelector(`[data-continue-bar="${stateKey}"]`);
    if (bar) {
      bar.style.display = isCont ? 'flex' : 'none';
      const sel = bar.querySelector('.dispatch-recent-folder-select');
      const pickBtn = bar.querySelector('.btn-pick-continue-dir');
      const normCur = String(st.dir || '').trim();
      if (sel) {
        if (normCur) {
          let matched = Array.from(sel.options).find(o => o.value.toLowerCase() === normCur.toLowerCase());
          if (!matched) {
            matched = document.createElement('option');
            matched.value = normCur;
            matched.textContent = `📌 직접 선택: ${formatShortFolderLabel(normCur)} (${normCur})`;
            sel.insertBefore(matched, sel.options[1] || null);
          }
          sel.value = matched.value;
        } else {
          sel.value = '';
        }
      }
      if (pickBtn && normCur) {
        pickBtn.dataset.initDir = normCur;
      }
      const oldChip = bar.querySelector(`[data-continue-chip="${stateKey}"]`);
      if (oldChip) {
        const wrap = document.createElement('span');
        wrap.innerHTML = normCur
          ? `<span class="dispatch-picked-chip" data-continue-chip="${escHtml(stateKey)}" style="background:#dcfce7;color:#166534;border:1px solid #86efac" title="${escHtml(normCur)}">✓ 이어할 폴더: <b>${escHtml(formatShortFolderLabel(normCur))}</b> <button type="button" class="btn-clear-continue-dir" data-state-key="${escHtml(stateKey)}" style="border:0;background:transparent;color:#15803d;font-weight:900;cursor:pointer;padding:0 2px;font-size:10px" title="선택 해제">✕</button></span>`
          : `<span class="dispatch-picked-chip" data-continue-chip="${escHtml(stateKey)}" style="background:#fffbeb;color:#b45309;border:1px solid #fde68a">최근 목록에서 고르거나 [🗂️ 폴더 선택]으로 기존 폴더를 지정하세요</span>`;
        const newChip = wrap.firstElementChild;
        if (newChip) {
          oldChip.replaceWith(newChip);
          newChip.querySelector('.btn-clear-continue-dir')?.addEventListener('click', () => {
            st.dir = '';
            syncDispatchContinueUiForKey(rootEl, stateKey);
          });
        }
      }
    }
    const form = rootEl.querySelector(`form[data-fstate-key="${stateKey}"]`) || (stateKey === '__global__' ? document.getElementById('triadGoalForm') : null);
    const goalInp = form ? (form.querySelector('.team-dispatch-input') || form.querySelector('#triadGoalInput')) : null;
    if (goalInp) {
      if (!goalInp.dataset.origPlaceholder) {
        goalInp.dataset.origPlaceholder = goalInp.getAttribute('placeholder') || '';
      }
      if (isCont) {
        const fShort = st.dir ? `'${formatShortFolderLabel(st.dir)}' 폴더에 ` : '선택한 기존 폴더에 ';
        goalInp.setAttribute('placeholder', `📂 ${fShort}추가·수정할 작업 지시 입력 (예: 실행 가능한 exe 파일 추가 빌드, 기능 보강 등)...`);
      } else {
        goalInp.setAttribute('placeholder', goalInp.dataset.origPlaceholder);
      }
    }
  }

  function bindDispatchFolderConnectControls(rootEl) {
    if (!rootEl) return;
    rootEl.querySelectorAll('.dispatch-fmode-btn').forEach(btn => {
      if (btn.dataset.boundFmode === '1') return;
      btn.dataset.boundFmode = '1';
      btn.addEventListener('click', () => {
        const key = btn.dataset.stateKey || '__global__';
        const st = getTeamContinueState(key);
        st.mode = btn.dataset.fmode === 'continue' ? 'continue' : 'new';
        if (st.mode === 'continue' && !st.dir) {
          const bar = rootEl.querySelector(`[data-continue-bar="${key}"]`);
          const sel = bar?.querySelector('.dispatch-recent-folder-select');
          if (sel && sel.options.length > 1 && sel.options[1].value) {
            st.dir = sel.options[1].value;
          }
        }
        syncDispatchContinueUiForKey(rootEl, key);
      });
    });

    rootEl.querySelectorAll('.dispatch-recent-folder-select').forEach(sel => {
      if (sel.dataset.boundFsel === '1') return;
      sel.dataset.boundFsel = '1';
      sel.addEventListener('change', () => {
        const key = sel.dataset.stateKey || '__global__';
        const st = getTeamContinueState(key);
        st.mode = 'continue';
        st.dir = (sel.value || '').trim();
        syncDispatchContinueUiForKey(rootEl, key);
      });
    });

    rootEl.querySelectorAll('.btn-pick-continue-dir').forEach(btn => {
      if (btn.dataset.boundFpick === '1') return;
      btn.dataset.boundFpick = '1';
      btn.addEventListener('click', () => {
        const key = btn.dataset.stateKey || '__global__';
        const tname = btn.dataset.tname || '팀';
        const st = getTeamContinueState(key);
        openLocalFolderPicker({
          initialDir: st.dir || btn.dataset.initDir || '',
          teamId: null,
          teamName: `${tname} · 이어할 기존 작업 폴더`,
          onPicked: (pickedPath) => {
            if (!pickedPath) return;
            st.mode = 'continue';
            st.dir = pickedPath;
            syncDispatchContinueUiForKey(rootEl, key);
          }
        });
      });
    });

    rootEl.querySelectorAll('.btn-clear-continue-dir').forEach(btn => {
      if (btn.dataset.boundFclr === '1') return;
      btn.dataset.boundFclr = '1';
      btn.addEventListener('click', () => {
        const key = btn.dataset.stateKey || '__global__';
        const st = getTeamContinueState(key);
        st.dir = '';
        syncDispatchContinueUiForKey(rootEl, key);
      });
    });
  }

  async function dispatchMissionGoal(goal, profile = 'standard', teamId = null, options = {}) {
    if (!goal || !goal.trim()) return { ok: false, error: '업무 목표를 입력해 주세요.' };
    const folderMode = options?.folderMode === 'continue' ? 'continue' : 'new';
    const continueDir = folderMode === 'continue' ? String(options?.continueDir || '').trim() : '';
    if (folderMode === 'continue' && !continueDir) {
      return { ok: false, error: '이어서 작업할 기존 폴더를 [최근 작업 폴더 목록]에서 선택하거나 [🗂️ 폴더 선택] 버튼으로 지정해 주세요.' };
    }
    const effTeamId = teamId || document.getElementById('triadTeamSelect')?.value || (window.NEXUS_TEAMS_SUMMARY && window.NEXUS_TEAMS_SUMMARY.active_team_id) || null;
    try {
      const res = await apiFetch('/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: goal.trim(),
          profile,
          team_id: effTeamId,
          folder_mode: folderMode,
          continue_dir: continueDir
        })
      });
      if (res.ok || res.status === 202) {
        const d = await res.json().catch(() => ({}));
        pollOrchestrator();
        return { ok: true, data: d };
      }
      if (res.status === 400 || res.status === 409) {
        const errData = await res.json().catch(() => ({}));
        const msg = errData.error || '요청을 처리할 수 없습니다.';
        const replyRole = document.getElementById('triadReplyRole');
        const replyText = document.getElementById('triadReplyText');
        if (replyRole) replyRole.textContent = '[⚠️ 미션 실행 제한 안내]';
        if (replyText) replyText.textContent = msg;
        return { ok: false, error: msg };
      }
    } catch (_) { }
    startLocalPipelineFallback(goal.trim());
    return { ok: true, fallback: true };
  }

  async function askDirectQuestion(target, question, agentName = '') {
    try {
      const res = await apiFetch('/ops/cli-ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cli: target, agent_name: agentName, question })
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (_) { }
    return {
      ok: true,
      mode: 'LOCAL_FALLBACK',
      role: (target || 'HEAD').toUpperCase(),
      label: agentName || CLI_LABELS[currentRoles[target] || currentRoles.head] || 'AI 직원',
      seconds: 1,
      command: 'local-fallback',
      answer: `[${agentName || '로컬 안내'}] '${question}' 질문을 확인했습니다. (실제 CLI 응답을 받으려면 python server.py 8080 연결 상태를 확인해 주세요.)`
    };
  }

  // Bind Goal / Question Form on index.html & agents.html
  const goalForm = document.getElementById('triadGoalForm');
  const targetAgentSelect = document.getElementById('triadAgentTargetSelect');

  targetAgentSelect?.addEventListener('change', () => {
    const replyRole = document.getElementById('triadReplyRole');
    const optText = targetAgentSelect.options[targetAgentSelect.selectedIndex]?.text || 'HEAD Director AI';
    const cleanName = optText.replace(/^[^\w가-힣]+\s*/, '');
    if (replyRole) replyRole.textContent = `[${cleanName} 응답 대기]`;
  });

  // If navigated with ?agent=role on settings.html, pre-select that agent
  try {
    const params = new URLSearchParams(window.location.search);
    const qAgent = (params.get('agent') || '').toLowerCase();
    const qName = params.get('name') || '';
    if (qAgent && targetAgentSelect) {
      targetAgentSelect.value = ['head', 'builder', 'sub_builder', 'reviewer', 'researcher', 'director', 'triad'].includes(qAgent) ? qAgent : 'head';
      if (qName) targetAgentSelect.dataset.customAgentName = qName;
      const replyRole = document.getElementById('triadReplyRole');
      if (replyRole && qName) replyRole.textContent = `[${qName} (${qAgent.toUpperCase()}) 선택됨]`;
      const input = document.getElementById('triadGoalInput');
      if (input) {
        if (qName) input.placeholder = `${qName}에게 물어볼 질문을 입력하세요...`;
        input.focus();
      }
    }
  } catch (_) { }

  // In agents.html, clicking an agent row navigates to settings.html for quick question
  document.querySelectorAll('#agentList .agent-card-row').forEach(row => {
    row.style.cursor = 'pointer';
    row.title = '클릭하여 AI 설정 & 질문 페이지에서 이 직원에게 질문하기';
    row.addEventListener('click', () => {
      const role = (row.dataset.role || 'HEAD').toLowerCase();
      const agentName = row.querySelector('.agent-name')?.textContent?.trim() || '';
      if (!targetAgentSelect) {
        window.location.href = `settings.html?agent=${encodeURIComponent(role)}&name=${encodeURIComponent(agentName)}`;
        return;
      }
      targetAgentSelect.value = ['head', 'builder', 'sub_builder', 'reviewer', 'researcher', 'director', 'triad'].includes(role) ? role : 'head';
      targetAgentSelect.dataset.customAgentName = agentName;
      const replyRole = document.getElementById('triadReplyRole');
      if (replyRole && agentName) replyRole.textContent = `[${agentName} (${role.toUpperCase()}) 선택됨]`;
      const input = document.getElementById('triadGoalInput');
      if (input) {
        input.placeholder = `${agentName}에게 물어볼 질문을 입력하세요...`;
        input.focus();
      }
    });
  });

  goalForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = document.getElementById('triadGoalInput');
    const profileSel = document.getElementById('triadProfileSelect');
    const submitBtn = document.getElementById('triadGoalSubmit');
    const replyRole = document.getElementById('triadReplyRole');
    const replyText = document.getElementById('triadReplyText');
    const replyMeta = document.getElementById('triadReplyMeta');

    const goal = (input?.value || '').trim();
    if (!goal) return;
    const mode = profileSel?.value || 'ask';
    const targetRole = targetAgentSelect?.value || 'head';
    const optText = targetAgentSelect?.options?.[targetAgentSelect.selectedIndex]?.text || 'HEAD Director AI';
    const selectedName = targetAgentSelect?.dataset?.customAgentName || optText.replace(/^[^\w가-힣]+\s*/, '').split('(')[0].trim();
    if (targetAgentSelect) delete targetAgentSelect.dataset.customAgentName;
    input.value = '';

    if (mode === 'ask') {
      const origBtnText = submitBtn?.textContent || '질문 보내기 ↗';
      if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = '답변 생성 중...'; }
      if (replyRole) replyRole.textContent = `[${selectedName} 생각 중...]`;
      if (replyText) replyText.textContent = `'${goal}' 질문에 대해 ${selectedName}의 CLI 프로세스를 호출하여 답변을 받아오고 있습니다...`;
      if (replyMeta) replyMeta.textContent = 'CLI 호출 중';

      const ans = await askDirectQuestion(targetRole, goal, selectedName);
      if (replyRole) replyRole.textContent = `[${ans.label || selectedName} 답변]`;
      if (replyText) replyText.textContent = ans.answer || '';
      if (replyMeta) {
        replyMeta.textContent = `${ans.mode === 'REAL_CLI' || ans.mode === 'REAL_CLI_PROXY' ? '실제 CLI 응답' : '시뮬레이션'} · ${ans.seconds || 1}초`;
      }
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = origBtnText; }
      return;
    }

    const selTeamEl = document.getElementById('triadTeamSelect');
    const chosenTeamId = selTeamEl?.value || null;
    const chosenTeamLabel = selTeamEl?.options?.[selTeamEl.selectedIndex]?.text || '';
    const gState = getTeamContinueState('__global__');
    if (gState.mode === 'continue' && !String(gState.dir || '').trim()) {
      input.value = goal;
      if (replyRole) replyRole.textContent = '[⚠️ 기존 폴더 미선택 안내]';
      if (replyText) replyText.textContent = '기존 폴더 이어하기 모드입니다. 입력창 위의 [최근 작업 폴더 목록]에서 선택하거나 [🗂️ 폴더 선택]으로 이어할 폴더를 먼저 지정해 주세요.';
      return;
    }
    if (replyRole) replyRole.textContent = `[개발 미션 가동${chosenTeamLabel ? ` · ${chosenTeamLabel}` : ''} · ${mode.toUpperCase()}${gState.mode === 'continue' ? ' · 기존폴더 이어하기' : ''}]`;
    if (replyText) replyText.textContent = `'${goal}' 미션이 시작되었습니다. ${gState.mode === 'continue' ? `선택한 기존 작업 폴더(${gState.dir})에서 추가·수정 작업을 이어갑니다.` : '선택한 팀의 역할 구성과 새 작업 폴더로 파이프라인이 진행됩니다.'}`;
    await dispatchMissionGoal(goal, mode, chosenTeamId, { folderMode: gState.mode, continueDir: gState.dir });
  });

  // Bind "+ 미션 목표 지시" button on agents.html
  document.getElementById('addAgent')?.addEventListener('click', async () => {
    const goal = prompt('HEAD 에이전트에게 지시할 한 줄 미션 목표(Goal)를 입력하세요:', '신규 기능 모듈 구현 및 격리 Worktree 테스트 검증');
    if (goal && goal.trim()) {
      await dispatchMissionGoal(goal.trim(), 'standard');
    }
  });

  // Bind "■ 작업 정지" button
  document.getElementById('btnStopMission')?.addEventListener('click', async () => {
    if (localPipelineTimer) {
      clearInterval(localPipelineTimer);
      localPipelineTimer = null;
    }
    try {
      await fetch('/ops/missions/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: '버추얼 오피스 작업 정지 버튼' })
      });
    } catch (_) { }
    updatePipelinePhaseDOM('IDLE', [
      { to_state: 'STOPPED', state_ko: '작업 정지 실행 · 모든 실행 중인 미션 및 CLI 프로세스 종료', role: 'DIRECTOR', run_id: 'stop-signal' }
    ]);
  });

  async function apiFetch(path, options = {}) {
    const isFile = typeof window !== 'undefined' && window.location.protocol === 'file:';
    if (!isFile) {
      try {
        const res = await fetch(path, options);
        if (res.status !== 404 && res.status !== 405 && res.status !== 501) {
          return res;
        }
      } catch (_) { }
    }
    // Fallback to explicit local orchestrator server on 127.0.0.1:8080 (supports file:// or Live Server 5500)
    return fetch(`http://127.0.0.1:8080${path}`, options);
  }

  // ==========================================================================
  // [6] AI CLI(Claude Code, OpenAI Codex, Google Antigravity) 로그인 확인 설정창
  // ==========================================================================
  function getFallbackDiagnostics() {
    return {
      triad_state: 'STATIC_FALLBACK',
      checked_at: new Date().toISOString(),
      forbidden_keys_stripped: ['OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'GEMINI_API_KEY', 'GOOGLE_API_KEY'],
      providers: {
        claude: {
          provider: 'claude',
          cli: 'claude',
          label: 'Claude Code',
          installed: false,
          auth_state: 'NOT_INSTALLED',
          auth_label: '서버 연결 필요 (python server.py 8080)',
          auth_detail: '현재 정적 서버(http.server) 모드입니다. 실제 CLI 로그인 상태를 진단하려면 python server.py 8080으로 실행하세요.',
          version: '정적 데모 모드',
          executable: null,
          custom_executable: '',
          login_cmd: 'claude login',
          install_cmd: 'npm install -g @anthropic-ai/claude-code',
          session_marker: null
        },
        antigravity: {
          provider: 'antigravity',
          cli: 'agy',
          label: 'Google Antigravity (계정 1)',
          installed: false,
          auth_state: 'NOT_INSTALLED',
          auth_label: '서버 연결 필요 (python server.py 8080)',
          auth_detail: '현재 정적 서버(http.server) 모드입니다. 실제 CLI 로그인 상태를 진단하려면 python server.py 8080으로 실행하세요.',
          version: '정적 데모 모드',
          executable: null,
          custom_executable: '',
          login_cmd: 'agy login',
          install_cmd: 'Antigravity IDE / CLI (%LOCALAPPDATA%\\agy\\bin\\agy.exe)',
          session_marker: null
        },
        gemini: {
          provider: 'gemini',
          cli: 'gemini',
          label: 'Google Gemini 2 (서브 계정 2)',
          installed: false,
          auth_state: 'NOT_INSTALLED',
          auth_label: '서버 연결 필요 (python server.py 8080)',
          auth_detail: '서브 구글 계정(계정 2)은 ~/.gemini-acc2 격리 프로필을 통해 기존 Antigravity(계정 1)와 동시에 연결됩니다.',
          version: '정적 데모 모드',
          executable: null,
          custom_executable: '',
          login_cmd: 'gemini (GEMINI_CLI_HOME=%USERPROFILE%\\.gemini-acc2)',
          install_cmd: 'npm install -g @google/gemini-cli',
          session_marker: null
        },
        openai: {
          provider: 'openai',
          cli: 'codex',
          label: 'OpenAI Codex',
          installed: false,
          auth_state: 'NOT_INSTALLED',
          auth_label: '서버 연결 필요 (python server.py 8080)',
          auth_detail: '현재 정적 서버(http.server) 모드입니다. 실제 CLI 로그인 상태를 진단하려면 python server.py 8080으로 실행하세요.',
          version: '정적 데모 모드',
          executable: null,
          custom_executable: '',
          login_cmd: 'codex login',
          install_cmd: 'npm install -g @openai/codex',
          session_marker: null
        },
        grok: {
          provider: 'grok',
          cli: 'grok',
          label: 'xAI Grok',
          installed: false,
          auth_state: 'NOT_INSTALLED',
          auth_label: '서버 연결 필요 (python server.py 8080)',
          auth_detail: '현재 정적 서버(http.server) 모드입니다. 실제 CLI 로그인 상태를 진단하려면 python server.py 8080으로 실행하세요.',
          version: '정적 데모 모드',
          executable: null,
          custom_executable: '',
          login_cmd: 'grok',
          install_cmd: 'npm install -g @vibe-kit/grok-cli',
          session_marker: null
        }
      }
    };
  }

  function ensureCliSettingsModal() {
    const wsCard = document.querySelector('.sidebar .workspace-card');
    if (wsCard && !wsCard.dataset.cliBound) {
      wsCard.dataset.cliBound = '1';
      wsCard.style.cursor = 'pointer';
      wsCard.title = '클릭하여 AI 설정 & 질문 탭의 CLI 로그인 설정으로 이동';
      wsCard.addEventListener('click', () => {
        const inlineSec = document.getElementById('cliAuthSection');
        if (inlineSec) {
          inlineSec.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else {
          window.location.href = 'settings.html#cliAuthSection';
        }
      });
    }

    // settings.html에 내장된 CLI 로그인 & 설정 섹션(#cliAuthSection)이 있는 경우 바로 이벤트 바인딩
    const inlineSection = document.getElementById('cliAuthSection');
    if (inlineSection) {
      if (!inlineSection.dataset.bound) {
        inlineSection.dataset.bound = '1';
        document.getElementById('btnDeepProbeCli')?.addEventListener('click', () => fetchAndRenderCliDiagnostics(true));
        document.getElementById('btnSaveCliPaths')?.addEventListener('click', saveCustomCliPaths);
        document.getElementById('btnInstallAllMissingCli')?.addEventListener('click', () => triggerOneClickInstall('all'));
        document.getElementById('btnAddCliSlot')?.addEventListener('click', () => handleAddCliSlotFromBar());
        document.getElementById('btnResetCliSlots')?.addEventListener('click', () => handleResetCliSlots());
        document.getElementById('cliModalAskTarget')?.addEventListener('change', async (e) => {
          if (e.target.value === '__add_new_cli__') {
            e.target.value = 'antigravity';
            await promptAndAddCliSlotFromSelect((addedKey) => {
              e.target.value = addedKey;
            });
          }
        });

        document.getElementById('cliModalAskForm')?.addEventListener('submit', async (e) => {
          e.preventDefault();
          const target = document.getElementById('cliModalAskTarget')?.value || 'antigravity';
          const qInput = document.getElementById('cliModalAskInput');
          const askBtn = document.getElementById('btnCliModalAsk');
          const logBox = document.getElementById('cliInstallLogBox');
          const q = (qInput?.value || '').trim();
          if (!q) return;
          if (askBtn) { askBtn.disabled = true; askBtn.textContent = '⏳ CLI 응답 대기 중...'; }
          if (logBox) {
            logBox.style.display = 'block';
            logBox.textContent = `[질문 전송] 대상: ${target.toUpperCase()} | 질문: "${q}"\nCLI 프로세스를 호출하여 답변을 생성하고 있습니다...`;
          }
          const ans = await askDirectQuestion(target, q);
          if (logBox) {
            logBox.textContent = (
              `▶ [응답 완료 · ${ans.label || target}] (모드: ${ans.mode} | 소요시간: ${ans.seconds || 1}초)\n` +
              `▶ 실행 명령: ${ans.command || '-'}\n` +
              `----------------------------------------------------------------------\n` +
              `${ans.answer || ''}`
            );
          }
          if (askBtn) { askBtn.disabled = false; askBtn.textContent = '질문 보내기 & 응답 확인 ↗'; }
        });
      }
      return;
    }

    if (document.getElementById('cliSettingsModalBackdrop')) return;

    const backdrop = document.createElement('div');
    backdrop.id = 'cliSettingsModalBackdrop';
    backdrop.className = 'cli-modal-backdrop';
    backdrop.innerHTML = `
      <div class="cli-modal" role="dialog" aria-modal="true" aria-labelledby="cliModalTitle">
        <div class="cli-modal-head">
          <div>
            <div class="eyebrow">SUBSCRIPTION CLI AUTHENTICATION & DIAGNOSTICS</div>
            <h2 id="cliModalTitle">AI CLI 로그인 상태 확인 & 실행 경로 설정</h2>
            <p>Claude Code(claude), Google Antigravity(agy), OpenAI Codex(codex)의 설치·구독 로그인 세션 상태와 종량제 API 키 차단(Sanitized Env) 여부를 확인합니다.</p>
          </div>
          <button type="button" class="cli-modal-close" id="btnCloseCliModal" aria-label="설정창 닫기">✕</button>
        </div>
        <div class="cli-modal-body">
          <div class="cli-summary-banner" id="cliSummaryBanner">
            <div>
              <strong id="cliSummaryHeadline">진단 정보를 불러오는 중입니다...</strong>
              <div id="cliSummarySub" style="margin-top:3px;font-size:10px;color:#64748b">모든 CLI 호출 시 OPENAI_API_KEY, ANTHROPIC_API_KEY, GEMINI_API_KEY 등 종량제 키는 자동 제거됩니다.</div>
            </div>
            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
              <button type="button" class="btn small mint" id="btnInstallAllMissingCli">⚡ 미설치 CLI 일괄 원클릭 설치</button>
              <button type="button" class="btn small" id="btnDeepProbeCli">🔍 실시간 로그인 검증 (Deep Probe)</button>
              <button type="button" class="btn small primary" id="btnSaveCliPaths">💾 실행 경로 저장 & 재검증</button>
            </div>
          </div>
          <form id="cliModalAskForm" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:10px 12px;border-radius:11px;background:#f1f5f9;border:1px solid #cbd5e1">
            <span class="triad-role-badge role-reviewer">💬 1줄 질문 테스트</span>
            <select id="cliModalAskTarget" class="triad-cli-select" style="height:32px">
              <option value="antigravity">Google Antigravity (agy · 계정1)</option>
              <option value="antigravity_sdk">📦 Antigravity SDK (구독·로컬 $0)</option>
              <option value="gemini">Google Gemini 2 (gemini · 계정2)</option>
              <option value="claude">Claude Code (claude)</option>
              <option value="openai">OpenAI Codex (codex)</option>
              <option value="grok">xAI Grok (grok)</option>
              <option value="head">현재 HEAD 담당 CLI</option>
            </select>
            <input type="text" id="cliModalAskInput" class="triad-goal-input" style="height:32px;font-size:11px" value="안녕? 너는 어떤 AI CLI이고 지금 정상 작동 중이니? 한 문장으로 답해줘." placeholder="CLI에 던질 간단한 질문을 입력하세요">
            <button type="submit" class="btn small primary" id="btnCliModalAsk">질문 보내기 & 응답 확인 ↗</button>
          </form>
          <div id="cliInstallLogBox" style="display:none;background:#0f172a;color:#e2e8f0;padding:12px 14px;border-radius:10px;font:10.5px/1.55 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;max-height:160px;overflow-y:auto;white-space:pre-wrap"></div>
          <div class="cli-auth-grid" id="cliAuthGrid"></div>
        </div>
        <div class="cli-modal-foot">
          <span id="cliModalFootNote">✦ 팁: 터미널을 python server.py 8080으로 실행하면 로컬 PC의 실제 CLI 설치 및 구독 로그인 세션을 실시간 감지합니다.</span>
          <button type="button" class="btn small" id="btnCloseCliModalFoot">닫기</button>
        </div>
      </div>
    `;
    document.body.appendChild(backdrop);

    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) backdrop.classList.remove('open');
    });
    document.getElementById('btnCloseCliModal')?.addEventListener('click', () => backdrop.classList.remove('open'));
    document.getElementById('btnCloseCliModalFoot')?.addEventListener('click', () => backdrop.classList.remove('open'));
    document.getElementById('btnDeepProbeCli')?.addEventListener('click', () => fetchAndRenderCliDiagnostics(true));
    document.getElementById('btnSaveCliPaths')?.addEventListener('click', saveCustomCliPaths);
    document.getElementById('btnInstallAllMissingCli')?.addEventListener('click', () => triggerOneClickInstall('all'));
    document.getElementById('cliModalAskForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const target = document.getElementById('cliModalAskTarget')?.value || 'antigravity';
      const qInput = document.getElementById('cliModalAskInput');
      const askBtn = document.getElementById('btnCliModalAsk');
      const logBox = document.getElementById('cliInstallLogBox');
      const q = (qInput?.value || '').trim();
      if (!q) return;
      if (askBtn) { askBtn.disabled = true; askBtn.textContent = '⏳ CLI 응답 대기 중...'; }
      if (logBox) {
        logBox.style.display = 'block';
        logBox.textContent = `[질문 전송] 대상: ${target.toUpperCase()} | 질문: "${q}"\nCLI 프로세스를 호출하여 답변을 생성하고 있습니다...`;
      }
      const ans = await askDirectQuestion(target, q);
      if (logBox) {
        logBox.textContent = (
          `▶ [응답 완료 · ${ans.label || target}] (모드: ${ans.mode} | 소요시간: ${ans.seconds || 1}초)\n` +
          `▶ 실행 명령: ${ans.command || '-'}\n` +
          `----------------------------------------------------------------------\n` +
          `${ans.answer || ''}`
        );
      }
      if (askBtn) { askBtn.disabled = false; askBtn.textContent = '질문 보내기 & 응답 확인 ↗'; }
    });
  }

  async function triggerOneClickInstall(targetCli, triggerBtn = null) {
    const logBox = document.getElementById('cliInstallLogBox');
    const allBtn = document.getElementById('btnInstallAllMissingCli');
    const origText = triggerBtn ? triggerBtn.textContent : (allBtn ? allBtn.textContent : '');
    if (triggerBtn) {
      triggerBtn.disabled = true;
      triggerBtn.textContent = '⏳ 자동 설치 중...';
    }
    if (allBtn && targetCli === 'all') {
      allBtn.disabled = true;
      allBtn.textContent = '⏳ 미설치 CLI 설치 중...';
    }
    if (logBox) {
      logBox.style.display = 'block';
      logBox.textContent = `[원클릭 설치 시작] 대상: ${targetCli.toUpperCase()} · npm / 로컬 바이너리 설치를 진행하고 있습니다. 잠시만 기다려 주세요...`;
    }

    try {
      const res = await apiFetch('/ops/cli-install', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cli: targetCli })
      });
      const data = await res.json().catch(() => ({}));
      if (data.diagnostics) {
        renderCliDiagnosticsModal(data.diagnostics);
      }
      if (logBox) {
        const lines = (data.results || []).map(r =>
          `▶ [${(r.cli || targetCli).toUpperCase()}] (${r.command || 'install'}) -> ${r.ok ? '성공 ✓' : '확인 필요 !'}\n${r.output || ''}`
        ).join('\n\n');
        logBox.textContent = `${data.message || '설치 요청 완료'}\n\n${lines}`.trim();
      }
    } catch (err) {
      if (logBox) {
        logBox.textContent = `[오류] 원클릭 설치 API 호출 실패: ${err.message}\n(터미널에서 python server.py 8080이 실행 중인지 확인해 주세요.)`;
      }
    } finally {
      if (triggerBtn) {
        triggerBtn.disabled = false;
        triggerBtn.textContent = origText;
      }
      if (allBtn && targetCli === 'all') {
        allBtn.disabled = false;
        allBtn.textContent = '⚡ 미설치 CLI 일괄 원클릭 설치';
      }
    }
  }

  async function triggerCliLoginTerminal(cliName, triggerBtn = null) {
    const logBox = document.getElementById('cliInstallLogBox');
    try {
      const res = await apiFetch('/ops/cli-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cli: cliName })
      });
      const data = await res.json().catch(() => ({}));
      if (logBox) {
        logBox.style.display = 'block';
        logBox.textContent = data.message || `'${cliName} login' 터미널을 실행했습니다.`;
      }
    } catch (_) {
      navigator.clipboard?.writeText(`${cliName} login`);
    }
    if (triggerBtn) {
      const prev = triggerBtn.textContent;
      triggerBtn.textContent = '✓ 로그인 창 실행됨';
      setTimeout(() => { triggerBtn.textContent = prev; }, 1600);
    }
  }

  function syncAllCliDropdowns(providersObj) {
    if (!providersObj || typeof providersObj !== 'object') return;
    const keys = Object.keys(providersObj);
    if (!keys.length) return;

    // 1. Update CLI_LABELS, CLI_SHORT, CLI_BADGE_LABELS dynamically
    keys.forEach(k => {
      const p = providersObj[k] || {};
      const cliCmd = p.cli || k;
      const lbl = p.label || k;
      CLI_LABELS[k] = lbl.includes(`(${cliCmd}`) ? lbl : `${lbl} (${cliCmd})`;
      CLI_SHORT[k] = lbl.replace(/\s*\(.*?\)\s*/g, '').replace(/^Google\s+/i, '').replace(/^OpenAI\s+/i, '').replace(/^xAI\s+/i, '').trim() || k;
      CLI_BADGE_LABELS[k] = lbl;
    });

    // Save active CLI options to localStorage so office.js & fast page boot also read exact active slots
    try {
      const slotSummary = keys.map(k => ({
        key: k,
        label: CLI_LABELS[k],
        short: CLI_SHORT[k],
        base_type: providersObj[k]?.base_type || k,
        domain: providersObj[k]?.domain || (k === 'antigravity_sdk' ? 'SDK' : k.toUpperCase()),
        cli: providersObj[k]?.cli || (k === 'antigravity_sdk' ? 'agy-sdk' : k),
        auth_state: providersObj[k]?.auth_state || 'LOGGED_IN',
        selected_model_display: providersObj[k]?.selected_model_display || '기본 모델'
      }));
      localStorage.setItem('nexus-cli-slots-v1', JSON.stringify(slotSummary));
    } catch (_) { }

    // Update sidebar active CLI caption across pages
    document.querySelectorAll('.sidebar .workspace-caption').forEach(capEl => {
      const activeEngineNames = keys.map(k => providersObj[k]?.label || CLI_SHORT[k] || k).join(' · ');
      capEl.innerHTML = `${escHtml(activeEngineNames)}<br>LEAD · PART_RESEARCH · PART_STRUCTURE · PART_BUILD`;
    });

    // 2. Sync all [data-role-select] dropdowns
    document.querySelectorAll('[data-role-select]').forEach(sel => {
      const roleKey = sel.dataset.roleSelect;
      const curVal = currentRoles[roleKey] && keys.includes(currentRoles[roleKey]) ? currentRoles[roleKey] : keys[0];
      sel.innerHTML = keys.map(k =>
        `<option value="${k}" ${k === curVal ? 'selected' : ''}>${CLI_LABELS[k]}</option>`
      ).join('') + `<option value="__add_new_cli__">➕ 드롭다운에서 새 CLI 로그인 추가...</option>`;
      sel.value = curVal;
    });

    // 3. Sync #cliModalAskTarget
    const modalAskSel = document.getElementById('cliModalAskTarget');
    if (modalAskSel) {
      const prevVal = modalAskSel.value && (keys.includes(modalAskSel.value) || modalAskSel.value === 'head') ? modalAskSel.value : keys[0];
      modalAskSel.innerHTML = keys.map(k =>
        `<option value="${k}" ${k === prevVal ? 'selected' : ''}>${CLI_LABELS[k]}</option>`
      ).join('') + `<option value="head" ${prevVal === 'head' ? 'selected' : ''}>현재 HEAD 담당 CLI</option>`
        + `<option value="__add_new_cli__">➕ 드롭다운에서 새 CLI 로그인 추가...</option>`;
      modalAskSel.value = prevVal;
    }

    // 4. Normalize agent cliProvider if pointing to a removed slot & sync #studioQuickCli + #studioCliCardGroup
    const fallbackSlot = providersObj.antigravity_sdk ? 'antigravity_sdk' : (providersObj.antigravity ? 'antigravity' : keys[0]);
    modularAgents.forEach(ag => {
      if (!ag.cliProvider || !providersObj[ag.cliProvider]) {
        ag.cliProvider = fallbackSlot;
      }
    });
    const studioBadgeAid = (document.getElementById('selectedCharBadge')?.textContent || '#01').replace('#', '').trim();
    const selStudioAg = modularAgents.find(a => a.id === studioBadgeAid) || modularAgents[0] || null;
    const desiredStudioCli = (selStudioAg?.cliProvider && keys.includes(selStudioAg.cliProvider)) ? selStudioAg.cliProvider : fallbackSlot;

    const studioCliSel = document.getElementById('studioQuickCli');
    if (studioCliSel && document.activeElement !== studioCliSel) {
      studioCliSel.innerHTML = keys.map(k =>
        `<option value="${escHtml(k)}" ${k === desiredStudioCli ? 'selected' : ''}>${escHtml(CLI_LABELS[k])}</option>`
      ).join('') + `<option value="__add_new_cli__">➕ 드롭다운에서 새 CLI 로그인 추가...</option>`;
      studioCliSel.value = desiredStudioCli;
    }

    const studioCardGroup = document.getElementById('studioCliCardGroup');
    if (studioCardGroup) {
      const countEm = document.getElementById('studioCliCountLabel') || studioCardGroup.previousElementSibling?.querySelector('em');
      if (countEm) countEm.textContent = `${keys.length} Active ${keys.length === 1 ? 'Slot' : 'Slots'}`;
      const curSelVal = studioCliSel?.value || desiredStudioCli;
      studioCardGroup.innerHTML = keys.map(k => {
        const p = providersObj[k] || {};
        const domTxt = p.domain || k.toUpperCase();
        const cliCmd = p.cli || k;
        const stTxt = p.auth_state === 'LOGGED_IN' ? '✓ 연결됨' : '미로그인';
        return `
          <button type="button" class="studio-cli-card ${k === curSelVal ? 'active' : ''}" data-cli-val="${escHtml(k)}">
            <span class="item-code">${escHtml(domTxt)} · ${stTxt}</span>
            <strong>${escHtml(p.label || k)}</strong>
            <span>${escHtml(cliCmd)} (${escHtml(p.selected_model_display || '기본 모델')})</span>
          </button>
        `;
      }).join('');
      studioCardGroup.querySelectorAll('.studio-cli-card').forEach(btn => {
        btn.addEventListener('click', () => {
          if (studioCliSel) {
            studioCliSel.value = btn.dataset.cliVal;
            studioCliSel.dispatchEvent(new Event('change'));
          }
        });
      });
    }
  }

  async function handleAddCliSlotFromBar() {
    const typeSel = document.getElementById('addCliTypeSelect');
    const labelInp = document.getElementById('addCliLabelInput');
    const addBtn = document.getElementById('btnAddCliSlot');
    const logBox = document.getElementById('cliInstallLogBox');
    const baseType = typeSel?.value || 'antigravity';
    const customLabel = (labelInp?.value || '').trim();

    if (addBtn) {
      addBtn.disabled = true;
      addBtn.textContent = '⏳ 추가 중...';
    }
    try {
      const res = await apiFetch('/ops/cli-slots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add', base_type: baseType, label: customLabel })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error || 'CLI 슬롯 추가에 실패했습니다.');
        return null;
      }
      if (labelInp) labelInp.value = '';
      if (data.roles) currentRoles = { ...currentRoles, ...data.roles };
      if (data.diagnostics) {
        renderCliDiagnosticsModal(data.diagnostics, true);
      } else {
        await fetchAndRenderCliDiagnostics(false);
      }
      if (logBox) {
        logBox.style.display = 'block';
        const profNote = data.added?.profile_dir ? ` (동일 AI 다중 계정 감지 → 자동 격리 프로필: ${data.added.profile_dir})` : '';
        logBox.textContent = `✓ ${data.message || '새 CLI 로그인 슬롯이 추가되었습니다.'}${profNote}\n아래 추가된 카드의 [🔑 원클릭 로그인 창 열기] 버튼을 눌러 로그인하세요.`;
      }
      return data.added?.key || null;
    } catch (err) {
      alert(`CLI 슬롯 추가 중 오류: ${err.message}`);
      return null;
    } finally {
      if (addBtn) {
        addBtn.disabled = false;
        addBtn.textContent = '➕ 드롭다운에서 CLI 추가';
      }
    }
  }

  let lastCliAuthGridSig = '';
  let pendingRemoveSlotKey = '';
  let pendingRemoveTimer = null;

  async function handleRemoveCliSlot(slotKey, triggerBtn = null) {
    const prov = lastDiagnostics?.providers?.[slotKey];
    const label = prov?.label || slotKey;
    const logBox = document.getElementById('cliInstallLogBox');
    const totalCount = Object.keys(lastDiagnostics?.providers || {}).length;
    if (totalCount <= 1) {
      if (logBox) {
        logBox.style.display = 'block';
        logBox.textContent = `⚠️ 최소 1개 이상의 AI CLI/SDK 로그인 슬롯은 유지되어야 합니다. 다른 슬롯을 먼저 추가한 뒤 [${label}] 슬롯을 제거해 주세요.`;
      }
      return;
    }

    // Inline 2-click confirmation (works reliably even in embedded WebViews where window.confirm is blocked)
    if (pendingRemoveSlotKey !== slotKey) {
      pendingRemoveSlotKey = slotKey;
      if (pendingRemoveTimer) clearTimeout(pendingRemoveTimer);
      document.querySelectorAll(`.btn-remove-cli-slot[data-slot-key="${slotKey}"]`).forEach(b => {
        b.dataset.origLabel = b.textContent;
        b.textContent = '⚠️ 클릭 시 즉시 제거';
        b.style.background = '#dc2626';
        b.style.color = '#ffffff';
        b.style.borderColor = '#b91c1c';
      });
      if (logBox) {
        logBox.style.display = 'block';
        logBox.textContent = `⚠️ [${label}] 슬롯을 제거하려면 4초 이내에 [⚠️ 클릭 시 즉시 제거] 버튼을 한 번 더 눌러 주세요.`;
      }
      pendingRemoveTimer = setTimeout(() => {
        if (pendingRemoveSlotKey === slotKey) {
          pendingRemoveSlotKey = '';
          document.querySelectorAll(`.btn-remove-cli-slot[data-slot-key="${slotKey}"]`).forEach(b => {
            b.textContent = b.dataset.origLabel || '🗑️ 제거';
            b.style.background = '';
            b.style.color = '';
            b.style.borderColor = '';
          });
        }
      }, 4500);
      return;
    }

    pendingRemoveSlotKey = '';
    if (pendingRemoveTimer) {
      clearTimeout(pendingRemoveTimer);
      pendingRemoveTimer = null;
    }
    if (triggerBtn) {
      triggerBtn.disabled = true;
      triggerBtn.textContent = '⏳ 제거 중...';
    }

    try {
      const res = await apiFetch('/ops/cli-slots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'remove', key: slotKey })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (logBox) {
          logBox.style.display = 'block';
          logBox.textContent = `❌ ${data.error || 'CLI 슬롯 제거에 실패했습니다.'}`;
        }
        return;
      }
      lastCliAuthGridSig = '';
      if (data.roles) {
        currentRoles = { ...currentRoles, ...data.roles };
      }
      if (data.diagnostics) {
        renderCliDiagnosticsModal(data.diagnostics, true);
      } else {
        await fetchAndRenderCliDiagnostics(false);
      }
      applyRolesToDOM(currentRoles);
      if (logBox) {
        logBox.style.display = 'block';
        logBox.textContent = `🗑️ [${label}] CLI 로그인 슬롯이 제거되었습니다. 상단 드롭다운 목록에서 언제든 다시 추가할 수 있습니다.`;
      }
    } catch (err) {
      if (logBox) {
        logBox.style.display = 'block';
        logBox.textContent = `❌ CLI 슬롯 제거 실패: ${err.message}`;
      }
    }
  }

  let pendingResetSlots = false;
  let pendingResetTimer = null;

  async function handleResetCliSlots() {
    const resetBtn = document.getElementById('btnResetCliSlots');
    const logBox = document.getElementById('cliInstallLogBox');
    if (!pendingResetSlots) {
      pendingResetSlots = true;
      if (pendingResetTimer) clearTimeout(pendingResetTimer);
      if (resetBtn) {
        resetBtn.dataset.origTxt = resetBtn.textContent;
        resetBtn.textContent = '⚠️ 클릭 시 복원 확정';
        resetBtn.style.background = '#fff7ed';
        resetBtn.style.color = '#c2410c';
        resetBtn.style.borderColor = '#fdba74';
      }
      pendingResetTimer = setTimeout(() => {
        pendingResetSlots = false;
        if (resetBtn) {
          resetBtn.textContent = resetBtn.dataset.origTxt || '↺ 기본 목록 복원';
          resetBtn.style.background = '';
          resetBtn.style.color = '';
          resetBtn.style.borderColor = '';
        }
      }, 4500);
      return;
    }
    pendingResetSlots = false;
    if (pendingResetTimer) clearTimeout(pendingResetTimer);
    if (resetBtn) {
      resetBtn.textContent = resetBtn.dataset.origTxt || '↺ 기본 목록 복원';
      resetBtn.style.background = '';
      resetBtn.style.color = '';
      resetBtn.style.borderColor = '';
    }
    try {
      const res = await apiFetch('/ops/cli-slots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset' })
      });
      const data = await res.json().catch(() => ({}));
      lastCliAuthGridSig = '';
      if (data.roles) currentRoles = { ...currentRoles, ...data.roles };
      if (data.diagnostics) {
        renderCliDiagnosticsModal(data.diagnostics, true);
      }
      applyRolesToDOM(currentRoles);
      if (logBox) {
        logBox.style.display = 'block';
        logBox.textContent = `↺ ${data.message || '기본 CLI 로그인 슬롯 목록으로 복원되었습니다.'}`;
      }
    } catch (_) { }
  }

  async function promptAndAddCliSlotFromSelect(onAddedCallback = null) {
    const addBar = document.getElementById('cliSlotAddBar');
    if (addBar) {
      addBar.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const typeSel = document.getElementById('addCliTypeSelect');
      typeSel?.focus();
    }
    const choice = prompt(
      '추가할 AI CLI 종류 번호 또는 이름을 입력하세요 (동일한 AI 추가 시 자동으로 독립 계정으로 격리됩니다):\n' +
      '1. antigravity — Google Antigravity / Gemini (구글 AI)\n' +
      '2. claude — Claude Code (Anthropic AI)\n' +
      '3. openai — OpenAI Codex (ChatGPT AI)\n' +
      '4. grok — xAI Grok (SuperGrok AI)',
      '1'
    );
    if (!choice) return;
    const mapChoice = {
      '1': 'antigravity',
      '2': 'claude',
      '3': 'openai',
      '4': 'grok',
      antigravity: 'antigravity',
      gemini: 'antigravity',
      agy: 'antigravity',
      claude: 'claude',
      openai: 'openai',
      codex: 'openai',
      grok: 'grok'
    };
    const baseType = mapChoice[choice.trim().toLowerCase()] || 'antigravity';
    const customLabel = prompt('표시할 CLI 계정 이름을 입력하세요 (비워두면 계정 번호로 자동 지정):', '') || '';
    try {
      const res = await apiFetch('/ops/cli-slots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add', base_type: baseType, label: customLabel.trim() })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.added) {
        if (data.diagnostics) renderCliDiagnosticsModal(data.diagnostics, true);
        if (typeof onAddedCallback === 'function') {
          await onAddedCallback(data.added.key);
        }
      }
    } catch (_) { }
  }

  async function handleRenameCliSlot(slotKey, newLabel, triggerBtn = null) {
    const clean = (newLabel || '').trim();
    if (!clean) {
      alert('AI 타이틀(표시 이름)을 입력해 주세요.');
      return;
    }
    const logBox = document.getElementById('cliInstallLogBox');
    if (triggerBtn) {
      triggerBtn.disabled = true;
      triggerBtn.textContent = '저장 중...';
    }
    try {
      const res = await apiFetch('/ops/cli-slots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'rename', key: slotKey, label: clean })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error || 'AI 타이틀 수정에 실패했습니다.');
        return;
      }
      if (data.diagnostics) {
        renderCliDiagnosticsModal(data.diagnostics, true);
      } else {
        await fetchAndRenderCliDiagnostics(false);
      }
      applyRolesToDOM(currentRoles);
      if (logBox) {
        logBox.style.display = 'block';
        logBox.textContent = `✏️ ${data.message || `AI 타이틀이 [${clean}]으로 수정되었습니다.`}`;
      }
    } catch (err) {
      alert(`AI 타이틀 변경 오류: ${err.message}`);
    } finally {
      if (triggerBtn) {
        triggerBtn.disabled = false;
      }
    }
  }

  function buildSlotModelOptionsHtml(availModels, selectedModelId) {
    const curSel = (selectedModelId || '').trim();
    const list = Array.isArray(availModels) ? availModels : [];
    const defaultOpt = `<option value="" ${!curSel ? 'selected' : ''}>🔄 CLI 기본 설정 모델 (자동 선택)</option>`;
    if (!list.length) return defaultOpt;

    const grouped = new Map();
    list.forEach(m => {
      const g = m.group || '지원 모델';
      if (!grouped.has(g)) grouped.set(g, []);
      grouped.get(g).push(m);
    });

    const groupsHtml = Array.from(grouped.entries()).map(([grpName, items]) => {
      const opts = items.map(m => {
        const isSel = m.id === curSel && !m.locked;
        const lockPrefix = m.locked ? '🔒 ' : '';
        const lockSuffix = m.locked && m.lock_reason ? ` — [${m.lock_reason}]` : '';
        return `<option value="${escHtml(m.id)}" ${isSel ? 'selected' : ''} ${m.locked ? 'disabled' : ''}>${lockPrefix}${escHtml(m.name)} (${escHtml(m.id)})${escHtml(lockSuffix)}</option>`;
      }).join('');
      return `<optgroup label="${escHtml(grpName)}">${opts}</optgroup>`;
    }).join('');

    return defaultOpt + groupsHtml;
  }

  async function handleSetCliSlotModel(slotKey, modelId) {
    const logBox = document.getElementById('cliInstallLogBox');
    const orchFb = document.getElementById('orchestratorFeedbackText');
    try {
      const res = await apiFetch('/ops/cli-slots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set_model', key: slotKey, model: modelId || '' })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (orchFb) {
          orchFb.style.color = '#dc2626';
          orchFb.textContent = `❌ ${data.error || '모델 설정에 실패했습니다.'}`;
        } else {
          alert(data.error || '모델 설정에 실패했습니다.');
        }
        if (lastDiagnostics) renderCliDiagnosticsModal(lastDiagnostics, true);
        return;
      }
      if (data.diagnostics) {
        renderCliDiagnosticsModal(data.diagnostics, true);
      } else {
        await fetchAndRenderCliDiagnostics(false);
      }
      if (logBox && data.message) {
        logBox.style.display = 'block';
        logBox.textContent = `🤖 ${data.message}`;
      }
      if (orchFb && data.message) {
        orchFb.style.color = '#0f6848';
        orchFb.textContent = `✓ ${data.message} (실제 CLI --model 인자로 직접 호출됩니다)`;
      }
    } catch (err) {
      alert(`실행 모델 변경 오류: ${err.message}`);
    }
  }

  async function handleRefreshRealModels(triggerBtn = null) {
    const orchFb = document.getElementById('orchestratorFeedbackText');
    const orig = triggerBtn ? triggerBtn.textContent : '';
    if (triggerBtn) {
      triggerBtn.disabled = true;
      triggerBtn.textContent = '⏳ 조회 중...';
    }
    try {
      const res = await apiFetch('/ops/cli-slots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'refresh_models' })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.diagnostics) {
        renderCliDiagnosticsModal(data.diagnostics, true);
        if (orchFb) {
          orchFb.style.color = '#0f6848';
          orchFb.textContent = `✓ ${data.message || '실제 CLI 모델 목록 새로고침 완료'}`;
        }
      }
    } catch (_) { } finally {
      if (triggerBtn) {
        triggerBtn.disabled = false;
        triggerBtn.textContent = orig || '🔄 실제 모델 목록 새로고침';
      }
    }
  }

  function renderOrchestratorModeControls(diag) {
    const d = diag || lastDiagnostics || {};
    const providers = d.providers || {};
    const keys = Object.keys(providers);
    if (!keys.length) return;

    const slotSel = document.getElementById('realModelSlotSelect');
    const modelSel = document.getElementById('realAntigravityModelSelect');
    const tierBadge = document.getElementById('orchestratorTierStatusBadge');

    if (slotSel && document.activeElement !== slotSel) {
      const prevSlot = (slotSel.value && providers[slotSel.value])
        ? slotSel.value
        : (providers.antigravity ? 'antigravity' : keys[0]);
      slotSel.innerHTML = keys.map(k => {
        const p = providers[k] || {};
        const stTxt = p.auth_state === 'LOGGED_IN' ? '로그인됨' : '미로그인';
        return `<option value="${escHtml(k)}" ${k === prevSlot ? 'selected' : ''}>${escHtml(p.label || k)} (${stTxt})</option>`;
      }).join('');
      slotSel.value = prevSlot;
    }

    const activeSlotKey = (slotSel && slotSel.value && providers[slotSel.value])
      ? slotSel.value
      : (providers.antigravity ? 'antigravity' : keys[0]);
    const activeProv = providers[activeSlotKey] || {};
    const availModels = Array.isArray(activeProv.available_models) ? activeProv.available_models : [];
    const unlockedCount = availModels.filter(m => !m.locked).length;

    if (modelSel && document.activeElement !== modelSel) {
      modelSel.innerHTML = buildSlotModelOptionsHtml(availModels, activeProv.selected_model || '');
    }

    if (tierBadge) {
      const tier = (activeProv.orchestrator_tier || 'free').toLowerCase();
      const srcNote = activeProv.models_source === 'agy_live_cli' ? 'agy.exe 실시간 조회' : 'CLI 모델 목록';
      if (tier === 'ultra') {
        tierBadge.className = 'orch-tier-pill ultra';
        tierBadge.textContent = `💎 ${srcNote}: 전체 ${availModels.length}종 해금 (Ultra)`;
      } else if (tier === 'pro') {
        tierBadge.className = 'orch-tier-pill pro';
        tierBadge.textContent = `🔷 ${srcNote}: ${availModels.length}종 중 ${unlockedCount}종 선택 가능 (Pro · Argon 포함)`;
      } else {
        tierBadge.className = 'orch-tier-pill free';
        tierBadge.textContent = `🆓 ${srcNote}: ${availModels.length}종 중 ${unlockedCount}종 선택 가능 (Free)`;
      }
    }
  }

  function bindOrchestratorModeControls() {
    const slotSel = document.getElementById('realModelSlotSelect');
    const modelSel = document.getElementById('realAntigravityModelSelect');
    const refreshBtn = document.getElementById('btnRefreshRealModels');

    if (slotSel && !slotSel.dataset.bound) {
      slotSel.dataset.bound = '1';
      slotSel.addEventListener('change', () => {
        renderOrchestratorModeControls(lastDiagnostics);
      });
    }
    if (modelSel && !modelSel.dataset.bound) {
      modelSel.dataset.bound = '1';
      modelSel.addEventListener('change', () => {
        const sKey = slotSel?.value || 'antigravity';
        handleSetCliSlotModel(sKey, modelSel.value || '');
      });
    }
    if (refreshBtn && !refreshBtn.dataset.bound) {
      refreshBtn.dataset.bound = '1';
      refreshBtn.addEventListener('click', () => handleRefreshRealModels(refreshBtn));
    }
  }

  function renderCliDiagnosticsModal(diag, forceRender = false) {
    lastDiagnostics = diag || getFallbackDiagnostics();
    const providers = lastDiagnostics.providers || {};
    syncAllCliDropdowns(providers);
    renderOrchestratorModeControls(lastDiagnostics);
    renderConnectedAccountsList(lastDiagnostics);
    if (renderDashboardAgentsAndStatsFn) renderDashboardAgentsAndStatsFn(forceRender);
    if (studioRefreshDirectoryFn) {
      const ae = document.activeElement;
      const isTypingInStudio = !forceRender && ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA') && document.getElementById('characters')?.contains(ae);
      if (!isTypingInStudio) {
        studioRefreshDirectoryFn();
      }
    }
    const grid = document.getElementById('cliAuthGrid');
    const headline = document.getElementById('cliSummaryHeadline');
    const sub = document.getElementById('cliSummarySub');
    const dot = document.getElementById('cliSettingsDot');

    const keys = Object.keys(providers);
    const list = keys.map(k => providers[k]).filter(Boolean);
    const loggedInCount = list.filter(p => p.auth_state === 'LOGGED_IN').length;
    const installedCount = list.filter(p => p.installed).length;

    if (dot) {
      dot.className = `cli-settings-dot ${loggedInCount >= 3 ? '' : loggedInCount >= 1 || installedCount >= 1 ? 'warn' : 'off'}`;
    }

    if (headline) {
      if (lastDiagnostics.triad_state === 'STATIC_FALLBACK') {
        headline.textContent = '현재 정적 파일 서버(http.server) 모드 · 404 방지 폴백 활성화됨';
      } else {
        const activeOrch = (lastDiagnostics.active_orchestrator_mode || 'standard').toUpperCase();
        headline.textContent = `활성 CLI 슬롯: ${list.length}개 · 구독 로그인 확인: ${loggedInCount}/${list.length}개 · 오케스트레이터: ${activeOrch} (${lastDiagnostics.triad_state || 'TRIAD'})`;
      }
    }
    if (sub) {
      const stripped = (lastDiagnostics.forbidden_keys_stripped || ['OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'GOOGLE_API_KEY']).join(', ');
      sub.textContent = `종량제 API 키 차단(Sanitized): ${stripped} 자동 제거 · 마지막 확인: ${new Date().toLocaleTimeString('ko-KR')}`;
    }

    if (!grid) {
      renderCliQuotaGauges();
      return;
    }

    // 3초 주기 폴링 중 변경이 없거나 사용자가 편집/삭제 확인 중이면 카드 DOM 덮어쓰기 방지
    const cliGridSig = JSON.stringify(keys.map(k => {
      const p = providers[k] || {};
      return [k, p.label, p.auth_state, p.account_email, p.plan_name, p.orchestrator_tier, p.selected_model, p.executable, p.custom_executable, (p.available_models || []).length];
    }));
    if (!forceRender && grid.children.length === keys.length) {
      const activeInGrid = grid.contains(document.activeElement);
      const hasDirtyTitle = Array.from(grid.querySelectorAll('.cli-title-inline-input')).some(inp => inp.classList.contains('is-dirty'));
      if (activeInGrid || hasDirtyTitle || Boolean(pendingRemoveSlotKey) || cliGridSig === lastCliAuthGridSig) {
        renderCliQuotaGauges();
        return;
      }
    }
    lastCliAuthGridSig = cliGridSig;

    grid.innerHTML = keys.map(key => {
      const p = providers[key] || {};
      const state = p.auth_state || 'NOT_INSTALLED';
      const cardCls = state === 'LOGGED_IN' ? 'logged-in' : state === 'AUTH_REQUIRED' ? 'auth-required' : '';
      const cliName = p.cli || (key === 'claude' ? 'claude' : key === 'antigravity' ? 'agy' : key === 'gemini' ? 'gemini' : key === 'grok' ? 'grok' : 'codex');
      const dispTitle = p.label || key;
      const planSrcLabel = p.plan_source_label || (state === 'LOGGED_IN' ? '계정 연결 자동 실측' : '로그인 후 자동 로드');

      const actionButtonsHtml = !p.installed
        ? `
          <button type="button" class="btn small primary btn-install-cli" data-cli="${cliName}">⚡ 원클릭 설치 (${cliName})</button>
          <button type="button" class="btn small mint btn-login-cli" data-cli="${key}">🔑 설치+로그인 창 열기</button>
          <button type="button" class="btn small btn-remove-cli-slot" data-slot-key="${key}" title="이 CLI 로그인 슬롯 제거">🗑️ 제거</button>
        `
        : state === 'LOGGED_IN'
          ? `
          <button type="button" class="btn small" style="background:#dcfce7;color:#15803d;border-color:#86efac" disabled>✓ 구독 로그인 완료됨</button>
          <button type="button" class="btn small mint btn-login-cli" data-cli="${key}" title="다른 계정으로 다시 로그인">🔑 계정 변경/재로그인</button>
          <button type="button" class="btn small btn-remove-cli-slot" data-slot-key="${key}" title="이 CLI 로그인 슬롯 제거">🗑️ 제거</button>
        `
          : `
          <button type="button" class="btn small mint btn-login-cli" data-cli="${key}">🔑 원클릭 로그인 창 열기</button>
          <button type="button" class="btn small btn-install-cli" data-cli="${cliName}">🔄 재설치/연결</button>
          <button type="button" class="btn small btn-remove-cli-slot" data-slot-key="${key}" title="이 CLI 로그인 슬롯 제거">🗑️ 제거</button>
        `;

      return `
        <div class="cli-auth-card ${cardCls}" data-slot-card="${key}">
          <div class="cli-auth-top">
            <div class="cli-auth-title" style="flex:1;min-width:0">
              <div class="cli-title-edit-wrap">
                <input type="text" class="cli-title-inline-input" data-slot-title-input="${key}" data-orig-title="${escHtml(dispTitle)}" value="${escHtml(dispTitle)}" maxlength="80" title="클릭하여 AI 타이틀을 수정하고 Enter 또는 저장 버튼을 누르세요" aria-label="${escHtml(dispTitle)} AI 타이틀 수정">
                <button type="button" class="btn-save-cli-title" data-slot-key="${key}" title="AI 타이틀 수정 / 저장">✏️ 이름 수정</button>
              </div>
            </div>
            <div style="display:flex;align-items:center;gap:6px;flex-shrink:0">
              <span class="cli-auth-badge ${state}">${p.auth_label || state}</span>
              <button type="button" class="btn-remove-cli-slot" data-slot-key="${key}" title="${escHtml(dispTitle)} 로그인 슬롯 제거">🗑️ 제거</button>
            </div>
          </div>
          <div class="cli-auth-detail">${p.auth_detail || ''}</div>
          <div class="cli-auth-rows">
            <div class="cli-auth-row"><span>로그인 계정</span><strong>${p.account_email || '미로그인'}</strong></div>
            <div class="cli-auth-row"><span>적용 중인 플랜</span><strong style="color:${p.is_subscribed ? (p.is_paid ? '#15803d' : '#0284c7') : '#64748b'}">${p.plan_name || p.plan_label || '미구독 / 미로그인'}</strong></div>
            <div class="cli-auth-row"><span>플랜 판별 근거</span><strong style="color:#334155">${planSrcLabel}</strong></div>
            <div class="cli-auth-row"><span>CLI 명령어 / 슬롯 ID</span><code>${cliName} (${key})</code></div>
            ${p.profile_dir ? `<div class="cli-auth-row"><span>격리 프로필 폴더</span><code>${p.profile_dir}</code></div>` : ''}
            <div class="cli-auth-row"><span>감지된 버전</span><strong>${p.version || '미확인'}</strong></div>
            <div class="cli-auth-row"><span>실행 파일 경로</span><code>${p.executable || 'PATH 미감지 (원클릭 설치 가능)'}</code></div>
            <div class="cli-auth-row"><span>종량제 API 키</span><strong style="color:#15803d">차단됨 (구독 전용)</strong></div>
          </div>
          <div class="cli-plan-verify-box">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;flex-wrap:wrap">
              <label style="font-size:10px;font-weight:800;color:#0f6848">🤖 사용할 실제 모델 선택 (${p.models_source === 'agy_live_cli' ? `agy.exe 실시간 ${Array.isArray(p.available_models) ? p.available_models.length : 0}종` : 'CLI 지원 모델'})</label>
              <span style="font-size:9.5px;font-weight:700;color:#64748b">자동 로드 등급: <b>${(p.orchestrator_tier || 'none').toUpperCase()}</b> · <code style="font-size:9px;color:#475569">${escHtml(p.selected_model || 'CLI 기본값')}</code></span>
            </div>
            <select class="cli-plan-override-select cli-slot-model-select" data-slot-key="${key}" aria-label="${escHtml(dispTitle)} 사용할 실제 모델 선택">
              ${buildSlotModelOptionsHtml(p.available_models, p.selected_model)}
            </select>
          </div>
          ${(() => {
          const q = getCliQuotaStatus(key);
          if (!q.isSubscribed) {
            return `
                <div class="cli-quota-box" style="margin-top:0">
                  <div class="cli-quota-top"><span>✕ ${q.planName}</span><strong>일일 0/0회 · 월간 0/0회</strong></div>
                  <div class="cli-quota-track"><span class="cli-quota-fill unsub" style="width:0%"></span></div>
                  <div class="cli-quota-meta"><span>로그인 후 일일/월간 한도 활성화</span><span class="cli-quota-pct unsub">${q.statusBadgeText}</span></div>
                </div>
              `;
          }
          return `
              <div class="cli-quota-box" style="margin-top:0">
                <div class="cli-quota-top"><span>📅 일일 제한 (Daily)</span><strong>${q.calls} / ${q.maxCalls}회 · 잔여 ${q.dailyRemainPct}%</strong></div>
                <div class="cli-quota-track"><span class="cli-quota-fill ${q.level}" style="width:${q.dailyRemainPct}%"></span></div>
                <div class="cli-quota-top" style="margin-top:3px"><span>🗓️ 월간 제한 (Monthly)</span><strong>${q.monthlyUsedCalls} / ${q.monthlyMaxCalls}회 · 잔여 ${q.monthlyRemainPct}%</strong></div>
                <div class="cli-quota-track"><span class="cli-quota-fill ${q.level}" style="width:${q.monthlyRemainPct}%"></span></div>
                <div class="cli-quota-meta"><span>플랜: ${q.planName}</span><span class="cli-quota-pct ${q.level}">${q.statusBadgeText}</span></div>
              </div>
            `;
        })()}
          <div>
            <label style="display:block;font-size:9.5px;font-weight:700;color:#475569;margin-bottom:4px">수동 실행 파일 경로 지정 (${cliName}.exe / .cmd)</label>
            <input type="text" class="cli-path-input" data-cli-path="${cliName}" value="${p.custom_executable || p.executable || ''}" placeholder="예: C:\\Users\\...\\${cliName}.exe">
          </div>
          <div class="cli-card-actions">
            ${actionButtonsHtml}
          </div>
        </div>
      `;
    }).join('');

    grid.querySelectorAll('.cli-title-inline-input').forEach(inp => {
      const sKey = inp.dataset.slotTitleInput;
      const saveBtn = grid.querySelector(`.btn-save-cli-title[data-slot-key="${sKey}"]`);
      const syncDirtyState = () => {
        const dirty = inp.value.trim() !== (inp.dataset.origTitle || '').trim();
        inp.classList.toggle('is-dirty', dirty);
        if (saveBtn) {
          saveBtn.classList.toggle('is-dirty', dirty);
          saveBtn.textContent = dirty ? '💾 저장' : '✏️ 이름 수정';
        }
      };
      inp.addEventListener('input', syncDirtyState);
      inp.addEventListener('keydown', (ev) => {
        if (ev.isComposing) return;
        if (ev.key === 'Enter') {
          ev.preventDefault();
          const val = inp.value.trim();
          if (val && val !== (inp.dataset.origTitle || '').trim()) {
            handleRenameCliSlot(sKey, val, saveBtn);
          } else {
            inp.blur();
          }
        } else if (ev.key === 'Escape') {
          inp.value = inp.dataset.origTitle || '';
          syncDirtyState();
          inp.blur();
        }
      });
    });

    grid.querySelectorAll('.btn-save-cli-title').forEach(btn => {
      btn.addEventListener('click', () => {
        const sKey = btn.dataset.slotKey;
        const inp = grid.querySelector(`.cli-title-inline-input[data-slot-title-input="${sKey}"]`);
        if (!inp) return;
        const val = inp.value.trim();
        if (val && val !== (inp.dataset.origTitle || '').trim()) {
          handleRenameCliSlot(sKey, val, btn);
        } else {
          inp.focus();
          inp.select();
        }
      });
    });

    grid.querySelectorAll('.cli-slot-model-select').forEach(sel => {
      sel.addEventListener('change', (ev) => {
        const sKey = ev.currentTarget.dataset.slotKey;
        const val = ev.currentTarget.value || '';
        handleSetCliSlotModel(sKey, val);
      });
    });
    grid.querySelectorAll('.btn-install-cli').forEach(btn => {
      btn.addEventListener('click', () => triggerOneClickInstall(btn.dataset.cli, btn));
    });
    grid.querySelectorAll('.btn-login-cli').forEach(btn => {
      btn.addEventListener('click', () => triggerCliLoginTerminal(btn.dataset.cli, btn));
    });
    grid.querySelectorAll('.btn-remove-cli-slot').forEach(btn => {
      btn.addEventListener('click', (ev) => handleRemoveCliSlot(btn.dataset.slotKey, ev.currentTarget));
    });
    grid.querySelectorAll('.btn-copy-login').forEach(btn => {
      btn.addEventListener('click', () => {
        const cmd = btn.dataset.cmd || '';
        navigator.clipboard?.writeText(cmd);
        const orig = btn.textContent;
        btn.textContent = `✓ 복사됨 (${cmd})`;
        setTimeout(() => { btn.textContent = orig; }, 1400);
      });
    });
    renderCliQuotaGauges();
  }

  async function fetchAndRenderCliDiagnostics(deep = false) {
    const btn = document.getElementById('btnDeepProbeCli');
    if (btn && deep) {
      btn.disabled = true;
      btn.textContent = '검증 중...';
    }
    try {
      const res = await apiFetch(`/ops/cli-check?deep=${deep ? '1' : '0'}`, { cache: 'no-store' });
      if (res.ok) {
        backendAvailable = true;
        const diag = await res.json();
        renderCliDiagnosticsModal(diag, true);
        return;
      }
      if (res.status === 404) backendAvailable = false;
    } catch (_) { } finally {
      if (btn && deep) {
        btn.disabled = false;
        btn.textContent = '🔍 실시간 로그인 검증 (Deep Probe)';
      }
    }
    renderCliDiagnosticsModal(getFallbackDiagnostics(), true);
  }

  async function saveCustomCliPaths() {
    const btn = document.getElementById('btnSaveCliPaths');
    const paths = {};
    document.querySelectorAll('[data-cli-path]').forEach(inp => {
      paths[inp.dataset.cliPath] = (inp.value || '').trim();
    });
    if (btn) {
      btn.disabled = true;
      btn.textContent = '저장 및 검증 중...';
    }
    try {
      const res = await apiFetch('/ops/cli-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paths })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.diagnostics) renderCliDiagnosticsModal(data.diagnostics, true);
      }
    } catch (_) { } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = '💾 실행 경로 저장 & 재검증';
      }
    }
  }

  function openCliSettingsModal(deep = false) {
    ensureCliSettingsModal();
    const backdrop = document.getElementById('cliSettingsModalBackdrop');
    backdrop?.classList.add('open');
    fetchAndRenderCliDiagnostics(deep);
  }

  let lastRenderedMissionId = null;
  let latestOutputDirStatus = null;

  function renderOutputDirStatus(st, customFeedback = null, isError = false) {
    if (!st) return;
    latestOutputDirStatus = st;

    const badgeEl = document.getElementById('outputDirModeBadge');
    const activeTxtEl = document.getElementById('outputDirActiveText');
    const inputEl = document.getElementById('outputDirInput');
    const chkMirrorEl = document.getElementById('chkMirrorLocalDeliverables');
    const btnQuickGd = document.getElementById('btnQuickSetGoogleDrive');
    const btnBrowseGd = document.getElementById('btnBrowseGoogleDriveDir');
    const fbEl = document.getElementById('outputDirFeedbackText');
    const recentSel = document.getElementById('recentOutputDirsSelect');

    const dashBadgeEl = document.getElementById('dashOutputDirBadge');
    const dashTxtEl = document.getElementById('dashOutputDirText');

    const isGd = Boolean(st.is_google_drive);
    const isDef = Boolean(st.is_default);
    const outPath = st.output_dir || 'deliverables/';

    if (badgeEl) {
      if (isGd) {
        badgeEl.style.background = '#e0f2fe';
        badgeEl.style.color = '#0369a1';
        badgeEl.textContent = '☁️ Google Drive 동기화 폴더 지정됨';
      } else if (isDef) {
        badgeEl.style.background = '#e6f9f1';
        badgeEl.style.color = '#0f6848';
        badgeEl.textContent = '📁 기본 저장 폴더 (deliverables/)';
      } else {
        badgeEl.style.background = '#fef3c7';
        badgeEl.style.color = '#b45309';
        badgeEl.textContent = '📂 사용자 지정 로컬 폴더';
      }
    }
    if (activeTxtEl) activeTxtEl.textContent = outPath;
    if (inputEl && document.activeElement !== inputEl && !inputEl.dataset.dirty) {
      inputEl.value = isDef ? '' : outPath;
    }
    if (chkMirrorEl) chkMirrorEl.checked = Boolean(st.mirror_to_local);

    if (dashBadgeEl) {
      const gdDirect = st.gdrive_direct || {};
      if (gdDirect.enabled && gdDirect.connected) {
        dashBadgeEl.style.background = '#dbeafe';
        dashBadgeEl.style.color = '#1d4ed8';
        dashBadgeEl.textContent = '☁️ Google Drive 클라우드 직접 연결됨';
      } else {
        dashBadgeEl.style.background = isGd ? '#e0f2fe' : (isDef ? '#e6f9f1' : '#fef3c7');
        dashBadgeEl.style.color = isGd ? '#0369a1' : (isDef ? '#0f6848' : '#b45309');
        dashBadgeEl.textContent = isGd ? '☁️ Google Drive(로컬F:) 저장 중' : (isDef ? '📁 기본 저장 폴더' : '📂 지정 저장 폴더');
      }
    }
    if (dashTxtEl) {
      const gdDirect = st.gdrive_direct || {};
      dashTxtEl.textContent = (gdDirect.enabled && gdDirect.connected)
        ? `클라우드 [${gdDirect.folder_name}] + 로컬 [${outPath}]`
        : outPath;
    }

    // Update Google Drive Direct Cloud bar in settings.html
    const gdDirect = st.gdrive_direct || {};
    const gdBadgeEl = document.getElementById('gdriveDirectBadge');
    const gdSumEl = document.getElementById('gdriveDirectSummaryText');
    const gdWebBtn = document.getElementById('gdriveDirectOpenWebBtn');
    if (gdBadgeEl) {
      if (gdDirect.connected && gdDirect.enabled) {
        gdBadgeEl.style.background = '#dcfce7';
        gdBadgeEl.style.color = '#15803d';
        gdBadgeEl.textContent = `☁️ Google Drive 직접 연결됨 (${gdDirect.account_email || '활성'})`;
      } else if (gdDirect.connected && !gdDirect.enabled) {
        gdBadgeEl.style.background = '#fef3c7';
        gdBadgeEl.style.color = '#b45309';
        gdBadgeEl.textContent = `☁️ 연결됨 · 자동 업로드 OFF (${gdDirect.account_email || ''})`;
      } else {
        gdBadgeEl.style.background = '#e2e8f0';
        gdBadgeEl.style.color = '#475569';
        gdBadgeEl.textContent = '☁️ Google Drive 직접 연결 안 됨';
      }
    }
    if (gdSumEl) {
      if (gdDirect.connected) {
        gdSumEl.innerHTML = `대상 클라우드 폴더: <strong>📁 ${(gdDirect.folder_name || '내 드라이브').replace(/</g, '&lt;')}</strong> <span style="color:#64748b">(${gdDirect.enabled ? '미션 완료 시 자동 업로드 ON' : '자동 업로드 일시정지'})</span>`;
      } else if (gdDirect.gcloud_pending_email) {
        gdSumEl.innerHTML = `PC에 로그인된 구글 계정(<strong>${gdDirect.gcloud_pending_email}</strong>) 감지됨 — 우측 버튼에서 <b>[🔑 원클릭 권한 허용]</b>만 누르면 즉시 직접 연결됩니다!`;
      } else {
        gdSumEl.textContent = '구글 계정을 직접 연결하면 데스크톱 앱 없이도 클라우드 Google Drive 폴더를 탐색·지정하여 자동 업로드합니다.';
      }
    }
    if (gdWebBtn) {
      if (gdDirect.connected && gdDirect.folder_url) {
        gdWebBtn.style.display = 'inline-flex';
        gdWebBtn.href = gdDirect.folder_url;
      } else {
        gdWebBtn.style.display = 'none';
      }
    }

    const gdrives = Array.isArray(st.detected_google_drives) ? st.detected_google_drives : [];
    if (btnQuickGd) {
      if (gdrives.length > 0) {
        btnQuickGd.style.display = 'inline-flex';
        btnQuickGd.textContent = `⚡ 구글 드라이브 자동 지정 (${gdrives[0].drive || 'GDrive'})`;
        btnQuickGd.dataset.suggested = gdrives[0].suggested || gdrives[0].root || '';
      } else {
        btnQuickGd.style.display = 'none';
      }
    }
    if (btnBrowseGd) {
      btnBrowseGd.dataset.gdriveRoot = gdrives.length > 0 ? (gdrives[0].root || '') : '';
    }

    if (recentSel) {
      const recents = Array.isArray(st.recent_dirs) ? st.recent_dirs : [];
      const gdSuggested = gdrives.map(g => g.suggested).filter(Boolean);
      const merged = Array.from(new Set([...gdSuggested, ...recents]));
      if (merged.length > 0) {
        recentSel.style.display = 'inline-block';
        recentSel.innerHTML = `<option value="">🕘 빠른 폴더 전환 (${merged.length}개)...</option>` +
          merged.map(d => `<option value="${d.replace(/"/g, '&quot;')}">${d}</option>`).join('');
      } else {
        recentSel.style.display = 'none';
      }
    }

    if (fbEl) {
      if (customFeedback) {
        fbEl.style.color = isError ? '#dc2626' : '#0f6848';
        fbEl.textContent = customFeedback;
      } else if (st.fallback_notice) {
        fbEl.style.color = '#d97706';
        fbEl.textContent = `⚠️ ${st.fallback_notice}`;
      } else if (isGd) {
        fbEl.style.color = '#0369a1';
        fbEl.textContent = `☁️ Google Drive 폴더(${outPath})에 미션 프로젝트 및 리포트가 저장·자동 동기화됩니다.${st.has_non_ascii_or_space ? ' (참고: 한글/공백 경로 포함 — 파이썬·웹·문서 저장은 정상이나 Flutter/RN 앱 빌드 시에는 영문 경로 권장)' : ''}`;
      } else if (!isDef) {
        fbEl.style.color = '#0f6848';
        fbEl.textContent = `✓ 지정된 폴더(${outPath})에 다음 미션부터 모든 산출물과 프로젝트 파일이 저장됩니다.${st.has_non_ascii_or_space ? ' (참고: 한글/공백 경로 포함 — Flutter/RN 네이티브 빌드 시에는 영문 전용 경로 권장)' : ''}`;
      } else {
        const gdHint = gdrives.length > 0 ? ` (감지된 Google Drive: ${gdrives[0].root})` : '';
        fbEl.style.color = '#64748b';
        fbEl.textContent = `💡 기본 폴더(deliverables/) 사용 중입니다. 원하는 로컬 폴더 또는 Google Drive 폴더를 지정할 수 있습니다.${gdHint}`;
      }
    }
  }

  function bindProjectOutputDirControls() {
    const inputEl = document.getElementById('outputDirInput');
    const btnApply = document.getElementById('btnApplyOutputDir');
    const btnBrowseLocal = document.getElementById('btnBrowseLocalDir');
    const btnBrowseGd = document.getElementById('btnBrowseGoogleDriveDir');
    const btnQuickGd = document.getElementById('btnQuickSetGoogleDrive');
    const btnOpenExp = document.getElementById('btnOpenOutputExplorer');
    const btnDashOpenExp = document.getElementById('btnDashOpenOutputExplorer');
    const btnReset = document.getElementById('btnResetOutputDir');
    const chkMirror = document.getElementById('chkMirrorLocalDeliverables');
    const recentSel = document.getElementById('recentOutputDirsSelect');

    inputEl?.addEventListener('input', () => {
      inputEl.dataset.dirty = '1';
    });
    inputEl?.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') {
        ev.preventDefault();
        btnApply?.click();
      }
    });

    function getSelectedSettingsTeam() {
      const selEl = document.getElementById('triadTeamSelect');
      const tid = selEl?.value || '';
      if (!tid || !latestTeamsSummary || !Array.isArray(latestTeamsSummary.teams)) return null;
      return latestTeamsSummary.teams.find(t => t.id === tid) || null;
    }

    async function applyOutputDirRequest(payload, loadingBtn = null) {
      const origTxt = loadingBtn?.textContent || '';
      if (loadingBtn) {
        loadingBtn.disabled = true;
        loadingBtn.textContent = '처리 중...';
      }
      try {
        const activeTeamObj = getSelectedSettingsTeam();
        if (activeTeamObj && (payload.action === 'set' || payload.action === 'reset')) {
          const wsUpdate = payload.action === 'reset'
            ? { output_dir: '' }
            : {
              ...(payload.output_dir !== undefined ? { output_dir: payload.output_dir } : {}),
              ...(payload.mirror_to_local !== undefined ? { mirror_to_local: payload.mirror_to_local } : {})
            };
          const tRes = await apiFetch('/ops/teams', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'set_workspace', team_id: activeTeamObj.id, workspace: wsUpdate })
          });
          const tData = await tRes.json().catch(() => ({}));
          if (!tRes.ok) {
            if (latestOutputDirStatus) renderOutputDirStatus(latestOutputDirStatus, `❌ ${tData.error || '팀 작업 폴더 설정 실패'}`, true);
            return;
          }
          if (inputEl) delete inputEl.dataset.dirty;
          if (tData.teams_summary) {
            renderTeamsAndWorkspacesDashboard(tData.teams_summary);
            syncSettingsBarFromTeam(activeTeamObj.id, `✓ [${activeTeamObj.name}] 작업 폴더 설정이 저장되었습니다.`);
          }
          return;
        }

        const res = await apiFetch('/ops/output-dir', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          if (latestOutputDirStatus) {
            renderOutputDirStatus(latestOutputDirStatus, `❌ ${data.error || '저장 폴더 설정 실패'}`, true);
          }
          return;
        }
        if (inputEl) delete inputEl.dataset.dirty;
        const stObj = data.output_dir_status || data.status;
        if (stObj && typeof stObj === 'object' && stObj.output_dir) {
          renderOutputDirStatus(stObj, `✓ ${data.message || `저장 폴더가 [${stObj.output_dir}]로 설정되었습니다.`}`, false);
        }
      } catch (_) {
        if (latestOutputDirStatus) {
          renderOutputDirStatus(latestOutputDirStatus, '❌ 서버와 통신할 수 없습니다 (python server.py 8080 실행 확인).', true);
        }
      } finally {
        if (loadingBtn) {
          loadingBtn.disabled = false;
          loadingBtn.textContent = origTxt;
        }
      }
    }

    btnApply?.addEventListener('click', () => {
      const val = (inputEl?.value || '').trim();
      applyOutputDirRequest({ action: 'set', output_dir: val, mirror_to_local: Boolean(chkMirror?.checked) }, btnApply);
    });

    chkMirror?.addEventListener('change', () => {
      applyOutputDirRequest({ action: 'set', mirror_to_local: Boolean(chkMirror.checked) });
    });

    btnBrowseLocal?.addEventListener('click', () => {
      const activeTeamObj = getSelectedSettingsTeam();
      openLocalFolderPicker({
        initialDir: activeTeamObj?.workspace_status?.effective_dir || latestOutputDirStatus?.output_dir || '',
        teamId: activeTeamObj ? activeTeamObj.id : null,
        teamName: activeTeamObj ? activeTeamObj.name : ''
      });
    });

    btnBrowseGd?.addEventListener('click', () => {
      const gdRoot = btnBrowseGd.dataset.gdriveRoot || '';
      const activeTeamObj = getSelectedSettingsTeam();
      openLocalFolderPicker({
        initialDir: gdRoot || activeTeamObj?.workspace_status?.effective_dir || '',
        teamId: activeTeamObj ? activeTeamObj.id : null,
        teamName: activeTeamObj ? activeTeamObj.name : ''
      });
    });

    btnQuickGd?.addEventListener('click', () => {
      const suggested = btnQuickGd.dataset.suggested || '';
      if (!suggested) return;
      if (inputEl) {
        inputEl.value = suggested;
        delete inputEl.dataset.dirty;
      }
      applyOutputDirRequest({ action: 'set', output_dir: suggested, mirror_to_local: Boolean(chkMirror?.checked) }, btnQuickGd);
    });

    const openExplorerHandler = () => {
      const activeTeamObj = getSelectedSettingsTeam();
      const ws = activeTeamObj?.workspace_status || {};
      if (ws.is_cloud_primary && ws.gdrive_direct?.folder_url) {
        window.open(ws.gdrive_direct.folder_url, '_blank', 'noopener');
        return;
      }
      const targetDir = ws.effective_dir || latestOutputDirStatus?.output_dir || '';
      openLocalFolderExplorer(targetDir, activeTeamObj ? activeTeamObj.name : '전역 저장 폴더', activeTeamObj ? activeTeamObj.id : null);
    };
    btnOpenExp?.addEventListener('click', openExplorerHandler);
    btnDashOpenExp?.addEventListener('click', openExplorerHandler);

    btnReset?.addEventListener('click', () => {
      if (inputEl) {
        inputEl.value = '';
        delete inputEl.dataset.dirty;
      }
      applyOutputDirRequest({ action: 'reset' }, btnReset);
    });

    recentSel?.addEventListener('change', () => {
      const chosen = recentSel.value;
      if (!chosen) return;
      recentSel.value = '';
      if (inputEl) {
        inputEl.value = chosen;
        delete inputEl.dataset.dirty;
      }
      applyOutputDirRequest({ action: 'set', output_dir: chosen, mirror_to_local: Boolean(chkMirror?.checked) });
    });

    document.getElementById('btnOpenGdriveModal')?.addEventListener('click', () => openGdriveDirectModal());
    document.getElementById('btnDashOpenGdriveModal')?.addEventListener('click', () => openGdriveDirectModal());

    window.addEventListener('message', (ev) => {
      if (ev.data && ev.data.type === 'NEXUS_GDRIVE_CONNECTED') {
        refreshGdriveModalState(true);
      }
    });

    // Initial fetch of output_dir status
    apiFetch('/ops/output-dir', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .then(st => { if (st) renderOutputDirStatus(st); })
      .catch(() => { });
  }

  // ========================================================================
  // [신규] 웹 내장 로컬/드라이브 폴더 탐색기 & 작업 폴더 변경 모달 (#localFsModalBackdrop)
  // ========================================================================
  function formatByteSize(bytes) {
    const n = Number(bytes || 0);
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  }

  function showTeamCardFlashMessage(teamId, text, isErr = false) {
    if (!teamId) return;
    const stBox = document.querySelector(`.team-dispatch-status[data-status-tid="${teamId}"]`);
    if (!stBox) return;
    stBox.style.display = 'block';
    stBox.dataset.pinned = '1';
    stBox.style.background = isErr ? '#fef2f2' : '#f0fdf4';
    stBox.style.borderColor = isErr ? '#fecaca' : '#86efac';
    stBox.style.color = isErr ? '#b91c1c' : '#166534';
    stBox.textContent = text;
    setTimeout(() => {
      delete stBox.dataset.pinned;
      stBox.style.display = 'none';
    }, 6500);
  }

  function ensureLocalFsModal() {
    if (document.getElementById('localFsModalBackdrop')) return;
    const wrap = document.createElement('div');
    wrap.id = 'localFsModalBackdrop';
    wrap.className = 'cli-modal-backdrop';
    wrap.style.zIndex = '1100';
    wrap.innerHTML = `
      <div class="cli-modal" role="dialog" aria-modal="true" aria-labelledby="lfsModalTitle" style="max-width:780px;width:96%">
        <div class="cli-modal-head">
          <div>
            <div class="eyebrow" id="lfsModalEyebrow" style="color:#0f6848">TEAM WORKSPACE EXPLORER &amp; DIRECTORY PICKER</div>
            <h2 id="lfsModalTitle">🗂️ 팀 작업 폴더 열기 &amp; 파일 탐색</h2>
            <p id="lfsModalSub">폴더 내 프로젝트·리포트·소스 파일을 바로 확인하고, 새 폴더를 만들거나 작업 폴더 경로를 변경할 수 있습니다.</p>
          </div>
          <button type="button" class="cli-modal-close" id="btnCloseLfsModal" aria-label="닫기">✕</button>
        </div>

        <div class="cli-modal-body" style="gap:11px;padding:16px 22px">
          <!-- 1. 빠른 루트 이동 버튼 바 -->
          <div id="lfsRootsBar" style="display:flex;gap:6px;flex-wrap:wrap;align-items:center"></div>

          <!-- 2. 직접 경로 입력 & 복사 / OS 탐색기 실행 바 -->
          <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
            <input type="text" id="lfsPathInput" class="triad-goal-input" style="height:33px;flex:1;min-width:240px;font-family:var(--font-mono);font-size:11px;background:#fff" placeholder="폴더 절대 경로 또는 deliverables/하위폴더 입력">
            <button type="button" class="btn small" id="btnLfsGoPath" style="height:33px;padding:0 11px;font-size:11px">이동</button>
            <button type="button" class="btn small" id="btnLfsCopyPath" style="height:33px;padding:0 10px;font-size:10.5px">📋 경로 복사</button>
            <button type="button" class="btn small" id="btnLfsOpenNativeExp" style="height:33px;padding:0 10px;font-size:10.5px;background:#f8fafc">🪟 OS 탐색기</button>
          </div>

          <!-- 3. 브레드크럼 & 쓰기 권한 배지 -->
          <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;padding:6px 10px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px">
            <div style="display:flex;align-items:center;gap:5px;flex-wrap:wrap;font-size:11px" id="lfsBreadcrumbs"></div>
            <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
              <span id="lfsNativeHintBadge" style="display:none;font-size:9.5px;font-weight:700;padding:2px 7px;border-radius:999px"></span>
              <span id="lfsWritableBadge" style="font-size:9.5px;font-weight:800;padding:2px 8px;border-radius:999px">확인 중...</span>
            </div>
          </div>

          <!-- 4. 하위 폴더 & 파일 목록 -->
          <div id="lfsItemsContainer" style="min-height:210px;max-height:310px;overflow-y:auto;border:1px solid #cbd5e1;border-radius:10px;background:#fff;padding:6px;display:flex;flex-direction:column;gap:4px">
            <div style="padding:26px;text-align:center;color:#94a3b8;font-size:11.5px">폴더 내용을 불러오는 중입니다...</div>
          </div>

          <!-- 5. 파일 미리보기 패널 (클릭 시 표시) -->
          <div id="lfsPreviewBox" style="display:none;border:1px solid #94a3b8;border-radius:9px;background:#0f172a;color:#f8fafc;padding:10px 12px;flex-direction:column;gap:6px">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
              <strong id="lfsPreviewTitle" style="font-size:11px;color:#38bdf8;font-family:var(--font-mono)">📄 파일 미리보기</strong>
              <button type="button" id="btnCloseLfsPreview" style="border:0;background:#334155;color:#fff;border-radius:5px;padding:2px 8px;font-size:10px;cursor:pointer">미리보기 닫기 ✕</button>
            </div>
            <pre id="lfsPreviewContent" style="margin:0;max-height:190px;overflow:auto;font-size:10.5px;line-height:1.45;font-family:var(--font-mono);white-space:pre-wrap;word-break:break-word;color:#e2e8f0"></pre>
          </div>

          <!-- 6. 새 하위 폴더 생성 바 -->
          <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
            <input type="text" id="lfsNewFolderInput" class="triad-goal-input" style="height:31px;flex:1;min-width:200px;font-size:11px;background:#fff" placeholder="현재 폴더 아래에 새로 만들 폴더 이름 입력 (예: team_core_app)">
            <button type="button" class="btn small" id="btnLfsMkdir" style="height:31px;padding:0 12px;font-size:10.5px;background:#f0fdf4;color:#0f6848;border-color:#86efac">➕ 새 하위 폴더 만들기</button>
          </div>

          <div id="lfsFeedback" style="font-size:11px;font-weight:700;min-height:16px;color:#0f6848"></div>
        </div>

        <div class="cli-modal-foot">
          <div>
            <button type="button" class="btn small" id="btnLfsNativeDialog" style="display:none;font-size:10.5px">🪟 Windows 기본 폴더선택창 띄우기</button>
          </div>
          <div style="display:flex;gap:8px;align-items:center">
            <button type="button" class="btn small" id="btnCancelLfsModal">닫기</button>
            <button type="button" class="btn small primary" id="btnConfirmLfsFolder" style="background:#0f6848;border-color:#0f6848;padding:7px 15px">✓ 현재 폴더를 작업 폴더로 지정</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(wrap);

    const close = () => {
      wrap.classList.remove('open');
      const prev = document.getElementById('lfsPreviewBox');
      if (prev) prev.style.display = 'none';
    };
    document.getElementById('btnCloseLfsModal')?.addEventListener('click', close);
    document.getElementById('btnCancelLfsModal')?.addEventListener('click', close);
    wrap.addEventListener('click', (ev) => { if (ev.target === wrap) close(); });

    document.getElementById('btnCloseLfsPreview')?.addEventListener('click', () => {
      const prev = document.getElementById('lfsPreviewBox');
      if (prev) prev.style.display = 'none';
    });

    document.getElementById('btnLfsGoPath')?.addEventListener('click', () => {
      const p = (document.getElementById('lfsPathInput')?.value || '').trim();
      loadLocalFsDirectory(p);
    });
    document.getElementById('lfsPathInput')?.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') {
        ev.preventDefault();
        const p = (document.getElementById('lfsPathInput')?.value || '').trim();
        loadLocalFsDirectory(p);
      }
    });

    document.getElementById('btnLfsCopyPath')?.addEventListener('click', async (ev) => {
      const btn = ev.currentTarget;
      const p = localFsModalState.currentDir || document.getElementById('lfsPathInput')?.value || '';
      if (!p) return;
      try {
        await navigator.clipboard.writeText(p);
        const orig = btn.textContent;
        btn.textContent = '✓ 복사됨!';
        setTimeout(() => { btn.textContent = orig; }, 1600);
      } catch (_) {
        const inp = document.getElementById('lfsPathInput');
        if (inp) { inp.select(); document.execCommand('copy'); }
      }
    });

    document.getElementById('btnLfsOpenNativeExp')?.addEventListener('click', async (ev) => {
      const btn = ev.currentTarget;
      const p = localFsModalState.currentDir || document.getElementById('lfsPathInput')?.value || '';
      const fb = document.getElementById('lfsFeedback');
      btn.disabled = true;
      try {
        const res = await apiFetch('/ops/output-dir', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'open_explorer', target_dir: p })
        });
        const d = await res.json().catch(() => ({}));
        if (fb) {
          if (d.native_window_opened) {
            fb.style.color = '#0f6848';
            fb.textContent = `✓ Windows 파일 탐색기 창을 열었습니다: ${d.opened_dir}`;
          } else {
            fb.style.color = '#b45309';
            fb.textContent = '💡 현재 서버가 백그라운드 데몬 모드로 실행 중이어서 OS 탐색기 창 대신 이 웹 탐색기에서 바로 파일을 확인하실 수 있습니다. ([📋 경로 복사] 활용 가능)';
          }
        }
      } catch (_) { } finally {
        btn.disabled = false;
      }
    });

    document.getElementById('btnLfsMkdir')?.addEventListener('click', async (ev) => {
      const btn = ev.currentTarget;
      const inp = document.getElementById('lfsNewFolderInput');
      const fb = document.getElementById('lfsFeedback');
      const fname = (inp?.value || '').trim();
      if (!fname) {
        if (fb) { fb.style.color = '#dc2626'; fb.textContent = '❌ 새로 만들 하위 폴더 이름을 입력해 주세요.'; }
        return;
      }
      btn.disabled = true;
      try {
        const res = await apiFetch('/ops/fs-browse', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'mkdir', parent_dir: localFsModalState.currentDir, folder_name: fname })
        });
        const d = await res.json().catch(() => ({}));
        if (!res.ok || !d.ok) {
          if (fb) { fb.style.color = '#dc2626'; fb.textContent = `❌ ${d.error || '새 폴더 생성 실패'}`; }
          return;
        }
        if (inp) inp.value = '';
        renderLocalFsListing(d);
        if (fb) { fb.style.color = '#0f6848'; fb.textContent = `✓ ${d.message || '새 폴더가 생성되어 해당 폴더로 이동했습니다.'}`; }
      } catch (_) {
        if (fb) { fb.style.color = '#dc2626'; fb.textContent = '❌ 서버 통신 오류가 발생했습니다.'; }
      } finally {
        btn.disabled = false;
      }
    });

    document.getElementById('btnLfsNativeDialog')?.addEventListener('click', async (ev) => {
      const btn = ev.currentTarget;
      const fb = document.getElementById('lfsFeedback');
      const orig = btn.textContent;
      btn.disabled = true;
      btn.textContent = 'Windows 창 대기 중...';
      if (fb) { fb.style.color = '#0369a1'; fb.textContent = '🪟 Windows 폴더 선택 창을 요청했습니다 (표시되지 않으면 위 목록에서 바로 선택하세요)...'; }
      try {
        const res = await apiFetch('/ops/output-dir', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'browse', pick_only: true, initial_dir: localFsModalState.currentDir })
        });
        const d = await res.json().catch(() => ({}));
        if (res.ok && !d.cancelled && d.selected_dir) {
          await loadLocalFsDirectory(d.selected_dir);
          if (fb) { fb.style.color = '#0f6848'; fb.textContent = `✓ [${d.selected_dir}] 경로를 불러왔습니다. 우측 하단 확정 버튼을 눌러 저장하세요.`; }
        } else if (!res.ok) {
          if (fb) { fb.style.color = '#b45309'; fb.textContent = `💡 ${d.error || '위 웹 폴더 목록에서 원하는 폴더를 클릭해 바로 선택할 수 있습니다.'}`; }
        } else {
          if (fb) fb.textContent = '';
        }
      } catch (_) { } finally {
        btn.disabled = false;
        btn.textContent = orig;
      }
    });

    document.getElementById('btnConfirmLfsFolder')?.addEventListener('click', async (ev) => {
      const btn = ev.currentTarget;
      const fb = document.getElementById('lfsFeedback');
      const chosenDir = (document.getElementById('lfsPathInput')?.value || localFsModalState.currentDir || '').trim();
      if (!chosenDir) {
        if (fb) { fb.style.color = '#dc2626'; fb.textContent = '❌ 지정할 폴더 경로를 선택해 주세요.'; }
        return;
      }

      const orig = btn.textContent;
      btn.disabled = true;
      btn.textContent = '연결 중...';

      if (typeof localFsModalState.onPicked === 'function') {
        try {
          const rRes = await apiFetch('/ops/fs-browse', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'resolve_gdrive_url', path: chosenDir })
          });
          const rData = await rRes.json().catch(() => ({}));
          if (!rRes.ok) {
            if (fb) { fb.style.color = '#dc2626'; fb.textContent = `❌ ${rData.error || '경로 확인 실패'}`; }
            return;
          }
          localFsModalState.onPicked(rData.resolved_path || chosenDir, rData.is_gdrive ? rData.folder : null);
          close();
          return;
        } catch (_) {
          localFsModalState.onPicked(chosenDir, null);
          close();
          return;
        } finally {
          btn.disabled = false;
          btn.textContent = orig;
        }
      }

      try {
        if (localFsModalState.teamId) {
          const res = await apiFetch('/ops/teams', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'set_workspace',
              team_id: localFsModalState.teamId,
              workspace: { output_dir: chosenDir }
            })
          });
          const d = await res.json().catch(() => ({}));
          if (!res.ok || !d.ok) {
            if (fb) { fb.style.color = '#dc2626'; fb.textContent = `❌ ${d.error || '팀 작업 폴더 저장 실패'}`; }
            return;
          }
          if (d.teams_summary) {
            renderTeamsAndWorkspacesDashboard(d.teams_summary, true);
          }
          const savedWs = d.saved_team?.workspace || {};
          const isGdBound = Boolean(savedWs.gdrive_direct_enabled && savedWs.gdrive_folder_url);
          const finalMsg = isGdBound
            ? `☁️ 작업 폴더가 Google Drive 웹 주소(${savedWs.gdrive_folder_url})로 연결되었습니다!`
            : `✓ 작업 폴더가 [${chosenDir}]로 변경되었습니다!`;
          syncSettingsBarFromTeam(localFsModalState.teamId, finalMsg);
          showTeamCardFlashMessage(localFsModalState.teamId, finalMsg);
          close();
          return;
        }

        const res = await apiFetch('/ops/output-dir', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'set', output_dir: chosenDir })
        });
        const d = await res.json().catch(() => ({}));
        if (!res.ok) {
          if (fb) { fb.style.color = '#dc2626'; fb.textContent = `❌ ${d.error || '저장 폴더 변경 실패'}`; }
          return;
        }
        const stObj = d.output_dir_status || d.status;
        const isGlobalGd = Boolean(stObj?.gdrive_direct?.configured_enabled && stObj?.is_default);
        const globalShown = isGlobalGd ? stObj.gdrive_direct.folder_url : chosenDir;
        if (stObj) {
          renderOutputDirStatus(
            stObj,
            isGlobalGd
              ? `☁️ 저장 폴더가 Google Drive 웹 주소(${globalShown})로 연결되었습니다.`
              : `✓ 저장 폴더가 [${globalShown}]로 설정되었습니다.`,
            false
          );
        }
        apiFetch('/ops/teams', { cache: 'no-store' })
          .then(r => (r.ok ? r.json() : null))
          .then(ts => { if (ts) renderTeamsAndWorkspacesDashboard(ts, true); })
          .catch(() => { });
        close();
      } catch (_) {
        if (fb) { fb.style.color = '#dc2626'; fb.textContent = '❌ 서버 통신 오류가 발생했습니다.'; }
      } finally {
        btn.disabled = false;
        btn.textContent = orig;
      }
    });
  }

  function renderLocalFsListing(data) {
    if (!data) return;
    localFsModalState.currentDir = data.current_dir || '';
    localFsModalState.isWritable = Boolean(data.is_writable);

    const pathInp = document.getElementById('lfsPathInput');
    if (pathInp) pathInp.value = data.current_dir || '';

    const rootsBar = document.getElementById('lfsRootsBar');
    if (rootsBar && Array.isArray(data.roots)) {
      const cloudPickBtn = `<button type="button" class="btn small" id="btnLfsSwitchToGdriveWeb" style="height:26px;padding:0 10px;font-size:10px;background:#e0f2fe;color:#0369a1;border-color:#7dd3fc;font-weight:800">☁️ Google Drive 웹 폴더 선택·생성</button>`;
      rootsBar.innerHTML = cloudPickBtn + data.roots.map(r => {
        const active = (data.current_dir || '').toLowerCase() === (r.path || '').toLowerCase();
        return `<button type="button" class="btn small btn-lfs-root" data-rpath="${escHtml(r.path)}" style="height:26px;padding:0 9px;font-size:10px;${active ? 'background:#e6f9f1;color:#0f6848;border-color:#6ee7b7;font-weight:800' : ''}">${escHtml(r.label)}</button>`;
      }).join('');
      document.getElementById('btnLfsSwitchToGdriveWeb')?.addEventListener('click', () => {
        const lfsModal = document.getElementById('localFsModalBackdrop');
        lfsModal?.classList.remove('open');
        openGdriveDirectModal(localFsModalState.teamId || null, localFsModalState.teamName || '');
      });
      rootsBar.querySelectorAll('.btn-lfs-root').forEach(b => {
        b.addEventListener('click', () => loadLocalFsDirectory(b.dataset.rpath));
      });
    }

    const bcEl = document.getElementById('lfsBreadcrumbs');
    if (bcEl) {
      const upBtn = data.parent_dir
        ? `<button type="button" class="btn small" id="btnLfsParentDir" data-ppath="${escHtml(data.parent_dir)}" style="height:22px;padding:0 7px;font-size:9.5px;margin-right:4px">⬆️ 상위</button>`
        : '';
      const crumbs = (data.breadcrumbs || []).map((c, idx, arr) =>
        `<button type="button" class="btn-lfs-crumb" data-cpath="${escHtml(c.path)}" style="border:0;background:transparent;padding:1px 3px;cursor:pointer;font-size:10.5px;font-weight:${idx === arr.length - 1 ? '800' : '600'};color:${idx === arr.length - 1 ? '#0f6848' : '#334155'};text-decoration:${idx === arr.length - 1 ? 'none' : 'underline'}">${escHtml(c.name)}</button>${idx < arr.length - 1 ? '<span style="color:#94a3b8">/</span>' : ''}`
      ).join('');
      bcEl.innerHTML = upBtn + crumbs;
      document.getElementById('btnLfsParentDir')?.addEventListener('click', (ev) => {
        loadLocalFsDirectory(ev.currentTarget.dataset.ppath);
      });
      bcEl.querySelectorAll('.btn-lfs-crumb').forEach(b => {
        b.addEventListener('click', () => loadLocalFsDirectory(b.dataset.cpath));
      });
    }

    const wBadge = document.getElementById('lfsWritableBadge');
    localFsModalState.isGdriveMount = Boolean(data.is_gdrive_mount);
    if (wBadge) {
      if (data.is_gdrive_mount) {
        wBadge.style.background = '#e0f2fe';
        wBadge.style.color = '#0369a1';
        wBadge.textContent = '☁️ Google Drive 폴더 · 확정 시 웹 주소(URL)로 자동 연결';
      } else if (data.is_writable) {
        wBadge.style.background = '#dcfce7';
        wBadge.style.color = '#15803d';
        wBadge.textContent = '✓ 쓰기·저장 가능';
      } else {
        wBadge.style.background = '#fef3c7';
        wBadge.style.color = '#b45309';
        wBadge.title = '현재 백그라운드 샌드박스 서버에서는 저장소 외부 쓰기가 제한될 수 있습니다. deliverables 하위 폴더를 권장합니다.';
        wBadge.textContent = '⚠️ 쓰기 제한 (deliverables 하위 권장)';
      }
    }

    const listEl = document.getElementById('lfsItemsContainer');
    if (!listEl) return;
    const folders = Array.isArray(data.folders) ? data.folders : [];
    const files = Array.isArray(data.files) ? data.files : [];

    if (folders.length === 0 && files.length === 0) {
      listEl.innerHTML = `<div style="padding:28px;text-align:center;color:#64748b;font-size:11.5px">이 폴더는 현재 비어 있습니다. 아래에서 <b>➕ 새 하위 폴더 만들기</b>를 실행하거나 우측 하단 버튼으로 이 폴더를 선택할 수 있습니다.</div>`;
      return;
    }

    const folderRows = folders.map(f => `
      <div class="lfs-folder-row" data-fpath="${escHtml(f.path)}" style="display:flex;justify-content:space-between;align-items:center;padding:6px 10px;border-radius:7px;border:1px solid ${f.is_project ? '#bbf7d0' : '#f1f5f9'};background:${f.is_project ? '#f0fdf4' : '#f8fafc'};cursor:pointer;gap:8px">
        <div style="display:flex;align-items:center;gap:7px;min-width:0;flex:1">
          <span style="font-size:13px">${f.is_project ? '📦' : '📁'}</span>
          <strong style="font-size:11.5px;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(f.name)}</strong>
          ${f.is_project ? '<span style="background:#dcfce7;color:#15803d;padding:1px 6px;border-radius:4px;font-size:9px;font-weight:800">AI 생성 프로젝트</span>' : ''}
        </div>
        <div style="display:flex;align-items:center;gap:8px;flex-shrink:0">
          <span style="font-size:9.5px;color:#64748b">${escHtml(f.mtime || '')}</span>
          <span style="font-size:10px;color:#0f6848;font-weight:800">열기 →</span>
        </div>
      </div>
    `).join('');

    const fileRows = files.map(fl => {
      const ico = fl.ext === '.md' ? '📄' : (fl.ext === '.py' ? '🐍' : (['.js', '.ts', '.html', '.css', '.json'].includes(fl.ext) ? '📜' : '📄'));
      const previewable = ['.md', '.py', '.js', '.ts', '.json', '.html', '.css', '.txt', '.csv', '.yaml', '.yml', '.toml', '.bat', '.sh'].includes(fl.ext);
      return `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:5px 10px;border-radius:7px;border:1px solid #f1f5f9;background:#fff;gap:8px">
          <div style="display:flex;align-items:center;gap:7px;min-width:0;flex:1">
            <span style="font-size:12.5px">${ico}</span>
            <span style="font-size:11px;color:#1e293b;font-family:var(--font-mono);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(fl.name)}</span>
          </div>
          <div style="display:flex;align-items:center;gap:6px;flex-shrink:0">
            <span style="font-size:9.5px;color:#94a3b8">${formatByteSize(fl.size)} · ${escHtml(fl.mtime || '')}</span>
            ${previewable ? `<button type="button" class="btn small btn-lfs-preview" data-file="${escHtml(fl.path)}" style="height:22px;padding:0 7px;font-size:9.5px">👁 내용 보기</button>` : ''}
            ${fl.web_url ? `<a href="${escHtml(fl.web_url)}" target="_blank" class="btn small" style="height:22px;padding:0 7px;font-size:9.5px;background:#f0f9ff;color:#0369a1;border-color:#7dd3fc">새 탭 ↗</a>` : ''}
          </div>
        </div>
      `;
    }).join('');

    listEl.innerHTML = folderRows + fileRows;
    listEl.querySelectorAll('.lfs-folder-row').forEach(row => {
      row.addEventListener('click', () => loadLocalFsDirectory(row.dataset.fpath));
    });
    listEl.querySelectorAll('.btn-lfs-preview').forEach(btn => {
      btn.addEventListener('click', async (ev) => {
        ev.stopPropagation();
        const fp = btn.dataset.file;
        const prevBox = document.getElementById('lfsPreviewBox');
        const prevTitle = document.getElementById('lfsPreviewTitle');
        const prevContent = document.getElementById('lfsPreviewContent');
        if (prevBox) prevBox.style.display = 'flex';
        if (prevTitle) prevTitle.textContent = `📄 불러오는 중: ${fp}`;
        if (prevContent) prevContent.textContent = '...';
        try {
          const res = await apiFetch('/ops/fs-browse', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'read_file', file_path: fp })
          });
          const d = await res.json().catch(() => ({}));
          if (!res.ok || !d.ok) {
            if (prevTitle) prevTitle.textContent = '⚠️ 미리보기 실패';
            if (prevContent) prevContent.textContent = d.error || '파일을 읽을 수 없습니다.';
            return;
          }
          if (prevTitle) prevTitle.textContent = `📄 ${d.name} (${formatByteSize(d.size)}${d.truncated ? ' · 앞부분 64KB 표시' : ''})`;
          if (prevContent) prevContent.textContent = d.content || '(빈 파일)';
        } catch (_) {
          if (prevContent) prevContent.textContent = '서버 통신 오류';
        }
      });
    });
  }

  async function loadLocalFsDirectory(targetDir = '') {
    ensureLocalFsModal();
    const fb = document.getElementById('lfsFeedback');
    const prev = document.getElementById('lfsPreviewBox');
    if (prev) prev.style.display = 'none';
    try {
      const qs = targetDir ? `?path=${encodeURIComponent(targetDir)}` : '';
      const res = await apiFetch(`/ops/fs-browse${qs}`, { cache: 'no-store' });
      const d = await res.json().catch(() => ({}));
      if (!res.ok && !d.current_dir) {
        if (fb) { fb.style.color = '#dc2626'; fb.textContent = `❌ ${d.error || '폴더를 불러올 수 없습니다.'}`; }
        return;
      }
      renderLocalFsListing(d);
      if (fb) {
        if (d.error) {
          fb.style.color = '#dc2626';
          fb.textContent = `⚠️ ${d.error}`;
        } else if (d.fallback_notice) {
          fb.style.color = '#b45309';
          fb.textContent = `💡 ${d.fallback_notice}`;
        } else {
          fb.textContent = '';
        }
      }
    } catch (_) {
      if (fb) { fb.style.color = '#dc2626'; fb.textContent = '❌ 서버와 통신할 수 없습니다.'; }
    }
  }

  function openLocalFolderExplorer(targetDir = '', teamName = '', teamId = null) {
    ensureLocalFsModal();
    localFsModalState = {
      mode: 'explore',
      currentDir: targetDir || '',
      teamId: teamId || null,
      teamName: teamName || '',
      onPicked: null,
      isWritable: true
    };
    const modal = document.getElementById('localFsModalBackdrop');
    const titleEl = document.getElementById('lfsModalTitle');
    const subEl = document.getElementById('lfsModalSub');
    const confirmBtn = document.getElementById('btnConfirmLfsFolder');
    const nativeDlgBtn = document.getElementById('btnLfsNativeDialog');
    const nativeBadge = document.getElementById('lfsNativeHintBadge');

    if (titleEl) {
      titleEl.textContent = teamName ? `🗂️ [${teamName}] 작업 폴더 열기 & 파일 탐색` : '🗂️ 작업 폴더 열기 & 파일 탐색';
    }
    if (subEl) {
      subEl.textContent = '생성된 프로젝트 폴더·리포트·소스 파일을 클릭해 바로 열람하거나 하위 폴더를 관리할 수 있습니다.';
    }
    if (confirmBtn) {
      confirmBtn.style.display = teamId ? 'inline-flex' : 'none';
      confirmBtn.textContent = teamName ? `📂 현재 폴더를 [${teamName}] 작업 폴더로 변경` : '✓ 현재 폴더로 지정';
    }
    if (nativeDlgBtn) nativeDlgBtn.style.display = 'none';
    if (nativeBadge) nativeBadge.style.display = 'none';

    modal?.classList.add('open');
    loadLocalFsDirectory(targetDir);

    // 동시에 OS 파일 탐색기 열기도 백그라운드 시도 후 상태 배지 안내
    apiFetch('/ops/output-dir', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'open_explorer', target_dir: targetDir })
    })
      .then(r => r.json().catch(() => ({})))
      .then(d => {
        if (!nativeBadge) return;
        nativeBadge.style.display = 'inline-flex';
        if (d.native_window_opened) {
          nativeBadge.style.background = '#dcfce7';
          nativeBadge.style.color = '#15803d';
          nativeBadge.textContent = '🪟 Windows 탐색기 함께 열림';
        } else {
          nativeBadge.style.background = '#e0f2fe';
          nativeBadge.style.color = '#0369a1';
          nativeBadge.textContent = '💻 웹 내장 폴더 탐색기 활성';
        }
      })
      .catch(() => { });
  }

  function openLocalFolderPicker({ initialDir = '', teamId = null, teamName = '', onPicked = null } = {}) {
    ensureLocalFsModal();
    localFsModalState = {
      mode: 'pick',
      currentDir: initialDir || '',
      teamId: teamId || null,
      teamName: teamName || '',
      onPicked: typeof onPicked === 'function' ? onPicked : null,
      isWritable: true
    };
    const modal = document.getElementById('localFsModalBackdrop');
    const titleEl = document.getElementById('lfsModalTitle');
    const subEl = document.getElementById('lfsModalSub');
    const confirmBtn = document.getElementById('btnConfirmLfsFolder');
    const nativeDlgBtn = document.getElementById('btnLfsNativeDialog');
    const nativeBadge = document.getElementById('lfsNativeHintBadge');

    if (titleEl) {
      titleEl.textContent = teamName ? `📂 [${teamName}] 작업 폴더 변경 · 위치 선택` : '📂 작업 폴더 위치 선택';
    }
    if (subEl) {
      subEl.textContent = '원하는 드라이브·폴더로 이동하거나 새 하위 폴더를 만든 뒤 우측 하단 확정 버튼을 클릭하세요.';
    }
    if (confirmBtn) {
      confirmBtn.style.display = 'inline-flex';
      confirmBtn.textContent = teamName ? `✓ 이 폴더를 [${teamName}] 작업 폴더로 확정` : '✓ 이 폴더로 선택 확정';
    }
    if (nativeDlgBtn) nativeDlgBtn.style.display = 'inline-flex';
    if (nativeBadge) nativeBadge.style.display = 'none';

    modal?.classList.add('open');
    loadLocalFsDirectory(initialDir);
  }

  window.openLocalFolderExplorer = openLocalFolderExplorer;
  window.openLocalFolderPicker = openLocalFolderPicker;

  // ========================================================================
  // [신규] Google Drive 직접 연결 (OAuth 2.0 + 실시간 클라우드 폴더 탐색기 모달)
  // ========================================================================
  let gdriveBreadcrumbs = [{ id: 'root', name: '내 드라이브 (루트)' }];
  let gdriveCurrentBrowseId = 'root';
  let gdriveCurrentBrowseMeta = { id: 'root', name: '내 드라이브 (루트)', webViewLink: 'https://drive.google.com/drive/my-drive' };
  let gdriveTargetTeamId = null;
  let gdriveTargetTeamName = '';

  function syncPickedCloudFolderToOpenTeamModal(folderObj, teamsSummary) {
    if (teamsSummary) {
      renderTeamsAndWorkspacesDashboard(teamsSummary, true);
    }
    if (!folderObj) return;
    if (gdriveTargetTeamId) {
      showTeamCardFlashMessage(
        gdriveTargetTeamId,
        `☁️ Google Drive 웹 폴더(${folderObj.webViewLink || folderObj.name})가 [${gdriveTargetTeamName || '팀'}] 작업 폴더로 지정되었습니다!`
      );
    }
    const tbModal = document.getElementById('teamBuilderModalBackdrop');
    if (tbModal && tbModal.classList.contains('open')) {
      const gdChk = document.getElementById('tbGdEnabledChk');
      const gdInp = document.getElementById('tbGdFolderInput');
      const gdBadge = document.getElementById('tbGdFolderNameBadge');
      const locInp = document.getElementById('tbLocalDirInput');
      if (gdChk) gdChk.checked = true;
      if (gdInp) gdInp.value = folderObj.id === 'root' ? '' : (folderObj.webViewLink || folderObj.id || '');
      if (gdBadge) gdBadge.textContent = `현재: ${folderObj.name || '내 드라이브 (루트)'}`;
      if (locInp && !(locInp.value || '').trim()) {
        locInp.value = '';
      }
    }
  }

  function ensureGdriveDirectModal() {
    if (document.getElementById('gdriveDirectModalBackdrop')) return;
    const modalWrap = document.createElement('div');
    modalWrap.id = 'gdriveDirectModalBackdrop';
    modalWrap.className = 'cli-modal-backdrop';
    modalWrap.style.zIndex = '1150';
    modalWrap.innerHTML = `
      <div class="cli-modal" role="dialog" aria-modal="true" aria-label="Google Drive 직접 연결 및 클라우드 폴더 지정" style="max-width:680px;width:95%">
        <div class="cli-modal-head" style="display:flex;justify-content:space-between;align-items:center;gap:12px;border-bottom:1px solid #e2e8f0;padding-bottom:12px">
          <div>
            <div class="eyebrow" style="color:#0284c7">GOOGLE DRIVE REST API V3 DIRECT INTEGRATION</div>
            <div class="panel-title" style="font-size:16px;margin-top:2px">☁️ Google Drive 직접 연결 &amp; 클라우드 저장 폴더 지정</div>
          </div>
          <button type="button" class="btn small" id="btnCloseGdriveModalTop">✕ 닫기</button>
        </div>

        <div style="display:flex;flex-direction:column;gap:13px;padding-top:12px;max-height:76vh;overflow-y:auto">
          <!-- 1. 연결 상태 & 원클릭 OAuth 인증 -->
          <div style="padding:12px 14px;border-radius:11px;background:#f0f9ff;border:1px solid #bae6fd;display:flex;flex-direction:column;gap:9px">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">
              <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                <span id="gdModalStatusPill" style="background:#e2e8f0;color:#334155;padding:4px 10px;border-radius:999px;font-size:11px;font-weight:800">확인 중...</span>
                <strong id="gdModalAccountLabel" style="font-size:12px;color:#0f172a">Google 계정을 연결해 주세요</strong>
              </div>
              <div style="display:flex;gap:6px;flex-wrap:wrap">
                <button type="button" class="btn small" id="btnGdRefreshStatus" style="height:30px;padding:0 10px;font-size:11px">🔄 연결 상태 새로고침</button>
                <button type="button" class="btn small" id="btnGdDisconnect" style="display:none;height:30px;padding:0 10px;font-size:11px;color:#dc2626">연결 해제</button>
              </div>
            </div>

            <div id="gdModalAuthHint" style="font-size:11px;color:#0c4a6e;line-height:1.5">
              별도 API 키나 복잡한 설정 없이 아래 <b>[🔑 구글 계정 원클릭 브라우저 로그인]</b> 버튼을 누르고 Google Drive 권한을 허용(Allow)하면 즉시 직접 연결됩니다.
            </div>

            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
              <button type="button" class="btn small primary" id="btnGdGcloudLogin" style="height:34px;padding:0 14px;background:#0284c7;border-color:#0284c7;font-size:11.5px">🔑 구글 계정 원클릭 브라우저 로그인 (권장)</button>
              <label style="display:inline-flex;align-items:center;gap:6px;font-size:11px;color:#0f172a;font-weight:700;cursor:pointer;margin-left:auto">
                <input type="checkbox" id="chkGdModalAutoSync" style="accent-color:#0284c7">
                <span>미션 완료 시 Google Drive 자동 업로드 활성화</span>
              </label>
            </div>

            <details style="font-size:11px;color:#475569;margin-top:2px">
              <summary style="cursor:pointer;font-weight:700;color:#0369a1">⚙️ 고급: Google Cloud SDK가 없는 PC용 OAuth client_secret.json 직접 등록</summary>
              <div style="margin-top:8px;padding:10px;background:#ffffff;border:1px solid #cbd5e1;border-radius:8px;display:flex;flex-direction:column;gap:7px">
                <div style="font-size:10.5px;color:#64748b">Google Cloud Console의 OAuth 2.0 클라이언트 JSON(리디렉션 URI: <code>http://127.0.0.1:8080/ops/gdrive/oauth/callback</code>)을 붙여넣거나 파일을 선택하세요.</div>
                <textarea id="gdOauthJsonInput" rows="3" style="width:100%;font-family:monospace;font-size:10.5px;padding:6px 8px;border:1px solid #cbd5e1;border-radius:6px" placeholder='{"installed":{"client_id":"...","client_secret":"..."}}'></textarea>
                <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
                  <input type="file" id="gdOauthJsonFile" accept=".json,application/json" style="font-size:10.5px">
                  <button type="button" class="btn small primary" id="btnGdSaveOauthAndStart" style="height:30px;padding:0 12px">🌐 JSON 저장 &amp; OAuth 로그인 창 열기</button>
                </div>
              </div>
            </details>
          </div>

          <!-- 2. 현재 지정된 클라우드 폴더 & 웹 URL 직접 입력 -->
          <div style="padding:12px 14px;border-radius:11px;background:#ffffff;border:1px solid #cbd5e1;display:flex;flex-direction:column;gap:9px">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">
              <div style="font-size:11.5px;color:#1e293b">
                🎯 지정된 클라우드 저장 폴더: <strong id="gdModalTargetFolderName" style="color:#0284c7">내 드라이브 (루트)</strong>
                <code id="gdModalTargetFolderId" style="font-size:10px;color:#64748b;margin-left:4px">(root)</code>
              </div>
              <div style="display:flex;gap:6px;flex-wrap:wrap">
                <button type="button" class="btn small" id="btnGdTestUpload" style="height:28px;padding:0 10px;font-size:10.5px;background:#ecfdf5;color:#0f6848;border-color:#a7f3d0">🧪 테스트 파일 업로드</button>
                <a id="gdModalTargetWebLink" href="https://drive.google.com/drive/my-drive" target="_blank" class="btn small" style="height:28px;padding:0 10px;font-size:10.5px">웹 드라이브 열기 ↗</a>
              </div>
            </div>

            <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
              <input type="text" id="gdFolderUrlInput" class="triad-goal-input" style="height:32px;font-size:11px;flex:1;min-width:220px" placeholder="Google Drive 폴더 웹 링크(https://drive.google.com/drive/folders/...) 또는 폴더 ID 입력">
              <button type="button" class="btn small primary" id="btnGdApplyFolderUrl" style="height:32px;padding:0 12px;white-space:nowrap">🔗 링크로 폴더 지정</button>
            </div>
          </div>

          <!-- 3. 실시간 Google Drive 클라우드 폴더 탐색기 & 새 폴더 생성 -->
          <div style="padding:12px 14px;border-radius:11px;background:#f8fafc;border:1px solid #cbd5e1;display:flex;flex-direction:column;gap:9px">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">
              <strong style="font-size:12px;color:#0f172a">📂 내 Google Drive 클라우드 폴더 실시간 탐색</strong>
              <button type="button" class="btn small primary" id="btnGdSelectCurrentBrowseFolder" style="height:28px;padding:0 11px;font-size:11px;background:#0f6848;border-color:#0f6848">✓ 현재 보고 있는 폴더로 저장 위치 확정</button>
            </div>

            <div id="gdBreadcrumbBar" style="display:flex;gap:4px;align-items:center;flex-wrap:wrap;font-size:11px;color:#334155;padding:5px 8px;background:#fff;border:1px solid #e2e8f0;border-radius:7px"></div>

            <div id="gdFolderListContainer" style="min-height:120px;max-height:210px;overflow-y:auto;background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:6px;display:flex;flex-direction:column;gap:4px">
              <div style="padding:22px;text-align:center;color:#94a3b8;font-size:11.5px">Google Drive에 로그인하면 클라우드 폴더 목록이 여기에 실시간으로 표시됩니다.</div>
            </div>

            <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
              <input type="text" id="gdNewFolderNameInput" class="triad-goal-input" style="height:30px;font-size:11px;flex:1;min-width:180px;background:#fff" placeholder="현재 위치에 새로 만들 폴더 이름 (예: AI_Virtual_Office_Projects)">
              <button type="button" class="btn small" id="btnGdCreateNewFolder" style="height:30px;padding:0 11px;font-size:11px;white-space:nowrap">➕ 새 클라우드 폴더 생성</button>
            </div>
          </div>

          <div id="gdModalFeedbackBar" style="font-size:11px;color:#475569;min-height:18px"></div>
        </div>
      </div>
    `;
    document.body.appendChild(modalWrap);

    const closeFn = () => modalWrap.classList.remove('open');
    document.getElementById('btnCloseGdriveModalTop')?.addEventListener('click', closeFn);
    modalWrap.addEventListener('click', (e) => { if (e.target === modalWrap) closeFn(); });

    const setModalFeedback = (msg, isErr = false) => {
      const fb = document.getElementById('gdModalFeedbackBar');
      if (fb) {
        fb.style.color = isErr ? '#dc2626' : '#0f6848';
        fb.innerHTML = msg;
      }
    };

    document.getElementById('btnGdRefreshStatus')?.addEventListener('click', () => refreshGdriveModalState(true));

    document.getElementById('btnGdGcloudLogin')?.addEventListener('click', async (ev) => {
      const btn = ev.currentTarget;
      btn.disabled = true;
      setModalFeedback('🔑 새 터미널과 웹 브라우저에서 Google Drive 권한 승인 창을 여는 중입니다...', false);
      try {
        const res = await apiFetch('/ops/gdrive/connect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'gcloud_login' })
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          setModalFeedback(`✓ ${data.message || '브라우저에서 권한을 허용한 뒤 [🔄 연결 상태 새로고침]을 눌러주세요.'}`, false);
          if (data.output_dir_status) renderOutputDirStatus(data.output_dir_status);
        } else {
          setModalFeedback(`❌ ${data.error || '로그인 창 실행 실패'}`, true);
        }
      } catch (_) {
        setModalFeedback('❌ 서버 통신 오류가 발생했습니다.', true);
      } finally {
        btn.disabled = false;
      }
    });

    document.getElementById('gdOauthJsonFile')?.addEventListener('change', (ev) => {
      const f = ev.target.files?.[0];
      if (!f) return;
      const reader = new FileReader();
      reader.onload = () => {
        const ta = document.getElementById('gdOauthJsonInput');
        if (ta) ta.value = String(reader.result || '');
      };
      reader.readAsText(f, 'utf-8');
    });

    document.getElementById('btnGdSaveOauthAndStart')?.addEventListener('click', async (ev) => {
      const btn = ev.currentTarget;
      const rawJson = (document.getElementById('gdOauthJsonInput')?.value || '').trim();
      if (!rawJson) {
        setModalFeedback('❌ client_secret.json 내용을 붙여넣거나 파일을 선택해 주세요.', true);
        return;
      }
      btn.disabled = true;
      try {
        const res = await apiFetch('/ops/gdrive/connect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'save_oauth_client', client_secret_json: rawJson })
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.oauth_start_url) {
          setModalFeedback('✓ OAuth 클라이언트 저장 완료! 새 창에서 Google 로그인을 진행해 주세요.', false);
          window.open(data.oauth_start_url, '_blank', 'width=540,height=680');
        } else {
          setModalFeedback(`❌ ${data.error || 'OAuth 설정 저장 실패'}`, true);
        }
      } catch (_) {
        setModalFeedback('❌ 서버 통신 오류가 발생했습니다.', true);
      } finally {
        btn.disabled = false;
      }
    });

    document.getElementById('btnGdDisconnect')?.addEventListener('click', async () => {
      try {
        const res = await apiFetch('/ops/gdrive/connect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'disconnect' })
        });
        const data = await res.json().catch(() => ({}));
        if (data.output_dir_status) renderOutputDirStatus(data.output_dir_status);
        await refreshGdriveModalState(true);
        setModalFeedback('✓ 연결이 해제되었습니다.', false);
      } catch (_) { }
    });

    document.getElementById('chkGdModalAutoSync')?.addEventListener('change', async (ev) => {
      const en = Boolean(ev.target.checked);
      try {
        const res = await apiFetch('/ops/gdrive/connect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'toggle_sync', enabled: en })
        });
        const data = await res.json().catch(() => ({}));
        if (data.output_dir_status) renderOutputDirStatus(data.output_dir_status);
        setModalFeedback(`✓ ${data.message || '동기화 설정이 변경되었습니다.'}`, false);
      } catch (_) { }
    });

    document.getElementById('btnGdApplyFolderUrl')?.addEventListener('click', async (ev) => {
      const val = (document.getElementById('gdFolderUrlInput')?.value || '').trim();
      if (!val) {
        setModalFeedback('❌ Google Drive 폴더 링크 또는 ID를 입력해 주세요.', true);
        return;
      }
      const btn = ev.currentTarget;
      btn.disabled = true;
      try {
        const res = await apiFetch('/ops/gdrive/connect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'set_folder', folder_url: val, team_id: gdriveTargetTeamId || undefined })
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.folder) {
          if (data.output_dir_status) renderOutputDirStatus(data.output_dir_status);
          syncPickedCloudFolderToOpenTeamModal(data.folder, data.teams_summary);
          gdriveBreadcrumbs = [{ id: 'root', name: '내 드라이브 (루트)' }];
          if (data.folder.id !== 'root') gdriveBreadcrumbs.push({ id: data.folder.id, name: data.folder.name });
          await loadGdriveSubfolders(data.folder.id);
          await refreshGdriveModalState(false);
          setModalFeedback(`✓ Google Drive 웹 폴더(${data.folder.webViewLink || data.folder.name})로 저장 위치가 지정되었습니다!`, false);
        } else {
          setModalFeedback(`❌ ${data.error || '폴더 확인 실패'}`, true);
        }
      } catch (_) {
        setModalFeedback('❌ 서버 통신 오류가 발생했습니다.', true);
      } finally {
        btn.disabled = false;
      }
    });

    document.getElementById('btnGdSelectCurrentBrowseFolder')?.addEventListener('click', async (ev) => {
      const btn = ev.currentTarget;
      btn.disabled = true;
      try {
        const res = await apiFetch('/ops/gdrive/connect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'set_folder', folder_id: gdriveCurrentBrowseId || 'root', team_id: gdriveTargetTeamId || undefined })
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.folder) {
          if (data.output_dir_status) renderOutputDirStatus(data.output_dir_status);
          syncPickedCloudFolderToOpenTeamModal(data.folder, data.teams_summary);
          await refreshGdriveModalState(false);
          setModalFeedback(`☁️ Google Drive 웹 폴더(${data.folder.webViewLink || data.folder.name})가 저장 위치로 확정되었습니다!`, false);
        } else {
          setModalFeedback(`❌ ${data.error || '폴더 지정 실패'}`, true);
        }
      } catch (_) { } finally {
        btn.disabled = false;
      }
    });

    document.getElementById('btnGdCreateNewFolder')?.addEventListener('click', async (ev) => {
      const inp = document.getElementById('gdNewFolderNameInput');
      const nameVal = (inp?.value || '').trim();
      if (!nameVal) {
        setModalFeedback('❌ 새로 만들 폴더 이름을 입력해 주세요.', true);
        return;
      }
      const btn = ev.currentTarget;
      btn.disabled = true;
      try {
        const res = await apiFetch('/ops/gdrive/connect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'create_folder', parent_id: gdriveCurrentBrowseId || 'root', name: nameVal })
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.folder) {
          if (inp) inp.value = '';
          gdriveBreadcrumbs.push({ id: data.folder.id, name: data.folder.name });
          await loadGdriveSubfolders(data.folder.id);
          // Also auto-select the newly created folder for convenience!
          const setRes = await apiFetch('/ops/gdrive/connect', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'set_folder', folder_id: data.folder.id, team_id: gdriveTargetTeamId || undefined })
          });
          const setData = await setRes.json().catch(() => ({}));
          if (setData.output_dir_status) renderOutputDirStatus(setData.output_dir_status);
          syncPickedCloudFolderToOpenTeamModal(setData.folder || data.folder, setData.teams_summary);
          await refreshGdriveModalState(false);
          const shownUrl = (setData.folder && setData.folder.webViewLink) || data.folder.webViewLink || data.folder.name;
          setModalFeedback(`☁️ 새 Google Drive 폴더(${shownUrl}) 생성 및 저장 위치 지정 완료!`, false);
        } else {
          setModalFeedback(`❌ ${data.error || '폴더 생성 실패'}`, true);
        }
      } catch (_) { } finally {
        btn.disabled = false;
      }
    });

    document.getElementById('btnGdTestUpload')?.addEventListener('click', async (ev) => {
      const btn = ev.currentTarget;
      const orig = btn.textContent;
      btn.disabled = true;
      btn.textContent = '업로드 중...';
      try {
        const res = await apiFetch('/ops/gdrive/connect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'test_upload' })
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.uploaded) {
          setModalFeedback(`✅ ${data.message} — <a href="${data.uploaded.webViewLink}" target="_blank" style="color:#0284c7;font-weight:800;text-decoration:underline">구글 드라이브에서 업로드된 파일 열기 ↗</a>`, false);
        } else {
          setModalFeedback(`❌ ${data.error || '테스트 업로드 실패'}`, true);
        }
      } catch (_) {
        setModalFeedback('❌ 서버 통신 오류가 발생했습니다.', true);
      } finally {
        btn.disabled = false;
        btn.textContent = orig;
      }
    });
  }

  async function loadGdriveSubfolders(folderId = 'root') {
    const listEl = document.getElementById('gdFolderListContainer');
    const crumbEl = document.getElementById('gdBreadcrumbBar');
    gdriveCurrentBrowseId = folderId || 'root';

    if (crumbEl) {
      crumbEl.innerHTML = gdriveBreadcrumbs.map((b, idx) => {
        const isLast = idx === gdriveBreadcrumbs.length - 1;
        return `<button type="button" data-crumb-idx="${idx}" style="border:0;background:${isLast ? '#e0f2fe' : 'transparent'};color:${isLast ? '#0369a1' : '#475569'};font-weight:${isLast ? '800' : '600'};padding:2px 6px;border-radius:5px;cursor:pointer;font-size:11px">${idx === 0 ? '☁️ ' : ''}${b.name.replace(/</g, '&lt;')}</button>${!isLast ? '<span style="color:#cbd5e1">/</span>' : ''}`;
      }).join('');
      crumbEl.querySelectorAll('[data-crumb-idx]').forEach(btn => {
        btn.addEventListener('click', () => {
          const i = Number(btn.dataset.crumbIdx);
          const target = gdriveBreadcrumbs[i];
          if (!target) return;
          gdriveBreadcrumbs = gdriveBreadcrumbs.slice(0, i + 1);
          loadGdriveSubfolders(target.id);
        });
      });
    }

    if (listEl) {
      listEl.innerHTML = `<div style="padding:18px;text-align:center;color:#64748b;font-size:11px">☁️ Google Drive에서 하위 폴더 목록을 불러오는 중...</div>`;
    }
    try {
      const res = await apiFetch(`/ops/gdrive/folders?parent_id=${encodeURIComponent(gdriveCurrentBrowseId)}`, { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        if (listEl) {
          listEl.innerHTML = `<div style="padding:18px;text-align:center;color:#94a3b8;font-size:11px">${(data.error || '먼저 Google Drive 로그인을 완료해 주세요.').replace(/</g, '&lt;')}</div>`;
        }
        return;
      }
      gdriveCurrentBrowseMeta = data.parent || { id: gdriveCurrentBrowseId, name: gdriveCurrentBrowseId };
      const folders = Array.isArray(data.folders) ? data.folders : [];
      if (!listEl) return;
      if (folders.length === 0) {
        listEl.innerHTML = `<div style="padding:18px;text-align:center;color:#64748b;font-size:11px">이 폴더 안에는 하위 폴더가 없습니다. 우측 상단 <b>[✓ 현재 보고 있는 폴더로 저장 위치 확정]</b>을 누르거나 아래에서 새 폴더를 만드세요.</div>`;
        return;
      }
      listEl.innerHTML = folders.map(f => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 9px;border-radius:7px;border:1px solid #f1f5f9;background:#f8fafc;gap:8px">
          <button type="button" class="gd-enter-folder-btn" data-fid="${f.id}" data-fname="${f.name.replace(/"/g, '&quot;')}" style="border:0;background:transparent;text-align:left;cursor:pointer;font-size:11.5px;font-weight:700;color:#1e293b;flex:1">📁 ${f.name.replace(/</g, '&lt;')}</button>
          <button type="button" class="btn small gd-pick-folder-btn" data-fid="${f.id}" style="height:24px;padding:0 9px;font-size:10px;background:#e0f2fe;color:#0369a1;border-color:#7dd3fc">이 폴더 선택</button>
        </div>
      `).join('');

      listEl.querySelectorAll('.gd-enter-folder-btn').forEach(b => {
        b.addEventListener('click', () => {
          gdriveBreadcrumbs.push({ id: b.dataset.fid, name: b.dataset.fname });
          loadGdriveSubfolders(b.dataset.fid);
        });
      });
      listEl.querySelectorAll('.gd-pick-folder-btn').forEach(b => {
        b.addEventListener('click', async () => {
          b.disabled = true;
          try {
            const r = await apiFetch('/ops/gdrive/connect', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'set_folder', folder_id: b.dataset.fid, team_id: gdriveTargetTeamId || undefined })
            });
            const d = await r.json().catch(() => ({}));
            if (r.ok && d.folder) {
              if (d.output_dir_status) renderOutputDirStatus(d.output_dir_status);
              syncPickedCloudFolderToOpenTeamModal(d.folder, d.teams_summary);
              await refreshGdriveModalState(false);
              const fb = document.getElementById('gdModalFeedbackBar');
              if (fb) {
                fb.style.color = '#0f6848';
                fb.textContent = `☁️ Google Drive 웹 폴더(${d.folder.webViewLink || d.folder.name})가 저장 위치로 지정되었습니다!`;
              }
            }
          } catch (_) { } finally {
            b.disabled = false;
          }
        });
      });
    } catch (_) { }
  }

  async function refreshGdriveModalState(forceRefresh = false) {
    try {
      const res = await apiFetch(`/ops/gdrive/status${forceRefresh ? '?refresh=1' : ''}`, { cache: 'no-store' });
      if (!res.ok) return;
      const st = await res.json();
      renderOutputDirStatus(st);
      const gd = st.gdrive_direct || {};

      const pill = document.getElementById('gdModalStatusPill');
      const accLbl = document.getElementById('gdModalAccountLabel');
      const hint = document.getElementById('gdModalAuthHint');
      const btnDisc = document.getElementById('btnGdDisconnect');
      const chkAuto = document.getElementById('chkGdModalAutoSync');
      const tName = document.getElementById('gdModalTargetFolderName');
      const tId = document.getElementById('gdModalTargetFolderId');
      const tLink = document.getElementById('gdModalTargetWebLink');

      if (pill) {
        pill.style.background = gd.connected ? '#dcfce7' : '#fee2e2';
        pill.style.color = gd.connected ? '#15803d' : '#b91c1c';
        pill.textContent = gd.connected ? '✓ Google Drive API 연결됨' : '미연결 (권한 승인 필요)';
      }
      if (accLbl) {
        accLbl.textContent = gd.connected
          ? `${gd.account_email || 'Google 계정'}${gd.display_name ? ` (${gd.display_name})` : ''}`
          : (gd.gcloud_pending_email ? `감지된 계정: ${gd.gcloud_pending_email} (드라이브 권한 승인 대기)` : '연결된 Google 계정 없음');
      }
      if (hint && gd.connected) {
        hint.innerHTML = `✅ Google Drive REST API v3와 직접 연결되었습니다! 아래에서 저장할 클라우드 폴더를 선택하거나 새 폴더를 만드세요.`;
      }
      if (btnDisc) btnDisc.style.display = (gd.connected && gd.auth_mode === 'oauth_client') ? 'inline-flex' : 'none';
      if (chkAuto) chkAuto.checked = Boolean(gd.configured_enabled || gd.enabled);
      if (tName) tName.textContent = gd.folder_name || '내 드라이브 (루트)';
      if (tId) tId.textContent = `(${gd.folder_id || 'root'})`;
      if (tLink && gd.folder_url) tLink.href = gd.folder_url;

      if (gd.connected) {
        await loadGdriveSubfolders(gdriveCurrentBrowseId || 'root');
      }
    } catch (_) { }
  }

  function openGdriveDirectModal(teamId = null, teamName = '') {
    gdriveTargetTeamId = teamId || null;
    gdriveTargetTeamName = teamName || '';
    ensureGdriveDirectModal();
    const modal = document.getElementById('gdriveDirectModalBackdrop');
    const titleNode = modal?.querySelector('.panel-title');
    if (titleNode) {
      titleNode.textContent = teamName
        ? `☁️ [${teamName}] Google Drive 웹 클라우드 폴더 지정`
        : '☁️ Google Drive 직접 연결 & 클라우드 저장 폴더 지정';
    }
    modal?.classList.add('open');
    refreshGdriveModalState(true);
  }

  // ========================================================================
  // [신규] 🏢 팀 구성 · 팀별 작업 폴더 지정 · 연결된 작업 폴더 전체 대시보드
  // ========================================================================
  function escHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function syncSettingsBarFromTeam(teamId, customFeedback = null) {
    if (!latestTeamsSummary || !Array.isArray(latestTeamsSummary.teams)) return;
    const team = latestTeamsSummary.teams.find(t => t.id === teamId) || latestTeamsSummary.teams[0];
    if (!team) return;

    const metaTxt = document.getElementById('triadTeamMetaText');
    if (metaTxt) {
      const r = team.roles || {};
      metaTxt.innerHTML = `오피스 <b>${escHtml(team.floor)}</b> · 팀원 <b>${(team.member_ids || []).length}명</b> · HEAD=<b>${escHtml(CLI_SHORT[r.head] || r.head)}</b> / BUILDER=<b>${escHtml(CLI_SHORT[r.builder] || r.builder)}</b> / REVIEWER=<b>${escHtml(CLI_SHORT[r.reviewer] || r.reviewer)}</b>`;
    }

    const ws = team.workspace_status || {};
    const gd = ws.gdrive_direct || {};
    const isCloudPrimary = Boolean(ws.is_cloud_primary && gd.folder_url);
    const badgeEl = document.getElementById('outputDirModeBadge');
    const activeTxtEl = document.getElementById('outputDirActiveText');
    const inputEl = document.getElementById('outputDirInput');
    const chkMirrorEl = document.getElementById('chkMirrorLocalDeliverables');
    const fbEl = document.getElementById('outputDirFeedbackText');

    if (badgeEl) {
      badgeEl.style.background = (isCloudPrimary || ws.is_google_drive_local) ? '#e0f2fe' : '#dcfce7';
      badgeEl.style.color = (isCloudPrimary || ws.is_google_drive_local) ? '#0369a1' : '#15803d';
      badgeEl.textContent = isCloudPrimary
        ? `☁️ [${team.name}] Google Drive 웹 폴더`
        : `${ws.is_google_drive_local ? '☁️' : '🏢'} [${team.name}] 전용 작업 폴더`;
    }
    if (activeTxtEl) {
      if (isCloudPrimary) {
        activeTxtEl.innerHTML = `<a href="${escHtml(gd.folder_url)}" target="_blank" rel="noopener" style="color:#0284c7;text-decoration:underline">${escHtml(gd.folder_url)}</a>`;
      } else {
        activeTxtEl.textContent = ws.effective_dir || 'deliverables/';
      }
    }
    if (inputEl && document.activeElement !== inputEl && !inputEl.dataset.dirty) {
      inputEl.value = isCloudPrimary ? gd.folder_url : (ws.configured_dir || '');
    }
    if (chkMirrorEl) {
      chkMirrorEl.checked = Boolean(ws.mirror_to_local);
    }

    const gdBadge = document.getElementById('gdriveDirectBadge');
    const gdSum = document.getElementById('gdriveDirectSummaryText');
    const gdWebBtn = document.getElementById('gdriveDirectOpenWebBtn');
    if (gdBadge) {
      if (gd.connected && gd.configured_enabled) {
        gdBadge.style.background = '#dcfce7';
        gdBadge.style.color = '#15803d';
        gdBadge.textContent = `☁️ [${team.name}] 클라우드 자동 업로드 ON`;
      } else if (gd.connected) {
        gdBadge.style.background = '#e0f2fe';
        gdBadge.style.color = '#0369a1';
        gdBadge.textContent = `☁️ Google Drive 연결됨 (팀 자동업로드 OFF)`;
      }
    }
    if (gdSum && gd.connected && gd.configured_enabled) {
      gdSum.innerHTML = `팀 전용 클라우드 폴더: <b>📁 ${escHtml(gd.folder_name)}</b> — 이 팀의 미션 완료 시 자동 업로드됩니다.`;
    }
    if (gdWebBtn && gd.folder_url && gd.connected) {
      gdWebBtn.style.display = 'inline-flex';
      gdWebBtn.href = gd.folder_url;
    }

    if (fbEl && customFeedback) {
      fbEl.style.color = '#0f6848';
      fbEl.textContent = customFeedback;
    } else if (fbEl) {
      fbEl.style.color = '#475569';
      const dispLoc = isCloudPrimary ? gd.folder_url : (ws.effective_dir || 'deliverables/');
      fbEl.textContent = `💡 현재 선택된 [${team.name}] 팀의 작업 폴더(${dispLoc})에 결과물이 저장됩니다.${(!isCloudPrimary && ws.has_non_ascii_or_space) ? ' (한글/공백 포함: Flutter/RN 앱 빌드시 영문 경로 권장)' : ''}`;
    }
  }

  function renderTeamsAndWorkspacesDashboard(ts, forceRender = false) {
    if (!ts || !Array.isArray(ts.teams)) return;
    latestTeamsSummary = ts;
    window.NEXUS_TEAMS_SUMMARY = ts;

    const teams = ts.teams;
    const connected = Array.isArray(ts.connected_workspaces) ? ts.connected_workspaces : [];
    const unboundGdrives = Array.isArray(ts.available_mounted_gdrives) ? ts.available_mounted_gdrives : [];
    const gdGlobal = ts.gdrive_direct_status || {};

    const cTeamsBadge = document.getElementById('dashTeamsCountBadge');
    const cWsBadge = document.getElementById('dashWorkspacesCountBadge');
    if (cTeamsBadge) cTeamsBadge.textContent = `등록 팀 ${teams.length}개`;
    if (cWsBadge) cWsBadge.textContent = `연결된 작업 폴더 ${connected.length}개`;

    // 1) Render Team Cards Grid on index.html (hash-guarded so 3s polling never destroys unchanged DOM or active clicks)
    const gridEl = document.getElementById('dashboardTeamsGrid');
    const teamsSig = JSON.stringify([teams, gdGlobal]);
    const skipTeamGridRebuild = Boolean(
      gridEl &&
      !forceRender &&
      gridEl.children.length === teams.length &&
      (
        teamsSig === lastTeamsGridHash ||
        gridEl.contains(document.activeElement) ||
        Array.from(gridEl.querySelectorAll('.team-dispatch-input')).some(inp => (inp.value || '').trim().length > 0) ||
        Array.from(gridEl.querySelectorAll('.team-dispatch-status')).some(st => st.dataset.pinned === '1')
      )
    );
    if (gridEl && !skipTeamGridRebuild) {
      lastTeamsGridHash = teamsSig;
      gridEl.innerHTML = teams.map(t => {
        const ws = t.workspace_status || {};
        const gd = ws.gdrive_direct || {};
        const r = t.roles || {};
        const members = Array.isArray(t.member_details) ? t.member_details : [];
        const color = t.color || '#0f6848';

        const memberChipsHtml = members.slice(0, 6).map(m =>
          `<span class="team-member-chip" title="${escHtml(m.role)} · ${escHtml(m.cli)}"><b style="color:${color}">#${escHtml(m.id)}</b> ${escHtml(m.name)}</span>`
        ).join('') + (members.length > 6 ? `<span class="team-member-chip">+${members.length - 6}명</span>` : '');

        const isCloudPrimary = Boolean(ws.is_cloud_primary && gd.folder_url);
        const cloudWebUrl = gd.folder_url || 'https://drive.google.com/drive/my-drive';
        const nonAsciiWarn = (!isCloudPrimary && ws.has_non_ascii_or_space)
          ? `<span style="background:#fff7ed;color:#c2410c;border:1px solid #fed7aa;padding:1px 6px;border-radius:5px;font-size:9px;font-weight:700" title="Flutter/RN 등 네이티브 앱 빌드 시 영문 전용 폴더 권장">한글/공백 포함</span>`
          : '';

        const gdLineHtml = gd.configured_enabled
          ? `<div class="team-folder-row" style="border-top:1px dashed #cbd5e1;padding-top:5px;margin-top:2px">
               <span style="color:#0369a1;font-weight:700">☁️ 클라우드 폴더명: <b>${escHtml(gd.folder_name)}</b> ${gd.connected ? '<span style="color:#15803d">(자동 업로드 ON)</span>' : '<span style="color:#d97706">(로그인 대기)</span>'}</span>
               <div style="display:flex;gap:8px;align-items:center">
                 <button type="button" class="btn-change-team-gdrive" data-tid="${escHtml(t.id)}" data-tname="${escHtml(t.name)}" style="border:0;background:transparent;color:#0369a1;font-weight:800;font-size:10px;cursor:pointer;padding:0;text-decoration:underline">다른 웹 폴더 선택</button>
                 <a href="${escHtml(cloudWebUrl)}" target="_blank" rel="noopener" style="color:#0284c7;font-weight:800;font-size:10px;text-decoration:underline">웹 열기 ↗</a>
               </div>
             </div>`
          : `<div class="team-folder-row" style="border-top:1px dashed #e2e8f0;padding-top:4px;margin-top:2px;color:#64748b;font-size:10px">
               <span>☁️ Google Drive 클라우드 폴더 미지정</span>
               <button type="button" class="btn-quick-team-gdrive" data-tid="${escHtml(t.id)}" data-tname="${escHtml(t.name)}" style="border:0;background:transparent;color:#0284c7;font-weight:800;font-size:10px;cursor:pointer;padding:0;text-decoration:underline">${gdGlobal.connected ? '+ 클라우드 전용폴더 자동생성' : '구글 계정 연결하기'}</button>
             </div>`;

        return `
          <div class="team-ws-card ${t.is_active ? 'is-active-team' : ''}" style="border-left-color:${escHtml(color)}">
            <div class="team-ws-head">
              <div>
                <div class="team-ws-title-row">
                  <span class="team-floor-pill" style="border-color:${escHtml(color)}44;color:${escHtml(color)}">🏢 ${escHtml(t.floor)}</span>
                  <span class="team-ws-name">${escHtml(t.name)}</span>
                  ${t.is_active
            ? '<span class="team-active-pill">★ 현재 기본 작업팀</span>'
            : `<button type="button" class="btn small btn-set-active-team" data-tid="${escHtml(t.id)}" style="height:21px;padding:0 7px;font-size:9.5px">기본 팀으로 전환</button>`}
                  ${t.orchestrator_mode === 'carbon'
            ? '<span class="orch-tier-pill ultra">💎 Carbon</span>'
            : t.orchestrator_mode === 'argon'
              ? '<span class="orch-tier-pill pro">🔷 Argon</span>'
              : '<span class="orch-tier-pill free">⚡ Standard/전역</span>'}
                </div>
                ${t.description ? `<div class="team-ws-desc">${escHtml(t.description)}</div>` : ''}
              </div>
              <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
                <span data-team-status-pill="${escHtml(t.id)}" style="font-size:10px;font-weight:800;color:#15803d;background:#dcfce7;padding:3px 8px;border-radius:999px">🟢 대기 중</span>
                <button type="button" class="btn small btn-stop-team-mission" data-tid="${escHtml(t.id)}" data-tname="${escHtml(t.name)}" style="display:none;height:24px;padding:0 8px;font-size:9.5px;color:#b91c1c;border-color:#fecaca;background:#fef2f2">■ 이 팀 정지</button>
                <span data-team-active-count="${escHtml(t.id)}" style="font-size:10px;font-weight:800;color:${Number(t.active_mission_count || 0) > 0 ? '#1d4ed8' : '#475569'};background:${Number(t.active_mission_count || 0) > 0 ? '#dbeafe' : '#f1f5f9'};padding:3px 8px;border-radius:6px">진행 중 ${Number(t.active_mission_count || 0)}건</span>
              </div>
            </div>

            <div class="team-members-strip">
              <div class="team-member-chips">${memberChipsHtml}</div>
              <div class="team-role-mini">HEAD: <b>${escHtml(CLI_SHORT[r.head] || r.head)}</b> · BUILDER: <b>${escHtml(CLI_SHORT[r.builder] || r.builder)}</b> · REVIEWER: <b>${escHtml(CLI_SHORT[r.reviewer] || r.reviewer)}</b></div>
            </div>

            <div class="team-folder-box">
              <div class="team-folder-row">
                <span style="font-weight:800;color:${(isCloudPrimary || ws.is_google_drive_local) ? '#0369a1' : '#0f172a'}">${isCloudPrimary ? '☁️ Google Drive 클라우드 전용 폴더' : (ws.is_google_drive_local ? '☁️ 로컬 마운트 드라이브 폴더' : (ws.is_default ? (ws.active_project_dir ? '📂 프로젝트 기반 작업 폴더 (자동 명명)' : '📂 프로젝트 기반 자동 폴더 (별도 미지정)') : '📂 팀 전용 작업 폴더'))}</span>
                <div style="display:flex;align-items:center;gap:5px;flex-wrap:wrap">
                  ${nonAsciiWarn}
                  <span style="background:${(isCloudPrimary ? gd.connected : ws.is_accessible) ? '#dcfce7' : '#fee2e2'};color:${(isCloudPrimary ? gd.connected : ws.is_accessible) ? '#15803d' : '#b91c1c'};padding:1px 6px;border-radius:5px;font-size:9px;font-weight:800">${(isCloudPrimary ? gd.connected : ws.is_accessible) ? '✓ 연결됨' : '확인 필요'}</span>
                  <span style="font-size:9.5px;color:#475569;font-weight:700">프로젝트 ${ws.project_count || 0} · 리포트 ${ws.report_count || 0} · 파일 ${ws.file_count || 0}</span>
                </div>
              </div>
              <div class="team-folder-path">${isCloudPrimary ? `<a href="${escHtml(cloudWebUrl)}" target="_blank" rel="noopener" style="color:#0284c7;text-decoration:underline;word-break:break-all">${escHtml(cloudWebUrl)}</a>` : escHtml(ws.display_path || ws.effective_dir || 'deliverables/')}${(!isCloudPrimary && ws.is_default && !ws.active_project_dir) ? ` <span style="color:#64748b;font-size:9.5px">(시작 시 YYYYMMDD_프로젝트명으로 자동 생성)</span>` : ''}</div>
              ${gdLineHtml}
            </div>

            <div class="team-ws-actions">
              <button type="button" class="btn small btn-team-open-exp" data-tid="${escHtml(t.id)}" data-tname="${escHtml(t.name)}" data-dir="${escHtml(ws.active_project_dir || ws.effective_dir || '')}" data-cloud-url="${isCloudPrimary ? escHtml(cloudWebUrl) : ''}" style="height:28px;padding:0 9px;font-size:10px">${isCloudPrimary ? '☁️ 웹 폴더 열기 ↗' : '🗂️ 폴더 열기'}</button>
              <button type="button" class="btn small btn-team-browse-dir" data-tid="${escHtml(t.id)}" data-tname="${escHtml(t.name)}" data-dir="${escHtml(ws.effective_dir || '')}" style="height:28px;padding:0 9px;font-size:10px">📂 작업 폴더 변경</button>
              <button type="button" class="btn small btn-team-edit" data-tid="${escHtml(t.id)}" style="height:28px;padding:0 10px;font-size:10px">✏️ 팀 &amp; 폴더 상세편집</button>
              <a href="settings.html?team=${encodeURIComponent(t.id)}#triadGoalForm" class="btn small" style="height:28px;padding:0 10px;font-size:10px;margin-left:auto;color:${escHtml(color)};border-color:${escHtml(color)}55;background:${escHtml(color)}0d">⚙ 상세 설정 ↗</a>
            </div>

            <div class="team-dispatch-box">
              <div class="team-dispatch-head-row">
                <span style="font-size:9.5px;font-weight:800;color:${escHtml(color)}">🚀 [${escHtml(t.name)}] 전용 프로젝트 지시창 (타 팀 프로젝트와 동시 가동 가능)</span>
                ${buildDispatchFolderSwitchButtonsHtml(t.id)}
              </div>
              ${buildDispatchContinueBarHtml(t.id, t.name, ws.effective_dir || '', ws.recent_project_folders || [])}
              <form class="team-dispatch-form" data-tid="${escHtml(t.id)}" data-fstate-key="${escHtml(t.id)}" data-tname="${escHtml(t.name)}" data-head-cli="${escHtml(r.head || 'antigravity_sdk')}">
                <select class="team-dispatch-select" aria-label="${escHtml(t.name)} 실행 모드 선택">
                  <option value="standard" selected>🔄 Standard (표준)</option>
                  <option value="quick">⚡ Quick (고속)</option>
                  <option value="deep">🔬 Deep (심층)</option>
                  <option value="ask">💬 간단 질문 (즉답)</option>
                </select>
                <input type="text" class="team-dispatch-input" placeholder="[${escHtml(t.name)}]에 맡길 프로젝트 목표(Goal) 입력..." aria-label="${escHtml(t.name)} 업무지시 입력" required>
                <button type="submit" class="team-dispatch-btn" style="background:${escHtml(color)}">🚀 프로젝트 시작</button>
              </form>
              <div class="team-live-progress-strip" data-team-live-strip="${escHtml(t.id)}" style="display:none;margin-top:6px;padding:8px 10px;border-radius:8px;background:#f0fdf4;border:1px solid #86efac;font-size:10.5px;line-height:1.5"></div>
              <div class="team-dispatch-status" data-status-tid="${escHtml(t.id)}"></div>
            </div>
          </div>
        `;
      }).join('');

      bindDispatchFolderConnectControls(gridEl);
      teams.forEach(t => syncDispatchContinueUiForKey(gridEl, t.id));

      gridEl.querySelectorAll('.team-dispatch-form').forEach(form => {
        form.addEventListener('submit', async (ev) => {
          ev.preventDefault();
          const tid = form.dataset.tid;
          const tname = form.dataset.tname || '선택 팀';
          const headCli = form.dataset.headCli || 'antigravity';
          const modeSel = form.querySelector('.team-dispatch-select');
          const inp = form.querySelector('.team-dispatch-input');
          const btn = form.querySelector('.team-dispatch-btn');
          const stBox = gridEl.querySelector(`.team-dispatch-status[data-status-tid="${tid}"]`);
          const goal = (inp?.value || '').trim();
          if (!goal) return;
          const mode = modeSel?.value || 'standard';

          if (mode === 'ask') {
            inp.value = '';
            const origTxt = btn ? btn.textContent : '🚀 업무 지시';
            if (btn) { btn.disabled = true; btn.textContent = '⏳ 응답 중...'; }
            if (stBox) {
              stBox.style.display = 'block';
              stBox.style.background = '#f8fafc';
              stBox.style.borderColor = '#cbd5e1';
              stBox.style.color = '#334155';
              stBox.dataset.pinned = '1';
              stBox.textContent = `💭 [${tname}] '${goal}' 질문에 대한 답변을 생성 중입니다...`;
            }
            const ans = await askDirectQuestion(headCli, goal, `${tname} 리드 AI`);
            if (stBox) {
              stBox.style.background = '#f0fdf4';
              stBox.style.borderColor = '#86efac';
              stBox.style.color = '#166534';
              stBox.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px"><div><strong>💬 [${escHtml(ans.label || tname)}]</strong> ${escHtml(ans.answer || '')}</div><button type="button" class="btn-close-dispatch-status" style="border:0;background:transparent;color:#64748b;cursor:pointer;font-size:11px;padding:0 2px">✕</button></div>`;
              stBox.querySelector('.btn-close-dispatch-status')?.addEventListener('click', () => {
                delete stBox.dataset.pinned;
                stBox.style.display = 'none';
              });
            }
            if (btn) { btn.disabled = false; btn.textContent = origTxt; }
            return;
          }

          const fState = getTeamContinueState(tid);
          if (btn) btn.disabled = true;
          const res = await dispatchMissionGoal(goal, mode, tid, { folderMode: fState.mode, continueDir: fState.dir });
          if (btn) btn.disabled = false;
          if (res && res.ok) {
            inp.value = '';
          }
          if (stBox) {
            stBox.style.display = 'block';
            stBox.dataset.pinned = '1';
            if (res && res.ok) {
              stBox.style.background = '#f0fdf4';
              stBox.style.borderColor = '#86efac';
              stBox.style.color = '#166534';
              const folderHint = fState.mode === 'continue' ? ` (📂 기존 폴더 이어하기: ${formatShortFolderLabel(fState.dir)})` : '';
              stBox.textContent = `🚀 [${tname} · ${mode.toUpperCase()}] '${goal}' 업무 파이프라인이 시작되었습니다!${folderHint} 바로 아래 실시간 파이프라인 실행 로그 및 산출물 섹션에서 진행 상황을 확인하세요.`;
              setTimeout(() => {
                delete stBox.dataset.pinned;
                stBox.style.display = 'none';
              }, 8000);
            } else {
              stBox.style.background = '#fef2f2';
              stBox.style.borderColor = '#fecaca';
              stBox.style.color = '#b91c1c';
              stBox.textContent = `⚠️ ${res?.error || '업무 지시를 시작할 수 없습니다.'}`;
              setTimeout(() => { delete stBox.dataset.pinned; }, 6000);
            }
          }
        });
      });

      gridEl.querySelectorAll('.btn-stop-team-mission').forEach(btn => {
        btn.addEventListener('click', async () => {
          const tid = btn.dataset.tid;
          const tname = btn.dataset.tname || tid;
          btn.disabled = true;
          try {
            await apiFetch('/ops/missions/stop', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ team_id: tid, reason: `[${tname}] 팀 작업 개별 정지` })
            });
            pollOrchestrator();
          } finally {
            btn.disabled = false;
          }
        });
      });

      gridEl.querySelectorAll('.btn-set-active-team').forEach(btn => {
        btn.addEventListener('click', async () => {
          btn.disabled = true;
          try {
            const res = await apiFetch('/ops/teams', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'set_active', team_id: btn.dataset.tid })
            });
            const d = await res.json().catch(() => ({}));
            if (d.teams_summary) renderTeamsAndWorkspacesDashboard(d.teams_summary, true);
          } catch (_) {
            btn.disabled = false;
          }
        });
      });

      gridEl.querySelectorAll('.btn-team-open-exp').forEach(btn => {
        btn.addEventListener('click', () => {
          if (btn.dataset.cloudUrl) {
            window.open(btn.dataset.cloudUrl, '_blank', 'noopener');
            return;
          }
          openLocalFolderExplorer(btn.dataset.dir, btn.dataset.tname || '', btn.dataset.tid || null);
        });
      });

      gridEl.querySelectorAll('.btn-change-team-gdrive').forEach(btn => {
        btn.addEventListener('click', () => {
          openGdriveDirectModal(btn.dataset.tid || null, btn.dataset.tname || '');
        });
      });

      gridEl.querySelectorAll('.btn-team-browse-dir').forEach(btn => {
        btn.addEventListener('click', () => {
          openLocalFolderPicker({
            initialDir: btn.dataset.dir || '',
            teamId: btn.dataset.tid || null,
            teamName: btn.dataset.tname || ''
          });
        });
      });

      gridEl.querySelectorAll('.btn-team-edit').forEach(btn => {
        btn.addEventListener('click', () => openTeamBuilderModal(btn.dataset.tid));
      });

      gridEl.querySelectorAll('.btn-quick-team-gdrive').forEach(btn => {
        btn.addEventListener('click', async () => {
          if (!gdGlobal.connected) {
            openGdriveDirectModal();
            return;
          }
          const tid = btn.dataset.tid;
          const orig = btn.textContent;
          btn.disabled = true;
          btn.textContent = '생성 중...';
          try {
            const res = await apiFetch('/ops/teams', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'create_gdrive_team_folder', team_id: tid })
            });
            const d = await res.json().catch(() => ({}));
            if (res.ok && d.teams_summary) {
              renderTeamsAndWorkspacesDashboard(d.teams_summary, true);
              showTeamCardFlashMessage(tid, `☁️ ${d.message || 'Google Drive 전용 클라우드 폴더가 생성되어 팀에 연결되었습니다!'}`);
            } else {
              showTeamCardFlashMessage(tid, `❌ ${d.error || '클라우드 전용 폴더 생성 실패'}`, true);
            }
          } catch (_) {
            showTeamCardFlashMessage(tid, '❌ 서버 통신 오류가 발생했습니다.', true);
          } finally {
            btn.disabled = false;
            btn.textContent = orig;
          }
        });
      });
    }

    // 2) Render Unified Connected Workspaces List (#connectedWorkspacesList on index.html & #settingsConnectedWorkspacesList on settings.html)
    const wsListEl = document.getElementById('connectedWorkspacesList');
    const settingsWsListEl = document.getElementById('settingsConnectedWorkspacesList');
    const wsSumLbl = document.getElementById('connectedWsSummaryLabel');
    const settingsWsSumLbl = document.getElementById('settingsConnectedWsSummaryLabel');
    const gdAccTxt = gdGlobal.connected ? ` · ☁️ Google Drive 계정 연결됨(${gdGlobal.account_email || 'OAuth'})` : '';
    const wsSummaryStr = `총 ${connected.length}개 활성 작업 폴더 연결됨${unboundGdrives.length ? ` · 감지된 로컬 드라이브 ${unboundGdrives.length}개` : ''}${gdAccTxt}`;
    if (wsSumLbl) wsSumLbl.textContent = wsSummaryStr;
    if (settingsWsSumLbl) settingsWsSumLbl.textContent = wsSummaryStr;

    const connSig = JSON.stringify([connected, unboundGdrives, gdGlobal]);
    if ((wsListEl || settingsWsListEl) && (forceRender || connSig !== lastConnWsHash)) {
      lastConnWsHash = connSig;
      const rowsHtml = connected.map(w => {
        const isCloud = w.kind === 'gdrive_cloud';
        const teamBadges = (w.teams || []).length > 0
          ? w.teams.map(tb => `<span style="display:inline-flex;align-items:center;gap:4px;padding:2px 7px;border-radius:6px;background:${escHtml(tb.color || '#0f6848')}14;color:${escHtml(tb.color || '#0f6848')};border:1px solid ${escHtml(tb.color || '#0f6848')}40;font-size:10px;font-weight:800">${escHtml(tb.floor)} · ${escHtml(tb.name)}${tb.is_active ? ' ★' : ''}</span>`).join(' ')
          : `<span style="padding:2px 7px;border-radius:6px;background:#f1f5f9;color:#64748b;font-size:10px;font-weight:700">전역 공통 폴더</span>`;

        const actionBtn = isCloud
          ? `<a href="${escHtml(w.web_url || 'https://drive.google.com/drive/my-drive')}" target="_blank" class="btn small" style="height:26px;padding:0 10px;font-size:10px;background:#e0f2fe;color:#0369a1;border-color:#7dd3fc">☁️ 웹 드라이브 열기 ↗</a>`
          : `<button type="button" class="btn small btn-conn-ws-open" data-dir="${escHtml(w.path)}" data-wname="${escHtml(w.display_name || '')}" style="height:26px;padding:0 10px;font-size:10px">🗂️ 탐색기 열기</button>`;

        return `
          <div class="connected-ws-row">
            <div style="display:flex;flex-direction:column;gap:4px;min-width:240px;flex:1">
              <div style="display:flex;align-items:center;gap:7px;flex-wrap:wrap">
                <span style="background:${isCloud || w.kind === 'gdrive_mounted' ? '#e0f2fe' : '#f1f5f9'};color:${isCloud || w.kind === 'gdrive_mounted' ? '#0369a1' : '#1e293b'};padding:2px 8px;border-radius:6px;font-size:10px;font-weight:800">${escHtml(w.kind_label)}</span>
                <strong style="font-family:var(--font-mono);font-size:11px;color:#0f172a;word-break:break-all">${escHtml(w.path)}</strong>
                <span style="background:${w.is_accessible ? '#dcfce7' : '#fee2e2'};color:${w.is_accessible ? '#15803d' : '#b91c1c'};padding:1.5px 6px;border-radius:5px;font-size:9.5px;font-weight:800">${w.is_accessible ? '✓ 정상 연결' : '승인/확인 필요'}</span>
                ${w.has_non_ascii_or_space ? `<span style="background:#fff7ed;color:#c2410c;padding:1.5px 6px;border-radius:5px;font-size:9px;font-weight:700">한글/공백 포함</span>` : ''}
              </div>
              <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
                <span style="font-size:10px;color:#64748b">연결된 팀:</span>
                ${teamBadges}
              </div>
            </div>
            <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
              <span style="font-size:10.5px;color:#334155;font-weight:700;background:#f8fafc;padding:4px 9px;border-radius:7px;border:1px solid #e2e8f0">프로젝트 <b>${w.project_count || 0}</b>개 · 리포트 <b>${w.report_count || 0}</b>개 · 파일 <b>${w.file_count || 0}</b>개</span>
              ${actionBtn}
            </div>
          </div>
        `;
      }).join('');

      const unboundHtml = unboundGdrives.map(gd => `
        <div class="connected-ws-row" style="background:#f0f9ff;border-style:dashed;border-color:#7dd3fc">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            <span style="background:#bae6fd;color:#0369a1;padding:2px 8px;border-radius:6px;font-size:10px;font-weight:800">☁️ 감지된 Google Drive 볼륨</span>
            <strong style="font-family:var(--font-mono);font-size:11px;color:#0c4a6e">${escHtml(gd.root)}</strong>
            <span style="font-size:10px;color:#0369a1">새 팀의 전용 작업 폴더로 바로 연결할 수 있습니다.</span>
          </div>
          <button type="button" class="btn small btn-bind-mounted-gd" data-suggested="${escHtml(gd.suggested || gd.root)}" style="height:26px;padding:0 10px;font-size:10px;background:#0284c7;color:#fff;border-color:#0284c7">➕ 이 경로로 새 팀 만들기</button>
        </div>
      `).join('');

      const combinedWsHtml = rowsHtml + unboundHtml;
      [wsListEl, settingsWsListEl].forEach(targetBox => {
        if (!targetBox) return;
        targetBox.innerHTML = combinedWsHtml;
        targetBox.querySelectorAll('.btn-conn-ws-open').forEach(b => {
          b.addEventListener('click', () => {
            openLocalFolderExplorer(b.dataset.dir || '', b.dataset.wname || '연결된 작업 폴더');
          });
        });
        targetBox.querySelectorAll('.btn-bind-mounted-gd').forEach(b => {
          b.addEventListener('click', () => openTeamBuilderModal(null, b.dataset.suggested || ''));
        });
      });
    }

    // 3) Populate #triadTeamSelect on settings.html
    const teamSel = document.getElementById('triadTeamSelect');
    if (teamSel) {
      let desiredId = teamSel.value || ts.active_team_id;
      if (!initialQueryTeamApplied) {
        initialQueryTeamApplied = true;
        try {
          const qp = new URLSearchParams(window.location.search);
          const qTeam = qp.get('team');
          if (qTeam && teams.some(t => t.id === qTeam)) {
            desiredId = qTeam;
            const pSel = document.getElementById('triadProfileSelect');
            if (pSel && pSel.value === 'ask') pSel.value = 'standard';
          }
        } catch (_) { }
      }
      if (!teams.some(t => t.id === desiredId)) desiredId = ts.active_team_id || teams[0]?.id || '';

      teamSel.innerHTML = teams.map(t => {
        const tws = t.workspace_status || {};
        const tLoc = tws.is_cloud_primary
          ? (tws.gdrive_direct?.folder_url || 'Google Drive')
          : (tws.is_default ? 'deliverables/' : (t.workspace?.output_dir || tws.effective_dir || 'deliverables/'));
        return `<option value="${escHtml(t.id)}" ${t.id === desiredId ? 'selected' : ''}>[${escHtml(t.floor)}] ${escHtml(t.name)} (${(t.member_ids || []).length}명 · ${escHtml(tLoc)})</option>`;
      }).join('');
      syncSettingsBarFromTeam(desiredId);
    }

    // 3-B) Render separated Per-Team Project Input Cards on settings.html (#settingsPerTeamMissionGrid)
    renderSettingsPerTeamMissionBoard(ts, forceRender);
    if (latestActivitySnapshot) {
      updatePerTeamLiveProgressStrips(latestActivitySnapshot);
    }

    // 4) Render AI 직원 관리(agents.html) 및 대시보드(index.html) 팀·직원 현황 동기화
    renderAgentsTeamPlacementBoard(ts, forceRender);
    if (renderDashboardAgentsAndStatsFn) renderDashboardAgentsAndStatsFn(forceRender);
    if (studioRefreshDirectoryFn) studioRefreshDirectoryFn();
  }

  var latestActivitySnapshot = null;
  let lastSettingsPerTeamSig = '';
  let lastApprovalCenterStamp = '';

  function bindTeamDispatchFormsInContainer(containerEl) {
    if (!containerEl) return;
    bindDispatchFolderConnectControls(containerEl);
    containerEl.querySelectorAll('.per-team-project-form').forEach(form => {
      const fKey = form.dataset.fstateKey || form.dataset.tid;
      if (fKey) syncDispatchContinueUiForKey(containerEl, fKey);
      form.addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const tid = form.dataset.tid;
        const stateKey = form.dataset.fstateKey || tid;
        const tname = form.dataset.tname || '선택 팀';
        const headCli = form.dataset.headCli || 'antigravity_sdk';
        const modeSel = form.querySelector('.team-dispatch-select');
        const inp = form.querySelector('.team-dispatch-input');
        const btn = form.querySelector('.team-dispatch-btn');
        const stBox = containerEl.querySelector(`.team-dispatch-status[data-status-tid="${tid}"]`);
        const goal = (inp?.value || '').trim();
        if (!goal) return;
        const mode = modeSel?.value || 'standard';

        if (mode === 'ask') {
          inp.value = '';
          const origTxt = btn ? btn.textContent : '🚀 프로젝트 시작';
          if (btn) { btn.disabled = true; btn.textContent = '⏳ 응답 중...'; }
          if (stBox) {
            stBox.style.display = 'block';
            stBox.style.background = '#f8fafc';
            stBox.style.borderColor = '#cbd5e1';
            stBox.style.color = '#334155';
            stBox.dataset.pinned = '1';
            stBox.textContent = `💭 [${tname}] '${goal}' 질문 응답 생성 중...`;
          }
          const ans = await askDirectQuestion(headCli, goal, `${tname} 총괄팀장`);
          if (stBox) {
            stBox.style.background = '#f0fdf4';
            stBox.style.borderColor = '#86efac';
            stBox.style.color = '#166534';
            stBox.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px"><div><strong>💬 [${escHtml(ans.label || tname)}]</strong> ${escHtml(ans.answer || '')}</div><button type="button" class="btn-close-dispatch-status" style="border:0;background:transparent;color:#64748b;cursor:pointer;font-size:11px;padding:0 2px">✕</button></div>`;
            stBox.querySelector('.btn-close-dispatch-status')?.addEventListener('click', () => {
              delete stBox.dataset.pinned;
              stBox.style.display = 'none';
            });
          }
          if (btn) { btn.disabled = false; btn.textContent = origTxt; }
          return;
        }

        const fState = getTeamContinueState(stateKey);
        if (btn) btn.disabled = true;
        const res = await dispatchMissionGoal(goal, mode, tid, { folderMode: fState.mode, continueDir: fState.dir });
        if (btn) btn.disabled = false;
        if (res && res.ok) {
          inp.value = '';
        }
        if (stBox) {
          stBox.style.display = 'block';
          stBox.dataset.pinned = '1';
          if (res && res.ok) {
            stBox.style.background = '#f0fdf4';
            stBox.style.borderColor = '#86efac';
            stBox.style.color = '#166534';
            const contNote = fState.mode === 'continue' ? ` (📂 기존 폴더 이어하기: ${formatShortFolderLabel(fState.dir)})` : '';
            stBox.textContent = `🚀 [${tname}] '${goal}' 프로젝트가 독립 파이프라인으로 시작되었습니다!${contNote} 다른 팀 입력창에서도 동시에 새 프로젝트를 실행할 수 있습니다.`;
            setTimeout(() => {
              delete stBox.dataset.pinned;
              stBox.style.display = 'none';
            }, 6000);
          } else {
            stBox.style.background = '#fef2f2';
            stBox.style.borderColor = '#fecaca';
            stBox.style.color = '#b91c1c';
            stBox.textContent = `⚠️ ${res?.error || '프로젝트를 시작할 수 없습니다.'}`;
          }
        }
      });
    });

    containerEl.querySelectorAll('.btn-stop-team-mission').forEach(btn => {
      btn.addEventListener('click', async () => {
        const tid = btn.dataset.tid;
        const tname = btn.dataset.tname || tid;
        btn.disabled = true;
        try {
          await apiFetch('/ops/missions/stop', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ team_id: tid, reason: `[${tname}] 팀 작업 개별 정지` })
          });
          pollOrchestrator();
        } finally {
          btn.disabled = false;
        }
      });
    });
  }

  function renderSettingsPerTeamMissionBoard(ts, forceRender = false) {
    const addBtn = document.getElementById('btnPerTeamBoardAddTeam');
    if (addBtn && !addBtn.dataset.bound) {
      addBtn.dataset.bound = '1';
      addBtn.addEventListener('click', () => openTeamBuilderModal(null));
    }
    const gdModalBtn = document.getElementById('btnSettingsBoardOpenGdrive');
    if (gdModalBtn && !gdModalBtn.dataset.bound) {
      gdModalBtn.dataset.bound = '1';
      gdModalBtn.addEventListener('click', () => openGdriveDirectModal());
    }
    const refWsBtn = document.getElementById('btnSettingsBoardRefreshWs');
    if (refWsBtn && !refWsBtn.dataset.bound) {
      refWsBtn.dataset.bound = '1';
      refWsBtn.addEventListener('click', () => {
        apiFetch('/ops/teams?refresh=1', { cache: 'no-store' })
          .then(r => (r.ok ? r.json() : null))
          .then(d => { if (d) renderTeamsAndWorkspacesDashboard(d, true); })
          .catch(() => { });
      });
    }
    const globalContMount = document.getElementById('settingsGlobalContinueMount');
    if (globalContMount) {
      const selTeamId = document.getElementById('triadTeamSelect')?.value || ts?.active_team_id || (teams[0] && teams[0].id) || '';
      const activeTeamObj = teams.find(t => t.id === selTeamId) || teams[0] || {};
      const gWs = activeTeamObj.workspace_status || {};
      const gRecs = Array.isArray(gWs.recent_project_folders) ? gWs.recent_project_folders : [];
      const gSig = JSON.stringify([selTeamId, gWs.effective_dir, gRecs]);
      if (forceRender || globalContMount.dataset.renderedSig !== gSig) {
        globalContMount.dataset.renderedSig = gSig;
        globalContMount.innerHTML = `
          <div style="display:flex;flex-direction:column;gap:6px;padding:8px 11px;border-radius:10px;background:#f8fafc;border:1px solid #cbd5e1">
            <div class="team-dispatch-head-row">
              <span style="font-size:10.5px;font-weight:800;color:#0f172a">📂 작업 폴더 방식 선택 <span style="font-weight:600;color:#64748b;font-size:10px">(미션 실행 모드일 때 적용 · 통합보고서 .md 파일도 해당 작업 폴더 내부에 생성됨)</span></span>
              ${buildDispatchFolderSwitchButtonsHtml('__global__')}
            </div>
            ${buildDispatchContinueBarHtml('__global__', activeTeamObj.name || '선택 팀', gWs.effective_dir || '', gRecs)}
          </div>
        `;
        bindDispatchFolderConnectControls(globalContMount);
        syncDispatchContinueUiForKey(globalContMount, '__global__');
      }
      const tSel = document.getElementById('triadTeamSelect');
      if (tSel && !tSel.dataset.boundGlobalCont) {
        tSel.dataset.boundGlobalCont = '1';
        tSel.addEventListener('change', () => {
          if (window.NEXUS_TEAMS_SUMMARY) renderSettingsPerTeamMissionBoard(window.NEXUS_TEAMS_SUMMARY, true);
        });
      }
    }

    const gridEl = document.getElementById('settingsPerTeamMissionGrid');
    if (!gridEl) return;
    const teams = Array.isArray(ts?.teams) ? ts.teams : [];
    const gdGlobal = ts?.gdrive_connection || {};
    const sig = JSON.stringify([teams.map(t => [t.id, t.name, t.floor, t.color, (t.member_ids || []).length, t.workspace_status]), gdGlobal]);
    const hasActiveInput = gridEl.contains(document.activeElement)
      || Array.from(gridEl.querySelectorAll('.team-dispatch-input')).some(inp => (inp.value || '').trim().length > 0)
      || Array.from(gridEl.querySelectorAll('.team-dispatch-status')).some(st => st.dataset.pinned === '1');
    if (!forceRender && gridEl.children.length === teams.length && (sig === lastSettingsPerTeamSig || hasActiveInput)) {
      return;
    }
    lastSettingsPerTeamSig = sig;
    gridEl.innerHTML = teams.map(t => {
      const color = t.color || '#0f6848';
      const ws = t.workspace_status || {};
      const gd = ws.gdrive_direct || {};
      const r = t.roles || {};
      const isCloudPrimary = Boolean(ws.is_cloud_primary && gd.folder_url);
      const cloudWebUrl = gd.folder_url || 'https://drive.google.com/drive/my-drive';
      const isConnectedOk = isCloudPrimary ? Boolean(gd.connected) : Boolean(ws.is_accessible);
      const folderTypeTitle = isCloudPrimary
        ? '☁️ Google Drive 클라우드 전용 폴더'
        : (ws.is_google_drive_local ? '☁️ 로컬 마운트 드라이브 폴더' : (ws.is_default ? (ws.active_project_dir ? '📂 프로젝트 기반 작업 폴더 (자동 명명)' : '📂 프로젝트 기반 자동 폴더 (별도 미지정)') : '📂 팀 전용 작업 폴더'));
      const gdSubLineHtml = gd.configured_enabled
        ? `<div style="display:flex;justify-content:space-between;align-items:center;gap:6px;flex-wrap:wrap;padding-top:4px;margin-top:2px;border-top:1px dashed #cbd5e1;font-size:9.5px">
             <span style="color:#0369a1;font-weight:700">☁️ 클라우드 폴더: <b>${escHtml(gd.folder_name)}</b> ${gd.connected ? '<span style="color:#15803d">(자동 업로드 ON)</span>' : '<span style="color:#d97706">(로그인 대기)</span>'}</span>
             <div style="display:flex;gap:7px;align-items:center">
               <button type="button" class="btn-settings-team-gdrive" data-tid="${escHtml(t.id)}" data-tname="${escHtml(t.name)}" style="border:0;background:transparent;color:#0369a1;font-weight:800;font-size:9.5px;cursor:pointer;padding:0;text-decoration:underline">웹 폴더 변경</button>
               <a href="${escHtml(cloudWebUrl)}" target="_blank" rel="noopener" style="color:#0284c7;font-weight:800;font-size:9.5px;text-decoration:underline">웹 열기 ↗</a>
             </div>
           </div>`
        : `<div style="display:flex;justify-content:space-between;align-items:center;gap:6px;padding-top:4px;margin-top:2px;border-top:1px dashed #e2e8f0;font-size:9.5px;color:#64748b">
             <span>☁️ Google Drive 클라우드 폴더 미지정</span>
             <button type="button" class="btn-settings-team-gdrive" data-tid="${escHtml(t.id)}" data-tname="${escHtml(t.name)}" style="border:0;background:transparent;color:#0284c7;font-weight:800;font-size:9.5px;cursor:pointer;padding:0;text-decoration:underline">${gdGlobal.connected ? '+ 웹 폴더 선택' : '구글 계정 연결'}</button>
           </div>`;

      return `
        <div style="padding:12px 14px;border-radius:11px;background:#ffffff;border:1px solid #cbd5e1;border-left:4px solid ${escHtml(color)};display:flex;flex-direction:column;gap:8px">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;flex-wrap:wrap">
            <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
              <span style="font-size:10px;font-weight:800;padding:2px 7px;border-radius:5px;background:${escHtml(color)}15;color:${escHtml(color)};border:1px solid ${escHtml(color)}44">🏢 ${escHtml(t.floor || '1F')}</span>
              <strong style="font-size:12.5px;color:#0f172a">${escHtml(t.name)}</strong>
              <span style="font-size:9.5px;color:#64748b;font-weight:700">(${(t.member_ids || []).length}명)</span>
            </div>
            <div style="display:flex;align-items:center;gap:5px;flex-wrap:wrap">
              <span data-team-status-pill="${escHtml(t.id)}" style="font-size:9.5px;font-weight:800;color:#15803d;background:#dcfce7;padding:2px 8px;border-radius:999px">🟢 대기 중</span>
              <span data-team-active-count="${escHtml(t.id)}" style="font-size:9.5px;font-weight:800;color:${Number(t.active_mission_count || 0) > 0 ? '#1d4ed8' : '#475569'};background:${Number(t.active_mission_count || 0) > 0 ? '#dbeafe' : '#f1f5f9'};padding:2px 7px;border-radius:6px">진행 중 ${Number(t.active_mission_count || 0)}건</span>
              <button type="button" class="btn small btn-stop-team-mission" data-tid="${escHtml(t.id)}" data-tname="${escHtml(t.name)}" style="display:none;height:22px;padding:0 7px;font-size:9px;color:#b91c1c;border-color:#fecaca;background:#fef2f2">■ 이 팀 정지</button>
            </div>
          </div>

          <div class="team-dispatch-head-row">
            <span style="font-size:9.5px;font-weight:800;color:${escHtml(color)}">🚀 프로젝트 지시 방식</span>
            ${buildDispatchFolderSwitchButtonsHtml(`settings-${t.id}`)}
          </div>
          ${buildDispatchContinueBarHtml(`settings-${t.id}`, t.name, ws.effective_dir || '', ws.recent_project_folders || [])}
          <form class="team-dispatch-form per-team-project-form" data-tid="${escHtml(t.id)}" data-fstate-key="settings-${escHtml(t.id)}" data-tname="${escHtml(t.name)}" data-head-cli="${escHtml(r.head || 'antigravity_sdk')}" style="margin:0">
            <select class="team-dispatch-select" aria-label="${escHtml(t.name)} 실행 모드">
              <option value="standard" selected>🔄 Standard</option>
              <option value="quick">⚡ Quick</option>
              <option value="deep">🔬 Deep</option>
              <option value="ask">💬 질문</option>
            </select>
            <input type="text" class="team-dispatch-input" placeholder="[${escHtml(t.name)}] 독립 프로젝트 목표 입력..." required>
            <button type="submit" class="team-dispatch-btn" style="background:${escHtml(color)}">🚀 시작</button>
          </form>
          <div class="team-live-progress-strip" data-team-live-strip="${escHtml(t.id)}" style="display:none;padding:7px 9px;border-radius:8px;background:#f0fdf4;border:1px solid #86efac;font-size:10px;line-height:1.45"></div>
          <div class="team-dispatch-status" data-status-tid="${escHtml(t.id)}"></div>

          <!-- 팀 입력창 하단: 이 팀에 연결된 작업 폴더 상세 정보 및 바로가기 -->
          <div class="team-folder-box" style="margin-top:auto;padding:8px 10px;border-radius:8px;background:#f8fafc;border:1px solid #e2e8f0;display:flex;flex-direction:column;gap:4px">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:5px;flex-wrap:wrap">
              <span style="font-size:10px;font-weight:800;color:${(isCloudPrimary || ws.is_google_drive_local) ? '#0369a1' : '#0f172a'}">${folderTypeTitle}</span>
              <div style="display:flex;align-items:center;gap:5px;flex-wrap:wrap">
                <span style="background:${isConnectedOk ? '#dcfce7' : '#fee2e2'};color:${isConnectedOk ? '#15803d' : '#b91c1c'};padding:1px 6px;border-radius:5px;font-size:9px;font-weight:800">${isConnectedOk ? '✓ 연결됨' : '확인 필요'}</span>
                <span style="font-size:9px;color:#475569;font-weight:700">프로젝트 ${ws.project_count || 0} · 리포트 ${ws.report_count || 0} · 파일 ${ws.file_count || 0}</span>
              </div>
            </div>
            <div style="font-family:var(--font-mono,monospace);font-size:10px;color:#1e293b;word-break:break-all">
              ${isCloudPrimary ? `<a href="${escHtml(cloudWebUrl)}" target="_blank" rel="noopener" style="color:#0284c7;text-decoration:underline">${escHtml(cloudWebUrl)}</a>` : escHtml(ws.display_path || ws.effective_dir || 'deliverables/')}${(!isCloudPrimary && ws.is_default && !ws.active_project_dir) ? ` <span style="color:#64748b;font-family:var(--font-sans,sans-serif)">(시작 시 YYYYMMDD_프로젝트명 폴더로 자동 작업)</span>` : ''}
            </div>
            ${gdSubLineHtml}
            <div style="display:flex;gap:5px;align-items:center;flex-wrap:wrap;margin-top:3px">
              <button type="button" class="btn small btn-settings-team-open-dir" data-tid="${escHtml(t.id)}" data-tname="${escHtml(t.name)}" data-dir="${escHtml(ws.active_project_dir || ws.effective_dir || '')}" data-cloud-url="${isCloudPrimary ? escHtml(cloudWebUrl) : ''}" style="height:24px;padding:0 8px;font-size:9.5px">${isCloudPrimary ? '☁️ 웹 폴더 열기 ↗' : '🗂️ 폴더 열기'}</button>
              <button type="button" class="btn small btn-settings-team-browse-dir" data-tid="${escHtml(t.id)}" data-tname="${escHtml(t.name)}" data-dir="${escHtml(ws.effective_dir || '')}" style="height:24px;padding:0 8px;font-size:9.5px">📂 로컬 폴더 변경</button>
              <button type="button" class="btn small btn-settings-team-edit" data-tid="${escHtml(t.id)}" style="height:24px;padding:0 8px;font-size:9.5px">✏️ 팀·폴더 편집</button>
            </div>
          </div>
        </div>
      `;
    }).join('');
    bindTeamDispatchFormsInContainer(gridEl);
    gridEl.querySelectorAll('.btn-settings-team-open-dir').forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.dataset.cloudUrl) {
          window.open(btn.dataset.cloudUrl, '_blank', 'noopener');
          return;
        }
        openLocalFolderExplorer(btn.dataset.dir, btn.dataset.tname || '', btn.dataset.tid || null);
      });
    });
    gridEl.querySelectorAll('.btn-settings-team-browse-dir').forEach(btn => {
      btn.addEventListener('click', () => {
        openLocalFolderPicker({
          initialDir: btn.dataset.dir || '',
          teamId: btn.dataset.tid || null,
          teamName: btn.dataset.tname || ''
        });
      });
    });
    gridEl.querySelectorAll('.btn-settings-team-gdrive').forEach(btn => {
      btn.addEventListener('click', () => {
        openGdriveDirectModal(btn.dataset.tid || null, btn.dataset.tname || '');
      });
    });
    gridEl.querySelectorAll('.btn-settings-team-edit').forEach(btn => {
      btn.addEventListener('click', () => openTeamBuilderModal(btn.dataset.tid));
    });
  }

  function updatePerTeamLiveProgressStrips(data) {
    if (!data || !Array.isArray(data.missions)) return;
    const missions = data.missions;
    const teamStreams = data.team_streams || {};
    const teamIds = new Set();
    document.querySelectorAll('[data-team-status-pill]').forEach(el => {
      if (el.dataset.teamStatusPill) teamIds.add(el.dataset.teamStatusPill);
    });
    teamIds.forEach(tid => {
      const activeTeamMissions = missions.filter(
        m => m && m.team_id === tid && ['RUNNING', 'AWAITING_APPROVAL', 'QUOTA_PAUSED', 'PAUSED_ERROR'].includes(m.status)
      );
      const runningM = missions.find(m => m && m.team_id === tid && m.status === 'RUNNING');
      const pendingM = missions.find(m => m && m.team_id === tid && m.status === 'AWAITING_APPROVAL');
      const pausedM = missions.find(m => m && m.team_id === tid && (m.status === 'QUOTA_PAUSED' || m.status === 'PAUSED_ERROR'));
      const tsLive = teamStreams[tid] || null;
      const pills = document.querySelectorAll(`[data-team-status-pill="${tid}"]`);
      const activeCountBadges = document.querySelectorAll(`[data-team-active-count="${tid}"]`);
      const stopBtns = document.querySelectorAll(`.btn-stop-team-mission[data-tid="${tid}"]`);
      const strips = document.querySelectorAll(`[data-team-live-strip="${tid}"]`);

      activeCountBadges.forEach(cb => {
        const cnt = activeTeamMissions.length;
        cb.textContent = `진행 중 ${cnt}건`;
        cb.style.background = cnt > 0 ? '#dbeafe' : '#f1f5f9';
        cb.style.color = cnt > 0 ? '#1d4ed8' : '#475569';
      });

      if (runningM) {
        const curStage = tsLive?.stage || ((runningM.steps || [])[runningM.steps.length - 1]?.stage) || 'LEAD_PLANNING';
        const passed = Number(runningM.passed_steps || (runningM.steps || []).length || 0);
        const resumedCnt = Number(runningM.resumed_count || 0);
        const resumeTag = resumedCnt > 0 ? ` · ♻️ 자동 이어하기 #${resumedCnt}` : '';
        pills.forEach(p => {
          p.style.background = '#dbeafe';
          p.style.color = '#1d4ed8';
          p.textContent = `⚡ 실행 중 · ${curStage}${resumedCnt > 0 ? ' ♻️' : ''}`;
        });
        stopBtns.forEach(b => { b.style.display = 'inline-flex'; });
        const parList = Array.isArray(tsLive?.parallel_agents) ? tsLive.parallel_agents : [];
        const whoLine = parList.length >= 2
          ? `⚡ 사원 ${parList.length}명 동시 병렬 가동: ${parList.map(x => `#${escHtml(x.agent_id)} ${escHtml(x.agent_name)}`).join(' ∥ ')}`
          : (tsLive?.agent_name ? `👤 수행 중: #${escHtml(tsLive.agent_id || '')} ${escHtml(tsLive.agent_name)} — ${escHtml((tsLive.thought || '').slice(0, 70))}` : `진행 단계 완료: ${passed}건`);
        strips.forEach(s => {
          s.style.display = 'block';
          s.style.background = '#eff6ff';
          s.style.borderColor = '#93c5fd';
          s.style.color = '#1e3a8a';
          s.innerHTML = `<div><b>[${escHtml(runningM.mission_id)}]</b> ${escHtml((runningM.goal || '').slice(0, 65))}${resumeTag ? `<span style="margin-left:6px;background:#dcfce7;color:#15803d;padding:1px 6px;border-radius:4px;font-size:9px;font-weight:800">${resumeTag.slice(3)}</span>` : ''}</div><div style="margin-top:2px;color:#0369a1">${whoLine}</div>`;
        });
      } else if (pausedM) {
        pills.forEach(p => {
          p.style.background = '#ffedd5';
          p.style.color = '#c2410c';
          p.textContent = '⏸ 체크포인트 일시중지';
        });
        stopBtns.forEach(b => { b.style.display = 'none'; });
        strips.forEach(s => {
          s.style.display = 'block';
          s.style.background = '#fff7ed';
          s.style.borderColor = '#fdba74';
          s.style.color = '#9a3412';
          s.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;gap:6px;flex-wrap:wrap"><span>⏸ <b>[${escHtml(pausedM.mission_id)}]</b> 체크포인트 보존됨 — 이어서 재개 가능</span><button type="button" class="btn small btn-inline-resume-mission" data-mid="${escHtml(pausedM.mission_id)}" style="height:22px;padding:0 8px;font-size:9.5px;background:#ea580c;color:#fff;border-color:#ea580c">▶ 이어서 재개</button></div>`;
          s.querySelector('.btn-inline-resume-mission')?.addEventListener('click', async (ev) => {
            const b = ev.currentTarget;
            b.disabled = true;
            try {
              await apiFetch('/ops/missions/resume', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mission_id: pausedM.mission_id })
              });
              pollOrchestrator();
            } finally {
              b.disabled = false;
            }
          });
        });
      } else if (pendingM) {
        pills.forEach(p => {
          p.style.background = '#fef3c7';
          p.style.color = '#92400e';
          p.textContent = `📋 통합보고 결재 대기`;
        });
        stopBtns.forEach(b => { b.style.display = 'none'; });
        strips.forEach(s => {
          s.style.display = 'block';
          s.style.background = '#fffbeb';
          s.style.borderColor = '#fcd34d';
          s.style.color = '#92400e';
          s.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;gap:6px;flex-wrap:wrap"><span>📋 <b>[${escHtml(pendingM.mission_id)}]</b> 총괄팀장 통합보고 도착 — 결재 대기 중</span><a href="index.html#dashboardMyAiOfficeSection" style="color:#b45309;font-weight:800;text-decoration:underline">대표 결재함 확인 ↑</a></div>`;
        });
      } else {
        pills.forEach(p => {
          p.style.background = '#dcfce7';
          p.style.color = '#15803d';
          p.textContent = '🟢 대기 중';
        });
        stopBtns.forEach(b => { b.style.display = 'none'; });
        strips.forEach(s => { s.style.display = 'none'; });
      }
    });
  }

  function renderDashboardApprovalCenter(data) {
    const listBox = document.getElementById('dashboardApprovalCardsList');
    const cntBadge = document.getElementById('dashboardApprovalCountBadge');
    const approveAllBtn = document.getElementById('btnApproveAllPendingMissions');
    if (!listBox || !Array.isArray(data?.missions)) return;

    const pendingList = data.missions.filter(m => m && m.status === 'AWAITING_APPROVAL');
    const runningList = data.missions.filter(m => m && m.status === 'RUNNING');
    const recentApproved = data.missions.filter(m => m && m.status === 'DONE' && m.approved_by_user).slice(0, 2);

    if (cntBadge) {
      if (pendingList.length > 0) {
        cntBadge.style.background = '#fef3c7';
        cntBadge.style.color = '#92400e';
        cntBadge.style.borderColor = '#f59e0b';
        cntBadge.textContent = `⏳ 결재 대기 ${pendingList.length}건`;
      } else {
        cntBadge.style.background = '#ecfdf5';
        cntBadge.style.color = '#0f6848';
        cntBadge.style.borderColor = '#86efac';
        cntBadge.textContent = `✓ 결재 대기 0건`;
      }
    }
    if (approveAllBtn) {
      approveAllBtn.style.display = pendingList.length >= 2 ? 'inline-flex' : 'none';
      if (!approveAllBtn.dataset.bound) {
        approveAllBtn.dataset.bound = '1';
        approveAllBtn.addEventListener('click', async () => {
          const curPending = (latestActivitySnapshot?.missions || []).filter(m => m && m.status === 'AWAITING_APPROVAL');
          if (!curPending.length) return;
          approveAllBtn.disabled = true;
          try {
            for (const pm of curPending) {
              await apiFetch('/ops/missions/decision', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mission_id: pm.mission_id, decision: 'approve', feedback: '대시보드 대표 결재함 일괄 최종 승인' })
              });
            }
            lastApprovalCenterStamp = '';
            pollOrchestrator();
          } finally {
            approveAllBtn.disabled = false;
          }
        });
      }
    }

    const stamp = JSON.stringify({
      p: pendingList.map(m => [m.mission_id, m.updated_at]),
      r: runningList.map(m => [m.mission_id, (m.steps || []).length]),
      d: recentApproved.map(m => [m.mission_id, m.approved_at])
    });
    if (stamp === lastApprovalCenterStamp || listBox.contains(document.activeElement)) {
      return;
    }
    lastApprovalCenterStamp = stamp;

    if (pendingList.length === 0) {
      const runningNoticeHtml = runningList.length
        ? `<div style="padding:10px 13px;border-radius:9px;background:#eff6ff;border:1px solid #bfdbfe;color:#1e3a8a;font-size:11px;font-weight:700">⚡ 현재 <b>${runningList.length}개 팀</b>에서 프로젝트를 수행 중입니다 (${runningList.map(rm => `[${escHtml(rm.team_name || '팀')} · ${escHtml(rm.mission_id)}]`).join(', ')}). 파트 상호검토 후 통합보고가 도착하면 즉시 이곳에 결재 카드가 생성됩니다.</div>`
        : '';
      const recentHtml = recentApproved.length
        ? `<div style="display:flex;flex-direction:column;gap:5px;margin-top:4px"><span style="font-size:10px;font-weight:800;color:#64748b">최근 대표 최종 승인 완료 내역</span>${recentApproved.map(am => `<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:7px 10px;border-radius:8px;background:#f8fafc;border:1px solid #e2e8f0;font-size:10.5px"><span>✅ <b>[${escHtml(am.team_name || '기본팀')} · ${escHtml(am.mission_id)}]</b> ${escHtml(am.goal || '')}</span>${am.deliverable_file ? `<a href="${escHtml(am.deliverable_file)}" target="_blank" style="color:#0f6848;font-weight:800;white-space:nowrap">통합보고서 ↗</a>` : ''}</div>`).join('')}</div>`
        : '';
      listBox.innerHTML = `
        ${runningNoticeHtml}
        <div style="padding:16px;border-radius:10px;background:#f8fafc;border:1px dashed #cbd5e1;text-align:center;color:#475569;font-size:11.5px">
          현재 대표님의 최종 결재를 기다리는 미결 항목이 없습니다. 상단 <b>팀별 프로젝트 지시창</b>에서 팀마다 원하는 프로젝트를 실행해 보세요!
        </div>
        ${recentHtml}
      `;
      return;
    }

    listBox.innerHTML = pendingList.map(pm => {
      const tColor = pm.team_color || '#0f6848';
      const leadName = pm.lead_agent_name || '총괄팀장 AI';
      const genFiles = Array.isArray(pm.generated_files) ? pm.generated_files : [];
      const absDir = pm.project_dir_abs || pm.output_root || '';
      const reportTxt = pm.consolidated_report || pm.deliverable_preview || '전 파트 수행 및 파트장 상호검토가 완료되었습니다.';
      const filesHtml = genFiles.map(f =>
        `<a href="${escHtml(f)}" target="_blank" style="background:#eff6ff;border:1px solid #93c5fd;color:#1d4ed8;padding:4px 9px;border-radius:6px;font-size:10.5px;font-weight:800">📁 ${escHtml(f)} 미리보기 ↗</a>`
      ).join('') + (pm.deliverable_file
        ? `<a href="${escHtml(pm.deliverable_file)}" target="_blank" style="background:#f0fdf4;border:1px solid #86efac;color:#0f6848;padding:4px 9px;border-radius:6px;font-size:10.5px;font-weight:800">📄 통합보고서 전문(${escHtml(pm.deliverable_file)}) ↗</a>`
        : '');

      return `
        <div class="dash-approval-item-card" data-mid="${escHtml(pm.mission_id)}" style="padding:14px 16px;border-radius:12px;background:#ffffff;border:1.5px solid #f59e0b;border-left:5px solid ${escHtml(tColor)};box-shadow:0 6px 16px rgba(15,23,42,0.05);display:flex;flex-direction:column;gap:9px">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">
            <div style="display:flex;align-items:center;gap:7px;flex-wrap:wrap">
              <span style="background:${escHtml(tColor)}18;color:${escHtml(tColor)};border:1px solid ${escHtml(tColor)}44;padding:2px 8px;border-radius:6px;font-size:10.5px;font-weight:800">🏢 ${escHtml(pm.team_floor || '1F')} · ${escHtml(pm.team_name || '수행팀')}</span>
              <strong style="font-size:13px;color:#0f172a">[${escHtml(pm.mission_id)}] ${escHtml(pm.goal || '')}</strong>
              ${pm.deliverable_type_label ? `<span style="background:#eff6ff;color:#1d4ed8;padding:2px 7px;border-radius:5px;font-size:9.5px;font-weight:800">${escHtml(pm.deliverable_type_label)}</span>` : ''}
              ${Number(pm.resumed_count || 0) > 0 ? `<span style="background:#dcfce7;color:#15803d;padding:2px 7px;border-radius:5px;font-size:9.5px;font-weight:800">♻️ 서버 재기동 이어하기 완수 (#${Number(pm.resumed_count)})</span>` : ''}
            </div>
            <span style="background:#fef3c7;color:#92400e;padding:3px 9px;border-radius:999px;font-size:10px;font-weight:800">👑 ${escHtml(leadName)} 통합보고 · 결재 대기</span>
          </div>
          <div style="white-space:pre-wrap;padding:10px 12px;border-radius:8px;background:#f8fafc;border:1px solid #e2e8f0;font-size:11px;line-height:1.6;color:#1e293b;max-height:220px;overflow-y:auto">${escHtml(reportTxt)}</div>
          <div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center">
            ${filesHtml}
            ${absDir ? `<button type="button" class="btn small btn-dash-open-approval-dir" data-dir="${escHtml(absDir)}" style="height:27px;padding:0 9px;font-size:10px">🗂️ 로컬 산출물 폴더 열기</button>` : ''}
          </div>
          <div style="padding-top:8px;border-top:1px dashed #fcd34d;display:flex;gap:7px;align-items:center;flex-wrap:wrap">
            <button type="button" class="btn small primary btn-dash-card-approve" data-mid="${escHtml(pm.mission_id)}" style="height:34px;padding:0 15px;font-size:11.5px;background:#0f6848;border-color:#0f6848;font-weight:800">✅ 최종 승인 및 납품 확정</button>
            <input type="text" class="triad-goal-input inp-dash-card-feedback" data-mid="${escHtml(pm.mission_id)}" style="height:34px;font-size:11px;min-width:220px;flex:1;background:#fff" placeholder="보완 지시 사항 입력 후 [🔄 보완 재지시] 클릭 (또는 승인 메모 입력)">
            <button type="button" class="btn small btn-dash-card-revise" data-mid="${escHtml(pm.mission_id)}" style="height:34px;padding:0 13px;font-size:11px;background:#fff7ed;color:#c2410c;border-color:#fdba74;font-weight:800">🔄 총괄팀장에게 보완 재지시</button>
          </div>
        </div>
      `;
    }).join('');

    listBox.querySelectorAll('.btn-dash-open-approval-dir').forEach(b => {
      b.addEventListener('click', () => openLocalFolderExplorer(b.dataset.dir || '', '결재 대기 산출물 폴더'));
    });

    listBox.querySelectorAll('.btn-dash-card-approve').forEach(btn => {
      btn.addEventListener('click', async (ev) => {
        const b = ev.currentTarget;
        const mid = b.dataset.mid;
        const inp = listBox.querySelector(`.inp-dash-card-feedback[data-mid="${mid}"]`);
        const memo = (inp?.value || '').trim();
        b.disabled = true;
        b.textContent = '⏳ 최종 승인 반영 중...';
        try {
          await apiFetch('/ops/missions/decision', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mission_id: mid, decision: 'approve', feedback: memo })
          });
          lastApprovalCenterStamp = '';
          pollOrchestrator();
        } catch (_) {
          b.disabled = false;
          b.textContent = '✅ 최종 승인 및 납품 확정';
        }
      });
    });

    listBox.querySelectorAll('.btn-dash-card-revise').forEach(btn => {
      btn.addEventListener('click', async (ev) => {
        const b = ev.currentTarget;
        const mid = b.dataset.mid;
        const inp = listBox.querySelector(`.inp-dash-card-feedback[data-mid="${mid}"]`);
        let fb = (inp?.value || '').trim();
        if (!fb) {
          fb = (prompt('총괄팀장 및 파트 담당에게 전달할 보완 재지시 내용을 입력하세요:', '') || '').trim();
          if (!fb) return;
        }
        b.disabled = true;
        b.textContent = '⏳ 보완 재지시 전달 중...';
        try {
          await apiFetch('/ops/missions/decision', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mission_id: mid, decision: 'revise', feedback: fb })
          });
          lastApprovalCenterStamp = '';
          pollOrchestrator();
        } catch (_) {
          b.disabled = false;
          b.textContent = '🔄 총괄팀장에게 보완 재지시';
        }
      });
    });
  }

  function showAgentsPlacementFeedback(msg, isError = false) {
    const bar = document.getElementById('agentsPlacementFeedbackBar');
    if (!bar) return;
    bar.style.display = 'block';
    bar.style.background = isError ? '#fef2f2' : '#f0fdf4';
    bar.style.borderColor = isError ? '#fecaca' : '#86efac';
    bar.style.color = isError ? '#b91c1c' : '#15803d';
    bar.textContent = msg;
  }

  async function assignAgentToTeamAndPlace(agentId, teamId, mode = 'move', customFloor = null, customSeat = null) {
    try {
      const res = await apiFetch('/ops/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'assign_member',
          agent_id: agentId,
          team_id: teamId || '',
          mode,
          floor: customFloor || undefined
        })
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        showAgentsPlacementFeedback(`❌ ${d.error || '팀 배정 실패'}`, true);
        return false;
      }
      const teams = d.teams_summary?.teams || latestTeamsSummary?.teams || [];
      const targetTeam = teamId ? teams.find(t => t.id === teamId) : null;
      if (mode !== 'remove' && (targetTeam || customFloor || customSeat !== null)) {
        const destFloor = customFloor || targetTeam?.floor || '1F';
        const plc = syncAgentOfficePlacement(agentId, destFloor, customSeat, true);
        const agObj = modularAgents.find(a => a.id === agentId) || ALL_AGENT_PRESETS.find(a => a.id === agentId);
        const agName = agObj?.name || `#${agentId}`;
        showAgentsPlacementFeedback(
          targetTeam
            ? `✓ [${agName}] 직원이 [${targetTeam.name}] 팀에 배정되고 가상 오피스 ${plc.floorStr} · #${plc.seatIndex + 1}번석에 배치되었습니다!`
            : `✓ [${agName}] 직원의 오피스 배치가 ${plc.floorStr} · #${plc.seatIndex + 1}번석으로 변경되었습니다.`
        );
      } else if (mode === 'remove') {
        showAgentsPlacementFeedback('✓ 선택한 직원을 해당 팀에서 제외했습니다.');
      }
      if (d.teams_summary) renderTeamsAndWorkspacesDashboard(d.teams_summary);
      return true;
    } catch (_) {
      showAgentsPlacementFeedback('❌ 서버 통신 오류가 발생했습니다.', true);
      return false;
    }
  }

  function renderAgentsTeamPlacementBoard(ts, forceRender = false) {
    renderConfiguredTeamsAndMembersSection(ts, forceRender);
    renderConfiguredAgentsRoster(forceRender);
    const boardEl = document.getElementById('agentsTeamCardsBoard');
    const tbodyEl = document.getElementById('agentsPlacementTableBody');
    const countBadge = document.getElementById('agentsTeamsCountBadge');
    if (!boardEl && !tbodyEl) return;

    const teams = Array.isArray(ts?.teams) ? ts.teams : [];
    if (countBadge) {
      countBadge.textContent = `등록 팀 ${teams.length}개 · 활성 직원 ${modularAgents.length}명`;
    }

    const agentsBoardSig = JSON.stringify([
      teams,
      modularAgents.map(a => [a.id, a.name, a.triadRole, a.orgRank, a.cliProvider, a.cliModel]),
      lastDiagnostics?.checked_at || ''
    ]);
    if (
      !forceRender &&
      agentsBoardSig === lastAgentsBoardHash &&
      (!boardEl || boardEl.children.length === teams.length)
    ) {
      return;
    }
    if (
      !forceRender &&
      ((boardEl && boardEl.contains(document.activeElement)) || (tbodyEl && tbodyEl.contains(document.activeElement)))
    ) {
      return;
    }
    lastAgentsBoardHash = agentsBoardSig;

    const placementsMap = loadOfficePlacementsMap();

    // [A] Render Team Cards + Drag-and-Drop Dropzones on agents.html
    if (boardEl) {
      boardEl.innerHTML = teams.map(t => {
        const color = t.color || '#0f6848';
        const ws = t.workspace_status || {};
        const memIds = Array.isArray(t.member_ids) ? t.member_ids : [];

        const memberPillsHtml = memIds.map(mid => {
          const baseAg = modularAgents.find(a => a.id === mid) || ALL_AGENT_PRESETS.find(a => a.id === mid) || { id: mid, name: `Agent #${mid}`, triadRole: 'BUILDER', floor: t.floor };
          const cfg = savedCharAiConfigs[mid] || {};
          const merged = { ...baseAg, ...cfg };
          const plc = getAgentOfficePlacement(mid, merged.floor || t.floor);
          return `
            <div class="agents-member-pill" draggable="true" data-drag-aid="${escHtml(mid)}" data-select-aid="${escHtml(mid)}" title="클릭하여 하단 스튜디오에서 편집 · 드래그하여 다른 팀으로 이동">
              <span style="width:22px;height:26px;display:inline-flex;align-items:center;justify-content:center">${CharacterEngine.render(merged)}</span>
              <span><b style="color:${escHtml(color)}">#${escHtml(mid)}</b> ${escHtml(merged.name)}</span>
              <span style="background:#eef2f6;color:#475569;padding:1px 5px;border-radius:4px;font-size:8.5px;font-weight:800">${escHtml(plc.floorStr)}·#${plc.seatIndex + 1}석</span>
              ${memIds.length > 1 ? `<button type="button" class="remove-mem-btn" data-rem-tid="${escHtml(t.id)}" data-rem-aid="${escHtml(mid)}" title="이 팀에서 제외">✕</button>` : ''}
            </div>
          `;
        }).join('');

        const availableAgents = modularAgents.filter(a => !memIds.includes(a.id));
        const quickAddOptions = [
          `<option value="">＋ 이 팀에 합류시킬 직원 선택...</option>`,
          ...availableAgents.map(a => `<option value="${escHtml(a.id)}">#${escHtml(a.id)} ${escHtml(a.name)} (${escHtml(a.triadRole || 'AGENT')})</option>`),
          ...(modularAgents.length < ALL_AGENT_PRESETS.length ? [`<option value="__recruit_new__">✨ 새 AI 직원 충원 후 이 팀에 즉시 배치</option>`] : [])
        ].join('');

        return `
          <div class="agents-team-dropcard" data-drop-tid="${escHtml(t.id)}" style="border-left-color:${escHtml(color)}">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;flex-wrap:wrap">
              <div>
                <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
                  <span class="team-floor-pill" style="border-color:${escHtml(color)}44;color:${escHtml(color)}">🏢 ${escHtml(t.floor)}</span>
                  <strong style="font-size:13px;color:#0f172a">${escHtml(t.name)}</strong>
                  ${t.is_active
            ? '<span class="team-active-pill">★ 기본 팀</span>'
            : `<button type="button" class="btn small btn-ag-set-active" data-tid="${escHtml(t.id)}" style="height:21px;padding:0 7px;font-size:9.5px">기본 팀 지정</button>`}
                  ${t.orchestrator_mode === 'carbon'
            ? '<span class="orch-tier-pill ultra">💎 Carbon</span>'
            : t.orchestrator_mode === 'argon'
              ? '<span class="orch-tier-pill pro">🔷 Argon</span>'
              : ''}
                </div>
                <div style="font-size:10px;color:${ws.is_cloud_primary ? '#0284c7' : '#64748b'};margin-top:3px;font-family:var(--font-mono);word-break:break-all">${ws.is_cloud_primary ? `☁️ 웹 폴더: <a href="${escHtml(ws.gdrive_direct?.folder_url || '')}" target="_blank" rel="noopener" style="color:#0284c7;text-decoration:underline">${escHtml(ws.gdrive_direct?.folder_url || '')}</a>` : `📂 폴더: ${escHtml(ws.effective_dir || 'deliverables/')}`}</div>
              </div>
              <div style="display:flex;gap:5px;align-items:center">
                <button type="button" class="btn small btn-ag-open-dir" data-tid="${escHtml(t.id)}" data-tname="${escHtml(t.name)}" data-dir="${escHtml(ws.effective_dir || '')}" data-cloud-url="${ws.is_cloud_primary ? escHtml(ws.gdrive_direct?.folder_url || '') : ''}" style="height:25px;padding:0 8px;font-size:9.5px">${ws.is_cloud_primary ? '☁️ 웹 폴더 ↗' : '🗂️ 폴더'}</button>
                <button type="button" class="btn small btn-ag-edit-team" data-tid="${escHtml(t.id)}" style="height:25px;padding:0 9px;font-size:9.5px;background:#f0fdf4;color:#0f6848;border-color:#86efac">✏️ 팀 수정</button>
                ${teams.length > 1 ? `<button type="button" class="btn small btn-ag-del-team" data-tid="${escHtml(t.id)}" data-tname="${escHtml(t.name)}" style="height:25px;padding:0 7px;font-size:9.5px;background:#fef2f2;color:#dc2626;border-color:#fecaca" title="팀 삭제">🗑</button>` : ''}
              </div>
            </div>

            <div style="display:flex;flex-wrap:wrap;gap:6px;padding:8px;border-radius:9px;background:#f8fafc;border:1px dashed #cbd5e1;min-height:44px;align-items:center">
              ${memberPillsHtml || '<span style="font-size:10px;color:#94a3b8">직원을 이 카드로 드래그하거나 아래에서 선택해 배치하세요.</span>'}
            </div>

            <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
              <select class="triad-cli-select sel-ag-quick-assign" data-tid="${escHtml(t.id)}" style="height:29px;font-size:10.5px;flex:1;min-width:170px;background:#fff">${quickAddOptions}</select>
              <button type="button" class="btn small primary btn-ag-quick-assign" data-tid="${escHtml(t.id)}" style="height:29px;padding:0 10px;font-size:10px;background:${escHtml(color)};border-color:${escHtml(color)}">＋ 팀 합류 &amp; ${escHtml(t.floor)} 배치</button>
            </div>
          </div>
        `;
      }).join('');

      // Drag-and-drop & button bindings on Team Cards
      boardEl.querySelectorAll('[data-drag-aid]').forEach(pill => {
        pill.addEventListener('dragstart', (ev) => {
          ev.dataTransfer.setData('text/plain', pill.dataset.dragAid);
          ev.dataTransfer.effectAllowed = 'move';
        });
        pill.addEventListener('click', (ev) => {
          if (ev.target.closest('.remove-mem-btn')) return;
          if (studioSelectAgentFn) studioSelectAgentFn(pill.dataset.selectAid, true);
        });
      });

      boardEl.querySelectorAll('.remove-mem-btn').forEach(btn => {
        btn.addEventListener('click', (ev) => {
          ev.stopPropagation();
          assignAgentToTeamAndPlace(btn.dataset.remAid, btn.dataset.remTid, 'remove');
        });
      });

      boardEl.querySelectorAll('.agents-team-dropcard').forEach(card => {
        card.addEventListener('dragover', (ev) => {
          ev.preventDefault();
          card.classList.add('is-drag-over');
        });
        card.addEventListener('dragleave', () => card.classList.remove('is-drag-over'));
        card.addEventListener('drop', (ev) => {
          ev.preventDefault();
          card.classList.remove('is-drag-over');
          const aid = (ev.dataTransfer.getData('text/plain') || '').trim();
          const tid = card.dataset.dropTid;
          if (aid && tid) {
            assignAgentToTeamAndPlace(aid, tid, 'add');
          }
        });
      });

      boardEl.querySelectorAll('.btn-ag-edit-team').forEach(b => {
        b.addEventListener('click', () => openTeamBuilderModal(b.dataset.tid));
      });
      boardEl.querySelectorAll('.btn-ag-open-dir').forEach(b => {
        b.addEventListener('click', () => {
          if (b.dataset.cloudUrl) {
            window.open(b.dataset.cloudUrl, '_blank', 'noopener');
            return;
          }
          openLocalFolderExplorer(b.dataset.dir || '', b.dataset.tname || '', b.dataset.tid || null);
        });
      });
      boardEl.querySelectorAll('.btn-ag-set-active').forEach(b => {
        b.addEventListener('click', async () => {
          b.disabled = true;
          try {
            const r = await apiFetch('/ops/teams', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'set_active', team_id: b.dataset.tid })
            });
            const d = await r.json().catch(() => ({}));
            if (d.teams_summary) renderTeamsAndWorkspacesDashboard(d.teams_summary);
          } catch (_) { b.disabled = false; }
        });
      });
      boardEl.querySelectorAll('.btn-ag-del-team').forEach(b => {
        b.addEventListener('click', async () => {
          if (!confirm(`[${b.dataset.tname}] 팀을 삭제하시겠습니까? (작업 폴더 내 파일은 그대로 보존됩니다.)`)) return;
          b.disabled = true;
          try {
            const r = await apiFetch('/ops/teams', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'delete', team_id: b.dataset.tid })
            });
            const d = await r.json().catch(() => ({}));
            if (r.ok && d.teams_summary) {
              renderTeamsAndWorkspacesDashboard(d.teams_summary);
              showAgentsPlacementFeedback(`✓ [${b.dataset.tname}] 팀이 삭제되었습니다.`);
            } else {
              showAgentsPlacementFeedback(`❌ ${d.error || '삭제 실패'}`, true);
              b.disabled = false;
            }
          } catch (_) { b.disabled = false; }
        });
      });
      boardEl.querySelectorAll('.btn-ag-quick-assign').forEach(btn => {
        btn.addEventListener('click', async () => {
          const tid = btn.dataset.tid;
          const sel = boardEl.querySelector(`.sel-ag-quick-assign[data-tid="${tid}"]`);
          let aid = sel?.value || '';
          if (!aid) {
            showAgentsPlacementFeedback('합류시킬 AI 직원을 먼저 드롭다운에서 선택해 주세요.', true);
            return;
          }
          if (aid === '__recruit_new__') {
            if (modularAgents.length >= ALL_AGENT_PRESETS.length) return;
            const nextAg = ALL_AGENT_PRESETS[modularAgents.length];
            modularAgents.push(nextAg);
            try { localStorage.setItem(ACTIVE_AGENT_COUNT_KEY, String(modularAgents.length)); } catch (_) { }
            aid = nextAg.id;
          }
          await assignAgentToTeamAndPlace(aid, tid, 'add');
        });
      });
    }

    // [B] Render Full AI Staff Team Assignment Matrix (#agentsPlacementTableBody) — without Floor / Seat columns
    if (tbodyEl) {
      tbodyEl.innerHTML = modularAgents.map(ag => {
        const belongTeams = teams.filter(t => Array.isArray(t.member_ids) && t.member_ids.includes(ag.id));
        const primaryTid = belongTeams[0]?.id || '';
        const cliKey = ag.cliProvider || 'claude';
        const cliLbl = CLI_BADGE_LABELS[cliKey] || cliKey;
        const provDiag = lastDiagnostics?.providers?.[cliKey] || null;
        const agModelDisp = ag.cliModel
          ? ((provDiag?.available_models || []).find(m => m.id === ag.cliModel)?.name || ag.cliModel)
          : (provDiag?.selected_model_display || '계정 기본 모델');

        const teamOpts = [
          `<option value="" ${!primaryTid ? 'selected' : ''}>— 미배정 —</option>`,
          ...teams.map(t => `<option value="${escHtml(t.id)}" ${t.id === primaryTid ? 'selected' : ''}>🏢 [${escHtml(t.floor)}] ${escHtml(t.name)}</option>`),
          `<option value="__new_team__">➕ 새 팀 만들어 배정...</option>`
        ].join('');

        return `
          <tr draggable="true" data-row-drag-aid="${escHtml(ag.id)}">
            <td>
              <div style="display:flex;align-items:center;gap:8px;cursor:grab">
                <span style="color:#94a3b8;font-size:12px" title="드래그하여 위 팀 카드에 놓기">⋮⋮</span>
                <div style="width:30px;height:34px;flex-shrink:0">${CharacterEngine.render(ag)}</div>
                <div>
                  <div style="font-weight:800;color:#0f172a">#${escHtml(ag.id)} ${escHtml(ag.name)}</div>
                  ${belongTeams.length > 1 ? `<div style="font-size:9px;color:#0284c7;font-weight:700">겸임: ${belongTeams.map(x => escHtml(x.name)).join(', ')}</div>` : ''}
                </div>
              </div>
            </td>
            <td>
              <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
                <select class="triad-cli-select sel-row-rank" data-aid="${escHtml(ag.id)}" style="height:27px;font-size:10px;font-weight:800;background:#fff" aria-label="직급 선택">
                  <option value="LEAD" ${(ag.orgRank === 'LEAD' || ag.triadRole === 'LEAD') ? 'selected' : ''}>👑 총괄팀장</option>
                  <option value="PART_LEAD" ${(ag.orgRank !== 'LEAD' && ag.orgRank !== 'STAFF' && ag.triadRole !== 'LEAD') ? 'selected' : ''}>⭐ 파트장</option>
                  <option value="STAFF" ${ag.orgRank === 'STAFF' ? 'selected' : ''}>👤 일반사원</option>
                </select>
                <span class="char-cli-badge ${escHtml(cliKey)}" style="margin:0">${escHtml(ag.triadRole || 'PART_BUILD')} · ${escHtml(cliLbl)}</span>
                <select class="triad-cli-select sel-row-model" data-aid="${escHtml(ag.id)}" style="height:27px;font-size:10px;font-weight:700;background:#f0fdf4;border-color:#86efac;color:#0f172a;min-width:195px" aria-label="세부 실행 모델 선택">
                  ${buildSdkModelOptionsHtml(ag.cliModel, cliKey)}
                </select>
              </div>
            </td>
            <td>
              <select class="triad-cli-select sel-row-team" data-aid="${escHtml(ag.id)}" style="height:29px;font-size:10.5px;background:#fff;min-width:190px">${teamOpts}</select>
            </td>
            <td>
              <div style="display:flex;gap:5px;align-items:center">
                <button type="button" class="btn small btn-row-focus-studio" data-aid="${escHtml(ag.id)}" style="height:26px;padding:0 8px;font-size:9.5px">⚙ 실행모델·페르소나 편집 ↓</button>
                <a href="office.html" class="btn small" style="height:26px;padding:0 8px;font-size:9.5px;background:#f0f9ff;color:#0369a1;border-color:#7dd3fc">⬡ 오피스 ↗</a>
              </div>
            </td>
          </tr>
        `;
      }).join('');

      tbodyEl.querySelectorAll('[data-row-drag-aid]').forEach(row => {
        row.addEventListener('dragstart', (ev) => {
          ev.dataTransfer.setData('text/plain', row.dataset.rowDragAid);
          ev.dataTransfer.effectAllowed = 'move';
        });
      });
      tbodyEl.querySelectorAll('.sel-row-team').forEach(sel => {
        sel.addEventListener('change', async () => {
          const aid = sel.dataset.aid;
          const val = sel.value;
          if (val === '__new_team__') {
            renderAgentsTeamPlacementBoard(ts);
            openTeamBuilderModal(null);
            return;
          }
          await assignAgentToTeamAndPlace(aid, val, 'move');
        });
      });
      tbodyEl.querySelectorAll('.sel-row-rank').forEach(sel => {
        sel.addEventListener('change', async () => {
          await applyQuickAgentModelOrRank(sel.dataset.aid, { orgRank: sel.value }, 'table');
        });
      });
      tbodyEl.querySelectorAll('.sel-row-model').forEach(sel => {
        sel.addEventListener('change', async () => {
          await applyQuickAgentModelOrRank(sel.dataset.aid, { cliModel: sel.value }, 'table');
        });
      });
      tbodyEl.querySelectorAll('.btn-row-focus-studio').forEach(btn => {
        btn.addEventListener('click', () => {
          if (studioSelectAgentFn) studioSelectAgentFn(btn.dataset.aid, true);
        });
      });
    }
  }

  function ensureTeamBuilderModal() {
    if (document.getElementById('teamBuilderModalBackdrop')) return;
    const wrap = document.createElement('div');
    wrap.id = 'teamBuilderModalBackdrop';
    wrap.className = 'cli-modal-backdrop';
    wrap.innerHTML = `
      <div class="cli-modal" role="dialog" aria-modal="true" aria-labelledby="tbModalTitle" style="max-width:840px">
        <div class="cli-modal-head">
          <div>
            <div class="eyebrow" style="color:#0f6848">TEAM BUILDER &amp; DEDICATED WORKSPACE</div>
            <h2 id="tbModalTitle">🏢 팀 구성 &amp; 팀별 전용 작업 폴더 설정</h2>
            <p>팀 이름·오피스 담당 층·소속 AI 직원·팀 전용 역할 CLI 및 로컬/Google Drive 클라우드 작업 폴더를 한 번에 구성합니다.</p>
          </div>
          <button type="button" class="cli-modal-close" id="btnCloseTeamModal" aria-label="닫기">✕</button>
        </div>
        <div class="cli-modal-body" style="gap:13px">
          <input type="hidden" id="tbTeamIdInput" value="">

          <!-- 1. 기본 정보 & 담당 층 -->
          <div style="display:grid;grid-template-columns:minmax(0,1.4fr) 125px 110px;gap:10px;align-items:end">
            <label class="studio-field">
              <span>팀 이름 (필수)</span>
              <input type="text" id="tbNameInput" class="triad-goal-input" style="height:35px;background:#fff" placeholder="예: 모바일 앱 개발팀, 데이터 자동화팀">
            </label>
            <label class="studio-field">
              <span>가상 오피스 담당 층</span>
              <select id="tbFloorSelect" class="triad-cli-select" style="height:35px;background:#fff">
                <option value="1F">1F 본부·전략</option>
                <option value="2F">2F 프런트·기획</option>
                <option value="3F">3F 개발·R&amp;D</option>
                <option value="4F">4F 디자인·검증</option>
                <option value="5F">5F 마케팅·자동화</option>
                <option value="6F">6F 데이터·인프라</option>
                <option value="7F">7F 보안·감사</option>
                <option value="8F">8F 서비스 운영</option>
                <option value="9F">9F 심층 연구</option>
                <option value="10F">10F 글로벌 신규</option>
              </select>
            </label>
            <label class="studio-field">
              <span>팀 테마 색상</span>
              <select id="tbColorSelect" class="triad-cli-select" style="height:35px;background:#fff">
                <option value="#0f6848">🟢 에메랄드</option>
                <option value="#0284c7">🔵 스카이블루</option>
                <option value="#7c3aed">🟣 바이올렛</option>
                <option value="#ea580c">🟠 앰버오렌지</option>
                <option value="#be123c">🔴 로즈레드</option>
                <option value="#1e293b">⚫ 슬레이트</option>
              </select>
            </label>
          </div>

          <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">
            <input type="text" id="tbDescInput" class="triad-goal-input" style="height:33px;flex:1;min-width:240px;background:#fff;font-size:11.5px" placeholder="팀 역할이나 담당 프로젝트 설명 (선택)">
            <label style="display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:700;color:#334155;cursor:pointer">
              <input type="checkbox" id="tbSyncFloorChk" checked style="accent-color:#0f6848">
              <span>저장 시 소속 직원의 오피스 배치 층도 함께 이동</span>
            </label>
          </div>

          <!-- 2. 소속 AI 직원 선택 -->
          <div style="padding:11px 13px;border-radius:11px;background:#f8fafc;border:1px solid #cbd5e1;display:flex;flex-direction:column;gap:8px">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">
              <strong style="font-size:11.5px;color:#0f172a">👥 소속 AI 직원(캐릭터) 선택 <span id="tbSelectedMemberCount" style="color:#0f6848">(0명 선택됨)</span></strong>
              <span style="font-size:10px;color:#64748b">클릭하여 이 팀에 합류할 AI 직원을 편성하세요.</span>
            </div>
            <div class="team-member-pick-grid" id="tbMembersGrid"></div>
          </div>

          <!-- 3. 팀 전용 Triad 역할 CLI 배정 & 오케스트레이터 엔진 -->
          <div style="padding:11px 13px;border-radius:11px;background:#ffffff;border:1px solid #e2e8f0;display:flex;flex-direction:column;gap:8px">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">
              <strong style="font-size:11.5px;color:#0f172a">⚙️ 팀 전용 파이프라인 역할 CLI &amp; 오케스트레이터 배정</strong>
              <label style="display:inline-flex;align-items:center;gap:6px;font-size:10.5px;font-weight:800;color:#1e293b">
                <span>🧠 오케스트레이터:</span>
                <select id="tbOrchestratorSelect" class="triad-cli-select" style="height:29px;min-width:230px;background:#f8fafc"></select>
              </label>
            </div>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px">
              <label class="studio-field"><span>👑 HEAD (계획·판정)</span><select id="tbRoleHead" class="triad-cli-select" style="height:31px"></select></label>
              <label class="studio-field"><span>🛠 BUILDER (구현 1)</span><select id="tbRoleBuilder" class="triad-cli-select" style="height:31px"></select></label>
              <label class="studio-field"><span>✨ SUB-BUILDER (구현 2)</span><select id="tbRoleSubBuilder" class="triad-cli-select" style="height:31px"></select></label>
              <label class="studio-field"><span>🔍 REVIEWER (독립 검수)</span><select id="tbRoleReviewer" class="triad-cli-select" style="height:31px"></select></label>
              <label class="studio-field"><span>⚡ RESEARCHER (추론)</span><select id="tbRoleResearcher" class="triad-cli-select" style="height:31px"></select></label>
            </div>
          </div>

          <!-- 4. 팀 전용 작업 폴더 지정 (로컬 + Google Drive 직접 연결) -->
          <div style="padding:12px 14px;border-radius:11px;background:#f0fdf4;border:1px solid #86efac;display:flex;flex-direction:column;gap:9px">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">
              <strong style="font-size:12px;color:#0f6848">📂 팀 전용 작업 폴더 지정 (로컬 디스크 &amp; Google Drive)</strong>
              <label style="display:inline-flex;align-items:center;gap:5px;font-size:10.5px;color:#166534;cursor:pointer">
                <input type="checkbox" id="tbMirrorChk" style="accent-color:#0f6848">
                <span>기본 <code>deliverables/</code>에도 백업 사본 보관</span>
              </label>
            </div>
            <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
              <input type="text" id="tbLocalDirInput" class="triad-goal-input" style="height:34px;flex:1;min-width:240px;background:#fff;font-size:11.5px" placeholder="비워두면 deliverables/ 기본 폴더 · 예: D:\\Projects\\TeamApp 또는 deliverables/team_app">
              <button type="button" class="btn small" id="btnTbBrowseLocal" style="height:34px;background:#fff">📂 내 PC 찾아보기</button>
              <button type="button" class="btn small" id="btnTbBrowseMountedGd" style="height:34px;background:#e0f2fe;color:#0369a1;border-color:#7dd3fc">📂 로컬 드라이브(F:) 선택</button>
            </div>

            <div style="padding:9px 11px;border-radius:9px;background:#f0f9ff;border:1px solid #bae6fd;display:flex;flex-direction:column;gap:7px">
              <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">
                <label style="display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:800;color:#0369a1;cursor:pointer">
                  <input type="checkbox" id="tbGdEnabledChk" style="accent-color:#0284c7">
                  <span>☁️ Google Drive 클라우드 폴더에 이 팀 산출물 자동 업로드</span>
                </label>
                <button type="button" class="btn small" id="btnTbOpenGdAuth" style="height:25px;padding:0 9px;font-size:10px;background:#fff;color:#0284c7;border-color:#7dd3fc">🔑 구글 계정 연결 / 클라우드 탐색기</button>
              </div>
              <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
                <input type="text" id="tbGdFolderInput" class="triad-goal-input" style="height:32px;flex:1;min-width:220px;background:#fff;font-size:11px" placeholder="클라우드 폴더 URL(https://drive.google.com/drive/folders/...) 또는 폴더 ID (기본: root)">
                <span id="tbGdFolderNameBadge" style="font-size:10.5px;font-weight:700;color:#0c4a6e">현재: 내 드라이브 (루트)</span>
              </div>
            </div>
          </div>

          <div id="tbModalFeedback" style="font-size:11.5px;font-weight:700;color:#0f6848;min-height:16px"></div>
        </div>
        <div class="cli-modal-foot">
          <div>
            <button type="button" class="btn small" id="btnTbDeleteTeam" style="display:none;background:#fef2f2;color:#dc2626;border-color:#fecaca">🗑 이 팀 삭제</button>
          </div>
          <div style="display:flex;gap:8px;align-items:center">
            <label style="display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:700;color:#334155;cursor:pointer">
              <input type="checkbox" id="tbSetActiveChk" checked style="accent-color:#0f6848">
              <span>저장 후 기본 작업 팀으로 지정</span>
            </label>
            <button type="button" class="btn small" id="btnCancelTeamModal">취소</button>
            <button type="button" class="btn small primary" id="btnSaveTeamModal" style="background:#0f6848;border-color:#0f6848;padding:7px 16px">💾 팀 구성 &amp; 작업 폴더 저장</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(wrap);

    const close = () => wrap.classList.remove('open');
    document.getElementById('btnCloseTeamModal')?.addEventListener('click', close);
    document.getElementById('btnCancelTeamModal')?.addEventListener('click', close);
    wrap.addEventListener('click', (ev) => { if (ev.target === wrap) close(); });

    document.getElementById('btnTbOpenGdAuth')?.addEventListener('click', () => {
      openGdriveDirectModal();
    });

    const applyTbPickedFolder = (chosenDir, gdFolder = null) => {
      const locInp = document.getElementById('tbLocalDirInput');
      const gdChk = document.getElementById('tbGdEnabledChk');
      const gdInp = document.getElementById('tbGdFolderInput');
      const gdBadge = document.getElementById('tbGdFolderNameBadge');
      const fb = document.getElementById('tbModalFeedback');
      if (gdFolder) {
        if (locInp) locInp.value = '';
        if (gdChk) gdChk.checked = true;
        if (gdInp) gdInp.value = gdFolder.id === 'root' ? 'https://drive.google.com/drive/my-drive' : (gdFolder.webViewLink || gdFolder.id);
        if (gdBadge) gdBadge.textContent = `현재: ${gdFolder.name || '내 드라이브 (루트)'}`;
        if (fb) {
          fb.style.color = '#0369a1';
          fb.textContent = `☁️ 선택한 Google Drive 폴더가 웹 주소(${gdFolder.webViewLink})로 연결되도록 설정되었습니다.`;
        }
      } else {
        if (locInp) locInp.value = chosenDir;
      }
    };

    document.getElementById('btnTbBrowseLocal')?.addEventListener('click', () => {
      const curDir = document.getElementById('tbLocalDirInput')?.value || '';
      const tName = document.getElementById('tbNameInput')?.value || '';
      openLocalFolderPicker({
        initialDir: curDir,
        teamName: tName,
        onPicked: applyTbPickedFolder
      });
    });

    document.getElementById('btnTbBrowseMountedGd')?.addEventListener('click', () => {
      const gdRoot = (latestOutputDirStatus?.detected_google_drives?.[0]?.root) || '';
      const tName = document.getElementById('tbNameInput')?.value || '';
      openLocalFolderPicker({
        initialDir: gdRoot,
        teamName: tName,
        onPicked: applyTbPickedFolder
      });
    });

    document.getElementById('btnTbDeleteTeam')?.addEventListener('click', async (ev) => {
      const tid = document.getElementById('tbTeamIdInput')?.value || '';
      if (!tid) return;
      if (!confirm('이 팀 구성을 삭제하시겠습니까? (생성된 실제 로컬/클라우드 파일은 삭제되지 않습니다.)')) return;
      const btn = ev.currentTarget;
      btn.disabled = true;
      try {
        const res = await apiFetch('/ops/teams', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'delete', team_id: tid })
        });
        const d = await res.json().catch(() => ({}));
        if (res.ok && d.teams_summary) {
          renderTeamsAndWorkspacesDashboard(d.teams_summary, true);
          close();
        } else {
          const fb = document.getElementById('tbModalFeedback');
          if (fb) { fb.style.color = '#dc2626'; fb.textContent = `❌ ${d.error || '삭제 실패'}`; }
        }
      } catch (_) { } finally {
        btn.disabled = false;
      }
    });

    document.getElementById('btnSaveTeamModal')?.addEventListener('click', async (ev) => {
      const btn = ev.currentTarget;
      const fb = document.getElementById('tbModalFeedback');
      const tid = document.getElementById('tbTeamIdInput')?.value || '';
      const nameVal = (document.getElementById('tbNameInput')?.value || '').trim();
      if (!nameVal) {
        if (fb) { fb.style.color = '#dc2626'; fb.textContent = '❌ 팀 이름을 입력해 주세요.'; }
        return;
      }
      const selectedMembers = Array.from(document.querySelectorAll('#tbMembersGrid .team-member-pick-card.selected'))
        .map(el => el.dataset.aid)
        .filter(Boolean);
      if (selectedMembers.length === 0) {
        if (fb) { fb.style.color = '#dc2626'; fb.textContent = '❌ 최소 1명 이상의 소속 AI 직원을 선택해 주세요.'; }
        return;
      }

      const floorVal = document.getElementById('tbFloorSelect')?.value || '1F';
      const syncFloor = Boolean(document.getElementById('tbSyncFloorChk')?.checked);
      const gdInputVal = (document.getElementById('tbGdFolderInput')?.value || '').trim();

      const payload = {
        action: 'save',
        team: {
          id: tid || undefined,
          name: nameVal,
          description: (document.getElementById('tbDescInput')?.value || '').trim(),
          floor: floorVal,
          color: document.getElementById('tbColorSelect')?.value || '#0f6848',
          orchestrator_mode: document.getElementById('tbOrchestratorSelect')?.value || 'auto',
          member_ids: selectedMembers,
          roles: {
            head: document.getElementById('tbRoleHead')?.value || 'claude',
            builder: document.getElementById('tbRoleBuilder')?.value || 'antigravity',
            sub_builder: document.getElementById('tbRoleSubBuilder')?.value || 'gemini',
            reviewer: document.getElementById('tbRoleReviewer')?.value || 'openai',
            researcher: document.getElementById('tbRoleResearcher')?.value || 'grok'
          },
          workspace: {
            output_dir: (document.getElementById('tbLocalDirInput')?.value || '').trim(),
            mirror_to_local: Boolean(document.getElementById('tbMirrorChk')?.checked),
            gdrive_direct_enabled: Boolean(document.getElementById('tbGdEnabledChk')?.checked),
            ...(gdInputVal ? { gdrive_folder_input: gdInputVal } : {})
          },
          sync_floor_to_members: syncFloor,
          set_active: Boolean(document.getElementById('tbSetActiveChk')?.checked)
        }
      };

      const origTxt = btn.textContent;
      btn.disabled = true;
      btn.textContent = '저장 중...';
      try {
        const res = await apiFetch('/ops/teams', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const d = await res.json().catch(() => ({}));
        if (!res.ok) {
          if (fb) { fb.style.color = '#dc2626'; fb.textContent = `❌ ${d.error || '팀 저장 실패'}`; }
          return;
        }
        // Sync member floor & seat placements in localStorage if requested so office.html reflects immediately
        if (syncFloor && d.saved_team) {
          try {
            selectedMembers.forEach(aid => {
              syncAgentOfficePlacement(aid, floorVal, null, false);
            });
            fetch('/ops/character-config', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ configs: savedCharAiConfigs })
            }).catch(() => { });
          } catch (_) { }
        }
        if (d.teams_summary) {
          renderTeamsAndWorkspacesDashboard(d.teams_summary, true);
          if (d.saved_team) {
            const sel = document.getElementById('triadTeamSelect');
            if (sel) sel.value = d.saved_team.id;
            syncSettingsBarFromTeam(d.saved_team.id, `✓ [${d.saved_team.name}] 팀 및 작업 폴더 설정이 저장되었습니다.`);
          }
        }
        close();
      } catch (_) {
        if (fb) { fb.style.color = '#dc2626'; fb.textContent = '❌ 서버 통신 오류가 발생했습니다.'; }
      } finally {
        btn.disabled = false;
        btn.textContent = origTxt;
      }
    });
  }

  function openTeamBuilderModal(editTeamId = null, prefillDir = '') {
    ensureTeamBuilderModal();
    const modal = document.getElementById('teamBuilderModalBackdrop');
    const fb = document.getElementById('tbModalFeedback');
    if (fb) fb.textContent = '';

    const teams = latestTeamsSummary?.teams || [];
    const existing = editTeamId ? teams.find(t => t.id === editTeamId) : null;

    document.getElementById('tbModalTitle').textContent = existing
      ? `🏢 [${existing.name}] 팀 구성 & 전용 작업 폴더 편집`
      : '🏢 새 팀 구성 & 전용 작업 폴더 지정';
    document.getElementById('tbTeamIdInput').value = existing ? existing.id : '';
    document.getElementById('tbNameInput').value = existing ? existing.name : '';
    document.getElementById('tbDescInput').value = existing ? (existing.description || '') : '';
    document.getElementById('tbFloorSelect').value = existing ? (existing.floor || '1F') : '3F';
    document.getElementById('tbColorSelect').value = existing ? (existing.color || '#0f6848') : '#0284c7';
    document.getElementById('tbLocalDirInput').value = existing
      ? (existing.workspace?.output_dir || '')
      : (prefillDir || '');
    document.getElementById('tbMirrorChk').checked = Boolean(existing?.workspace?.mirror_to_local);
    document.getElementById('tbGdEnabledChk').checked = Boolean(existing?.workspace?.gdrive_direct_enabled);
    document.getElementById('tbGdFolderInput').value = existing?.workspace?.gdrive_folder_id && existing.workspace.gdrive_folder_id !== 'root'
      ? (existing.workspace.gdrive_folder_url || existing.workspace.gdrive_folder_id)
      : '';
    const gdNameBadge = document.getElementById('tbGdFolderNameBadge');
    if (gdNameBadge) {
      gdNameBadge.textContent = `현재: ${existing?.workspace?.gdrive_folder_name || '내 드라이브 (루트)'}`;
    }

    const delBtn = document.getElementById('btnTbDeleteTeam');
    if (delBtn) delBtn.style.display = (existing && teams.length > 1) ? 'inline-flex' : 'none';

    // Populate Team Orchestrator Select gated by subscription tier
    const tbOrchSel = document.getElementById('tbOrchestratorSelect');
    if (tbOrchSel) {
      const allowed = lastDiagnostics?.allowed_orchestrators || { standard: true, argon: false, carbon: false };
      let curOrch = existing?.orchestrator_mode || 'auto';
      if (curOrch === 'carbon' && !allowed.carbon) curOrch = allowed.argon ? 'argon' : 'auto';
      if (curOrch === 'argon' && !allowed.argon) curOrch = 'auto';
      tbOrchSel.innerHTML = [
        `<option value="auto" ${curOrch === 'auto' ? 'selected' : ''}>🔄 전역 오케스트레이션 설정 따름</option>`,
        `<option value="standard" ${curOrch === 'standard' ? 'selected' : ''}>⚡ 기본 파이프라인 (Standard · 전 등급)</option>`,
        `<option value="argon" ${curOrch === 'argon' ? 'selected' : ''} ${!allowed.argon ? 'disabled' : ''}>${allowed.argon ? '🔷 Orchestrator (Argon) · Pro 이상' : '🔒 Orchestrator (Argon) — Pro 구독 필요'}</option>`,
        `<option value="carbon" ${curOrch === 'carbon' ? 'selected' : ''} ${!allowed.carbon ? 'disabled' : ''}>${allowed.carbon ? '💎 Orchestrator (Carbon) · Ultra 전용' : '🔒 Orchestrator (Carbon) — Ultra 구독 전용'}</option>`
      ].join('');
    }

    // Populate Role CLI selects strictly from active CLI slots
    const activeProvsMap = getActiveCliProvidersMap();
    const provEntries = Object.entries(activeProvsMap).map(([k, p]) => [k, p.label || CLI_LABELS[k] || k]);
    const defaultActiveKey = activeProvsMap.antigravity_sdk ? 'antigravity_sdk' : (provEntries[0]?.[0] || 'antigravity_sdk');
    const roleDefaults = existing?.roles || currentRoles || {};
    [
      ['tbRoleHead', 'head'],
      ['tbRoleBuilder', 'builder'],
      ['tbRoleSubBuilder', 'sub_builder'],
      ['tbRoleReviewer', 'reviewer'],
      ['tbRoleResearcher', 'researcher']
    ].forEach(([selId, rKey]) => {
      const sel = document.getElementById(selId);
      if (!sel) return;
      const rawRoleVal = roleDefaults[rKey] || defaultActiveKey;
      const curVal = activeProvsMap[rawRoleVal] ? rawRoleVal : defaultActiveKey;
      sel.innerHTML = provEntries.map(([k, lbl]) => `<option value="${escHtml(k)}" ${k === curVal ? 'selected' : ''}>${escHtml(lbl)}</option>`).join('');
    });

    // Populate Member Picker Cards
    const selectedSet = new Set(existing?.member_ids || ['01', '03', '04']);
    const poolCount = Math.max(activeAgentCount, 10);
    const agentPool = ALL_AGENT_PRESETS.slice(0, poolCount);
    const membersGrid = document.getElementById('tbMembersGrid');
    const updateMemberCount = () => {
      const cnt = document.querySelectorAll('#tbMembersGrid .team-member-pick-card.selected').length;
      const lbl = document.getElementById('tbSelectedMemberCount');
      if (lbl) lbl.textContent = `(${cnt}명 선택됨)`;
    };
    if (membersGrid) {
      membersGrid.innerHTML = agentPool.map(ag => {
        const cfg = savedCharAiConfigs[ag.id] || {};
        const mergedAg = { ...ag, ...cfg };
        const isSel = selectedSet.has(ag.id);
        return `
          <div class="team-member-pick-card ${isSel ? 'selected' : ''}" data-aid="${escHtml(ag.id)}">
            <div style="width:34px;height:38px;flex-shrink:0">${CharacterEngine.render(mergedAg)}</div>
            <div style="min-width:0;flex:1">
              <div style="font-size:10.5px;font-weight:800;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">#${escHtml(ag.id)} ${escHtml(mergedAg.name)}</div>
              <div style="font-size:9px;color:#64748b">${escHtml(mergedAg.triadRole || 'BUILDER')} · ${escHtml(mergedAg.floor || '1F')}</div>
            </div>
          </div>
        `;
      }).join('');
      membersGrid.querySelectorAll('.team-member-pick-card').forEach(card => {
        card.addEventListener('click', () => {
          card.classList.toggle('selected');
          updateMemberCount();
        });
      });
      updateMemberCount();
    }

    modal?.classList.add('open');
  }

  function bindTeamsAndWorkspacesControls() {
    document.getElementById('btnDashCreateTeam')?.addEventListener('click', () => openTeamBuilderModal(null));
    document.getElementById('btnSettingsCreateTeam')?.addEventListener('click', () => openTeamBuilderModal(null));
    document.getElementById('btnOpenTeamModalFromAgents')?.addEventListener('click', () => openTeamBuilderModal(null));
    document.getElementById('btnAgentsAddNewTeam')?.addEventListener('click', () => openTeamBuilderModal(null));
    document.getElementById('btnAgentsQuickAddStaff')?.addEventListener('click', () => {
      if (modularAgents.length >= ALL_AGENT_PRESETS.length) {
        showAgentsPlacementFeedback(`최대 ${ALL_AGENT_PRESETS.length}명까지 AI 직원을 충원할 수 있습니다.`, true);
        return;
      }
      const nextAg = ALL_AGENT_PRESETS[modularAgents.length];
      modularAgents.push(nextAg);
      const plc = syncAgentOfficePlacement(nextAg.id, nextAg.floor || '2F', null, true);
      try { localStorage.setItem(ACTIVE_AGENT_COUNT_KEY, String(modularAgents.length)); } catch (_) { }
      if (latestTeamsSummary) renderTeamsAndWorkspacesDashboard(latestTeamsSummary);
      showAgentsPlacementFeedback(`✨ 새 AI 직원 [#${nextAg.id} ${nextAg.name}] 충원 완료 (${plc.floorStr} · #${plc.seatIndex + 1}번석 배치)! 원하는 팀으로 드래그하거나 선택해 배정하세요.`);
    });
    document.getElementById('btnEditSelectedTeam')?.addEventListener('click', () => {
      const tid = document.getElementById('triadTeamSelect')?.value || latestTeamsSummary?.active_team_id || null;
      openTeamBuilderModal(tid);
    });
    document.getElementById('triadTeamSelect')?.addEventListener('change', async (ev) => {
      const tid = ev.target.value;
      if (!tid) return;
      syncSettingsBarFromTeam(tid);
      try {
        const res = await apiFetch('/ops/teams', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'set_active', team_id: tid })
        });
        const d = await res.json().catch(() => ({}));
        if (d.teams_summary) renderTeamsAndWorkspacesDashboard(d.teams_summary);
      } catch (_) { }
    });
    document.getElementById('btnRefreshTeamsDashboard')?.addEventListener('click', () => {
      apiFetch('/ops/teams?refresh=1', { cache: 'no-store' })
        .then(r => (r.ok ? r.json() : null))
        .then(ts => { if (ts) renderTeamsAndWorkspacesDashboard(ts, true); })
        .catch(() => { });
    });

    // Initial load of teams & connected workspaces
    apiFetch('/ops/teams', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .then(ts => { if (ts) renderTeamsAndWorkspacesDashboard(ts, true); })
      .catch(() => { });
  }

  async function pollOrchestrator() {
    if (!backendAvailable) return;
    try {
      const res = await apiFetch('/ops/activity', { cache: 'no-store' });
      if (res.status === 404) {
        // 정적 서버(python -m http.server) 환경인 경우 반복 404 방지를 위해 자동 폴링 중지
        backendAvailable = false;
        renderCliDiagnosticsModal(getFallbackDiagnostics());
        return;
      }
      if (!res.ok) return;
      const data = await res.json();
      latestActivitySnapshot = data;
      if (data.character_configs) syncServerCharConfigsIntoRuntime(data.character_configs, false);
      if (data.part_roles) syncPartRolesToDOM(data.part_roles);
      if (data.roles) applyRolesToDOM(data.roles);
      if (data.diagnostics) renderCliDiagnosticsModal(data.diagnostics);
      if (data.sdk_status) renderAntigravitySdkCard(data.sdk_status);
      if (data.output_dir_status) renderOutputDirStatus(data.output_dir_status);
      if (data.teams_summary) renderTeamsAndWorkspacesDashboard(data.teams_summary);
      updatePerTeamLiveProgressStrips(data);
      renderDashboardApprovalCenter(data);
      renderDashboardAgentsAndStats(false);
      renderDashboardDeliverablesSummary(data.missions || [], false);
      const usageObj = data.usage?.today || data.usage?.mission || null;
      updatePipelinePhaseDOM(data.phase || 'IDLE', data.events || [], usageObj);

      const latestMission = Array.isArray(data.missions) ? data.missions[0] : null;
      if (latestMission && latestMission.source === 'virtual-office') {
        const replyRole = document.getElementById('triadReplyRole');
        const replyText = document.getElementById('triadReplyText');
        const replyMeta = document.getElementById('triadReplyMeta');
        if (latestMission.status === 'QUOTA_PAUSED' || data.phase === 'QUOTA_PAUSED') {
          const paused = data.paused_mission || {};
          const intStage = paused.interrupted_stage || latestMission.paused_stage || 'BUILDING';
          const intRole = paused.interrupted_role || 'BUILDER';
          const reasonTxt = paused.reason || '연결되어 있는 모든 AI가 사용 한도에 도달하여 모든 작업을 일시 중지했습니다.';
          if (replyRole) replyRole.textContent = `[⏸ 한도 도달 일시중지 · ${intStage} 단계 대기 중 (${latestMission.mission_id})]`;
          if (replyMeta) replyMeta.textContent = `QUOTA_PAUSED · ${intStage}`;
          if (replyText && !replyText.querySelector('#btnResumePausedMission')) {
            const provMap = data.diagnostics?.providers || lastDiagnostics?.providers || {};
            const slotOpts = Object.entries(provMap)
              .map(([k, p]) => `<option value="${k}">${p.label || k} (${p.auth_state === 'LOGGED_IN' ? '로그인됨' : '미로그인'})</option>`)
              .join('');
            replyText.innerHTML = `
              <div style="margin-top:4px;padding:10px 12px;background:#fff7ed;border:1px solid #fdba74;border-radius:9px;color:#9a3412;font-size:11.5px;line-height:1.55">
                <div style="font-weight:800;margin-bottom:4px">⏸ ${reasonTxt}</div>
                <div style="font-size:10.5px;color:#7c2d12;margin-bottom:8px">중단 위치: <strong>${intStage}</strong> (담당 역할: <strong>${intRole}</strong>) · 이전 단계 산출물은 안전하게 보존되어 있습니다.</div>
                <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
                  <select id="resumeProviderSelect" class="triad-cli-select" style="height:28px;font-size:10.5px">${slotOpts}</select>
                  <button type="button" id="btnResumePausedMission" class="btn small primary" style="background:#ea580c;border-color:#ea580c">▶ 선택한 AI로 교체 후 ${intStage} 단계부터 재개</button>
                  <button type="button" id="btnAbortPausedMission" class="btn small">■ 작업 완전 종료</button>
                </div>
              </div>
            `;
            replyText.querySelector('#btnResumePausedMission')?.addEventListener('click', async (ev) => {
              const btn = ev.currentTarget;
              const selProv = replyText.querySelector('#resumeProviderSelect')?.value || '';
              btn.disabled = true;
              btn.textContent = '재개 중...';
              try {
                await apiFetch('/ops/missions/resume', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ new_provider: selProv })
                });
                pollOrchestrator();
              } catch (_) {
                btn.disabled = false;
              }
            });
            replyText.querySelector('#btnAbortPausedMission')?.addEventListener('click', async () => {
              try {
                await apiFetch('/ops/missions/stop', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ reason: '한도 일시중지 상태에서 사용자 종료' })
                });
                pollOrchestrator();
              } catch (_) { }
            });
          }
        } else if (latestMission.status === 'AWAITING_APPROVAL' || data.phase === 'AWAITING_APPROVAL') {
          const genFiles = Array.isArray(latestMission.generated_files) ? latestMission.generated_files : [];
          const absProjDir = latestMission.project_dir_abs || latestMission.output_root || '';
          const leadName = latestMission.lead_agent_name || '프로젝트 총괄팀장';
          const renderStamp = `${latestMission.mission_id}:${latestMission.updated_at || ''}`;
          if (replyRole) replyRole.textContent = `[📋 ${leadName} 통합보고 도착 · 대표님 최종 승인 대기 (${latestMission.mission_id})]`;
          if (replyMeta) replyMeta.textContent = `⏳ 최종 승인 대기 · ${latestMission.mission_id}`;

          if (replyText && replyText.dataset.approvalStamp !== renderStamp && !replyText.contains(document.activeElement)) {
            replyText.dataset.approvalStamp = renderStamp;
            const reportTxt = latestMission.consolidated_report || latestMission.deliverable_preview || '전 파트 수행 및 상호검토가 완료되었습니다.';
            const filesLinksHtml = genFiles.length
              ? `<div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:6px">${genFiles.map(f => `<a href="${escHtml(f)}" target="_blank" style="background:#eff6ff;border:1px solid #93c5fd;color:#1d4ed8;padding:4px 9px;border-radius:6px;font-size:10.5px;font-weight:800">📁 ${escHtml(f)} 미리보기 ↗</a>`).join('')}${latestMission.deliverable_file ? `<a href="${escHtml(latestMission.deliverable_file)}" target="_blank" style="background:#f0fdf4;border:1px solid #86efac;color:#0f6848;padding:4px 9px;border-radius:6px;font-size:10.5px;font-weight:800">📄 통합보고서 전문(${escHtml(latestMission.deliverable_file)}) 열기 ↗</a>` : ''}</div>`
              : '';
            const dirBtnHtml = absProjDir
              ? `<button type="button" class="btn small btn-open-approval-dir" data-dir="${escHtml(absProjDir)}" style="height:30px;padding:0 10px;font-size:10.5px">🗂️ 로컬 산출물 폴더 열기</button>`
              : '';
            replyText.innerHTML = `
              <div style="margin-top:6px;padding:13px 15px;border-radius:11px;background:linear-gradient(180deg,#fffbeb 0%,#ffffff 100%);border:1.5px solid #f59e0b;box-shadow:0 6px 18px rgba(245,158,11,0.12)">
                <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px">
                  <strong style="color:#92400e;font-size:12.5px">👑 ${escHtml(leadName)} 통합보고 브리핑 — 파트 상호검토 완료 (${genFiles.length}개 파일)</strong>
                  <span style="background:#fef3c7;color:#92400e;padding:2px 8px;border-radius:999px;font-size:10px;font-weight:800">최종 결재 대기 중</span>
                </div>
                <div style="white-space:pre-wrap;padding:10px 12px;border-radius:8px;background:#f8fafc;border:1px solid #e2e8f0;font-size:11.5px;line-height:1.6;color:#1e293b;max-height:240px;overflow-y:auto">${escHtml(reportTxt)}</div>
                ${filesLinksHtml}
                <div style="margin-top:10px;padding-top:10px;border-top:1px dashed #fcd34d;display:flex;gap:7px;align-items:center;flex-wrap:wrap">
                  <button type="button" id="btnApproveMissionFinal" class="btn small primary" style="height:34px;padding:0 15px;font-size:11.5px;background:#0f6848;border-color:#0f6848;font-weight:800">✅ 최종 승인 및 납품 확정 (폴더·Google Drive 반영)</button>
                  ${dirBtnHtml}
                  <input type="text" id="missionRevisionFeedbackInput" class="triad-goal-input" style="height:34px;font-size:11px;min-width:220px;flex:1;background:#fff" placeholder="보완/수정 지시할 사항이 있으면 입력 후 [🔄 보완 재지시]를 누르세요 (승인 시 메모로도 활용 가능)">
                  <button type="button" id="btnReviseMissionFinal" class="btn small" style="height:34px;padding:0 13px;font-size:11px;background:#fff7ed;color:#c2410c;border-color:#fdba74;font-weight:800">🔄 총괄팀장에게 보완 재지시</button>
                </div>
              </div>
            `;
            replyText.querySelectorAll('.btn-open-approval-dir').forEach(b => {
              b.addEventListener('click', () => openLocalFolderExplorer(b.dataset.dir || '', '결재 대기 산출물 폴더'));
            });
            replyText.querySelector('#btnApproveMissionFinal')?.addEventListener('click', async (ev) => {
              const btn = ev.currentTarget;
              const memo = (replyText.querySelector('#missionRevisionFeedbackInput')?.value || '').trim();
              btn.disabled = true;
              btn.textContent = '⏳ 최종 승인 및 납품 반영 중...';
              try {
                await apiFetch('/ops/missions/decision', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ mission_id: latestMission.mission_id, decision: 'approve', feedback: memo })
                });
                delete replyText.dataset.approvalStamp;
                lastRenderedMissionId = null;
                pollOrchestrator();
              } catch (_) {
                btn.disabled = false;
              }
            });
            replyText.querySelector('#btnReviseMissionFinal')?.addEventListener('click', async (ev) => {
              const btn = ev.currentTarget;
              const inp = replyText.querySelector('#missionRevisionFeedbackInput');
              let fbTxt = (inp?.value || '').trim();
              if (!fbTxt) {
                fbTxt = (prompt('총괄팀장 및 파트 담당에게 전달할 구체적 보완 재지시 내용을 입력하세요:', '') || '').trim();
                if (!fbTxt) return;
              }
              btn.disabled = true;
              btn.textContent = '⏳ 파트 보완 재지시 전달 중...';
              try {
                await apiFetch('/ops/missions/decision', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ mission_id: latestMission.mission_id, decision: 'revise', feedback: fbTxt })
                });
                delete replyText.dataset.approvalStamp;
                pollOrchestrator();
              } catch (_) {
                btn.disabled = false;
              }
            });
          }
        } else if (latestMission.live || latestMission.status === 'RUNNING') {
          if (replyText) delete replyText.dataset.approvalStamp;
          const curStep = (latestMission.steps || [])[latestMission.steps.length - 1];
          const typeTag = latestMission.deliverable_type_label ? ` · ${latestMission.deliverable_type_label}` : '';
          const ls = data.live_agent_stream || null;
          const totalSteps = latestMission.max_steps || (currentPartRoles?.pipeline_stages?.length) || 7;
          if (replyRole) replyRole.textContent = `[총괄팀장·파트 협업 진행 중 · ${data.phase || 'RUNNING'} (${latestMission.passed_steps || 0}/${totalSteps})${typeTag}]`;
          if (replyText) {
            const baseTxt = curStep
              ? `[${curStep.stage}] ${curStep.summary}`
              : `'${latestMission.goal}' 업무 문장을 자동 분석하여 파이프라인(PLANNING → BUILDING → VERIFYING → REVIEWING → DECIDING)을 실행 중입니다...`;
            if (ls && ls.active) {
              const subs = Array.isArray(ls.subagents) ? ls.subagents : [];
              const subHtml = subs.length
                ? `<div style="margin-top:5px;font-size:10px;color:#0369a1">🤝 <b>SDK SubagentConfig 로스터 (${subs.length}명)</b>: ${subs.map(s => `<span style="display:inline-block;background:#e0f2fe;color:#0c4a6e;padding:1px 6px;border-radius:4px;margin-right:4px;font-weight:700">#${escHtml(s.id || '')} ${escHtml(s.name || '')} (${escHtml(s.role || '')})</span>`).join('')}</div>`
                : '';
              const toolHtml = ls.tool
                ? `<div style="margin-top:4px;color:#1d4ed8;font-weight:800;font-family:var(--font-mono,monospace);font-size:10.5px">🔧 실시간 도구 호출: ${escHtml(ls.tool)}</div>`
                : '';
              replyText.innerHTML = `
                <div>${escHtml(baseTxt)}</div>
                <div style="margin-top:7px;padding:9px 11px;border-radius:9px;background:linear-gradient(135deg,#f0f9ff,#ecfdf5);border:1px solid #86efac;font-size:11px;line-height:1.5">
                  <div style="font-weight:800;color:#0f6848">⚡ 실시간 에이전트 스트림 · #${escHtml(ls.agent_id || '01')} ${escHtml(ls.agent_name || ls.role || 'AI')} (${ls.provider === 'antigravity_sdk' ? '📦 Antigravity SDK · $0' : escHtml(ls.provider || '')})</div>
                  <div style="margin-top:3px;color:#1e293b">💭 ${escHtml(ls.thought || '추론 진행 중...')}</div>
                  ${toolHtml}
                  ${subHtml}
                </div>
              `;
            } else {
              replyText.textContent = baseTxt;
            }
          }
          if (replyMeta) replyMeta.textContent = `${data.phase || 'RUNNING'} · ${latestMission.mission_id}`;
        } else if (latestMission.status === 'DONE' && latestMission.deliverable_file && lastRenderedMissionId !== latestMission.mission_id) {
          lastRenderedMissionId = latestMission.mission_id;
          const genFiles = Array.isArray(latestMission.generated_files) ? latestMission.generated_files : [];
          const repCnt = Number(latestMission.repair_count || 0);
          const profTag = (latestMission.profile || 'standard').toUpperCase();
          const typeLbl = latestMission.deliverable_type_label || '';
          const absProjDir = latestMission.project_dir_abs || latestMission.output_root || '';
          const isGdMission = Boolean(latestMission.is_google_drive);
          const gdCloudUrl = latestMission.gdrive_project_url || latestMission.gdrive_report_url || '';
          const gdCloudBtnHtml = gdCloudUrl
            ? `<a href="${gdCloudUrl}" target="_blank" class="btn small" style="height:24px;padding:0 9px;font-size:10px;background:#0284c7;color:#fff;border-color:#0284c7">☁️ 웹 Google Drive에서 폴더 열기 ↗</a>`
            : '';
          const locPillHtml = absProjDir
            ? `<div style="margin-top:6px;display:flex;align-items:center;gap:6px;flex-wrap:wrap;font-size:10.5px;color:${isGdMission ? '#0369a1' : '#334155'}"><span style="background:${isGdMission ? '#e0f2fe' : '#f1f5f9'};padding:2px 8px;border-radius:6px;font-weight:700">${isGdMission ? '☁️ Google Drive 저장됨' : '📁 저장 위치'}: ${absProjDir.replace(/</g, '&lt;')}</span><button type="button" class="btn small btn-open-mission-dir" data-dir="${absProjDir.replace(/"/g, '&quot;')}" style="height:24px;padding:0 8px;font-size:10px">🗂️ 탐색기로 열기</button>${gdCloudBtnHtml}</div>`
            : gdCloudBtnHtml;
          if (replyRole) replyRole.textContent = `[✅ ${profTag} 미션 완료${typeLbl ? ` · ${typeLbl}` : ''} · ${latestMission.mission_id}${repCnt > 0 ? ` · 자동수정 ${repCnt}회` : ''}]`;
          if (replyText) {
            const preview = (latestMission.deliverable_preview || '').slice(0, 420);
            const filesLinksHtml = genFiles.length
              ? `<div style="margin-top:6px;display:flex;flex-wrap:wrap;gap:6px">${genFiles.map(f => `<a href="${f}" target="_blank" style="background:#eff6ff;border:1px solid #bfdbfe;color:#1d4ed8;padding:3px 8px;border-radius:6px;font-size:10.5px;font-weight:700">📁 ${f} ↗</a>`).join('')}</div>`
              : '';
            replyText.innerHTML = `<div style="white-space:pre-wrap;margin-top:4px;padding:8px 10px;background:#fff;border:1px solid #cbd5e1;border-radius:8px;font-family:var(--font-mono,monospace);font-size:11px">${preview.replace(/</g, '&lt;')}</div>${locPillHtml}${filesLinksHtml}<div style="margin-top:6px"><a href="${latestMission.deliverable_file}" target="_blank" style="color:#0f6848;font-weight:800;text-decoration:underline">📄 전체 산출물 리포트 열기 (${latestMission.deliverable_file}) ↗</a></div>`;
            replyText.querySelectorAll('.btn-open-mission-dir').forEach(b => {
              b.addEventListener('click', () => {
                openLocalFolderExplorer(b.dataset.dir || '', '미션 산출물 폴더');
              });
            });
          }
          if (replyMeta) replyMeta.textContent = `${profTag} PASS (${genFiles.length}파일)`;
        }
      }

      // 대시보드(index.html)의 산출물 요약보기는 renderDashboardDeliverablesSummary(data.missions)에서 일괄 동기화됨
    } catch (_) { }
  }

  function renderAntigravitySdkCard(sdkSt) {
    if (!sdkSt || typeof sdkSt !== 'object') return;
    const badgeEl = document.getElementById('sdkStatusMainBadge');
    const uvValEl = document.getElementById('sdkUvStatusVal');
    const uvSubEl = document.getElementById('sdkUvPathSub');
    const pkgValEl = document.getElementById('sdkPkgStatusVal');
    const venvSubEl = document.getElementById('sdkVenvPathSub');
    const accValEl = document.getElementById('sdkSharedAccVal');
    const planSubEl = document.getElementById('sdkSharedPlanSub');
    const btnInst = document.getElementById('btnAutoInstallSdkUv');
    if (!badgeEl && !uvValEl) return;

    if (badgeEl) {
      if (sdkSt.ready) {
        badgeEl.className = 'status running';
        badgeEl.textContent = `✓ SDK v${sdkSt.sdk_version} & 구독 공유 활성`;
      } else if (sdkSt.sdk_installed && !sdkSt.shared_auth_ready) {
        badgeEl.className = 'status review';
        badgeEl.textContent = `🔑 SDK 설치됨 · 로컬 구독 로그인 필요`;
      } else {
        badgeEl.className = 'status review';
        badgeEl.textContent = '⚡ SDK 미설치 (원클릭 설치 대기)';
      }
    }

    if (uvValEl) {
      uvValEl.textContent = sdkSt.uv_installed
        ? `✓ ${sdkSt.uv_version || 'uv 설치 확인됨'}`
        : '⏳ 미설치 (설치 버튼 클릭 시 자동 설치)';
      uvValEl.style.color = sdkSt.uv_installed ? '#0f6848' : '#b45309';
    }
    if (uvSubEl) {
      uvSubEl.textContent = sdkSt.uv_executable || '공식 Astral uv 스크립트 자동 연결';
      uvSubEl.title = sdkSt.uv_executable || '';
    }

    if (pkgValEl) {
      pkgValEl.textContent = sdkSt.sdk_installed
        ? `✓ google-antigravity v${sdkSt.sdk_version}`
        : '미설치 (.venv 자동 구성 대기)';
      pkgValEl.style.color = sdkSt.sdk_installed ? '#0f6848' : '#b45309';
    }
    if (venvSubEl) {
      venvSubEl.textContent = sdkSt.venv_dir || '.venv/';
      venvSubEl.title = sdkSt.venv_python || sdkSt.venv_dir || '';
    }

    const sharedAcc = sdkSt.shared_account;
    if (accValEl) {
      if (sharedAcc) {
        accValEl.textContent = `✓ ${sharedAcc.email}`;
        accValEl.style.color = '#14532d';
      } else {
        accValEl.textContent = '미로그인 (로컬 로그인 시 자동 공유)';
        accValEl.style.color = '#b45309';
      }
    }
    if (planSubEl) {
      planSubEl.textContent = sharedAcc
        ? `${sharedAcc.plan_label} · ${sharedAcc.label}${sdkSt.shared_accounts_count > 1 ? ` 외 ${sdkSt.shared_accounts_count - 1}개` : ''}`
        : 'Antigravity App 또는 CLI 로그인 시 즉시 공유됨';
    }

    if (btnInst && !btnInst.disabled) {
      btnInst.textContent = sdkSt.sdk_installed
        ? `🔄 uv로 SDK 최신 업데이트 (v${sdkSt.sdk_version})`
        : '⚡ uv + Antigravity SDK 원클릭 자동설치';
    }
  }

  function bindAntigravitySdkControls() {
    const btnInst = document.getElementById('btnAutoInstallSdkUv');
    const btnTest = document.getElementById('btnTestSdkSharedAuth');
    const btnLogin = document.getElementById('btnLoginForSdkShare');
    const btnRefresh = document.getElementById('btnRefreshSdkStatus');
    const fbEl = document.getElementById('sdkActionFeedbackText');
    const logEl = document.getElementById('sdkInstallLogBox');
    if (!btnInst && !btnRefresh) return;

    const showSdkLog = (txt, isErr = false) => {
      if (!logEl) return;
      logEl.style.display = 'block';
      logEl.style.borderLeft = isErr ? '4px solid #ef4444' : '4px solid #10b981';
      logEl.textContent = txt;
      logEl.scrollTop = logEl.scrollHeight;
    };

    btnInst?.addEventListener('click', async () => {
      btnInst.disabled = true;
      const origTxt = btnInst.textContent;
      btnInst.textContent = '⏳ uv · .venv · SDK 자동 설치 진행 중...';
      if (fbEl) {
        fbEl.style.color = '#0369a1';
        fbEl.textContent = '⏳ uv 감지 → .venv 생성 → google-antigravity 휠 설치 및 로컬 구독 공유 확인 중입니다...';
      }
      showSdkLog('[실행 중] uv 패키지 매니저 및 google-antigravity SDK 자동 설치를 진행하고 있습니다. 잠시만 기다려 주세요...');
      try {
        const res = await apiFetch('/ops/sdk-install', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'install' })
        });
        const d = await res.json().catch(() => ({}));
        if (d.sdk_status) renderAntigravitySdkCard(d.sdk_status);
        showSdkLog(d.log || d.message || '설치 응답 수신 완료', !d.ok);
        if (fbEl) {
          fbEl.style.color = d.ok ? '#0f6848' : '#dc2626';
          fbEl.textContent = d.ok ? `✅ ${d.message}` : `⚠️ ${d.message || '설치 실패'}`;
        }
      } catch (err) {
        showSdkLog(`네트워크 또는 서버 오류: ${err}`, true);
        if (fbEl) {
          fbEl.style.color = '#dc2626';
          fbEl.textContent = '⚠️ 서버와 통신할 수 없습니다. server.py 실행 상태를 확인해 주세요.';
        }
      } finally {
        btnInst.disabled = false;
        if (btnInst.textContent.startsWith('⏳')) btnInst.textContent = origTxt;
        apiFetch('/ops/sdk-status?refresh=1', { cache: 'no-store' })
          .then(r => (r.ok ? r.json() : null))
          .then(st => { if (st) renderAntigravitySdkCard(st); })
          .catch(() => { });
      }
    });

    btnTest?.addEventListener('click', async () => {
      btnTest.disabled = true;
      const origTxt = btnTest.textContent;
      btnTest.textContent = '⏳ 구독 공유 테스트 중...';
      if (fbEl) {
        fbEl.style.color = '#0369a1';
        fbEl.textContent = '⏳ 종량제 API 키 없이 로컬 구독 세션만으로 google.antigravity.Agent 응답을 확인 중입니다...';
      }
      showSdkLog('[테스트 실행 중] .venv 내부에서 google.antigravity.Agent(LocalAgentConfig()) 로컬 구독 공유 호출 중...');
      try {
        const res = await apiFetch('/ops/sdk-install', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'test' })
        });
        const d = await res.json().catch(() => ({}));
        if (d.sdk_status) renderAntigravitySdkCard(d.sdk_status);
        showSdkLog(`${d.ok ? '✅ [테스트 통과]' : '⚠️ [테스트 확인 필요]'} ${d.message || ''}\n\n${d.output || ''}`.trim(), !d.ok);
        if (fbEl) {
          fbEl.style.color = d.ok ? '#0f6848' : '#b45309';
          fbEl.textContent = d.ok ? `✅ ${d.message}` : `⚠️ ${d.message || '응답 확인 필요'}`;
        }
      } catch (err) {
        showSdkLog(`테스트 호출 오류: ${err}`, true);
      } finally {
        btnTest.disabled = false;
        btnTest.textContent = origTxt;
      }
    });

    btnLogin?.addEventListener('click', async () => {
      if (fbEl) {
        fbEl.style.color = '#0369a1';
        fbEl.textContent = '🔑 로컬 Antigravity 구독 로그인 터미널을 열고 있습니다...';
      }
      try {
        const res = await apiFetch('/ops/cli-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cli: 'antigravity' })
        });
        const d = await res.json().catch(() => ({}));
        showSdkLog(d.message || d.error || '로그인 창 실행 요청 완료', !d.ok);
        if (fbEl) {
          fbEl.style.color = d.ok ? '#0f6848' : '#dc2626';
          fbEl.textContent = d.ok
            ? '🔑 로그인 창에서 Google 계정 로그인을 마치면 SDK에도 자동 공유됩니다.'
            : `⚠️ ${d.error || '로그인 실행 실패'}`;
        }
      } catch (_) { }
    });

    btnRefresh?.addEventListener('click', () => {
      apiFetch('/ops/sdk-status?refresh=1', { cache: 'no-store' })
        .then(r => (r.ok ? r.json() : null))
        .then(st => {
          if (st) {
            renderAntigravitySdkCard(st);
            if (fbEl) {
              fbEl.style.color = '#0f6848';
              fbEl.textContent = '🔄 SDK 설치 및 로컬 구독 계정 공유 상태를 최신으로 갱신했습니다.';
            }
          }
        })
        .catch(() => { });
    });

    apiFetch('/ops/sdk-status', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .then(st => { if (st) renderAntigravitySdkCard(st); })
      .catch(() => { });
  }

  syncAllCliDropdowns(getActiveCliProvidersMap());
  ensureCliSettingsModal();
  bindOrchestratorModeControls();
  bindProjectOutputDirControls();
  bindTeamsAndWorkspacesControls();
  bindAntigravitySdkControls();
  applyRolesToDOM(currentRoles);
  if (page === 'dashboard') {
    renderDashboardAgentsAndStats(true);
  }
  if (page === 'agents' || page === 'dashboard') {
    apiFetch('/ops/part-roles', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d?.part_roles) syncPartRolesToDOM(d.part_roles, true); })
      .catch(() => { });
    apiFetch('/ops/cli-check?deep=0', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .then(diag => { if (diag) renderCliDiagnosticsModal(diag, true); })
      .catch(() => { });
  }
  pollOrchestrator();
  setInterval(pollOrchestrator, 3000);

  // 전역 참조 노출 (개발자 콘솔 또는 기타 스크립트 연동)
  window.CharacterEngine = CharacterEngine;
  window.modularAgents = modularAgents;
  window.openCliSettingsModal = openCliSettingsModal;
  window.openTeamBuilderModal = openTeamBuilderModal;
})();
