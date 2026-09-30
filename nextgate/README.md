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
