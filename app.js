(() => {
  const page = document.body.dataset.page;

  // ==========================================================================
  // [1] maples.im 스타일 모듈형 캐릭터 엔진 (Base Body + 5개 레이어 + 스탠스)
  // ==========================================================================
  const CharacterEngine = {
    parts: {
      // 1-1. 베이스 신체 레이어 (2등신 메이플 치비 바디 & 볼터치 & 이너웨어)
      base: {
        BASE_PIXEL: (skin) => {
          if (typeof window !== 'undefined' && window.AgentChibiBase && typeof window.AgentChibiBase.render === 'function') {
            return window.AgentChibiBase.render(skin, { offsetX: 10.5, offsetY: 4.5 });
          }
          return '';
        },
        BASE_M: (skin) => `
          <g class="layer-base-male">
            <!-- 목 & 두상 (둥글고 귀여운 치비 두상) -->
            <path d="M15 22 C13 9 51 9 49 22 C50 32 45 37 32 37 C19 37 14 32 15 22 Z" fill="${skin}"/>
            <rect x="29.5" y="34.5" width="5" height="4" rx="1.5" fill="${skin}"/>
            <!-- 귀 & 핑크 볼터치 (홍조) -->
            <circle cx="13.5" cy="23" r="2.8" fill="${skin}"/>
            <circle cx="50.5" cy="23" r="2.8" fill="${skin}"/>
            <ellipse cx="19" cy="28" rx="3.5" ry="2" fill="#ff7f7f" opacity="0.45"/>
            <ellipse cx="45" cy="28" rx="3.5" ry="2" fill="#ff7f7f" opacity="0.45"/>
            <!-- 앙증맞은 상체 (Torso) & 기본 이너웨어 -->
            <rect x="20" y="37" width="24" height="15" rx="4" fill="${skin}"/>
            <rect x="22" y="38" width="20" height="9" rx="3" fill="#3b4252" opacity="0.6"/>
            <!-- 기본 이너웨어 하의 -->
            <rect x="21" y="49" width="22" height="6" rx="2" fill="#2e3440"/>
            <!-- 통통한 양팔 & 손 -->
            <rect x="14" y="38" width="6.5" height="12" rx="3" fill="${skin}"/>
            <circle cx="17.2" cy="49" r="3" fill="${skin}"/>
            <rect x="43.5" y="38" width="6.5" height="12" rx="3" fill="${skin}"/>
            <circle cx="46.8" cy="49" r="3" fill="${skin}"/>
            <!-- 귀여운 숏다리 & 기본 신발 -->
            <rect x="22" y="52" width="8" height="14" rx="2.5" fill="${skin}"/>
            <rect x="34" y="52" width="8" height="14" rx="2.5" fill="${skin}"/>
            <rect x="20" y="64" width="10.5" height="6" rx="3" fill="#1e293b"/>
            <rect x="33.5" y="64" width="10.5" height="6" rx="3" fill="#1e293b"/>
            <rect x="20.5" y="68" width="9.5" height="2" rx="1" fill="#475569"/>
            <rect x="34" y="68" width="9.5" height="2" rx="1" fill="#475569"/>
          </g>
        `,
        BASE_F: (skin) => `
          <g class="layer-base-female">
            <!-- 목 & 두상 (슬림하고 부드러운 치비 두상) -->
            <path d="M15.5 22 C13.5 9.5 50.5 9.5 48.5 22 C49.5 31.5 44.5 36.5 32 36.5 C19.5 36.5 14.5 31.5 15.5 22 Z" fill="${skin}"/>
            <rect x="29.5" y="34.5" width="5" height="4" rx="1.5" fill="${skin}"/>
            <!-- 귀 & 선명한 로지 핑크 볼터치 -->
            <circle cx="14" cy="23" r="2.6" fill="${skin}"/>
            <circle cx="50" cy="23" r="2.6" fill="${skin}"/>
            <ellipse cx="19" cy="28" rx="3.5" ry="2" fill="#ff6b81" opacity="0.55"/>
            <ellipse cx="45" cy="28" rx="3.5" ry="2" fill="#ff6b81" opacity="0.55"/>
            <!-- 슬림 치비 상체 & 기본 이너웨어 -->
            <path d="M21 37 Q32 39 43 37 L41.5 51.5 Q32 53 22.5 51.5 Z" fill="${skin}"/>
            <rect x="23" y="38" width="18" height="9" rx="3" fill="#4c566a" opacity="0.6"/>
            <!-- 기본 이너웨어 하의 -->
            <rect x="22" y="49" width="20" height="6" rx="2" fill="#334155"/>
            <!-- 슬림 양팔 & 손 -->
            <rect x="14.5" y="38" width="6" height="12" rx="3" fill="${skin}"/>
            <circle cx="17.5" cy="49" r="2.8" fill="${skin}"/>
            <rect x="43.5" y="38" width="6" height="12" rx="3" fill="${skin}"/>
            <circle cx="46.5" cy="49" r="2.8" fill="${skin}"/>
            <!-- 슬림 다리 & 기본 슈즈 -->
            <rect x="22.5" y="52" width="7.5" height="14" rx="2.5" fill="${skin}"/>
            <rect x="34" y="52" width="7.5" height="14" rx="2.5" fill="${skin}"/>
            <rect x="21" y="64" width="9.5" height="6" rx="3" fill="#1e293b"/>
            <rect x="33.5" y="64" width="9.5" height="6" rx="3" fill="#1e293b"/>
            <rect x="21.5" y="68" width="8.5" height="2" rx="1" fill="#475569"/>
            <rect x="34" y="68" width="8.5" height="2" rx="1" fill="#475569"/>
          </g>
        `
      },

      // 1-2. 하의 레이어 (치비 핏 슬랙스, 데님, 플리츠 스커트, 치노 + 슈즈)
      bottom: {
        B00: () => '', // 없음 (베이스 이너웨어 노출)
        B01: () => `
          <!-- [B01] 핏 슬랙스 & 광택 더비 슈즈 -->
          <rect x="20.5" y="48.5" width="23" height="5" rx="2" fill="#1e293b"/>
          <rect x="21" y="51" width="9.5" height="14" rx="2" fill="#2c3a4b"/>
          <rect x="33.5" y="51" width="9.5" height="14" rx="2" fill="#2c3a4b"/>
          <rect x="19.5" y="63" width="11.5" height="7" rx="3" fill="#0f172a"/>
          <rect x="33" y="63" width="11.5" height="7" rx="3" fill="#0f172a"/>
          <rect x="20" y="67.5" width="10.5" height="2" rx="1" fill="#475569"/>
          <rect x="33.5" y="67.5" width="10.5" height="2" rx="1" fill="#475569"/>
        `,
        B02: () => `
          <!-- [B02] 롤업 인디고 진 & 화이트 스니커즈 -->
          <rect x="20.5" y="48.5" width="23" height="5" rx="2" fill="#27466b"/>
          <rect x="21" y="51" width="9.5" height="12" rx="2" fill="#3b597b"/>
          <rect x="33.5" y="51" width="9.5" height="12" rx="2" fill="#3b597b"/>
          <rect x="21" y="60.5" width="9.5" height="2.5" rx="1" fill="#cbd5e1"/>
          <rect x="33.5" y="60.5" width="9.5" height="2.5" rx="1" fill="#cbd5e1"/>
          <rect x="19.5" y="63" width="11.5" height="7" rx="3" fill="#f8fafc" stroke="#cbd5e1" stroke-width="0.8"/>
          <rect x="33" y="63" width="11.5" height="7" rx="3" fill="#f8fafc" stroke="#cbd5e1" stroke-width="0.8"/>
          <rect x="19.5" y="67.5" width="11.5" height="2.2" rx="1" fill="#ef4444"/>
          <rect x="33" y="67.5" width="11.5" height="2.2" rx="1" fill="#ef4444"/>
        `,
        B03: () => `
          <!-- [B03] 플리츠 오피스 미니스커트 & 메리제인 슈즈 -->
          <path d="M19 48.5 H45 L48 60 H16 Z" fill="#334155"/>
          <line x1="25" y1="49" x2="24" y2="60" stroke="#1e293b" stroke-width="1.2"/>
          <line x1="32" y1="49" x2="32" y2="60" stroke="#1e293b" stroke-width="1.2"/>
          <line x1="39" y1="49" x2="40" y2="60" stroke="#1e293b" stroke-width="1.2"/>
          <rect x="20.5" y="63" width="10.5" height="7" rx="3" fill="#0f172a"/>
          <rect x="33" y="63" width="10.5" height="7" rx="3" fill="#0f172a"/>
          <rect x="20.5" y="63.5" width="10.5" height="1.8" fill="#e2e8f0"/>
          <rect x="33" y="63.5" width="10.5" height="1.8" fill="#e2e8f0"/>
        `,
        B04: () => `
          <!-- [B04] 베이지 치노 팬츠 & 브라운 로퍼 -->
          <rect x="20.5" y="48.5" width="23" height="5" rx="2" fill="#c7a783"/>
          <rect x="21" y="51" width="9.5" height="13" rx="2" fill="#d9be9e"/>
          <rect x="33.5" y="51" width="9.5" height="13" rx="2" fill="#d9be9e"/>
          <rect x="19.5" y="63.5" width="11" height="6.5" rx="2.5" fill="#582f0e"/>
          <rect x="33.5" y="63.5" width="11" height="6.5" rx="2.5" fill="#582f0e"/>
          <rect x="21.5" y="64" width="7" height="2" rx="1" fill="#7f4f24"/>
          <rect x="35.5" y="64" width="7" height="2" rx="1" fill="#7f4f24"/>
        `
      },

      // 1-3. 상의 레이어 (치비 수트, 후디, 셔츠, 랩코트, 티셔츠)
      outfit: {
        O00: () => '', // 없음 (베이스 이너웨어 노출)
        O01: () => `
          <!-- [O01] 치비 포멀 수트 & 레드 넥타이 -->
          <rect x="17.5" y="36.5" width="29" height="16" rx="4" fill="#1e293b"/>
          <rect x="13.5" y="37.5" width="6.5" height="10" rx="2.5" fill="#1e293b"/>
          <rect x="44" y="37.5" width="6.5" height="10" rx="2.5" fill="#1e293b"/>
          <polygon points="27.5,36.5 36.5,36.5 32,46" fill="#ffffff"/>
          <polygon points="31,38 33,38 33.5,46 32,48 30.5,46" fill="#dc2626"/>
          <rect x="20.5" y="42" width="4.5" height="1.2" rx="0.5" fill="#ffffff"/>
        `,
        O02: () => `
          <!-- [O02] 개발자 오버핏 후드 (캥거루 포켓 & 스트링) -->
          <rect x="16.5" y="36" width="31" height="18" rx="5" fill="#475569"/>
          <rect x="13" y="37" width="7" height="11" rx="3" fill="#475569"/>
          <rect x="44" y="37" width="7" height="11" rx="3" fill="#475569"/>
          <path d="M22 36.5 Q32 41 42 36.5" fill="none" stroke="#334155" stroke-width="2.5" stroke-linecap="round"/>
          <line x1="28" y1="39" x2="27" y2="44" stroke="#ffffff" stroke-width="1.2" stroke-linecap="round"/>
          <line x1="36" y1="39" x2="37" y2="44" stroke="#ffffff" stroke-width="1.2" stroke-linecap="round"/>
          <rect x="22" y="44" width="20" height="7.5" rx="2" fill="#334155"/>
        `,
        O03: () => `
          <!-- [O03] 스마트 셔츠 & 포근 니트 -->
          <rect x="17.5" y="36.5" width="29" height="16" rx="4" fill="#b48c66"/>
          <rect x="13.5" y="37.5" width="6.5" height="10" rx="2.5" fill="#b48c66"/>
          <rect x="44" y="37.5" width="6.5" height="10" rx="2.5" fill="#b48c66"/>
          <polygon points="26.5,36.5 37.5,36.5 32,43" fill="#ffffff"/>
          <line x1="32" y1="40" x2="32" y2="43" stroke="#94a3b8" stroke-width="1"/>
        `,
        O04: () => `
          <!-- [O04] R&D 연구실 랩가운 (화이트 코트 & 블루 이너) -->
          <rect x="16.5" y="36" width="31" height="19" rx="4" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1"/>
          <rect x="13" y="37" width="7" height="11" rx="3" fill="#f8fafc" stroke="#cbd5e1" stroke-width="0.8"/>
          <rect x="44" y="37" width="7" height="11" rx="3" fill="#f8fafc" stroke="#cbd5e1" stroke-width="0.8"/>
          <rect x="28.5" y="36" width="7" height="19" fill="#3b82f6"/>
          <rect x="20" y="42" width="5" height="5" rx="1" fill="none" stroke="#cbd5e1" stroke-width="0.8"/>
          <line x1="22" y1="40.5" x2="22" y2="43" stroke="#0ea5e9" stroke-width="1.2"/>
        `,
        O05: () => `
          <!-- [O05] 크리에이티브 에메랄드 워크웨어 -->
          <rect x="17" y="36.5" width="30" height="17" rx="4" fill="#2d6a59"/>
          <rect x="13.5" y="37.5" width="6.5" height="10" rx="2.5" fill="#2d6a59"/>
          <rect x="44" y="37.5" width="6.5" height="10" rx="2.5" fill="#2d6a59"/>
          <polygon points="25,36.5 39,36.5 32,42" fill="#1b4d3e"/>
          <circle cx="32" cy="45" r="1.2" fill="#f59e0b"/>
          <circle cx="32" cy="49" r="1.2" fill="#f59e0b"/>
        `,
        O06: () => `
          <!-- [O06] 글로벌 클래식 트렌치코트 -->
          <rect x="16.5" y="36" width="31" height="20" rx="4" fill="#8d6e49"/>
          <rect x="13" y="37" width="7" height="11" rx="3" fill="#8d6e49"/>
          <rect x="44" y="37" width="7" height="11" rx="3" fill="#8d6e49"/>
          <rect x="27.5" y="36" width="9" height="20" fill="#1e293b"/>
          <rect x="16.5" y="47" width="31" height="3" fill="#715535"/>
          <rect x="30" y="46.5" width="4" height="4" rx="1" fill="#f59e0b"/>
        `,
        O07: () => `
          <!-- [O07] 캐주얼 로고 반팔티 -->
          <rect x="18" y="36.5" width="28" height="15" rx="3" fill="#f8fafc" stroke="#cbd5e1" stroke-width="0.8"/>
          <rect x="14" y="37" width="6" height="7" rx="2" fill="#f8fafc" stroke="#cbd5e1" stroke-width="0.8"/>
          <rect x="44" y="37" width="6" height="7" rx="2" fill="#f8fafc" stroke="#cbd5e1" stroke-width="0.8"/>
          <!-- 가슴 NEXUS 로고 -->
          <rect x="28" y="41" width="8" height="5" rx="1.5" fill="#ea580c"/>
          <line x1="30" y1="43.5" x2="34" y2="43.5" stroke="#ffffff" stroke-width="0.8"/>
        `
      },

      // 1-4. 표정 레이어 (메이플 대표 성형 + 동공 렌즈 색상 지원)
      face: {
        F00: () => '', // 투명 (스프라이트 자체 표정 노출)
        F01: (eyeColor = '#1e293b') => `
          <!-- [F01] 아잉 / 방긋 미소 -->
          <path d="M19.5 21.5 Q24 16 28.5 21.5" fill="none" stroke="${eyeColor}" stroke-width="2.5" stroke-linecap="round"/>
          <path d="M35.5 21.5 Q40 16 44.5 21.5" fill="none" stroke="${eyeColor}" stroke-width="2.5" stroke-linecap="round"/>
          <path d="M29 27 Q32 31.5 35 27" fill="#f43f5e" stroke="${eyeColor}" stroke-width="1.2" stroke-linecap="round"/>
        `,
        F02: (eyeColor = '#1e293b') => `
          <!-- [F02] 조용한 눈 (Chic Eyes & 듀얼 하이라이트) -->
          <path d="M18.5 20 Q24 18 29 21.5" fill="none" stroke="#0f172a" stroke-width="2.4" stroke-linecap="round"/>
          <rect x="21" y="20.5" width="7" height="6.5" rx="2.5" fill="${eyeColor}"/>
          <circle cx="23" cy="22" r="1.5" fill="#ffffff"/>
          <circle cx="26" cy="24.5" r="0.9" fill="#93c5fd"/>
          
          <path d="M35 21.5 Q40 18 45.5 20" fill="none" stroke="#0f172a" stroke-width="2.4" stroke-linecap="round"/>
          <rect x="36" y="20.5" width="7" height="6.5" rx="2.5" fill="${eyeColor}"/>
          <circle cx="38" cy="22" r="1.5" fill="#ffffff"/>
          <circle cx="41" cy="24.5" r="0.9" fill="#93c5fd"/>
          <line x1="30" y1="29.5" x2="34" y2="29.5" stroke="#475569" stroke-width="1.4" stroke-linecap="round"/>
        `,
        F03: (eyeColor = '#1e293b') => `
          <!-- [F03] 당당한 윙크 -->
          <path d="M19 20 Q24 18.5 28.5 21" fill="none" stroke="#0f172a" stroke-width="2.2" stroke-linecap="round"/>
          <rect x="21" y="21" width="6.5" height="6" rx="2" fill="${eyeColor}"/>
          <circle cx="23" cy="22.5" r="1.4" fill="#ffffff"/>
          <circle cx="25.5" cy="24.5" r="0.8" fill="#fde047"/>
          
          <path d="M36 21.5 Q40 25.5 44.5 21.5" fill="none" stroke="#0f172a" stroke-width="2.4" stroke-linecap="round"/>
          <path d="M29 28.5 Q32 30.5 35.5 27.5" fill="none" stroke="#1f2937" stroke-width="1.5" stroke-linecap="round"/>
        `,
        F04: (eyeColor = '#1e293b') => `
          <!-- [F04] 멍한 인형 눈 -->
          <ellipse cx="24" cy="22.5" rx="4.2" ry="4.8" fill="${eyeColor}"/>
          <circle cx="22.5" cy="21" r="1.6" fill="#ffffff"/>
          <circle cx="25.5" cy="23.5" r="1" fill="#67e8f9"/>
          
          <ellipse cx="40" cy="22.5" rx="4.2" ry="4.8" fill="${eyeColor}"/>
          <circle cx="38.5" cy="21" r="1.6" fill="#ffffff"/>
          <circle cx="41.5" cy="23.5" r="1" fill="#67e8f9"/>
          <ellipse cx="32" cy="29" rx="1.6" ry="1.8" fill="#f43f5e"/>
        `,
        F05: (eyeColor = '#1e293b') => `
          <!-- [F05] 초롱초롱 호기심 눈 -->
          <ellipse cx="23.5" cy="22" rx="4.8" ry="5.2" fill="${eyeColor}"/>
          <polygon points="23.5,19 24.5,21 26.5,21 25,22.5 25.5,24.5 23.5,23 21.5,24.5 22,22.5 20.5,21 22.5,21" fill="#ffffff"/>
          <circle cx="25.5" cy="24.5" r="1.2" fill="#ffffff"/>
          
          <ellipse cx="40.5" cy="22" rx="4.8" ry="5.2" fill="${eyeColor}"/>
          <polygon points="40.5,19 41.5,21 43.5,21 42,22.5 42.5,24.5 40.5,23 38.5,24.5 39,22.5 37.5,21 39.5,21" fill="#ffffff"/>
          <circle cx="42.5" cy="24.5" r="1.2" fill="#ffffff"/>
          <path d="M29.5 28 Q32 31 34.5 28" fill="none" stroke="#f43f5e" stroke-width="1.5" stroke-linecap="round"/>
        `,
        F06: (eyeColor = '#1e293b') => `
          <!-- [F06] 샤프 분석 눈빛 -->
          <path d="M18 19.5 L28.5 21" stroke="#0f172a" stroke-width="2.6" stroke-linecap="round"/>
          <rect x="21" y="21" width="6.5" height="5" rx="1.8" fill="${eyeColor}"/>
          <circle cx="23" cy="22.5" r="1.3" fill="#ffffff"/>
          
          <path d="M46 19.5 L35.5 21" stroke="#0f172a" stroke-width="2.6" stroke-linecap="round"/>
          <rect x="36.5" y="21" width="6.5" height="5" rx="1.8" fill="${eyeColor}"/>
          <circle cx="38.5" cy="22.5" r="1.3" fill="#ffffff"/>
          <line x1="30" y1="28.5" x2="34" y2="28.5" stroke="#334155" stroke-width="1.3" stroke-linecap="round"/>
        `,
        F07: (eyeColor = '#1e293b') => {
          if (typeof window !== 'undefined' && window.PixelChibiParts) {
            return `<g transform="translate(10.5, 4.5)">` + window.PixelChibiParts.render('face', 'F07', eyeColor) + `</g>`;
          }
          return `
            <path d="M19 20 Q24 19 28 21" stroke="#0f172a" stroke-width="2.5" stroke-linecap="round"/>
            <rect x="21" y="21" width="6.5" height="5.5" rx="2" fill="${eyeColor}"/>
            <circle cx="23" cy="22" r="1.3" fill="#ffffff"/>
            <path d="M36 21 Q40 19 45 20" stroke="#0f172a" stroke-width="2.5" stroke-linecap="round"/>
            <rect x="36.5" y="21" width="6.5" height="5.5" rx="2" fill="${eyeColor}"/>
            <circle cx="38.5" cy="22" r="1.3" fill="#ffffff"/>
            <line x1="30" y1="28.5" x2="34" y2="28.5" stroke="#a34c44" stroke-width="1.6" stroke-linecap="round"/>
          `;
        },
        F08: (eyeColor = '#1e293b') => {
          if (typeof window !== 'undefined' && window.PixelChibiParts) {
            return `<g transform="translate(10.5, 4.5)">` + window.PixelChibiParts.render('face', 'F08', eyeColor) + `</g>`;
          }
          return '';
        },
        F09: (eyeColor = '#1e293b') => {
          if (typeof window !== 'undefined' && window.PixelChibiParts) {
            return `<g transform="translate(10.5, 4.5)">` + window.PixelChibiParts.render('face', 'F09', eyeColor) + `</g>`;
          }
          return '';
        }
      },

      // 1-5. 헤어 레이어 (메이플 로얄 헤어 스타일)
      hair: {
        H00: () => '', // 스킨헤드 (베이스 두상 노출)
        H01: (c) => `
          <!-- [H01] 단발 보브컷 -->
          <path d="M13 22 C13 7 51 7 51 22 L51 32 C51 34 46.5 34 45.5 30 L45 22 C45 19 39 18 32 18 C25 18 19 19 19 22 L18.5 30 C17.5 34 13 34 13 32 Z" fill="${c}"/>
          <path d="M19 13 Q32 8.5 45 13" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="2.2" stroke-linecap="round"/>
          <path d="M22 18 L26 22 L30 18 L34 22 L38 18" stroke="rgba(0,0,0,0.25)" stroke-width="1.2" fill="none"/>
        `,
        H02: (c) => `
          <!-- [H02] 모던 댄디 숏컷 -->
          <path d="M14 20 C14 8 50 8 50 20 L50 27 L46 25 L45 18 C43 16 38 15 32 15 C26 15 21 16 19 18 L18 25 L14 27 Z" fill="${c}"/>
          <path d="M24 10 L28 7 L32 10 L36 7 L40 10" fill="${c}"/>
          <path d="M21 12 Q32 8 43 12" fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="2" stroke-linecap="round"/>
        `,
        H03: (c) => `
          <!-- [H03] 로맨틱 웨이브 롱 -->
          <path d="M12 22 C12 6 52 6 52 22 L53 43 C53 45 47 45 46 41 L45 22 C45 19 39 18 32 18 C25 18 19 19 19 22 L18 41 C17 45 11 45 11 43 Z" fill="${c}"/>
          <path d="M19 13 Q32 8.5 45 13" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="2.2" stroke-linecap="round"/>
          <circle cx="16" cy="38" r="3" fill="${c}"/>
          <circle cx="48" cy="38" r="3" fill="${c}"/>
        `,
        H04: (c) => `
          <!-- [H04] 클래식 가르마 포마드 -->
          <path d="M14 20 C14 8 50 8 50 20 L49 25 L44 24 L44 17 C41 15 36 15 34 16 L31 19 L28 16 C25 15 22 15 20 17 L20 24 L15 25 Z" fill="${c}"/>
          <path d="M22 11 Q28 6 34 9" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="2" stroke-linecap="round"/>
          <path d="M35 11 Q41 7 46 11" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="2" stroke-linecap="round"/>
        `,
        H05: (c) => `
          <!-- [H05] 큐티 하이 포니테일 -->
          <path d="M14 21 C14 8 50 8 50 21 L50 29 L46 27 L45 20 C45 18 39 17 32 17 C25 17 19 18 19 20 L18 27 L14 29 Z" fill="${c}"/>
          <circle cx="46" cy="9.5" r="3.2" fill="#ec4899"/>
          <path d="M46 9.5 Q55 8 54 21 Q51 22 47 12 Z" fill="${c}"/>
          <path d="M20 13 Q32 8 44 13" fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="2" stroke-linecap="round"/>
        `,
        H06: (c) => `
          <!-- [H06] 복슬복슬 플러피 펌 -->
          <path d="M13 21 C13 7 51 7 51 21 L50 28 L46 25 L45 18 C45 17 39 16 32 16 C25 16 19 17 19 18 L18 25 L14 28 Z" fill="${c || '#94a3b8'}"/>
          <circle cx="20" cy="10" r="4.5" fill="${c || '#94a3b8'}"/>
          <circle cx="28" cy="7.5" r="5" fill="${c || '#94a3b8'}"/>
          <circle cx="36" cy="7.5" r="5" fill="${c || '#94a3b8'}"/>
          <circle cx="44" cy="10" r="4.5" fill="${c || '#94a3b8'}"/>
        `,
        H07: (c) => `
          <!-- [H07] 샤기 울프컷 -->
          <path d="M13 20 C13 7 51 7 51 20 L52 28 L48 26 L47 18 C44 16 38 15 32 15 C26 15 20 16 17 18 L16 26 L12 28 Z" fill="${c}"/>
          <polygon points="12,28 15,35 18,30" fill="${c}"/>
          <polygon points="46,30 49,35 52,28" fill="${c}"/>
          <polygon points="26,8 29,4 32,8 35,4 38,8" fill="${c}"/>
        `,
        H08: (c) => `
          <!-- [H08] 시니어 그레이 / 점잖은 가르마 -->
          <path d="M14 20 C14 8 50 8 50 20 L48 26 L45 18 C42 16 37 15 32 15 C27 15 22 16 19 18 L16 26 Z" fill="${c || '#cbd5e1'}"/>
          <circle cx="16" cy="22" r="3" fill="${c || '#cbd5e1'}"/>
          <circle cx="48" cy="22" r="3" fill="${c || '#cbd5e1'}"/>
        `
      },

      // 1-6. 액세서리 레이어 (동글이 안경, 헤드셋, 사원증, 랩탑, 서류가방, 텀블러, 펜)
      acc: {
        A00: () => '',
        A01: () => `
          <!-- [A01] 동글이 오피스 안경 -->
          <circle cx="24" cy="22.5" r="5.2" fill="none" stroke="#1e293b" stroke-width="1.6"/>
          <circle cx="40" cy="22.5" r="5.2" fill="none" stroke="#1e293b" stroke-width="1.6"/>
          <line x1="29.2" y1="22.5" x2="34.8" y2="22.5" stroke="#1e293b" stroke-width="1.6"/>
          <line x1="22" y1="20" x2="25" y2="20" stroke="#ffffff" stroke-width="1.2" stroke-linecap="round"/>
          <line x1="38" y1="20" x2="41" y2="20" stroke="#ffffff" stroke-width="1.2" stroke-linecap="round"/>
        `,
        A02: () => `
          <!-- [A02] 무선 CS 헤드셋 -->
          <path d="M12 21 C12 6 52 6 52 21" fill="none" stroke="#1e293b" stroke-width="2.6"/>
          <rect x="10" y="19" width="4.5" height="9" rx="2" fill="#10b981"/>
          <rect x="49.5" y="19" width="4.5" height="9" rx="2" fill="#10b981"/>
          <path d="M12 26 Q19 32 27 30" fill="none" stroke="#1e293b" stroke-width="1.5" stroke-linecap="round"/>
          <circle cx="28" cy="29.5" r="1.5" fill="#10b981"/>
        `,
        A03: () => `
          <!-- [A03] 사원증 목걸이 & 스마트폰 -->
          <path d="M28 36 L31.5 42 L35 36" fill="none" stroke="#10b981" stroke-width="1.4"/>
          <rect x="29.5" y="42" width="5" height="7" rx="1" fill="#ffffff" stroke="#cbd5e1" stroke-width="0.8"/>
          <rect x="29.5" y="42" width="5" height="2" rx="0.5" fill="#3b82f6"/>
          <rect x="42" y="42" width="9" height="13" rx="1.5" fill="#1e293b" stroke="#94a3b8" stroke-width="1"/>
          <rect x="43" y="43" width="7" height="10" rx="1" fill="#38bdf8"/>
        `,
        A04: () => `
          <!-- [A04] 슬림 랩탑 노트북 -->
          <rect x="40" y="42" width="13" height="10" rx="1.5" fill="#94a3b8" stroke="#334155" stroke-width="1"/>
          <circle cx="46.5" cy="47" r="1.4" fill="#ffffff"/>
        `,
        A05: () => `
          <!-- [A05] 클래식 브라운 서류 가방 -->
          <rect x="43" y="52" width="13" height="11" rx="1.5" fill="#78350f" stroke="#451a03" stroke-width="1"/>
          <rect x="48" y="55" width="3" height="2" rx="0.5" fill="#f59e0b"/>
          <path d="M47 52 V49 H52 V52" fill="none" stroke="#451a03" stroke-width="1.4"/>
        `,
        A06: () => `
          <!-- [A06] 모닝 커피 텀블러 -->
          <path d="M44 45 L45 56 H50 L51 45 Z" fill="#ffffff" stroke="#cbd5e1" stroke-width="0.8"/>
          <rect x="44" y="48" width="7" height="4" fill="#2d6a59"/>
          <rect x="43.5" y="43.5" width="8" height="2" rx="1" fill="#1e293b"/>
        `,
        A07: () => `
          <!-- [A07] 스타일러스 펜 & 태블릿 -->
          <rect x="41" y="43" width="11" height="13" rx="1.5" fill="#1e293b" stroke="#64748b" stroke-width="0.8"/>
          <rect x="42.5" y="44.5" width="8" height="10" rx="1" fill="#0ea5e9"/>
          <line x1="39" y1="42" x2="43" y2="47" stroke="#ffffff" stroke-width="1.2" stroke-linecap="round"/>
        `
      }
    },

    // 레이어 순서대로 SVG 합성 렌더링 (maples.im 스타일 스탠스, 뒷모습 view='back', 레이어 숨김 지원)
    render(agent, options = {}) {
      const { hiddenLayers = {}, view = 'front' } = options;
      const { skin = '#f8cfbe', hairColor = '#2d2926', eyeColor = '#1e293b', parts = {} } = agent;

      // [0] 뒷모습(Back View) 렌더링: 마주보는 앞줄 좌석 착석 시 후면 헤어 + 후면 의상 표시
      if (view === 'back') {
        const pParts = typeof window !== 'undefined' ? window.PixelChibiParts : null;
        const pBase = !hiddenLayers.base && window.AgentChibiBase ? window.AgentChibiBase.render(skin, { raw: true }) : '';
        const pBottom = (!hiddenLayers.bottom && pParts) ? pParts.render('bottom', parts.bottom) : '';
        const pOutfit = (!hiddenLayers.outfit && pParts) ? pParts.render('outfit', parts.outfit) : '';
        const pHair = (!hiddenLayers.hair && pParts) ? pParts.render('hair', parts.hair, hairColor) : '';

        return `
          <svg viewBox="0 0 64 78" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" class="pixel-chibi-svg is-back-view">
            <ellipse cx="32" cy="73" rx="16" ry="3" fill="rgba(24,37,54,0.14)"/>
            <g class="layer-pixel-chibi-composite" transform="translate(10.5, 4.5)" shape-rendering="crispEdges">
              ${pBase}
              ${pBottom}
              ${pOutfit}
              <!-- 등판 칼라 & 재킷 뒷면 솔기 디테일 (앞면 넥타이/셔츠 가림) -->
              <rect x="13" y="37" width="17" height="3" fill="#1e293b"/>
              <rect x="14" y="40" width="15" height="12" fill="${hairColor === '#1e1e24' ? '#27384e' : '#334155'}"/>
              <rect x="21" y="40" width="1" height="12" fill="rgba(0,0,0,0.28)"/>
              ${pHair}
              <!-- 뒤통수 전체를 덮는 풍성한 픽셀 후면 헤어 캡 (얼굴/눈 완전 가림) -->
              <rect x="7" y="6" width="29" height="23" fill="${hairColor}"/>
              <rect x="5" y="10" width="33" height="18" fill="${hairColor}"/>
              <rect x="8" y="28" width="27" height="5" fill="${hairColor}"/>
              <rect x="9" y="8" width="25" height="3" fill="rgba(255,255,255,0.16)"/>
              <rect x="7" y="26" width="29" height="4" fill="rgba(0,0,0,0.22)"/>
            </g>
          </svg>
        `.trim();
      }

      // [1] 정밀 픽셀 치비 바디(BASE_PIXEL): 43x68 정밀 픽셀 파츠 시스템(PixelChibiParts)으로 100% 도트 아트 합성
      if (parts.base === 'BASE_PIXEL' && typeof window !== 'undefined' && window.PixelChibiParts) {
        const pParts = window.PixelChibiParts;
        const pBase = !hiddenLayers.base && window.AgentChibiBase ? window.AgentChibiBase.render(skin, { raw: true }) : '';
        const pBottom = !hiddenLayers.bottom ? pParts.render('bottom', parts.bottom) : '';
        const pOutfit = !hiddenLayers.outfit ? pParts.render('outfit', parts.outfit) : '';
        const pFace = !hiddenLayers.face ? pParts.render('face', parts.face, eyeColor) : '';
        const pHair = !hiddenLayers.hair ? pParts.render('hair', parts.hair, hairColor) : '';
        const pAcc = !hiddenLayers.acc ? pParts.render('acc', parts.acc) : '';

        return `
          <svg viewBox="0 0 64 78" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" class="pixel-chibi-svg">
            <!-- 그림자 레이어 -->
            <ellipse cx="32" cy="73" rx="16" ry="3" fill="rgba(24,37,54,0.14)"/>
            
            <!-- 43x68 정밀 픽셀 파츠 합성 컨테이너 (crispEdges) -->
            <g class="layer-pixel-chibi-composite" transform="translate(10.5, 4.5)" shape-rendering="crispEdges">
              <!-- [Layer 1] 신체 베이스 -->
              ${pBase}
              <!-- [Layer 2] 하의 & 신발 -->
              ${pBottom}
              <!-- [Layer 3] 상의 & 의상 -->
              ${pOutfit}
              <!-- [Layer 4] 눈 & 표정 -->
              ${pFace}
              <!-- [Layer 5] 헤어 & 염색 -->
              ${pHair}
              <!-- [Layer 6] 소품 & 장식 -->
              ${pAcc}
            </g>
          </svg>
        `.trim();
      }

      // [2] 클래식 벡터 베이스(BASE_M, BASE_F) 렌더링
      const baseFn = this.parts.base[parts.base] || this.parts.base.BASE_M;
      const bottomFn = this.parts.bottom[parts.bottom] || (() => {
        if (typeof window !== 'undefined' && window.PixelChibiParts) {
          return `<g transform="translate(10.5, 4.5)">` + window.PixelChibiParts.render('bottom', parts.bottom) + `</g>`;
        }
        return '';
      });
      const outfitFn = this.parts.outfit[parts.outfit] || (() => {
        if (typeof window !== 'undefined' && window.PixelChibiParts) {
          return `<g transform="translate(10.5, 4.5)">` + window.PixelChibiParts.render('outfit', parts.outfit) + `</g>`;
        }
        return '';
      });
      const faceFn = this.parts.face[parts.face] || ((eyeColor) => {
        if (typeof window !== 'undefined' && window.PixelChibiParts) {
          return `<g transform="translate(10.5, 4.5)">` + window.PixelChibiParts.render('face', parts.face, eyeColor) + `</g>`;
        }
        return '';
      });
      const hairFn = this.parts.hair[parts.hair] || ((hairColor) => {
        if (typeof window !== 'undefined' && window.PixelChibiParts) {
          return `<g transform="translate(10.5, 4.5)">` + window.PixelChibiParts.render('hair', parts.hair, hairColor) + `</g>`;
        }
        return '';
      });
      const accFn = this.parts.acc[parts.acc] || (() => {
        if (typeof window !== 'undefined' && window.PixelChibiParts) {
          return `<g transform="translate(10.5, 4.5)">` + window.PixelChibiParts.render('acc', parts.acc) + `</g>`;
        }
        return '';
      });

      return `
        <svg viewBox="0 0 64 78" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <!-- 그림자 레이어 -->
          <ellipse cx="32" cy="73" rx="16" ry="3" fill="rgba(24,37,54,0.14)"/>
          
          <!-- [Layer 1] 기본 베이스 캐릭터 (신체 마네킹) -->
          ${!hiddenLayers.base ? baseFn(skin) : ''}
          
          <!-- [Layer 2] 하의 & 신발 -->
          ${!hiddenLayers.bottom ? bottomFn() : ''}
          
          <!-- [Layer 3] 상의 & 아우터 -->
          ${!hiddenLayers.outfit ? outfitFn() : ''}
          
          <!-- [Layer 4] 표정 & 렌즈 -->
          ${!hiddenLayers.face ? faceFn(eyeColor) : ''}
          
          <!-- [Layer 5] 헤어 & 염색 -->
          ${!hiddenLayers.hair ? hairFn(hairColor) : ''}
          
          <!-- [Layer 6] 액세서리 & 소품 -->
          ${!hiddenLayers.acc ? accFn() : ''}
        </svg>
      `.trim();
    }
  };

  // ==========================================================================
  // [2] 에이전트 프리셋 (초기 활성 캐릭터는 5명으로 설정 · 필요 시 최대 20종까지 추가 가능)
  // ==========================================================================
  const ALL_AGENT_PRESETS = [
    { id: '01', name: 'HEAD Director AI', triadRole: 'HEAD', floor: '1F', dept: 'HEAD · 총괄 지휘 (Claude Code)', gender: '픽셀 치비', skin: '#f8cfbe', hairColor: '#1e1e24', eyeColor: '#1e293b', parts: { base: 'BASE_PIXEL', hair: 'H02', face: 'F07', outfit: 'O01', bottom: 'B01', acc: 'A03' } },
    { id: '02', name: 'ORDER Planner AI', triadRole: 'HEAD', floor: '1F', dept: 'HEAD · ORDER 명세 수립', gender: '픽셀 치비', skin: '#ebb99a', hairColor: '#4a3525', eyeColor: '#2563eb', parts: { base: 'BASE_PIXEL', hair: 'H04', face: 'F02', outfit: 'O01', bottom: 'B01', acc: 'A01' } },
    { id: '03', name: 'Builder Dev AI', triadRole: 'BUILDER', floor: '1F', dept: 'BUILDER · 구현 (Antigravity)', gender: '픽셀 치비', skin: '#f8cfbe', hairColor: '#4a3525', eyeColor: '#2563eb', parts: { base: 'BASE_PIXEL', hair: 'H03', face: 'F02', outfit: 'O02', bottom: 'B02', acc: 'A04' } },
    { id: '04', name: 'Reviewer Audit AI', triadRole: 'REVIEWER', floor: '1F', dept: 'REVIEWER · 독립 검수 (Codex)', gender: '픽셀 치비', skin: '#fde2d2', hairColor: '#4a3525', eyeColor: '#2563eb', parts: { base: 'BASE_PIXEL', hair: 'H05', face: 'F02', outfit: 'O01', bottom: 'B03', acc: 'A01' } },
    { id: '05', name: 'Scope Guard AI', triadRole: 'REVIEWER', floor: '1F', dept: 'DIRECTOR · 경로/Diff 상한 검증', gender: '픽셀 치비', skin: '#e3e8ee', hairColor: '#1e1e24', eyeColor: '#1e293b', parts: { base: 'BASE_PIXEL', hair: 'H02', face: 'F06', outfit: 'O02', bottom: 'B02', acc: 'A01' } },
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
    antigravity: 'Antigravity',
    openai: 'OpenAI Codex'
  };
  let savedCharAiConfigs = {};
  try {
    savedCharAiConfigs = JSON.parse(localStorage.getItem(CHAR_AI_STORAGE_KEY) || '{}') || {};
  } catch (_) {}

  ALL_AGENT_PRESETS.forEach(a => {
    const defCli = a.triadRole === 'HEAD' ? 'claude' : a.triadRole === 'BUILDER' ? 'antigravity' : 'openai';
    const defSandbox = a.triadRole === 'BUILDER' ? 'proposal' : 'read-only';
    const defTimeout = a.triadRole === 'BUILDER' ? '600' : '300';
    const saved = savedCharAiConfigs[a.id] || {};
    a.name = saved.name || a.name;
    a.floor = saved.floor || a.floor;
    a.triadRole = saved.triadRole || a.triadRole || 'HEAD';
    a.cliProvider = saved.cliProvider || defCli;
    a.sandboxMode = saved.sandboxMode || defSandbox;
    a.timeoutSec = String(saved.timeoutSec || defTimeout);
    a.systemPrompt = saved.systemPrompt || `당신은 ${a.floor} 소속 '${a.name}' (${a.triadRole} 역할) 에이전트입니다. 맡은 전문 분야에 맞게 명확하고 정확하게 답변하세요.`;
  });

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
      systemPrompt: agent.systemPrompt
    };
    try {
      localStorage.setItem(CHAR_AI_STORAGE_KEY, JSON.stringify(savedCharAiConfigs));
    } catch (_) {}
  }

  function formatPartCode(parts) {
    return `${parts.base}/${parts.hair}/${parts.face}/${parts.outfit}/${parts.bottom}/${parts.acc}`;
  }

  // ==========================================================================
  // [3] maples.im 스타일 시뮬레이터 인터랙션 & 컨트롤러 바인딩
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
    const btnBackdrop = document.getElementById('btnBackdrop');
    const btnRandomize = document.getElementById('btnRandomize');
    const btnLoadDefault = document.getElementById('btnLoadDefault');
    const btnResetParts = document.getElementById('btnResetParts');
    const btnExportPng = document.getElementById('btnExportPng');
    const layerListEl = document.getElementById('equippedLayerList');

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
    let currentZoom = 1;
    let currentStance = 'stand1';
    const backdrops = ['backdrop-checker', 'backdrop-white', 'backdrop-dark', 'backdrop-henesys'];
    let backdropIdx = 0;
    const hiddenLayers = { base: false, hair: false, face: false, outfit: false, bottom: false, acc: false };

    // 파츠 이름 사전
    const partDict = {
      base: { BASE_PIXEL: '정밀 픽셀 치비 바디', BASE_M: '남성형 치비 바디', BASE_F: '여성형 치비 바디' },
      hair: { H00: '삭발/민머리', H01: '단발 보브컷', H02: '모던 댄디컷', H03: '로맨틱 웨이브', H04: '클래식 포마드', H05: '큐티 포니테일', H06: '플러피 펌', H07: '샤기 울프컷', H08: '시니어 그레이' },
      face: { F00: '투명/스프라이트 표정', F01: '아잉/방긋 미소', F02: '조용한 눈', F03: '당당한 윙크', F04: '멍한 인형 눈', F05: '초롱 호기심 눈', F06: '샤프 분석 눈빛', F07: '정밀 멍한 눈 (144px)', F08: '초롱 미소 눈 (159px)' },
      outfit: { O00: '없음 (이너웨어)', O01: '비즈니스 수트', O02: '개발자 후드티', O03: '스마트 셔츠&니트', O04: '연구실 랩가운', O05: '크리에이티브 워크웨어', O06: '클래식 트렌치코트', O07: '캐주얼 로고 반팔티' },
      bottom: { B00: '없음 (이너웨어)', B01: '포멀 슬랙스&구두', B02: '롤업 진&스니커즈', B03: '오피스 스커트&구두', B04: '베이지 치노&로퍼' },
      acc: { A00: '장착 해제', A01: '동글이 오피스 안경', A02: '무선 CS 헤드셋', A03: '사원증 & 스마트폰', A04: '슬림 랩탑 노트북', A05: '클래식 서류 가방', A06: '모닝 커피 텀블러', A07: '스타일러스 펜&패드' }
    };

    function renderDirectory() {
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
          card.innerHTML = `
            <div class="char-card-top">
              <span>#${agent.id} · ${agent.triadRole || 'AGENT'}</span>
              <span class="char-floor-tag">${agent.floor}</span>
            </div>
            <div class="char-svg-wrap">${CharacterEngine.render(agent)}</div>
            <div class="char-card-name">${agent.name}</div>
            <span class="char-cli-badge ${cliKey}">${cliLabel}</span>
            <div class="char-card-code">${formatPartCode(agent.parts)}</div>
          `;
          card.addEventListener('click', () => {
            selectedId = agent.id;
            renderDirectory();
            updateCustomizer();
          });
          gridEl.appendChild(card);
        });
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

    function updateCustomizer() {
      const agent = modularAgents.find(a => a.id === selectedId) || modularAgents[0];
      if (!agent || !stageEl) return;

      // 1. 프리뷰 뷰 렌더링
      stageEl.innerHTML = CharacterEngine.render(agent, { stance: currentStance, hiddenLayers });
      stageEl.className = `customizer-stage stance-${currentStance}${isFlipped ? ' flip-x' : ''}`;
      stageEl.style.transform = `scale(${currentZoom})`;

      const cliLabel = CLI_BADGE_LABELS[agent.cliProvider] || agent.cliProvider;
      if (nameEl) nameEl.textContent = `Agent #${agent.id} · ${agent.name}`;
      if (deptEl) deptEl.textContent = `${agent.floor} · ${agent.triadRole} (${cliLabel})`;
      if (pillEl) pillEl.textContent = `${agent.triadRole}/${cliLabel} · ${formatPartCode(agent.parts)}`;
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

      document.querySelectorAll('#studioCliCardGroup .studio-cli-card').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.cliVal === agent.cliProvider);
      });

      // 2. 파츠 선택 카드 활성화 상태 동기화
      document.querySelectorAll('.maples-item-card').forEach(card => {
        const parentGrid = card.closest('.maples-item-grid');
        const partKey = parentGrid?.dataset.part;
        if (partKey && agent.parts[partKey] !== undefined) {
          card.classList.toggle('active', card.dataset.val === agent.parts[partKey]);
        }
      });

      // 3. 컬러 스와치 활성화 동기화
      document.querySelectorAll('#skinPalette .maples-swatch').forEach(swatch => {
        swatch.classList.toggle('active', swatch.dataset.color.toLowerCase() === (agent.skin || '').toLowerCase());
      });
      document.querySelectorAll('#hairPalette .maples-swatch').forEach(swatch => {
        swatch.classList.toggle('active', swatch.dataset.color.toLowerCase() === (agent.hairColor || '').toLowerCase());
      });
      document.querySelectorAll('#eyePalette .maples-swatch').forEach(swatch => {
        swatch.classList.toggle('active', swatch.dataset.color.toLowerCase() === (agent.eyeColor || '').toLowerCase());
      });

      // 4. 장착 레이어 스택 렌더링 (maples.im Signature Layer Stack)
      renderLayerStack(agent);

      // 5. maples.im + AI CLI 통합 JSON 프리셋 코드 생성
      if (codeOutputEl) {
        const presetObj = {
          app: "maples-virtual-office-triad",
          version: "3.0",
          character: {
            id: `AGENT_${agent.id}`,
            name: agent.name,
            floor: agent.floor,
            dept: agent.dept,
            gender: agent.parts.base === 'BASE_PIXEL' ? '픽셀 베이스' : (agent.parts.base === 'BASE_M' ? '남성' : '여성'),
            aiConfig: {
              triadRole: agent.triadRole,
              cliProvider: agent.cliProvider,
              cliLabel: cliLabel,
              sandboxMode: agent.sandboxMode,
              timeoutSec: Number(agent.timeoutSec || 300),
              systemPrompt: agent.systemPrompt
            },
            skin: agent.skin,
            hairColor: agent.hairColor,
            eyeColor: agent.eyeColor,
            parts: agent.parts,
            stance: currentStance,
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
    studioQuickCli?.addEventListener('change', (e) => {
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
      const roleKey = (agent.triadRole || 'HEAD').toLowerCase();
      if (!['head', 'builder', 'reviewer'].includes(roleKey)) {
        alert('전역 오케스트레이터 역할 반영은 HEAD, BUILDER, REVIEWER 역할일 때 적용됩니다.');
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

    function renderLayerStack(agent) {
      if (!layerListEl) return;
      layerListEl.innerHTML = '';
      const layerKeys = [
        { key: 'base', label: '바디 베이스', resetVal: 'BASE_M' },
        { key: 'hair', label: '헤어스타일', resetVal: 'H00' },
        { key: 'face', label: '성형/표정', resetVal: 'F01' },
        { key: 'outfit', label: '상의/의상', resetVal: 'O00' },
        { key: 'bottom', label: '하의/신발', resetVal: 'B00' },
        { key: 'acc', label: '액세서리', resetVal: 'A00' }
      ];

      layerKeys.forEach(({ key, label, resetVal }) => {
        const row = document.createElement('div');
        const isHidden = hiddenLayers[key];
        row.className = `layer-row${isHidden ? ' hidden-layer' : ''}`;
        const val = agent.parts[key];
        const valName = partDict[key]?.[val] || val || '장착 안 됨';

        row.innerHTML = `
          <div class="layer-info">
            <span class="layer-tag">${label}</span>
            <span class="layer-name">${valName}</span>
          </div>
          <div class="layer-actions">
            <button type="button" class="layer-btn btn-toggle-vis" title="${isHidden ? '레이어 보이기' : '레이어 숨기기'}">
              ${isHidden ? '👁️‍🗨️' : '👁️'}
            </button>
            <button type="button" class="layer-btn btn-remove-layer" title="레이어 해제/초기화">
              🗑️
            </button>
          </div>
        `;

        // 숨김 토글
        row.querySelector('.btn-toggle-vis')?.addEventListener('click', () => {
          hiddenLayers[key] = !hiddenLayers[key];
          updateCustomizer();
        });

        // 해제 버튼
        row.querySelector('.btn-remove-layer')?.addEventListener('click', () => {
          agent.parts[key] = resetVal;
          renderDirectory();
          updateCustomizer();
        });

        layerListEl.appendChild(row);
      });
    }

    // [이벤트] maples.im 탭 전환
    document.querySelectorAll('.maples-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.maples-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.maples-panel').forEach(p => p.classList.remove('active'));
        tab.classList.add('active');
        const targetPanel = document.getElementById(tab.dataset.tab);
        if (targetPanel) targetPanel.classList.add('active');
      });
    });

    // [이벤트] 파츠 아이템 카드 클릭 (이벤트 위임으로 동적 생성 버튼도 100% 자동 지원)
    document.addEventListener('click', (e) => {
      const card = e.target.closest('.maples-item-card');
      if (!card) return;
      const agent = modularAgents.find(a => a.id === selectedId);
      const parentGrid = card.closest('.maples-item-grid');
      const partKey = parentGrid?.dataset.part;
      if (!agent || !partKey) return;

      agent.parts[partKey] = card.dataset.val;
      if (partKey === 'base') {
        agent.gender = card.dataset.val === 'BASE_PIXEL' ? '픽셀 베이스' : (card.dataset.val === 'BASE_M' ? '남성' : '여성');
      }
      hiddenLayers[partKey] = false; // 파츠 선택 시 숨김 자동 해제
      updateF07Badge();
      renderDirectory();
      updateCustomizer();
    });

    // [이벤트] 피부톤 스와치 클릭
    document.querySelectorAll('#skinPalette .maples-swatch').forEach(swatch => {
      swatch.addEventListener('click', () => {
        const agent = modularAgents.find(a => a.id === selectedId);
        if (!agent) return;
        agent.skin = swatch.dataset.color;
        renderDirectory();
        updateCustomizer();
      });
    });

    // [이벤트] 헤어 염색 컬러 스와치 클릭
    document.querySelectorAll('#hairPalette .maples-swatch').forEach(swatch => {
      swatch.addEventListener('click', () => {
        const agent = modularAgents.find(a => a.id === selectedId);
        if (!agent) return;
        agent.hairColor = swatch.dataset.color;
        renderDirectory();
        updateCustomizer();
      });
    });

    // [이벤트] 동공 렌즈 컬러 스와치 클릭
    document.querySelectorAll('#eyePalette .maples-swatch').forEach(swatch => {
      swatch.addEventListener('click', () => {
        const agent = modularAgents.find(a => a.id === selectedId);
        if (!agent) return;
        agent.eyeColor = swatch.dataset.color;
        renderDirectory();
        updateCustomizer();
      });
    });

    // [이벤트] 방향 좌우 반전
    btnFlipDir?.addEventListener('click', () => {
      isFlipped = !isFlipped;
      updateCustomizer();
    });

    // [이벤트] 모션/스탠스 변경
    selStance?.addEventListener('change', (e) => {
      currentStance = e.target.value;
      updateCustomizer();
    });

    // [이벤트] 줌 배율
    document.querySelectorAll('.zoom-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.zoom-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentZoom = parseFloat(btn.dataset.zoom || '1');
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

    // [이벤트] 🎲 랜덤 코디 생성 (maples.im Randomize)
    btnRandomize?.addEventListener('click', () => {
      const agent = modularAgents.find(a => a.id === selectedId);
      if (!agent) return;
      const pick = arr => arr[Math.floor(Math.random() * arr.length)];

      const skins = ['#fff0e6', '#fde2d2', '#f8cfbe', '#ebb99a', '#cf9571', '#e3e8ee'];
      const hairColors = ['#1e1e24', '#4a3525', '#7c4a2d', '#d4a359', '#f472b6', '#3b82f6', '#94a3b8', '#10b981'];
      const eyeColors = ['#1e293b', '#2563eb', '#059669', '#dc2626', '#d97706', '#9333ea'];
      const hairs = ['H01', 'H02', 'H03', 'H04', 'H05', 'H06', 'H07', 'H08'];
      const faces = ['F01', 'F02', 'F03', 'F04', 'F05', 'F06'];
      const outfits = ['O01', 'O02', 'O03', 'O04', 'O05', 'O06', 'O07'];
      const bottoms = ['B01', 'B02', 'B03', 'B04'];
      const accs = ['A00', 'A01', 'A02', 'A03', 'A04', 'A05', 'A06', 'A07'];

      agent.skin = pick(skins);
      agent.hairColor = pick(hairColors);
      agent.eyeColor = pick(eyeColors);
      agent.parts.hair = pick(hairs);
      agent.parts.face = pick(faces);
      agent.parts.outfit = pick(outfits);
      agent.parts.bottom = pick(bottoms);
      agent.parts.acc = pick(accs);

      // 전체 레이어 숨김 해제
      Object.keys(hiddenLayers).forEach(k => hiddenLayers[k] = false);

      renderDirectory();
      updateCustomizer();

      // 경쾌한 주사위 클릭 피드백
      stageEl.style.transition = 'transform 0.15s ease';
      stageEl.style.transform = `scale(${currentZoom * 1.15})`;
      setTimeout(() => { stageEl.style.transform = `scale(${currentZoom})`; }, 150);
    });

    // [이벤트] ⭐ 메이플 시뮬레이터 기본 캐릭터 로드 (Default Character)
    btnLoadDefault?.addEventListener('click', () => {
      const agent = modularAgents.find(a => a.id === selectedId);
      if (!agent) return;
      let defType = 'male';
      if (agent.parts.base === 'BASE_PIXEL') {
        defType = 'pixel';
      } else if (agent.gender === '여성') {
        defType = 'female';
      }
      const def = (window.MapleDefaultCharacter && window.MapleDefaultCharacter.getPreset(defType)) || {
        skin: agent.gender === '여성' ? '#fff0e6' : '#fde2d2',
        hairColor: agent.gender === '여성' ? '#7c4a2d' : '#4a3525',
        eyeColor: '#1e293b',
        parts: {
          base: agent.gender === '여성' ? 'BASE_F' : 'BASE_M',
          hair: agent.gender === '여성' ? 'H01' : 'H02',
          face: 'F01',
          outfit: 'O07',
          bottom: agent.gender === '여성' ? 'B03' : 'B02',
          acc: 'A03'
        }
      };

      agent.skin = def.skin;
      agent.hairColor = def.hairColor;
      agent.eyeColor = def.eyeColor;
      agent.parts = Object.assign({}, def.parts);
      Object.keys(hiddenLayers).forEach(k => hiddenLayers[k] = false);

      renderDirectory();
      updateCustomizer();

      // 시각적 피드백
      stageEl.style.transition = 'transform 0.18s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
      stageEl.style.transform = `scale(${currentZoom * 1.1})`;
      setTimeout(() => { stageEl.style.transform = `scale(${currentZoom})`; }, 180);
    });

    // [이벤트] 🔄 초기화 (기본 프리셋으로 복원)
    btnResetParts?.addEventListener('click', () => {
      const agent = modularAgents.find(a => a.id === selectedId);
      if (!agent) return;
      agent.parts.hair = 'H02';
      agent.parts.face = 'F02';
      agent.parts.outfit = 'O01';
      agent.parts.bottom = 'B01';
      agent.parts.acc = 'A03';
      agent.skin = '#f8cfbe';
      agent.hairColor = '#4a3525';
      agent.eyeColor = '#1e293b';
      Object.keys(hiddenLayers).forEach(k => hiddenLayers[k] = false);
      renderDirectory();
      updateCustomizer();
    });

    // [이벤트] 💾 PNG 투명 배경 다운로드 (HTML5 Canvas 직렬화)
    btnExportPng?.addEventListener('click', () => {
      const svgEl = stageEl.querySelector('svg');
      if (!svgEl) return;
      const svgData = new XMLSerializer().serializeToString(svgEl);
      const canvas = document.createElement('canvas');
      canvas.width = 384;
      canvas.height = 468;
      const ctx = canvas.getContext('2d');
      const img = new Image();
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);
      img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (isFlipped) {
          ctx.translate(canvas.width, 0);
          ctx.scale(-1, 1);
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        const a = document.createElement('a');
        a.download = `maples_office_agent_${selectedId}.png`;
        a.href = canvas.toDataURL('image/png');
        a.click();
      };
      img.src = url;
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

    renderDirectory();
    updateCustomizer();

    // 외부 파츠(F07.json, F08.json, F09.json, F10.json 등) 수정 시 실시간 화면 갱신
    function getActiveFaceKey() {
      const agent = modularAgents.find(a => a.id === selectedId);
      return agent?.parts?.face || 'F07';
    }

    function updateF07Badge() {
      const badge = document.getElementById('f07CoordBadge');
      if (!badge || !window.PixelChibiParts) return;
      const key = getActiveFaceKey();
      const off = window.PixelChibiParts.getOffset('face', key);
      badge.textContent = `[${key}] X: ${off.x}, Y: ${off.y}`;
    }

    document.querySelectorAll('.f07-move-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!window.PixelChibiParts) return;
        const key = getActiveFaceKey();
        const axis = btn.dataset.axis;
        const delta = parseInt(btn.dataset.delta, 10) || 0;
        const off = window.PixelChibiParts.getOffset('face', key);
        const nx = axis === 'x' ? off.x + delta : off.x;
        const ny = axis === 'y' ? off.y + delta : off.y;
        window.PixelChibiParts.setOffset('face', key, nx, ny);
        updateF07Badge();
        renderDirectory();
        updateCustomizer();
      });
    });

    document.querySelector('.f07-reset-btn')?.addEventListener('click', () => {
      if (!window.PixelChibiParts) return;
      const key = getActiveFaceKey();
      window.PixelChibiParts.setOffset('face', key, 0, 0);
      updateF07Badge();
      renderDirectory();
      updateCustomizer();
    });

    window.addEventListener('chibi-part-updated', () => {
      updateF07Badge();
      renderDirectory();
      updateCustomizer();
    });
    updateF07Badge();

    // ========================================================================
    // [매니페스트 기반 파츠 디스커버리 (404 없는 클린 로더)]
    // avatar/data/parts/manifest.json에 등록된 실제 존재 파일만 로드합니다.
    // ========================================================================
    const scannedCache = new Map();

    async function loadPartFromManifest(category, id) {
      const grid = document.querySelector(`.maples-item-grid[data-part="${category}"]`);
      if (!grid) return;
      const prefix = id.slice(0, 1);
      const num = parseInt(id.slice(1), 10);
      const url = `avatar/data/parts/${category}/${id}.json`;
      try {
        const res = await fetch(url);
        if (!res.ok) return;
        const text = await res.text();
        if (text === scannedCache.get(id)) return;
        scannedCache.set(id, text);

        let data;
        try { data = JSON.parse(text); } catch (e) { return; }

        if (window.PixelChibiParts?.registerPart) {
          window.PixelChibiParts.registerPart(category, id, data);
        }

        let btn = grid.querySelector(`button[data-val="${id}"]`);
        const title = data.meta?.title || data.meta?.name || `${id} 신규 파츠`;
        const pixelsCount = data.meta?.totalPixels || (Array.isArray(data.pixels) ? data.pixels.length : '');
        const pxLabel = pixelsCount ? ` (${pixelsCount}px)` : '';

        if (!btn) {
          btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'maples-item-card auto-added-part';
          btn.dataset.val = id;
          btn.innerHTML = `<span class="item-code">${id}</span><span class="item-title">${title}${pxLabel}</span>`;
          btn.title = `자동 등록된 신규 에셋: ${title}`;

          const allButtons = [...grid.querySelectorAll('.maples-item-card')];
          let inserted = false;
          for (const existing of allButtons) {
            const existVal = existing.dataset.val || '';
            if (existVal.startsWith(prefix)) {
              const existNum = parseInt(existVal.slice(prefix.length), 10);
              if (!isNaN(num) && existNum > num) {
                grid.insertBefore(btn, existing);
                inserted = true;
                break;
              }
            }
          }
          if (!inserted) grid.appendChild(btn);

          const subhead = grid.parentElement?.querySelector('.maples-subhead em');
          if (subhead) {
            const total = grid.querySelectorAll('.maples-item-card').length;
            const unit = category === 'face' ? 'Faces' : (category === 'hair' ? 'Styles' : 'Items');
            subhead.textContent = `${total} ${unit}`;
          }
        } else {
          const titleEl = btn.querySelector('.item-title');
          if (titleEl && !titleEl.textContent.includes('px') && pixelsCount) {
            titleEl.textContent = `${title}${pxLabel}`;
          }
        }

        const activeAgent = modularAgents.find(a => a.id === selectedId);
        if (activeAgent?.parts?.[category] === id) {
          updateF07Badge();
          renderDirectory();
          updateCustomizer();
        }
      } catch (_) {}
    }

    async function runAutoDiscovery() {
      if (page !== 'agents') return;
      try {
        const res = await fetch('avatar/data/parts/manifest.json', { cache: 'no-store' });
        if (!res.ok) return;
        const manifest = await res.json();
        const tasks = [];
        for (const [category, ids] of Object.entries(manifest || {})) {
          if (Array.isArray(ids)) {
            ids.forEach(id => tasks.push(loadPartFromManifest(category, id)));
          }
        }
        await Promise.all(tasks);
      } catch (_) {}
    }

    // 초기 1회 매니페스트 로드 (무차별 404 폴링 제거)
    runAutoDiscovery();
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
    antigravity: 'Google Antigravity (agy)',
    openai: 'OpenAI Codex (codex)'
  };
  const CLI_SHORT = {
    claude: 'Claude',
    antigravity: 'Antigravity',
    openai: 'Codex'
  };
  const ROLE_STORAGE_KEY = 'nexus-triad-roles-v1';

  function loadStoredRoles() {
    try {
      const parsed = JSON.parse(localStorage.getItem(ROLE_STORAGE_KEY) || 'null');
      if (parsed && parsed.head && parsed.builder && parsed.reviewer) return parsed;
    } catch (_) {}
    return { head: 'claude', builder: 'antigravity', reviewer: 'openai' };
  }

  let currentRoles = loadStoredRoles();
  let localPipelineTimer = null;

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
    updatePill('tableCliReviewer', currentRoles.reviewer);

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
      if (agentLog && page === 'agents') {
        agentLog.innerHTML = events.slice(0, 5).map(ev => {
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
    }
  }

  // Bind Role Swap Dropdowns (HEAD / BUILDER / REVIEWER must be 3 distinct CLIs)
  document.querySelectorAll('[data-role-select]').forEach(sel => {
    sel.addEventListener('change', async (e) => {
      const changedRole = e.target.dataset.roleSelect;
      const newCli = e.target.value;
      const nextRoles = { ...currentRoles };
      const conflictRole = Object.keys(nextRoles).find(r => nextRoles[r] === newCli && r !== changedRole);
      if (conflictRole) {
        nextRoles[conflictRole] = currentRoles[changedRole];
      }
      nextRoles[changedRole] = newCli;
      applyRolesToDOM(nextRoles);

      try {
        await fetch('/ops/roles', {
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

  // In agents.html, clicking an agent row selects that employee for quick question
  document.querySelectorAll('#agentList .agent-card-row').forEach(row => {
    row.style.cursor = 'pointer';
    row.title = '클릭하여 이 AI 직원에게 질문하기';
    row.addEventListener('click', () => {
      const role = (row.dataset.role || 'HEAD').toLowerCase();
      const agentName = row.querySelector('.agent-name')?.textContent?.trim() || '';
      if (targetAgentSelect) {
        targetAgentSelect.value = ['head', 'builder', 'reviewer', 'director', 'triad'].includes(role) ? role : 'head';
        targetAgentSelect.dataset.customAgentName = agentName;
      }
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
          label: 'Google Antigravity',
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
        }
      }
    };
  }

  function ensureCliSettingsModal() {
    const topActions = document.querySelector('.topbar .top-actions');
    if (topActions && !document.getElementById('btnOpenCliSettings')) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.id = 'btnOpenCliSettings';
      btn.className = 'cli-settings-btn';
      btn.innerHTML = `<span class="cli-settings-dot" id="cliSettingsDot"></span><span>⚙ CLI 로그인 & 설정</span>`;
      btn.addEventListener('click', () => openCliSettingsModal(false));
      topActions.insertBefore(btn, topActions.firstChild);
    }

    const wsCard = document.querySelector('.sidebar .workspace-card');
    if (wsCard && !wsCard.dataset.cliBound) {
      wsCard.dataset.cliBound = '1';
      wsCard.style.cursor = 'pointer';
      wsCard.title = '클릭하여 AI CLI 로그인 상태 및 경로 설정 열기';
      wsCard.addEventListener('click', () => openCliSettingsModal(false));
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
              <option value="antigravity">Google Antigravity (agy)</option>
              <option value="claude">Claude Code (claude)</option>
              <option value="openai">OpenAI Codex (codex)</option>
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

  function renderCliDiagnosticsModal(diag) {
    lastDiagnostics = diag || getFallbackDiagnostics();
    const providers = lastDiagnostics.providers || {};
    const grid = document.getElementById('cliAuthGrid');
    const headline = document.getElementById('cliSummaryHeadline');
    const sub = document.getElementById('cliSummarySub');
    const dot = document.getElementById('cliSettingsDot');

    const list = ['claude', 'antigravity', 'openai'].map(k => providers[k]).filter(Boolean);
    const loggedInCount = list.filter(p => p.auth_state === 'LOGGED_IN').length;
    const installedCount = list.filter(p => p.installed).length;

    if (dot) {
      dot.className = `cli-settings-dot ${loggedInCount === 3 ? '' : loggedInCount >= 1 || installedCount >= 1 ? 'warn' : 'off'}`;
    }

    if (headline) {
      if (lastDiagnostics.triad_state === 'STATIC_FALLBACK') {
        headline.textContent = '현재 정적 파일 서버(http.server) 모드 · 404 방지 폴백 활성화됨';
      } else {
        headline.textContent = `구독 로그인 확인: ${loggedInCount} / 3개 CLI · 설치 감지: ${installedCount} / 3개 CLI (${lastDiagnostics.triad_state || 'TRIAD'})`;
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

    grid.innerHTML = ['claude', 'antigravity', 'openai'].map(key => {
      const p = providers[key] || {};
      const state = p.auth_state || 'NOT_INSTALLED';
      const cardCls = state === 'LOGGED_IN' ? 'logged-in' : state === 'AUTH_REQUIRED' ? 'auth-required' : '';
      const assignedRole = roleByProvider[key] || 'UNASSIGNED';
      const roleCls = assignedRole === 'HEAD' ? 'role-head' : assignedRole === 'BUILDER' ? 'role-builder' : 'role-reviewer';
      const cliName = p.cli || (key === 'claude' ? 'claude' : key === 'antigravity' ? 'agy' : 'codex');

      const actionButtonsHtml = !p.installed
        ? `
          <button type="button" class="btn small primary btn-install-cli" data-cli="${cliName}">⚡ 원클릭 설치 (${cliName})</button>
          <button type="button" class="btn small mint btn-login-cli" data-cli="${cliName}">🔑 설치+로그인 창 열기</button>
        `
        : state === 'LOGGED_IN'
        ? `
          <button type="button" class="btn small" style="background:#dcfce7;color:#15803d;border-color:#86efac" disabled>✓ 구독 로그인 완료됨</button>
          <button type="button" class="btn small btn-install-cli" data-cli="${cliName}">🔄 경로/버전 재확인</button>
        `
        : `
          <button type="button" class="btn small mint btn-login-cli" data-cli="${cliName}">🔑 원클릭 로그인 창 열기</button>
          <button type="button" class="btn small btn-install-cli" data-cli="${cliName}">🔄 재설치/연결</button>
        `;

      return `
        <div class="cli-auth-card ${cardCls}">
          <div class="cli-auth-top">
            <div class="cli-auth-title">
              <span class="triad-role-badge ${roleCls}">${assignedRole}</span>
              <span>${p.label || key}</span>
            </div>
            <span class="cli-auth-badge ${state}">${p.auth_label || state}</span>
          </div>
          <div class="cli-auth-detail">${p.auth_detail || ''}</div>
          <div class="cli-auth-rows">
            <div class="cli-auth-row"><span>CLI 명령어</span><code>${cliName}</code></div>
            <div class="cli-auth-row"><span>설치 명령</span><code>${p.install_cmd || ''}</code></div>
            <div class="cli-auth-row"><span>감지된 버전</span><strong>${p.version || '미확인'}</strong></div>
            <div class="cli-auth-row"><span>실행 파일 경로</span><code>${p.executable || 'PATH 미감지 (원클릭 설치 가능)'}</code></div>
            <div class="cli-auth-row"><span>구독 세션 파일</span><code>${p.session_marker || '미감지'}</code></div>
            <div class="cli-auth-row"><span>종량제 API 키</span><strong style="color:#15803d">차단됨 (구독 전용)</strong></div>
          </div>
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
    grid.querySelectorAll('.btn-copy-login').forEach(btn => {
      btn.addEventListener('click', () => {
        const cmd = btn.dataset.cmd || '';
        navigator.clipboard?.writeText(cmd);
        const orig = btn.textContent;
        btn.textContent = `✓ 복사됨 (${cmd})`;
        setTimeout(() => { btn.textContent = orig; }, 1400);
      });
    });
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
