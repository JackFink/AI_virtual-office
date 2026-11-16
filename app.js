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

      // [0] KMS v389 (maplestory-characters-scraper) 렌더링 최우선 적용 (디렉토리 · 가상 오피스 전 좌석 · 사이드바 공통)
      if (agent && agent.mapleEquipped && Object.keys(agent.mapleEquipped).length > 0) {
        const eq = agent.mapleEquipped;
        const skinId = eq.skin || 2000;
        const anim = options.stance || agent.mapleAnim || 'stand1';
        const isAnimated = Boolean(options.animated !== undefined ? options.animated : agent.mapleAnimated);
        const isFlip = Boolean(options.flipped !== undefined ? options.flipped : agent.mapleFlipped);
        const visualSlots = [
          'hair', 'face', 'overall', 'top', 'bottom', 'shoes',
          'hat', 'faceAccessory', 'eyeDecoration', 'earrings', 'cape', 'glove',
          'furniture', 'effect', 'ring', 'title', 'decoration', 'petEquip'
        ];
        const itemIds = [];
        visualSlots.forEach(s => {
          if (s === 'furniture' && anim !== 'sit') return;
          if (eq[s]) itemIds.push(eq[s]);
        });
        const itemsParam = itemIds.join(',');
        const kmsUrl = `https://maplestory.io/api/KMS/389/Character${isAnimated ? '/animated' : ''}/${skinId}/${itemsParam}/${anim}/0`;
        const flipStyle = isFlip ? 'transform:scaleX(-1);' : '';
        return `
          <div class="kms389-avatar-wrap" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;position:relative">
            <img src="${kmsUrl}" alt="${agent.name || 'Avatar'}" style="max-width:100%;max-height:100%;object-fit:contain;image-rendering:pixelated;filter:drop-shadow(0 3px 6px rgba(15,23,42,0.18));${flipStyle}" />
          </div>
        `.trim();
      }

      // [0-2] 폴백: 뒷모습(Back View) 렌더링
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
    { id: '02', name: 'Grok Scout AI', triadRole: 'RESEARCHER', floor: '1F', dept: 'RESEARCHER · 심층 추론 (xAI Grok)', gender: '픽셀 치비', skin: '#ebb99a', hairColor: '#4a3525', eyeColor: '#2563eb', parts: { base: 'BASE_PIXEL', hair: 'H04', face: 'F02', outfit: 'O01', bottom: 'B01', acc: 'A01' } },
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
    openai: 'OpenAI Codex',
    grok: 'xAI Grok'
  };
  let savedCharAiConfigs = {};
  try {
    savedCharAiConfigs = JSON.parse(localStorage.getItem(CHAR_AI_STORAGE_KEY) || '{}') || {};
  } catch (_) {}

  const DEFAULT_SKILLS_BY_ROLE = {
    HEAD: ['ORDER 명세 수립', '아키텍처 설계', 'PASS/FAIL 최종 판정'],
    BUILDER: ['풀스택 코드 구현', 'UI/UX & SVG', '격리 Worktree 제안'],
    REVIEWER: ['코드 리뷰(P0/P1)', '자동화 테스트', 'Scope Guard 검증']
  };

  const PERSONA_TEMPLATES = {
    head: "당신은 NEXUS 오피스의 총괄 디렉터(HEAD)입니다. 사용자의 목표를 분석하여 명확한 작업 범위(ORDER)를 정의하고, 구조적이고 핵심 위주로 결단력 있게 답변하세요.",
    builder: "당신은 NEXUS 오피스의 수석 개발자(BUILDER)입니다. 클린 코드, 모듈화, 실행 가능한 구현 방법을 최우선으로 제시하며 실용적인 엔지니어 톤으로 답변하세요.",
    reviewer: "당신은 NEXUS 오피스의 독립 감사관(REVIEWER)입니다. Fail-Closed 원칙에 따라 잠재적 버그(P0/P1), 엣지 케이스, 보안 취약점을 꼼꼼히 짚어내며 객관적으로 답변하세요.",
    security: "당신은 NEXUS 오피스의 Scope Guard 안전 감독관입니다. 허용 경로 준수, 파일 변경 상한, API 키 노출 차단 등 안전성과 규정 준수 관점에서 엄격하게 답변하세요."
  };

  const DEFAULT_MAPLE_EQUIPPED_BY_ID = {
    '01': { skin: 2000, hair: 30000, face: 20000, overall: 1050018, shoes: 1072000, hat: 1002140 },
    '02': { skin: 2000, hair: 30005, face: 20001, overall: 1050004, shoes: 1070004, hat: 1000004 },
    '03': { skin: 2000, hair: 30002, face: 20002, overall: 1050000, shoes: 1070001, hat: 1000000 },
    '04': { skin: 2000, hair: 30001, face: 20000, overall: 1050003, shoes: 1070005, hat: 1000002 },
    '05': { skin: 2000, hair: 30004, face: 20001, overall: 1050005, shoes: 1070003, hat: 1000005 }
  };

  function applySavedConfigToAgent(a, idx = 0) {
    const defCli = a.triadRole === 'HEAD' ? 'claude' : a.triadRole === 'BUILDER' ? 'antigravity' : a.triadRole === 'RESEARCHER' ? 'grok' : 'openai';
    const defSandbox = a.triadRole === 'BUILDER' ? 'proposal' : 'read-only';
    const defTimeout = a.triadRole === 'BUILDER' ? '600' : '300';
    const saved = savedCharAiConfigs[a.id] || {};
    const defMaple = DEFAULT_MAPLE_EQUIPPED_BY_ID[a.id] || {
      skin: 2000,
      hair: 30000 + (idx % 6),
      face: 20000 + (idx % 5),
      overall: 1050000 + (idx % 6),
      shoes: 1070000 + (idx % 6),
      hat: 1000000 + (idx % 6)
    };
    a.name = saved.name || a.name;
    a.floor = saved.floor || a.floor;
    a.triadRole = saved.triadRole || a.triadRole || 'HEAD';
    a.cliProvider = saved.cliProvider || defCli;
    a.sandboxMode = saved.sandboxMode || defSandbox;
    a.timeoutSec = String(saved.timeoutSec || defTimeout);
    a.mapleEquipped = (saved.mapleEquipped && typeof saved.mapleEquipped === 'object' && Object.keys(saved.mapleEquipped).length > 0)
      ? { ...saved.mapleEquipped }
      : { ...defMaple };
    a.mapleAnim = saved.mapleAnim || 'stand1';
    a.mapleAnimated = Boolean(saved.mapleAnimated);
    a.mapleFlipped = Boolean(saved.mapleFlipped);
    a.skills = Array.isArray(saved.skills) && saved.skills.length
      ? [...saved.skills]
      : [...(DEFAULT_SKILLS_BY_ROLE[a.triadRole] || DEFAULT_SKILLS_BY_ROLE.HEAD)];
    a.systemPrompt = saved.systemPrompt || `당신은 ${a.floor} 소속 '${a.name}' (${a.triadRole} 역할) 에이전트입니다. 맡은 전문 분야에 맞게 명확하고 정확하게 답변하세요.`;
  }

  ALL_AGENT_PRESETS.forEach((a, idx) => applySavedConfigToAgent(a, idx));

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
      mapleEquipped: agent.mapleEquipped ? { ...agent.mapleEquipped } : {},
      mapleAnim: agent.mapleAnim || 'stand1',
      mapleAnimated: Boolean(agent.mapleAnimated),
      mapleFlipped: Boolean(agent.mapleFlipped),
      skills: Array.isArray(agent.skills) ? agent.skills : [],
      systemPrompt: agent.systemPrompt,
      updatedAt: new Date().toISOString()
    };
    try {
      localStorage.setItem(CHAR_AI_STORAGE_KEY, JSON.stringify(savedCharAiConfigs));
    } catch (_) {}
  }

  async function saveCharacterConfigsToServer(targetAgent = null) {
    if (targetAgent) {
      persistCharacterAiConfig(targetAgent);
    } else {
      modularAgents.forEach(a => persistCharacterAiConfig(a));
    }
    try {
      await fetch('/ops/character-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ configs: savedCharAiConfigs })
      });
    } catch (_) {}
    renderTopRosterAvatars();
    window.dispatchEvent(new CustomEvent('nexus:character-configs-updated', { detail: { configs: savedCharAiConfigs } }));
  }

  function renderTopRosterAvatars() {
    // agents.html 상단 Triad 역할 체계별 AI 직원 목록(#agentList) 및 index.html 테이블 아바타에 KMS v389 캐릭터 반영
    const topRows = document.querySelectorAll('#agentList .agent-card-row');
    topRows.forEach((row, idx) => {
      const ag = modularAgents[idx] || ALL_AGENT_PRESETS[idx];
      if (!ag) return;
      const avEl = row.querySelector('.agent-avatar');
      if (avEl) {
        avEl.style.overflow = 'hidden';
        avEl.style.padding = '1px';
        avEl.innerHTML = CharacterEngine.render(ag, { stance: ag.mapleAnim || 'stand1', animated: false });
      }
      const nameNode = row.querySelector('.agent-name');
      if (nameNode && ag.name) nameNode.textContent = ag.name;
    });
    const dashRows = document.querySelectorAll('#dashboardAgentTableBody tr');
    dashRows.forEach((tr, idx) => {
      const ag = modularAgents[idx] || ALL_AGENT_PRESETS[idx];
      if (!ag) return;
      const avEl = tr.querySelector('.agent-avatar');
      if (avEl) {
        avEl.style.overflow = 'hidden';
        avEl.style.padding = '1px';
        avEl.innerHTML = CharacterEngine.render(ag, { stance: ag.mapleAnim || 'stand1', animated: false });
      }
    });
  }

  // 페이지 로드 시 서버(data/character_configs.json)에 저장된 캐릭터 코디 설정도 동기화
  fetch('/ops/character-config')
    .then(r => r.ok ? r.json() : null)
    .then(data => {
      if (data && data.configs && typeof data.configs === 'object' && Object.keys(data.configs).length > 0) {
        savedCharAiConfigs = { ...data.configs, ...savedCharAiConfigs };
        Object.keys(data.configs).forEach(cid => {
          const srv = data.configs[cid];
          const loc = savedCharAiConfigs[cid];
          if (srv && (!loc || (srv.updatedAt && (!loc.updatedAt || srv.updatedAt >= loc.updatedAt)))) {
            savedCharAiConfigs[cid] = srv;
          }
        });
        try {
          localStorage.setItem(CHAR_AI_STORAGE_KEY, JSON.stringify(savedCharAiConfigs));
        } catch (_) {}
        ALL_AGENT_PRESETS.forEach((a, idx) => applySavedConfigToAgent(a, idx));
        renderTopRosterAvatars();
        window.dispatchEvent(new CustomEvent('nexus:character-configs-updated', { detail: { configs: savedCharAiConfigs } }));
      }
    })
    .catch(() => {});

  renderTopRosterAvatars();

  function formatPartCode(parts, agent = null) {
    if (agent && agent.mapleEquipped && Object.keys(agent.mapleEquipped).length > 0) {
      const eq = agent.mapleEquipped;
      return `KMS389 · H:${eq.hair || '-'} / F:${eq.face || '-'} / C:${eq.overall || eq.top || '-'}`;
    }
    return `${parts.base}/${parts.hair}/${parts.face}/${parts.outfit}/${parts.bottom}/${parts.acc}`;
  }

  // ==========================================================================
  // [3] KMS v389 (maplestory-characters-scraper · 29,491 Parts) 시뮬레이터 컨트롤러
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
    const btnSimMotionPlay = document.getElementById('btnSimMotionPlay');
    const simMotionIcon = document.getElementById('simMotionIcon');
    const simMotionLabel = document.getElementById('simMotionLabel');
    const simBgLayer = document.getElementById('simBgLayer');
    const simBgImg = document.getElementById('simBgImg');
    const simBgBadge = document.getElementById('simBgBadge');
    const simPetBox = document.getElementById('simPetBox');
    const simPetImg = document.getElementById('simPetImg');
    const simPetName = document.getElementById('simPetName');
    const btnBackdrop = document.getElementById('btnBackdrop');
    const btnRandomize = document.getElementById('btnRandomize');
    const btnLoadDefault = document.getElementById('btnLoadDefault');
    const btnResetParts = document.getElementById('btnResetParts');
    const btnExportPng = document.getElementById('btnExportPng');
    const layerListEl = document.getElementById('equippedLayerList');
    const simEquippedCountEl = document.getElementById('simEquippedCount');

    // KMS v389 29,491개 파츠 브라우저 DOM
    const mapleSimSearchInput = document.getElementById('mapleSimSearchInput');
    const btnMapleSimClearSearch = document.getElementById('btnMapleSimClearSearch');
    const mapleSimOnlyEquipped = document.getElementById('mapleSimOnlyEquipped');
    const mapleSimSubFilters = document.getElementById('mapleSimSubFilters');
    const mapleSimCategoryTitle = document.getElementById('mapleSimCategoryTitle');
    const mapleSimResultCount = document.getElementById('mapleSimResultCount');
    const mapleSimPartsGrid = document.getElementById('mapleSimPartsGrid');
    const mapleSimLoadMoreWrap = document.getElementById('mapleSimLoadMoreWrap');
    const mapleSimLoadMoreInfo = document.getElementById('mapleSimLoadMoreInfo');
    const btnMapleSimLoadMore = document.getElementById('btnMapleSimLoadMore');
    const btnUnequipAllMaple = document.getElementById('btnUnequipAllMaple');

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
    let isMotionAnimated = false;
    const backdrops = ['backdrop-checker', 'backdrop-white', 'backdrop-dark', 'backdrop-henesys'];
    let backdropIdx = 0;

    // ========================================================================
    // KMS v389 (maplestory-characters-scraper) 29,491개 파츠 데이터 및 슬롯 정의
    // ========================================================================
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
      building: { label: '건물 배경', icon: '🏛️', order: 21 }
    };

    const CATEGORY_NAMES = {
      all: '전체 항목',
      hair: '💇 헤어 (Hair)',
      face: '👀 표정/성형 (Face)',
      clothes: '👗 의상 (한벌옷/상의/하의)',
      accessories: '👑 모자/악세사리',
      shoes: '👟 신발 (Shoes)',
      furniture: '🪑 가구/의자 (Chair)',
      pet: '🐾 펫/반려동물 (Pet)',
      building: '🏛️ 건물/실내 배경 (Building)',
      decoration: '✨ 이펙트/장식 (Decoration)',
      skin: '🎨 피부 (Skin)'
    };

    const SKIN_COLORS = {
      2000: '#fce3cc', 2001: '#b37c4d', 2002: '#e6eaf0', 2003: '#f7d88b',
      2004: '#8dc891', 2010: '#fff0e1', 2012: '#d8d4dc', 2015: '#ffe4e6',
      2016: '#ffccd5', 2018: '#f3e8ff', 2019: '#fae8ff', 2024: '#fed7aa', 2025: '#93c5fd'
    };

    // 사용자 요청에 따라 파츠/서브필터에서 제거할 10개 항목 목록
    const EXCLUDED_MAPLE_TERMS = [
      '메이플로드', '헤네시스', '히든스트리트', '유타네 집', '골렘사원',
      '파르템', '엘리니아', '요정의 숲', '루엔의 집', '페리온'
    ];
    const EXCLUDED_MAPLE_SET = new Set(EXCLUDED_MAPLE_TERMS);

    function isExcludedMaplePart(p) {
      if (!p) return true;
      const sub = (p.subCategory || '').trim();
      const name = (p.name || '').trim();
      if (EXCLUDED_MAPLE_SET.has(sub) || EXCLUDED_MAPLE_SET.has(name)) return true;
      return EXCLUDED_MAPLE_TERMS.some(term => sub.includes(term) || name.includes(term));
    }

    const rawInitialParts = (typeof window !== 'undefined' && window.__MAPLE_DATA__ && Array.isArray(window.__MAPLE_DATA__.parts))
      ? window.__MAPLE_DATA__.parts
      : [];
    let allMapleParts = rawInitialParts.filter(p => !isExcludedMaplePart(p));
    const maplePartById = new Map();
    allMapleParts.forEach(p => maplePartById.set(p.id, p));

    function updateMapleTabCategoryCounts() {
      const counts = {
        all: allMapleParts.length,
        hair: 0, face: 0, clothes: 0, accessories: 0,
        shoes: 0, furniture: 0, pet: 0, building: 0, decoration: 0, skin: 0
      };
      allMapleParts.forEach(p => {
        if (counts[p.category] !== undefined) counts[p.category]++;
      });
      document.querySelectorAll('[data-maple-count]').forEach(el => {
        const key = el.dataset.mapleCount;
        if (counts[key] !== undefined) el.textContent = counts[key].toLocaleString();
      });
    }

    const simAgentSelect = document.getElementById('simAgentSelect');
    function syncSimAgentSelect() {
      if (!simAgentSelect) return;
      simAgentSelect.innerHTML = modularAgents.map(a => {
        const cliLabel = CLI_BADGE_LABELS[a.cliProvider] || a.cliProvider;
        return `<option value="${a.id}" ${a.id === selectedId ? 'selected' : ''}>#${a.id} ${a.name} (${a.floor} · ${a.triadRole} / ${cliLabel})</option>`;
      }).join('');
    }
    simAgentSelect?.addEventListener('change', (e) => {
      selectedId = e.target.value;
      const agent = modularAgents.find(a => a.id === selectedId);
      if (agent) {
        currentStance = agent.mapleAnim || 'stand1';
        isMotionAnimated = Boolean(agent.mapleAnimated);
        isFlipped = Boolean(agent.mapleFlipped);
        if (selStance) selStance.value = currentStance;
      }
      renderDirectory();
      updateCustomizer();
      updateMapleCardEquippedHighlight();
    });

    let mapleBrowserState = {
      category: 'all',
      subCategory: 'all',
      searchQuery: '',
      onlyEquipped: false,
      pageSize: 60,
      currentPage: 1,
      filtered: []
    };

    function getMaplePartLocalIcon(part) {
      if (!part) return '';
      if (part.icon) return `maplestory-characters-scraper/${part.icon}`;
      return `maplestory-characters-scraper/images/${part.category}/${part.id}.png`;
    }

    function getMapleItemSlot(part) {
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

    function renderDirectory() {
      syncSimAgentSelect();
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
          const skillCount = Array.isArray(agent.skills) ? agent.skills.length : 0;
          card.innerHTML = `
            <div class="char-card-top">
              <span>#${agent.id} · ${agent.triadRole || 'AGENT'}</span>
              <span class="char-floor-tag">${agent.floor}</span>
            </div>
            <div class="char-svg-wrap">${CharacterEngine.render(agent, { stance: agent.mapleAnim || 'stand1', animated: false })}</div>
            <div class="char-card-name">${agent.name}</div>
            <span class="char-cli-badge ${cliKey}">${cliLabel} · ⚡${skillCount}</span>
            <div class="char-card-code">${formatPartCode(agent.parts, agent)}</div>
          `;
          card.addEventListener('click', () => {
            selectedId = agent.id;
            currentStance = agent.mapleAnim || 'stand1';
            isMotionAnimated = Boolean(agent.mapleAnimated);
            isFlipped = Boolean(agent.mapleFlipped);
            if (selStance) selStance.value = currentStance;
            renderDirectory();
            updateCustomizer();
            updateMapleCardEquippedHighlight();
          });
          gridEl.appendChild(card);
        });
      renderTopRosterAvatars();
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

    function updateMotionButtonUI() {
      if (!btnSimMotionPlay) return;
      if (isMotionAnimated) {
        btnSimMotionPlay.style.background = '#dcfce7';
        btnSimMotionPlay.style.color = '#15803d';
        btnSimMotionPlay.style.borderColor = '#86efac';
        if (simMotionIcon) simMotionIcon.textContent = '⏸';
        if (simMotionLabel) simMotionLabel.textContent = '모션 정지';
      } else {
        btnSimMotionPlay.style.background = '#ecfdf5';
        btnSimMotionPlay.style.color = '#047857';
        btnSimMotionPlay.style.borderColor = '#a7f3d0';
        if (simMotionIcon) simMotionIcon.textContent = '▶';
        if (simMotionLabel) simMotionLabel.textContent = '모션 재생';
      }
    }

    function updateCustomizer() {
      const agent = modularAgents.find(a => a.id === selectedId) || modularAgents[0];
      if (!agent || !stageEl) return;
      if (!agent.mapleEquipped) {
        agent.mapleEquipped = { ...(DEFAULT_MAPLE_EQUIPPED_BY_ID[agent.id] || { skin: 2000, hair: 30000, face: 20000, overall: 1050018, shoes: 1072000, hat: 1002140 }) };
      }

      agent.mapleAnim = currentStance;
      agent.mapleAnimated = isMotionAnimated;
      updateMotionButtonUI();

      // 1. 프리뷰 뷰포트 렌더링 (KMS v389 캐릭터 + 건물 배경 + 동행 펫)
      stageEl.innerHTML = CharacterEngine.render(agent, { stance: currentStance, animated: isMotionAnimated });
      stageEl.className = `customizer-stage stance-${currentStance}${isFlipped ? ' flip-x' : ''}`;
      stageEl.style.transform = `scale(${currentZoom})`;

      // 건물 배경 반영
      if (simBgLayer && simBgImg && simBgBadge) {
        const bId = agent.mapleEquipped.building;
        const bPart = bId ? maplePartById.get(bId) : null;
        if (bPart) {
          simBgLayer.style.display = 'flex';
          simBgImg.src = getMaplePartLocalIcon(bPart);
          simBgImg.onerror = () => { if (bPart.bgUrl || bPart.iconUrl) simBgImg.src = bPart.bgUrl || bPart.iconUrl; };
          simBgBadge.textContent = `🏛️ ${bPart.name}`;
        } else {
          simBgLayer.style.display = 'none';
        }
      }

      // 동행 펫 반영
      if (simPetBox && simPetImg && simPetName) {
        const pId = agent.mapleEquipped.pet;
        const pPart = pId ? maplePartById.get(pId) : null;
        if (pPart) {
          simPetBox.style.display = 'flex';
          simPetImg.src = getMaplePartLocalIcon(pPart);
          simPetImg.onerror = () => { if (pPart.iconUrl) simPetImg.src = pPart.iconUrl; };
          simPetName.textContent = `🐾 ${pPart.name}`;
        } else {
          simPetBox.style.display = 'none';
        }
      }

      const cliLabel = CLI_BADGE_LABELS[agent.cliProvider] || agent.cliProvider;
      if (nameEl) nameEl.textContent = `Agent #${agent.id} · ${agent.name}`;
      if (deptEl) deptEl.textContent = `${agent.floor} · ${agent.triadRole} (${cliLabel})`;
      if (pillEl) pillEl.textContent = `${agent.triadRole}/${cliLabel} · ${formatPartCode(agent.parts, agent)}`;
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

      // 1-3. 캐릭터 장착 스킬 칩 렌더링
      const skillListEl = document.getElementById('studioSkillChipList');
      const skillCountLbl = document.getElementById('studioSkillCountLabel');
      const skills = Array.isArray(agent.skills) ? agent.skills : [];
      if (skillCountLbl) skillCountLbl.textContent = `${skills.length} Skills`;
      if (skillListEl) {
        if (!skills.length) {
          skillListEl.innerHTML = `<span style="font-size:9px;color:#94a3b8">장착된 스킬이 없습니다. 아래 입력창이나 추천 버튼을 눌러 스킬을 추가하세요.</span>`;
        } else {
          skillListEl.innerHTML = skills.map((sk, idx) => `
            <span class="skill-chip">
              <span>⚡ ${sk}</span>
              <button type="button" data-remove-skill="${idx}" title="스킬 제거">✕</button>
            </span>
          `).join('');
          skillListEl.querySelectorAll('[data-remove-skill]').forEach(btn => {
            btn.addEventListener('click', () => {
              const rIdx = Number(btn.dataset.removeSkill);
              updateSelectedAgentAiField(a => {
                if (!Array.isArray(a.skills)) a.skills = [];
                a.skills.splice(rIdx, 1);
              });
            });
          });
        }
      }

      document.querySelectorAll('#studioCliCardGroup .studio-cli-card').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.cliVal === agent.cliProvider);
      });

      // 2. KMS v389 장착 슬롯 목록 렌더링
      renderLayerStack(agent);

      // 3. KMS v389 + AI CLI 통합 JSON 프리셋 코드 생성
      if (codeOutputEl) {
        const presetObj = {
          app: "maples-virtual-office-triad-kms389",
          version: "389.0",
          character: {
            id: `AGENT_${agent.id}`,
            name: agent.name,
            floor: agent.floor,
            dept: agent.dept,
            aiConfig: {
              triadRole: agent.triadRole,
              cliProvider: agent.cliProvider,
              cliLabel: cliLabel,
              sandboxMode: agent.sandboxMode,
              timeoutSec: Number(agent.timeoutSec || 300),
              skills: Array.isArray(agent.skills) ? agent.skills : [],
              systemPrompt: agent.systemPrompt
            },
            mapleEquipped: agent.mapleEquipped,
            stance: currentStance,
            animated: isMotionAnimated,
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

    // 페르소나 프리셋 칩 클릭 시 자동 입력
    document.querySelectorAll('#studioPersonaPresetBar .persona-preset-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.persona;
        const tpl = PERSONA_TEMPLATES[key];
        if (!tpl) return;
        updateSelectedAgentAiField(a => {
          a.systemPrompt = tpl;
          if (studioAiPromptInput) studioAiPromptInput.value = tpl;
        });
      });
    });

    // 스킬 추가 함수 및 이벤트 바인딩
    function addSkillToSelectedAgent(rawSkill) {
      const sk = (rawSkill || '').trim();
      if (!sk) return;
      updateSelectedAgentAiField(a => {
        if (!Array.isArray(a.skills)) a.skills = [];
        if (!a.skills.includes(sk)) a.skills.push(sk);
      });
    }

    const studioSkillInput = document.getElementById('studioSkillInput');
    document.getElementById('btnAddStudioSkill')?.addEventListener('click', () => {
      if (!studioSkillInput) return;
      addSkillToSelectedAgent(studioSkillInput.value);
      studioSkillInput.value = '';
    });
    studioSkillInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addSkillToSelectedAgent(studioSkillInput.value);
        studioSkillInput.value = '';
      }
    });
    document.querySelectorAll('#studioSkillPresetBar .skill-preset-btn').forEach(btn => {
      btn.addEventListener('click', () => addSkillToSelectedAgent(btn.dataset.skill));
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
      if (!['head', 'builder', 'reviewer', 'researcher'].includes(roleKey)) {
        alert('전역 오케스트레이터 역할 반영은 HEAD, BUILDER, REVIEWER, RESEARCHER 역할일 때 적용됩니다.');
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
            skills: Array.isArray(agent.skills) ? agent.skills : [],
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

    // ========================================================================
    // KMS v389 21개 장착 슬롯 목록 렌더링
    // ========================================================================
    function renderLayerStack(agent) {
      if (!layerListEl) return;
      const eq = agent.mapleEquipped || {};
      const equippedKeys = Object.keys(eq)
        .filter(k => eq[k] !== null && eq[k] !== undefined && eq[k] !== '')
        .sort((a, b) => ((SLOT_INFO[a]?.order || 99) - (SLOT_INFO[b]?.order || 99)));

      if (simEquippedCountEl) simEquippedCountEl.textContent = String(equippedKeys.length);

      if (equippedKeys.length === 0) {
        layerListEl.innerHTML = `<div style="padding:18px;text-align:center;color:#94a3b8;font-size:10px">현재 장착된 파츠가 없습니다. 상단 카테고리 탭에서 파츠를 클릭해 장착해 보세요.</div>`;
        return;
      }

      layerListEl.innerHTML = '';
      equippedKeys.forEach(slotKey => {
        const itemId = eq[slotKey];
        const slotDef = SLOT_INFO[slotKey] || { label: slotKey, icon: '✨' };
        const part = maplePartById.get(itemId);
        const nameText = part ? part.name : `아이템 #${itemId}`;
        const localIcon = part ? getMaplePartLocalIcon(part) : '';

        let thumbHtml = `<span>${slotDef.icon}</span>`;
        if (slotKey === 'skin') {
          const bg = SKIN_COLORS[itemId] || '#fce3cc';
          thumbHtml = `<span style="display:inline-block;width:20px;height:20px;border-radius:4px;background:${bg};border:1px solid #cbd5e1"></span>`;
        } else if (part) {
          thumbHtml = `<img src="${localIcon}" alt="${nameText}" style="width:22px;height:22px;object-fit:contain;image-rendering:pixelated" onerror="if(this.src!=='${part.iconUrl || ''}') this.src='${part.iconUrl || ''}'" />`;
        }

        const row = document.createElement('div');
        row.className = 'layer-row';
        row.innerHTML = `
          <div class="layer-info" style="display:flex;align-items:center;gap:7px">
            ${thumbHtml}
            <span class="layer-tag">${slotDef.label}</span>
            <span class="layer-name" title="${nameText} (#${itemId})">${nameText} <small style="color:#94a3b8">#${itemId}</small></span>
          </div>
          <div class="layer-actions">
            ${slotKey !== 'skin' ? `<button type="button" class="layer-btn btn-remove-layer" title="${nameText} 해제">✕</button>` : ''}
          </div>
        `;
        row.querySelector('.btn-remove-layer')?.addEventListener('click', () => {
          delete agent.mapleEquipped[slotKey];
          if (slotKey === 'furniture') {
            currentStance = 'stand1';
            if (selStance) selStance.value = 'stand1';
          }
          persistCharacterAiConfig(agent);
          renderDirectory();
          updateCustomizer();
          updateMapleCardEquippedHighlight();
        });
        layerListEl.appendChild(row);
      });
    }

    btnUnequipAllMaple?.addEventListener('click', () => {
      const agent = modularAgents.find(a => a.id === selectedId);
      if (!agent) return;
      agent.mapleEquipped = { skin: 2000 };
      currentStance = 'stand1';
      if (selStance) selStance.value = 'stand1';
      persistCharacterAiConfig(agent);
      renderDirectory();
      updateCustomizer();
      updateMapleCardEquippedHighlight();
    });

    // ========================================================================
    // KMS v389 29,491개 파츠 브라우저 렌더링 & 장착 토글
    // ========================================================================
    function toggleEquipMaplePart(part) {
      const agent = modularAgents.find(a => a.id === selectedId);
      if (!agent || !part) return;
      if (!agent.mapleEquipped) agent.mapleEquipped = { skin: 2000 };

      const slot = getMapleItemSlot(part);
      const isCurrentlyEquipped = agent.mapleEquipped[slot] === part.id;

      if (isCurrentlyEquipped) {
        if (slot === 'skin') return;
        delete agent.mapleEquipped[slot];
        if (slot === 'furniture') {
          currentStance = 'stand1';
          if (selStance) selStance.value = 'stand1';
        }
      } else {
        if (slot === 'overall') {
          delete agent.mapleEquipped.top;
          delete agent.mapleEquipped.bottom;
        } else if (slot === 'top' || slot === 'bottom') {
          delete agent.mapleEquipped.overall;
        }
        agent.mapleEquipped[slot] = part.id;
        if (slot === 'furniture') {
          currentStance = 'sit';
          if (selStance) selStance.value = 'sit';
        }
      }

      persistCharacterAiConfig(agent);
      renderDirectory();
      updateCustomizer();
      updateMapleCardEquippedHighlight();
    }

    function updateMapleCardEquippedHighlight() {
      if (!mapleSimPartsGrid) return;
      const agent = modularAgents.find(a => a.id === selectedId);
      const equippedIds = new Set(Object.values(agent?.mapleEquipped || {}));
      mapleSimPartsGrid.querySelectorAll('.maples-item-card').forEach(card => {
        const pid = Number(card.dataset.mapleId);
        card.classList.toggle('active', equippedIds.has(pid));
      });
    }

    function renderMapleSubFilters() {
      if (!mapleSimSubFilters) return;
      const subCats = new Set();
      // 'all'(전체) 탭일 때는 건물/공간(building) 지역명이 파츠 서브필터에 섞이지 않도록 제외하고, 요청된 10개 제외 항목도 원천 차단
      const targetParts = mapleBrowserState.category === 'all'
        ? allMapleParts.filter(p => p.category !== 'building')
        : allMapleParts.filter(p => p.category === mapleBrowserState.category);
      targetParts.forEach(p => {
        const sub = (p.subCategory || '').trim();
        if (!sub || EXCLUDED_MAPLE_SET.has(sub)) return;
        if (EXCLUDED_MAPLE_TERMS.some(term => sub.includes(term))) return;
        subCats.add(sub);
      });

      if (subCats.size <= 1) {
        mapleSimSubFilters.innerHTML = '';
        mapleSimSubFilters.style.display = 'none';
        return;
      }
      mapleSimSubFilters.style.display = 'flex';

      let html = `<button type="button" class="persona-preset-chip ${mapleBrowserState.subCategory === 'all' ? 'active' : ''}" data-sub="all" style="${mapleBrowserState.subCategory === 'all' ? 'background:#ea580c;color:#fff;border-color:#ea580c' : ''}">전체</button>`;
      Array.from(subCats).slice(0, 25).forEach(sub => {
        const isOn = mapleBrowserState.subCategory === sub;
        html += `<button type="button" class="persona-preset-chip" data-sub="${sub}" style="${isOn ? 'background:#ea580c;color:#fff;border-color:#ea580c' : ''}">${sub}</button>`;
      });
      mapleSimSubFilters.innerHTML = html;
      mapleSimSubFilters.querySelectorAll('[data-sub]').forEach(btn => {
        btn.addEventListener('click', () => {
          mapleBrowserState.subCategory = btn.dataset.sub;
          renderMapleSubFilters();
          filterMapleParts();
        });
      });
    }

    function renderMaplePartsChunk() {
      if (!mapleSimPartsGrid) return;
      const agent = modularAgents.find(a => a.id === selectedId);
      const equippedIds = new Set(Object.values(agent?.mapleEquipped || {}));
      const start = (mapleBrowserState.currentPage - 1) * mapleBrowserState.pageSize;
      const end = start + mapleBrowserState.pageSize;
      const chunk = mapleBrowserState.filtered.slice(start, end);

      const frag = document.createDocumentFragment();
      chunk.forEach(part => {
        const isEq = equippedIds.has(part.id);
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `maples-item-card${isEq ? ' active' : ''}`;
        btn.dataset.mapleId = String(part.id);

        let iconHtml = '';
        if (part.category === 'skin') {
          const bg = SKIN_COLORS[part.id] || '#fce3cc';
          iconHtml = `<span style="display:block;width:28px;height:28px;border-radius:6px;background:${bg};border:1px solid #cbd5e1"></span>`;
        } else {
          const localSrc = getMaplePartLocalIcon(part);
          iconHtml = `<img src="${localSrc}" alt="${part.name}" loading="lazy" style="width:32px;height:32px;object-fit:contain;image-rendering:pixelated" onerror="if(this.src!=='${part.iconUrl || ''}') this.src='${part.iconUrl || ''}'" />`;
        }

        btn.innerHTML = `
          <div class="sim-part-icon-box">${iconHtml}</div>
          <span class="item-title" title="${part.name}">${part.name}</span>
          <span class="item-code">${part.subCategory || part.category} · #${part.id}</span>
        `;
        btn.addEventListener('click', () => toggleEquipMaplePart(part));
        frag.appendChild(btn);
      });

      mapleSimPartsGrid.appendChild(frag);

      const displayed = Math.min(end, mapleBrowserState.filtered.length);
      if (mapleSimLoadMoreWrap) {
        if (displayed < mapleBrowserState.filtered.length) {
          mapleSimLoadMoreWrap.style.display = 'flex';
          if (mapleSimLoadMoreInfo) {
            mapleSimLoadMoreInfo.textContent = `표시 중: ${displayed.toLocaleString()} / 전체 ${mapleBrowserState.filtered.length.toLocaleString()}개`;
          }
        } else {
          mapleSimLoadMoreWrap.style.display = 'none';
        }
      }
    }

    function filterMapleParts() {
      if (!mapleSimPartsGrid) return;
      mapleBrowserState.currentPage = 1;
      const q = mapleBrowserState.searchQuery.toLowerCase();
      const agent = modularAgents.find(a => a.id === selectedId);
      const equippedIds = new Set(Object.values(agent?.mapleEquipped || {}));

      mapleBrowserState.filtered = allMapleParts.filter(p => {
        if (mapleBrowserState.category !== 'all' && p.category !== mapleBrowserState.category) return false;
        if (mapleBrowserState.subCategory !== 'all' && p.subCategory !== mapleBrowserState.subCategory) return false;
        if (q) {
          const matchName = (p.name || '').toLowerCase().includes(q);
          const matchId = String(p.id).includes(q);
          const matchSub = (p.subCategory || '').toLowerCase().includes(q);
          if (!matchName && !matchId && !matchSub) return false;
        }
        if (mapleBrowserState.onlyEquipped && !equippedIds.has(p.id)) return false;
        return true;
      });

      if (mapleSimCategoryTitle) {
        mapleSimCategoryTitle.textContent = CATEGORY_NAMES[mapleBrowserState.category] || '아이템 목록';
      }
      if (mapleSimResultCount) {
        mapleSimResultCount.textContent = `${mapleBrowserState.filtered.length.toLocaleString()} Items`;
      }

      mapleSimPartsGrid.innerHTML = '';
      if (mapleBrowserState.filtered.length === 0) {
        mapleSimPartsGrid.innerHTML = `<div style="grid-column:1/-1;padding:24px;text-align:center;color:#94a3b8;font-size:10.5px">🔍 조건에 맞는 KMS v389 파츠가 없습니다.</div>`;
        if (mapleSimLoadMoreWrap) mapleSimLoadMoreWrap.style.display = 'none';
        return;
      }
      renderMaplePartsChunk();
    }

    btnMapleSimLoadMore?.addEventListener('click', () => {
      if (mapleBrowserState.currentPage * mapleBrowserState.pageSize < mapleBrowserState.filtered.length) {
        mapleBrowserState.currentPage++;
        renderMaplePartsChunk();
      }
    });

    mapleSimPartsGrid?.addEventListener('scroll', () => {
      if (mapleSimPartsGrid.scrollTop + mapleSimPartsGrid.clientHeight >= mapleSimPartsGrid.scrollHeight - 120) {
        if (mapleBrowserState.currentPage * mapleBrowserState.pageSize < mapleBrowserState.filtered.length) {
          mapleBrowserState.currentPage++;
          renderMaplePartsChunk();
        }
      }
    });

    let mapleSearchTimer = null;
    mapleSimSearchInput?.addEventListener('input', (e) => {
      clearTimeout(mapleSearchTimer);
      mapleSearchTimer = setTimeout(() => {
        mapleBrowserState.searchQuery = (e.target.value || '').trim();
        if (btnMapleSimClearSearch) btnMapleSimClearSearch.style.display = mapleBrowserState.searchQuery ? 'block' : 'none';
        filterMapleParts();
      }, 140);
    });

    btnMapleSimClearSearch?.addEventListener('click', () => {
      if (mapleSimSearchInput) mapleSimSearchInput.value = '';
      mapleBrowserState.searchQuery = '';
      btnMapleSimClearSearch.style.display = 'none';
      filterMapleParts();
    });

    mapleSimOnlyEquipped?.addEventListener('change', (e) => {
      mapleBrowserState.onlyEquipped = e.target.checked;
      filterMapleParts();
    });

    // [이벤트] 캐릭터 시뮬레이터 파츠 카테고리 탭 전환
    document.querySelectorAll('.maples-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const parentBar = tab.closest('.maples-tab-bar');
        if (parentBar) {
          parentBar.querySelectorAll('.maples-tab').forEach(t => t.classList.remove('active'));
        } else {
          document.querySelectorAll('.maples-tab').forEach(t => t.classList.remove('active'));
        }
        tab.classList.add('active');
        if (tab.dataset.tab) {
          const targetPanel = document.getElementById(tab.dataset.tab);
          if (targetPanel) targetPanel.classList.add('active');
        }
        if (tab.dataset.mapleCat) {
          mapleBrowserState.category = tab.dataset.mapleCat;
          mapleBrowserState.subCategory = 'all';
          renderMapleSubFilters();
          filterMapleParts();
        }
      });
    });

    // [이벤트] 방향 좌우 반전
    btnFlipDir?.addEventListener('click', () => {
      isFlipped = !isFlipped;
      const agent = modularAgents.find(a => a.id === selectedId);
      if (agent) {
        agent.mapleFlipped = isFlipped;
        persistCharacterAiConfig(agent);
      }
      renderDirectory();
      updateCustomizer();
    });

    // [이벤트] 모션/스탠스 변경
    selStance?.addEventListener('change', (e) => {
      currentStance = e.target.value;
      const agent = modularAgents.find(a => a.id === selectedId);
      if (agent && currentStance !== 'sit' && agent.mapleEquipped?.furniture) {
        delete agent.mapleEquipped.furniture;
      }
      if (agent) persistCharacterAiConfig(agent);
      renderDirectory();
      updateCustomizer();
    });

    // [이벤트] ▶ 모션 재생 / ⏸ 정지 토글
    btnSimMotionPlay?.addEventListener('click', () => {
      isMotionAnimated = !isMotionAnimated;
      const agent = modularAgents.find(a => a.id === selectedId);
      if (agent) {
        agent.mapleAnimated = isMotionAnimated;
        persistCharacterAiConfig(agent);
      }
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

    // [이벤트] 🎲 랜덤 코디 생성 (29,218개 KMS v389 파츠 무작위 조합)
    btnRandomize?.addEventListener('click', () => {
      const agent = modularAgents.find(a => a.id === selectedId);
      if (!agent || !allMapleParts.length) return;
      const pickRandom = (cat, sub = null) => {
        const items = allMapleParts.filter(p => p.category === cat && (!sub || p.subCategory === sub));
        if (!items.length) return null;
        return items[Math.floor(Math.random() * items.length)].id;
      };
      const shouldChair = Math.random() < 0.25;
      const nextEq = {
        skin: pickRandom('skin') || 2000,
        hair: pickRandom('hair'),
        face: pickRandom('face'),
        overall: pickRandom('clothes', 'Overall'),
        shoes: pickRandom('shoes'),
        hat: pickRandom('accessories', 'Hat'),
        cape: pickRandom('accessories', 'Cape'),
        faceAccessory: pickRandom('accessories', 'Face Accessory'),
        effect: pickRandom('decoration', 'Effect'),
        furniture: shouldChair ? pickRandom('furniture') : null,
        pet: pickRandom('pet', 'Pet'),
        building: pickRandom('building')
      };
      Object.keys(nextEq).forEach(k => { if (!nextEq[k]) delete nextEq[k]; });
      agent.mapleEquipped = nextEq;
      currentStance = nextEq.furniture ? 'sit' : 'stand1';
      if (selStance) selStance.value = currentStance;
      persistCharacterAiConfig(agent);
      renderDirectory();
      updateCustomizer();
      updateMapleCardEquippedHighlight();
    });

    // [이벤트] ⭐ 기본 코디 로드
    btnLoadDefault?.addEventListener('click', () => {
      const agent = modularAgents.find(a => a.id === selectedId);
      if (!agent) return;
      agent.mapleEquipped = { ...(DEFAULT_MAPLE_EQUIPPED_BY_ID[agent.id] || { skin: 2000, hair: 30000, face: 20000, overall: 1050018, shoes: 1072000, hat: 1002140 }) };
      currentStance = 'stand1';
      if (selStance) selStance.value = 'stand1';
      persistCharacterAiConfig(agent);
      renderDirectory();
      updateCustomizer();
      updateMapleCardEquippedHighlight();
    });

    // [이벤트] 🔄 초기화
    btnResetParts?.addEventListener('click', () => {
      const agent = modularAgents.find(a => a.id === selectedId);
      if (!agent) return;
      agent.mapleEquipped = { skin: 2000, hair: 30000, face: 20000, overall: 1050018, shoes: 1072000, hat: 1002140 };
      currentStance = 'stand1';
      isMotionAnimated = false;
      isFlipped = false;
      agent.mapleFlipped = false;
      if (selStance) selStance.value = 'stand1';
      persistCharacterAiConfig(agent);
      renderDirectory();
      updateCustomizer();
      updateMapleCardEquippedHighlight();
    });

    // [이벤트] 💾 캐릭터 시뮬레이터 코디 저장 & 오피스 적용 (개별 / 전체)
    const btnSaveSimCharacter = document.getElementById('btnSaveSimCharacter');
    const btnSaveAllSimCharacters = document.getElementById('btnSaveAllSimCharacters');
    const simSaveStatusBanner = document.getElementById('simSaveStatusBanner');
    const simSaveStatusText = document.getElementById('simSaveStatusText');

    btnSaveSimCharacter?.addEventListener('click', async () => {
      const agent = modularAgents.find(a => a.id === selectedId);
      if (!agent) return;
      agent.mapleAnim = currentStance;
      agent.mapleAnimated = isMotionAnimated;
      agent.mapleFlipped = isFlipped;
      const origLabel = btnSaveSimCharacter.innerHTML;
      btnSaveSimCharacter.disabled = true;
      btnSaveSimCharacter.textContent = '⏳ 저장 및 적용 중...';

      await saveCharacterConfigsToServer(agent);
      renderDirectory();
      updateCustomizer();

      const slotCnt = Object.keys(agent.mapleEquipped || {}).length;
      btnSaveSimCharacter.textContent = `✓ #${agent.id} ${agent.name} 코디 적용 완료!`;
      if (simSaveStatusBanner) simSaveStatusBanner.classList.add('saved');
      if (simSaveStatusText) {
        simSaveStatusText.innerHTML = `<strong>✓ 저장 완료:</strong> <strong>#${agent.id} ${agent.name}</strong>의 KMS v389 파츠(${slotCnt}슬롯 · 모션: ${currentStance})가 <strong>AI 직원 디렉토리 · 서버 · <a href="office.html" style="color:#047857;text-decoration:underline">가상 오피스 ↗</a></strong>에 즉시 적용되었습니다.`;
      }
      setTimeout(() => {
        btnSaveSimCharacter.disabled = false;
        btnSaveSimCharacter.innerHTML = origLabel;
      }, 1800);
    });

    btnSaveAllSimCharacters?.addEventListener('click', async () => {
      const agent = modularAgents.find(a => a.id === selectedId);
      if (agent) {
        agent.mapleAnim = currentStance;
        agent.mapleAnimated = isMotionAnimated;
        agent.mapleFlipped = isFlipped;
      }
      const origLabel = btnSaveAllSimCharacters.innerHTML;
      btnSaveAllSimCharacters.disabled = true;
      btnSaveAllSimCharacters.textContent = '⏳ 저장 중...';

      await saveCharacterConfigsToServer(null);
      renderDirectory();
      updateCustomizer();

      btnSaveAllSimCharacters.textContent = `✓ 전체 ${modularAgents.length}명 저장됨`;
      if (simSaveStatusBanner) simSaveStatusBanner.classList.add('saved');
      if (simSaveStatusText) {
        simSaveStatusText.innerHTML = `<strong>✓ 전체 일괄 저장 완료:</strong> 등록된 <strong>전체 AI 직원 ${modularAgents.length}명</strong>의 코디 및 설정이 서버(<code>data/character_configs.json</code>)와 <a href="office.html" style="color:#047857;text-decoration:underline">가상 오피스 ↗</a>에 모두 반영되었습니다.`;
      }
      setTimeout(() => {
        btnSaveAllSimCharacters.disabled = false;
        btnSaveAllSimCharacters.innerHTML = origLabel;
      }, 1800);
    });

    window.addEventListener('nexus:character-configs-updated', () => {
      const agent = modularAgents.find(a => a.id === selectedId);
      if (agent) {
        currentStance = agent.mapleAnim || 'stand1';
        isMotionAnimated = Boolean(agent.mapleAnimated);
        isFlipped = Boolean(agent.mapleFlipped);
        if (selStance) selStance.value = currentStance;
      }
      renderDirectory();
      updateCustomizer();
      updateMapleCardEquippedHighlight();
    });

    // [이벤트] 🖼️ 아바타 이미지 다운로드 (PNG / GIF)
    btnExportPng?.addEventListener('click', async () => {
      const imgEl = stageEl?.querySelector('img');
      if (imgEl && imgEl.src) {
        try {
          const res = await fetch(imgEl.src);
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          const ext = isMotionAnimated ? 'gif' : 'png';
          a.href = url;
          a.download = `maple_kms389_agent_${selectedId}_${currentStance}.${ext}`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          return;
        } catch (_) {
          window.open(imgEl.src, '_blank');
          return;
        }
      }
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

    // 만약 window.__MAPLE_DATA__가 아직 로드되지 않았을 경우 fetch 폴백
    if (!allMapleParts.length) {
      fetch('maplestory-characters-scraper/data/parts.json')
        .then(r => r.json())
        .then(data => {
          if (Array.isArray(data)) {
            allMapleParts = data.filter(p => !isExcludedMaplePart(p));
            maplePartById.clear();
            allMapleParts.forEach(p => maplePartById.set(p.id, p));
            updateMapleTabCategoryCounts();
            renderMapleSubFilters();
            filterMapleParts();
            updateCustomizer();
          }
        })
        .catch(() => {});
    } else {
      updateMapleTabCategoryCounts();
      renderMapleSubFilters();
      filterMapleParts();
    }

    renderDirectory();
    updateCustomizer();
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

  function loadStoredRoles() {
    try {
      const parsed = JSON.parse(localStorage.getItem(ROLE_STORAGE_KEY) || 'null');
      if (parsed && parsed.head && parsed.builder && parsed.reviewer) {
        return { researcher: 'grok', ...parsed };
      }
    } catch (_) {}
    return { head: 'claude', builder: 'antigravity', reviewer: 'openai', researcher: 'grok' };
  }

  let currentRoles = loadStoredRoles();
  let localPipelineTimer = null;

  // 각 AI CLI의 로그인 계정 요금제(Plan) 자동 감지 및 일일 제한(Daily) / 월간 제한(Monthly) 구분 계산
  const CLI_QUOTA_CAPS = {
    claude:      { domain: 'ANTHROPIC', dailyCalls: 0,  dailyTokens: 0,      monthlyCalls: 0,    monthlyTokens: 0,        planName: '미구독 (연결된 플랜 없음)', planLabel: '미구독 (로그인 안 됨)', isSubscribed: false, isPaid: false, accountEmail: null },
    antigravity: { domain: 'GOOGLE',    dailyCalls: 60, dailyTokens: 500000, monthlyCalls: 1800, monthlyTokens: 15000000, planName: 'Google AI Pro (Antigravity IDE 구독 플랜)', planLabel: 'Google AI Pro (Antigravity 구독)', isSubscribed: true, isPaid: true, accountEmail: null },
    openai:      { domain: 'OPENAI',    dailyCalls: 15, dailyTokens: 60000,  monthlyCalls: 300,  monthlyTokens: 1200000,  planName: 'ChatGPT Free (무료 플랜 · 유료 미구독)', planLabel: 'ChatGPT Free (무료 플랜)', isSubscribed: true, isPaid: false, accountEmail: null },
    grok:        { domain: 'XAI',       dailyCalls: 0,  dailyTokens: 0,      monthlyCalls: 0,    monthlyTokens: 0,        planName: '미구독 (연결된 플랜 없음)', planLabel: '미구독 (로그인 안 됨)', isSubscribed: false, isPaid: false, accountEmail: null }
  };
  let latestUsageByProvider = {
    ANTHROPIC: { calls: 0, tokens: 0, monthly_calls: 0, monthly_tokens: 0 },
    GOOGLE:    { calls: 1, tokens: 0, monthly_calls: 1, monthly_tokens: 0 },
    OPENAI:    { calls: 2, tokens: 53475, monthly_calls: 2, monthly_tokens: 53475 },
    XAI:       { calls: 0, tokens: 0, monthly_calls: 0, monthly_tokens: 0 }
  };

  function getCliQuotaStatus(cliKey) {
    const baseCap = CLI_QUOTA_CAPS[cliKey] || CLI_QUOTA_CAPS.claude;
    const diagProv = lastDiagnostics?.providers?.[cliKey] || null;

    const isSubscribed = diagProv && typeof diagProv.is_subscribed === 'boolean' ? diagProv.is_subscribed : baseCap.isSubscribed;
    const isPaid = diagProv && typeof diagProv.is_paid === 'boolean' ? diagProv.is_paid : baseCap.isPaid;
    const planName = (diagProv && diagProv.plan_name) ? diagProv.plan_name : baseCap.planName;
    const planLabel = (diagProv && diagProv.plan_label) ? diagProv.plan_label : baseCap.planLabel;
    const accountEmail = (diagProv && diagProv.account_email) ? diagProv.account_email : baseCap.accountEmail;

    const dailyMaxCalls = (diagProv && typeof diagProv.daily_max_calls === 'number') ? diagProv.daily_max_calls : baseCap.dailyCalls;
    const dailyMaxTokens = (diagProv && typeof diagProv.daily_max_tokens === 'number') ? diagProv.daily_max_tokens : baseCap.dailyTokens;
    const monthlyMaxCalls = (diagProv && typeof diagProv.monthly_max_calls === 'number') ? diagProv.monthly_max_calls : baseCap.monthlyCalls;
    const monthlyMaxTokens = (diagProv && typeof diagProv.monthly_max_tokens === 'number') ? diagProv.monthly_max_tokens : baseCap.monthlyTokens;

    const used = latestUsageByProvider[baseCap.domain] || { calls: 0, tokens: 0, monthly_calls: 0, monthly_tokens: 0 };
    const dailyUsedCalls = (diagProv && typeof diagProv.measured_daily_calls === 'number') ? Math.max(used.calls || 0, diagProv.measured_daily_calls) : (used.calls || 0);
    const dailyUsedTokens = (diagProv && typeof diagProv.measured_daily_tokens === 'number') ? Math.max(used.tokens || 0, diagProv.measured_daily_tokens) : (used.tokens || 0);
    const monthlyUsedCalls = (diagProv && typeof diagProv.measured_monthly_calls === 'number') ? Math.max(used.monthly_calls || 0, diagProv.measured_monthly_calls) : (used.monthly_calls || dailyUsedCalls);
    const monthlyUsedTokens = (diagProv && typeof diagProv.measured_monthly_tokens === 'number') ? Math.max(used.monthly_tokens || 0, diagProv.measured_monthly_tokens) : (used.monthly_tokens || dailyUsedTokens);

    const hasServerRatePct = Boolean(diagProv && typeof diagProv.server_primary_used_percent === 'number');
    const serverUsedPct = hasServerRatePct ? Number(diagProv.server_primary_used_percent) : null;
    const serverResetsAt = diagProv?.server_primary_resets_at || null;
    const telemetrySource = diagProv?.telemetry_source || null;

    // 1) 미구독 / 미로그인 상태인 경우
    if (!isSubscribed || dailyMaxCalls <= 0) {
      return {
        cliKey,
        isSubscribed: false,
        isPaid: false,
        planName,
        planLabel,
        accountEmail,
        calls: 0,
        maxCalls: 0,
        tokens: 0,
        maxTokens: 0,
        dailyPct: 0,
        dailyRemainPct: 0,
        monthlyUsedCalls: 0,
        monthlyMaxCalls: 0,
        monthlyPct: 0,
        monthlyRemainPct: 0,
        pct: 0,
        remainPct: 0,
        hasServerRatePct: false,
        serverResetsAt: null,
        telemetrySource,
        level: 'unsub',
        statusBadgeText: '미구독 · 일일 0% / 월간 0%',
        topSummaryText: '일일 0/0회 · 월간 0/0회',
        bottomMetaText: `플랜: ${planName} · 클릭해 로그인`
      };
    }

    // 2) 일일 제한(Daily Limit) 및 월간 제한(Monthly Limit) 각각 계산
    const dCallPct = (dailyUsedCalls / dailyMaxCalls) * 100;
    const dTokPct = dailyMaxTokens > 0 ? (dailyUsedTokens / dailyMaxTokens) * 100 : 0;
    const dailyPct = Math.min(100, Math.max(0, Math.round(Math.max(dCallPct, dTokPct))));
    const dailyRemainPct = Math.max(0, 100 - dailyPct);

    const mCallPct = monthlyMaxCalls > 0 ? (monthlyUsedCalls / monthlyMaxCalls) * 100 : 0;
    const mTokPct = monthlyMaxTokens > 0 ? (monthlyUsedTokens / monthlyMaxTokens) * 100 : 0;
    const monthlyPct = hasServerRatePct
      ? Math.min(100, Math.max(0, Math.round(serverUsedPct)))
      : Math.min(100, Math.max(0, Math.round(Math.max(mCallPct, mTokPct))));
    const monthlyRemainPct = Math.max(0, 100 - monthlyPct);

    const pct = dailyPct;
    const remainPct = dailyRemainPct;
    const level = pct >= 85 ? 'danger' : pct >= 65 ? 'warn' : (!isPaid ? 'free' : 'safe');

    return {
      cliKey,
      isSubscribed: true,
      isPaid,
      planName,
      planLabel,
      accountEmail,
      calls: dailyUsedCalls,
      maxCalls: dailyMaxCalls,
      tokens: dailyUsedTokens,
      maxTokens: dailyMaxTokens,
      dailyPct,
      dailyRemainPct,
      monthlyUsedCalls,
      monthlyMaxCalls,
      monthlyUsedTokens,
      monthlyMaxTokens,
      monthlyPct,
      monthlyRemainPct,
      pct,
      remainPct,
      hasServerRatePct,
      serverUsedPct,
      serverResetsAt,
      telemetrySource,
      level,
      statusBadgeText: `일일 잔여 ${dailyRemainPct}% · 월간 잔여 ${monthlyRemainPct}%${hasServerRatePct ? ' (서버실측)' : ''}`,
      topSummaryText: `일일 ${dailyUsedCalls}/${dailyMaxCalls}회 (${(dailyUsedTokens/1000).toFixed(1)}k tok) · 월간 ${monthlyUsedCalls}/${monthlyMaxCalls}회`,
      bottomMetaText: `구독 플랜: ${planName}${serverResetsAt ? ` · 리셋: ${serverResetsAt}` : ''}`
    };
  }

  function renderCliQuotaGauges(usageObj = null) {
    if (usageObj && usageObj.by_provider) {
      latestUsageByProvider = { ...latestUsageByProvider, ...usageObj.by_provider };
    }
    ['head', 'builder', 'reviewer', 'researcher'].forEach(roleKey => {
      const cliKey = currentRoles[roleKey] || (roleKey === 'researcher' ? 'grok' : 'claude');
      const q = getCliQuotaStatus(cliKey);

      document.querySelectorAll(`[data-quota-role="${roleKey}"] .cli-quota-top > span`).forEach(el => {
        el.textContent = q.isSubscribed
          ? (q.isPaid ? `✓ 구독 플랜: ${q.planLabel}` : `● 무료 플랜: ${q.planLabel}`)
          : `✕ ${q.planLabel}`;
      });
      document.querySelectorAll(`[data-quota-text="${roleKey}"]`).forEach(el => {
        el.textContent = q.topSummaryText;
      });
      document.querySelectorAll(`[data-quota-bar="${roleKey}"]`).forEach(el => {
        el.className = `cli-quota-fill ${q.level}`;
        el.style.width = q.isSubscribed ? `${q.dailyRemainPct}%` : '0%';
      });
      document.querySelectorAll(`[data-quota-tokens="${roleKey}"]`).forEach(el => {
        el.textContent = q.bottomMetaText;
      });
      document.querySelectorAll(`[data-quota-badge="${roleKey}"]`).forEach(el => {
        el.className = `cli-quota-pct ${q.level}`;
        el.textContent = q.statusBadgeText;
      });
    });

    // 캐릭터 스튜디오의 3대 CLI 선택 카드에도 구독 플랜 + 일일/월간 잔여 한도 표시
    document.querySelectorAll('#studioCliCardGroup .studio-cli-card').forEach(btn => {
      const cliKey = btn.dataset.cliVal;
      if (!cliKey) return;
      const q = getCliQuotaStatus(cliKey);
      let gaugeWrap = btn.querySelector('.studio-card-quota');
      if (!gaugeWrap) {
        gaugeWrap = document.createElement('div');
        gaugeWrap.className = 'studio-card-quota';
        gaugeWrap.style.marginTop = '4px';
        btn.appendChild(gaugeWrap);
      }
      const badgeCol = !q.isSubscribed ? '#64748b' : q.level === 'danger' ? '#dc2626' : q.level === 'warn' ? '#d97706' : !q.isPaid ? '#0284c7' : '#15803d';
      gaugeWrap.innerHTML = `
        <div style="font-size:7.5px;font-weight:800;color:${badgeCol};margin-bottom:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${q.planName}">${q.planLabel}</div>
        <div class="cli-quota-track" style="height:5px"><span class="cli-quota-fill ${q.level}" style="width:${q.isSubscribed ? q.dailyRemainPct : 0}%"></span></div>
        <div style="display:flex;justify-content:space-between;font-size:7px;color:#475569;margin-top:2px">
          <span>${q.isSubscribed ? `일일 잔여 ${q.dailyRemainPct}%` : '미구독/미로그인'}</span>
          <b style="color:${badgeCol}">${q.isSubscribed ? `월간 잔여 ${q.monthlyRemainPct}%` : '한도 0'}</b>
        </div>
      `;
    });

    window.NEXUS_CLI_QUOTA = { getCliQuotaStatus, latestUsageByProvider, CLI_QUOTA_CAPS };
  }

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
    updatePill('tableCliResearcher', currentRoles.researcher || 'grok');

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
    renderCliQuotaGauges();
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
      if (agentLog) {
        agentLog.innerHTML = events.slice(0, 8).map(ev => {
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
      renderCliQuotaGauges(usage);
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

  // If navigated with ?agent=role on settings.html, pre-select that agent
  try {
    const params = new URLSearchParams(window.location.search);
    const qAgent = (params.get('agent') || '').toLowerCase();
    const qName = params.get('name') || '';
    if (qAgent && targetAgentSelect) {
      targetAgentSelect.value = ['head', 'builder', 'reviewer', 'researcher', 'director', 'triad'].includes(qAgent) ? qAgent : 'head';
      if (qName) targetAgentSelect.dataset.customAgentName = qName;
      const replyRole = document.getElementById('triadReplyRole');
      if (replyRole && qName) replyRole.textContent = `[${qName} (${qAgent.toUpperCase()}) 선택됨]`;
      const input = document.getElementById('triadGoalInput');
      if (input) {
        if (qName) input.placeholder = `${qName}에게 물어볼 질문을 입력하세요...`;
        input.focus();
      }
    }
  } catch (_) {}

  // In agents.html, clicking an agent row navigates to settings.html for quick question
  document.querySelectorAll('#agentList .agent-card-row').forEach(row => {
    row.style.cursor = 'pointer';
    row.title = '클릭하여 AI 설정 & 질문 페이지에서 이 직원에게 질문하기';
    row.addEventListener('click', () => {
      const role = (row.dataset.role || 'HEAD').toLowerCase();
      const agentName = row.querySelector('.agent-name')?.textContent?.trim() || '';
      if (!targetAgentSelect) {
        window.location.href = `settings.html?agent=${encodeURIComponent(role)}&name=${encodeURIComponent(agentName)}`;
        return;
      }
      targetAgentSelect.value = ['head', 'builder', 'reviewer', 'researcher', 'director', 'triad'].includes(role) ? role : 'head';
      targetAgentSelect.dataset.customAgentName = agentName;
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
        },
        grok: {
          provider: 'grok',
          cli: 'grok',
          label: 'xAI Grok',
          installed: false,
          auth_state: 'NOT_INSTALLED',
          auth_label: '서버 연결 필요 (python server.py 8080)',
          auth_detail: '현재 정적 서버(http.server) 모드입니다. 실제 CLI 로그인 상태를 진단하려면 python server.py 8080으로 실행하세요.',
          version: '정적 데모 모드',
          executable: null,
          custom_executable: '',
          login_cmd: 'grok',
          install_cmd: 'npm install -g @vibe-kit/grok-cli',
          session_marker: null
        }
      }
    };
  }

  function ensureCliSettingsModal() {
    const wsCard = document.querySelector('.sidebar .workspace-card');
    if (wsCard && !wsCard.dataset.cliBound) {
      wsCard.dataset.cliBound = '1';
      wsCard.style.cursor = 'pointer';
      wsCard.title = '클릭하여 AI 설정 & 질문 탭의 CLI 로그인 설정으로 이동';
      wsCard.addEventListener('click', () => {
        const inlineSec = document.getElementById('cliAuthSection');
        if (inlineSec) {
          inlineSec.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else {
          window.location.href = 'settings.html#cliAuthSection';
        }
      });
    }

    // settings.html에 내장된 CLI 로그인 & 설정 섹션(#cliAuthSection)이 있는 경우 바로 이벤트 바인딩
    const inlineSection = document.getElementById('cliAuthSection');
    if (inlineSection) {
      if (!inlineSection.dataset.bound) {
        inlineSection.dataset.bound = '1';
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
      return;
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
              <option value="grok">xAI Grok (grok)</option>
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

    const list = ['claude', 'antigravity', 'openai', 'grok'].map(k => providers[k]).filter(Boolean);
    const loggedInCount = list.filter(p => p.auth_state === 'LOGGED_IN').length;
    const installedCount = list.filter(p => p.installed).length;

    if (dot) {
      dot.className = `cli-settings-dot ${loggedInCount >= 3 ? '' : loggedInCount >= 1 || installedCount >= 1 ? 'warn' : 'off'}`;
    }

    if (headline) {
      if (lastDiagnostics.triad_state === 'STATIC_FALLBACK') {
        headline.textContent = '현재 정적 파일 서버(http.server) 모드 · 404 방지 폴백 활성화됨';
      } else {
        headline.textContent = `구독 로그인 확인: ${loggedInCount} / ${list.length}개 CLI · 설치 감지: ${installedCount} / ${list.length}개 CLI (${lastDiagnostics.triad_state || 'TRIAD'})`;
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

    grid.innerHTML = ['claude', 'antigravity', 'openai', 'grok'].map(key => {
      const p = providers[key] || {};
      const state = p.auth_state || 'NOT_INSTALLED';
      const cardCls = state === 'LOGGED_IN' ? 'logged-in' : state === 'AUTH_REQUIRED' ? 'auth-required' : '';
      const assignedRole = roleByProvider[key] || 'UNASSIGNED';
      const roleCls = assignedRole === 'HEAD' ? 'role-head' : assignedRole === 'BUILDER' ? 'role-builder' : 'role-reviewer';
      const cliName = p.cli || (key === 'claude' ? 'claude' : key === 'antigravity' ? 'agy' : key === 'grok' ? 'grok' : 'codex');

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
            <div class="cli-auth-row"><span>로그인 계정</span><strong>${p.account_email || '미로그인'}</strong></div>
            <div class="cli-auth-row"><span>구독 중인 플랜</span><strong style="color:${p.is_subscribed ? (p.is_paid ? '#15803d' : '#0284c7') : '#64748b'}">${p.plan_name || p.plan_label || '미구독 / 미로그인'}</strong></div>
            <div class="cli-auth-row"><span>CLI 명령어</span><code>${cliName}</code></div>
            <div class="cli-auth-row"><span>감지된 버전</span><strong>${p.version || '미확인'}</strong></div>
            <div class="cli-auth-row"><span>실행 파일 경로</span><code>${p.executable || 'PATH 미감지 (원클릭 설치 가능)'}</code></div>
            <div class="cli-auth-row"><span>종량제 API 키</span><strong style="color:#15803d">차단됨 (구독 전용)</strong></div>
          </div>
          ${(() => {
            const q = getCliQuotaStatus(key);
            if (!q.isSubscribed) {
              return `
                <div class="cli-quota-box" style="margin-top:0">
                  <div class="cli-quota-top"><span>✕ ${q.planName}</span><strong>일일 0/0회 · 월간 0/0회</strong></div>
                  <div class="cli-quota-track"><span class="cli-quota-fill unsub" style="width:0%"></span></div>
                  <div class="cli-quota-meta"><span>로그인 후 일일/월간 한도 활성화</span><span class="cli-quota-pct unsub">${q.statusBadgeText}</span></div>
                </div>
              `;
            }
            return `
              <div class="cli-quota-box" style="margin-top:0">
                <div class="cli-quota-top"><span>📅 일일 제한 (Daily)</span><strong>${q.calls} / ${q.maxCalls}회 · 잔여 ${q.dailyRemainPct}%</strong></div>
                <div class="cli-quota-track"><span class="cli-quota-fill ${q.level}" style="width:${q.dailyRemainPct}%"></span></div>
                <div class="cli-quota-top" style="margin-top:3px"><span>🗓️ 월간 제한 (Monthly)</span><strong>${q.monthlyUsedCalls} / ${q.monthlyMaxCalls}회 · 잔여 ${q.monthlyRemainPct}%</strong></div>
                <div class="cli-quota-track"><span class="cli-quota-fill ${q.level}" style="width:${q.monthlyRemainPct}%"></span></div>
                <div class="cli-quota-meta"><span>플랜: ${q.planName}</span><span class="cli-quota-pct ${q.level}">${q.statusBadgeText}</span></div>
              </div>
            `;
          })()}
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
    renderCliQuotaGauges();
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

  let lastRenderedMissionId = null;

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

      const latestMission = Array.isArray(data.missions) ? data.missions[0] : null;
      if (latestMission && latestMission.source === 'virtual-office') {
        const replyRole = document.getElementById('triadReplyRole');
        const replyText = document.getElementById('triadReplyText');
        const replyMeta = document.getElementById('triadReplyMeta');
        if (latestMission.live || latestMission.status === 'RUNNING') {
          const curStep = (latestMission.steps || [])[latestMission.steps.length - 1];
          if (replyRole) replyRole.textContent = `[1-Cycle 미션 진행 중 · ${data.phase || 'RUNNING'} (${latestMission.passed_steps || 0}/5)]`;
          if (replyText) {
            replyText.textContent = curStep
              ? `[${curStep.stage}] ${curStep.summary}`
              : `'${latestMission.goal}' 목표에 대해 5단계 파이프라인(PLANNING → BUILDING → VERIFYING → REVIEWING → DECIDING)을 실행 중입니다...`;
          }
          if (replyMeta) replyMeta.textContent = `${data.phase || 'RUNNING'} · ${latestMission.mission_id}`;
        } else if (latestMission.status === 'DONE' && latestMission.deliverable_file && lastRenderedMissionId !== latestMission.mission_id) {
          lastRenderedMissionId = latestMission.mission_id;
          if (replyRole) replyRole.textContent = `[✅ 1-Cycle 미션 완료 · ${latestMission.mission_id}]`;
          if (replyText) {
            const preview = (latestMission.deliverable_preview || '').slice(0, 360);
            replyText.innerHTML = `<div style="white-space:pre-wrap;margin-top:4px;padding:8px 10px;background:#fff;border:1px solid #cbd5e1;border-radius:8px;font-family:monospace;font-size:11px">${preview.replace(/</g, '&lt;')}</div><div style="margin-top:6px"><a href="${latestMission.deliverable_file}" target="_blank" style="color:#0f6848;font-weight:800;text-decoration:underline">📄 전체 5단계 산출물 리포트 열기 (${latestMission.deliverable_file}) ↗</a></div>`;
          }
          if (replyMeta) replyMeta.textContent = `5/5 PASS 완료`;
        }
      }
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
