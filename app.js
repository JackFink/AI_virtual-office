(() => {
  const page = document.body.dataset.page;
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
        const matchFilter = activeFilter === 'all' || row.dataset.status === activeFilter;
        const matchSearch = !q || row.dataset.name.toLowerCase().includes(q);
        const show = matchFilter && matchSearch;
        row.style.display = show ? 'grid' : 'none';
        if (show) visible++;
      });
      if (count) count.textContent = `${visible}개 표시 중 · 샘플 직원 8명`;
      const empty = document.getElementById('noAgents');
      if (!visible && !empty) {
        const node = document.createElement('div'); node.id = 'noAgents'; node.className = 'empty-state'; node.textContent = '조건에 맞는 AI 직원을 찾지 못했습니다.';
        document.getElementById('agentList')?.appendChild(node);
      } else if (visible && empty) empty.remove();
    }
    chips.forEach(chip => chip.addEventListener('click', () => {
      activeFilter = chip.dataset.filter;
      chips.forEach(c => c.classList.toggle('active', c === chip));
      filterRows();
    }));
    search?.addEventListener('input', filterRows);
    document.getElementById('addAgent')?.addEventListener('click', () => {
      alert('샘플 페이지입니다. 실제 서비스에서는 직원 생성 폼과 백엔드 API를 연결합니다.');
    });
  }
})();

// Dashboard character library + modular part configuration demo.
if (document.body.dataset.page === 'agents') {
  const characters = [
    {id:1,name:'Research AI',role:'리서치 팀 · 자료 분석',status:'running',statusLabel:'작업 중',parts:{hair:'H01',face:'F03',top:'O02',bottom:'P01',accessory:'A00'}},
    {id:2,name:'Writer AI',role:'콘텐츠 팀 · 초안 작성',status:'review',statusLabel:'검토 대기',parts:{hair:'H02',face:'F02',top:'O04',bottom:'P02',accessory:'A00'}},
    {id:3,name:'Ops AI',role:'운영 팀 · 워크플로 관리',status:'running',statusLabel:'작업 중',parts:{hair:'H03',face:'F03',top:'O07',bottom:'P04',accessory:'A02'}},
    {id:4,name:'Designer AI',role:'디자인 팀 · 시안 제작',status:'idle',statusLabel:'대기 중',parts:{hair:'H04',face:'F04',top:'O08',bottom:'P03',accessory:'A00'}},
    {id:5,name:'Executive AI',role:'기획 팀 · 요약 보고',status:'running',statusLabel:'작업 중',parts:{hair:'H05',face:'F05',top:'O10',bottom:'P05',accessory:'A03'}},
    {id:6,name:'Data AI',role:'데이터 팀 · 데이터 정리',status:'idle',statusLabel:'대기 중',parts:{hair:'H06',face:'F06',top:'O03',bottom:'P04',accessory:'A00'}},
    {id:7,name:'Support AI',role:'고객 지원 · 문의 분류',status:'running',statusLabel:'작업 중',parts:{hair:'H07',face:'F07',top:'O05',bottom:'P02',accessory:'A00'}},
    {id:8,name:'Project AI',role:'프로젝트 팀 · 일정 관리',status:'review',statusLabel:'검토 대기',parts:{hair:'H08',face:'F08',top:'O09',bottom:'P05',accessory:'A00'}},
    {id:9,name:'Analyst AI',role:'분석 팀 · 지표 분석',status:'running',statusLabel:'작업 중',parts:{hair:'H09',face:'F09',top:'O06',bottom:'P01',accessory:'A00'}},
    {id:10,name:'QA AI',role:'품질 팀 · 결과 검증',status:'idle',statusLabel:'대기 중',parts:{hair:'H10',face:'F10',top:'O10',bottom:'P06',accessory:'A01'}},
    {id:11,name:'Planner AI',role:'전략 팀 · 업무 계획',status:'running',statusLabel:'작업 중',parts:{hair:'H11',face:'F11',top:'O02',bottom:'P03',accessory:'A00'}},
    {id:12,name:'Finance AI',role:'재무 팀 · 비용 정리',status:'review',statusLabel:'검토 대기',parts:{hair:'H12',face:'F12',top:'O11',bottom:'P05',accessory:'A01'}},
    {id:13,name:'Creative AI',role:'크리에이티브 · 아이디어',status:'idle',statusLabel:'대기 중',parts:{hair:'H13',face:'F13',top:'O08',bottom:'P03',accessory:'A00'}},
    {id:14,name:'Reviewer AI',role:'검토 팀 · 문서 검수',status:'running',statusLabel:'작업 중',parts:{hair:'H14',face:'F14',top:'O09',bottom:'P05',accessory:'A01'}},
    {id:15,name:'Coordinator AI',role:'협업 팀 · 업무 조정',status:'idle',statusLabel:'대기 중',parts:{hair:'H15',face:'F15',top:'O05',bottom:'P02',accessory:'A00'}},
    {id:16,name:'Marketing AI',role:'마케팅 팀 · 캠페인 운영',status:'running',statusLabel:'작업 중',parts:{hair:'H16',face:'F16',top:'O12',bottom:'P06',accessory:'A00'}},
    {id:17,name:'Developer AI',role:'개발 팀 · 코드 작성',status:'running',statusLabel:'작업 중',parts:{hair:'H17',face:'F17',top:'O13',bottom:'P05',accessory:'A00'}},
    {id:18,name:'CRM AI',role:'고객 데이터 · 기록 갱신',status:'review',statusLabel:'검토 대기',parts:{hair:'H18',face:'F18',top:'O14',bottom:'P06',accessory:'A01'}},
    {id:19,name:'Legal AI',role:'컴플라이언스 · 조항 검토',status:'idle',statusLabel:'대기 중',parts:{hair:'H19',face:'F19',top:'O15',bottom:'P04',accessory:'A00'}},
    {id:20,name:'HR AI',role:'인사 팀 · 온보딩 지원',status:'running',statusLabel:'작업 중',parts:{hair:'H20',face:'F20',top:'O16',bottom:'P06',accessory:'A01'}}
  ];

  const grid = document.getElementById('characterGrid');
  const fields = {
    hair: document.getElementById('partHair'),
    face: document.getElementById('partFace'),
    top: document.getElementById('partTop'),
    bottom: document.getElementById('partBottom'),
    accessory: document.getElementById('partAccessory')
  };
  const optionSets = {
    hair: Array.from({length:20}, (_, i) => `H${String(i + 1).padStart(2, '0')}`),
    face: Array.from({length:20}, (_, i) => `F${String(i + 1).padStart(2, '0')}`),
    top: Array.from({length:20}, (_, i) => `O${String(i + 1).padStart(2, '0')}`),
    bottom: Array.from({length:20}, (_, i) => `P${String(i + 1).padStart(2, '0')}`),
    accessory: ['A00', ...Array.from({length:12}, (_, i) => `A${String(i + 1).padStart(2, '0')}`)]
  };
  const state = { selectedId: 1, values: {...characters[0].parts} };
  const titleMap = {hair:'헤어',face:'얼굴/표정',top:'상의/의상',bottom:'하의/신발',accessory:'액세서리'};

  Object.entries(fields).forEach(([key, select]) => {
    if (!select) return;
    select.innerHTML = optionSets[key].map(value => `<option value="${value}">${value} · ${titleMap[key]}</option>`).join('');
    select.addEventListener('change', () => {
      state.values[key] = select.value;
      updateJson();
    });
  });

  function configObject(character) {
    return {
      agentId: `agent-${String(character.id).padStart(2, '0')}`,
      characterParts: {
        hair: state.values.hair,
        face: state.values.face,
        top: state.values.top,
        bottom: state.values.bottom,
        accessory: state.values.accessory
      }
    };
  }

  function updateJson() {
    const selected = characters.find(item => item.id === state.selectedId) || characters[0];
    const output = document.getElementById('characterConfigPreview');
    if (output) output.textContent = JSON.stringify(configObject(selected), null, 2);
  }

  function selectCharacter(id) {
    const selected = characters.find(item => item.id === id);
    if (!selected) return;
    state.selectedId = selected.id;
    state.values = {...selected.parts};
    grid?.querySelectorAll('.character-tile').forEach(tile => {
      const active = Number(tile.dataset.characterId) === selected.id;
      tile.classList.toggle('selected', active);
      tile.setAttribute('aria-pressed', String(active));
    });
    const image = document.getElementById('selectedCharacterImage');
    if (image) {
      image.src = `assets/characters/agent-${String(selected.id).padStart(2, '0')}.png`;
      image.alt = `${selected.name} 픽셀 캐릭터 미리보기`;
    }
    const num = document.getElementById('selectedCharacterNumber');
    const name = document.getElementById('selectedCharacterName');
    const role = document.getElementById('selectedCharacterRole');
    const status = document.getElementById('selectedCharacterStatus');
    if (num) num.textContent = `AGENT ${String(selected.id).padStart(2, '0')} / 20`;
    if (name) name.textContent = selected.name;
    if (role) role.textContent = selected.role;
    if (status) {
      status.textContent = selected.statusLabel;
      status.className = `status ${selected.status}`;
    }
    Object.entries(fields).forEach(([key, field]) => { if (field) field.value = state.values[key]; });
    const feedback = document.getElementById('characterCopyFeedback');
    if (feedback) feedback.textContent = '파츠 ID와 JSON 설정은 즉시 갱신됩니다. 개별 파츠 이미지 합성은 분리된 투명 PNG 에셋을 연결한 뒤 구현할 수 있습니다.';
    updateJson();
  }

  if (grid) {
    grid.innerHTML = characters.map(character => {
      const id = String(character.id).padStart(2, '0');
      return `<button class="character-tile${character.id === state.selectedId ? ' selected' : ''}" type="button" data-character-id="${character.id}" aria-pressed="${character.id === state.selectedId}" aria-label="${character.name} 캐릭터 선택">
        <span class="character-tile-art"><img src="assets/characters/agent-${id}.png" alt="" loading="lazy" width="64" height="101"></span>
        <span class="character-tile-id">AGENT ${id}</span><span class="character-tile-name">${character.name}</span>
      </button>`;
    }).join('');
    grid.addEventListener('click', event => {
      const button = event.target.closest('.character-tile');
      if (button) selectCharacter(Number(button.dataset.characterId));
    });
  }

  document.getElementById('copyCharacterConfig')?.addEventListener('click', async () => {
    const selected = characters.find(item => item.id === state.selectedId) || characters[0];
    const text = JSON.stringify(configObject(selected), null, 2);
    const feedback = document.getElementById('characterCopyFeedback');
    try {
      await navigator.clipboard.writeText(text);
      if (feedback) feedback.textContent = '설정 JSON을 클립보드에 복사했습니다.';
    } catch (error) {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.select();
      const copied = document.execCommand('copy');
      textArea.remove();
      if (feedback) feedback.textContent = copied ? '설정 JSON을 클립보드에 복사했습니다.' : '복사할 JSON을 위 코드 영역에서 직접 선택해 주세요.';
    }
  });

  selectCharacter(1);
}
