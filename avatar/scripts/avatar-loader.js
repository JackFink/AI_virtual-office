/**
 * avatar-loader.js
 * NEXUS 픽셀 아바타 JSON 규격 로더 & 렌더러
 * 
 * JSON으로 정의된 픽셀 좌표 데이터([x, y, paletteIndex]) 및 스팬 데이터를 읽어
 * Canvas 및 SVG로 렌더링하고, 멀티 레이어 아바타 합성을 지원합니다.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.AvatarLoader = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // 캐시
  const cache = new Map();

  /**
   * JSON 파일 비동기 로드
   * @param {string} path - JSON 파일 경로
   */
  async function loadJSON(path) {
    if (cache.has(path)) return cache.get(path);
    const res = await fetch(path);
    if (!res.ok) throw new Error(`Failed to load avatar JSON from ${path}: ${res.statusText}`);
    const data = await res.json();
    cache.set(path, data);
    return data;
  }

  /**
   * 픽셀 좌표 데이터로부터 SVG 생성
   * @param {Array<[number, number, number]>} pixels - [[x, y, paletteIndex], ...]
   * @param {Array<string>} palette - 색상 팔레트 배열
   * @param {Object} options - { scale, offsetX, offsetY, shapeRendering }
   */
  function pixelsToSVG(pixels, palette, options = {}) {
    const scale = options.scale || 1;
    const ox = options.offsetX || 0;
    const oy = options.offsetY || 0;
    const shape = options.shapeRendering || 'crispEdges';

    // 색상별 묶음 (그룹핑)
    const colorGroups = {};
    for (let i = 0; i < pixels.length; i++) {
      const [x, y, pIdx] = pixels[i];
      const color = palette[pIdx] || '#000000';
      if (!colorGroups[color]) colorGroups[color] = '';
      colorGroups[color] += `<rect x="${x}" y="${y}" width="1" height="1"/>`;
    }

    let inner = '';
    for (const [col, rects] of Object.entries(colorGroups)) {
      inner += `<g fill="${col}">${rects}</g>`;
    }

    return `<g class="avatar-pixels" transform="translate(${ox}, ${oy}) scale(${scale})" shape-rendering="${shape}">${inner}</g>`;
  }

  /**
   * 스팬 압축 데이터로부터 SVG 생성
   * @param {Object} spans - { '#color': [[x, y, w], ...] }
   * @param {Object} options - { scale, offsetX, offsetY, shapeRendering }
   */
  function spansToSVG(spans, options = {}) {
    const scale = options.scale || 1;
    const ox = options.offsetX || 0;
    const oy = options.offsetY || 0;
    const shape = options.shapeRendering || 'crispEdges';

    let inner = '';
    for (const [col, rectList] of Object.entries(spans || {})) {
      let rects = '';
      for (let i = 0; i < rectList.length; i++) {
        const [x, y, w] = rectList[i];
        rects += `<rect x="${x}" y="${y}" width="${w}" height="1"/>`;
      }
      inner += `<g fill="${col}">${rects}</g>`;
    }

    return `<g class="avatar-spans" transform="translate(${ox}, ${oy}) scale(${scale})" shape-rendering="${shape}">${inner}</g>`;
  }

  /**
   * HTML5 Canvas에 픽셀 배열 직접 드로잉 (최고속 렌더링)
   * @param {HTMLCanvasElement} canvas
   * @param {Array<[number, number, number]>} pixels
   * @param {Array<string>} palette
   * @param {Object} options - { pixelSize, offsetX, offsetY, clear }
   */
  function renderToCanvas(canvas, pixels, palette, options = {}) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const pSize = options.pixelSize || 1;
    const ox = options.offsetX || 0;
    const oy = options.offsetY || 0;

    if (options.clear !== false) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    ctx.imageSmoothingEnabled = false;

    // 파스텔/색상별 배치
    for (let i = 0; i < pixels.length; i++) {
      const [x, y, pIdx] = pixels[i];
      ctx.fillStyle = palette[pIdx] || '#000000';
      ctx.fillRect((x + ox) * pSize, (y + oy) * pSize, pSize, pSize);
    }
  }

  return {
    loadJSON: loadJSON,
    pixelsToSVG: pixelsToSVG,
    spansToSVG: spansToSVG,
    renderToCanvas: renderToCanvas
  };
});
