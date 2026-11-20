# 영업처 관리 (sales-lead-web)

미아방지 서비스 영업처(전국 시설·기관 리드)를 수집·정리하고 영업 진행을 관리하는 내부용 웹앱. Next.js + Neon Postgres, Vercel 배포. 비밀번호로 보호된다.

## 구성
- `app/` 화면(대시보드·리드·연락처 보강·발송 이력·분석), `lib/` 도메인 규칙·DB 접근, `db/schema.sql` 스키마
- `sales-lead-system/` 공공데이터 정제·등급 산출(Python) → `seed.json` 생성. 설명은 `sales-lead-system/README.md`
- 준수사항(개인정보·광고성 정보 동의·수신 거부): `sales-lead-system/docs/05_compliance.md` — 앱이 코드로 강제한다

## 환경변수
| 이름 | 설명 |
|---|---|
| `DATABASE_URL` | Neon Postgres (Vercel 연동 시 자동 주입) |
| `APP_PASSWORD` | 로그인 비밀번호 |
| `AUTH_SECRET` | 세션 서명 키(16자 이상 무작위) |

## 실행
```bash
npm install
npm run db:migrate                                   # 스키마 적용(멱등)
python sales-lead-system/src/export_seed.py          # 공공데이터 → seed.json
npm run db:seed                                      # 적재(멱등, 영업 입력·검수 이력 보존)
npm run dev
npm test                                             # 도메인·DB 테스트(PGlite)
```
5432 포트가 막힌 환경에서는 `NEON_HTTP=1` 을 붙이면 HTTPS 로 접속한다.

## 동작 원칙
- 연락처는 조직 단위 공개 연락처만. 휴대폰 번호는 저장 거부. 공식 확인은 출처 URL·확인일 필수
- 이메일·문자·팩스는 수신 동의 리드만 기록 가능, 연락 금지 리드는 전 채널 차단·내보내기 제외
- 사이트 수집은 robots.txt 준수, 차단·실패는 우회하지 않고 수동 확인 큐로. 후보는 사람이 승인해야 연락처에 반영
- 이 앱은 발송을 기록·검증할 뿐 이메일/문자를 자동 전송하지 않는다
