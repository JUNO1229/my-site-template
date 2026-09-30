# nextgate.kr 상품 수집 — 진행 기록

## 2026-09-30 단계 1 (구조 파악) — 중단

- 네트워크 허용 후 `robots.txt`는 정상 응답(200, 전체 허용).
- 메인 `https://nextgate.kr/`(www 포함)는 HTTP 200이지만 본문이 **빈 줄 6바이트**뿐. 쿠키·브라우저 UA를 붙여도 같음.
- `/index`, `/main`, `/cartList` → 404 에러 페이지. `/cartProduct`(파라미터 없음) → 500.
- Playwright(Chromium)로는 메인 요청이 프록시에서 502("upstream request failed").
- 판단: 이 환경(해외 클라우드 IP)에는 사이트가 빈 페이지를 주는 것으로 보임(해외 IP 차단 추정, 미확인).
  작업지시 원칙에 따라 우회하지 않고 중단.
- 보낸 요청: 약 14건, 간격 3초. 조회수(`viewCountUp*`)·장바구니(`miniCart`, `cartReset`) 요청 0건.

원본 응답: `raw/probe/`. 탐색 스크립트: `probe.py`.

## 2026-09-30 단계 1 재개 — 구조 파악 완료

빈 페이지의 원인은 IP 차단이 아니라 **행사코드(CD) 세션**이었다. 사이트 로고 링크 `/?CD=1707897200`로 들어가면
세션에 행사코드가 잡히고 정상 페이지가 나온다(사이트 자체 링크 사용, 우회 아님).

| 용도 | 요청 | 응답 |
| --- | --- | --- |
| 입장 | GET `/?CD=1707897200` → POST `eventCodeAjax` (CD) | HTML / 빈 응답 |
| 목록 | POST `cartListAjax` (searchDiv, categoryDiv, categorySubDiv, searchWord) | **JSON 배열, 페이지네이션 없음** |
| 상세 | POST `cartProduct` (idx_eventProduct) | HTML (목록 JSON과 같은 정보 + 뱃지 표시) |
| 상세 보조 | POST `eventProductAjax` (idxEventProduct) | 유효기간 표시용 |

- 상품 ID: `idx_eventProduct`. 옵션 ID: `idx_eventDetail`.
- 목록 JSON 한 건에 상품명·지역·한줄소개(sale_exp)·안내문(contents)·환불규정(ref_guide)·시설정보(enter_info)·
  ticket_type/ticket_div(뱃지)·ticket_limit(구매제한)·옵션 전체(정상가·판매가·할인율·기간·주중/주말·대소)가 들어 있다.
- 대표가격 = 옵션 목록의 **첫 번째 옵션** (`productMake.js`에서 최고할인 옵션 선택 코드는 주석 처리됨).
- 전체 조회 1회: 상품 100개, 옵션 306개. 테마파크 소분류 45개(수동 조사와 일치).
- 원본: `raw/probe/list_all.json`, `raw/probe/detail_329434.html`, `raw/probe/productMake.js`.

## 2026-09-30 단계 3 샘플 검증

`python3 collect.py samples` (요청 7건) → `samples/` / `python3 parse.py samples` → `samples/parsed_samples.json`, `samples/테마파크_목록_parsed.csv`

- 샘플 4개(한국민속촌, 볼베어파크, 2호선세입자, 스파도고 캐빈파크): 상세 HTML ↔ 목록 JSON 교차검증 경고 0건
  (상품명·대표가격·옵션 수·유효기간 모두 일치)
- 테마파크 목록: 45개, 할인율 평균 27.8% / 중간값 23% / 전북 0개 → 수동 조사와 일치
- 파싱 규칙
  - region·name: 상품명 `[지역] 이름` 분리 / 대표가격·basis: 상세 상단(= 첫 번째 옵션)
  - 유효기간: 상세 정적 표기 `A ~ B` (0 = 구매일, 숫자 = 구매 후 N일 → valid_days)
  - issue_type: 안내문에 `예약대기` → 예약대기, 그 외 ticket_div(바로 사용가능 → 즉시발송, 예약필수, 수령 후 사용 가능, 광고상품)
  - issue_channel: 안내문 `발송채널 : ○○` / issue_medium: 알림톡·LMS 문자·순차 발송
  - usage_method: 키워드 태그 + 안내문 `이용 방법 :` 줄
  - refund_rule: 기한 / 수수료 / 불가 조건 / 접수 방법 요약 (공통 타행 이체수수료 500원 제외), 원문은 refund_text
