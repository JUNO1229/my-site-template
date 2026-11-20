# sales-lead-system
`CLAUDE.md` 를 먼저 읽으세요. 빠른 실행:
```
pip install -r requirements.txt
cd src
python ingest_parks.py ../data/raw/parks_national_std.csv ../data/processed
python ingest_themeparks.py ../data/raw/themepark_general.csv ../data/processed/themepark_general.csv
python ingest_themeparks.py ../data/raw/themepark_permit.csv ../data/processed/themepark_permit.csv --permit
```
data/processed/ref_*.csv 는 대화에서 만든 기준 산출물(회귀 비교용)입니다.

## 구축 현황 (Phase 0~1)
```
python src/build_master.py          # data/leads.db(SQLite) 재생성: 병합·등급·연락처 우선순위 반영
python -m pytest tests -q           # 기준 산출물 회귀 + DB 규칙 테스트
```
- `config/grading.yaml` : 등급 규칙 / `data/manual/grade_overrides.csv` : 수동 보정(규칙보다 우선)
- `data/manual/verified_contact_map.csv` : 수동 확인 연락처 ↔ 리드 이름 매칭 규칙
- 시·군 단위 부서 중복 병합(332 → 약 303 기관), 허가·일반 파일 동일 시설 병합
- 재실행해도 영업 단계·영업 포인트 입력은 이름+주소 기준으로 보존됨
- 리드 관리 UI: `streamlit run src/app.py` (필터·상세·영업 단계·영업 포인트·CSV/Excel 내보내기·보강 큐)
- 연락처 보강(Phase 3): UI 의 "연락처 보강 큐"에서 공식 URL 로 후보 수집 → "후보 검수" 탭에서 사람이 승인해야 contacts 반영 (robots.txt 준수, 차단은 우회 안 함, 휴대폰 번호 거부). 일괄 등록: data/manual/enrichment_candidates.csv (`enrich.import_candidates_csv`)
- 발송 지원(Phase 4): 자료 등록·발송 이력·후속 알림. `dispatch.py` 가 동의(이메일·문자·팩스)·연락 금지를 검증하며 자동 전송은 하지 않음. 수신 거부 처리 시 영구 차단. 이력/자료는 재생성 후에도 보존
- 확대(Phase 5): `config/sources.yaml` 에 대상 유형 등록, CSV 를 `data/raw/extra/` 에 넣고 빌드하면 자동 반영(컬럼명 후보 매칭). `data/raw/visitors.csv`(name,year,visitors)로 방문객 기반 등급 상향. UI "분석·확대" 탭: 유형별 커버리지·영업 현황·영업 포인트 제안(규칙 기반)
