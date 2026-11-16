/**
 * NEXUS Virtual Office - Continuous Multi-Floor Building & Face-to-Face 6-Seat Controller
 * 1) 엘리베이터 계단 제거 완료 (assets/maple-gm-office.svg 평탄화 슬래브)
 * 2) 좌석 배치는 앞면(뒷줄)과 뒷면(앞줄)이 서로 마주보는 총 6자리 기본 구성
 * 3) 한 층의 자리(좌석) 수를 추가(＋)/제거(－)할 수 있는 기능 지원
 * 4) 자리가 없는 캐릭터는 자동으로 다른 층(2F -> 3F -> 4F...)의 빈자리로 순차 배치
 * 5) 맨 아래가 1층(1F)부터 위로 순차 상승하는 일체형 빌딩 구조 & 선택 층 중앙 정렬 & 드래그 앤 드롭 지원
 */
(() => {
  'use strict';

  const sceneCard = document.getElementById('officeSceneCard');
  const viewportEl = document.getElementById('maple2dViewport');
  const towerStackEl = document.getElementById('mapleTowerStack');
  if (!sceneCard || !viewportEl || !towerStackEl) return;

  const CLI_LABELS = {
    claude: 'Claude Code (claude)',
    antigravity: 'Google Antigravity (agy)',
    openai: 'OpenAI Codex (codex)',
    grok: 'xAI Grok (grok)'
  };
  const CLI_SHORT = {
    claude: 'Claude',
    antigravity: 'Antigravity',
    openai: 'Codex',
    grok: 'Grok'
  };

  const ROLE_STORAGE_KEY = 'nexus-triad-roles-v1';
  function loadLocalRoles() {
    try {
      const parsed = JSON.parse(localStorage.getItem(ROLE_STORAGE_KEY) || 'null');
      if (parsed && parsed.head && parsed.builder && parsed.reviewer) return parsed;
    } catch (_) {}
    return { head: 'claude', builder: 'antigravity', reviewer: 'openai' };
  }
  let currentRoles = loadLocalRoles();

  // ==========================================================================
  // [1] 앞면(뒷줄)과 뒷면(앞줄)이 마주보는 좌석 카탈로그 (기본 6석 + 확장 최대 10석)
  // ==========================================================================
  const MASTER_SEAT_CATALOG = [
    // --- 아일랜드 테이블 #1 (좌측 마주보는 2자리) ---
    { xPct: 31.5, yPct: 79.0, facing: 'front', flip: false, podGroup: 1, label: '1번석 · 좌측 뒷줄 (앞면)' },
    { xPct: 31.5, yPct: 86.2, facing: 'back',  flip: false, podGroup: 1, label: '2번석 · 좌측 앞줄 (뒷면·마주보기)' },

    // --- 아일랜드 테이블 #2 (중앙 마주보는 2자리) ---
    { xPct: 55.0, yPct: 79.0, facing: 'front', flip: false, podGroup: 2, label: '3번석 · 중앙 뒷줄 (앞면)' },
    { xPct: 55.0, yPct: 86.2, facing: 'back',  flip: true,  podGroup: 2, label: '4번석 · 중앙 앞줄 (뒷면·마주보기)' },

    // --- 아일랜드 테이블 #3 (우측 마주보는 2자리) => 여기까지 기본 6자리! ---
    { xPct: 78.5, yPct: 79.0, facing: 'front', flip: true,  podGroup: 3, label: '5번석 · 우측 뒷줄 (앞면)' },
    { xPct: 78.5, yPct: 86.2, facing: 'back',  flip: true,  podGroup: 3, label: '6번석 · 우측 앞줄 (뒷면·마주보기)' },

    // --- 좌석 추가(＋) 시 확장 가능한 서브 마주보기 좌석 (7~10번석) ---
    { xPct: 43.2, yPct: 79.0, facing: 'front', flip: false, podGroup: 4, label: '7번석 · 서브A 뒷줄 (앞면)' },
    { xPct: 43.2, yPct: 86.2, facing: 'back',  flip: false, podGroup: 4, label: '8번석 · 서브A 앞줄 (뒷면·마주보기)' },
    { xPct: 66.8, yPct: 79.0, facing: 'front', flip: true,  podGroup: 5, label: '9번석 · 서브B 뒷줄 (앞면)' },
    { xPct: 66.8, yPct: 86.2, facing: 'back',  flip: true,  podGroup: 5, label: '10번석 · 서브B 앞줄 (뒷면·마주보기)' }
  ];

  const DEFAULT_SEATS_PER_FLOOR = 6;
  const MIN_SEATS_PER_FLOOR = 1;
  const MAX_SEATS_PER_FLOOR = MASTER_SEAT_CATALOG.length; // 10

  function renderSeatPodSvg(slot, seatIdx) {
    if (slot.facing === 'front') {
      return `
        <div class="maple-seat-pod facing-front" style="left:${slot.xPct}%;top:${slot.yPct + 3.8}%">
          <svg viewBox="0 0 120 82">
            <rect x="41" y="4" width="38" height="32" rx="6" fill="#495057" stroke="#212529" stroke-width="2.2"/>
            <rect x="8" y="34" width="104" height="40" rx="2" fill="#d4a373" stroke="#2b2d38" stroke-width="2.2"/>
            <rect x="4" y="30" width="112" height="8" rx="2" fill="#e6ccb2" stroke="#2b2d38" stroke-width="2.2"/>
            <rect x="20" y="16" width="34" height="20" rx="2" fill="#3b4252" stroke="#1e2028" stroke-width="2"/>
            <rect x="23" y="19" width="28" height="14" fill="#74c0fc"/>
            <rect x="66" y="16" width="34" height="20" rx="2" fill="#3b4252" stroke="#1e2028" stroke-width="2"/>
            <rect x="69" y="19" width="28" height="14" fill="#63e6be"/>
            <text x="104" y="68" text-anchor="end" font-size="9" font-weight="800" fill="#5c3c24">#${seatIdx + 1}</text>
          </svg>
        </div>
      `;
    }
    return `
      <div class="maple-seat-pod facing-back" style="left:${slot.xPct}%;top:${slot.yPct + 2.2}%">
        <svg viewBox="0 0 120 82">
          <line x1="60" y1="48" x2="60" y2="72" stroke="#212529" stroke-width="4.5"/>
          <line x1="40" y1="72" x2="80" y2="72" stroke="#212529" stroke-width="4" stroke-linecap="round"/>
          <circle cx="42" cy="76" r="3" fill="#1e2028"/>
          <circle cx="60" cy="76" r="3" fill="#1e2028"/>
          <circle cx="78" cy="76" r="3" fill="#1e2028"/>
          <rect x="36" y="42" width="48" height="9" rx="4" fill="#343a40" stroke="#212529" stroke-width="2"/>
          <rect x="40" y="12" width="40" height="34" rx="6" fill="#495057" stroke="#212529" stroke-width="2.2"/>
          <rect x="46" y="17" width="28" height="22" rx="3" fill="#5c646d"/>
          <text x="60" y="31" text-anchor="middle" font-size="8.5" font-weight="800" fill="#dee2e6">#${seatIdx + 1}</text>
        </svg>
      </div>
    `;
  }

  // ==========================================================================
  // [2] 층(Floors) & 층별 좌석 수(seatCount) & 자동 오토배치(Overflow) 관리
  // ==========================================================================
  const FLOORS_STORAGE_KEY = 'nexus-office-floors-v6';
  const PLACEMENT_STORAGE_KEY = 'nexus-gm-office-svg-placements-v6';

  function loadFloors() {
    try {
      const parsed = JSON.parse(localStorage.getItem(FLOORS_STORAGE_KEY) || 'null');
      if (Array.isArray(parsed) && parsed.length && parsed.every(f => Number.isInteger(f.id))) {
        return parsed.map(f => ({
          ...f,
          seatCount: Math.max(MIN_SEATS_PER_FLOOR, Math.min(MAX_SEATS_PER_FLOOR, Number(f.seatCount) || DEFAULT_SEATS_PER_FLOOR))
        }));
      }
    } catch (_) {}
    // 초기 캐릭터가 5명이므로 1층(6석) + 2층(6석, 확장 대비) 기본 제공
    return [
      { id: 1, name: '1층', description: 'GM 본관 · 마주보는 6석', seatCount: 6 },
      { id: 2, name: '2층', description: '개발 스튜디오 · 마주보는 6석', seatCount: 6 }
    ];
  }
  let floors = loadFloors();
  let activeFloorId = 1;

  function saveFloors() {
    try { localStorage.setItem(FLOORS_STORAGE_KEY, JSON.stringify(floors)); } catch (_) {}
  }

  function getFloorSeats(floorId) {
    const fl = floors.find(f => f.id === floorId);
    const count = fl ? fl.seatCount : DEFAULT_SEATS_PER_FLOOR;
    return MASTER_SEAT_CATALOG.slice(0, count);
  }

  function getActiveCharIds() {
    const studioList = Array.isArray(window.modularAgents) && window.modularAgents.length
      ? window.modularAgents
      : [];
    if (studioList.length) return studioList.map(a => a.id);
    return ['01', '02', '03', '04', '05'];
  }

  function loadSavedPlacements() {
    try {
      const parsed = JSON.parse(localStorage.getItem(PLACEMENT_STORAGE_KEY) || 'null');
      if (parsed && typeof parsed === 'object' && Object.keys(parsed).length >= 1) return parsed;
    } catch (_) {}
    const def = {};
    const cids = getActiveCharIds();
    cids.forEach((idStr, idx) => {
      const floorId = Math.floor(idx / DEFAULT_SEATS_PER_FLOOR) + 1;
      const seatIndex = idx % DEFAULT_SEATS_PER_FLOOR;
      def[idStr] = { floorId, seatIndex };
    });
    return def;
  }
  let charPlacements = loadSavedPlacements();

  function savePlacements() {
    try { localStorage.setItem(PLACEMENT_STORAGE_KEY, JSON.stringify(charPlacements)); } catch (_) {}
  }

  function rebalanceOverflowCharacters(preferredCharId = null) {
    floors.sort((a, b) => a.id - b.id);
    const occupied = new Set();
    const displacedCharIds = [];

    const allCharIds = getActiveCharIds();
    if (preferredCharId && allCharIds.includes(preferredCharId)) {
      allCharIds.splice(allCharIds.indexOf(preferredCharId), 1);
      allCharIds.unshift(preferredCharId);
    }

    for (const cid of allCharIds) {
      const p = charPlacements[cid];
      const fl = floors.find(f => f.id === p?.floorId);
      const maxSeats = fl ? fl.seatCount : 0;
      if (!fl || typeof p.seatIndex !== 'number' || p.seatIndex < 0 || p.seatIndex >= maxSeats) {
        displacedCharIds.push(cid);
        continue;
      }
      const key = `${fl.id}:${p.seatIndex}`;
      if (occupied.has(key)) {
        displacedCharIds.push(cid);
      } else {
        occupied.add(key);
      }
    }

    const movedLog = [];
    for (const cid of displacedCharIds) {
      let placed = false;
      for (const fl of floors) {
        for (let s = 0; s < fl.seatCount; s++) {
          const key = `${fl.id}:${s}`;
          if (!occupied.has(key)) {
            occupied.add(key);
            charPlacements[cid] = { floorId: fl.id, seatIndex: s };
            movedLog.push(`#${cid}→${fl.id}층(${s + 1}번석)`);
            placed = true;
            break;
          }
        }
        if (placed) break;
      }
      if (!placed) {
        const nextId = Math.max(0, ...floors.map(f => f.id)) + 1;
        const newFl = {
          id: nextId,
          name: `${nextId}층`,
          description: `자동 확장 오피스 · 마주보는 ${DEFAULT_SEATS_PER_FLOOR}석`,
          seatCount: DEFAULT_SEATS_PER_FLOOR
        };
        floors.push(newFl);
        occupied.add(`${nextId}:0`);
        charPlacements[cid] = { floorId: nextId, seatIndex: 0 };
        movedLog.push(`#${cid}→${nextId}층(1번석 신설)`);
      }
    }

    saveFloors();
    savePlacements();
    return movedLog;
  }

  rebalanceOverflowCharacters();

  function findNearestSeatOnFloor(floorId, xPct, yPct) {
    const seats = getFloorSeats(floorId);
    let bestIdx = 0;
    let bestDist = Infinity;
    seats.forEach((s, idx) => {
      const dx = s.xPct - xPct;
      const dy = (s.yPct - yPct) * 1.4;
      const d = Math.hypot(dx, dy);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = idx;
      }
    });
    return { index: bestIdx, dist: bestDist, slot: seats[bestIdx] || MASTER_SEAT_CATALOG[0] };
  }

  function getAgentAvatarSvg(studioAgent, view = 'front') {
    if (studioAgent && window.CharacterEngine && typeof window.CharacterEngine.render === 'function') {
      const pixelAgent = {
        ...studioAgent,
        parts: {
          ...(studioAgent.parts || {}),
          base: 'BASE_PIXEL',
          hair: (!studioAgent.parts?.hair || studioAgent.parts.hair === 'H00') ? 'H02' : studioAgent.parts.hair
        }
      };
      return window.CharacterEngine.render(pixelAgent, { view });
    }
    return '';
  }

  function buildAgentSpecsFromStudio() {
    const studioList = Array.isArray(window.modularAgents) && window.modularAgents.length
      ? window.modularAgents
      : [];

    const specs = [];
    studioList.forEach((sa, idx) => {
      const saved = charPlacements[sa.id] || { floorId: 1, seatIndex: 0 };
      const floorSeats = getFloorSeats(saved.floorId);
      const seatIdx = Math.min(Math.max(0, saved.seatIndex ?? 0), Math.max(0, floorSeats.length - 1));
      const slot = floorSeats[seatIdx] || MASTER_SEAT_CATALOG[0];

      const triadRole = sa.triadRole || (idx % 3 === 0 ? 'HEAD' : idx % 3 === 1 ? 'BUILDER' : 'REVIEWER');
      const cliKey = sa.cliProvider || (triadRole === 'HEAD' ? currentRoles.head : triadRole === 'BUILDER' ? currentRoles.builder : currentRoles.reviewer);
      const statusKey = triadRole === 'REVIEWER' ? 'review' : 'running';

      specs.push({
        id: sa.id === '01' ? 'head' : sa.id === '05' ? 'builder' : sa.id === '13' ? 'reviewer' : sa.id === '06' ? 'director' : `char_${sa.id}`,
        charId: sa.id,
        studioAgent: sa,
        triadRole,
        name: sa.name,
        role: `${triadRole} · ${CLI_SHORT[cliKey] || cliKey}`,
        dept: `${sa.floor} · ${triadRole} (${CLI_LABELS[cliKey] || cliKey})`,
        cliKey,
        task: `${slot.label} · ${triadRole} 업무 수행 중`,
        statusKey,
        xPct: slot.xPct,
        yPct: slot.yPct,
        facing: slot.facing || 'front',
        flip: slot.flip,
        seatIndex: seatIdx,
        seatLabel: slot.label,
        floorId: saved.floorId || 1
      });
    });
    return specs;
  }

  let agentSpecs = buildAgentSpecsFromStudio();
  let selectedAgentId = agentSpecs[0]?.id || 'head';

  let paused = false;
  let currentZoom = 1;
  let thinkingAgentId = null;
  let officeBubbleOpen = true;
  const agentChatState = {};

  const floorSwitcher = document.getElementById('floorSwitcher');
  const teamList = document.getElementById('teamList');
  const selectedAgentPanel = document.getElementById('selectedAgent');
  const summonCharSelect = document.getElementById('summonCharSelect');
  const btnSummonChar = document.getElementById('btnSummonChar');
  const btnRemoveFloorSeat = document.getElementById('btnRemoveFloorSeat');
  const btnAddFloorSeat = document.getElementById('btnAddFloorSeat');
  const floorSeatCapacityLabel = document.getElementById('floorSeatCapacityLabel');

  const speechBubbleEl = document.getElementById('officeSpeechBubble');
  const bubbleRolePillEl = document.getElementById('bubbleRolePill');
  const bubbleAgentNameEl = document.getElementById('bubbleAgentName');
  const bubbleMessageTextEl = document.getElementById('bubbleMessageText');
  const bubbleAskFormEl = document.getElementById('bubbleAskForm');
  const bubbleAskInputEl = document.getElementById('bubbleAskInput');
  const bubbleAskSendEl = document.getElementById('bubbleAskSend');
  const bubbleCloseBtnEl = document.getElementById('bubbleCloseBtn');

  function activeFloor() {
    return floors.find(f => f.id === activeFloorId) || floors[0];
  }

  function adjustFloorSeatCount(floorId, delta) {
    const fl = floors.find(f => f.id === floorId);
    if (!fl) return;
    const prevCount = fl.seatCount;
    const nextCount = Math.max(MIN_SEATS_PER_FLOOR, Math.min(MAX_SEATS_PER_FLOOR, prevCount + delta));
    const note = document.getElementById('floorActionFeedback');

    if (nextCount === prevCount) {
      if (note) {
        note.textContent = delta > 0
          ? `⚠️ 한 층에는 최대 ${MAX_SEATS_PER_FLOOR}석(마주보는 5쌍)까지 배치할 수 있습니다.`
          : `⚠️ 한 층에는 최소 ${MIN_SEATS_PER_FLOOR}석 이상이 필요합니다.`;
      }
      return;
    }

    fl.seatCount = nextCount;
    fl.description = `GM 오피스 · 마주보는 ${nextCount}석`;
    const movedLog = rebalanceOverflowCharacters();
    agentSpecs = buildAgentSpecsFromStudio();
    renderFloorSwitcher();
    buildOffice();
    renderFloorAgents();

    if (note) {
      if (movedLog.length) {
        note.textContent = `🪑 ${fl.name} 좌석을 ${prevCount}석 → ${nextCount}석으로 변경했습니다. 자리가 부족해진 직원(${movedLog.join(', ')})을 다른 층 빈자리로 자동 이동했습니다!`;
      } else {
        note.textContent = `🪑 ${fl.name} 좌석을 ${prevCount}석 → ${nextCount}석으로 변경했습니다.`;
      }
    }
  }

  btnRemoveFloorSeat?.addEventListener('click', () => adjustFloorSeatCount(activeFloorId, -1));
  btnAddFloorSeat?.addEventListener('click', () => adjustFloorSeatCount(activeFloorId, +1));

  function centerSelectedFloorInView(smooth = true) {
    const targetSection = towerStackEl.querySelector(`.maple-floor-section[data-floor-id="${activeFloorId}"]`);
    if (!targetSection || !viewportEl) return;
    const viewH = viewportEl.clientHeight;
    const secTop = targetSection.offsetTop * currentZoom;
    const secH = targetSection.offsetHeight * currentZoom;
    const targetScrollTop = Math.max(0, secTop - (viewH - secH) / 2);
    viewportEl.scrollTo({
      top: targetScrollTop,
      behavior: smooth ? 'smooth' : 'auto'
    });
    setTimeout(updateSpeechBubblePosition, smooth ? 280 : 30);
  }

  function buildOffice() {
    agentSpecs = buildAgentSpecsFromStudio();

    const floorsTopToBottom = [...floors].sort((a, b) => b.id - a.id);

    const roofHtml = `
      <div class="maple-building-roof">
        <span>🏢 NEXUS GM TOWER · CONTINUOUS BUILDING (NO STAIRS)</span>
        <span>ROOFTOP · 총 ${floors.length}개 층 (맨 아래 1F → 위로 순차 상승)</span>
      </div>
    `;

    const floorsHtml = floorsTopToBottom.map(fl => {
      const assigned = agentSpecs.filter(a => a.floorId === fl.id);
      const isAct = fl.id === activeFloorId;
      const floorSeats = getFloorSeats(fl.id);

      const podsHtml = floorSeats.map((s, sIdx) => renderSeatPodSvg(s, sIdx)).join('');
      const pinsHtml = floorSeats.map((s, sIdx) => `
        <div class="maple-2d-slot-pin" data-seat-idx="${sIdx}" style="left:${s.xPct}%;top:${s.yPct}%" title="${s.label}"></div>
      `).join('');

      const actorsHtml = assigned.map(spec => {
        const viewMode = spec.facing === 'back' ? 'back' : 'front';
        const svg = getAgentAvatarSvg(spec.studioAgent, viewMode);
        const cliShort = CLI_SHORT[spec.cliKey] || spec.cliKey;
        const isSel = spec.id === selectedAgentId;
        const isThink = spec.id === thinkingAgentId;
        const rowClass = spec.facing === 'back' ? ' is-front-row' : ' is-back-row';
        const bulbIcon = isThink ? '💭' : spec.triadRole === 'HEAD' ? '💡' : spec.triadRole === 'BUILDER' ? '🔨' : '🔍';
        const dirBadge = spec.facing === 'back' ? '뒷면(마주보기)' : '앞면';

        return `
          <div class="maple-2d-actor${rowClass}${isSel ? ' is-selected' : ''}${isThink ? ' is-thinking' : ''}${spec.flip ? ' flip-x' : ''}"
               data-agent-id="${spec.id}"
               data-char-id="${spec.charId}"
               data-floor-id="${fl.id}"
               style="left:${spec.xPct}%;top:${spec.yPct}%;${paused ? 'animation-play-state:paused' : ''}"
               title="#${spec.charId} ${spec.name} · ${spec.seatLabel} [${dirBadge}] (드래그하여 자리 이동)">
            <div class="maple-2d-quest-bulb">${bulbIcon}</div>
            <div class="maple-2d-sprite" style="${paused ? 'animation:none' : ''}">${svg}</div>
            <div class="maple-2d-nametag">
              <span class="maple-2d-name-line">${spec.name}</span>
              <span class="maple-2d-guild-line role-${spec.triadRole}">«#${spec.seatIndex + 1} ${spec.triadRole} · ${cliShort}»</span>
            </div>
          </div>
        `;
      }).join('');

      return `
        <div class="maple-floor-section${isAct ? ' is-active-floor' : ''}" data-floor-id="${fl.id}">
          <div class="maple-floor-seat-controls" data-seat-ctrl-floor="${fl.id}">
            <span>🪑 ${fl.name} 좌석: <strong>${assigned.length}/${fl.seatCount}석</strong></span>
            <button type="button" class="maple-seat-ctrl-btn" data-seat-action="remove" data-floor="${fl.id}" title="${fl.name} 좌석 1개 제거 (초과 인원은 다른 층 빈자리로 자동 이동)">－</button>
            <button type="button" class="maple-seat-ctrl-btn" data-seat-action="add" data-floor="${fl.id}" title="${fl.name} 좌석 1개 추가">＋</button>
          </div>
          <div class="maple-floor-badge" data-floor-badge="${fl.id}">
            <span>F${String(fl.id).padStart(2, '0')} · ${fl.name}</span>
            <em>(마주보는 ${fl.seatCount}석 · 클릭 시 중앙 정렬)</em>
          </div>
          <img src="assets/maple-gm-office.svg?v=triad16" alt="${fl.name} GM Office SVG 배경" class="maple-2d-bg">
          <div class="maple-2d-layer" data-layer-floor="${fl.id}">
            ${podsHtml}
            ${pinsHtml}
            ${actorsHtml}
          </div>
        </div>
      `;
    }).join('');

    const baseHtml = `
      <div class="maple-building-base">
        <span>GROUND LEVEL · 1F MAIN FLOOR (맨 아래 1층 → 위로 2층 · 3층 · 4층 순차 상승)</span>
        <span>▲ 계단 없는 평탄화 엘리베이터 & 마주보는 6인 좌석</span>
      </div>
    `;

    towerStackEl.innerHTML = roofHtml + floorsHtml + baseHtml;

    towerStackEl.querySelectorAll('.maple-seat-ctrl-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const fid = Number(btn.dataset.floor);
        const delta = btn.dataset.seatAction === 'add' ? 1 : -1;
        activeFloorId = fid;
        adjustFloorSeatCount(fid, delta);
      });
    });

    towerStackEl.querySelectorAll('.maple-floor-section').forEach(secEl => {
      secEl.addEventListener('click', (e) => {
        if (e.target.closest('.maple-2d-actor') || e.target.closest('.maple-floor-seat-controls')) return;
        const fid = Number(secEl.dataset.floorId);
        if (fid && fid !== activeFloorId) {
          activeFloorId = fid;
          renderFloorSwitcher();
          buildOffice();
          renderFloorAgents();
          centerSelectedFloorInView(true);
        }
      });
    });

    bindActorDragAndClick();

    const fl = activeFloor();
    const activeAssigned = agentSpecs.filter(a => a.floorId === activeFloorId);
    const floorName = document.getElementById('officeSceneLabel');
    if (floorName && fl) {
      floorName.textContent = `일체형 빌딩 (${floors.length}개 층) · 중앙: ${fl.name} (${activeAssigned.length}/${fl.seatCount}석 착석)`;
    }
    if (floorSeatCapacityLabel && fl) {
      floorSeatCapacityLabel.textContent = `${fl.seatCount}석`;
    }
    updateSpeechBubblePosition();
  }

  function bindActorDragAndClick() {
    towerStackEl.querySelectorAll('.maple-2d-actor').forEach(actorEl => {
      actorEl.addEventListener('pointerdown', onActorPointerDown);
    });
  }

  function onActorPointerDown(e) {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    e.stopPropagation();

    const actorEl = e.currentTarget;
    const agentId = actorEl.dataset.agentId;
    const charId = actorEl.dataset.charId;
    const originFloorId = Number(actorEl.dataset.floorId);
    const originSeatIdx = charPlacements[charId]?.seatIndex ?? 0;
    const startX = e.clientX;
    const startY = e.clientY;
    let isDragging = false;
    let currentTargetFloorSection = actorEl.closest('.maple-floor-section');

    actorEl.setPointerCapture(e.pointerId);

    const onPointerMove = (moveEv) => {
      const dx = moveEv.clientX - startX;
      const dy = moveEv.clientY - startY;
      if (!isDragging && Math.hypot(dx, dy) > 5) {
        isDragging = true;
        actorEl.classList.add('is-dragging');
        towerStackEl.classList.add('is-dragging');
        speechBubbleEl?.classList.add('is-hidden');
      }
      if (!isDragging) return;

      const floorSections = Array.from(towerStackEl.querySelectorAll('.maple-floor-section'));
      let hoveredSection = currentTargetFloorSection;
      for (const sec of floorSections) {
        const r = sec.getBoundingClientRect();
        if (moveEv.clientY >= r.top && moveEv.clientY <= r.bottom) {
          hoveredSection = sec;
          break;
        }
      }

      floorSections.forEach(s => s.classList.toggle('is-drop-target', s === hoveredSection));
      if (hoveredSection && hoveredSection !== currentTargetFloorSection) {
        currentTargetFloorSection = hoveredSection;
        const targetLayer = hoveredSection.querySelector('.maple-2d-layer');
        if (targetLayer && actorEl.parentElement !== targetLayer) {
          targetLayer.appendChild(actorEl);
        }
      }

      if (currentTargetFloorSection) {
        const targetFloorId = Number(currentTargetFloorSection.dataset.floorId) || activeFloorId;
        const rect = currentTargetFloorSection.getBoundingClientRect();
        const rawXPct = ((moveEv.clientX - rect.left) / rect.width) * 100;
        const rawYPct = ((moveEv.clientY - rect.top) / rect.height) * 100;
        const clampedX = Math.max(5, Math.min(95, rawXPct));
        const clampedY = Math.max(15, Math.min(92, rawYPct));

        const nearest = findNearestSeatOnFloor(targetFloorId, clampedX, clampedY);
        currentTargetFloorSection.querySelectorAll('.maple-2d-slot-pin').forEach((pin, idx) => {
          pin.classList.toggle('is-snap-hover', idx === nearest.index);
        });

        actorEl.style.left = `${nearest.slot.xPct}%`;
        actorEl.style.top = `${nearest.slot.yPct}%`;
      }
    };

    const onPointerUp = (upEv) => {
      actorEl.removeEventListener('pointermove', onPointerMove);
      actorEl.removeEventListener('pointerup', onPointerUp);
      actorEl.removeEventListener('pointercancel', onPointerUp);
      try { actorEl.releasePointerCapture(upEv.pointerId); } catch (_) {}

      towerStackEl.classList.remove('is-dragging');
      towerStackEl.querySelectorAll('.maple-floor-section').forEach(s => s.classList.remove('is-drop-target'));
      towerStackEl.querySelectorAll('.maple-2d-slot-pin').forEach(p => p.classList.remove('is-snap-hover'));
      actorEl.classList.remove('is-dragging');

      if (!isDragging) {
        const clickedFloorId = Number(actorEl.dataset.floorId);
        if (clickedFloorId && clickedFloorId !== activeFloorId) {
          activeFloorId = clickedFloorId;
          renderFloorSwitcher();
          buildOffice();
          renderFloorAgents();
          centerSelectedFloorInView(true);
        }
        selectAgent(agentId, true);
        return;
      }

      if (currentTargetFloorSection && charId) {
        const newFloorId = Number(currentTargetFloorSection.dataset.floorId) || activeFloorId;
        const rect = currentTargetFloorSection.getBoundingClientRect();
        const rawXPct = ((upEv.clientX - rect.left) / rect.width) * 100;
        const rawYPct = ((upEv.clientY - rect.top) / rect.height) * 100;
        const nearest = findNearestSeatOnFloor(newFloorId, rawXPct, rawYPct);

        const existingOccupant = Object.entries(charPlacements).find(
          ([otherCid, pos]) => otherCid !== charId && pos.floorId === newFloorId && pos.seatIndex === nearest.index
        );

        charPlacements[charId] = { floorId: newFloorId, seatIndex: nearest.index };
        if (existingOccupant) {
          const [otherCid] = existingOccupant;
          charPlacements[otherCid] = { floorId: originFloorId, seatIndex: originSeatIdx };
        }

        rebalanceOverflowCharacters(charId);

        const floorChanged = newFloorId !== activeFloorId;
        activeFloorId = newFloorId;
        selectedAgentId = agentId;

        renderFloorSwitcher();
        buildOffice();
        renderFloorAgents();
        selectAgent(agentId, false);
        if (floorChanged) centerSelectedFloorInView(true);

        const note = document.getElementById('floorActionFeedback');
        const spec = agentSpecs.find(a => a.id === agentId);
        if (note && spec) {
          const dirText = spec.facing === 'back' ? '뒷면 마주보기' : '앞면';
          note.textContent = `✋ #${charId} ${spec.name} 캐릭터를 ${newFloorId}층 [${spec.seatLabel} · ${dirText}] 좌석에 배치했습니다!`;
        }
      }
    };

    actorEl.addEventListener('pointermove', onPointerMove);
    actorEl.addEventListener('pointerup', onPointerUp);
    actorEl.addEventListener('pointercancel', onPointerUp);
  }

  function updateSpeechBubblePosition() {
    if (!speechBubbleEl || !officeBubbleOpen) return;
    const actorEl = towerStackEl.querySelector(`.maple-2d-actor[data-agent-id="${selectedAgentId}"]`);
    if (!actorEl) {
      speechBubbleEl.classList.add('is-hidden');
      return;
    }
    const cardRect = sceneCard.getBoundingClientRect();
    const actorRect = actorEl.getBoundingClientRect();
    if (!cardRect.width || !actorRect.width) return;

    const rawX = (actorRect.left + actorRect.width / 2) - cardRect.left;
    const rawY = actorRect.top - cardRect.top - 4;

    const clampedX = Math.max(158, Math.min(cardRect.width - 158, rawX));
    const clampedY = Math.max(135, Math.min(cardRect.height - 25, rawY));

    speechBubbleEl.classList.remove('is-hidden');
    speechBubbleEl.style.left = `${clampedX.toFixed(1)}px`;
    speechBubbleEl.style.top = `${clampedY.toFixed(1)}px`;
  }

  window.addEventListener('resize', updateSpeechBubblePosition);
  viewportEl.addEventListener('scroll', updateSpeechBubblePosition, { passive: true });

  function syncSpeechBubbleContent(id) {
    const spec = agentSpecs.find(a => a.id === id);
    if (!spec || !speechBubbleEl) return;
    const cliShort = CLI_SHORT[spec.cliKey] || spec.cliKey;
    if (bubbleRolePillEl) bubbleRolePillEl.textContent = `${spec.triadRole} · ${cliShort}`;
    if (bubbleAgentNameEl) bubbleAgentNameEl.textContent = `#${spec.charId} ${spec.name}`;
    const defaultMsg = `🏢 안녕하세요! ${spec.floorId}층 [${spec.seatLabel}]에 착석한 ${spec.name}(${spec.triadRole} · ${cliShort})입니다. 무엇이든 물어보세요!`;
    const msg = agentChatState[id] || defaultMsg;
    if (bubbleMessageTextEl) bubbleMessageTextEl.textContent = msg;
    if (bubbleAskInputEl) bubbleAskInputEl.placeholder = `${spec.name}에게 질문하기...`;

    const sideReplyEl = document.getElementById('sideAskReply');
    if (sideReplyEl) sideReplyEl.textContent = msg;
  }

  async function officeApiFetch(path, options = {}) {
    if (window.location.protocol !== 'file:') {
      try {
        const res = await fetch(path, options);
        if (res.status !== 404 && res.status !== 405 && res.status !== 501) return res;
      } catch (_) {}
    }
    return fetch(`http://127.0.0.1:8080${path}`, options);
  }

  async function askOfficeAgentQuestion(id, question) {
    const spec = agentSpecs.find(a => a.id === id);
    if (!spec || !question.trim()) return;
    const q = question.trim();

    officeBubbleOpen = true;
    speechBubbleEl?.classList.remove('is-hidden');
    speechBubbleEl?.classList.add('thinking');
    thinkingAgentId = id;
    buildOffice();

    agentChatState[id] = `💭 "${q}" 질문을 읽고 답변을 작성하고 있습니다...`;
    syncSpeechBubbleContent(id);

    if (bubbleAskSendEl) { bubbleAskSendEl.disabled = true; bubbleAskSendEl.textContent = '생각 중...'; }
    const sideBtn = document.getElementById('sideAskSendBtn');
    if (sideBtn) { sideBtn.disabled = true; sideBtn.textContent = '생각 중...'; }

    try {
      const res = await officeApiFetch('/ops/cli-ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cli: (spec.triadRole || 'head').toLowerCase(),
          agent_name: spec.name,
          custom_cli: spec.cliKey,
          system_prompt: spec.studioAgent?.systemPrompt || '',
          skills: Array.isArray(spec.studioAgent?.skills) ? spec.studioAgent.skills : [],
          question: q
        })
      });
      if (res.ok) {
        const data = await res.json();
        agentChatState[id] = `💬 ${data.answer || '답변 완료'} (${data.seconds || 1}초)`;
      } else {
        agentChatState[id] = `💬 [${spec.name}] '${q}' 질문을 확인했습니다!`;
      }
    } catch (_) {
      agentChatState[id] = `💬 [${spec.name}] '${q}' 질문을 확인했습니다!`;
    } finally {
      thinkingAgentId = null;
      speechBubbleEl?.classList.remove('thinking');
      if (bubbleAskSendEl) { bubbleAskSendEl.disabled = false; bubbleAskSendEl.textContent = '질문 ↗'; }
      if (sideBtn) { sideBtn.disabled = false; sideBtn.textContent = '질문 ↗'; }
      buildOffice();
      syncSpeechBubbleContent(id);
    }
  }

  bubbleCloseBtnEl?.addEventListener('click', (e) => {
    e.stopPropagation();
    officeBubbleOpen = false;
    speechBubbleEl?.classList.add('is-hidden');
  });

  bubbleAskFormEl?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const q = bubbleAskInputEl?.value || '';
    if (!q.trim()) return;
    bubbleAskInputEl.value = '';
    await askOfficeAgentQuestion(selectedAgentId, q);
  });

  function populateSummonDropdown() {
    if (!summonCharSelect) return;
    summonCharSelect.innerHTML = agentSpecs.map(a => {
      return `<option value="${a.charId}">#${a.charId} ${a.name} (현재 ${a.floorId}층 #${a.seatIndex + 1}번석)</option>`;
    }).join('');
  }

  btnSummonChar?.addEventListener('click', () => {
    const charId = summonCharSelect?.value;
    if (!charId) return;
    const fl = activeFloor();
    const onThisFloor = agentSpecs.filter(a => a.floorId === activeFloorId);
    const usedSeats = new Set(onThisFloor.map(a => a.seatIndex));
    let targetSeat = 0;
    let foundEmpty = false;
    for (let i = 0; i < fl.seatCount; i++) {
      if (!usedSeats.has(i)) {
        targetSeat = i;
        foundEmpty = true;
        break;
      }
    }
    if (!foundEmpty) {
      targetSeat = 0;
    }

    charPlacements[charId] = { floorId: activeFloorId, seatIndex: targetSeat };
    const movedLog = rebalanceOverflowCharacters(charId);
    agentSpecs = buildAgentSpecsFromStudio();
    const summoned = agentSpecs.find(a => a.charId === charId);
    if (summoned) selectedAgentId = summoned.id;

    populateSummonDropdown();
    buildOffice();
    renderFloorAgents();
    centerSelectedFloorInView(true);

    const note = document.getElementById('floorActionFeedback');
    if (note && summoned) {
      note.textContent = movedLog.length
        ? `🏢 #${charId} ${summoned.name} 캐릭터를 ${fl.name} #${targetSeat + 1}번석에 배치하고, 초과 인원(${movedLog.join(', ')})을 다른 층 빈자리로 자동 이동했습니다!`
        : `🏢 #${charId} ${summoned.name} 캐릭터를 ${fl.name} [${summoned.seatLabel}]에 배치했습니다!`;
    }
  });

  function renderFloorSwitcher() {
    if (!floorSwitcher) return;
    floorSwitcher.innerHTML = floors.map(f => {
      const cnt = agentSpecs.filter(a => a.floorId === f.id).length;
      return `<button class="floor-chip${f.id === activeFloorId ? ' active' : ''}" type="button" data-floor-id="${f.id}" aria-pressed="${f.id === activeFloorId}"><span>F${String(f.id).padStart(2, '0')}</span><strong>${f.name} (${cnt}/${f.seatCount})</strong></button>`;
    }).join('') + '<button class="floor-chip add-floor-chip" id="addFloor" type="button">＋ 층 추가</button>';

    floorSwitcher.querySelectorAll('[data-floor-id]').forEach(button => button.addEventListener('click', () => {
      activeFloorId = Number(button.dataset.floorId);
      buildOffice();
      renderFloorSwitcher();
      renderFloorAgents();
      centerSelectedFloorInView(true);
    }));

    floorSwitcher.querySelector('#addFloor')?.addEventListener('click', () => {
      const nextId = Math.max(0, ...floors.map(f => f.id)) + 1;
      floors.push({
        id: nextId,
        name: `${nextId}층`,
        description: `확장 오피스 · 마주보는 ${DEFAULT_SEATS_PER_FLOOR}석`,
        seatCount: DEFAULT_SEATS_PER_FLOOR
      });
      activeFloorId = nextId;
      saveFloors();
      renderFloorSwitcher();
      buildOffice();
      renderFloorAgents();
      centerSelectedFloorInView(true);
    });

    const fl = activeFloor();
    const sub = document.getElementById('floorSummary');
    if (sub && fl) sub.textContent = `${fl.name} · 마주보는 ${fl.seatCount}인석 운영 중`;
    const badge = document.getElementById('floorLiveBadge');
    if (badge && fl) badge.textContent = `${fl.seatCount} SEATS`;
    populateSummonDropdown();
  }

  function renderFloorAgents() {
    const fl = activeFloor();
    const assigned = agentSpecs.filter(a => a.floorId === activeFloorId).sort((a, b) => a.seatIndex - b.seatIndex);
    const activeCount = document.getElementById('floorActiveCount');
    const reviewCount = document.getElementById('floorReviewCount');
    if (activeCount && fl) {
      activeCount.textContent = `${String(assigned.length).padStart(2, '0')} / ${String(fl.seatCount).padStart(2, '0')}`;
    }
    if (reviewCount) {
      reviewCount.textContent = String(assigned.filter(a => a.triadRole === 'REVIEWER').length).padStart(2, '0');
    }

    if (teamList) {
      if (!assigned.length) {
        teamList.innerHTML = `<div class="floor-empty"><strong>이 층(${fl?.name || ''})은 현재 ${fl?.seatCount || 6}석 모두 빈자리입니다.</strong><span>다른 층에서 캐릭터를 드래그해 오거나 위의 [＋ 이 층에 배치] 버튼을 눌러보세요!</span></div>`;
      } else {
        teamList.innerHTML = assigned.map(a => {
          const avatarSvg = getAgentAvatarSvg(a.studioAgent, 'front');
          const isSel = a.id === selectedAgentId;
          const cliTag = CLI_SHORT[a.cliKey] || a.cliKey;
          const dirBadge = a.facing === 'back' ? '뒷면(마주보기)' : '앞면';
          return `<button type="button" class="team-row${isSel ? ' selected' : ''}" data-agent="${a.id}">
            <span class="agent-avatar" title="${a.name}">${avatarSvg}</span>
            <span class="team-row-main"><strong>#${a.charId} ${a.name}</strong><small>#${a.seatIndex + 1}번석(${dirBadge}) · ${a.triadRole} · ${cliTag}</small></span>
            <span class="mini-online" style="background:${a.statusKey === 'review' ? '#f4bf60' : '#5ecda9'}"></span>
          </button>`;
        }).join('');
        teamList.querySelectorAll('.team-row').forEach(row => row.addEventListener('click', () => selectAgent(row.dataset.agent, true)));
      }
    }

    if (!assigned.length) {
      speechBubbleEl?.classList.add('is-hidden');
      if (selectedAgentPanel) selectedAgentPanel.innerHTML = '<div class="floor-empty selected-empty"><strong>빈 층 (전체 공석)</strong><span>드롭다운에서 캐릭터를 소환하거나 다른 층에서 드래그해 배치하세요.</span></div>';
    } else {
      const targetId = assigned.some(a => a.id === selectedAgentId) ? selectedAgentId : assigned[0].id;
      selectAgent(targetId, false);
    }
  }

  function selectAgent(id, focusInput = false) {
    selectedAgentId = id;
    const spec = agentSpecs.find(a => a.id === id);
    if (!spec) {
      speechBubbleEl?.classList.add('is-hidden');
      return;
    }
    officeBubbleOpen = true;
    syncSpeechBubbleContent(id);
    teamList?.querySelectorAll('.team-row').forEach(el => el.classList.toggle('selected', el.dataset.agent === id));
    towerStackEl.querySelectorAll('.maple-2d-actor').forEach(el => el.classList.toggle('is-selected', el.dataset.agentId === id));
    updateSpeechBubblePosition();

    if (selectedAgentPanel) {
      const avatarSvg = getAgentAvatarSvg(spec.studioAgent, 'front');
      const currentReply = agentChatState[id] || `🏢 안녕하세요! ${spec.floorId}층 [${spec.seatLabel}]에 착석한 ${spec.name}입니다.`;
      const floorSeats = getFloorSeats(spec.floorId);
      const seatOptionsHtml = floorSeats.map((s, idx) =>
        `<option value="${idx}" ${idx === spec.seatIndex ? 'selected' : ''}>${s.label}</option>`
      ).join('');
      const skills = Array.isArray(spec.studioAgent?.skills) ? spec.studioAgent.skills : [];
      const skillsHtml = skills.length
        ? skills.map(sk => `<span class="skill-chip" style="padding:2px 6px;font-size:8.5px">⚡ ${sk}</span>`).join('')
        : '<span style="font-size:9px;color:#94a3b8">장착된 스킬 없음</span>';
      const quotaInfo = window.NEXUS_CLI_QUOTA?.getCliQuotaStatus
        ? window.NEXUS_CLI_QUOTA.getCliQuotaStatus(spec.cliKey)
        : { isSubscribed: false, planName: '구독 확인 중', planLabel: '구독 확인 중', topSummaryText: '-', bottomMetaText: '-', statusBadgeText: '확인 중', dailyPct: 0, monthlyPct: 0, dailyRemainPct: 0, monthlyRemainPct: 0, calls: 0, maxCalls: 0, monthlyUsedCalls: 0, monthlyMaxCalls: 0, level: 'unsub' };

      selectedAgentPanel.innerHTML = `
        <div class="selected-identity">
          <div class="agent-avatar">${avatarSvg}</div>
          <div>
            <strong>#${spec.charId} ${spec.name}</strong>
            <small>${spec.floorId}층 #${spec.seatIndex + 1}번석 (${spec.facing === 'back' ? '뒷면·마주보기' : '앞면'})</small>
          </div>
        </div>
        <div class="detail-line"><span>Triad 역할</span><strong>${spec.triadRole}</strong></div>
        <div class="detail-line">
          <span>담당 AI CLI</span>
          <strong>
            <select id="officeAgentCliSelect" class="triad-cli-select" style="height:24px;font-size:10px;padding:0 6px">
              <option value="claude" ${spec.cliKey === 'claude' ? 'selected' : ''}>Claude Code (claude)</option>
              <option value="antigravity" ${spec.cliKey === 'antigravity' ? 'selected' : ''}>Google Antigravity (agy)</option>
              <option value="openai" ${spec.cliKey === 'openai' ? 'selected' : ''}>OpenAI Codex (codex)</option>
              <option value="grok" ${spec.cliKey === 'grok' ? 'selected' : ''}>xAI Grok (grok)</option>
            </select>
          </strong>
        </div>
        <div class="detail-line"><span>구독 중인 플랜</span><strong style="color:${quotaInfo.isSubscribed ? (quotaInfo.isPaid ? '#15803d' : '#0284c7') : '#64748b'}">${quotaInfo.planName || quotaInfo.planLabel}</strong></div>
        <div class="cli-quota-box" style="margin:4px 0 6px">
          <div class="cli-quota-top"><span>📅 일일 제한 (Daily)</span><strong>${quotaInfo.isSubscribed ? `${quotaInfo.calls}/${quotaInfo.maxCalls}회 (잔여 ${quotaInfo.dailyRemainPct}%)` : '미구독 (0/0회)'}</strong></div>
          <div class="cli-quota-track"><span class="cli-quota-fill ${quotaInfo.level}" style="width:${quotaInfo.isSubscribed ? quotaInfo.dailyRemainPct : 0}%"></span></div>
          <div class="cli-quota-top" style="margin-top:2px"><span>🗓️ 월간 제한 (Monthly)</span><strong>${quotaInfo.isSubscribed ? `${quotaInfo.monthlyUsedCalls}/${quotaInfo.monthlyMaxCalls}회 (잔여 ${quotaInfo.monthlyRemainPct}%)` : '미구독 (0/0회)'}</strong></div>
          <div class="cli-quota-track"><span class="cli-quota-fill ${quotaInfo.level}" style="width:${quotaInfo.isSubscribed ? quotaInfo.monthlyRemainPct : 0}%"></span></div>
          <div class="cli-quota-meta"><span>${quotaInfo.accountEmail || '로컬 세션 미연결'}</span><span class="cli-quota-pct ${quotaInfo.level}">${quotaInfo.statusBadgeText}</span></div>
        </div>
        <div class="detail-line">
          <span>이 층 좌석 변경</span>
          <strong>
            <select id="officeSeatSelect" class="triad-cli-select" style="height:24px;font-size:10px;padding:0 6px">
              ${seatOptionsHtml}
            </select>
          </strong>
        </div>
        <div style="padding:6px 0;border-top:1px solid #f0f3f6">
          <div style="font-size:9.5px;color:#8c99a8;margin-bottom:4px;display:flex;justify-content:space-between"><span>장착 스킬 (${skills.length}개)</span><a href="agents.html#characters" style="color:#ea580c;font-weight:700">+ 스킬/페르소나 편집</a></div>
          <div style="display:flex;flex-wrap:wrap;gap:4px">${skillsHtml}</div>
        </div>
        <div class="side-ask-box">
          <strong style="font-size:10px;color:#1e293b">💬 ${spec.name}에게 말풍선 질문하기</strong>
          <div class="side-ask-reply" id="sideAskReply">${currentReply}</div>
          <form class="bubble-form" id="sideAgentAskForm">
            <input type="text" class="bubble-input" id="sideAskInput" placeholder="${spec.name}에게 질문 입력..." required>
            <button type="submit" class="bubble-send" id="sideAskSendBtn">질문 ↗</button>
          </form>
        </div>
        <a class="btn small mint" href="agents.html#characters" style="width:100%;justify-content:center;margin-top:10px">🎨 캐릭터 스튜디오에서 코디/설정 변경 ↗</a>
      `;

      document.getElementById('officeAgentCliSelect')?.addEventListener('change', (e) => {
        const newCli = e.target.value;
        if (spec.studioAgent) {
          spec.studioAgent.cliProvider = newCli;
          try {
            const saved = JSON.parse(localStorage.getItem('nexus-character-ai-configs-v1') || '{}') || {};
            saved[spec.charId] = { ...(saved[spec.charId] || {}), cliProvider: newCli };
            localStorage.setItem('nexus-character-ai-configs-v1', JSON.stringify(saved));
          } catch (_) {}
        }
        agentSpecs = buildAgentSpecsFromStudio();
        buildOffice();
        renderFloorAgents();
      });

      document.getElementById('officeSeatSelect')?.addEventListener('change', (e) => {
        const newSeatIdx = Number(e.target.value);
        const prevSeatIdx = spec.seatIndex;
        const occupant = Object.entries(charPlacements).find(
          ([otherCid, pos]) => otherCid !== spec.charId && pos.floorId === spec.floorId && pos.seatIndex === newSeatIdx
        );
        charPlacements[spec.charId] = { floorId: spec.floorId, seatIndex: newSeatIdx };
        if (occupant) {
          charPlacements[occupant[0]] = { floorId: spec.floorId, seatIndex: prevSeatIdx };
        }
        rebalanceOverflowCharacters(spec.charId);
        agentSpecs = buildAgentSpecsFromStudio();
        buildOffice();
        renderFloorAgents();
        selectAgent(id, false);
      });

      document.getElementById('sideAgentAskForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const inp = document.getElementById('sideAskInput');
        const q = inp?.value || '';
        if (!q.trim()) return;
        inp.value = '';
        await askOfficeAgentQuestion(id, q);
      });
    }

    if (focusInput && bubbleAskInputEl) {
      setTimeout(() => bubbleAskInputEl.focus(), 60);
    }
  }

  function applyZoom() {
    towerStackEl.style.transform = `scale(${currentZoom.toFixed(2)})`;
    setTimeout(() => {
      centerSelectedFloorInView(true);
      updateSpeechBubblePosition();
    }, 220);
  }
  document.getElementById('zoomIn')?.addEventListener('click', () => {
    currentZoom = Math.min(1.35, currentZoom + 0.1);
    applyZoom();
  });
  document.getElementById('zoomOut')?.addEventListener('click', () => {
    currentZoom = Math.max(0.55, currentZoom - 0.1);
    applyZoom();
  });
  document.getElementById('resetView')?.addEventListener('click', () => {
    currentZoom = 1;
    applyZoom();
  });
  document.getElementById('topView')?.addEventListener('click', () => {
    currentZoom = 0.62;
    applyZoom();
  });

  const toggleBtn = document.getElementById('toggleMotion');
  toggleBtn?.addEventListener('click', () => {
    paused = !paused;
    toggleBtn.textContent = paused ? '▶ 애니메이션 재생' : 'Ⅱ 애니메이션 일시정지';
    buildOffice();
  });

  let officeBackendAvailable = true;
  async function syncOfficeWithOrchestrator() {
    if (!officeBackendAvailable) return;
    try {
      const res = await officeApiFetch('/ops/activity', { cache: 'no-store' });
      if (res.status === 404) {
        officeBackendAvailable = false;
        return;
      }
      if (!res.ok) return;
      const data = await res.json();
      if (data.roles) {
        currentRoles = { ...currentRoles, ...data.roles };
      }
      const phase = data.phase || 'IDLE';
      const badge = document.getElementById('officePipelineBadge');
      if (badge) {
        badge.textContent = `⌖ 파이프라인: ${phase === 'IDLE' ? 'STANDBY' : phase} · 마주보는 6석(앞/뒤) · 초과 인원 타 층 빈자리 자동 배치`;
      }
    } catch (_) {}
  }

  renderFloorSwitcher();
  buildOffice();
  renderFloorAgents();
  setTimeout(() => centerSelectedFloorInView(false), 60);
  syncOfficeWithOrchestrator();
  setInterval(syncOfficeWithOrchestrator, 3000);
})();
