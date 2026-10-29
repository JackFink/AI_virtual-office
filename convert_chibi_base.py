import json
from collections import defaultdict

with open('agent-chibi-base.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

pixels = sorted(data['frames']['idle_0']['pixels'], key=lambda p: (p[2], p[1], p[0]))
palette = data['palette']

spans = defaultdict(list)
cur = None
for x, y, p in pixels:
    if cur and cur[2] == p and cur[1] == y and cur[0] + cur[3] == x:
        cur[3] += 1
    else:
        if cur:
            spans[palette[cur[2]]].append((cur[0], cur[1], cur[3]))
        cur = [x, y, p, 1]
if cur:
    spans[palette[cur[2]]].append((cur[0], cur[1], cur[3]))

total_spans = sum(len(v) for v in spans.values())
print(f'Original pixels: {len(data["frames"]["idle_0"]["pixels"])}, Merged spans: {total_spans}')

# Generate JavaScript module
js_content = """/**
 * agent_chibi_base - 정밀 43x68 픽셀 스프라이트 베이스 캐릭터 모듈
 * NEXUS 모듈형 AI 캐릭터 스튜디오 공식 규격
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.AgentChibiBase = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const SPRITE_DATA = """ + json.dumps(data, ensure_ascii=False) + """;

  // 가로 연속 픽셀 압축 스팬 데이터
  const SPANS = """ + json.dumps(dict(spans), ensure_ascii=False) + """;

  /**
   * 64x78 메이플 스튜디오 뷰포트 규격에 맞춘 픽셀 베이스 SVG 렌더링
   * @param {string} skinColor - 선택된 피부톤 (기본값 없을 시 원본 24색 팔레트 유지)
   * @param {Object} options - { offsetX, offsetY, scale, className }
   */
  function renderSVG(skinColor, options = {}) {
    const ox = options.offsetX !== undefined ? options.offsetX : 10.5;
    const oy = options.offsetY !== undefined ? options.offsetY : 4.5;
    const scale = options.scale || 1;

    let paths = '';
    for (const [color, spanList] of Object.entries(SPANS)) {
      // 픽셀 사각형 생성 (crisp-edges)
      let rects = '';
      for (let i = 0; i < spanList.length; i++) {
        const [x, y, w] = spanList[i];
        rects += `<rect x="${x}" y="${y}" width="${w}" height="1"/>`;
      }
      paths += `<g fill="${color}">${rects}</g>`;
    }

    return `
      <g class="layer-base-pixel" transform="translate(${ox}, ${oy}) scale(${scale})" shape-rendering="crispEdges">
        ${paths}
      </g>
    `.trim();
  }

  return {
    data: SPRITE_DATA,
    spans: SPANS,
    render: renderSVG,
    toSVG: renderSVG
  };
});
"""

with open('pixel-chibi-base.js', 'w', encoding='utf-8') as f:
    f.write(js_content)

print('Generated pixel-chibi-base.js successfully!')
