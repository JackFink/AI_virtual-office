# 👾 NEXUS AI Virtual Office - 픽셀 아바타 시스템 (Avatar System)

이 폴더(`avatar/`)는 메이플스토리 시뮬레이터(maples.im) 및 레트로 게임 표준을 따르는 **43×68 해상도 정밀 픽셀 치비 아바타 엔진 및 데이터셋**을 독립적으로 관리하는 공식 디렉토리입니다.

---

## 📁 디렉토리 구조

```
avatar/
├── data/                                 # 픽셀 좌표 JSON 데이터셋
│   ├── agent-chibi-base.json             # 43×68 치비 베이스 캐릭터 JSON (1,586 픽셀, 24색 팔레트)
│   ├── pixel-chibi-parts.json            # 37종 파츠 전체 통합 마스터 JSON
│   └── parts/                            # 부위별 개별 파츠 JSON (37개 파일)
│       ├── hair/                         # H00 ~ H08 (9개)
│       ├── face/                         # F00 ~ F06 (7개)
│       ├── outfit/                       # O00 ~ O07 (8개)
│       ├── bottom/                       # B00 ~ B04 (5개)
│       └── acc/                          # A00 ~ A07 (8개)
│
├── scripts/                              # 아바타 구동 및 렌더러 모듈
│   ├── avatar-loader.js                  # JSON 기반 동적 비동기 로더 (Canvas & SVG)
│   ├── pixel-chibi-base.js               # 43×68 치비 베이스 스프라이트 렌더러
│   ├── pixel-chibi-parts.js              # 43×68 정밀 픽셀 파츠 렌더러
│   ├── default-character.js              # 시뮬레이터 기본 프리셋 & SVG 엔진
│   ├── pixel-base-character.js           # 3D 가상 오피스 Canvas 렌더러
│   └── pixel-character.js                # 레거시 픽셀 캐릭터 엔진
│
└── README.md                             # 본 문서
```

---

## 📐 파츠 JSON 스펙 표준 (Specification)

모든 파츠는 단일 픽셀 좌표 `[x, y, paletteIndex]` 배열 및 최적화된 수평 스팬 `spans`를 동시에 포함합니다:

```json
{
  "meta": {
    "name": "hair_h01_bob",
    "category": "hair",
    "id": "H01",
    "title": "단발 보브컷",
    "width": 43,
    "height": 68,
    "totalPixels": 615
  },
  "palette": [
    "#18181b",
    "#8b7666",
    "#4a3525",
    "#271202"
  ],
  "spans": {
    "#18181b": [
      [16, 1, 11],
      [13, 2, 3]
    ]
  },
  "pixels": [
    [16, 1, 0],
    [17, 1, 0],
    ...
  ]
}
```

- **좌표계**: 43×68 정수 격자 좌표계 (베이스 바디와 1:1 완벽 정렬)
- **palette**: 파츠에 사용된 HEX 색상 목록
- **pixels**: `[x, y, paletteIndex]` 포맷의 픽셀 점 단위 리스트 (Canvas 고속 배치 및 커스텀 에디터용)
- **spans**: `[x, y, width]` 포맷의 수평 연속 픽셀 압축 리스트 (SVG 초고속 crispEdges 렌더링용)

---

## 🚀 사용 예시

### 1. 웹 브라우저에서 스크립트 임포트
```html
<script src="avatar/scripts/pixel-chibi-base.js"></script>
<script src="avatar/scripts/pixel-chibi-parts.js"></script>
<script src="avatar/scripts/avatar-loader.js"></script>
```

### 2. JSON 비동기 로드 및 렌더링
```javascript
// 개별 파츠 로드
const hairData = await AvatarLoader.loadJSON('avatar/data/parts/hair/H01.json');

// SVG로 출력
const svgGroup = AvatarLoader.pixelsToSVG(hairData.pixels, hairData.palette);

// Canvas에 고속 렌더링
AvatarLoader.renderToCanvas(myCanvas, hairData.pixels, hairData.palette, { pixelSize: 4 });
```
