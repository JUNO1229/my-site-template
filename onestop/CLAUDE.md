# 사회사업실 원스탑 서비스

효사랑가족요양병원 2병원 · 원큐사회사업실에서 쓰는 **직원 자원봉사 모집·신청·승인 프로그램**입니다.
원내 PC 한 대를 서버로 삼아 돌리고, 직원들은 같은 원내망에서 브라우저로 들어옵니다.

이 파일은 Claude Code가 이 프로젝트를 처음 열었을 때 읽는 안내서입니다.
**고칠 때 지켜야 할 약속이 [작업 규칙](#작업-규칙)에 있습니다. 코드를 건드리기 전에 먼저 읽어 주세요.**

---

## 1. 만드는 사람에 대해

- 사회사업실 담당자 한 사람이 혼자 맡고 있고, **프로그램을 만들어보는 것은 이번이 처음**입니다.
- 그래서 **설명은 쉬운 우리말로**, 전문 용어는 쓰더라도 한 번은 풀어서 적습니다.
- 화면에 나오는 글, 오류 안내, 코드 주석도 **모두 한국어**입니다. 영어로 바꾸지 마세요.
- 쓰는 사람은 50~60대 직원이 많습니다. 글씨가 크고 대비가 센 지금 디자인은 그래서 고른 것입니다.

---

## 2. 어떻게 돌리나

```bash
node server.js            # 서버 실행 → http://localhost:3000
PORT=8080 node server.js  # 포트를 바꿀 때
```

Windows 원내 PC에서는 `시작.bat` 을 두 번 눌러 켭니다. `백업.bat` 은 자료를 손으로 백업합니다.

| 명령 | 하는 일 |
|---|---|
| `node tests/e2e.test.js` | **서버 검사 69건.** 규칙·로그인·권한·저장을 처음부터 끝까지 확인 |
| `node build-demo.js` | `public/` 을 HTML 한 장(`원스탑서비스-체험판.html`)으로 묶음 |
| `node tests/demo.test.js` | **체험판 브라우저 검사 28건.** 먼저 `build-demo.js` 를 돌려야 함 |
| `node tests/dept-limit.test.js` | **부서별 제한 검사 24건.** 건별·월별·둘 다·제한 없음. 엑셀 샘플 없이 혼자 돌아감 |
| `node --check 파일.js` | 문법만 빠르게 확인 |

**바깥에서 가져다 쓰는 것이 하나도 없습니다.** `npm install` 할 것이 없고, `package.json` 도 없습니다.
병원 PC가 인터넷에 못 나가도 Node.js만 깔려 있으면 돌아갑니다. 이 점을 깨뜨리지 마세요.
(`tests/demo.test.js` 만 예외로 playwright를 씁니다. 개발용이라 원내 PC에는 필요 없습니다.)

---

## 3. 폴더 지도

```
server.js            HTTP 서버 하나. 라우팅 · 권한 확인 · 각 API 처리 (563줄)
lib/
  rules.js           ★ 업무 규칙. 접수 가부를 여기서 판정 (259줄)
  store.js           data/db.json 읽기·쓰기. 통째 저장 + 날마다 백업 (79줄)
  auth.js            비밀번호 scrypt 해시 · 세션 쿠키 서명 · 로그인 잠금 (74줄)
  xlsx.js            엑셀(.xlsx) 직접 읽기. 바깥 라이브러리 없이 ZIP을 품 (205줄)
public/
  index.html         틀 하나. 화면은 전부 JavaScript가 그림
  style.css          디자인 토큰 + 모든 화면 모양 (355줄)
  icons.js           SVG 아이콘 모음 (I.home, I.hand …)
  app.js             공통 도구 · 상태(S) · 그리기(render) · 로그인/직원 화면 (539줄)
  admin.js           담당자 화면 — 공고 · 신청현황 · 후원 · 직원관리 · 자료관리 (489줄)
  events.js          누름·입력 연결 + act() 동작 모음 + 서버에서 받아오기 (393줄)
  demo.js            ☆ 체험판 전용. 서버 대신 브라우저가 답함 (500줄)
  demo-tail.js       ☆ 체험판 전용. act() 에 체험 단추 세 개를 덧붙임
build-demo.js        ☆ 체험판 HTML 한 장 만들기
tests/
  e2e.test.js        서버 검사 69건
  demo.test.js       체험판 브라우저 검사 28건 (playwright)
data/                ★ 실제 자료. db.json + backup/ + log/  — 절대 git에 올리지 않음
설치안내.md           원내 PC에 까는 방법 (담당자용)
시작.bat / 백업.bat   Windows용 실행·백업
```

`☆` 표시는 **체험판에만** 쓰이고 원내 서버에서는 안 읽히는 파일입니다. `public/index.html` 이
`demo.js` 와 `demo-tail.js` 를 부르지 않기 때문입니다.

---

## 4. 업무 규칙 (조건값)

담당자가 정한 여섯 가지입니다. **전부 `lib/rules.js` 에 모아 두었고, 판정은 반드시 서버에서 합니다.**
화면에서 미리 막는 것은 친절한 안내일 뿐이라, 서버 쪽 판정을 빼먹으면 규칙이 뚫립니다.

### ① 1인 1건
한 사람은 **봉사를 실시하는 그 달에 한 건만** 신청할 수 있습니다.
공고를 올린 달이 아니라 **봉사하는 날이 속한 달** 기준입니다 (`monthKey(post.when)`).
달이 넘어가면 다시 신청할 수 있습니다.

### ② 점수
| 구분 | 시간 | 점수 |
|---|---|---|
| 외부 봉사 | 4시간 | 1점 |
| 내부 봉사 | 2시간 | 0.5점 |

연간 의무는 **1점**(`ANNUAL_DUTY`). 엑셀에 `인정횟수` 칸이 있으면 그 값을 점수로 그대로 쓰고,
없을 때만 시간으로 환산합니다 (`scoreOf()`).

### ③ 포인트
휴무·off·근무시간 외에 한 봉사는 **1건당 10,000포인트**(`POINT_PER_CASE`).
실제 지급 확인은 **행복모아 이지웰**에서 따로 합니다. 이 프로그램은 지급하지 않고 안내만 합니다.

### ④ 선착순과 우선순위
- 정원이 차면 **예비 2명**까지 더 받습니다(`RESERVE_LIMIT`). 그 뒤는 마감 안내.
- 담당자 화면의 신청자 정렬 기본값은 **의무 미충족 우선**(올해 1점이 안 되는 사람이 위로).
  `접수 순` 으로 바꾸면 선착순입니다.

### ⑤ 부서(병동)별 제한 — 두 가지를 함께 쓸 수 있습니다(공고마다 체크로 고름)
- **건별 제한** — 그 공고에서 같은 병동 최대 N명 (`post.deptLimit`, 기본 3. `0` = 쓰지 않음. 값이 없는 옛 공고는 3으로 봄)
- **월별 제한** — 봉사일이 속한 달에 올라온 **모든 공고를 합쳐** 같은 병동 최대 N명 (`post.deptMonthLimit`, `0`·없음 = 쓰지 않음)
- 둘 다 켜면 **둘 다 지켜야** 접수됩니다. 둘 다 끄면 병동 제한이 없습니다. 판정은 `lib/rules.js` 의 `decideApply()`
  (`perLimit` · `monthLimit` · `deptMonthCount`), 체험판은 `demo.js` 의 같은 이름 함수가 짝입니다.
- 월별 인원도 건별과 같이 **예비까지 포함**해서 셉니다.

넘겨서 신청하면(건별이든 월별이든) 접수되지 않고 이 문구가 뜹니다 — 글자 하나도 바꾸지 마세요:

> 죄송합니다. 부서(병동)별 할당 인원이 초과되었습니다. 다음기회에 접수바랍니다.

이때 신청은 `status: "excluded"`(누락)로 남고, 담당자 화면에서 **추가 승인**으로 구제할 수 있습니다.

### ⑥ 담당자 최종 승인
신청은 `pending`(승인 대기)으로 들어오고, 담당자가 눌러야 `approved`(승인)가 됩니다.

### 세는 방법 — 여기서 자주 틀립니다

```js
seatCount    = pending + approved            // 예비는 정원에 안 셈
reserveCount = reserve
deptCount    = pending + approved + reserve  // 예비도 병동 인원에 셈  ← 중요
```

예비를 병동 인원에 **포함**시키는 이유: 예비가 나중에 승인으로 올라갔을 때 병동 제한이
뚫리면 안 되기 때문입니다. 담당자가 직접 요청한 규칙입니다.

---

## 5. 신청 상태 다섯 가지

| 값 | 화면 표시 | 뜻 |
|---|---|---|
| `pending` | 승인 대기 | 접수됨. 담당자 승인 기다리는 중 |
| `approved` | 승인 완료 | 확정 |
| `reserve` | 예비 | 정원이 차서 대기. 자리가 나면 담당자가 승인 |
| `excluded` | 누락 | 병동 제한 초과. 처리 칸에 **추가 승인** 단추만 뜸 |
| `rejected` | 반려 | 담당자가 거절 |

화면에 뜨는 이름과 설명글은 `public/app.js` 맨 위 `STATUS` 한 곳에 모여 있습니다.

---

## 6. 자료 구조 — `data/db.json`

파일 하나에 전부 들어 있습니다. 쓸 때마다 임시 파일에 적고 이름을 바꾸는 식이라(atomic write)
쓰는 도중에 전원이 나가도 깨지지 않습니다. 날마다 `data/backup/` 에 한 벌 남기고 30일 보관합니다.

```js
{
  version: 1,
  secret: "…",            // 세션 쿠키 서명 열쇠. 처음 켤 때 저절로 만들어짐
  employees: [{ empNo, name, dept, phone, status, updatedAt }],
                          // status: "active" | "retired"
  accounts:  [{ empNo, salt, hash, mustChange, failCount, lockedUntil, lastLogin }],
  admins:    [{ id, name, salt, hash, mustChange, failCount, lockedUntil, lastLogin }],
  records:   [{ empNo, name, date, content, type, hours, count, points, pointStatus }],
                          // 과거 봉사 내역. 엑셀 올리면 통째로 바뀜
  postings:  [{ id, org, name, when, deadline, type, hours,
                capacity, deptLimit, deptMonthLimit, closed, createdAt }],
  apps:      [{ id, postId, empNo, name, dept, phone,
                appliedAt, status, decidedAt, decidedBy }],
  donations: [{ id, empNo, name, dept, phone, item, at }],
}
```

- **비밀번호는 절대 그대로 저장하지 않습니다.** scrypt 해시 + 16바이트 소금.
  담당자도 남의 비밀번호를 볼 수 없고, **새로 발급**만 할 수 있습니다.
- `when` 은 `"2026-11-14T10:00"` 꼴, `deadline` 은 `"2026-11-08"` 꼴(그날 23:59:59까지).
- `records` 의 `date` 는 `"2026-03-24"` 꼴 문자열입니다. 연도 비교를 `startsWith` 로 하는 곳이 있습니다.

---

## 7. API 목록

모두 쿠키 세션으로 신분을 확인합니다. `/api/admin/*` 은 담당자만 들어갑니다.

| 경로 | 쓰는 사람 | 하는 일 |
|---|---|---|
| `POST /api/login` | 누구나 | 직원은 이름 + 비밀번호(연락처 뒷 4자리), 담당자는 `admin` + 비밀번호 |
| `POST /api/logout` | 로그인한 사람 | 나가기 |
| `GET  /api/me` | 로그인한 사람 | 내 정보 + 공고 + 내 신청 + 내 실적 한 번에 |
| `POST /api/password` | 로그인한 사람 | 비밀번호 바꾸기 |
| `POST /api/apply` | 직원 | 자원봉사 신청 ← **규칙 판정이 여기서 일어남** |
| `POST /api/donate` | 직원 | 바자회 물품 후원 등록 |
| `GET  /api/admin/all` | 담당자 | 담당자 화면이 쓰는 자료 전부 |
| `POST /api/admin/posting` | 담당자 | `create` / `update` / `toggle`(마감) / `delete` |
| `POST /api/admin/app-status` | 담당자 | 승인·반려·추가 승인 (여러 건 한꺼번에) |
| `POST /api/admin/employee` | 담당자 | `create` / `update` / `retire` / `restore` / `delete` / `resetPw` |
| `POST /api/admin/upload` | 담당자 | 엑셀 올리기 (`?kind=employees` 또는 `?kind=records`) |
| `POST /api/admin/apply-employees` | 담당자 | 올린 직원 명단을 실제로 반영 |
| `POST /api/admin/donation-delete` | 담당자 | 후원 등록 지우기 |

직원 명단 올리기는 **두 단계**입니다. `upload` 는 아직 저장하지 않고 **무엇이 달라지는지(diff)만**
돌려주고, 담당자가 화면에서 확인한 뒤 `apply-employees` 를 눌러야 반영됩니다.
반대로 봉사 내역(`?kind=records`)은 올리는 즉시 **통째로 교체**됩니다.

---

## 8. 화면이 돌아가는 방식

React 같은 것을 쓰지 않습니다. 아주 단순한 틀입니다.

```
S          하나뿐인 상태 보관함 (app.js)
render()   S 를 보고 #app 의 innerHTML 을 통째로 다시 그림
act(a, d)  단추를 누르면 불림. S 를 고치고 → api() 를 부르고 → render()
```

- 모든 단추는 `data-act="이름"` 을 답니다. `document` 하나에 건 click 리스너가
  `act()` 로 넘깁니다. 단추마다 따로 리스너를 달지 마세요.
- **글자 입력은 다시 그리지 않습니다.** 다시 그리면 커서가 튀기 때문에, `input` 리스너가
  `data-f`/`data-k` 를 보고 `S` 안의 값만 조용히 고칩니다 (`bucket()` 참고).
- 서버에서 받아오는 것은 `refresh()` 한 곳입니다. 화면을 바꾼 뒤에는 `await refresh()` 를 부릅니다.
- `confirm()` / `alert()` 는 **쓰지 않습니다.** 대신 `ask(글, 단추이름)` 이 약속(Promise)을
  돌려줍니다: `if (!await ask("지울까요?")) return;`
  (아티팩트 미리보기에서 `confirm()` 이 아무것도 묻지 않고 바로 `false` 를 주기 때문입니다.)

### 체험판은 어떻게 서버 없이 도나

`build-demo.js` 가 파일을 **이 차례로** 이어 붙입니다:

```
icons.js → app.js → demo.js → admin.js → events.js → demo-tail.js
```

- `demo.js` 가 `app.js` 뒤에 와서 `api()`, `downloadCsv()`, `screenLogin()` 을 덮어씁니다.
  덮어쓴 `api()` 는 `localStorage` 에 담긴 자료를 보고 **서버와 똑같이 판정해서** 답합니다.
- `demo-tail.js` 가 `events.js` 뒤에 와서 `act()` 를 감쌉니다(체험 계정 목록·바로 들어가기·되돌리기).
- **차례를 바꾸면 덮어쓰기가 안 먹습니다.**
- 체험판 규칙은 `lib/rules.js` 를 그대로 옮겨 적은 것입니다. **한쪽을 고치면 다른 쪽도 고쳐야 합니다.**
  (`decideApply` ↔ `/api/apply`, `seatCount` ↔ `dSeat`, `deptCount` ↔ `dDept`, `buildDiff` ↔ `dDiff` …)

---

## 9. 디자인

**`DESIGN_SYSTEM.md`가 지금 적용된 기준서입니다**(토큰·컴포넌트·상태·접근성·원본과 다른 점). 화면을 고치기 전에 읽어 주세요.
원본 `DESIGN_GUIDE.md`(소프트 UI — 라벤더 배경 + 흰 카드 + 보라/핑크 그라데이션)를 바탕으로 합니다.
토큰은 전부 `public/style.css` 맨 위에 있습니다. **색을 코드에 직접 적지 말고 토큰을 쓰세요.**

```css
/* 포인트 — 보라 그라데이션 (선택·활성·주 단추·강조 카드) */
--color-primary-start:#8E6BBF; --color-primary-end:#6E4FA8; --color-primary:#7E5DB4; --color-primary-soft:#B9A2DA;
--gradient-primary / --gradient-accent(핑크)
/* 바탕·글자 */
--color-bg:#EEEFF6; --color-surface:#FFFFFF; --color-field:#F3F4F9;
--text-primary:#1F1D2B; --text-secondary:#6E6E82; --text-on-color:#FFFFFF;
/* 기준서에 없어 추가한 값 */
--tint-primary(옅은 보라 면) --text-danger(흰 바탕 위 오류 글자) --overlay --shadow-bar
/* 글씨 — 고령 직원을 생각해 기준서(20/16/14/13/12)보다 한 단계 크게 둡니다. 줄이지 마세요 */
--fs-title-l:21px; --fs-title-m:17px; --fs-body-m:15px; --fs-body-s:14px; --fs-caption:13px;
```

- **글꼴은 Noto Sans KR**(가변, 오픈 라이선스)입니다. 기준서의 Pretendard 대신 담당자가 정했습니다.
  파일은 `public/fonts/noto-sans-kr/` 에 들어 있고 `public/fonts/noto-sans-kr.css` 가 불러옵니다.
  바깥 주소로 받아오지 않으니 인터넷이 없어도 됩니다. 굵기는 400~600만 씁니다(700 이상 금지).
  (체험판 HTML 한 장에는 글꼴이 들어가지 않아 Malgun Gothic 등 시스템 글꼴로 보입니다.)
- **움직임**: 화면이 바뀔 때 카드가 차례로 올라오고, 막대가 차오르고, 숫자가 올라갑니다(`render()` 가 `#app.enter` 를 붙임).
  같은 화면 안에서 다시 그릴 때는 붙지 않습니다. 새 효과는 `DESIGN_SYSTEM.md` 6-1 규칙대로 `#app.enter` 안에서만 거세요.
- 강조색(그라데이션)은 한 화면에 1~2곳만. 선택·활성 = 보라, 나머지 = 흰 카드/회색 면.
- 구분선 대신 면의 밝기 차이와 옅은 그림자로 나눕니다(표는 줄무늬).
- 틀은 **세 층**입니다: 머리글(고정) / 가운데(`.scroll-area`, 여기만 스크롤) / 아래 탭(고정).
  담당자 화면은 1100px 이상에서 왼쪽 사이드바.
- 화면 맨 아래에는 항상 **MISSION** 이 들어갑니다 —
  *어르신은 건강하게, 가족은 편안하게, 직원은 즐겁게*
- 로고(`public/emblem.png`)는 뒤에 흰 네모 없이 그대로 얹습니다.

---

## 10. 작업 규칙

지난 작업에서 실제로 사고가 났던 것들입니다. 꼭 지켜 주세요.

1. **고치기 전에 그 파일을 읽으세요.** 파일 전체를 보지 않고 찾아바꾸기만 하다가, 다른 곳에 있던
   함수를 통째로 지워 `useSummary is not defined`, `myApps is not defined` 오류를 낸 적이 있습니다.
2. **고친 뒤에는 반드시 검사를 돌리세요.** 최소한 `node --check`, 가능하면
   `node tests/e2e.test.js`. 서버를 고쳤으면 69건이 다 통과해야 합니다.
3. **규칙은 서버에서 판정합니다.** 화면에서만 막는 것은 안내일 뿐입니다.
4. **`lib/rules.js` 와 `public/demo.js` 는 짝입니다.** 한쪽만 고치면 체험판과 실제가 달라집니다.
5. **바깥 라이브러리를 더하지 마세요.** 병원 PC가 인터넷에 못 나갑니다.
   `node:` 로 시작하는 Node 기본 기능만 씁니다.
6. **개인정보를 화면에 더 내보내지 마세요.** 예전에 이름 검색 결과에 사번·부서·**연락처**가 같이
   떠서, 남의 실적을 들여다볼 수 있는 구멍이 있었습니다. 지금은 로그인으로 막았습니다.
   `/api/me` 는 **본인 것만** 돌려줘야 합니다.
7. **`data/` 를 git에 올리지 마세요.** 직원 실명·사번·연락처가 들어 있습니다. `.gitignore` 에 있습니다.
8. **병동 표기가 가장 잘 깨집니다.** `10` / `10W` / `10w` / `2\` 같은 표기가 섞여 들어옵니다.
   `간호부 10병동` 꼴로 맞추고, `wardNo()` 와 `deptCheck()` 가 올릴 때 자동으로 경고합니다.
   병동이 글자 하나라도 다르면 다른 부서로 세어져서 ⑤ 규칙이 틀어집니다.
9. **글을 바꿀 때는 먼저 물어보세요.** 특히 ⑤의 병동 초과 안내 문구는 담당자가 정해 준 그대로입니다.

---

## 11. 남은 일

### 담당자에게 확인받아야 하는 것
- [ ] **총무부에서 사번이 들어간 최신 직원 명단 받기** — 지금 가진 명단에는 사번이 없고,
      엑셀의 다른 시트에 있는 사번과 맞춰보니 **322명 중 32명이 안 맞습니다.**
- [ ] 병동 표기를 무엇으로 통일할지 확정
- [ ] 바자회 후원을 받은 다음 절차 (수령 안내? 봉사로 인정?)
- [ ] 봉사 장소를 기관과 따로 적을 칸이 필요한지
- [ ] 신청할 때 "휴무입니다" 체크 칸을 둘지 (③ 포인트와 연결)
- [ ] 직원이 **본인 신청을 스스로 취소**할 수 있게 할지
- [ ] 담당자 계정을 여럿 둘지
- [ ] 직원용 설명서에 넣을 문의 내선번호
- [ ] JIN GROUP 로고를 어디에 넣을지

### 코드로 해야 하는 것
- [ ] **담당자용 사용설명서 다시 만들기** — 지금 것은 옛 화면(계정·명단 탭) 기준이라
      지금의 **직원 관리 / 자료 관리** 탭과 맞지 않습니다.
- [ ] **선호 봉사 분석의 "가상 데이터" 항목을 실제 자료로 바꾸기** — 통계 탭 > 선호 봉사 분석에서 희망 분야·요일·시간대·주기,
      중요한 점, 분야별 만족도, 미참여 이유는 `admin.js` 의 `PREF_SAMPLE`(예시 숫자)입니다. 설문·만족도를 받는 기능을 만들면 교체하세요.
      활동 분야는 봉사 내용 글자로 나눕니다(`PREF_CATS`) — 새로운 봉사가 생기면 키워드를 보태 주세요.
- [ ] 승인되면 직원에게 알림 보내기 — 지금은 직원이 들어와서 직접 봐야 합니다
- [ ] 원내 고정 IP 받기, 내부 HTTPS 인증서 (받으면 `server.js` 를 https로 바꿔야 함)

### 보류한 것
- Google Apps Script + 구글 시트 버전 (`gas/`) — 담당자가 **원내 PC 기준**으로 정해서 멈췄습니다.
  바깥 서버로 직원 개인정보가 나가는 문제도 있어서, 다시 꺼낼 때는 그 점부터 상의해야 합니다.

---

## 12. 체험 계정

체험판(`build-demo.js` 로 만든 HTML)에만 들어 있는 **가명** 계정입니다. 실제 직원이 아닙니다.

- 담당자 `admin` / `1234`
- 직원 10명 — 사번과 비밀번호는 체험판 로그인 화면에서 "체험 계정으로 바로 들어가기"를 누르면 보입니다.
  - 간호부 10병동에 **4명**(강영식·고성호·권은지·김태현)을 몰아 두었습니다 → ⑤ 병동 제한 확인용
  - 올해 1점을 못 채운 사람 3명(강영식 0점 · 고성호 0.5점 · 심유진 0점) → ④ 우선순위 확인용
  - 공고 3건 중 2건이 같은 달(11월)에 있습니다 → ① 1인 1건 확인용

실제 서버는 처음 켤 때 `admin` / `1234` 가 만들어지고, **첫 로그인에서 비밀번호를 반드시 바꾸게** 합니다.
