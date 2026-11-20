# 구현 로드맵 (제안)

## Phase 0 — 기반
- 저장소 구조 정리, 설정 파일(등급 규칙 YAML), 단위 테스트(현재 출력과 일치하는지 회귀 테스트: data/processed/ref_*.csv)
## Phase 1 — 데이터 파이프라인
- ingest 3종 → schema.sql 의 leads/contacts 적재 (src/build_master.py TODO)
- 중복 병합(지자체 부서 중복, 같은 시설 다중 허가), 원본 갱신 diff
- verified_contacts.csv → contacts 반영(우선순위: verified_official > public_data > third_party_recheck)
## Phase 2 — 리드 관리 UI
- 목록·필터(등급/시도/유형/연락처 유무), 상세, 영업 단계(outreach), 영업 포인트(sales_points) 입력
- 내보내기: 구글 시트/엑셀(단방향). 필요 시 구글 시트 API로 정기 동기화
## Phase 3 — 연락처 보강 워크플로
- 번호 없는 A/B 리드 큐, 공식 사이트 후보 URL 관리, 사람 검수 후 반영
## Phase 4 — 발송 지원
- 소개서/도입제안서 첨부, 발송 이력, 동의 상태 확인, 후속 일정 알림
## Phase 5 — 확대
- 대상 확장(캠핑장·수목원·동물원·박물관·해수욕장·지자체 축제), 방문객 통계 연동, 모두의 플랫폼 영업 포인트 분석
