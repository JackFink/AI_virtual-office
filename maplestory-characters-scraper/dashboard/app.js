// app.js - MapleStory Character Parts, Furniture, Pet, Building & Decoration Dashboard

(function () {
  // Slot definitions with Korean labels, icons and rendering order
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
    effect: { label: '캐시이펙트', icon: '✨', order: 14 },
    ring: { label: '반지/명찰', icon: '💍', order: 15 },
    title: { label: '칭호', icon: '🏷️', order: 16 },
    decoration: { label: '설치장식', icon: '🎀', order: 17 },
    furniture: { label: '가구/의자', icon: '🪑', order: 18 },
    pet: { label: '동행 펫', icon: '🐾', order: 19 },
    petEquip: { label: '펫 장비', icon: '🔔', order: 20 },
    building: { label: '건물 배경', icon: '🏛️', order: 21 },
  };

  // State
  const state = {
    parts: [],
    summary: {},
    currentCategory: 'all',
    currentSubCategory: 'all',
    searchQuery: '',
    onlyEquipped: false,
    currentAnimation: 'stand1',
    isAnimated: false, // 기본적으로 정지 상태!
    // 세분화된 고유 슬롯 시스템
    equipped: {
      skin: 2000,
      hair: 30000,
      face: 20000,
      overall: 1050018,
      shoes: 1072000,
      hat: 1002140
    },
    pageSize: 60,
    currentPage: 1,
    filteredParts: [],
    selectedPartForModal: null,
    avatarDebounceTimer: null
  };

  // DOM Elements
  const el = {
    avatarViewport: document.getElementById('avatarViewport'),
    avatarImg: document.getElementById('avatarImage'),
    avatarShadow: document.getElementById('avatarShadow'),
    avatarLoading: document.getElementById('avatarLoading'),
    avatarBgLayer: document.getElementById('avatarBgLayer'),
    avatarBgImg: document.getElementById('avatarBgImg'),
    bgLocationBadge: document.getElementById('bgLocationBadge'),
    animSelect: document.getElementById('animSelect'),
    btnMotionPlay: document.getElementById('btnMotionPlay'),
    motionIcon: document.getElementById('motionIcon'),
    motionLabel: document.getElementById('motionLabel'),
    motionStatusBadge: document.getElementById('motionStatusBadge'),
    companionPetBox: document.getElementById('companionPetBox'),
    companionPetImg: document.getElementById('companionPetImg'),
    companionPetName: document.getElementById('companionPetName'),
    btnRandom: document.getElementById('btnRandom'),
    btnReset: document.getElementById('btnReset'),
    btnDownloadAvatar: document.getElementById('btnDownloadAvatar'),
    btnUnequipAll: document.getElementById('btnUnequipAll'),
    equippedSlots: document.getElementById('equippedSlots'),
    equippedCountBadge: document.getElementById('equippedCountBadge'),
    statsBox: document.getElementById('statsBox'),
    categoryTabs: document.getElementById('categoryTabs'),
    btnScrollTabLeft: document.getElementById('btnScrollTabLeft'),
    btnScrollTabRight: document.getElementById('btnScrollTabRight'),
    searchInput: document.getElementById('searchInput'),
    btnClearSearch: document.getElementById('btnClearSearch'),
    subFilters: document.getElementById('subFilters'),
    galleryContainer: document.getElementById('galleryContainer'),
    currentCategoryTitle: document.getElementById('currentCategoryTitle'),
    galleryResultCount: document.getElementById('galleryResultCount'),
    chkOnlyEquipped: document.getElementById('chkOnlyEquipped'),
    partsGrid: document.getElementById('partsGrid'),
    loadMoreWrap: document.getElementById('loadMoreWrap'),
    btnLoadMore: document.getElementById('btnLoadMore'),
    loadMoreInfo: document.getElementById('loadMoreInfo'),
    emptyState: document.getElementById('emptyState'),
    // Modal
    partModal: document.getElementById('partModal'),
    modalPartIcon: document.getElementById('modalPartIcon'),
    modalPartCat: document.getElementById('modalPartCat'),
    modalPartName: document.getElementById('modalPartName'),
    modalPartId: document.getElementById('modalPartId'),
    modalPartSubCat: document.getElementById('modalPartSubCat'),
    modalPartLocalPath: document.getElementById('modalPartLocalPath'),
    modalPartApiLink: document.getElementById('modalPartApiLink'),
    btnModalEquip: document.getElementById('btnModalEquip'),
    btnModalCancel: document.getElementById('btnModalCancel'),
    btnModalClose: document.getElementById('btnModalClose'),
    toastContainer: document.getElementById('toastContainer')
  };

  const CATEGORY_NAMES = {
    all: '전체 항목',
    hair: '헤어',
    face: '표정/성형',
    clothes: '의상',
    accessories: '모자/악세사리',
    shoes: '신발',
    furniture: '가구/의자',
    pet: '펫/반려동물',
    building: '건물/공간',
    decoration: '장식품/이펙트',
    skin: '피부'
  };

  // Helper: 아이템의 독립 슬롯 키 반환
  function getItemSlot(part) {
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

  // 아이템 장착 여부 확인
  function isPartEquipped(part) {
    const slot = getItemSlot(part);
    return state.equipped[slot] === part.id;
  }

  // Initialize
  async function init() {
    loadData();
    setupEventListeners();
    updateCategoryCounts();
    renderStats();
    renderSubFilters();
    filterParts();
    renderEquippedSlots();
    updateMotionUI();
    updateCompanionPet();
    updateBuildingBackground();
    updateAvatar();
  }

  function loadData() {
    if (window.__MAPLE_DATA__) {
      state.parts = window.__MAPLE_DATA__.parts || [];
      state.summary = window.__MAPLE_DATA__.summary || {};
    } else {
      console.warn('__MAPLE_DATA__ not found. Attempting to fetch parts.json');
      fetch('parts.json')
        .then(r => r.json())
        .then(data => {
          state.parts = data;
          updateCategoryCounts();
          renderStats();
          filterParts();
          renderEquippedSlots();
          updateCompanionPet();
          updateBuildingBackground();
        })
        .catch(err => console.error('Failed to load parts.json', err));
    }
  }

  // Toast notification
  function showToast(msg) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `<span>✨</span><span>${msg}</span>`;
    el.toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 2500);
  }

  // Update counts on tabs
  function updateCategoryCounts() {
    const counts = {
      all: state.parts.length,
      hair: state.parts.filter(p => p.category === 'hair').length,
      face: state.parts.filter(p => p.category === 'face').length,
      clothes: state.parts.filter(p => p.category === 'clothes').length,
      accessories: state.parts.filter(p => p.category === 'accessories').length,
      shoes: state.parts.filter(p => p.category === 'shoes').length,
      furniture: state.parts.filter(p => p.category === 'furniture').length,
      pet: state.parts.filter(p => p.category === 'pet').length,
      building: state.parts.filter(p => p.category === 'building').length,
      decoration: state.parts.filter(p => p.category === 'decoration').length,
      skin: state.parts.filter(p => p.category === 'skin').length
    };
    for (const [key, count] of Object.entries(counts)) {
      const span = document.getElementById(`count-${key}`);
      if (span) span.textContent = count.toLocaleString();
    }
  }

  function renderStats() {
    el.statsBox.innerHTML = `
      <div class="stat-item">
        <span class="stat-num">${state.parts.length.toLocaleString()}</span>
        <span class="stat-label">총 수집 아이템</span>
      </div>
      <div class="stat-item">
        <span class="stat-num">KMS 389</span>
        <span class="stat-label">클라이언트</span>
      </div>
      <div class="stat-item">
        <span class="stat-num">10개 분류</span>
        <span class="stat-label">카테고리</span>
      </div>
    `;
  }

  // Subcategory filters based on current tab
  function renderSubFilters() {
    const subCats = new Set();
    const targetParts = state.currentCategory === 'all' 
      ? state.parts 
      : state.parts.filter(p => p.category === state.currentCategory);
    
    targetParts.forEach(p => {
      if (p.subCategory) subCats.add(p.subCategory);
    });

    if (subCats.size <= 1) {
      el.subFilters.innerHTML = '';
      return;
    }

    let html = `<button class="chip ${state.currentSubCategory === 'all' ? 'active' : ''}" data-sub="all">전체</button>`;
    Array.from(subCats).slice(0, 30).forEach(sub => {
      const isActive = state.currentSubCategory === sub ? 'active' : '';
      html += `<button class="chip ${isActive}" data-sub="${sub}">${sub}</button>`;
    });
    el.subFilters.innerHTML = html;

    el.subFilters.querySelectorAll('.chip').forEach(btn => {
      btn.addEventListener('click', () => {
        state.currentSubCategory = btn.dataset.sub;
        renderSubFilters();
        filterParts();
      });
    });
  }

  // 동작 모션 재생/정지 UI 상태 동기화
  function updateMotionUI() {
    if (state.isAnimated) {
      if (el.btnMotionPlay) {
        el.btnMotionPlay.classList.add('playing');
        if (el.motionIcon) el.motionIcon.textContent = '⏸';
        if (el.motionLabel) el.motionLabel.textContent = '정지';
        el.btnMotionPlay.title = '동작 모션 일시정지 (정지 상태로 전환)';
      }
      if (el.motionStatusBadge) {
        el.motionStatusBadge.className = 'motion-status-badge playing';
        el.motionStatusBadge.innerHTML = '<span class="pulse-dot"></span> 라이브 모션 중';
      }
      if (el.companionPetBox) {
        el.companionPetBox.style.animationPlayState = 'running';
      }
    } else {
      if (el.btnMotionPlay) {
        el.btnMotionPlay.classList.remove('playing');
        if (el.motionIcon) el.motionIcon.textContent = '▶';
        if (el.motionLabel) el.motionLabel.textContent = '재생';
        el.btnMotionPlay.title = '동작 모션 실시간 재생 시작';
      }
      if (el.motionStatusBadge) {
        el.motionStatusBadge.className = 'motion-status-badge';
        el.motionStatusBadge.innerHTML = '<span class="status-indicator">⚪</span> 정지 상태';
      }
      if (el.companionPetBox) {
        el.companionPetBox.style.animationPlayState = 'paused';
      }
    }
  }

  // 동행 펫 표시
  function updateCompanionPet() {
    if (state.equipped.pet) {
      const pet = state.parts.find(p => p.id === state.equipped.pet);
      if (pet) {
        el.companionPetBox.style.display = 'flex';
        el.companionPetName.textContent = pet.name;
        el.companionPetImg.src = pet.icon ? `../${pet.icon}` : pet.iconUrl;
      } else {
        el.companionPetBox.style.display = 'none';
      }
    } else {
      el.companionPetBox.style.display = 'none';
    }
  }

  // 건물 / 공간 배경 업데이트
  function updateBuildingBackground() {
    if (state.equipped.building) {
      const b = state.parts.find(p => p.id === state.equipped.building);
      if (b) {
        el.avatarBgLayer.style.display = 'flex';
        el.avatarBgImg.src = b.bgUrl || b.iconUrl;
        el.bgLocationBadge.textContent = b.name;
        if (el.avatarShadow) el.avatarShadow.style.opacity = '0.3';
      } else {
        el.avatarBgLayer.style.display = 'none';
        if (el.avatarShadow) el.avatarShadow.style.opacity = '1';
      }
    } else {
      el.avatarBgLayer.style.display = 'none';
      if (el.avatarShadow) el.avatarShadow.style.opacity = '1';
    }
  }

  // 이미지 캐시 및 백그라운드 프리로드 시스템
  const preloadedUrls = new Set();
  function preloadImageUrl(url) {
    if (!url || preloadedUrls.has(url)) return;
    preloadedUrls.add(url);
    const img = new Image();
    img.src = url;
  }

  // Core: 살아 움직이는 애니메이션 모션 & 가구/장식 컴포지팅 렌더러
  function updateAvatar(options = {}) {
    const isImmediate = options.immediate || false;
    const isMotionToggleOnly = options.isMotionToggle || false;

    if (state.avatarDebounceTimer) clearTimeout(state.avatarDebounceTimer);

    // 모션 토글 전환 시에는 아바타를 가리지 않고 기존 이미지를 유지하며 버튼 로더만 표시
    if (!isMotionToggleOnly && !el.avatarImg.src) {
      el.avatarLoading.classList.add('active');
    } else if (isMotionToggleOnly && el.btnMotionPlay) {
      el.btnMotionPlay.classList.add('loading');
    }

    const doUpdate = () => {
      const skinId = state.equipped.skin || 2000;
      const equippedItemIds = [];

      // 캐릭터 아바타 렌더러에 합성할 착용 파츠 아이디 수집
      const visualSlots = [
        'hair', 'face', 'overall', 'top', 'bottom', 'shoes',
        'hat', 'faceAccessory', 'eyeDecoration', 'earrings', 'cape', 'glove',
        'furniture', 'effect', 'ring', 'title', 'decoration', 'petEquip'
      ];

      // 가구 착석 시 뷰포트 스케일 및 그림자 조정 (앉기 모션일 때만 착석 뷰포트 적용)
      const isSittingOnFurniture = (state.currentAnimation === 'sit') && !!state.equipped.furniture;

      if (isSittingOnFurniture) {
        el.avatarViewport.classList.add('sitting');
        if (el.avatarShadow) el.avatarShadow.style.display = 'none';
      } else {
        el.avatarViewport.classList.remove('sitting');
        if (el.avatarShadow) el.avatarShadow.style.display = 'block';
      }

      // 애니메이션 모션: 사용자가 선택한 동작 모션 충실히 반영
      const anim = state.currentAnimation || 'stand1';

      visualSlots.forEach(slot => {
        // 의자는 앉기(sit) 모션일 때만 아바타 렌더러에 전달
        if (slot === 'furniture' && anim !== 'sit') return;
        const id = state.equipped[slot];
        if (id) equippedItemIds.push(id);
      });

      const itemsParam = equippedItemIds.join(',');

      const staticUrl = `https://maplestory.io/api/KMS/389/Character/${skinId}/${itemsParam}/${anim}/0`;
      const animatedUrl = `https://maplestory.io/api/KMS/389/Character/animated/${skinId}/${itemsParam}/${anim}/0`;

      const targetUrl = state.isAnimated ? animatedUrl : staticUrl;
      const counterpartUrl = state.isAnimated ? staticUrl : animatedUrl;

      // 🚀 백그라운드 프리로드: 반대쪽(정적/모션) 이미지를 브라우저에 미리 캐싱해두어 전환 시 0초 즉시 변경!
      preloadImageUrl(counterpartUrl);

      const img = new Image();
      img.onload = () => {
        el.avatarImg.src = targetUrl;
        el.avatarLoading.classList.remove('active');
        if (el.btnMotionPlay) el.btnMotionPlay.classList.remove('loading');
      };
      img.onerror = () => {
        console.warn('Avatar render fallback');
        el.avatarImg.src = targetUrl;
        el.avatarLoading.classList.remove('active');
        if (el.btnMotionPlay) el.btnMotionPlay.classList.remove('loading');
      };
      img.src = targetUrl;

      updateCompanionPet();
      updateBuildingBackground();
    };

    if (isImmediate) {
      doUpdate();
    } else {
      state.avatarDebounceTimer = setTimeout(doUpdate, 60);
    }
  }

  // ⭐ 현재 장착 중인 파츠만 사이드바 패널에 표시 (미적용 항목 제외, 누락 없이 전체 슬롯 지원)
  function renderEquippedSlots() {
    // 실제로 장착된 항목(null/undefined 제외)만 필터링
    const equippedKeys = Object.keys(state.equipped).filter(key => {
      return state.equipped[key] !== null && state.equipped[key] !== undefined && state.equipped[key] !== '';
    });

    // 정의된 순서(order)대로 정렬
    equippedKeys.sort((a, b) => {
      const orderA = (SLOT_INFO[a] && SLOT_INFO[a].order) || 99;
      const orderB = (SLOT_INFO[b] && SLOT_INFO[b].order) || 99;
      return orderA - orderB;
    });

    // 장착 개수 배지 업데이트
    if (el.equippedCountBadge) {
      el.equippedCountBadge.textContent = equippedKeys.length;
    }

    // 장착된 파츠가 없을 때 안내문구
    if (equippedKeys.length === 0) {
      el.equippedSlots.innerHTML = `
        <div class="empty-equipped-box">
          <span style="font-size: 26px; opacity: 0.7;">🎒</span>
          <span>현재 장착된 파츠가 없습니다.</span>
          <span style="font-size: 11px; opacity: 0.6;">우측 갤러리에서 아이템을 클릭해 착용해보세요.</span>
        </div>
      `;
      return;
    }

    el.equippedSlots.innerHTML = equippedKeys.map(slotKey => {
      const itemId = state.equipped[slotKey];
      const slotDef = SLOT_INFO[slotKey] || { label: slotKey, icon: '✨' };
      const part = state.parts.find(p => p.id === itemId);

      let iconHtml = `<span>${slotDef.icon}</span>`;
      let nameText = part ? part.name : `아이템 #${itemId}`;
      let subText = slotDef.label;

      if (slotKey === 'skin') {
        const colors = {
          2000: '#fce3cc', 2001: '#b37c4d', 2002: '#e6eaf0', 2003: '#f7d88b',
          2004: '#8dc891', 2010: '#fff0e1', 2012: '#d8d4dc', 2015: '#ffe4e6',
          2016: '#ffccd5', 2018: '#f3e8ff', 2019: '#fae8ff', 2024: '#fed7aa', 2025: '#93c5fd'
        };
        const bg = colors[itemId] || '#fce3cc';
        iconHtml = `<div class="skin-swatch" style="width:26px;height:26px;background:${bg};border-radius:4px;border:1px solid rgba(255,255,255,0.25);"></div>`;
        subText = '피부톤';
      } else if (part) {
        if (part.icon) {
          iconHtml = `<img src="../${part.icon}" alt="${part.name}" onerror="this.src='${part.iconUrl}'" />`;
        } else if (part.iconUrl) {
          iconHtml = `<img src="${part.iconUrl}" alt="${part.name}" />`;
        }
        subText = `${slotDef.label} • #${part.id}`;
      }

      return `
        <div class="equip-slot active-equipped" data-slot="${slotKey}" data-id="${itemId}">
          <div class="slot-left">
            <div class="slot-icon-box">${iconHtml}</div>
            <div class="slot-info">
              <span class="slot-name" title="${nameText}">${nameText}</span>
              <span class="slot-type">${subText}</span>
            </div>
          </div>
          ${slotKey !== 'skin' ? `
            <button class="slot-remove" data-remove-slot="${slotKey}" title="${nameText} 해제">✕</button>
          ` : ''}
        </div>
      `;
    }).join('');

    // 개별 해제 버튼 이벤트
    el.equippedSlots.querySelectorAll('.slot-remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const slotKey = btn.dataset.removeSlot;
        const removedItemName = (state.parts.find(p => p.id === state.equipped[slotKey]) || {}).name || slotKey;
        delete state.equipped[slotKey];

        if (slotKey === 'furniture') {
          state.currentAnimation = 'stand1';
          el.animSelect.value = 'stand1';
        }

        renderEquippedSlots();
        updateCardEquippedStates();
        updateAvatar();
        showToast(`${removedItemName} 해제되었습니다.`);
      });
    });
  }

  // 파츠 장착 / 해제 토글
  function toggleEquip(part) {
    const slot = getItemSlot(part);
    const isCurrentlyEquipped = state.equipped[slot] === part.id;

    if (isCurrentlyEquipped) {
      if (slot === 'skin') {
        showToast('피부는 기본 피부(크림)로 유지됩니다.');
        return;
      }
      delete state.equipped[slot];

      if (slot === 'furniture') {
        state.currentAnimation = 'stand1';
        el.animSelect.value = 'stand1';
      }
      showToast(`${part.name} 해제되었습니다.`);
    } else {
      // 상/하의 및 한벌옷 상호 배타적 교체 로직
      if (slot === 'overall') {
        delete state.equipped['top'];
        delete state.equipped['bottom'];
      } else if (slot === 'top' || slot === 'bottom') {
        delete state.equipped['overall'];
      }

      state.equipped[slot] = part.id;

      if (slot === 'furniture') {
        state.currentAnimation = 'sit';
        el.animSelect.value = 'sit';
        showToast(`🪑 ${part.name} 착석 완료!`);
      } else if (slot === 'building') {
        showToast(`🏛️ ${part.name} 배경 설정 완료!`);
      } else {
        showToast(`${part.name} 장착 완료!`);
      }
    }

    renderEquippedSlots();
    updateCardEquippedStates();
    updateAvatar();
  }

  // Filter Parts with pagination
  function filterParts() {
    state.currentPage = 1;
    const q = state.searchQuery.toLowerCase();
    const equippedIds = new Set(Object.values(state.equipped));

    state.filteredParts = state.parts.filter(p => {
      if (state.currentCategory !== 'all' && p.category !== state.currentCategory) {
        return false;
      }
      if (state.currentSubCategory !== 'all' && p.subCategory !== state.currentSubCategory) {
        return false;
      }
      if (q) {
        const matchName = (p.name || '').toLowerCase().includes(q);
        const matchId = String(p.id).includes(q);
        const matchSub = (p.subCategory || '').toLowerCase().includes(q);
        if (!matchName && !matchId && !matchSub) return false;
      }
      if (state.onlyEquipped) {
        if (!equippedIds.has(p.id)) return false;
      }
      return true;
    });

    el.currentCategoryTitle.textContent = CATEGORY_NAMES[state.currentCategory] || '아이템 목록';
    el.galleryResultCount.textContent = `총 ${state.filteredParts.length.toLocaleString()}개 아이템 검색됨`;

    el.partsGrid.innerHTML = '';
    if (state.filteredParts.length === 0) {
      el.emptyState.style.display = 'block';
      el.loadMoreWrap.style.display = 'none';
      return;
    }
    el.emptyState.style.display = 'none';

    renderCurrentChunk();
  }

  // Render chunk for smooth high-performance display
  function renderCurrentChunk() {
    const start = (state.currentPage - 1) * state.pageSize;
    const end = start + state.pageSize;
    const chunk = state.filteredParts.slice(start, end);

    const fragment = document.createDocumentFragment();

    chunk.forEach(part => {
      const isEquipped = isPartEquipped(part);
      const card = document.createElement('div');
      card.className = `part-card ${isEquipped ? 'equipped' : ''}`;
      card.dataset.id = part.id;

      let iconMarkup = '';
      if (part.category === 'skin') {
        const colors = {
          2000: '#fce3cc', 2001: '#b37c4d', 2002: '#e6eaf0', 2003: '#f7d88b',
          2004: '#8dc891', 2010: '#fff0e1', 2012: '#d8d4dc', 2015: '#ffe4e6',
          2016: '#ffccd5', 2018: '#f3e8ff', 2019: '#fae8ff', 2024: '#fed7aa', 2025: '#93c5fd'
        };
        const bg = colors[part.id] || '#fce3cc';
        iconMarkup = `<div class="skin-swatch" style="background:${bg}"></div>`;
      } else {
        const imgSrc = part.icon ? `../${part.icon}` : part.iconUrl;
        iconMarkup = `<img src="${imgSrc}" alt="${part.name}" loading="lazy" onerror="if(this.src!=='${part.iconUrl}') this.src='${part.iconUrl}'" />`;
      }

      card.innerHTML = `
        <div class="part-icon-wrap">
          ${iconMarkup}
        </div>
        <span class="part-name" title="${part.name}">${part.name}</span>
        <span class="part-meta">${part.subCategory} • #${part.id}</span>
      `;

      // Click to toggle equip
      card.addEventListener('click', () => {
        toggleEquip(part);
      });

      // Right-click for modal detail
      card.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        openDetailModal(part.id);
      });

      fragment.appendChild(card);
    });

    el.partsGrid.appendChild(fragment);

    // Load More Visibility
    const displayedCount = Math.min(end, state.filteredParts.length);
    if (displayedCount < state.filteredParts.length) {
      el.loadMoreWrap.style.display = 'flex';
      el.loadMoreInfo.textContent = `표시 중: ${displayedCount.toLocaleString()} / 전체 ${state.filteredParts.length.toLocaleString()}개`;
    } else {
      el.loadMoreWrap.style.display = 'none';
    }
  }

  function updateCardEquippedStates() {
    const equippedIds = new Set(Object.values(state.equipped));
    el.partsGrid.querySelectorAll('.part-card').forEach(card => {
      const partId = Number(card.dataset.id);
      if (equippedIds.has(partId)) {
        card.classList.add('equipped');
      } else {
        card.classList.remove('equipped');
      }
    });
  }

  // Load next page
  function loadNextPage() {
    if (state.currentPage * state.pageSize < state.filteredParts.length) {
      state.currentPage++;
      renderCurrentChunk();
    }
  }

  // Detail Modal
  function openDetailModal(partId) {
    const part = state.parts.find(p => p.id === partId);
    if (!part) return;
    state.selectedPartForModal = part;

    el.modalPartName.textContent = part.name;
    el.modalPartId.textContent = `아이템 ID: ${part.id}`;
    el.modalPartCat.textContent = CATEGORY_NAMES[part.category] || part.category;
    el.modalPartSubCat.textContent = part.subCategory || '-';
    el.modalPartLocalPath.textContent = part.icon || '(실시간 CDN 매핑)';
    el.modalPartApiLink.textContent = part.iconUrl || 'maplestory.io/api';

    if (part.category === 'skin') {
      el.modalPartIcon.style.display = 'none';
    } else {
      el.modalPartIcon.style.display = 'block';
      el.modalPartIcon.src = part.icon ? `../${part.icon}` : part.iconUrl;
    }

    const isEq = isPartEquipped(part);
    el.btnModalEquip.textContent = isEq ? '해제하기' : '장착하기';
    el.btnModalEquip.className = isEq ? 'btn btn-secondary' : 'btn btn-primary';

    el.partModal.style.display = 'flex';
  }

  function closeDetailModal() {
    el.partModal.style.display = 'none';
    state.selectedPartForModal = null;
  }

  // Event Listeners
  function setupEventListeners() {
    // 1. 카테고리 탭 좌우 스크롤 내비게이션 버튼
    if (el.btnScrollTabLeft) {
      el.btnScrollTabLeft.addEventListener('click', () => {
        el.categoryTabs.scrollBy({ left: -220, behavior: 'smooth' });
      });
    }
    if (el.btnScrollTabRight) {
      el.btnScrollTabRight.addEventListener('click', () => {
        el.categoryTabs.scrollBy({ left: 220, behavior: 'smooth' });
      });
    }

    // 2. 카테고리 탭 마우스 휠 가로 스크롤
    el.categoryTabs.addEventListener('wheel', (e) => {
      if (e.deltaY !== 0) {
        e.preventDefault();
        el.categoryTabs.scrollLeft += e.deltaY;
      }
    }, { passive: false });

    // 3. 서브 필터 칩 마우스 휠 가로 스크롤
    el.subFilters.addEventListener('wheel', (e) => {
      if (e.deltaY !== 0) {
        e.preventDefault();
        el.subFilters.scrollLeft += e.deltaY;
      }
    }, { passive: false });

    // 동작 모션 재생 / 정지 토글 버튼 (마우스 오버 시 미리 프리로드 & 클릭 시 즉시 스왑)
    if (el.btnMotionPlay) {
      el.btnMotionPlay.addEventListener('mouseenter', () => {
        if (!state.isAnimated) {
          const skinId = state.equipped.skin || 2000;
          const ids = [];
          ['hair', 'face', 'overall', 'top', 'bottom', 'shoes', 'hat', 'faceAccessory', 'eyeDecoration', 'earrings', 'cape', 'glove', 'furniture', 'effect', 'ring', 'title', 'decoration', 'petEquip'].forEach(s => {
            if (s === 'furniture' && state.currentAnimation !== 'sit') return;
            if (state.equipped[s]) ids.push(state.equipped[s]);
          });
          preloadImageUrl(`https://maplestory.io/api/KMS/389/Character/animated/${skinId}/${ids.join(',')}/${state.currentAnimation || 'stand1'}/0`);
        }
      });

      el.btnMotionPlay.addEventListener('click', () => {
        state.isAnimated = !state.isAnimated;
        updateMotionUI();
        updateAvatar({ immediate: true, isMotionToggle: true });
        showToast(state.isAnimated ? '🎬 동작 모션 재생을 시작합니다.' : '⏸ 동작 모션을 일시정지했습니다.');
      });
    }

    // Animation dropdown (동작 모션 변경)
    el.animSelect.addEventListener('change', (e) => {
      const selectedAnim = e.target.value;
      state.currentAnimation = selectedAnim;

      // 의자에 앉아있던 상태에서 걷기, 서기, 점프 등 다른 모션을 선택하면 의자에서 일어나서 모션 수행
      if (selectedAnim !== 'sit' && state.equipped.furniture) {
        delete state.equipped.furniture;
        renderEquippedSlots();
        updateCardEquippedStates();
        showToast(`의자에서 일어났습니다. (${e.target.options[e.target.selectedIndex].text})`);
      }

      updateAvatar({ immediate: true });
    });

    // Category tabs
    el.categoryTabs.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => {
        el.categoryTabs.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        state.currentCategory = tab.dataset.cat;
        state.currentSubCategory = 'all';
        renderSubFilters();
        filterParts();

        tab.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      });
    });

    // Search input
    let searchDebounce = null;
    el.searchInput.addEventListener('input', (e) => {
      clearTimeout(searchDebounce);
      searchDebounce = setTimeout(() => {
        state.searchQuery = e.target.value.trim();
        el.btnClearSearch.style.display = state.searchQuery ? 'block' : 'none';
        filterParts();
      }, 150);
    });

    el.btnClearSearch.addEventListener('click', () => {
      el.searchInput.value = '';
      state.searchQuery = '';
      el.btnClearSearch.style.display = 'none';
      filterParts();
    });

    // Only equipped checkbox
    el.chkOnlyEquipped.addEventListener('change', (e) => {
      state.onlyEquipped = e.target.checked;
      filterParts();
    });

    // Load More Button
    el.btnLoadMore.addEventListener('click', loadNextPage);

    // Infinite scroll on gallery container
    el.galleryContainer.addEventListener('scroll', () => {
      const scrollPos = el.galleryContainer.scrollTop + el.galleryContainer.clientHeight;
      const scrollHeight = el.galleryContainer.scrollHeight;
      if (scrollPos >= scrollHeight - 200) {
        loadNextPage();
      }
    });

    // Random styling button (다양한 슬롯 무작위 조합)
    el.btnRandom.addEventListener('click', () => {
      const pickRandom = (cat, sub = null) => {
        const items = state.parts.filter(p => {
          if (p.category !== cat) return false;
          if (sub && p.subCategory !== sub) return false;
          return true;
        });
        if (items.length === 0) return null;
        return items[Math.floor(Math.random() * items.length)].id;
      };

      // 의자는 약 25% 확률로만 선택되도록 하여 다양한 캐릭터 액션 모션을 즐길 수 있도록 함
      const shouldEquipChair = Math.random() < 0.25;

      state.equipped = {
        skin: pickRandom('skin') || 2000,
        hair: pickRandom('hair'),
        face: pickRandom('face'),
        overall: pickRandom('clothes', 'Overall'),
        shoes: pickRandom('shoes'),
        hat: pickRandom('accessories', 'Hat'),
        cape: pickRandom('accessories', 'Cape'),
        faceAccessory: pickRandom('accessories', 'Face Accessory'),
        effect: pickRandom('decoration', 'Effect'),
        furniture: shouldEquipChair ? pickRandom('furniture') : null,
        pet: pickRandom('pet', 'Pet'),
        building: pickRandom('building')
      };

      for (const k of Object.keys(state.equipped)) {
        if (!state.equipped[k]) delete state.equipped[k];
      }

      if (state.equipped.furniture) {
        state.currentAnimation = 'sit';
        el.animSelect.value = 'sit';
      } else {
        // 의자가 없을 때는 다양한 동작 모션(서기, 걷기, 경계, 점프 등) 랜덤 배정
        const funMotions = ['stand1', 'stand2', 'walk1', 'walk2', 'alert', 'jump'];
        state.currentAnimation = funMotions[Math.floor(Math.random() * funMotions.length)];
        el.animSelect.value = state.currentAnimation;
      }

      renderEquippedSlots();
      updateCardEquippedStates();
      updateAvatar();
      showToast('🎲 다양한 슬롯의 파츠들과 모션이 무작위 조합되었습니다!');
    });

    // Reset button
    el.btnReset.addEventListener('click', () => {
      state.equipped = {
        skin: 2000,
        hair: 30000,
        face: 20000,
        overall: 1050018,
        shoes: 1072000,
        hat: 1002140
      };
      state.currentAnimation = 'stand1';
      el.animSelect.value = 'stand1';
      state.isAnimated = false;
      updateMotionUI();
      renderEquippedSlots();
      updateCardEquippedStates();
      updateAvatar();
      showToast('🔄 기본 세팅으로 초기화되었습니다.');
    });

    // Unequip all button (모두 해제)
    el.btnUnequipAll.addEventListener('click', () => {
      state.equipped = { skin: 2000 };
      state.currentAnimation = 'stand1';
      el.animSelect.value = 'stand1';
      renderEquippedSlots();
      updateCardEquippedStates();
      updateAvatar();
      showToast('모든 장착 파츠를 해제했습니다.');
    });

    // Download avatar image
    el.btnDownloadAvatar.addEventListener('click', async () => {
      if (!el.avatarImg.src) return;
      try {
        const res = await fetch(el.avatarImg.src);
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const ext = state.isAnimated ? 'gif' : 'png';
        a.href = url;
        a.download = `maplestory_avatar_${state.currentAnimation}_${Date.now()}.${ext}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast(`💾 아바타 ${ext.toUpperCase()} 파일이 저장되었습니다!`);
      } catch (err) {
        window.open(el.avatarImg.src, '_blank');
      }
    });

    // Modal buttons
    el.btnModalClose.addEventListener('click', closeDetailModal);
    el.btnModalCancel.addEventListener('click', closeDetailModal);
    el.partModal.addEventListener('click', (e) => {
      if (e.target === el.partModal) closeDetailModal();
    });

    el.btnModalEquip.addEventListener('click', () => {
      if (state.selectedPartForModal) {
        toggleEquip(state.selectedPartForModal);
        closeDetailModal();
      }
    });
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
