# 영업처 수집·정리 시스템 (Claude Code 인수인계)

## 한 줄 요약
미아방지 서비스(모두의 플랫폼 시설운영의 세부서비스, 별도 모듈 가능)의 소개서·도입제안서를 보낼 **전국 시설·기관 리드**를 수집하고, 필요도(A/B/C)로 정리하고, 영업 진행을 관리하는 시스템을 만든다.
운영 주체: 코어솔루션 / 모두패스. 담당: Juno. 한국어 UI·문서.

## 먼저 읽을 것
1. docs/01_project_brief.md — 배경과 목표
2. docs/02_data_sources.md — 데이터 출처와 컬럼 의미
3. docs/03_scoring_rules.md — 필요도 산출 규칙(현재 휴리스틱)
4. docs/04_contact_enrichment.md — 연락처 보강 방법과 한계, 확인 완료 목록
5. docs/05_compliance.md — 개인정보·스팸 규제 (반드시 준수)
6. docs/06_roadmap.md — 만들 것의 단계

## 이미 있는 것
- data/raw/*.csv : 공공데이터포털 원본 3종 (cp949)
- src/*.py : 원본 → 리드 정제·등급 산출 스크립트 (실행 확인됨, 결과는 data/processed/ref_*.csv 와 동일)
- 웹앱 스키마는 루트 db/schema.sql (schema/ 는 중간 산출물용)
- data/manual/verified_contacts.csv : 사람이 공식 사이트에서 확인한 연락처(출처·확인일 포함)
- data/manual/unresolved_contacts.csv : 못 찾은 곳과 다음 조치

## 작업 원칙
- 연락처는 **조직 단위 공개 연락처만**. 개인 휴대폰·개인 이메일 저장/수집 금지.
- 모든 연락처에 출처(source)와 확인일, 신뢰도(confidence)를 붙인다. 제3자 여행정보 사이트 번호는 third_party_recheck.
- 원본 데이터는 수정하지 않고 data/raw 에 보존. 가공 결과는 재생성 가능해야 한다.
- 등급 규칙은 하드코딩하지 말고 설정 파일로 분리(docs/03 참고).
- 단일 원본은 웹앱의 Postgres. 이 폴더는 데이터 정제·시드 생성용(Python)

## 참고 산출물 (Claude 대화에서 만든 것)
- 발송 대상 시트(6탭): https://claude.ai/artifact/GPT5VzbhhZWxdWq5WEPkrq
- 구글 시트(허가 테마파크 탭만): https://docs.google.com/spreadsheets/d/1Q19ehL4EBzLm736JYjpMGFKxeSUGLMASfPPZycZmpx0/edit
- 미아방지 서비스 기획서(Docs): https://claude.ai/artifact/XHkMUdsSxi3z7y1CW2q7wx
