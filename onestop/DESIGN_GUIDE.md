# 프론트엔드 디자인 기준서 (UI Design Guide)

> 이 문서는 시스템 프론트엔드 화면을 만들 때 **반드시 따라야 하는 디자인 기준**입니다.
> 화면 작업 시 이 문서의 토큰·컴포넌트·규칙을 그대로 사용하고, 여기에 없는 값을 임의로 만들지 마세요.
> 새 값이 필요하면 작업 후 "추가 토큰 제안"으로 보고합니다.

> **변경 기록:** 글꼴은 Pretendard 대신 **Noto Sans KR**(앱에 포함)을 사용합니다. 글자 크기는 고령 직원을 위해 한 단계 크게 유지합니다.

- 디자인 콘셉트: **소프트 UI** — 밝은 라벤더 그레이 배경 + 흰 카드 + 보라/핑크 그라데이션 포인트
- 기준 플랫폼: 모바일 우선(기준 폭 375px), 태블릿/웹은 §8 반응형 규칙 적용
- 수치는 참고 샘플에서 추출한 기준값입니다. 디자이너 확정 시 §2 토큰 값만 교체합니다.

---

## 0. 작업 지시 요약 (필수 규칙)

1. **색·크기·간격·라운드·그림자는 §2 토큰(CSS 변수)만 사용**한다. 하드코딩 HEX/px 금지.
2. **강조색(보라 그라데이션)은 화면당 1~2개 요소에만** 쓴다. (선택된 항목, 현재 진행 중 항목, 주 CTA, FAB)
3. **구분선(border)으로 영역을 나누지 않는다.** 흰 카드와 배경의 명도 차 + 옅은 그림자로 구분한다.
4. 모든 화면은 **헤더 → 스크롤 콘텐츠 → 하단 고정 영역** 3단 구조를 따른다.
5. 텍스트 위계는 **제목(진한색) / 보조정보(회색)** 2단계만 사용한다.
6. 모든 상태(선택·포커스·눌림·비활성·오류)를 §6 상태 규칙대로 구현한다.
7. 접근성 기준(§7)을 통과하지 못하면 완료로 보지 않는다.

---

## 1. 디자인 원칙

| 원칙 | 구현 기준 |
| --- | --- |
| 강조는 컬러 블록 하나로 | 나머지는 흰 카드 + 회색 텍스트. 컬러 카드가 3개 이상 한 화면에 보이면 재검토 |
| 선 대신 면과 그림자 | `border` 사용은 포커스·오류 상태와 점선 추가 버튼에만 허용 |
| 큰 라운드 | 카드·필드·버튼 12~20px, 아바타·FAB·아이콘 버튼은 원형 |
| 넉넉한 여백 | 좌우 20px, 요소 간 12~16px, 섹션 간 24~32px |
| 2단 텍스트 위계 | `--text-primary` / `--text-secondary` 외 텍스트 색 금지 (컬러 카드 위 흰색 제외) |
| 일관된 하단 내비 | 메인 화면 = 하단 탭바 + 중앙 FAB / 입력 화면 = 탭바 숨김 + 하단 전폭 CTA |

---

## 2. 디자인 토큰

아래 블록을 전역 스타일(`tokens.css` 등)에 그대로 넣어 사용합니다.

```css
:root {
  /* ===== Color ===== */
  --color-primary-start: #8E6BBF;
  --color-primary-end:   #6E4FA8;
  --color-primary:       #7E5DB4;               /* 단색이 필요할 때 */
  --color-primary-soft:  #B9A2DA;
  --gradient-primary: linear-gradient(135deg, var(--color-primary-start), var(--color-primary-end));

  --color-accent-start:  #F28DA6;
  --color-accent-end:    #EE6E8F;
  --color-accent-line:   #EC7A98;               /* 현재시간 라인, 오류 테두리 */
  --gradient-accent: linear-gradient(135deg, var(--color-accent-start), var(--color-accent-end));

  --color-bg:       #EEEFF6;                    /* 앱 배경 */
  --color-surface:  #FFFFFF;                    /* 카드, 시트 */
  --color-field:    #F3F4F9;                    /* 입력 필드, 미선택 칩/날짜 */

  --text-primary:   #1F1D2B;
  --text-secondary: #6E6E82;                    /* 샘플(#9A9AAE)보다 진하게 조정: 대비 4.5:1 확보 */
  --text-disabled:  #A9A9BA;
  --text-on-color:  #FFFFFF;
  --text-on-color-sub: rgba(255,255,255,0.8);

  /* 상태 색 (샘플에 없음 — 업무 시스템용 보완) */
  --color-success: #2EAD7A;
  --color-warning: #F2A33A;
  --color-danger:  var(--color-accent-line);

  /* ===== Typography ===== */
  --font-family: "Pretendard", "Poppins", -apple-system, sans-serif;
  --fs-title-l: 20px;  --fw-title-l: 600;
  --fs-title-m: 16px;  --fw-title-m: 600;
  --fs-body-m:  14px;  --fw-body-m:  500;
  --fs-body-s:  13px;  --fw-body-s:  400;
  --fs-caption: 12px;  --fw-caption: 400;
  --fs-badge:   10px;  --fw-badge:   500;
  --lh-tight: 1.3;
  --lh-normal: 1.5;

  /* ===== Spacing (4px 단위) ===== */
  --space-1: 4px;  --space-2: 8px;  --space-3: 12px; --space-4: 16px;
  --space-5: 20px; --space-6: 24px; --space-8: 32px;
  --page-padding-x: var(--space-5);
  --gap-item: var(--space-3);       /* 카드-카드, 필드-필드: 12~16 */
  --gap-section: var(--space-6);    /* 섹션 간: 24~32 */

  /* ===== Radius ===== */
  --radius-s: 8px;     /* 배지, 칩 */
  --radius-m: 12px;    /* 입력 필드, 아이콘 박스, 날짜 셀 */
  --radius-l: 18px;    /* 카드, CTA */
  --radius-xl: 30px;   /* 화면 시트, 하단 탭바 상단 */
  --radius-full: 9999px;

  /* ===== Shadow ===== */
  --shadow-card:   0 8px 24px rgba(110, 79, 168, 0.08);
  --shadow-accent: 0 10px 24px rgba(110, 79, 168, 0.30);   /* 컬러 카드, FAB, CTA */
  --shadow-accent-pink: 0 10px 24px rgba(238, 110, 143, 0.30);

  /* ===== Size ===== */
  --header-height: 56px;
  --tabbar-height: 64px;
  --fab-size: 56px;
  --field-height: 48px;
  --cta-height: 52px;
  --touch-min: 44px;

  /* ===== Motion ===== */
  --duration-fast: 150ms;
  --duration-base: 300ms;
  --easing: cubic-bezier(0.2, 0, 0, 1);
}
```

### 2-1. 타이포그래피 사용처

| 스타일 | 토큰 | 사용처 |
| --- | --- | --- |
| Title.L | `--fs-title-l` / 600 | 인사말 이름, 화면 타이틀 |
| Title.M | `--fs-title-m` / 600 | 섹션 제목, 일정 카드 제목, 날짜 숫자 |
| Body.M | `--fs-body-m` / 500 | 리스트 제목, 폼 라벨, 버튼 |
| Body.S | `--fs-body-s` / 400 | 입력값, 서브 타이틀, 칩 |
| Caption | `--fs-caption` / 400 | 날짜·시간, 시간축, "전체보기", 요일 |
| Badge | `--fs-badge` / 500 | 남은기간 배지, 현재시간 배지, 진행률 % |

### 2-2. 금지 사항

- 토큰에 없는 색상, 임의의 그림자(`box-shadow: 0 2px 4px #000` 등) 사용 금지
- 그라데이션은 `--gradient-primary`, `--gradient-accent` 두 가지만 사용
- 폰트 굵기 700 이상 사용 금지 (최대 600)

---

## 3. 레이아웃

### 3-1. 화면 3단 구조

```
┌──────────────────────────┐
│ Header (56px, 고정)        │  ← C01 인사 헤더 또는 C02 내비 헤더
├──────────────────────────┤
│                          │
│ Content (세로 스크롤)       │  ← 좌우 패딩 20px, 1열
│                          │
├──────────────────────────┤
│ Bottom (고정)              │  ← 메인: C14 탭바 + FAB / 입력: C15 CTA
└──────────────────────────┘
```

| 영역 | 규칙 |
| --- | --- |
| Header | 높이 56px, safe area 아래 고정, 배경 투명(=앱 배경) |
| Content | 1열, 좌우 `--page-padding-x`, 하단에 Bottom 높이만큼 여백 확보 |
| 가로 스크롤 영역 | 프로젝트 카드·데이트 피커는 **오른쪽 패딩 없이** 화면 밖으로 이어지게 하여 스크롤 가능함을 암시, `scroll-snap` 적용 |
| Bottom | 메인 화면: 탭바 64px + safe area / 입력 화면: CTA 52px + 상하 16px + safe area |

### 3-2. 화면 유형별 패턴

| 유형 | 구성 순서 | 적용 대상 예 |
| --- | --- | --- |
| **대시보드** | C01 인사 헤더 → C03 검색바 → C04 섹션 헤더 + C05 카드 가로 스크롤 → C04 섹션 헤더 + C06 리스트 → C14 | 업무 현황 홈, 사업부별 요약 |
| **타임라인** | C02 내비 헤더 → 월·연도 → C07 데이트 피커 → C08 타임라인(C09 카드 + C10 현재시간) → C14 | 예약·방문 일정, 담당자 스케줄 |
| **입력 폼** | C02 내비 헤더 → C11 필드들(라벨 위/입력 아래) → C12 담당자 선택 → C13 칩 → C15 CTA (탭바 숨김) | A/S 접수, 상담 등록, 일정 등록 |
| **목록** (확장) | C02 내비 헤더 → C03 검색바 → 필터 칩(C13) → C06 리스트 → C14 | 신청 목록, 이력 조회 |
| **상세** (확장) | C02 내비 헤더 → 요약 컬러 카드 1개 → 흰 카드 섹션들 → 하단 CTA(필요 시) | 건별 상세 |

> 확장 유형은 샘플에 없는 화면이며, 위 컴포넌트 조합으로만 만든다.

---

## 4. 컴포넌트 명세

컴포넌트 ID(C01~C15)를 코드 컴포넌트명·주석에 함께 표기합니다. (예: `// C06 TaskListItem`)

| ID | 컴포넌트 | 구조 | 스타일 기준 |
| --- | --- | --- | --- |
| C01 | GreetingHeader | 원형 프로필 40px + 2줄 텍스트(Title.L / Body.S secondary) + 우측 알림 아이콘 버튼 | 배경 없음 |
| C02 | NavHeader | 좌 뒤로가기 + 중앙 타이틀(Title.L) + 우 액션 아이콘(검색/알림) | 높이 56px, 타이틀 중앙 정렬, 아이콘 터치영역 44px |
| C03 | SearchBar | 돋보기 아이콘 + 입력 | `--color-surface`, `--radius-m`, 높이 44px, `--shadow-card` |
| C04 | SectionHeader | 좌 제목(Title.M) + 우 "전체보기"(Caption, secondary) | 하단 간격 12px |
| C05 | ProjectCard | 상단: 배지 + ⋮ / 중단: 제목 최대 2줄 / 하단: 아바타 겹침 + 진행률 라벨 + 프로그레스 바 | 약 150×160px, `--gradient-primary` 또는 `--gradient-accent`, `--radius-l`, `--shadow-accent`, 텍스트 흰색 |
| C06 | TaskListItem | 좌 아이콘 박스 48px(그라데이션, `--radius-m`) + 제목(Body.M) / 일시(Caption) + 우 ⋮ | `--color-surface`, `--radius-l`, 패딩 16px, `--shadow-card`, 아이콘 색은 primary·accent 교차 |
| C07 | DatePickerStrip | 요일 약어(Caption) + 날짜(Title.M) 셀 가로 나열 | 셀 52×64px, `--radius-m`, 미선택 `--color-field` / 선택 `--gradient-primary` + 흰 글자 + `--shadow-accent` |
| C08 | Timeline | 좌 시간축(폭 48px, Caption) + 우 카드 열 | 1시간 = 64px 높이, 카드는 시작~종료 시간에 맞춰 높이 계산 |
| C09 | EventCard | 제목(Title.M) + 설명(Caption) + 아바타 겹침 + 시간 범위 + ⋮ | 진행 중: `--gradient-primary` + 흰 글자 / 그 외: 흰 카드 |
| C10 | NowIndicator | 시간 배지(pill, `--color-accent-line` 배경, 흰 글자 Badge) + 가로 라인 1px | 타임라인 전체 폭을 가로지름, 1분마다 위치 갱신 |
| C11 | FormField | 라벨(Body.M) + 입력 박스 | `--color-field`, 테두리 없음, `--radius-m`, 높이 48px (멀티라인 최소 96px) |
| C12 | AvatarPicker | 원형 아바타 48px 나열 + 점선 원형 추가(+) 버튼 | 간격 16px, 아바타 배경 primary/accent 교차, 추가 버튼은 바텀시트로 멤버 선택 |
| C13 | Chip | 텍스트 칩 | 높이 40px, `--radius-m`, 미선택 `--color-field` + secondary / 선택 `--color-primary` + 흰 글자 |
| C14 | BottomTabBar + FAB | 탭 4개(홈/통계/캘린더/설정) + 중앙 FAB(+) | 바: 흰색, 상단 `--radius-xl`, `--shadow-card` / FAB: 56px 원형, `--gradient-primary`, `--shadow-accent`, 바 위로 돌출 |
| C15 | PrimaryButton (CTA) | 전폭 텍스트 버튼 | 높이 52px, `--gradient-primary`, `--radius-l`, 흰 글자 Body.M 600, `--shadow-accent` |

**공통 보조 요소**

- **AvatarGroup**: 24px 원 최대 3개, -8px 겹침, 흰 테두리 2px, 초과 시 `+N` 표시
- **Badge**: `--radius-s`, 컬러 카드 위에서는 `rgba(255,255,255,0.25)` 배경 + 흰 글자
- **ProgressBar**: 높이 4px, 트랙 `rgba(255,255,255,0.3)`, 채움 흰색, 라운드 full
- **IconButton**: 아이콘 24px, 터치영역 44×44px, 색 `--text-primary`

---

## 5. 아이콘·이미지

- 아이콘: 라인형(stroke 1.5~2px), 24px 기준, 라운드 캡. 하나의 오픈소스 세트로 통일 (예: Lucide, Phosphor)
- 탭바 활성 아이콘은 채움(filled) 또는 `--text-primary`, 비활성은 `--text-secondary`
- 프로필 이미지가 없을 때는 그라데이션 원 + 이니셜 또는 기본 인물 아이콘

---

## 6. 상태(State) 규칙

**한 줄 원칙: "선택·활성 = 보라 그라데이션, 나머지 = 흰색 / 필드 회색"**

| 컴포넌트 | 기본 | 선택/활성 | 눌림 | 포커스 | 비활성 | 오류 |
| --- | --- | --- | --- | --- | --- | --- |
| 날짜 셀 C07 | field 배경 | gradient-primary + 흰 글자 | 배경 5% 어둡게 | 2px primary 외곽선 | 글자 disabled | — |
| 일정 카드 C09 | 흰 카드 | 진행 중 → gradient-primary | scale(0.98) | 2px primary 외곽선 | 지난 일정 opacity 0.5 | — |
| 탭바 C14 | secondary 아이콘 | primary 텍스트 색 + filled | — | 2px primary 외곽선 | — | — |
| 폼 필드 C11 | field, 테두리 없음 | — | — | 1.5px `--color-primary` 테두리 | 글자 disabled | 1.5px `--color-danger` 테두리 + 하단 안내문(Caption, danger) |
| 아바타 C12 | 원형 | 2px primary 링 + 체크 아이콘 | scale(0.96) | 2px primary 외곽선 | opacity 0.4 | — |
| 칩 C13 | field + secondary | primary 배경 + 흰 글자 | 배경 5% 어둡게 | 2px primary 외곽선 | opacity 0.4 | — |
| CTA C15 | gradient-primary | — | 밝기 90% | 2px primary 외곽선(offset 2px) | opacity 0.4, 클릭 불가 | — |

**빈 상태 / 로딩**

- 빈 목록: 중앙 정렬 아이콘(48px, primary-soft) + 안내 문구(Body.S secondary) + 필요 시 보조 버튼
- 로딩: 카드 모양 스켈레톤(`--color-field` 배경, 은은한 shimmer), 스피너 단독 사용 지양

**모션**

- 탭/눌림 피드백: `--duration-fast`
- 화면 전환, 바텀시트, 진행률 바(0 → 값): `--duration-base`, `--easing`
- `prefers-reduced-motion` 설정 시 애니메이션 제거

---

## 7. 접근성 기준 (완료 조건)

- [ ] 일반 텍스트 대비 4.5:1 이상 (`--text-secondary` 조정값 사용)
- [ ] 그라데이션 위 흰 텍스트는 밝은 쪽(`--color-primary-start`) 기준으로 대비 확인
- [ ] 모든 아이콘 버튼(⋮, 알림, 뒤로가기, 탭바, FAB) 터치영역 44×44px 이상 + `aria-label`
- [ ] 상태를 색만으로 구분하지 않음 (선택 시 굵기·체크 아이콘 등 병행)
- [ ] 키보드 포커스가 모든 인터랙티브 요소에 보임 (§6 포커스 스타일)
- [ ] 폼 필드는 `<label>`과 연결, 오류 문구는 `aria-describedby`로 연결

---

## 8. 반응형 · 확장 규칙

| 구간 | 기준 |
| --- | --- |
| 모바일 (< 768px) | 이 문서 기본값 |
| 태블릿 (768~1199px) | 하단 탭바 유지 또는 좌측 아이콘 레일, 카드 가로 스크롤 → 2열 그리드 |
| 데스크톱/관리자 (≥ 1200px) | 하단 탭바 → 좌측 사이드바(폭 240px), 콘텐츠 최대 폭 1200px, 카드 3~4열 그리드, 폼은 최대 폭 640px 중앙 정렬, CTA는 전폭 대신 우측 정렬 버튼 |

**한글 처리**

- 카드 제목 최대 2줄 + 말줄임(`-webkit-line-clamp: 2`), 리스트 제목 1줄 말줄임
- `word-break: keep-all` 적용

**다크모드 (선택)**

- `--color-bg: #16151F`, `--color-surface: #22212E`, `--color-field: #2C2B3A`, 텍스트는 반전, 그라데이션은 유지

---

## 9. 작업 완료 체크리스트

- [ ] 하드코딩된 색상/px 없이 §2 토큰만 사용했다
- [ ] 화면당 강조색(그라데이션) 요소가 1~2개다
- [ ] 화면이 헤더 → 콘텐츠 → 하단 고정 3단 구조다
- [ ] 사용한 컴포넌트에 C-ID가 표기되어 있다
- [ ] §6 상태(선택·눌림·포커스·비활성·오류)를 모두 구현했다
- [ ] 빈 상태와 로딩 상태를 구현했다
- [ ] §7 접근성 체크를 통과했다
- [ ] 375px / 768px / 1280px 폭에서 깨짐이 없다

---

## 10. 참고 및 주의

- 참고 샘플은 Shutterstock 워터마크가 있는 스톡 이미지입니다. **레이아웃과 패턴만 참고**하고, 샘플 이미지·아이콘·일러스트를 산출물에 그대로 사용하거나 화면을 동일하게 복제하지 않습니다.
- 폰트·아이콘은 상용 무료 라이선스(Pretendard, Lucide 등)를 사용합니다.
- 토큰 값 변경은 이 문서 §2만 수정하고, 컴포넌트 코드에서는 변수명만 참조합니다.
