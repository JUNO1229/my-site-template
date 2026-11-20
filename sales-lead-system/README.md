# sales-lead-system (데이터 준비)

공공데이터 CSV → 정제·필요도(A/B/C) 산출·병합 → 웹앱용 `data/seed/seed.json`. **단일 원본은 웹앱의 Postgres** 이며, 여기 SQLite 는 중간 산출물이다. 먼저 `CLAUDE.md`, `docs/` 를 읽을 것.

```
pip install -r requirements.txt
python src/export_seed.py        # data/seed/seed.json 생성 (루트에서 npm run db:seed 로 적재)
python -m pytest tests -q        # 기준 산출물(data/processed/ref_*.csv) 회귀 + 확대 대상 테스트
```
- `config/grading.yaml` 등급 규칙, `data/manual/grade_overrides.csv` 수동 보정
- `data/manual/verified_contacts.csv` + `verified_contact_map.csv` 공식 확인 연락처와 리드 매칭
- `config/sources.yaml` + `data/raw/extra/*.csv` 확대 대상(캠핑장·수목원·동물원·박물관·해수욕장·축제), `data/raw/visitors.csv` 방문객 기반 등급 상향
- 영업 단계·검수·발송 이력은 웹앱 DB 에서 관리하며 시드 재적재로 덮어쓰지 않는다
