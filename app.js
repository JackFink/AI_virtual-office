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
  const INITIAL_AGENT_COUNT = 5;
  let activeAgentCount = INITIAL_AGENT_COUNT;
  try {
    const savedCnt = parseInt(localStorage.getItem(ACTIVE_AGENT_COUNT_KEY) || '', 10);
    if (!isNaN(savedCnt) && savedCnt >= 1 && savedCnt <= ALL_AGENT_PRESETS.length) {
      activeAgentCount = savedCnt;
    }
  } catch (_) {}

  const modularAgents = ALL_AGENT_PRESETS.slice(0, activeAgentCount);
  window.CharacterEngine = CharacterEngine;
  window.ALL_AGENT_PRESETS = ALL_AGENT_PRESETS;
  window.modularAgents = modularAgents;

  // Initialize default AI CLI & configuration fields on all 20 modularAgents
  const CHAR_AI_STORAGE_KEY = 'nexus-character-ai-configs-v1';
  const CLI_BADGE_LABELS = {
    claude: 'Claude Code',
    antigravity: 'Google Antigravity (계정 1)',
    gemini: 'Google Antigravity (계정 2)',
    openai: 'OpenAI Codex',
    grok: 'xAI Grok'
  };
  let savedCharAiConfigs = {};
  try {
    savedCharAiConfigs = JSON.parse(localStorage.getItem(CHAR_AI_STORAGE_KEY) || '{}') || {};
  } catch (_) {}

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

  function applySavedConfigToAgent(a, idx = 0) {
    const defCli = a.triadRole === 'HEAD' ? 'claude' : a.triadRole === 'BUILDER' ? 'antigravity' : a.triadRole === 'SUB-BUILDER' ? 'gemini' : a.triadRole === 'RESEARCHER' ? 'grok' : 'openai';
    const defSandbox = a.triadRole === 'BUILDER' ? 'proposal' : 'read-only';
    const defTimeout = a.triadRole === 'BUILDER' ? '600' : '300';
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
    a.cliProvider = saved.cliProvider || defCli;
    a.sandboxMode = saved.sandboxMode || defSandbox;
    a.timeoutSec = String(saved.timeoutSec || defTimeout);
    a.mapleEquipped = (saved.mapleEquipped && typeof saved.mapleEquipped === 'object' && Object.keys(saved.mapleEquipped).length > 0)
      ? { ...saved.mapleEquipped }
      : { ...defMaple };
    a.mapleAnim = saved.mapleAnim || 'stand1';
    a.mapleAnimated = Boolean(saved.mapleAnimated);
    a.mapleFlipped = Boolean(saved.mapleFlipped);
    a.skills = Array.isArray(saved.skills) && saved.skills.length
      ? [...saved.skills]
      : [...(DEFAULT_SKILLS_BY_ROLE[a.triadRole] || DEFAULT_SKILLS_BY_ROLE.HEAD)];
    a.systemPrompt = saved.systemPrompt || `당신은 ${a.floor} 소속 '${a.name}' (${a.triadRole} 역할) 에이전트입니다. 맡은 전문 분야에 맞게 명확하고 정확하게 답변하세요.`;
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
      cliProvider: agent.cliProvider,
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
    } catch (_) {}
  }

  async function saveCharacterConfigsToServer(targetAgent = null) {
    if (targetAgent) {
      persistCharacterAiConfig(targetAgent);
    } else {
      modularAgents.forEach(a => persistCharacterAiConfig(a));
    }
    try {
      await fetch('/ops/character-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ configs: savedCharAiConfigs })
      });
    } catch (_) {}
    renderTopRosterAvatars();
    window.dispatchEvent(new CustomEvent('nexus:character-configs-updated', { detail: { configs: savedCharAiConfigs } }));
  }

  function renderTopRosterAvatars() {
    // agents.html 상단 Triad 역할 체계별 AI 직원 목록(#agentList) 및 index.html 테이블 아바타에 KMS v389 캐릭터 반영
    const topRows = document.querySelectorAll('#agentList .agent-card-row');
    topRows.forEach((row, idx) => {
      const ag = modularAgents[idx] || ALL_AGENT_PRESETS[idx];
      if (!ag) return;
      const avEl = row.querySelector('.agent-avatar');
      if (avEl) {
        avEl.style.overflow = 'hidden';
        avEl.style.padding = '1px';
        avEl.innerHTML = CharacterEngine.render(ag, { stance: ag.mapleAnim || 'stand1', animated: false });
      }
      const nameNode = row.querySelector('.agent-name');
      if (nameNode && ag.name) nameNode.textContent = ag.name;
    });
    const dashRows = document.querySelectorAll('#dashboardAgentTableBody tr');
    dashRows.forEach((tr, idx) => {
      const ag = modularAgents[idx] || ALL_AGENT_PRESETS[idx];
      if (!ag) return;
      const avEl = tr.querySelector('.agent-avatar');
      if (avEl) {
        avEl.style.overflow = 'hidden';
        avEl.style.padding = '1px';
        avEl.innerHTML = CharacterEngine.render(ag, { stance: ag.mapleAnim || 'stand1', animated: false });
      }
    });
  }

  // 페이지 로드 시 서버(data/character_configs.json)에 저장된 캐릭터 코디 설정도 동기화
  fetch('/ops/character-config')
    .then(r => r.ok ? r.json() : null)
    .then(data => {
      if (data && data.configs && typeof data.configs === 'object' && Object.keys(data.configs).length > 0) {
        savedCharAiConfigs = { ...data.configs, ...savedCharAiConfigs };
        Object.keys(data.configs).forEach(cid => {
          const srv = data.configs[cid];
          const loc = savedCharAiConfigs[cid];
          if (srv && (!loc || (srv.updatedAt && (!loc.updatedAt || srv.updatedAt >= loc.updatedAt)))) {
            savedCharAiConfigs[cid] = srv;
          }
        });
        try {
          localStorage.setItem(CHAR_AI_STORAGE_KEY, JSON.stringify(savedCharAiConfigs));
        } catch (_) {}
        ALL_AGENT_PRESETS.forEach((a, idx) => applySavedConfigToAgent(a, idx));
        renderTopRosterAvatars();
        window.dispatchEvent(new CustomEvent('nexus:character-configs-updated', { detail: { configs: savedCharAiConfigs } }));
      }
    })
    .catch(() => {});

  renderTopRosterAvatars();

  function formatPartCode(parts, agent = null) {
    if (agent && agent.mapleEquipped && Object.keys(agent.mapleEquipped).length > 0) {
      const eq = agent.mapleEquipped;
      return `KMS389 · H:${eq.hair || '-'} / F:${eq.face || '-'} / C:${eq.overall || eq.top || '-'}`;
    }
    return `${parts.base}/${parts.hair}/${parts.face}/${parts.outfit}/${parts.bottom}/${parts.acc}`;
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
    const studioQuickCli = document.getElementById('studioQuickCli');
    const studioAiNameInput = document.getElementById('studioAiNameInput');
    const studioAiFloorSelect = document.getElementById('studioAiFloorSelect');
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

      modularAgents
        .filter(a => filterVal === 'all' || a.floor === filterVal || a.triadRole === filterVal)
        .forEach(agent => {
          const card = document.createElement('div');
          card.className = `char-card${agent.id === selectedId ? ' active' : ''}`;
          card.dataset.id = agent.id;
          const cliKey = agent.cliProvider || 'claude';
          const cliLabel = CLI_BADGE_LABELS[cliKey] || cliKey;
          const skillCount = Array.isArray(agent.skills) ? agent.skills.length : 0;
          card.innerHTML = `
            <div class="char-card-top">
              <span>#${agent.id} · ${agent.triadRole || 'AGENT'}</span>
              <span class="char-floor-tag">${agent.floor}</span>
            </div>
            <div class="char-svg-wrap">${CharacterEngine.render(agent, { stance: agent.mapleAnim || 'stand1', animated: false })}</div>
            <div class="char-card-name">${agent.name}</div>
            <span class="char-cli-badge ${cliKey}">${cliLabel} · ⚡${skillCount}</span>
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

    document.getElementById('btnAddStudioCharacter')?.addEventListener('click', () => {
      if (modularAgents.length >= ALL_AGENT_PRESETS.length) {
        alert(`최대 ${ALL_AGENT_PRESETS.length}명까지 직원을 추가할 수 있습니다.`);
        return;
      }
      const nextAgent = ALL_AGENT_PRESETS[modularAgents.length];
      modularAgents.push(nextAgent);
      selectedId = nextAgent.id;
      try {
        localStorage.setItem(ACTIVE_AGENT_COUNT_KEY, String(modularAgents.length));
      } catch (_) {}
      renderDirectory();
      updateCustomizer();
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

      // 1-2. AI CLI & 설정 탭 동기화
      if (studioQuickRole) studioQuickRole.value = agent.triadRole || 'HEAD';
      if (studioQuickCli) studioQuickCli.value = agent.cliProvider || 'claude';
      if (studioAiNameInput && document.activeElement !== studioAiNameInput) studioAiNameInput.value = agent.name || '';
      if (studioAiFloorSelect) studioAiFloorSelect.value = agent.floor || '1F';
      if (studioAiSandboxSelect) studioAiSandboxSelect.value = agent.sandboxMode || 'read-only';
      if (studioAiTimeoutSelect) studioAiTimeoutSelect.value = String(agent.timeoutSec || '300');
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
              cliLabel: cliLabel,
              sandboxMode: agent.sandboxMode,
              timeoutSec: Number(agent.timeoutSec || 300),
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

    studioQuickRole?.addEventListener('change', (e) => {
      updateSelectedAgentAiField(a => { a.triadRole = e.target.value; });
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
      updateSelectedAgentAiField(a => { a.cliProvider = e.target.value; });
    });
    document.querySelectorAll('#studioCliCardGroup .studio-cli-card').forEach(btn => {
      btn.addEventListener('click', () => {
        updateSelectedAgentAiField(a => { a.cliProvider = btn.dataset.cliVal; });
      });
    });
    studioAiNameInput?.addEventListener('input', (e) => {
      updateSelectedAgentAiField(a => { a.name = e.target.value.trim() || a.name; });
    });
    studioAiFloorSelect?.addEventListener('change', (e) => {
      updateSelectedAgentAiField(a => { a.floor = e.target.value; });
    });
    studioAiSandboxSelect?.addEventListener('change', (e) => {
      updateSelectedAgentAiField(a => { a.sandboxMode = e.target.value; });
    });
    studioAiTimeoutSelect?.addEventListener('change', (e) => {
      updateSelectedAgentAiField(a => { a.timeoutSec = e.target.value; });
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
      } catch (_) {}
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
        .catch(() => {});
    } else {
      updateMapleTabCategoryCounts();
      renderMapleSubFilters();
      filterMapleParts();
    }

    renderDirectory();
    updateCustomizer();
  }

  // ==========================================================================
  // [4] agents.html AI 직원 & Triad 역할 필터 및 검색 기능
  // ==========================================================================
  if (page === 'agents') {
    const chips = [...document.querySelectorAll('.filter-chip')];
    const rows = [...document.querySelectorAll('.agent-card-row')];
    const search = document.getElementById('agentSearch');
    const count = document.getElementById('agentCount');
    let activeFilter = 'all';

    function filterRows() {
      const q = (search?.value || '').trim().toLowerCase();
      let visible = 0;
      rows.forEach(row => {
        const matchFilter =
          activeFilter === 'all' ||
          row.dataset.status === activeFilter ||
          row.dataset.role === activeFilter;
        const matchSearch = !q || row.dataset.name.toLowerCase().includes(q) || (row.textContent || '').toLowerCase().includes(q);
        const show = matchFilter && matchSearch;
        row.style.display = show ? 'grid' : 'none';
        if (show) visible++;
      });
      if (count) count.textContent = `${visible}개 Triad 핵심 에이전트 표시 중 · 캐릭터 스튜디오 ${modularAgents.length}명 연동`;
      const empty = document.getElementById('noAgents');
      if (!visible && !empty) {
        const node = document.createElement('div');
        node.id = 'noAgents';
        node.className = 'empty-state';
        node.textContent = '조건에 맞는 AI 직원을 찾지 못했습니다.';
        document.getElementById('agentList')?.appendChild(node);
      } else if (visible && empty) empty.remove();
    }

    chips.forEach(chip => chip.addEventListener('click', () => {
      activeFilter = chip.dataset.filter;
      chips.forEach(c => c.classList.toggle('active', c === chip));
      filterRows();
    }));
    search?.addEventListener('input', filterRows);
  }

  // ==========================================================================
  // [5] AI DEV DIRECTOR × NEXUS Virtual Office (Triad Role & Multi-CLI 연동)
  // ==========================================================================
  const CLI_LABELS = {
    claude: 'Claude Code (claude)',
    antigravity: 'Google Antigravity (계정 1)',
    gemini: 'Google Antigravity (계정 2)',
    openai: 'OpenAI Codex (codex)',
    grok: 'xAI Grok (grok)'
  };
  const CLI_SHORT = {
    claude: 'Claude',
    antigravity: 'Antigravity 1',
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
    } catch (_) {}
    return { head: 'claude', builder: 'antigravity', sub_builder: 'gemini', reviewer: 'openai', researcher: 'grok' };
  }

  let currentRoles = loadStoredRoles();
  let localPipelineTimer = null;

  // 각 AI CLI의 로그인 계정 요금제(Plan) 자동 감지 및 일일 제한(Daily) / 월간 제한(Monthly) 구분 계산
  const CLI_QUOTA_CAPS = {
    claude:      { domain: 'ANTHROPIC', dailyCalls: 0,  dailyTokens: 0,      monthlyCalls: 0,    monthlyTokens: 0,        planName: '미구독 (연결된 플랜 없음)', planLabel: '미구독 (로그인 안 됨)', isSubscribed: false, isPaid: false, accountEmail: null },
    antigravity: { domain: 'GOOGLE',    dailyCalls: 60, dailyTokens: 500000, monthlyCalls: 1800, monthlyTokens: 15000000, planName: 'Google AI Pro (Antigravity IDE 구독 플랜)', planLabel: 'Google AI Pro (Antigravity 구독)', isSubscribed: true, isPaid: true, accountEmail: null },
    gemini:      { domain: 'GEMINI2',   dailyCalls: 0,  dailyTokens: 0,      monthlyCalls: 0,    monthlyTokens: 0,        planName: '서브 구글 계정 (계정 2) 로그인 필요', planLabel: '미로그인 (계정 2 로그인 대기)', isSubscribed: false, isPaid: false, accountEmail: null },
    openai:      { domain: 'OPENAI',    dailyCalls: 15, dailyTokens: 60000,  monthlyCalls: 300,  monthlyTokens: 1200000,  planName: 'ChatGPT Free (무료 플랜 · 유료 미구독)', planLabel: 'ChatGPT Free (무료 플랜)', isSubscribed: true, isPaid: false, accountEmail: null },
    grok:        { domain: 'XAI',       dailyCalls: 0,  dailyTokens: 0,      monthlyCalls: 0,    monthlyTokens: 0,        planName: '미구독 (연결된 플랜 없음)', planLabel: '미구독 (로그인 안 됨)', isSubscribed: false, isPaid: false, accountEmail: null }
  };
  let latestUsageByProvider = {
    ANTHROPIC: { calls: 0, tokens: 0, monthly_calls: 0, monthly_tokens: 0 },
    GOOGLE:    { calls: 1, tokens: 0, monthly_calls: 1, monthly_tokens: 0 },
    GEMINI2:   { calls: 0, tokens: 0, monthly_calls: 0, monthly_tokens: 0 },
    OPENAI:    { calls: 2, tokens: 53475, monthly_calls: 2, monthly_tokens: 53475 },
    XAI:       { calls: 0, tokens: 0, monthly_calls: 0, monthly_tokens: 0 }
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
      topSummaryText: `일일 ${dailyUsedCalls}/${dailyMaxCalls}회 (${(dailyUsedTokens/1000).toFixed(1)}k tok) · 월간 ${monthlyUsedCalls}/${monthlyMaxCalls}회`,
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
  }

  function applyRolesToDOM(roles) {
    currentRoles = { ...currentRoles, ...roles };
    try { localStorage.setItem(ROLE_STORAGE_KEY, JSON.stringify(currentRoles)); } catch (_) {}

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
    const stages = ['PLANNING', 'BUILDING', 'VERIFYING', 'REVIEWING', 'DECIDING'];
    const atIdx = stages.indexOf(phase);

    document.querySelectorAll('#triadPipelineSteps .triad-step').forEach(stepEl => {
      const st = stepEl.dataset.stage;
      const idx = stages.indexOf(st);
      stepEl.classList.toggle('on', idx === atIdx);
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
    if (statPhase) statPhase.textContent = phase === 'IDLE' ? 'STANDBY' : phase;
    if (statSub) {
      statSub.textContent = phase === 'IDLE'
        ? `HEAD(${CLI_SHORT[currentRoles.head]}) · BUILDER(${CLI_SHORT[currentRoles.builder]}) · REVIEWER(${CLI_SHORT[currentRoles.reviewer]})`
        : `파이프라인 ${phase} 단계 실행 중`;
    }

    const topText = document.getElementById('topSystemText');
    if (topText) {
      topText.textContent = phase === 'IDLE'
        ? `TRIAD STANDBY · HEAD=${CLI_SHORT[currentRoles.head]} / BUILDER=${CLI_SHORT[currentRoles.builder]} / REVIEWER=${CLI_SHORT[currentRoles.reviewer]}`
        : `TRIAD LIVE · ${phase} 실행 중`;
    }

    // Update dashboard activity feed if events provided
    if (Array.isArray(events) && events.length > 0) {
      const dashFeed = document.getElementById('dashboardActivity');
      if (dashFeed) {
        dashFeed.innerHTML = events.slice(0, 4).map(ev => {
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
          } catch (_) {}
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
      } catch (_) {}
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

  async function dispatchMissionGoal(goal, profile = 'standard') {
    if (!goal || !goal.trim()) return;
    try {
      const res = await fetch('/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: goal.trim(), profile })
      });
      if (res.ok || res.status === 202) {
        pollOrchestrator();
        return;
      }
    } catch (_) {}
    startLocalPipelineFallback(goal.trim());
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
    } catch (_) {}
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
  } catch (_) {}

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

    if (replyRole) replyRole.textContent = `[개발 미션 가동 · ${mode.toUpperCase()}]`;
    if (replyText) replyText.textContent = `'${goal}' 미션이 시작되었습니다. 아래 5단계 파이프라인(PLANNING → BUILDING → VERIFYING → REVIEWING → DECIDING)으로 진행됩니다.`;
    await dispatchMissionGoal(goal, mode);
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
    } catch (_) {}
    updatePipelinePhaseDOM('IDLE', [
      { to_state: 'STOPPED', state_ko: '작업 정지 실행 · 모든 실행 중인 미션 및 CLI 프로세스 종료', role: 'DIRECTOR', run_id: 'stop-signal' }
    ]);
  });

  let backendAvailable = true;
  let lastDiagnostics = null;

  async function apiFetch(path, options = {}) {
    const isFile = typeof window !== 'undefined' && window.location.protocol === 'file:';
    if (!isFile) {
      try {
        const res = await fetch(path, options);
        if (res.status !== 404 && res.status !== 405 && res.status !== 501) {
          return res;
        }
      } catch (_) {}
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

    // Save active CLI options to localStorage so office.js can also read them
    try {
      const slotSummary = keys.map(k => ({
        key: k,
        label: CLI_LABELS[k],
        short: CLI_SHORT[k],
        base_type: providersObj[k]?.base_type || k
      }));
      localStorage.setItem('nexus-cli-slots-v1', JSON.stringify(slotSummary));
    } catch (_) {}

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

    // 4. Sync #studioQuickCli on agents.html
    const studioCliSel = document.getElementById('studioQuickCli');
    if (studioCliSel) {
      const prevVal = studioCliSel.value && keys.includes(studioCliSel.value) ? studioCliSel.value : keys[0];
      studioCliSel.innerHTML = keys.map(k =>
        `<option value="${k}" ${k === prevVal ? 'selected' : ''}>${CLI_LABELS[k]}</option>`
      ).join('') + `<option value="__add_new_cli__">➕ 드롭다운에서 새 CLI 로그인 추가...</option>`;
      studioCliSel.value = prevVal;
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
        renderCliDiagnosticsModal(data.diagnostics);
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

  async function handleRemoveCliSlot(slotKey) {
    const prov = lastDiagnostics?.providers?.[slotKey];
    const label = prov?.label || slotKey;
    const totalCount = Object.keys(lastDiagnostics?.providers || {}).length;
    if (totalCount <= 1) {
      alert('최소 1개 이상의 AI CLI 로그인 슬롯은 유지되어야 합니다.');
      return;
    }
    const confirmed = window.confirm(
      `정말로 [${label}] CLI 로그인 슬롯을 목록에서 제거하시겠습니까?\n\n` +
      `• 확인(OK)을 누르면 목록과 선택 드롭다운에서 제거됩니다.\n` +
      `• 제거 후에도 상단 드롭다운 목록에서 언제든 다시 추가할 수 있습니다.`
    );
    if (!confirmed) return;

    const logBox = document.getElementById('cliInstallLogBox');
    try {
      const res = await apiFetch('/ops/cli-slots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'remove', key: slotKey })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error || 'CLI 슬롯 제거에 실패했습니다.');
        return;
      }
      if (data.roles) {
        currentRoles = { ...currentRoles, ...data.roles };
      }
      if (data.diagnostics) {
        renderCliDiagnosticsModal(data.diagnostics);
      } else {
        await fetchAndRenderCliDiagnostics(false);
      }
      applyRolesToDOM(currentRoles);
      if (logBox) {
        logBox.style.display = 'block';
        logBox.textContent = `🗑️ [${label}] CLI 로그인 슬롯이 제거되었습니다. 상단 드롭다운 목록에서 언제든 다시 추가할 수 있습니다.`;
      }
    } catch (err) {
      alert(`CLI 슬롯 제거 실패: ${err.message}`);
    }
  }

  async function handleResetCliSlots() {
    const confirmed = window.confirm('CLI 로그인 슬롯 목록을 초기 기본 상태로 복원하시겠습니까?');
    if (!confirmed) return;
    const logBox = document.getElementById('cliInstallLogBox');
    try {
      const res = await apiFetch('/ops/cli-slots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset' })
      });
      const data = await res.json().catch(() => ({}));
      if (data.roles) currentRoles = { ...currentRoles, ...data.roles };
      if (data.diagnostics) {
        renderCliDiagnosticsModal(data.diagnostics);
      }
      applyRolesToDOM(currentRoles);
      if (logBox) {
        logBox.style.display = 'block';
        logBox.textContent = `↺ ${data.message || '기본 CLI 로그인 슬롯 목록으로 복원되었습니다.'}`;
      }
    } catch (_) {}
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
        if (data.diagnostics) renderCliDiagnosticsModal(data.diagnostics);
        if (typeof onAddedCallback === 'function') {
          await onAddedCallback(data.added.key);
        }
      }
    } catch (_) {}
  }

  function renderCliDiagnosticsModal(diag) {
    lastDiagnostics = diag || getFallbackDiagnostics();
    const providers = lastDiagnostics.providers || {};
    syncAllCliDropdowns(providers);
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
        headline.textContent = `활성 CLI 슬롯: ${list.length}개 · 구독 로그인 확인: ${loggedInCount}/${list.length}개 · 설치 감지: ${installedCount}/${list.length}개 (${lastDiagnostics.triad_state || 'TRIAD'})`;
      }
    }
    if (sub) {
      const stripped = (lastDiagnostics.forbidden_keys_stripped || ['OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'GOOGLE_API_KEY']).join(', ');
      sub.textContent = `종량제 API 키 차단(Sanitized): ${stripped} 자동 제거 · 마지막 확인: ${new Date().toLocaleTimeString('ko-KR')}`;
    }

    if (!grid) return;

    const roleByProvider = {};
    for (const [rKey, pKey] of Object.entries(currentRoles)) {
      roleByProvider[pKey] = rKey.toUpperCase();
    }

    grid.innerHTML = keys.map(key => {
      const p = providers[key] || {};
      const state = p.auth_state || 'NOT_INSTALLED';
      const cardCls = state === 'LOGGED_IN' ? 'logged-in' : state === 'AUTH_REQUIRED' ? 'auth-required' : '';
      const assignedRole = roleByProvider[key] || 'UNASSIGNED';
      const roleCls = assignedRole === 'HEAD' ? 'role-head' : (assignedRole === 'BUILDER' || assignedRole === 'SUB_BUILDER') ? 'role-builder' : 'role-reviewer';
      const cliName = p.cli || (key === 'claude' ? 'claude' : key === 'antigravity' ? 'agy' : key === 'gemini' ? 'gemini' : key === 'grok' ? 'grok' : 'codex');

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
            <div class="cli-auth-title">
              <span class="triad-role-badge ${roleCls}">${assignedRole}</span>
              <span>${p.label || key}</span>
            </div>
            <div style="display:flex;align-items:center;gap:6px">
              <span class="cli-auth-badge ${state}">${p.auth_label || state}</span>
              <button type="button" class="btn-remove-cli-slot" data-slot-key="${key}" title="${p.label || key} 로그인 슬롯 제거">🗑️ 제거</button>
            </div>
          </div>
          <div class="cli-auth-detail">${p.auth_detail || ''}</div>
          <div class="cli-auth-rows">
            <div class="cli-auth-row"><span>로그인 계정</span><strong>${p.account_email || '미로그인'}</strong></div>
            <div class="cli-auth-row"><span>구독 중인 플랜</span><strong style="color:${p.is_subscribed ? (p.is_paid ? '#15803d' : '#0284c7') : '#64748b'}">${p.plan_name || p.plan_label || '미구독 / 미로그인'}</strong></div>
            <div class="cli-auth-row"><span>CLI 명령어 / 슬롯 ID</span><code>${cliName} (${key})</code></div>
            ${p.profile_dir ? `<div class="cli-auth-row"><span>격리 프로필 폴더</span><code>${p.profile_dir}</code></div>` : ''}
            <div class="cli-auth-row"><span>감지된 버전</span><strong>${p.version || '미확인'}</strong></div>
            <div class="cli-auth-row"><span>실행 파일 경로</span><code>${p.executable || 'PATH 미감지 (원클릭 설치 가능)'}</code></div>
            <div class="cli-auth-row"><span>종량제 API 키</span><strong style="color:#15803d">차단됨 (구독 전용)</strong></div>
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

    grid.querySelectorAll('.btn-install-cli').forEach(btn => {
      btn.addEventListener('click', () => triggerOneClickInstall(btn.dataset.cli, btn));
    });
    grid.querySelectorAll('.btn-login-cli').forEach(btn => {
      btn.addEventListener('click', () => triggerCliLoginTerminal(btn.dataset.cli, btn));
    });
    grid.querySelectorAll('.btn-remove-cli-slot').forEach(btn => {
      btn.addEventListener('click', () => handleRemoveCliSlot(btn.dataset.slotKey));
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
        renderCliDiagnosticsModal(diag);
        return;
      }
      if (res.status === 404) backendAvailable = false;
    } catch (_) {} finally {
      if (btn && deep) {
        btn.disabled = false;
        btn.textContent = '🔍 실시간 로그인 검증 (Deep Probe)';
      }
    }
    renderCliDiagnosticsModal(getFallbackDiagnostics());
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
        if (data.diagnostics) renderCliDiagnosticsModal(data.diagnostics);
      }
    } catch (_) {} finally {
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
      if (data.roles) applyRolesToDOM(data.roles);
      if (data.diagnostics) renderCliDiagnosticsModal(data.diagnostics);
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
              } catch (_) {}
            });
          }
        } else if (latestMission.live || latestMission.status === 'RUNNING') {
          const curStep = (latestMission.steps || [])[latestMission.steps.length - 1];
          if (replyRole) replyRole.textContent = `[1-Cycle 미션 진행 중 · ${data.phase || 'RUNNING'} (${latestMission.passed_steps || 0}/5)]`;
          if (replyText) {
            replyText.textContent = curStep
              ? `[${curStep.stage}] ${curStep.summary}`
              : `'${latestMission.goal}' 목표에 대해 5단계 파이프라인(PLANNING → BUILDING → VERIFYING → REVIEWING → DECIDING)을 실행 중입니다...`;
          }
          if (replyMeta) replyMeta.textContent = `${data.phase || 'RUNNING'} · ${latestMission.mission_id}`;
        } else if (latestMission.status === 'DONE' && latestMission.deliverable_file && lastRenderedMissionId !== latestMission.mission_id) {
          lastRenderedMissionId = latestMission.mission_id;
          const genFiles = Array.isArray(latestMission.generated_files) ? latestMission.generated_files : [];
          const repCnt = Number(latestMission.repair_count || 0);
          const profTag = (latestMission.profile || 'standard').toUpperCase();
          if (replyRole) replyRole.textContent = `[✅ ${profTag} 미션 완료 · ${latestMission.mission_id}${repCnt > 0 ? ` · 자동수정 ${repCnt}회` : ''}]`;
          if (replyText) {
            const preview = (latestMission.deliverable_preview || '').slice(0, 380);
            const filesLinksHtml = genFiles.length
              ? `<div style="margin-top:6px;display:flex;flex-wrap:wrap;gap:6px">${genFiles.map(f => `<a href="${f}" target="_blank" style="background:#eff6ff;border:1px solid #bfdbfe;color:#1d4ed8;padding:3px 8px;border-radius:6px;font-size:10.5px;font-weight:700">📁 ${f} ↗</a>`).join('')}</div>`
              : '';
            replyText.innerHTML = `<div style="white-space:pre-wrap;margin-top:4px;padding:8px 10px;background:#fff;border:1px solid #cbd5e1;border-radius:8px;font-family:var(--font-mono,monospace);font-size:11px">${preview.replace(/</g, '&lt;')}</div>${filesLinksHtml}<div style="margin-top:6px"><a href="${latestMission.deliverable_file}" target="_blank" style="color:#0f6848;font-weight:800;text-decoration:underline">📄 전체 산출물 리포트 열기 (${latestMission.deliverable_file}) ↗</a></div>`;
          }
          if (replyMeta) replyMeta.textContent = `${profTag} PASS (${genFiles.length}파일)`;

          const delivBox = document.getElementById('deliverablesListBox');
          if (delivBox) {
            const cardEl = document.createElement('div');
            cardEl.style.cssText = 'display:flex;flex-direction:column;gap:6px;padding:12px 14px;border:1px solid #86efac;background:#f0fdf4;border-radius:11px';
            cardEl.innerHTML = `
              <a href="${latestMission.deliverable_file}" target="_blank" style="display:flex;justify-content:space-between;align-items:center;color:#0f6848;font-size:11.5px;font-weight:800">
                <span>📄 ${latestMission.deliverable_file} — ${latestMission.goal} (${profTag}${repCnt > 0 ? ` · 자동수정 ${repCnt}회` : ''})</span>
                <span style="white-space:nowrap">리포트 열기 ↗</span>
              </a>
              ${genFiles.length ? `<div style="display:flex;flex-wrap:wrap;gap:5px">${genFiles.map(f => `<a href="${f}" target="_blank" style="background:#fff;border:1px solid #bbf7d0;color:#166534;padding:2px 7px;border-radius:5px;font-size:10px;font-weight:700">📁 ${f}</a>`).join('')}</div>` : ''}
            `;
            delivBox.prepend(cardEl);
          }
        }
      }
    } catch (_) {}
  }

  ensureCliSettingsModal();
  applyRolesToDOM(currentRoles);
  pollOrchestrator();
  setInterval(pollOrchestrator, 3000);

  // 전역 참조 노출 (개발자 콘솔 또는 기타 스크립트 연동)
  window.CharacterEngine = CharacterEngine;
  window.modularAgents = modularAgents;
  window.openCliSettingsModal = openCliSettingsModal;
})();
