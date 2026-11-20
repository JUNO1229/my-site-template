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
- DB 는 현재 전체 재생성 방식(사용자 입력 outreach 보존용 증분 갱신은 Phase 2 이전 과제)
- 다음: Phase 2 리드 관리 UI
