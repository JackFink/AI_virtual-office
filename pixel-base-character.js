/**
 * 픽셀 좌표 기반 2등신 치비 베이스 캐릭터 스프라이트 엔진 (Base Character JavaScript Module)
 *
 * 메이플스토리 및 레트로 픽셀 게임 규격의 [x, y, paletteIndex] 좌표 매핑 구조를 통해
 * 선명한 픽셀 아트(Nearest Neighbor) 렌더링, 프레임 애니메이션, 팔레트 스왑(피부톤 변경),
 * Canvas 및 SVG 다중 출력을 완벽 지원하는 독립형 베이스 캐릭터 모듈입니다.
 */

// ==========================================================================
// [1] 픽셀 좌표 기반 캐릭터 스프라이트 데이터 (CharacterSpriteData)
// ==========================================================================
export const CharacterSpriteData = {
  meta: {
    name: "agent_chibi_base",
    width: 40,
    height: 64,
    pixelSize: 2, // 기본 렌더링 배율 (1px -> 2x2 screen px)
    author: "NEXUS AI Studio",
    version: "1.0.0"
  },

  // 기본 색상 팔레트 (외곽선, 피부 하이라이트, 미드톤, 음영, 홍조)
  palette: [
    "#000000", // 0: 메인 외곽선 (Pure Black Outline)
    "#2e180d", // 1: 브라운 다크 외곽선 (Soft Contour)
    "#ffffff", // 2: 하이라이트 순백 (Specular White)
    "#fff3ea", // 3: 피부 기본 베이스 (Light Skin)
    "#ffe2cc", // 4: 피부 미드톤 (Mid Skin Tone)
    "#ffc696", // 5: 피부 1차 음영 (Shade 1)
    "#ffa85c", // 6: 피부 2차 음영 (Shade 2)
    "#ff8c3b", // 7: 눈가 음영 및 볼터치 포인트 (Accent Blush)
    "#e28b4d", // 8: 관절/바디 하단 딥 섀도우 (Deep Cavity)
    "rgba(0, 0, 0, 0.18)" // 9: 바닥 그림자 (Shadow)
  ],

  // 피부톤 프리셋 (팔레트 스왑용)
  skinPresets: {
    fair:    ["#000000", "#2e180d", "#ffffff", "#fff3ea", "#ffe2cc", "#ffc696", "#ffa85c", "#ff8c3b", "#e28b4d"],
    rosy:    ["#000000", "#331612", "#ffffff", "#ffebe6", "#ffd8cf", "#fba99b", "#f28574", "#e85f4c", "#c94634"],
    warm:    ["#000000", "#2b1908", "#ffffff", "#fef3e2", "#f7dfbe", "#e4be8c", "#cb9f65", "#b88344", "#946328"],
    tan:     ["#000000", "#261304", "#ffffff", "#ecd2b6", "#d9b38c", "#ba8c5c", "#9c6e3b", "#855825", "#643c12"],
    cyborg:  ["#000000", "#112233", "#ffffff", "#eaf4fc", "#cfebfe", "#93c5fd", "#60a5fa", "#38bdf8", "#1d4ed8"]
  },

  // 프레임별 [x, y, paletteIndex] 좌표 데이터
  frames: {
    // ------------------------------------------------------------------------
    // [프레임 0]: 스탠딩 기본형 (Idle 0)
    // ------------------------------------------------------------------------
    "idle_0": {
      duration: 350,
      pixels: [
        // [0] 바닥 접지 그림자 (Pedestal Shadow)
        [13, 58, 9], [14, 58, 9], [15, 58, 9], [16, 58, 9], [17, 58, 9], [18, 58, 9], [19, 58, 9], [20, 58, 9], [21, 58, 9], [22, 58, 9],
        [11, 59, 9], [12, 59, 9], [13, 59, 9], [14, 59, 9], [15, 59, 9], [16, 59, 9], [17, 59, 9], [18, 59, 9], [19, 59, 9], [20, 59, 9], [21, 59, 9], [22, 59, 9], [23, 59, 9], [24, 59, 9],
        [13, 60, 9], [14, 60, 9], [15, 60, 9], [16, 60, 9], [17, 60, 9], [18, 60, 9], [19, 60, 9], [20, 60, 9], [21, 60, 9], [22, 60, 9],

        // [1] 두상 상단 외곽선 및 하이라이트
        [15, 2, 0], [16, 2, 0], [17, 2, 0], [18, 2, 0], [19, 2, 0], [20, 2, 0],
        [13, 3, 0], [14, 3, 0], [15, 3, 2], [16, 3, 2], [17, 3, 2], [18, 3, 3], [19, 3, 3], [20, 3, 0], [21, 3, 0],
        [11, 4, 0], [12, 4, 0], [13, 4, 2], [14, 4, 2], [15, 4, 2], [16, 4, 3], [17, 4, 3], [18, 4, 3], [19, 4, 3], [22, 4, 0],
        [9, 5, 0], [10, 5, 0], [11, 5, 2], [12, 5, 2], [13, 5, 3], [18, 5, 3], [19, 5, 3], [20, 5, 3], [23, 5, 0],
        [8, 6, 0], [9, 6, 2], [10, 6, 3], [11, 6, 3], [12, 6, 3], [21, 6, 3], [22, 6, 3], [24, 6, 0],
        [7, 7, 0], [8, 7, 2], [9, 7, 3], [10, 7, 3], [22, 7, 3], [23, 7, 3], [25, 7, 0],

        // [2] 이마 및 얼굴 중앙 베이스
        [8, 8, 0], [9, 8, 2], [10, 8, 3], [11, 8, 3], [18, 8, 3], [19, 8, 3], [24, 8, 3], [25, 8, 0],
        [7, 9, 0], [8, 9, 3], [9, 9, 3], [10, 9, 3], [19, 9, 3], [20, 9, 3], [25, 9, 3], [26, 9, 0],
        [7, 10, 0], [8, 10, 2], [9, 10, 3], [12, 10, 3], [20, 10, 4], [25, 10, 4], [26, 10, 0],
        [6, 11, 0], [7, 11, 3], [8, 11, 3], [13, 11, 3], [21, 11, 4], [26, 11, 4], [27, 11, 0],
        [6, 12, 0], [7, 12, 3], [8, 12, 3], [14, 12, 3], [22, 12, 4], [26, 12, 4], [27, 12, 0],
        [6, 13, 0], [7, 13, 3], [8, 13, 3], [15, 13, 3], [23, 13, 4], [26, 13, 4], [27, 13, 0],
        [6, 14, 0], [7, 14, 3], [8, 14, 3], [16, 14, 3], [24, 14, 4], [26, 14, 4], [27, 14, 0],
        [6, 15, 0], [7, 15, 3], [8, 15, 3], [15, 15, 3], [24, 15, 4], [26, 15, 4], [27, 15, 0],

        // [3] 눈가 안와 음영 및 볼터치 포인트 (Blush & Shading Zone)
        [7, 16, 0], [8, 16, 4], [9, 16, 5], [10, 16, 6], [11, 16, 7], [12, 16, 6], [13, 16, 5],
        [16, 16, 4], [19, 16, 5], [20, 16, 6], [21, 16, 7], [22, 16, 6], [25, 16, 4], [26, 16, 0],
        [8, 17, 0], [9, 17, 5], [10, 17, 6], [11, 17, 7], [12, 17, 6], [13, 17, 5],
        [17, 17, 4], [19, 17, 6], [20, 17, 7], [21, 17, 6], [22, 17, 5], [26, 17, 4], [27, 17, 0],
        [8, 18, 0], [9, 18, 6], [10, 18, 7], [11, 18, 7], [12, 18, 6], [20, 18, 7], [21, 18, 7], [22, 18, 6], [26, 18, 0],

        // [4] 좌/우 귀 영역 (Ears)
        [4, 18, 0], [5, 18, 0], [6, 18, 0],
        [4, 19, 0], [5, 19, 4], [6, 19, 5],
        [4, 20, 0], [5, 20, 5], [6, 20, 0],
        [27, 18, 0], [28, 18, 0], [29, 18, 0],
        [28, 19, 5], [29, 19, 4], [30, 19, 0],
        [28, 20, 0], [29, 20, 5], [30, 20, 0],
        [27, 21, 0], [28, 21, 0],

        // [5] 턱선 및 하단 마감 (Jawline)
        [8, 22, 0], [9, 22, 3], [10, 22, 3], [23, 22, 4], [24, 22, 4], [25, 22, 0],
        [9, 23, 0], [10, 23, 3], [11, 23, 3], [22, 23, 4], [23, 23, 4], [24, 23, 0],
        [10, 24, 0], [11, 24, 3], [12, 24, 4], [21, 24, 4], [22, 24, 4], [23, 24, 0],
        [11, 25, 0], [12, 25, 4], [13, 25, 4], [19, 25, 4], [20, 25, 5], [21, 25, 0],
        [12, 26, 0], [13, 26, 0], [14, 26, 4], [15, 26, 4], [16, 26, 5], [17, 26, 5], [18, 26, 0],

        // [6] 목 및 쇄골부 (Neck)
        [16, 27, 0], [17, 27, 4], [18, 27, 5], [19, 27, 0],
        [16, 28, 0], [17, 28, 4], [18, 28, 5], [19, 28, 0],
        [15, 29, 0], [16, 29, 4], [17, 29, 4], [18, 29, 5], [19, 29, 5], [20, 29, 0],

        // [7] 몸통 및 이너웨어 기본 베이스 (Torso)
        [14, 30, 0], [15, 30, 3], [16, 30, 3], [17, 30, 4], [18, 30, 4], [19, 30, 5], [20, 30, 0],
        [14, 31, 0], [15, 31, 3], [16, 31, 3], [17, 31, 4], [18, 31, 4], [19, 31, 5], [20, 31, 0],
        [14, 32, 0], [15, 32, 3], [16, 32, 3], [17, 32, 4], [18, 32, 4], [19, 32, 5], [20, 32, 0],
        [13, 33, 0], [14, 33, 3], [15, 33, 3], [16, 33, 4], [17, 33, 4], [18, 33, 5], [19, 33, 5], [21, 33, 0],
        [13, 34, 0], [14, 34, 3], [15, 34, 3], [16, 34, 4], [17, 34, 4], [18, 34, 5], [19, 34, 5], [21, 34, 0],
        [13, 35, 0], [14, 35, 3], [15, 35, 4], [16, 35, 4], [17, 35, 5], [18, 35, 5], [19, 35, 6], [21, 35, 0],
        [13, 36, 0], [14, 36, 4], [15, 36, 4], [16, 36, 5], [17, 36, 5], [18, 36, 6], [19, 36, 6], [21, 36, 0],
        [14, 37, 0], [15, 37, 4], [16, 37, 5], [17, 37, 5], [18, 37, 6], [19, 37, 0],

        // [8] 양팔 및 손 (Left & Right Arms)
        // 왼팔
        [11, 31, 0], [12, 31, 3], [13, 31, 0],
        [10, 32, 0], [11, 32, 3], [12, 32, 4], [13, 32, 0],
        [10, 33, 0], [11, 33, 3], [12, 33, 4], [13, 33, 0],
        [9, 34, 0],  [10, 34, 3], [11, 34, 4], [12, 34, 0],
        [9, 35, 0],  [10, 35, 3], [11, 35, 4], [12, 35, 0],
        [8, 36, 0],  [9, 36, 3],  [10, 36, 4], [11, 36, 0],
        // 왼손
        [7, 37, 0],  [8, 37, 3],  [9, 37, 4],  [10, 37, 0],
        [7, 38, 0],  [8, 38, 4],  [9, 38, 5],  [10, 38, 0],
        [8, 39, 0],  [9, 39, 0],

        // 오른팔
        [21, 31, 0], [22, 31, 4], [23, 31, 0],
        [21, 32, 0], [22, 32, 4], [23, 32, 5], [24, 32, 0],
        [21, 33, 0], [22, 33, 4], [23, 33, 5], [24, 33, 0],
        [22, 34, 0], [23, 34, 5], [24, 34, 5], [25, 34, 0],
        [22, 35, 0], [23, 35, 5], [24, 35, 6], [25, 35, 0],
        [23, 36, 0], [24, 36, 5], [25, 36, 6], [26, 36, 0],
        // 오른손
        [24, 37, 0], [25, 37, 5], [26, 37, 6], [27, 37, 0],
        [24, 38, 0], [25, 38, 6], [26, 38, 6], [27, 38, 0],
        [25, 39, 0], [26, 39, 0],

        // [9] 골반 및 다리 (Pelvis & Legs)
        [14, 38, 0], [15, 38, 5], [16, 38, 5], [17, 38, 6], [18, 38, 6], [19, 38, 0],
        [14, 39, 0], [15, 39, 5], [16, 39, 6], [17, 39, 6], [18, 39, 8], [19, 39, 0],
        [14, 40, 0], [15, 40, 5], [16, 40, 6], [17, 40, 6], [18, 40, 8], [19, 40, 0],

        // 왼다리
        [14, 41, 0], [15, 41, 3], [16, 41, 4], [17, 41, 0],
        [14, 42, 0], [15, 42, 3], [16, 42, 4], [17, 42, 0],
        [14, 43, 0], [15, 43, 3], [16, 43, 4], [17, 43, 0],
        [14, 44, 0], [15, 44, 4], [16, 44, 5], [17, 44, 0],
        [14, 45, 0], [15, 45, 4], [16, 45, 5], [17, 45, 0],
        [14, 46, 0], [15, 46, 4], [16, 46, 5], [17, 46, 0],
        [14, 47, 0], [15, 47, 4], [16, 47, 5], [17, 47, 0],
        [14, 48, 0], [15, 48, 5], [16, 48, 6], [17, 48, 0],
        [14, 49, 0], [15, 49, 5], [16, 49, 6], [17, 49, 0],
        [14, 50, 0], [15, 50, 5], [16, 50, 6], [17, 50, 0],

        // 왼발
        [12, 51, 0], [13, 51, 0], [14, 51, 3], [15, 51, 4], [16, 51, 5], [17, 51, 0],
        [12, 52, 0], [13, 52, 3], [14, 52, 3], [15, 52, 4], [16, 52, 5], [17, 52, 0],
        [12, 53, 0], [13, 53, 3], [14, 53, 4], [15, 53, 5], [16, 53, 5], [17, 53, 0],
        [12, 54, 0], [13, 54, 4], [14, 54, 5], [15, 54, 6], [16, 54, 6], [17, 54, 0],
        [12, 55, 0], [13, 55, 0], [14, 55, 0], [15, 55, 0], [16, 55, 0], [17, 55, 0],

        // 오른다리
        [18, 41, 0], [19, 41, 4], [20, 41, 5], [21, 41, 0],
        [18, 42, 0], [19, 42, 4], [20, 42, 5], [21, 42, 0],
        [18, 43, 0], [19, 43, 4], [20, 43, 5], [21, 43, 0],
        [18, 44, 0], [19, 44, 5], [20, 44, 6], [21, 44, 0],
        [18, 45, 0], [19, 45, 5], [20, 45, 6], [21, 45, 0],
        [18, 46, 0], [19, 46, 5], [20, 46, 6], [21, 46, 0],
        [18, 47, 0], [19, 47, 5], [20, 47, 6], [21, 47, 0],
        [18, 48, 0], [19, 48, 6], [20, 48, 6], [21, 48, 0],
        [18, 49, 0], [19, 49, 6], [20, 49, 8], [21, 49, 0],
        [18, 50, 0], [19, 50, 6], [20, 50, 8], [21, 50, 0],

        // 오른발
        [18, 51, 0], [19, 51, 4], [20, 51, 5], [21, 51, 6], [22, 51, 0], [23, 51, 0],
        [18, 52, 0], [19, 52, 4], [20, 52, 5], [21, 52, 5], [22, 52, 5], [23, 52, 0],
        [18, 53, 0], [19, 53, 5], [20, 53, 5], [21, 53, 6], [22, 53, 6], [23, 53, 0],
        [18, 54, 0], [19, 54, 5], [20, 54, 6], [21, 54, 6], [22, 54, 8], [23, 54, 0],
        [18, 55, 0], [19, 55, 0], [20, 55, 0], [21, 55, 0], [22, 55, 0], [23, 55, 0]
      ]
    },

    // ------------------------------------------------------------------------
    // [프레임 1]: 숨쉬기/모션 1 (Idle 1 - 상체/두상 Y축 +1px 미세 변동 프레임)
    // ------------------------------------------------------------------------
    "idle_1": {
      duration: 350,
      pixels: null // 런타임에 idle_0 기반 Y 오프셋 자동 계산 또는 직접 지정
    }
  }
};

// 프레임 1 (Idle 1) 데이터 동적 초기화: 상체와 머리는 Y+1 호흡 바운스, 발은 접지 고정
(function initIdleFrame1() {
  const f0 = CharacterSpriteData.frames["idle_0"].pixels;
  CharacterSpriteData.frames["idle_1"].pixels = f0.map(([x, y, p]) => {
    // 발(Y >= 51)과 그림자(Y >= 58)는 바닥에 고정, 상체/머리는 +1px 호흡 다운
    const newY = (y >= 51) ? y : y + 1;
    return [x, newY, p];
  });
})();

// ==========================================================================
// [2] 픽셀 스프라이트 렌더러 엔진 (PixelSpriteRenderer)
// ==========================================================================
export class PixelSpriteRenderer {
  /**
   * @param {Object} spriteData - CharacterSpriteData 객체
   * @param {Object} options - 렌더러 기본 설정
   */
  constructor(spriteData = CharacterSpriteData, options = {}) {
    this.spriteData = spriteData;
    this.currentPalette = [...spriteData.palette];
    this.pixelSize = options.pixelSize || spriteData.meta.pixelSize || 2;
    this.width = spriteData.meta.width;
    this.height = spriteData.meta.height;
  }

  /**
   * 피부톤/팔레트 교체 (Palette Swapping)
   * @param {string[]|string} paletteOrPresetName - 팔레트 배열 또는 프리셋 이름 ('fair', 'warm', 'tan' 등)
   */
  setPalette(paletteOrPresetName) {
    if (typeof paletteOrPresetName === 'string' && this.spriteData.skinPresets[paletteOrPresetName]) {
      this.currentPalette = [...this.spriteData.skinPresets[paletteOrPresetName]];
    } else if (Array.isArray(paletteOrPresetName)) {
      this.currentPalette = [...paletteOrPresetName];
    }
    return this;
  }

  /**
   * HTML5 Canvas에 특정 프레임 렌더링
   * @param {HTMLCanvasElement} canvas - 대상 캔버스 엘리먼트
   * @param {string} frameKey - 렌더링할 프레임 키 ('idle_0', 'idle_1')
   * @param {Object} renderOptions - { pixelSize, clear }
   */
  renderToCanvas(canvas, frameKey = "idle_0", renderOptions = {}) {
    if (!canvas) throw new Error("Canvas element is required");

    const scale = renderOptions.pixelSize || this.pixelSize;
    const clear = renderOptions.clear !== false;
    const targetWidth = this.width * scale;
    const targetHeight = this.height * scale;

    if (canvas.width !== targetWidth) canvas.width = targetWidth;
    if (canvas.height !== targetHeight) canvas.height = targetHeight;

    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false; // 선명한 픽셀 아트 유지

    if (clear) {
      ctx.clearRect(0, 0, targetWidth, targetHeight);
    }

    const frame = this.spriteData.frames[frameKey] || this.spriteData.frames["idle_0"];
    const pixels = frame.pixels;

    for (let i = 0; i < pixels.length; i++) {
      const [x, y, paletteIdx] = pixels[i];
      const color = this.currentPalette[paletteIdx] || "#000000";

      ctx.fillStyle = color;
      ctx.fillRect(x * scale, y * scale, scale, scale);
    }

    return canvas;
  }

  /**
   * 순수 SVG 문자열 생성 (웹 임베딩 및 CSS 독립 렌더링용)
   * @param {string} frameKey - 프레임 키
   * @param {Object} svgOptions - { width, height, className }
   * @returns {string} SVG 마크업 문자열
   */
  renderToSVG(frameKey = "idle_0", svgOptions = {}) {
    const scale = svgOptions.pixelSize || this.pixelSize;
    const targetWidth = svgOptions.width || (this.width * scale);
    const targetHeight = svgOptions.height || (this.height * scale);
    const className = svgOptions.className || "pixel-sprite-svg";

    const frame = this.spriteData.frames[frameKey] || this.spriteData.frames["idle_0"];
    const pixels = frame.pixels;

    // 색상별 rect 그룹화로 SVG 크기 및 렌더링 성능 최적화
    const colorGroups = {};
    for (let i = 0; i < pixels.length; i++) {
      const [x, y, paletteIdx] = pixels[i];
      const color = this.currentPalette[paletteIdx] || "#000000";
      if (!colorGroups[color]) colorGroups[color] = [];
      colorGroups[color].push([x, y]);
    }

    let rectsMarkup = '';
    for (const [color, coords] of Object.entries(colorGroups)) {
      rectsMarkup += `<g fill="${color}">`;
      for (let j = 0; j < coords.length; j++) {
        rectsMarkup += `<rect x="${coords[j][0]}" y="${coords[j][1]}" width="1" height="1"/>`;
      }
      rectsMarkup += `</g>`;
    }

    return `
      <svg xmlns="http://www.w3.org/2000/svg"
           viewBox="0 0 ${this.width} ${this.height}"
           width="${targetWidth}"
           height="${targetHeight}"
           shape-rendering="crispEdges"
           class="${className}">
        ${rectsMarkup}
      </svg>
    `.trim();
  }

  /**
   * 캔버스 실시간 애니메이션 루프 컨트롤러 생성
   * @param {HTMLCanvasElement} canvas
   * @param {Object} animOptions - { onFrameChange, fps }
   * @returns {Object} 애니메이션 컨트롤러 { play, pause, toggle, setFrame }
   */
  createAnimation(canvas, animOptions = {}) {
    const frameKeys = Object.keys(this.spriteData.frames);
    let currentIdx = 0;
    let isRunning = false;
    let timerId = null;

    const step = () => {
      if (!isRunning) return;
      const key = frameKeys[currentIdx];
      const frame = this.spriteData.frames[key];

      this.renderToCanvas(canvas, key);

      if (animOptions.onFrameChange) {
        animOptions.onFrameChange(key, currentIdx);
      }

      currentIdx = (currentIdx + 1) % frameKeys.length;
      timerId = setTimeout(step, frame.duration || 300);
    };

    return {
      play: () => {
        if (isRunning) return;
        isRunning = true;
        step();
      },
      pause: () => {
        isRunning = false;
        if (timerId) clearTimeout(timerId);
      },
      toggle: () => {
        if (isRunning) {
          isRunning = false;
          if (timerId) clearTimeout(timerId);
        } else {
          isRunning = true;
          step();
        }
      },
      setFrame: (key) => {
        if (this.spriteData.frames[key]) {
          this.renderToCanvas(canvas, key);
        }
      }
    };
  }

  /**
   * 투명 배경 PNG DataURL 내보내기
   * @param {string} frameKey
   * @param {number} scale
   * @returns {string} base64 data:image/png URL
   */
  toDataURL(frameKey = "idle_0", scale = 4) {
    const offscreen = document.createElement('canvas');
    this.renderToCanvas(offscreen, frameKey, { pixelSize: scale });
    return offscreen.toDataURL('image/png');
  }
}

// 브라우저 전역 객체 바인딩 (Non-Module 환경 호환)
if (typeof window !== 'undefined') {
  window.CharacterSpriteData = CharacterSpriteData;
  window.PixelSpriteRenderer = PixelSpriteRenderer;
}
