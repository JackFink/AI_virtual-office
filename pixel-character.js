/**
 * NEXUS Virtual Office - AI Agent Modular Pixel Character Engine
 * 에이전트 픽셀 캐릭터 파츠별 렌더링 엔진
 *
 * 레이어 구성:
 * 1. Base / Shadow & Body (그림자, 신체, 피부톤)
 * 2. Bottom & Shoes (하의: 슬랙스, 청바지, 치노, 스커트 + 슈즈)
 * 3. Top & Outfit (상의: 정장 수트, 후드티, 랩코트, 셔츠, 블레이저)
 * 4. Face & Expression (얼굴, 눈, 눈썹, 미소, 홍조, 바이저)
 * 5. Hair (헤어: 숏컷, 포니테일, 보브, 가르마, 롱웨이브 등)
 * 6. Accessory (사원증, 헤드셋, 안경, 커피머그, 노트북, AI 아우라)
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.PixelCharacterEngine = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // 기본 캐릭터 그리드 해상도 (24 x 32 픽셀 아트 규격)
  const CANVAS_WIDTH = 24;
  const CANVAS_HEIGHT = 32;

  // 세련된 HSL 기반 픽셀 컬러 팔레트
  const PALETTES = {
    skin: {
      light:   { base: '#fde5cb', shadow: '#ecc9a8', blush: '#f8a89f' },
      warm:    { base: '#f3d3b4', shadow: '#dfb48e', blush: '#e89c92' },
      peach:   { base: '#fad9c7', shadow: '#e5bba4', blush: '#f29c9a' },
      tan:     { base: '#cf9c77', shadow: '#af7853', blush: '#c76e6a' },
      deep:    { base: '#8b5a3c', shadow: '#6a3c22', blush: '#964842' },
      cyborg:  { base: '#d8e5ec', shadow: '#a9c0cd', blush: '#68d4bf' }
    },
    hair: {
      black:     { main: '#22252c', hi: '#3d4452', shadow: '#121418' },
      brown:     { main: '#54392a', hi: '#73503b', shadow: '#382216' },
      blonde:    { main: '#e0b25b', hi: '#fad17f', shadow: '#b28637' },
      ash:       { main: '#868e96', hi: '#adb5bd', shadow: '#495057' },
      navy:      { main: '#253754', hi: '#3a537d', shadow: '#172338' },
      coral:     { main: '#c7534c', hi: '#e0716a', shadow: '#963732' },
      emerald:   { main: '#246b56', hi: '#38967b', shadow: '#164739' },
      purple:    { main: '#6a479c', hi: '#8b64c4', shadow: '#472c6e' },
      silver:    { main: '#cfd7df', hi: '#edf2f7', shadow: '#9aa5b1' },
      auburn:    { main: '#8c3b28', hi: '#b3533c', shadow: '#612415' }
    },
    clothes: {
      navySuit:    { main: '#27384e', hi: '#3a506d', shadow: '#172230', accent: '#e8f0fe' },
      charcoal:    { main: '#343a40', hi: '#495057', shadow: '#212529', accent: '#74c0fc' },
      labCoat:     { main: '#f1f5f9', hi: '#ffffff', shadow: '#cbd5e1', accent: '#0ea5e9' },
      techHoodie:  { main: '#1e293b', hi: '#334155', shadow: '#0f172a', accent: '#10b981' },
      mintCasual:  { main: '#2a9d8f', hi: '#38bba9', shadow: '#1f7067', accent: '#e76f51' },
      purpleKnit:  { main: '#7048e8', hi: '#845ef7', shadow: '#5f3dc4', accent: '#fff3bf' },
      beigeChino:  { main: '#cbb396', hi: '#ded0bc', shadow: '#aa9073', accent: '#5c452d' },
      denimBlue:   { main: '#3b5998', hi: '#4c70ba', shadow: '#2b3e6b', accent: '#f8f9fa' },
      burgundy:    { main: '#782835', hi: '#993949', shadow: '#521922', accent: '#fcc2d7' },
      coralPolo:   { main: '#e76f51', hi: '#f48c74', shadow: '#b84931', accent: '#264653' },
      forestGreen: { main: '#2d6a4f', hi: '#40916c', shadow: '#1b4332', accent: '#d8f3dc' },
      whiteShirt:  { main: '#eef2f6', hi: '#ffffff', shadow: '#cbd5e1', accent: '#2563eb' }
    }
  };

  // 파츠별 카탈로그 및 명칭 메타데이터
  const PARTS_CATALOG = {
    hair: [
      { id: 'H01', name: '스마트 포멀 숏컷', style: 'shortCrop', color: 'black' },
      { id: 'H02', name: '클래식 가르마 펌', style: 'parted', color: 'brown' },
      { id: 'H03', name: '모던 댄디 투블럭', style: 'dandy', color: 'navy' },
      { id: 'H04', name: '단정한 보브 단발', style: 'bob', color: 'brown' },
      { id: 'H05', name: '웨이브 롱헤어', style: 'wavyLong', color: 'black' },
      { id: 'H06', name: '하이 포니테일', style: 'ponytail', color: 'ash' },
      { id: 'H07', name: '캐주얼 쉼표머리', style: 'comma', color: 'brown' },
      { id: 'H08', name: '애쉬 골드 미디엄', style: 'medium', color: 'blonde' },
      { id: 'H09', name: '샤프 센터 파트', style: 'centerPart', color: 'black' },
      { id: 'H10', name: '사이버 실버 밥컷', style: 'bob', color: 'silver' },
      { id: 'H11', name: '코랄 틴트 숏컷', style: 'shortCrop', color: 'coral' },
      { id: 'H12', name: '내추럴 번 헤어', style: 'bun', color: 'brown' },
      { id: 'H13', name: '크리에이티브 컬리', style: 'curly', color: 'auburn' },
      { id: 'H14', name: '포멀 사이드 스윕', style: 'dandy', color: 'black' },
      { id: 'H15', name: '에메랄드 언더컷', style: 'shortCrop', color: 'emerald' },
      { id: 'H16', name: '퍼플 웨이브 롱', style: 'wavyLong', color: 'purple' },
      { id: 'H17', name: '테크 브라우징 헤어', style: 'parted', color: 'ash' },
      { id: 'H18', name: '소프트 레이어드 컷', style: 'medium', color: 'brown' },
      { id: 'H19', name: '다크 네이비 퐁파두르', style: 'dandy', color: 'navy' },
      { id: 'H20', name: '미니멀 픽시 컷', style: 'shortCrop', color: 'blonde' }
    ],
    face: [
      { id: 'F01', name: '친근한 기본 미소', type: 'smile', eyes: 'normal', blush: true },
      { id: 'F02', name: '집중하는 지적 눈빛', type: 'focused', eyes: 'sharp', blush: false },
      { id: 'F03', name: '분석적인 연구원 눈', type: 'analytical', eyes: 'narrow', blush: false },
      { id: 'F04', name: '밝고 상냥한 눈웃음', type: 'happy', eyes: 'arc', blush: true },
      { id: 'F05', name: '냉철한 리더 눈빛', type: 'leader', eyes: 'sharp', blush: false },
      { id: 'F06', name: '차분한 관찰자 표정', type: 'calm', eyes: 'normal', blush: false },
      { id: 'F07', name: '공감형 상담 표정', type: 'warm', eyes: 'sparkle', blush: true },
      { id: 'F08', name: '신중한 검토 눈빛', type: 'serious', eyes: 'narrow', blush: false },
      { id: 'F09', name: '자신감 넘치는 눈빛', type: 'confident', eyes: 'sharp', blush: false },
      { id: 'F10', name: 'AI 사이버 글래스 안경', type: 'cyberEyes', eyes: 'glow', blush: false },
      { id: 'F11', name: '스마트 라운드 안경', type: 'glassesRound', eyes: 'normal', blush: false },
      { id: 'F12', name: '스퀘어 오피스 안경', type: 'glassesSquare', eyes: 'normal', blush: false },
      { id: 'F13', name: '깜빡이는 윙크', type: 'wink', eyes: 'wink', blush: true },
      { id: 'F14', name: '호기심 가득한 눈', type: 'curious', eyes: 'sparkle', blush: true },
      { id: 'F15', name: '단호한 결단 표정', type: 'resolute', eyes: 'sharp', blush: false },
      { id: 'F16', name: '활기찬 에너지 눈빛', type: 'energetic', eyes: 'normal', blush: true },
      { id: 'F17', name: '데이터 터미널 반사 눈', type: 'terminal', eyes: 'glow', blush: false },
      { id: 'F18', name: '따뜻한 온보딩 미소', type: 'smile', eyes: 'normal', blush: true },
      { id: 'F19', name: '철저한 컴플라이언스 눈', type: 'serious', eyes: 'narrow', blush: false },
      { id: 'F20', name: '반짝이는 열정 눈빛', type: 'sparkle', eyes: 'sparkle', blush: true }
    ],
    top: [
      { id: 'O01', name: '네이비 포멀 수트 & 넥타이', type: 'suit', palette: 'navySuit' },
      { id: 'O02', name: '리서치 화이트 랩코트', type: 'labCoat', palette: 'labCoat' },
      { id: 'O03', name: '테크 엔지니어 후디', type: 'hoodie', palette: 'techHoodie' },
      { id: 'O04', name: '에디터 퍼플 니트', type: 'knit', palette: 'purpleKnit' },
      { id: 'O05', name: '민트 캐주얼 오피스 셔츠', type: 'shirt', palette: 'mintCasual' },
      { id: 'O06', name: '차콜 모던 블레이저', type: 'blazer', palette: 'charcoal' },
      { id: 'O07', name: '운영팀 카키 집업', type: 'zipup', palette: 'forestGreen' },
      { id: 'O08', name: '크리에이티브 코랄 폴로', type: 'polo', palette: 'coralPolo' },
      { id: 'O09', name: '버건디 임원 카디건', type: 'cardigan', palette: 'burgundy' },
      { id: 'O10', name: '클래식 화이트 드레스셔츠', type: 'shirtTie', palette: 'whiteShirt' },
      { id: 'O11', name: '파이낸스 다크 베스트', type: 'vest', palette: 'charcoal' },
      { id: 'O12', name: '마케팅 비비드 블라우스', type: 'blouse', palette: 'purpleKnit' },
      { id: 'O13', name: '데브옵스 터틀넥', type: 'turtleneck', palette: 'techHoodie' },
      { id: 'O14', name: '데님 캐주얼 셔츠', type: 'shirt', palette: 'denimBlue' },
      { id: 'O15', name: '컴플라이언스 그레이 정장', type: 'suit', palette: 'charcoal' },
      { id: 'O16', name: '포레스트 그린 브이넥', type: 'knit', palette: 'forestGreen' },
      { id: 'O17', name: '아이보리 소프트 가디건', type: 'cardigan', palette: 'beigeChino' },
      { id: 'O18', name: '코발트블루 슬림 재킷', type: 'blazer', palette: 'denimBlue' },
      { id: 'O19', name: '테크노 바이저 윈드브레이커', type: 'zipup', palette: 'navySuit' },
      { id: 'O20', name: '스트라이프 스마트 셔츠', type: 'shirtTie', palette: 'whiteShirt' }
    ],
    bottom: [
      { id: 'P01', name: '차콜 슬림 슬랙스 & 더비슈즈', type: 'slacks', color: '#272c34', shoe: '#181b20' },
      { id: 'P02', name: '다크 인디고 데님 & 스니커즈', type: 'jeans', color: '#2b3a52', shoe: '#ffffff' },
      { id: 'P03', name: '베이지 치노 & 브라운 로퍼', type: 'chinos', color: '#b59e80', shoe: '#4e3629' },
      { id: 'P04', name: '네이비 포멀 트라우저 & 옥스퍼드', type: 'slacks', color: '#1f2a3a', shoe: '#121924' },
      { id: 'P05', name: '블랙 핀턱 팬츠 & 미니멀 슈즈', type: 'slacks', color: '#1a1d20', shoe: '#333842' },
      { id: 'P06', name: '오피스 펜슬 스커트 & 힐', type: 'skirt', color: '#2c333e', shoe: '#181a1f' },
      { id: 'P07', name: '올리브 카고 팬츠 & 하이탑', type: 'cargo', color: '#3d483b', shoe: '#f0ece1' },
      { id: 'P08', name: '그레이 테일러드 슬랙스', type: 'slacks', color: '#4a5568', shoe: '#1a202c' },
      { id: 'P09', name: '라이트 블루 워싱 진', type: 'jeans', color: '#4d698e', shoe: '#ffffff' },
      { id: 'P10', name: '웜브라운 코듀로이 팬츠', type: 'chinos', color: '#684a37', shoe: '#2c1e16' },
      { id: 'P11', name: '딥버건디 슬랙스', type: 'slacks', color: '#4a1d24', shoe: '#1c0b0e' },
      { id: 'P12', name: '포레스트 그린 플리츠 스커트', type: 'skirt', color: '#1f3d30', shoe: '#3c2a1e' },
      { id: 'P13', name: '아이보리 와이드 슬랙스', type: 'slacks', color: '#dbe2e6', shoe: '#607274' },
      { id: 'P14', name: '미드나잇 조거 팬츠', type: 'cargo', color: '#192231', shoe: '#42e2b8' },
      { id: 'P15', name: '카멜 브라운 슬랙스', type: 'slacks', color: '#8c6b4b', shoe: '#3a2717' },
      { id: 'P16', name: '다크 애쉬 모던 진', type: 'jeans', color: '#33383f', shoe: '#eeeeee' },
      { id: 'P17', name: '네이비 A라인 스커트', type: 'skirt', color: '#1d2736', shoe: '#0f141c' },
      { id: 'P18', name: '스톤 베이지 스트레이트 팬츠', type: 'chinos', color: '#9c9284', shoe: '#2f2720' },
      { id: 'P19', name: '하이테크 사이버 팬츠', type: 'slacks', color: '#1e2d3b', shoe: '#00e5ff' },
      { id: 'P20', name: '클래식 블랙 턱시도 트라우저', type: 'slacks', color: '#111317', shoe: '#050608' }
    ],
    accessory: [
      { id: 'A00', name: '장착 안 함 (기본)', type: 'none' },
      { id: 'A01', name: 'NEXUS 스마트 사원증 목걸이', type: 'badge' },
      { id: 'A02', name: '무선 스테레오 오피스 헤드셋', type: 'headset' },
      { id: 'A03', name: '클래식 블랙 뿔테 안경', type: 'glasses' },
      { id: 'A04', name: '테이크아웃 에스프레소 머그', type: 'coffee' },
      { id: 'A05', name: '울트라 슬림 테크 노트북', type: 'laptop' },
      { id: 'A06', name: 'AI 사이버 네온 바이저', type: 'visor' },
      { id: 'A07', name: '골드 메탈 라운드 안경', type: 'goldGlasses' },
      { id: 'A08', name: '클립온 노이즈캔슬링 이어폰', type: 'earbuds' },
      { id: 'A09', name: '포터블 디지털 태블릿 & 펜', type: 'tablet' },
      { id: 'A10', name: 'AI 홀로그램 상태 오라 (Glow)', type: 'aura' },
      { id: 'A11', name: '스마트 스마트워치 & 손목밴드', type: 'watch' },
      { id: 'A12', name: '미니 데스크 반려 봇 (Drone)', type: 'drone' }
    ]
  };

  // 헬퍼 그리기 함수
  function px(ctx, x, y, color) {
    if (!color) return;
    ctx.fillStyle = color;
    ctx.fillRect(Math.floor(x), Math.floor(y), 1, 1);
  }

  function rect(ctx, x, y, w, h, color) {
    if (!color) return;
    ctx.fillStyle = color;
    ctx.fillRect(Math.floor(x), Math.floor(y), Math.floor(w), Math.floor(h));
  }

  // 레이어 1: 바닥 그림자 및 베이스 신체
  function renderBody(ctx, skinKey = 'warm', frame = 0) {
    const s = PALETTES.skin[skinKey] || PALETTES.skin.warm;
    const breath = (frame % 2 === 1) ? 1 : 0; // 호흡 모션 미세 오프셋

    // 바닥 픽셀 그림자 (타원형)
    rect(ctx, 6, 30, 12, 1, 'rgba(18, 28, 38, 0.22)');
    rect(ctx, 8, 31, 8, 1, 'rgba(18, 28, 38, 0.35)');

    // 1. 머리 베이스 윤곽 (x: 7 ~ 16, y: 5 ~ 14)
    rect(ctx, 8, 5 - breath, 8, 9, s.base);
    rect(ctx, 7, 6 - breath, 10, 7, s.base);
    // 턱 쉐이딩
    rect(ctx, 8, 13 - breath, 8, 1, s.shadow);
    rect(ctx, 9, 14 - breath, 6, 1, s.shadow);

    // 귀 (좌/우)
    px(ctx, 6, 9 - breath, s.shadow);
    px(ctx, 6, 10 - breath, s.base);
    px(ctx, 17, 9 - breath, s.shadow);
    px(ctx, 17, 10 - breath, s.base);

    // 2. 목
    rect(ctx, 10, 14 - breath, 4, 2, s.shadow);

    // 3. 손 (팔끝 피부 노출부)
    px(ctx, 5, 20 - breath, s.base);
    px(ctx, 5, 21 - breath, s.shadow);
    px(ctx, 18, 20 - breath, s.base);
    px(ctx, 18, 21 - breath, s.shadow);

    // 4. 발목/다리 베이스
    rect(ctx, 8, 26, 3, 3, s.shadow);
    rect(ctx, 13, 26, 3, 3, s.shadow);
  }

  // 레이어 2: 하의 및 신발 (Bottom & Shoes)
  function renderBottom(ctx, bottomId = 'P01', frame = 0) {
    const item = PARTS_CATALOG.bottom.find(b => b.id === bottomId) || PARTS_CATALOG.bottom[0];
    const c = item.color;
    const shoe = item.shoe;
    const type = item.type;

    // 하의 본체 (허리: y=21 ~ 22, 다리: y=23 ~ 28)
    if (type === 'skirt') {
      // 스커트
      rect(ctx, 8, 21, 8, 2, c);
      rect(ctx, 7, 23, 10, 3, c);
      // 밑단 하이라이트/주름
      px(ctx, 9, 25, 'rgba(255,255,255,0.15)');
      px(ctx, 14, 25, 'rgba(0,0,0,0.2)');
      // 다리 (스타킹 또는 맨다리)
      rect(ctx, 9, 26, 2, 3, '#ecd2be');
      rect(ctx, 13, 26, 2, 3, '#ecd2be');
    } else {
      // 팬츠 (슬랙스, 진, 치노)
      rect(ctx, 8, 21, 8, 2, c); // 허리단
      // 좌측 다리
      rect(ctx, 8, 23, 3, 6, c);
      // 우측 다리
      rect(ctx, 13, 23, 3, 6, c);
      // 가랑이 쉐도우
      px(ctx, 11, 23, 'rgba(0,0,0,0.3)');
      px(ctx, 12, 23, 'rgba(0,0,0,0.3)');

      if (type === 'jeans') {
        // 청바지 롤업 스티치
        rect(ctx, 8, 27, 3, 1, 'rgba(255,255,255,0.25)');
        rect(ctx, 13, 27, 3, 1, 'rgba(255,255,255,0.25)');
      } else if (type === 'cargo') {
        // 카고 사이드 포켓
        px(ctx, 7, 24, c);
        px(ctx, 7, 25, 'rgba(0,0,0,0.3)');
        px(ctx, 16, 24, c);
        px(ctx, 16, 25, 'rgba(0,0,0,0.3)');
      }
    }

    // 신발 (y=29 ~ 30)
    // 좌측 신발
    rect(ctx, 7, 29, 4, 2, shoe);
    px(ctx, 7, 29, 'rgba(255,255,255,0.2)');
    // 우측 신발
    rect(ctx, 13, 29, 4, 2, shoe);
    px(ctx, 13, 29, 'rgba(255,255,255,0.2)');
    // 밑창 라인
    rect(ctx, 7, 30, 4, 1, 'rgba(0,0,0,0.35)');
    rect(ctx, 13, 30, 4, 1, 'rgba(0,0,0,0.35)');
  }

  // 레이어 3: 상의 및 의상 (Top & Outfit)
  function renderTop(ctx, topId = 'O01', frame = 0) {
    const item = PARTS_CATALOG.top.find(t => t.id === topId) || PARTS_CATALOG.top[0];
    const pal = PALETTES.clothes[item.palette] || PALETTES.clothes.navySuit;
    const breath = (frame % 2 === 1) ? 1 : 0;
    const y0 = 15 - breath;

    // 상의 몸통 (x: 7 ~ 16, y: y0 ~ y0 + 6)
    rect(ctx, 7, y0, 10, 6, pal.main);
    rect(ctx, 8, y0 + 6, 8, 1, pal.shadow);

    // 소매 / 팔 (좌/우)
    rect(ctx, 5, y0 + 1, 2, 4, pal.main);
    rect(ctx, 17, y0 + 1, 2, 4, pal.main);
    px(ctx, 5, y0 + 5, pal.shadow);
    px(ctx, 18, y0 + 5, pal.shadow);

    // 상의 타입별 디테일
    switch (item.type) {
      case 'suit':
      case 'blazer': {
        // 정장 칼라 (라펠 V존)
        rect(ctx, 10, y0, 4, 3, pal.accent); // 안쪽 셔츠 V존
        rect(ctx, 11, y0 + 1, 2, 4, pal.shadow); // 타이
        px(ctx, 11, y0 + 2, '#d94b4b'); // 레드/포인트 타이
        px(ctx, 12, y0 + 2, '#bf3939');
        // 라펠 라인
        px(ctx, 9, y0 + 1, pal.hi);
        px(ctx, 9, y0 + 2, pal.hi);
        px(ctx, 14, y0 + 1, pal.hi);
        px(ctx, 14, y0 + 2, pal.hi);
        // 포켓 행커치프
        px(ctx, 8, y0 + 3, '#ffffff');
        break;
      }
      case 'labCoat': {
        // 연구원 흰색 가운 + 청록 ID 라인
        rect(ctx, 11, y0, 2, 6, pal.accent); // 안쪽 이너
        rect(ctx, 6, y0, 4, 7, pal.hi); // 롱 코트 날개
        rect(ctx, 14, y0, 4, 7, pal.hi);
        px(ctx, 8, y0 + 2, '#0ea5e9'); // 펜/클립
        px(ctx, 15, y0 + 4, pal.shadow); // 포켓
        break;
      }
      case 'hoodie': {
        // 후드 스트링 & 앞주머니
        rect(ctx, 9, y0, 6, 2, pal.hi);
        px(ctx, 10, y0 + 2, '#ffffff'); // 스트링
        px(ctx, 13, y0 + 2, '#ffffff');
        rect(ctx, 8, y0 + 4, 8, 2, pal.shadow); // 캥거루 포켓
        break;
      }
      case 'shirt':
      case 'shirtTie': {
        // 셔츠 단추 라인
        rect(ctx, 11, y0, 2, 6, pal.hi);
        px(ctx, 11, y0 + 1, pal.shadow); // 단추
        px(ctx, 11, y0 + 3, pal.shadow);
        px(ctx, 11, y0 + 5, pal.shadow);
        if (item.type === 'shirtTie') {
          rect(ctx, 11, y0 + 1, 2, 4, '#2563eb');
        }
        break;
      }
      case 'cardigan':
      case 'knit': {
        // 브이넥 가디건 단추 & 직조감
        rect(ctx, 11, y0, 2, 3, '#ffffff');
        px(ctx, 11, y0 + 3, pal.shadow);
        px(ctx, 11, y0 + 5, pal.shadow);
        break;
      }
      default: {
        // 기본 티셔츠 / 집업
        rect(ctx, 10, y0, 4, 1, pal.accent);
        px(ctx, 11, y0 + 2, pal.hi);
      }
    }
  }

  // 레이어 4: 얼굴 및 표정 (Face & Expression)
  function renderFace(ctx, faceId = 'F01', skinKey = 'warm', frame = 0) {
    const item = PARTS_CATALOG.face.find(f => f.id === faceId) || PARTS_CATALOG.face[0];
    const s = PALETTES.skin[skinKey] || PALETTES.skin.warm;
    const breath = (frame % 2 === 1) ? 1 : 0;
    const blink = (frame % 8 === 7); // 주기적인 눈 깜빡임 애니메이션

    const ey = 9 - breath;
    const eyeDark = '#1e242d';

    // 눈 렌더링
    if (blink) {
      // 깜빡이는 실눈
      rect(ctx, 8, ey + 1, 2, 1, eyeDark);
      rect(ctx, 14, ey + 1, 2, 1, eyeDark);
    } else {
      switch (item.eyes) {
        case 'sharp': // 샤프한 눈빛
          rect(ctx, 8, ey, 2, 2, eyeDark);
          rect(ctx, 14, ey, 2, 2, eyeDark);
          px(ctx, 8, ey, '#ffffff'); // 하이라이트
          px(ctx, 14, ey, '#ffffff');
          // 눈썹
          rect(ctx, 8, ey - 1, 2, 1, '#3b2f28');
          rect(ctx, 14, ey - 1, 2, 1, '#3b2f28');
          break;

        case 'arc': // 활짝 웃는 호선 눈
          px(ctx, 8, ey + 1, eyeDark);
          px(ctx, 9, ey, eyeDark);
          px(ctx, 10, ey + 1, eyeDark);
          px(ctx, 13, ey + 1, eyeDark);
          px(ctx, 14, ey, eyeDark);
          px(ctx, 15, ey + 1, eyeDark);
          break;

        case 'glow': // 사이버 글로우 눈
          rect(ctx, 8, ey, 2, 2, '#00e5ff');
          rect(ctx, 14, ey, 2, 2, '#00e5ff');
          px(ctx, 9, ey, '#ffffff');
          px(ctx, 15, ey, '#ffffff');
          break;

        case 'sparkle': // 반짝이는 큰 눈
          rect(ctx, 8, ey, 2, 3, eyeDark);
          rect(ctx, 14, ey, 2, 3, eyeDark);
          px(ctx, 8, ey, '#ffffff');
          px(ctx, 14, ey, '#ffffff');
          px(ctx, 9, ey + 1, '#78a6ff');
          px(ctx, 15, ey + 1, '#78a6ff');
          break;

        case 'wink': // 한쪽 윙크
          rect(ctx, 8, ey, 2, 2, eyeDark);
          px(ctx, 8, ey, '#ffffff');
          rect(ctx, 14, ey + 1, 2, 1, eyeDark);
          break;

        case 'narrow': // 분석적인 가는 눈
          rect(ctx, 8, ey + 1, 2, 1, eyeDark);
          rect(ctx, 14, ey + 1, 2, 1, eyeDark);
          px(ctx, 9, ey + 1, '#ffffff');
          px(ctx, 15, ey + 1, '#ffffff');
          rect(ctx, 8, ey - 1, 2, 1, '#3a332d');
          rect(ctx, 14, ey - 1, 2, 1, '#3a332d');
          break;

        default: // 일반 눈 (normal)
          rect(ctx, 8, ey, 2, 2, eyeDark);
          rect(ctx, 14, ey, 2, 2, eyeDark);
          px(ctx, 8, ey, '#ffffff');
          px(ctx, 14, ey, '#ffffff');
          break;
      }
    }

    // 안경 표정인 경우 (얼굴 파츠에 안경이 포함된 프리셋)
    if (item.type === 'glassesRound' || item.type === 'glassesSquare') {
      const gColor = item.type === 'glassesRound' ? '#44352b' : '#1a2332';
      // 테두리
      rect(ctx, 7, ey - 1, 4, 3, 'transparent');
      px(ctx, 7, ey, gColor);
      px(ctx, 10, ey, gColor);
      px(ctx, 13, ey, gColor);
      px(ctx, 16, ey, gColor);
      rect(ctx, 11, ey, 2, 1, gColor); // 브릿지
      // 유리 반사
      px(ctx, 8, ey, 'rgba(255,255,255,0.7)');
      px(ctx, 14, ey, 'rgba(255,255,255,0.7)');
    }

    // 홍조 (Blush)
    if (item.blush) {
      rect(ctx, 7, ey + 2, 2, 1, s.blush);
      rect(ctx, 15, ey + 2, 2, 1, s.blush);
    }

    // 입 (Mouth)
    const my = 12 - breath;
    if (item.type === 'happy' || item.type === 'smile' || item.type === 'warm') {
      rect(ctx, 11, my, 2, 1, '#c25852');
      px(ctx, 10, my - 1, '#c25852');
      px(ctx, 13, my - 1, '#c25852');
    } else if (item.type === 'analytical' || item.type === 'serious' || item.type === 'resolute') {
      rect(ctx, 11, my, 2, 1, '#8f574d');
    } else {
      rect(ctx, 11, my, 2, 1, '#b0655c');
    }
  }

  // 레이어 5: 헤어스타일 및 색상 (Hair)
  function renderHair(ctx, hairId = 'H01', frame = 0) {
    const item = PARTS_CATALOG.hair.find(h => h.id === hairId) || PARTS_CATALOG.hair[0];
    const pal = PALETTES.hair[item.color] || PALETTES.hair.black;
    const breath = (frame % 2 === 1) ? 1 : 0;
    const hy = 4 - breath;

    // 헤어 스타일별 픽셀 맵
    switch (item.style) {
      case 'shortCrop': {
        // 단정한 포멀 숏컷
        rect(ctx, 8, hy, 8, 3, pal.main);
        rect(ctx, 7, hy + 2, 10, 3, pal.main);
        rect(ctx, 6, hy + 4, 2, 4, pal.main);
        rect(ctx, 16, hy + 4, 2, 4, pal.main);
        // 하이라이트 라인
        rect(ctx, 9, hy + 1, 6, 1, pal.hi);
        px(ctx, 10, hy + 3, pal.hi);
        break;
      }

      case 'parted': {
        // 클래식 가르마 헤어
        rect(ctx, 8, hy, 8, 3, pal.main);
        rect(ctx, 6, hy + 2, 12, 3, pal.main);
        // 가르마 틈
        px(ctx, 11, hy + 2, pal.shadow);
        px(ctx, 11, hy + 3, pal.shadow);
        // 좌우 볼륨
        rect(ctx, 6, hy + 4, 2, 4, pal.main);
        rect(ctx, 16, hy + 4, 2, 4, pal.main);
        rect(ctx, 8, hy + 1, 3, 1, pal.hi);
        rect(ctx, 12, hy + 1, 4, 1, pal.hi);
        break;
      }

      case 'dandy': {
        // 볼륨 투블럭 / 댄디
        rect(ctx, 7, hy - 1, 10, 4, pal.main);
        rect(ctx, 6, hy + 2, 12, 3, pal.main);
        rect(ctx, 7, hy + 5, 4, 2, pal.main); // 비대칭 앞머리
        rect(ctx, 6, hy + 4, 1, 4, pal.shadow);
        rect(ctx, 17, hy + 4, 1, 4, pal.shadow);
        rect(ctx, 8, hy, 7, 1, pal.hi);
        break;
      }

      case 'bob': {
        // 단정한 보브 단발
        rect(ctx, 7, hy, 10, 3, pal.main);
        rect(ctx, 6, hy + 2, 12, 4, pal.main);
        rect(ctx, 5, hy + 5, 3, 7, pal.main); // 좌측 단발선
        rect(ctx, 16, hy + 5, 3, 7, pal.main); // 우측 단발선
        rect(ctx, 8, hy + 1, 8, 1, pal.hi);
        rect(ctx, 8, hy + 4, 8, 1, pal.main); // 일자 앞머리
        break;
      }

      case 'wavyLong': {
        // 웨이브 롱헤어
        rect(ctx, 7, hy, 10, 4, pal.main);
        rect(ctx, 6, hy + 3, 12, 3, pal.main);
        // 길게 늘어지는 웨이브 (어깨 아래까지)
        rect(ctx, 5, hy + 6, 3, 10, pal.main);
        rect(ctx, 16, hy + 6, 3, 10, pal.main);
        px(ctx, 5, hy + 15, pal.shadow);
        px(ctx, 18, hy + 15, pal.shadow);
        rect(ctx, 8, hy + 1, 8, 1, pal.hi);
        break;
      }

      case 'ponytail': {
        // 포니테일
        rect(ctx, 7, hy, 10, 4, pal.main);
        rect(ctx, 6, hy + 3, 12, 3, pal.main);
        rect(ctx, 6, hy + 5, 2, 3, pal.main);
        rect(ctx, 16, hy + 5, 2, 3, pal.main);
        // 뒤통수 위로 솟은 포니테일 묶음
        rect(ctx, 16, hy - 2, 4, 3, pal.main);
        rect(ctx, 18, hy + 1, 3, 6, pal.shadow);
        px(ctx, 17, hy - 1, pal.hi);
        px(ctx, 16, hy, '#ff477e'); // 핑크 머리끈 포인트
        break;
      }

      case 'bun': {
        // 올림머리 / 번 헤어
        rect(ctx, 7, hy, 10, 4, pal.main);
        rect(ctx, 6, hy + 3, 12, 3, pal.main);
        rect(ctx, 10, hy - 3, 4, 3, pal.main); // 정수리 똥머리
        rect(ctx, 11, hy - 2, 2, 1, pal.hi);
        rect(ctx, 6, hy + 5, 2, 4, pal.main);
        rect(ctx, 16, hy + 5, 2, 4, pal.main);
        break;
      }

      case 'curly': {
        // 볼륨 컬리 헤어
        rect(ctx, 6, hy - 1, 12, 5, pal.main);
        rect(ctx, 5, hy + 3, 14, 5, pal.main);
        px(ctx, 5, hy, pal.hi);
        px(ctx, 8, hy - 2, pal.hi);
        px(ctx, 14, hy - 2, pal.hi);
        px(ctx, 18, hy, pal.hi);
        rect(ctx, 5, hy + 7, 2, 4, pal.shadow);
        rect(ctx, 17, hy + 7, 2, 4, pal.shadow);
        break;
      }

      default: {
        // 기본 숏
        rect(ctx, 8, hy, 8, 3, pal.main);
        rect(ctx, 7, hy + 2, 10, 3, pal.main);
        rect(ctx, 6, hy + 4, 2, 4, pal.main);
        rect(ctx, 16, hy + 4, 2, 4, pal.main);
        rect(ctx, 9, hy + 1, 6, 1, pal.hi);
      }
    }
  }

  // 레이어 6: 액세서리 및 소품 (Accessory & Gear)
  function renderAccessory(ctx, accId = 'A00', frame = 0) {
    if (!accId || accId === 'A00') return;
    const item = PARTS_CATALOG.accessory.find(a => a.id === accId);
    if (!item) return;

    const breath = (frame % 2 === 1) ? 1 : 0;
    const ay = 15 - breath;

    switch (item.type) {
      case 'badge': {
        // 사원증 목걸이 (넥스트랩 + 플라스틱 카드)
        // 스트랩 라인
        px(ctx, 10, ay, '#22c55e');
        px(ctx, 13, ay, '#22c55e');
        px(ctx, 11, ay + 1, '#16a34a');
        px(ctx, 12, ay + 1, '#16a34a');
        // 카드 본체 (y=ay+2 ~ ay+4)
        rect(ctx, 11, ay + 2, 3, 3, '#ffffff');
        rect(ctx, 11, ay + 2, 3, 1, '#22c55e'); // 상단 컬러 띠
        px(ctx, 12, ay + 3, '#2563eb'); // 미니 사진
        break;
      }

      case 'headset': {
        // 오피스 헤드셋 (헤어 위 밴드 + 귀 마이크)
        const hy = 3 - breath;
        rect(ctx, 8, hy, 8, 1, '#374151'); // 헤드밴드
        // 양쪽 이어컵
        rect(ctx, 5, hy + 5, 2, 4, '#1f2937');
        rect(ctx, 17, hy + 5, 2, 4, '#1f2937');
        // 마이크 암 (우측에서 턱으로)
        px(ctx, 18, hy + 9, '#111827');
        px(ctx, 17, hy + 10, '#111827');
        px(ctx, 16, hy + 11, '#10b981'); // 마이크 끝 온에어 LED
        break;
      }

      case 'glasses':
      case 'goldGlasses': {
        // 안경 소품 레이어
        const ey = 9 - breath;
        const gColor = item.type === 'goldGlasses' ? '#eab308' : '#111827';
        px(ctx, 7, ey, gColor);
        px(ctx, 10, ey, gColor);
        px(ctx, 13, ey, gColor);
        px(ctx, 16, ey, gColor);
        rect(ctx, 11, ey, 2, 1, gColor);
        px(ctx, 8, ey, 'rgba(255,255,255,0.75)');
        px(ctx, 14, ey, 'rgba(255,255,255,0.75)');
        break;
      }

      case 'coffee': {
        // 오른손에 든 테이크아웃 종이컵
        const cy = 18 - breath;
        rect(ctx, 19, cy, 3, 4, '#f1f5f9'); // 화이트 컵
        rect(ctx, 18, cy, 5, 1, '#64748b'); // 리드(뚜껑)
        rect(ctx, 19, cy + 2, 3, 1, '#b45309'); // 크라프트 슬리브
        // 따뜻한 김 모락모락
        if (frame % 4 < 2) {
          px(ctx, 20, cy - 2, 'rgba(255,255,255,0.6)');
          px(ctx, 21, cy - 3, 'rgba(255,255,255,0.4)');
        }
        break;
      }

      case 'laptop': {
        // 왼손에 낀 메탈릭 슬림 랩탑
        const ly = 19 - breath;
        rect(ctx, 2, ly, 4, 5, '#94a3b8');
        rect(ctx, 3, ly + 1, 2, 3, '#cbd5e1');
        px(ctx, 4, ly + 2, '#3b82f6'); // 로고
        break;
      }

      case 'visor': {
        // 사이버 네온 바이저
        const vy = 8 - breath;
        rect(ctx, 6, vy, 12, 3, 'rgba(6, 182, 212, 0.85)');
        rect(ctx, 8, vy + 1, 8, 1, '#ffffff'); // 발광 코어
        break;
      }

      case 'aura': {
        // AI 홀로그램 오라 (반짝이는 파티클)
        const t = frame % 6;
        px(ctx, 4 + t, 3, '#38bdf8');
        px(ctx, 19 - t, 6, '#34d399');
        px(ctx, 3, 15 + t, '#818cf8');
        px(ctx, 20, 22 - t, '#f472b6');
        break;
      }

      case 'drone': {
        // 캐릭터 머리 위를 맴도는 미니 서포트 드론
        const dy = (frame % 2 === 0) ? 1 : 2;
        rect(ctx, 1, dy, 4, 2, '#334155');
        px(ctx, 0, dy - 1, '#06b6d4'); // 프로펠러 회전 광원
        px(ctx, 4, dy - 1, '#06b6d4');
        px(ctx, 2, dy + 1, '#10b981'); // 센서 눈
        break;
      }

      default:
        break;
    }
  }

  /**
   * 메인 렌더링 함수: Canvas에 파츠별로 레이어 순서에 맞춰 픽셀 캐릭터 합성
   *
   * @param {HTMLCanvasElement|CanvasRenderingContext2D} target
   * @param {Object} config - { skin, hair, face, top, bottom, accessory }
   * @param {Object} options - { scale, clear, frame, activeLayers }
   */
  function renderPixelCharacter(target, config = {}, options = {}) {
    const canvas = target.canvas || target;
    const ctx = target.getContext ? target.getContext('2d') : target;
    const scale = options.scale || Math.floor(canvas.width / CANVAS_WIDTH) || 4;
    const frame = options.frame || 0;
    const layers = options.activeLayers || {
      body: true,
      bottom: true,
      top: true,
      face: true,
      hair: true,
      accessory: true
    };

    // 픽셀 아트 최적화 설정
    ctx.imageSmoothingEnabled = false;

    // 내부 버퍼 캔버스 (24 x 32)
    const buffer = document.createElement('canvas');
    buffer.width = CANVAS_WIDTH;
    buffer.height = CANVAS_HEIGHT;
    const bctx = buffer.getContext('2d');
    bctx.imageSmoothingEnabled = false;

    // 파츠 설정 기본값 매핑
    const skinKey = config.skin || 'warm';
    const hairId = config.hair || 'H01';
    const faceId = config.face || 'F01';
    const topId = config.top || 'O01';
    const bottomId = config.bottom || 'P01';
    const accId = config.accessory || 'A00';

    // 1단계: Body & Shadow
    if (layers.body) renderBody(bctx, skinKey, frame);

    // 2단계: Bottom & Shoes
    if (layers.bottom) renderBottom(bctx, bottomId, frame);

    // 3단계: Top & Outfit
    if (layers.top) renderTop(bctx, topId, frame);

    // 4단계: Face & Expression
    if (layers.face) renderFace(bctx, faceId, skinKey, frame);

    // 5단계: Hair
    if (layers.hair) renderHair(bctx, hairId, frame);

    // 6단계: Accessory & Gear
    if (layers.accessory) renderAccessory(bctx, accId, frame);

    // 대상 캔버스에 업스케일 렌더링
    if (options.clear !== false) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    const drawW = CANVAS_WIDTH * scale;
    const drawH = CANVAS_HEIGHT * scale;
    const offsetX = Math.floor((canvas.width - drawW) / 2);
    const offsetY = Math.floor((canvas.height - drawH) / 2);

    ctx.drawImage(buffer, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT, offsetX, offsetY, drawW, drawH);

    return buffer;
  }

  /**
   * 지정된 설정의 캐릭터를 새 캔버스 객체로 생성하여 반환
   */
  function createPixelCanvas(config = {}, scale = 4) {
    const canvas = document.createElement('canvas');
    canvas.width = CANVAS_WIDTH * scale;
    canvas.height = CANVAS_HEIGHT * scale;
    renderPixelCharacter(canvas, config, { scale });
    return canvas;
  }

  /**
   * DataURL (PNG) 생성
   */
  function toDataURL(config = {}, scale = 4) {
    const canvas = createPixelCanvas(config, scale);
    return canvas.toDataURL('image/png');
  }

  /**
   * 개별 파츠별 분해 캔버스 세트 생성 (Layer Breakdown View용)
   */
  function createExplodedLayers(config = {}, scale = 3) {
    const layerNames = ['body', 'bottom', 'top', 'face', 'hair', 'accessory'];
    const results = {};
    layerNames.forEach(name => {
      const c = document.createElement('canvas');
      c.width = CANVAS_WIDTH * scale;
      c.height = CANVAS_HEIGHT * scale;
      const singleLayer = {
        body: false, bottom: false, top: false, face: false, hair: false, accessory: false
      };
      singleLayer[name] = true;
      renderPixelCharacter(c, config, { scale, activeLayers: singleLayer });
      results[name] = c;
    });
    return results;
  }

  return {
    CANVAS_WIDTH,
    CANVAS_HEIGHT,
    PALETTES,
    PARTS_CATALOG,
    renderPixelCharacter,
    createPixelCanvas,
    toDataURL,
    createExplodedLayers
  };
});
