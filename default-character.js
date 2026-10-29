/**
 * NEXUS & maples.im 호환 - 시뮬레이터 기본 캐릭터 (Default Character) 모듈
 * 
 * 메이플스토리 시뮬레이터(maples.im)의 2등신 치비 황금비율(머리:몸체 1:1)을
 * 순수 SVG/JavaScript 코드로 완벽 구현한 독립형 기본 캐릭터 엔진입니다.
 * 
 * 구성 파츠 계층:
 * 1. 그림자 (Pedestal Shadow)
 * 2. 베이스 바디 (2등신 마네킹 & 뽀송 스킨 & 핑크 볼터치 & 이너웨어)
 * 3. 하의/신발 (클래식 롤업 인디고 진 & 캔버스 스니커즈)
 * 4. 상의/의상 (캐주얼 NEXUS 로고 반팔티 / 모험가 스타터 룩)
 * 5. 얼굴/표정 (초롱초롱한 흑요석 동공 & 더블 하이라이트 & 미소)
 * 6. 헤어/염색 (단정한 모던 댄디 숏컷 / 다크 브라운)
 * 7. 액세서리 (사원증 넥스트랩 & 스마트폰)
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.MapleDefaultCharacter = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ==========================================================================
  // [1] 시뮬레이터 기본 캐릭터 프리셋 규격 (maples.im 표준 JSON 사양)
  // ==========================================================================
  const DEFAULT_PRESETS = {
    // 1-1. 남성형 기본 캐릭터 (Classic Male Starter / Cody Style)
    male: {
      id: "MAPLE_DEFAULT_MALE",
      name: "모험가 크루 (남성 기본)",
      gender: "남성",
      skin: "#fde2d2",      // 뽀송 스킨 (Classic Fair Skin)
      hairColor: "#4a3525", // 내추럴 다크브라운 (Classic Maple Brown)
      eyeColor: "#1e293b",  // 흑요석 딥블랙 렌즈 (Obsidian Black)
      parts: {
        base: "BASE_M",     // 남성형 2등신 치비 바디
        hair: "H02",        // 모던 댄디 숏컷 (토비 헤어 모던 리파인)
        face: "F01",        // 아잉/모험가 맑은 미소 눈
        outfit: "O07",      // 캐주얼 로고 반팔티 (스타터 티셔츠)
        bottom: "B02",      // 롤업 인디고 진 & 레드 포인트 스니커즈
        acc: "A03"          // 사원증 넥스트랩 & 스마트폰
      },
      stance: "stand1",
      flipped: false
    },

    // 1-2. 여성형 기본 캐릭터 (Classic Female Starter)
    female: {
      id: "MAPLE_DEFAULT_FEMALE",
      name: "모험가 크루 (여성 기본)",
      gender: "여성",
      skin: "#fff0e6",      // 미백 스킨 (Pale Soft Skin)
      hairColor: "#7c4a2d", // 초코 브라운 (Choco Brown)
      eyeColor: "#1e293b",  // 흑요석 딥블랙 렌즈
      parts: {
        base: "BASE_F",     // 여성형 2등신 치비 바디
        hair: "H01",        // 단발 보브컷 (Classic Bob)
        face: "F01",        // 아잉/모험가 맑은 미소 눈
        outfit: "O07",      // 캐주얼 로고 반팔티
        bottom: "B03",      // 오피스 플리츠 스커트 & 메리제인 슈즈
        acc: "A03"          // 사원증 넥스트랩 & 스마트폰
      },
      stance: "stand1",
      flipped: false
    },

    // 1-3. 포멀 오피스 기본 캐릭터 (Formal Office Default)
    office: {
      id: "OFFICE_DEFAULT",
      name: "넥서스 신입 AI (오피스 기본)",
      gender: "남성",
      skin: "#f8cfbe",      // 홍조 스킨 (Blush Skin)
      hairColor: "#1e1e24", // 옵시디언 블랙 (Obsidian Black)
      eyeColor: "#2563eb",  // 사파이어 블루 렌즈
      parts: {
        base: "BASE_M",
        hair: "H04",        // 클래식 가르마 포마드
        face: "F02",        // 조용한 지적 눈 (Quiet Chic)
        outfit: "O01",      // 비즈니스 포멀 수트 & 레드 타이
        bottom: "B01",      // 포멀 슬랙스 & 광택 더비 슈즈
        acc: "A03"          // 사원증 목걸이 & 스마트폰
      },
      stance: "stand1",
      flipped: false
    },

    // 1-4. 정밀 픽셀 치비 기본 캐릭터 (Pixel Art Chibi Base)
    pixel: {
      id: "MAPLE_DEFAULT_PIXEL",
      name: "정밀 픽셀 치비 바디 (기본)",
      gender: "픽셀 베이스",
      skin: "#fff0e6",
      hairColor: "#1e1e24",
      eyeColor: "#1e293b",
      parts: {
        base: "BASE_PIXEL", // 43x68 정밀 픽셀 스프라이트
        hair: "H00",
        face: "F01",
        outfit: "O00",
        bottom: "B00",
        acc: "A00"
      },
      stance: "stand1",
      flipped: false
    }
  };

  // ==========================================================================
  // [2] 순수 SVG 렌더러 (외부 의존성 없음, Standalone)
  // ==========================================================================
  function renderSVG(charConfig = {}, options = {}) {
    const preset = Object.assign({}, DEFAULT_PRESETS.male, charConfig);
    const { skin, hairColor, eyeColor, parts = {} } = preset;
    const { hiddenLayers = {}, width = 64, height = 78, animate = false } = options;

    const isFemale = parts.base === 'BASE_F';
    const isPixel = parts.base === 'BASE_PIXEL';

    // [0] 픽셀 모드인 경우 43x68 정밀 픽셀 파츠 시스템으로 렌더링
    if (isPixel && typeof window !== 'undefined' && window.PixelChibiParts) {
      const pParts = window.PixelChibiParts;
      const pBase = !hiddenLayers.base && window.AgentChibiBase ? window.AgentChibiBase.render(skin, { raw: true }) : '';
      const pBottom = !hiddenLayers.bottom ? pParts.render('bottom', parts.bottom) : '';
      const pOutfit = !hiddenLayers.outfit ? pParts.render('outfit', parts.outfit) : '';
      const pFace = !hiddenLayers.face ? pParts.render('face', parts.face, eyeColor) : '';
      const pHair = !hiddenLayers.hair ? pParts.render('hair', parts.hair, hairColor) : '';
      const pAcc = !hiddenLayers.acc ? pParts.render('acc', parts.acc) : '';

      return `
        <svg viewBox="0 0 64 78" width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg" aria-label="${preset.name}" class="maple-default-avatar pixel-chibi-svg${animate ? ' animate-breath' : ''}">
          <ellipse cx="32" cy="73" rx="16" ry="3" fill="rgba(24,37,54,0.14)"/>
          <g class="layer-pixel-chibi-composite" transform="translate(10.5, 4.5)" shape-rendering="crispEdges">
            ${pBase}
            ${pBottom}
            ${pOutfit}
            ${pFace}
            ${pHair}
            ${pAcc}
          </g>
        </svg>
      `.trim();
    }

    // 1. 신체 베이스 (Base Body)
    const baseSvg = isPixel && typeof window !== 'undefined' && window.AgentChibiBase ? 
      window.AgentChibiBase.render(skin, { offsetX: 10.5, offsetY: 4.5 }) : (isFemale ? `
      <g class="layer-base-female">
        <path d="M15.5 22 C13.5 9.5 50.5 9.5 48.5 22 C49.5 31.5 44.5 36.5 32 36.5 C19.5 36.5 14.5 31.5 15.5 22 Z" fill="${skin}"/>
        <rect x="29.5" y="34.5" width="5" height="4" rx="1.5" fill="${skin}"/>
        <circle cx="14" cy="23" r="2.6" fill="${skin}"/>
        <circle cx="50" cy="23" r="2.6" fill="${skin}"/>
        <ellipse cx="19" cy="28" rx="3.5" ry="2" fill="#ff6b81" opacity="0.55"/>
        <ellipse cx="45" cy="28" rx="3.5" ry="2" fill="#ff6b81" opacity="0.55"/>
        <path d="M21 37 Q32 39 43 37 L41.5 51.5 Q32 53 22.5 51.5 Z" fill="${skin}"/>
        <rect x="23" y="38" width="18" height="9" rx="3" fill="#4c566a" opacity="0.6"/>
        <rect x="22" y="49" width="20" height="6" rx="2" fill="#334155"/>
        <rect x="14.5" y="38" width="6" height="12" rx="3" fill="${skin}"/>
        <circle cx="17.5" cy="49" r="2.8" fill="${skin}"/>
        <rect x="43.5" y="38" width="6" height="12" rx="3" fill="${skin}"/>
        <circle cx="46.5" cy="49" r="2.8" fill="${skin}"/>
        <rect x="22.5" y="52" width="7.5" height="14" rx="2.5" fill="${skin}"/>
        <rect x="34" y="52" width="7.5" height="14" rx="2.5" fill="${skin}"/>
        <rect x="21" y="64" width="9.5" height="6" rx="3" fill="#1e293b"/>
        <rect x="33.5" y="64" width="9.5" height="6" rx="3" fill="#1e293b"/>
        <rect x="21.5" y="68" width="8.5" height="2" rx="1" fill="#475569"/>
        <rect x="34" y="68" width="8.5" height="2" rx="1" fill="#475569"/>
      </g>
    ` : `
      <g class="layer-base-male">
        <path d="M15 22 C13 9 51 9 49 22 C50 32 45 37 32 37 C19 37 14 32 15 22 Z" fill="${skin}"/>
        <rect x="29.5" y="34.5" width="5" height="4" rx="1.5" fill="${skin}"/>
        <circle cx="13.5" cy="23" r="2.8" fill="${skin}"/>
        <circle cx="50.5" cy="23" r="2.8" fill="${skin}"/>
        <ellipse cx="19" cy="28" rx="3.5" ry="2" fill="#ff7f7f" opacity="0.45"/>
        <ellipse cx="45" cy="28" rx="3.5" ry="2" fill="#ff7f7f" opacity="0.45"/>
        <rect x="20" y="37" width="24" height="15" rx="4" fill="${skin}"/>
        <rect x="22" y="38" width="20" height="9" rx="3" fill="#3b4252" opacity="0.6"/>
        <rect x="21" y="49" width="22" height="6" rx="2" fill="#2e3440"/>
        <rect x="14" y="38" width="6.5" height="12" rx="3" fill="${skin}"/>
        <circle cx="17.2" cy="49" r="3" fill="${skin}"/>
        <rect x="43.5" y="38" width="6.5" height="12" rx="3" fill="${skin}"/>
        <circle cx="46.8" cy="49" r="3" fill="${skin}"/>
        <rect x="22" y="52" width="8" height="14" rx="2.5" fill="${skin}"/>
        <rect x="34" y="52" width="8" height="14" rx="2.5" fill="${skin}"/>
        <rect x="20" y="64" width="10.5" height="6" rx="3" fill="#1e293b"/>
        <rect x="33.5" y="64" width="10.5" height="6" rx="3" fill="#1e293b"/>
        <rect x="20.5" y="68" width="9.5" height="2" rx="1" fill="#475569"/>
        <rect x="34" y="68" width="9.5" height="2" rx="1" fill="#475569"/>
      </g>
    `);

    // 2. 하의/신발 (Bottom)
    let bottomSvg = '';
    if (parts.bottom === 'B02') {
      // 롤업 진 & 화이트/레드 스니커즈 (기본)
      bottomSvg = `
        <rect x="20.5" y="48.5" width="23" height="5" rx="2" fill="#27466b"/>
        <rect x="21" y="51" width="9.5" height="12" rx="2" fill="#3b597b"/>
        <rect x="33.5" y="51" width="9.5" height="12" rx="2" fill="#3b597b"/>
        <rect x="21" y="60.5" width="9.5" height="2.5" rx="1" fill="#cbd5e1"/>
        <rect x="33.5" y="60.5" width="9.5" height="2.5" rx="1" fill="#cbd5e1"/>
        <rect x="19.5" y="63" width="11.5" height="7" rx="3" fill="#f8fafc" stroke="#cbd5e1" stroke-width="0.8"/>
        <rect x="33" y="63" width="11.5" height="7" rx="3" fill="#f8fafc" stroke="#cbd5e1" stroke-width="0.8"/>
        <rect x="19.5" y="67.5" width="11.5" height="2.2" rx="1" fill="#ef4444"/>
        <rect x="33" y="67.5" width="11.5" height="2.2" rx="1" fill="#ef4444"/>
      `;
    } else if (parts.bottom === 'B03') {
      // 플리츠 스커트 & 메리제인
      bottomSvg = `
        <path d="M19 48.5 H45 L48 60 H16 Z" fill="#334155"/>
        <line x1="25" y1="49" x2="24" y2="60" stroke="#1e293b" stroke-width="1.2"/>
        <line x1="32" y1="49" x2="32" y2="60" stroke="#1e293b" stroke-width="1.2"/>
        <line x1="39" y1="49" x2="40" y2="60" stroke="#1e293b" stroke-width="1.2"/>
        <rect x="20.5" y="63" width="10.5" height="7" rx="3" fill="#0f172a"/>
        <rect x="33" y="63" width="10.5" height="7" rx="3" fill="#0f172a"/>
        <rect x="20.5" y="63.5" width="10.5" height="1.8" fill="#e2e8f0"/>
        <rect x="33" y="63.5" width="10.5" height="1.8" fill="#e2e8f0"/>
      `;
    } else {
      // 포멀 슬랙스
      bottomSvg = `
        <rect x="20.5" y="48.5" width="23" height="5" rx="2" fill="#1e293b"/>
        <rect x="21" y="51" width="9.5" height="14" rx="2" fill="#2c3a4b"/>
        <rect x="33.5" y="51" width="9.5" height="14" rx="2" fill="#2c3a4b"/>
        <rect x="19.5" y="63" width="11.5" height="7" rx="3" fill="#0f172a"/>
        <rect x="33" y="63" width="11.5" height="7" rx="3" fill="#0f172a"/>
        <rect x="20" y="67.5" width="10.5" height="2" rx="1" fill="#475569"/>
        <rect x="33.5" y="67.5" width="10.5" height="2" rx="1" fill="#475569"/>
      `;
    }

    // 3. 상의/의상 (Outfit)
    let outfitSvg = '';
    if (parts.outfit === 'O01') {
      // 비즈니스 수트
      outfitSvg = `
        <rect x="17.5" y="36.5" width="29" height="16" rx="4" fill="#1e293b"/>
        <rect x="13.5" y="37.5" width="6.5" height="10" rx="2.5" fill="#1e293b"/>
        <rect x="44" y="37.5" width="6.5" height="10" rx="2.5" fill="#1e293b"/>
        <polygon points="27.5,36.5 36.5,36.5 32,46" fill="#ffffff"/>
        <polygon points="31,38 33,38 33.5,46 32,48 30.5,46" fill="#dc2626"/>
        <rect x="20.5" y="42" width="4.5" height="1.2" rx="0.5" fill="#ffffff"/>
      `;
    } else {
      // O07 캐주얼 로고 반팔티 (디폴트 스타터)
      outfitSvg = `
        <rect x="18" y="36.5" width="28" height="15" rx="3" fill="#f8fafc" stroke="#cbd5e1" stroke-width="0.8"/>
        <rect x="14" y="37" width="6" height="7" rx="2" fill="#f8fafc" stroke="#cbd5e1" stroke-width="0.8"/>
        <rect x="44" y="37" width="6" height="7" rx="2" fill="#f8fafc" stroke="#cbd5e1" stroke-width="0.8"/>
        <rect x="28" y="41" width="8" height="5" rx="1.5" fill="#ea580c"/>
        <line x1="30" y1="43.5" x2="34" y2="43.5" stroke="#ffffff" stroke-width="0.8"/>
      `;
    }

    // 4. 얼굴/표정 (Face)
    let faceSvg = '';
    if (parts.face === 'F02') {
      // 조용한 눈 (Chic)
      faceSvg = `
        <path d="M18.5 20 Q24 18 29 21.5" fill="none" stroke="#0f172a" stroke-width="2.4" stroke-linecap="round"/>
        <rect x="21" y="20.5" width="7" height="6.5" rx="2.5" fill="${eyeColor}"/>
        <circle cx="23" cy="22" r="1.5" fill="#ffffff"/>
        <circle cx="26" cy="24.5" r="0.9" fill="#93c5fd"/>
        
        <path d="M35 21.5 Q40 18 45.5 20" fill="none" stroke="#0f172a" stroke-width="2.4" stroke-linecap="round"/>
        <rect x="36" y="20.5" width="7" height="6.5" rx="2.5" fill="${eyeColor}"/>
        <circle cx="38" cy="22" r="1.5" fill="#ffffff"/>
        <circle cx="41" cy="24.5" r="0.9" fill="#93c5fd"/>
        <line x1="30" y1="29.5" x2="34" y2="29.5" stroke="#475569" stroke-width="1.4" stroke-linecap="round"/>
      `;
    } else {
      // F01 아잉 / 방긋 미소 (기본 디폴트)
      faceSvg = `
        <path d="M19.5 21.5 Q24 16 28.5 21.5" fill="none" stroke="${eyeColor}" stroke-width="2.5" stroke-linecap="round"/>
        <path d="M35.5 21.5 Q40 16 44.5 21.5" fill="none" stroke="${eyeColor}" stroke-width="2.5" stroke-linecap="round"/>
        <path d="M29 27 Q32 31.5 35 27" fill="#f43f5e" stroke="${eyeColor}" stroke-width="1.2" stroke-linecap="round"/>
      `;
    }

    // 5. 헤어 (Hair)
    let hairSvg = '';
    if (parts.hair === 'H01') {
      // 단발 보브컷
      hairSvg = `
        <path d="M13 22 C13 7 51 7 51 22 L51 32 C51 34 46.5 34 45.5 30 L45 22 C45 19 39 18 32 18 C25 18 19 19 19 22 L18.5 30 C17.5 34 13 34 13 32 Z" fill="${hairColor}"/>
        <path d="M19 13 Q32 8.5 45 13" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="2.2" stroke-linecap="round"/>
        <path d="M22 18 L26 22 L30 18 L34 22 L38 18" stroke="rgba(0,0,0,0.25)" stroke-width="1.2" fill="none"/>
      `;
    } else {
      // H02 모던 댄디 숏컷 (남성형 디폴트)
      hairSvg = `
        <path d="M14 20 C14 8 50 8 50 20 L50 27 L46 25 L45 18 C43 16 38 15 32 15 C26 15 21 16 19 18 L18 25 L14 27 Z" fill="${hairColor}"/>
        <path d="M24 10 L28 7 L32 10 L36 7 L40 10" fill="${hairColor}"/>
        <path d="M21 12 Q32 8 43 12" fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="2" stroke-linecap="round"/>
      `;
    }

    // 6. 액세서리 (Acc)
    let accSvg = '';
    if (parts.acc === 'A03') {
      // 사원증 목걸이 & 스마트폰
      accSvg = `
        <path d="M28 36 L31.5 42 L35 36" fill="none" stroke="#10b981" stroke-width="1.4"/>
        <rect x="29.5" y="42" width="5" height="7" rx="1" fill="#ffffff" stroke="#cbd5e1" stroke-width="0.8"/>
        <rect x="29.5" y="42" width="5" height="2" rx="0.5" fill="#3b82f6"/>
        <rect x="42" y="42" width="9" height="13" rx="1.5" fill="#1e293b" stroke="#94a3b8" stroke-width="1"/>
        <rect x="43" y="43" width="7" height="10" rx="1" fill="#38bdf8"/>
      `;
    }

    return `
      <svg viewBox="0 0 64 78" width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg" aria-label="${preset.name}" class="maple-default-avatar${animate ? ' animate-breath' : ''}">
        <!-- 그림자 레이어 -->
        <ellipse cx="32" cy="73" rx="16" ry="3" fill="rgba(24,37,54,0.14)"/>
        
        <!-- [Layer 1] 베이스 신체 -->
        ${!hiddenLayers.base ? baseSvg : ''}
        
        <!-- [Layer 2] 하의 & 슈즈 -->
        ${!hiddenLayers.bottom ? bottomSvg : ''}
        
        <!-- [Layer 3] 상의 & 의상 -->
        ${!hiddenLayers.outfit ? outfitSvg : ''}
        
        <!-- [Layer 4] 얼굴 & 렌즈 -->
        ${!hiddenLayers.face ? faceSvg : ''}
        
        <!-- [Layer 5] 헤어 & 염색 -->
        ${!hiddenLayers.hair ? hairSvg : ''}
        
        <!-- [Layer 6] 소품 & 장식 -->
        ${!hiddenLayers.acc ? accSvg : ''}
      </svg>
    `.trim();
  }

  // ==========================================================================
  // [3] DOM 마운트 헬퍼 (Mounting Helper)
  // ==========================================================================
  function mount(target, config = {}, options = {}) {
    const el = typeof target === 'string' ? document.querySelector(target) : target;
    if (!el) return null;
    el.innerHTML = renderSVG(config, options);
    return el;
  }

  // ==========================================================================
  // [4] 퍼블릭 API 익스포트
  // ==========================================================================
  return {
    presets: DEFAULT_PRESETS,
    getPreset: (type = 'male') => Object.assign({}, DEFAULT_PRESETS[type] || DEFAULT_PRESETS.male),
    render: renderSVG,
    toSVG: renderSVG,
    toJSON: (type = 'male') => JSON.stringify(DEFAULT_PRESETS[type] || DEFAULT_PRESETS.male, null, 2),
    mount: mount
  };
});
