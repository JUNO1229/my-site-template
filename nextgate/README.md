# 넥스트에너지(nextgate.kr) 상품 수집·분석

모두의티켓 기관제휴중개 영업 기획용. 넥스트에너지 판매사이트 전체 상품을 수집해 상품 구성·가격 기준선·공략 시설·빈 카테고리를 분석했다.

## 산출물

| 파일 | 내용 |
| --- | --- |
| `data/nextgate_products.csv` | 상품 1행 (91행, UTF-8-BOM) |
| `data/nextgate_options.csv` | 옵션 1행 (268행, UTF-8-BOM) |
| `data/archive/` | 직전 수집본 (2026-09-30: 상품 100행·옵션 306행). `analyze.py`가 변동 비교에 사용 |
| `data/nextgate_products.xlsx` | 시트: 상품목록 / 옵션 / 카테고리요약 / 전북·충남 / 워터파크 / 발권대행사 (요약 시트는 COUNTIFS·AVERAGEIFS·MEDIAN 수식, 열 때 자동 재계산) |
| `analysis/report.md` | 분석 1~7 + 8. 직전 수집 대비 변동 |
| `export/` | 약식 보고서(모두패스 디자인 기준 v1.1): HTML·PDF·기획용 원고 md, 생성 스크립트 `build_report.py` |
| `raw/` | 원본: `list/`(목록 JSON, 전체 + 소분류 15개), `detail/`(상세 HTML 91개), `logs/`(요청 로그), `state.json`(진행 상태), `probe/`(구조 파악 단계 원본) |
| `samples/` | 파서 검증용 저장본 (샘플 상세 4개, 테마파크 목록) |
| `collect.py` / `parse.py` / `analyze.py` | 수집 / 변환·교차검증 / 분석 |

실행 순서: `python3 collect.py full` → `python3 parse.py full` → `python3 analyze.py` → `python3 export/build_report.py --fonts <Pretendard woff2 폴더> --pdf`

재수집 전에는 현재 `data/*.csv`를 `data/archive/*_YYYYMMDD.csv`로 복사하고 `raw/list`, `raw/detail`, `raw/state.json`을 지운다.

## 수집 방법

- **수집 일시**: 2026-11-06 09:20~09:25 (컨테이너 시각 기준). 직전 수집 2026-09-30 04:38~04:43
- **입장**: 사이트 로고 링크 `/?CD=1707897200`로 세션에 행사코드를 잡은 뒤(`eventCodeAjax`) 조회.
  행사코드 없이 `/`에 접속하면 빈 페이지가 나온다(이 때문에 처음에는 차단으로 오인).
- **목록**: POST `cartListAjax` → JSON. 페이지네이션 없이 한 번에 전체가 온다. 전체 1회 + 소분류 15개 각 1회.
- **상세**: POST `cartProduct` (`idx_eventProduct`) → HTML. 상품 91개.
- **요청**: 11/06 수집 109건 (9/30 수집 118건, 구조 파악 약 20건·샘플 7건 별도), 간격 2~3초, 동시 1개, 재시도 최대 2회. 전부 HTTP 200.
- **보내지 않은 요청**: `viewCountUp`, `viewCountUpProduct`(조회수), `miniCart`, `cartReset`, `checkStockAjax`, 주문·로그인·문의.
  `collect.py`의 허용 목록(`ALLOWED`) 밖 요청은 코드에서 막는다.

## 변환 규칙 (parse.py)

- 상세 HTML과 목록 JSON을 교차검증(상품명·대표가격·옵션 수) → 불일치 0건.
- 대표가격·기준 권종 = 사이트에 표시되는 첫 번째 옵션. 할인율 = 사이트 표기값.
- 유효기간 = 화면에 최종 표시되는 값(상세 페이지 JS `makeUseDate` 규칙을 옵션 데이터로 재현).
  HTML 정적 표기는 `validity_static` 열에 참고용으로 남김.
- issue_type: 안내문 `예약대기` → 예약대기 / 뱃지 `바로 사용가능` → 즉시발송 / `예약필수` / `수령 후 사용 가능` → 수령후사용 / `광고상품`.
- issue_channel: 안내문 `발송채널 : ○○`. issue_medium: 알림톡 / LMS 문자 / 순차 발송.
- 지역 → 시도·권역: 상품명 `[지역]` 태그 기준(없으면 시설 주소). 복수 지역 상품은 해당 권역마다 셈.

## 제외·실패

- **수집 실패: 0건.** 상품 91개 모두 목록·상세 확보.
- **가격 통계 제외 6개** (광고상품·가격 없음, 사이트에서 결제하지 않고 외부 상담으로 연결):
  삼성미라클안과 라식·라섹, 서울베스트의료의원 건강검진, 레포츠파크, 현대자동차(제네시스), 아라마리나 요트투어, 노량진 충남상회 모듬회.
  상품 수·지역·발권 집계에는 포함.
- **소분류 수**: 작업지시서에는 18개로 적혀 있으나 사이트 소분류는 15개(작업지시서의 목록도 합계 15개).
- 복수 카테고리 상품: 없음(소분류 목록 합계 = 전체 91개).

## 알려진 한계

- 수집 시점 스냅샷이다. 30일 안에 유효기간이 끝나는 상품이 13개(그중 11/30 종료 12개)라 12월 목록이 달라질 수 있다.
- 직전 수집 대비 '같은 상품'은 지역 태그+상품명 일치로 판정한다(사이트 상품 번호가 바뀌는 경우가 있음).
- usage_method·refund_rule은 안내문 키워드 기반 요약이다. 원문은 `notice_text`·`refund_text` 열.
- 과거 워터파크 매출 순위·금액은 작업지시서 제공 정보이며 수집 데이터가 아니다.
- 엑셀 수식은 LibreOffice를 이 환경에서 실행할 수 없어 pycel로 검증했다(MEDIAN·COUNTA 등 pycel 미지원 함수는 Python 계산값과 대조).
