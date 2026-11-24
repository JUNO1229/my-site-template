# 모두패스 영업 발송 시스템 (outreach)

프로젝트(영업 캠페인)별로 영업대상을 선별하고, 대상자별 전달방식으로 영업자료를 발송하는 내부용 웹앱. Next.js + Neon Postgres, Vercel 배포.

## 흐름
프로젝트 개요 → 분석(키워드·태그·지역) → 추천 영업처 → 대상 확정(필터/태그로 추가 선별) → 자료 발송 → 열람·진행 관리

## 환경변수
| 이름 | 설명 |
|---|---|
| `DATABASE_URL` | Neon Postgres (Vercel 연동 시 자동 주입) |
| `APP_PASSWORD`, `AUTH_SECRET` | 공용 비밀번호, 세션 서명 키(16자 이상) |
| `RESEND_API_KEY`, `EMAIL_FROM` | 이메일 실발송(없으면 시뮬레이션) |
| `SOLAPI_API_KEY`, `SOLAPI_API_SECRET`, `SMS_SENDER` | 문자 실발송(없으면 시뮬레이션) |
| `GEMINI_API_KEY` (`GEMINI_MODEL` 선택, 기본 gemini-2.5-flash) | 명함 OCR·스캔 PDF OCR·프로젝트 AI 분석 (무료 등급 가능). 없으면 `ANTHROPIC_API_KEY`, 둘 다 없으면 수동/내장 규칙 |

## 명령
```bash
npm install
npm run db:migrate        # 스키마 적용(멱등)
npm run db:seed-public    # 공공데이터 시드 적재(멱등)
npm run dev
```
5432 포트가 막힌 환경에서는 `NEON_HTTP=1` 을 붙인다.

## 준수 원칙
수신동의 없는 이메일·문자 차단, 이메일 수신거부 링크 포함, 연락금지 대상은 전 채널 제외.
