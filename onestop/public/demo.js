/* ══════════════════════════════════════════════════════════════
   체험판 — 서버 없이 브라우저 안에서만 돌아갑니다.
   화면과 규칙은 원내 서버 버전과 똑같고, 자료만 이 브라우저에 담깁니다.
   (app.js 다음, events.js 앞에 넣습니다)
   ══════════════════════════════════════════════════════════════ */
"use strict";

const DKEY = "oq-demo-v1";

/* ── 체험용 자료 (실제 직원이 아닌 가명입니다) ── */
const DEMO_EMP = [{"empNo": "230053", "name": "강영식", "dept": "간호부 10병동", "phone": "010-5278-9493", "pw": "9493"}, {"empNo": "230056", "name": "고성호", "dept": "간호부 10병동", "phone": "010-4654-4197", "pw": "4197"}, {"empNo": "230055", "name": "권은지", "dept": "간호부 10병동", "phone": "010-9873-9236", "pw": "9236"}, {"empNo": "230043", "name": "김태현", "dept": "간호부 10병동", "phone": "010-3478-9791", "pw": "9791"}, {"empNo": "230021", "name": "홍도윤", "dept": "간호부 3병동", "phone": "010-6737-9137", "pw": "9137"}, {"empNo": "230007", "name": "최태현", "dept": "간호부 3병동", "phone": "010-7499-1812", "pw": "1812"}, {"empNo": "230010", "name": "전은지", "dept": "사회사업실", "phone": "010-3961-2688", "pw": "2688"}, {"empNo": "230004", "name": "신서연", "dept": "감염관리실", "phone": "010-2408-8104", "pw": "8104"}, {"empNo": "230040", "name": "배서연", "dept": "간호부 9병동", "phone": "010-4122-2103", "pw": "2103"}, {"empNo": "230048", "name": "심유진", "dept": "가정간호센터", "phone": "010-6109-2407", "pw": "2407"}];
const DEMO_REC = [{"empNo":"230004","name":"신서연","date":"2024-11-19","content":"효사랑 환우 김장","type":"외부","hours":4.0,"count":1.0,"points":0,"pointStatus":"미신청"},{"empNo":"230004","name":"신서연","date":"2025-04-19","content":"봄꽃나들이","type":"외부","hours":4.0,"count":1.0,"points":10000,"pointStatus":"신청"},{"empNo":"230004","name":"신서연","date":"2025-06-05","content":"의료서비스만족도조사","type":"내부","hours":2.0,"count":0.5,"points":0,"pointStatus":"미신청"},{"empNo":"230004","name":"신서연","date":"2025-07-30","content":"아마존 간식나눔","type":"외부","hours":4.0,"count":1.0,"points":0,"pointStatus":"미신청"},{"empNo":"230004","name":"신서연","date":"2025-09-24","content":"전북자원봉사센터 연계 와플봉사","type":"외부","hours":4.0,"count":1.0,"points":0,"pointStatus":"미신청"},{"empNo":"230004","name":"신서연","date":"2025-11-19","content":"자원봉사센터김장봉사","type":"외부","hours":4.0,"count":1.0,"points":0,"pointStatus":"미신청"},{"empNo":"230004","name":"신서연","date":"2025-11-25","content":"금쪽같은내부모 봉사활동","type":"외부","hours":4.0,"count":1.0,"points":10000,"pointStatus":"신청"},{"empNo":"230004","name":"신서연","date":"2026-01-20","content":"환우윷놀이대회","type":"내부","hours":2.0,"count":0.5,"points":0,"pointStatus":"미신청"},{"empNo":"230004","name":"신서연","date":"2026-02-07","content":"장학금전달식","type":"내부","hours":2.0,"count":0.5,"points":0,"pointStatus":"미신청"},{"empNo":"230004","name":"신서연","date":"2026-02-10","content":"바자회 행사 준비","type":"내부","hours":2.0,"count":0.5,"points":0,"pointStatus":"미신청"},{"empNo":"230004","name":"신서연","date":"2026-02-12","content":"2026 바자회 행사","type":"내부","hours":4.0,"count":1.0,"points":0,"pointStatus":"미신청"},{"empNo":"230004","name":"신서연","date":"2026-03-13","content":"굿모닝요양원 와플&교육","type":"외부","hours":4.0,"count":1.0,"points":0,"pointStatus":"미신청"},{"empNo":"230004","name":"신서연","date":"2026-03-24","content":"서전주 요양원 와플봉사&교육","type":"외부","hours":4.0,"count":1.0,"points":0,"pointStatus":"미신청"},{"empNo":"230004","name":"신서연","date":"2026-05-13","content":"효수니의 날 햇빛샤워 봉사","type":"내부","hours":2.0,"count":0.5,"points":0,"pointStatus":"미신청"},{"empNo":"230004","name":"신서연","date":"2026-05-15","content":"3병동 효수니의 날 햇빛샤워 봉사","type":"내부","hours":2.0,"count":0.5,"points":0,"pointStatus":"미신청"},{"empNo":"230004","name":"신서연","date":"2026-06-11","content":"소식지작성","type":"내부","hours":2.0,"count":0.5,"points":10000,"pointStatus":"신청"},{"empNo":"230004","name":"신서연","date":"2026-06-12","content":"솔내요양원 와플&감염교육","type":"외부","hours":4.0,"count":1.0,"points":0,"pointStatus":"미신청"},{"empNo":"230004","name":"신서연","date":"2026-06-17","content":"한빛요양원 와플나눔","type":"외부","hours":4.0,"count":1.0,"points":0,"pointStatus":"미신청"},{"empNo":"230004","name":"신서연","date":"2026-06-23","content":"무비데이&요리쿡","type":"내부","hours":2.0,"count":0.5,"points":0,"pointStatus":"미신청"},{"empNo":"230004","name":"신서연","date":"2026-07-01","content":"직원공기대회","type":"내부","hours":2.0,"count":0.5,"points":0,"pointStatus":"미신청"},{"empNo":"230004","name":"신서연","date":"2026-08-13","content":"환우낚시대회행사","type":"내부","hours":2.0,"count":0.5,"points":0,"pointStatus":"미신청"},{"empNo":"230007","name":"최태현","date":"2024-11-19","content":"효사랑 환우 김장","type":"외부","hours":4.0,"count":1.0,"points":0,"pointStatus":"미신청"},{"empNo":"230007","name":"최태현","date":"2025-02-18","content":"환우윷놀이대회","type":"내부","hours":2.0,"count":0.5,"points":0,"pointStatus":"미신청"},{"empNo":"230007","name":"최태현","date":"2025-02-20","content":"요양원 와플봉사","type":"외부","hours":4.0,"count":1.0,"points":10000,"pointStatus":"신청"},{"empNo":"230007","name":"최태현","date":"2025-04-19","content":"성예요양원 와플봉사","type":"외부","hours":4.0,"count":1.0,"points":0,"pointStatus":"미신청"},{"empNo":"230007","name":"최태현","date":"2025-05-16","content":"성예요양원 와플봉사","type":"외부","hours":4.0,"count":1.0,"points":0,"pointStatus":"미신청"},{"empNo":"230007","name":"최태현","date":"2025-05-22","content":"신성양로원 와플&공예프로그램","type":"외부","hours":4.0,"count":1.0,"points":10000,"pointStatus":"신청"},{"empNo":"230007","name":"최태현","date":"2025-07-30","content":"아마존 간식나눔","type":"외부","hours":4.0,"count":1.0,"points":10000,"pointStatus":"신청"},{"empNo":"230007","name":"최태현","date":"2025-09-24","content":"연탄은행 배식봉사","type":"외부","hours":4.0,"count":1.0,"points":10000,"pointStatus":"신청"},{"empNo":"230007","name":"최태현","date":"2026-03-11","content":"효경재가센터 반찬나눔 봉사활동","type":"외부","hours":4.0,"count":1.0,"points":10000,"pointStatus":"신청"},{"empNo":"230007","name":"최태현","date":"2026-03-25","content":"중증장애인연대배식봉사","type":"외부","hours":4.0,"count":1.0,"points":10000,"pointStatus":"신청"},{"empNo":"230007","name":"최태현","date":"2026-04-15","content":"연탄은행 배식봉사","type":"외부","hours":4.0,"count":1.0,"points":10000,"pointStatus":"신청"},{"empNo":"230007","name":"최태현","date":"2026-04-18","content":"봄꽃나들이","type":"외부","hours":4.0,"count":1.0,"points":10000,"pointStatus":"신청"},{"empNo":"230007","name":"최태현","date":"2026-04-22","content":"중증장애인연대배식봉사","type":"외부","hours":4.0,"count":1.0,"points":10000,"pointStatus":"신청"},{"empNo":"230007","name":"최태현","date":"2026-05-12","content":"늘푸른집 와플봉사","type":"외부","hours":4.0,"count":1.0,"points":10000,"pointStatus":"신청"},{"empNo":"230007","name":"최태현","date":"2026-05-15","content":"3병동 효수니의 날 햇빛샤워 봉사","type":"내부","hours":2.0,"count":0.5,"points":0,"pointStatus":"미신청"},{"empNo":"230007","name":"최태현","date":"2026-05-20","content":"보훈환자배식봉사 전주연탄은행","type":"외부","hours":4.0,"count":1.0,"points":10000,"pointStatus":"신청"},{"empNo":"230007","name":"최태현","date":"2026-05-27","content":"중증장애인연대배식봉사","type":"외부","hours":4.0,"count":1.0,"points":10000,"pointStatus":"신청"},{"empNo":"230007","name":"최태현","date":"2026-06-24","content":"중증장애인연대배식봉사","type":"외부","hours":4.0,"count":1.0,"points":10000,"pointStatus":"신청"},{"empNo":"230007","name":"최태현","date":"2026-08-19","content":"효담문화교실","type":"내부","hours":2.0,"count":0.5,"points":0,"pointStatus":"미신청"},{"empNo":"230010","name":"전은지","date":"2025-02-06","content":"요양원 와플봉사","type":"외부","hours":4.0,"count":1.0,"points":0,"pointStatus":"미신청"},{"empNo":"230010","name":"전은지","date":"2025-02-18","content":"환우윷놀이대회","type":"내부","hours":2.0,"count":0.5,"points":0,"pointStatus":"미신청"},{"empNo":"230010","name":"전은지","date":"2025-02-26","content":"암환자이송","type":"내부","hours":2.0,"count":0.5,"points":0,"pointStatus":"미신청"},{"empNo":"230010","name":"전은지","date":"2025-04-12","content":"장수사진촬영","type":"내부","hours":2.0,"count":0.5,"points":10000,"pointStatus":"신청"},{"empNo":"230010","name":"전은지","date":"2025-04-19","content":"봄꽃나들이","type":"외부","hours":4.0,"count":1.0,"points":10000,"pointStatus":"신청"},{"empNo":"230010","name":"전은지","date":"2025-06-05","content":"의료서비스만족도조사","type":"내부","hours":2.0,"count":0.5,"points":0,"pointStatus":"미신청"},{"empNo":"230010","name":"전은지","date":"2025-11-22","content":"사랑의연탄나눔봉사활동","type":"외부","hours":4.0,"count":1.0,"points":10000,"pointStatus":"신청"},{"empNo":"230010","name":"전은지","date":"2026-01-17","content":"사랑의연탄나눔봉사활동","type":"외부","hours":4.0,"count":1.0,"points":10000,"pointStatus":"신청"},{"empNo":"230010","name":"전은지","date":"2026-02-07","content":"장학금전달식","type":"내부","hours":2.0,"count":0.5,"points":10000,"pointStatus":"신청"},{"empNo":"230010","name":"전은지","date":"2026-03-18","content":"연탄은행 배식봉사","type":"외부","hours":4.0,"count":1.0,"points":0,"pointStatus":"미신청"},{"empNo":"230010","name":"전은지","date":"2026-04-11","content":"장수사진촬영","type":"내부","hours":2.0,"count":0.5,"points":10000,"pointStatus":"신청"},{"empNo":"230010","name":"전은지","date":"2026-04-15","content":"연탄은행 배식봉사","type":"외부","hours":4.0,"count":1.0,"points":0,"pointStatus":"미신청"},{"empNo":"230010","name":"전은지","date":"2026-04-18","content":"봄꽃나들이","type":"외부","hours":4.0,"count":1.0,"points":10000,"pointStatus":"신청"},{"empNo":"230010","name":"전은지","date":"2026-05-14","content":"신성양로원 와플&공예프로그램","type":"외부","hours":4.0,"count":1.0,"points":0,"pointStatus":"미신청"},{"empNo":"230010","name":"전은지","date":"2026-05-27","content":"중증장애인연대배식봉사","type":"외부","hours":4.0,"count":1.0,"points":0,"pointStatus":"미신청"},{"empNo":"230010","name":"전은지","date":"2026-06-04","content":"보훈요양원 와플나눔","type":"외부","hours":4.0,"count":1.0,"points":0,"pointStatus":"미신청"},{"empNo":"230010","name":"전은지","date":"2026-06-12","content":"솔내요양원 와플&감염교육","type":"외부","hours":4.0,"count":1.0,"points":0,"pointStatus":"미신청"},{"empNo":"230010","name":"전은지","date":"2026-09-03","content":"서전주 요양원 와플봉사&교육","type":"외부","hours":4.0,"count":1.0,"points":0,"pointStatus":"미신청"},{"empNo":"230021","name":"홍도윤","date":"2024-11-20","content":"환우체육대회","type":"외부","hours":4.0,"count":1.0,"points":0,"pointStatus":"미신청"},{"empNo":"230021","name":"홍도윤","date":"2025-04-12","content":"장수사진촬영","type":"내부","hours":2.0,"count":0.5,"points":10000,"pointStatus":"신청"},{"empNo":"230021","name":"홍도윤","date":"2025-09-24","content":"연탄은행 배식봉사","type":"외부","hours":4.0,"count":1.0,"points":10000,"pointStatus":"신청"},{"empNo":"230021","name":"홍도윤","date":"2026-01-17","content":"사랑의연탄나눔봉사활동","type":"외부","hours":4.0,"count":1.0,"points":10000,"pointStatus":"신청"},{"empNo":"230021","name":"홍도윤","date":"2026-03-04","content":"양지노인복지관 배식봉사","type":"외부","hours":4.0,"count":1.0,"points":10000,"pointStatus":"신청"},{"empNo":"230021","name":"홍도윤","date":"2026-03-25","content":"중증장애인연대배식봉사","type":"외부","hours":4.0,"count":1.0,"points":10000,"pointStatus":"신청"},{"empNo":"230021","name":"홍도윤","date":"2026-04-01","content":"양지노인복지관 배식봉사","type":"외부","hours":4.0,"count":1.0,"points":10000,"pointStatus":"신청"},{"empNo":"230021","name":"홍도윤","date":"2026-04-08","content":"엄마네집요양원 와플봉사","type":"외부","hours":4.0,"count":1.0,"points":10000,"pointStatus":"신청"},{"empNo":"230021","name":"홍도윤","date":"2026-05-14","content":"신성양로원 와플&공예프로그램","type":"외부","hours":4.0,"count":1.0,"points":10000,"pointStatus":"신청"},{"empNo":"230021","name":"홍도윤","date":"2026-05-19","content":"아로하요양원 와플봉사","type":"외부","hours":4.0,"count":1.0,"points":10000,"pointStatus":"신청"},{"empNo":"230021","name":"홍도윤","date":"2026-06-24","content":"중증장애인연대배식봉사","type":"외부","hours":4.0,"count":1.0,"points":10000,"pointStatus":"신청"},{"empNo":"230021","name":"홍도윤","date":"2026-06-24","content":"효담문화교실","type":"외부","hours":2.0,"count":0.5,"points":0,"pointStatus":"미신청"},{"empNo":"230040","name":"배서연","date":"2025-08-08","content":"말복이벤트 보조","type":"내부","hours":2.0,"count":0.5,"points":0,"pointStatus":"미신청"},{"empNo":"230040","name":"배서연","date":"2025-08-12","content":"환우낚시대회행사","type":"내부","hours":2.0,"count":0.5,"points":0,"pointStatus":"미신청"},{"empNo":"230040","name":"배서연","date":"2025-09-30","content":"가을맞이 송편빚기","type":"내부","hours":2.0,"count":0.5,"points":0,"pointStatus":"미신청"},{"empNo":"230040","name":"배서연","date":"2025-11-18","content":"효사랑 환우 김장","type":"내부","hours":2.0,"count":0.5,"points":0,"pointStatus":"미신청"},{"empNo":"230040","name":"배서연","date":"2025-11-25","content":"환우체육대회","type":"내부","hours":2.0,"count":0.5,"points":0,"pointStatus":"미신청"},{"empNo":"230040","name":"배서연","date":"2026-01-13","content":"효사랑 요리쿡","type":"내부","hours":2.0,"count":0.5,"points":0,"pointStatus":"미신청"},{"empNo":"230040","name":"배서연","date":"2026-01-20","content":"환우윷놀이대회","type":"내부","hours":2.0,"count":0.5,"points":0,"pointStatus":"미신청"},{"empNo":"230040","name":"배서연","date":"2026-07-14","content":"환우노래자랑대회","type":"내부","hours":2.0,"count":0.5,"points":0,"pointStatus":"미신청"},{"empNo":"230040","name":"배서연","date":"2026-08-13","content":"환우낚시대회행사","type":"내부","hours":2.0,"count":0.5,"points":0,"pointStatus":"미신청"},{"empNo":"230043","name":"김태현","date":"2025-03-14","content":"효사랑 요리쿡","type":"내부","hours":2.0,"count":0.5,"points":0,"pointStatus":"미신청"},{"empNo":"230043","name":"김태현","date":"2025-05-22","content":"신성양로원 와플&공예프로그램","type":"외부","hours":4.0,"count":1.0,"points":10000,"pointStatus":"신청"},{"empNo":"230043","name":"김태현","date":"2025-06-24","content":"김제시 연합 사회공헌활동","type":"외부","hours":4.0,"count":1.0,"points":10000,"pointStatus":"신청"},{"empNo":"230043","name":"김태현","date":"2025-07-15","content":"환우노래자랑대회","type":"내부","hours":2.0,"count":0.5,"points":0,"pointStatus":"미신청"},{"empNo":"230043","name":"김태현","date":"2025-07-23","content":"연탄은행 배식봉사","type":"외부","hours":4.0,"count":1.0,"points":10000,"pointStatus":"신청"},{"empNo":"230043","name":"김태현","date":"2026-03-18","content":"연탄은행 배식봉사","type":"외부","hours":4.0,"count":1.0,"points":10000,"pointStatus":"신청"},{"empNo":"230043","name":"김태현","date":"2026-04-14","content":"예은요양원 와플봉사","type":"외부","hours":4.0,"count":1.0,"points":10000,"pointStatus":"신청"},{"empNo":"230043","name":"김태현","date":"2026-06-11","content":"10병동 음악치료프로그램 촬영 보조","type":"내부","hours":2.0,"count":0.5,"points":0,"pointStatus":"미신청"},{"empNo":"230055","name":"권은지","date":"2025-03-14","content":"효사랑 요리쿡","type":"내부","hours":2.0,"count":0.5,"points":0,"pointStatus":"미신청"},{"empNo":"230055","name":"권은지","date":"2025-06-12","content":"한빛요양원 와플나눔","type":"외부","hours":4.0,"count":1.0,"points":10000,"pointStatus":"신청"},{"empNo":"230055","name":"권은지","date":"2025-07-22","content":"효사랑 요리쿡","type":"내부","hours":2.0,"count":0.5,"points":0,"pointStatus":"미신청"},{"empNo":"230055","name":"권은지","date":"2025-09-30","content":"가을맞이 송편빚기","type":"내부","hours":2.0,"count":0.5,"points":0,"pointStatus":"미신청"},{"empNo":"230055","name":"권은지","date":"2026-06-11","content":"10병동 음악치료프로그램 촬영 보조","type":"내부","hours":2.0,"count":0.5,"points":0,"pointStatus":"미신청"},{"empNo":"230055","name":"권은지","date":"2026-06-17","content":"한빛요양원 와플나눔","type":"외부","hours":4.0,"count":1.0,"points":10000,"pointStatus":"신청"},{"empNo":"230055","name":"권은지","date":"2026-07-14","content":"환우노래자랑대회","type":"내부","hours":2.0,"count":0.5,"points":0,"pointStatus":"미신청"},{"empNo":"230056","name":"고성호","date":"2025-03-14","content":"효사랑 요리쿡","type":"내부","hours":2.0,"count":0.5,"points":0,"pointStatus":"미신청"},{"empNo":"230056","name":"고성호","date":"2025-06-24","content":"김제시 연합 사회공헌활동","type":"외부","hours":4.0,"count":1.0,"points":10000,"pointStatus":"신청"},{"empNo":"230056","name":"고성호","date":"2025-07-15","content":"환우노래자랑대회","type":"내부","hours":2.0,"count":0.5,"points":0,"pointStatus":"미신청"},{"empNo":"230056","name":"고성호","date":"2025-07-23","content":"연탄은행 배식봉사","type":"외부","hours":4.0,"count":1.0,"points":10000,"pointStatus":"신청"},{"empNo":"230056","name":"고성호","date":"2026-01-13","content":"효사랑 요리쿡","type":"내부","hours":2.0,"count":0.5,"points":0,"pointStatus":"미신청"}];

function demoPostings() {
  const z = (x) => String(x).padStart(2, "0");
  const at = (n, h, m) => { const t = new Date(); t.setDate(t.getDate() + n);
    return `${t.getFullYear()}-${z(t.getMonth() + 1)}-${z(t.getDate())}T${z(h)}:${z(m)}`; };
  const day = (n) => at(n, 0, 0).slice(0, 10);
  return [
    { id: "p1", org: "서전주요양원", name: "어르신 와플나눔 봉사", when: at(12, 10, 0), deadline: day(6),
      type: "외부", hours: 4, capacity: 5, deptLimit: 3, closed: false },
    { id: "p2", org: "효사랑가족요양병원 2병원", name: "환우 노래자랑 진행 보조", when: at(4, 14, 0), deadline: day(1),
      type: "내부", hours: 2, capacity: 4, deptLimit: 2, closed: false },
    { id: "p3", org: "전주연탄은행", name: "보훈환자 배식봉사", when: at(40, 9, 30), deadline: day(25),
      type: "외부", hours: 4, capacity: 6, deptLimit: 3, closed: false },
    { id: "p4", org: "성예요양원", name: "사랑의 연탄나눔 봉사", when: at(-20, 9, 0), deadline: day(-27),
      type: "외부", hours: 4, capacity: 5, deptLimit: 3, closed: true },
  ];
}

const freshDemo = () => ({
  employees: DEMO_EMP.map(({ pw, ...e }) => ({ ...e, status: "active" })),
  accounts: DEMO_EMP.map((e) => ({ empNo: e.empNo, pw: e.pw, mustChange: false })),
  records: DEMO_REC.map((r) => ({ ...r })),
  postings: demoPostings(),
  apps: [], donations: [],
  admins: [{ id: "admin", name: "사회사업실 담당자", pw: "1234", mustChange: false }],
});

let D = null;
function loadDemo() {
  try {
    const raw = localStorage.getItem(DKEY);
    if (raw) { D = JSON.parse(raw); if (D && D.employees && D.postings) return; }
  } catch { /* 저장을 못 해도 그만입니다 */ }
  D = freshDemo(); saveDemo();
}
function saveDemo() { try { localStorage.setItem(DKEY, JSON.stringify(D)); } catch { /* 무시 */ } }
function resetDemo() { D = freshDemo(); saveDemo(); }

let SESSION = null;

/* ══════════ 규칙 — 서버 lib/rules.js 와 같은 판정 ══════════ */
const LIVE3 = ["pending", "approved", "reserve"];
const dSeat = (pid) => D.apps.filter((a) => a.postId === pid
  && (a.status === "pending" || a.status === "approved")).length;
const dRes = (pid) => D.apps.filter((a) => a.postId === pid && a.status === "reserve").length;
const dDept = (pid, dept) => D.apps.filter((a) => a.postId === pid
  && LIVE3.includes(a.status) && a.dept === dept).length;
const dOpen = (p) => !p.closed && !deadlinePassed(p.deadline)
  && (!p.when || new Date(p.when) >= new Date());

function dSummary(empNo) {
  const mine = D.records.filter((r) => String(r.empNo) === String(empNo));
  const year = new Date().getFullYear();
  const ty = mine.filter((r) => String(r.date).startsWith(String(year)));
  const sum = (arr, f) => arr.reduce((a, r) => a + (Number(f(r)) || 0), 0);
  const sc = (arr) => arr.reduce((a, r) => a + scoreOf(r), 0);
  return { year, cases: mine.length,
    totalHours: round2(sum(mine, (r) => r.hours)), yearHours: round2(sum(ty, (r) => r.hours)),
    yearScore: round2(sc(ty)), totalScore: round2(sc(mine)),
    totalPoints: sum(mine, (r) => r.points),
    requested: mine.filter((r) => String(r.pointStatus).startsWith("신청")).length };
}
function dScores() {
  const m = {}, y = String(new Date().getFullYear());
  for (const r of D.records) {
    const k = String(r.empNo);
    if (!m[k]) m[k] = { year: 0, total: 0 };
    const s = scoreOf(r); m[k].total += s;
    if (String(r.date).startsWith(y)) m[k].year += s;
  }
  for (const k of Object.keys(m)) { m[k].year = round2(m[k].year); m[k].total = round2(m[k].total); }
  return m;
}
function dDeptCheck(list) {
  const seen = new Map(), noName = new Set();
  for (const e of list) {
    const t = String(e.dept || "").trim(); if (!t) continue;
    if (/^\d+\s*(병동|[Ww])?$/.test(t)) noName.add(t);
    const w = wardNo(t); if (!w) continue;
    if (!seen.has(w)) seen.set(w, new Set());
    seen.get(w).add(t);
  }
  const mixed = [];
  for (const [ward, set] of seen) if (set.size > 1) mixed.push({ ward, forms: [...set] });
  return { mixed: mixed.sort((a, b) => Number(a.ward) - Number(b.ward)), noName: [...noName] };
}
function dDiff(current, incoming) {
  const cur = new Map(current.map((e) => [String(e.empNo), e]));
  const inc = new Map(incoming.map((e) => [String(e.empNo), e]));
  const added = [], changed = [], same = [], missing = [], back = [];
  for (const [no, e] of inc) {
    const old = cur.get(no);
    if (!old) { added.push(e); continue; }
    const fields = [];
    if ((old.name || "") !== (e.name || "")) fields.push(["이름", old.name, e.name]);
    if ((old.dept || "") !== (e.dept || "")) fields.push(["부서", old.dept, e.dept]);
    if (digits(old.phone) !== digits(e.phone)) fields.push(["연락처", old.phone, e.phone]);
    if (!isActive(old)) back.push({ ...e, old });
    if (fields.length) changed.push({ ...e, old, fields });
    else if (isActive(old)) same.push(e);
  }
  for (const [no, e] of cur) if (!inc.has(no) && isActive(e)) missing.push(e);
  return { added, changed, same, missing, back };
}

function dMyView(me) {
  const apps = D.apps.filter((a) => String(a.empNo) === String(me.empNo))
    .sort((a, b) => String(b.appliedAt).localeCompare(String(a.appliedAt)))
    .map((a) => { const p = D.postings.find((x) => x.id === a.postId);
      return { id: a.id, status: a.status, appliedAt: a.appliedAt,
        org: p ? p.org : "지워진 공고", name: p ? p.name : "-", when: p ? p.when : "" }; });
  const takenMonths = {};
  for (const a of D.apps) {
    if (String(a.empNo) !== String(me.empNo) || !LIVE3.includes(a.status)) continue;
    const p = D.postings.find((x) => x.id === a.postId);
    if (p) takenMonths[monthKey(p.when)] = { postId: p.id, name: p.name };
  }
  return {
    me: { empNo: me.empNo, name: me.name, dept: me.dept, phone: me.phone, role: "staff" },
    postings: D.postings.filter(dOpen).sort((a, b) => String(a.when).localeCompare(String(b.when)))
      .map((p) => ({ id: p.id, org: p.org, name: p.name, when: p.when, deadline: p.deadline,
        type: p.type, hours: p.hours, capacity: p.capacity, deptLimit: p.deptLimit,
        seat: dSeat(p.id), reserve: dRes(p.id), myDept: dDept(p.id, me.dept) })),
    apps, takenMonths,
    records: D.records.filter((r) => String(r.empNo) === String(me.empNo))
      .sort((a, b) => String(b.date).localeCompare(String(a.date))),
    summary: dSummary(me.empNo),
    donations: D.donations.filter((x) => String(x.empNo) === String(me.empNo))
      .sort((a, b) => String(b.at).localeCompare(String(a.at))),
  };
}

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
const tempPw = () => String(Math.floor(Math.random() * 900000) + 100000);
const pwFromPhone = (phone) => { const d = String(phone ?? "").replace(/\D/g, ""); return d.length >= 4 ? d.slice(-4) : tempPw(); };
const stop = (m) => { throw new Error(m); };

/* ══════════ 서버 호출을 대신 받습니다 ══════════ */
async function api(path, body) {
  await new Promise((r) => setTimeout(r, 70));          // 서버를 거치는 느낌
  const [p, qs] = String(path).split("?");
  const q = new URLSearchParams(qs || "");
  const needMe = () => SESSION || stop("로그인이 필요합니다.");
  const needAdm = () => { const x = needMe(); if (x.role !== "admin") stop("담당자만 쓸 수 있습니다."); return x; };

  switch (p) {
    /* ── 로그인 ── */
    case "/api/login": {
      const id = String(body.id || "").trim();
      const adm = D.admins.find((a) => a.id.toLowerCase() === id.toLowerCase());
      if (adm) {
        if (String(adm.pw) !== String(body.pw)) stop("비밀번호가 맞지 않습니다.");
        SESSION = { role: "admin", id: adm.id, name: adm.name, mustChange: !!adm.mustChange };
        return { ok: true, me: SESSION };
      }
      const acc = D.accounts.find((a) => String(a.empNo) === id);
      const emp = D.employees.find((e) => String(e.empNo) === id);
      if (!acc || !emp || String(acc.pw) !== String(body.pw)) stop("사번 또는 비밀번호가 맞지 않습니다.");
      if (!isActive(emp)) stop("퇴사 처리된 계정입니다. 사회사업실로 문의해 주세요.");
      SESSION = { role: "staff", empNo: emp.empNo, name: emp.name, dept: emp.dept,
        phone: emp.phone, mustChange: !!acc.mustChange };
      return { ok: true, me: SESSION };
    }
    case "/api/logout": SESSION = null; return { ok: true };
    case "/api/me": {
      const x = needMe();
      if (x.role === "admin") return { ok: true, me: x };
      return { ok: true, ...dMyView(x), me: { ...x } };
    }
    case "/api/password": {
      const x = needMe();
      const t = x.role === "admin"
        ? D.admins.find((a) => a.id === x.id)
        : D.accounts.find((a) => String(a.empNo) === String(x.empNo));
      if (!t) stop("계정을 찾을 수 없습니다.");
      if (String(t.pw) !== String(body.cur)) stop("지금 비밀번호가 맞지 않습니다.");
      const np = String(body.next || "");
      if (np.length < 4) stop("새 비밀번호는 4자리 이상으로 정해 주세요.");
      if (np === String(t.pw)) stop("지금 쓰는 비밀번호와 다르게 정해 주세요.");
      if (x.role === "staff" && np.length <= 4 && digits(np) === digits(x.phone).slice(-4))
        stop("연락처 뒷 4자리는 다른 사람도 쉽게 알 수 있습니다. 다른 번호로 정해 주세요.");
      t.pw = np; t.mustChange = false;
      SESSION = { ...x, mustChange: false }; saveDemo();
      return { ok: true };
    }

    /* ── 직원 ── */
    case "/api/apply": {
      const x = needMe();
      if (x.role !== "staff") stop("직원 계정으로 신청해 주세요.");
      const post = D.postings.find((z) => z.id === body.postId);
      if (!post) stop("해당 자원봉사를 찾을 수 없습니다.");
      if (post.closed) stop("모집이 마감된 자원봉사입니다.");
      if (deadlinePassed(post.deadline)) stop("모집 마감일이 지났습니다.");
      if (D.apps.some((a) => a.postId === post.id
        && String(a.empNo) === String(x.empNo) && LIVE3.includes(a.status)))
        stop("이미 신청하신 자원봉사입니다.");
      const mk = monthKey(post.when);
      for (const a of D.apps) {
        if (String(a.empNo) !== String(x.empNo) || !LIVE3.includes(a.status)) continue;
        const pp = D.postings.find((z) => z.id === a.postId);
        if (pp && monthKey(pp.when) === mk)
          stop(`${monthLabel(post.when)}에는 이미 신청한 자원봉사가 있습니다(${pp.name}). 봉사를 실시하는 달 기준으로 한 건만 신청할 수 있습니다.`);
      }
      const seat = dSeat(post.id), res = dRes(post.id), dn = dDept(post.id, x.dept);
      const deptOver = dn >= Number(post.deptLimit || 3);
      const full = seat >= Number(post.capacity || 0);
      if (!deptOver && full && res >= RESERVE_LIMIT)
        stop("정원과 예비 인원이 모두 찼습니다. 다음 기회에 접수 바랍니다.");
      const status = deptOver ? "excluded" : full ? "reserve" : "pending";
      const phone = String(body.phone || x.phone || "").trim();
      D.apps.push({ id: uid(), postId: post.id, empNo: x.empNo, name: x.name, dept: x.dept,
        phone, appliedAt: new Date().toISOString(), status });
      const emp = D.employees.find((e) => String(e.empNo) === String(x.empNo));
      if (emp && digits(phone).length >= 9) { emp.phone = phone; SESSION = { ...x, phone }; }
      saveDemo();
      return { ok: true, status, order: status === "reserve" ? res + 1 : seat + 1,
        message: deptOver ? MSG_DEPT_FULL : "", ...dMyView(SESSION) };
    }
    case "/api/donate": {
      const x = needMe();
      if (!String(body.item || "").trim()) stop("후원물품을 적어 주세요.");
      D.donations.push({ id: uid(), empNo: x.empNo, name: x.name, dept: x.dept,
        phone: x.phone || "", item: String(body.item).trim(), at: new Date().toISOString() });
      saveDemo();
      return { ok: true, ...dMyView(x) };
    }

    /* ── 담당자 ── */
    case "/api/admin/all":
      needAdm();
      return { ok: true,
        employees: D.employees.map((e) => ({ ...e })),
        accounts: D.accounts.map((a) => ({ empNo: a.empNo, mustChange: !!a.mustChange, locked: false })),
        records: D.records, postings: D.postings.map((p) => ({ ...p })),
        apps: D.apps.map((a) => ({ ...a })), donations: D.donations.map((x) => ({ ...x })),
        scores: dScores(), deptCheck: dDeptCheck(D.employees.filter(isActive)) };

    case "/api/admin/posting": {
      needAdm();
      const checkRow = (r) => {
        if (!String(r.org || "").trim() || !String(r.name || "").trim() || !r.when || !r.deadline)
          stop("기관·자원봉사명·일시·모집 마감일을 모두 입력해 주세요.");
        const dl = deadlineEnd(r.deadline);
        if (dl && new Date(r.when) < dl) stop("모집 마감일이 봉사 일시보다 늦습니다. 날짜를 확인해 주세요.");
      };
      if (body.action === "create") {
        body.rows.forEach(checkRow);
        for (const r of body.rows) D.postings.push({ id: uid(), org: String(r.org).trim(),
          name: String(r.name).trim(), when: r.when, deadline: r.deadline, type: r.type || "외부",
          hours: Number(r.hours) || 0, capacity: Number(r.capacity) || 0,
          deptLimit: Number(r.deptLimit) || 3, closed: false });
        saveDemo(); return { ok: true };
      }
      const pp = D.postings.find((z) => z.id === body.id);
      if (!pp) stop("공고를 찾을 수 없습니다.");
      if (body.action === "update") {
        const r = body.row; checkRow(r);
        Object.assign(pp, { org: String(r.org).trim(), name: String(r.name).trim(),
          when: r.when, deadline: r.deadline, type: r.type,
          hours: Number(r.hours) || 0, capacity: Number(r.capacity) || 0,
          deptLimit: Number(r.deptLimit) || 3 });
      } else if (body.action === "toggle") pp.closed = !pp.closed;
      else if (body.action === "delete") {
        D.postings = D.postings.filter((z) => z.id !== pp.id);
        D.apps = D.apps.filter((a) => a.postId !== pp.id);
      }
      saveDemo(); return { ok: true };
    }
    case "/api/admin/app-status": {
      needAdm();
      const set = new Set((Array.isArray(body.ids) ? body.ids : [body.ids]).map(String));
      let n = 0;
      for (const a of D.apps) if (set.has(String(a.id))) {
        a.status = body.status; a.decidedAt = new Date().toISOString(); n++;
      }
      saveDemo(); return { ok: true, count: n };
    }
    case "/api/admin/employee": {
      needAdm();
      if (body.action === "create") {
        const no = String(body.empNo || "").trim();
        if (!no) stop("사번을 입력해 주세요.");
        if (D.employees.some((e) => String(e.empNo) === no)) stop("이미 있는 사번입니다.");
        const pw = pwFromPhone(body.phone);
        D.employees.push({ empNo: no, name: String(body.name).trim(), dept: String(body.dept).trim(),
          phone: String(body.phone).trim(), status: "active", updatedAt: new Date().toISOString() });
        D.accounts.push({ empNo: no, pw, mustChange: true });
        saveDemo(); return { ok: true, empNo: no, pw };
      }
      const e = D.employees.find((z) => String(z.empNo) === String(body.empNo));
      if (!e) stop("직원을 찾을 수 없습니다.");
      if (body.action === "update")
        Object.assign(e, { name: String(body.name).trim(), dept: String(body.dept).trim(),
          phone: String(body.phone).trim(), updatedAt: new Date().toISOString() });
      else if (body.action === "retire") e.status = "retired";
      else if (body.action === "restore") e.status = "active";
      else if (body.action === "delete") {
        D.employees = D.employees.filter((z) => String(z.empNo) !== String(e.empNo));
        D.accounts = D.accounts.filter((z) => String(z.empNo) !== String(e.empNo));
      } else if (body.action === "resetPw") {
        const pw = pwFromPhone(e.phone);
        const acc = D.accounts.find((a) => String(a.empNo) === String(e.empNo));
        if (acc) { acc.pw = pw; acc.mustChange = true; }
        else D.accounts.push({ empNo: e.empNo, pw, mustChange: true });
        saveDemo(); return { ok: true, pw };
      }
      saveDemo(); return { ok: true };
    }
    case "/api/admin/upload": {
      needAdm();
      const rows = await readCsv(body);
      const hi = rows.findIndex((r) => r.some((c) =>
        ["사번", "사원번호", "이름", "성명", "사번 (입력)"].includes(String(c).trim())));
      if (hi < 0) stop("머리글 줄을 찾지 못했습니다. '사번'과 '이름' 칸이 있는지 확인해 주세요.");
      const H = rows[hi].map((h) => String(h || "").replace(/[\s()[\]/·.]/g, "").trim());
      const col = (names) => {
        for (const nm of names) { const i = H.indexOf(nm); if (i >= 0) return i; }
        for (const nm of names) { const i = H.findIndex((h) => h && h.includes(nm)); if (i >= 0) return i; }
        return -1;
      };
      const rest = rows.slice(hi + 1);
      if (q.get("kind") === "employees") {
        const c = { no: col(["사번", "사원번호", "사번입력"]), nm: col(["이름", "성명", "직원이름"]),
          dp: col(["부서병동", "부서", "소속", "병동"]), ph: col(["연락처", "휴대폰", "전화번호"]) };
        if (c.no < 0 || c.nm < 0) stop("'사번'과 '이름' 칸이 필요합니다.");
        const map = new Map(); let dup = 0;
        for (const r of rest) {
          const no = String(r[c.no] || "").trim(), nm = String(r[c.nm] || "").trim();
          if (!no || !nm) continue;
          if (map.has(no)) dup++;
          map.set(no, { empNo: no, name: nm, dept: String(r[c.dp] || "").trim(),
            phone: String(r[c.ph] || "").trim(), status: "active" });
        }
        const list = [...map.values()];
        if (!list.length) stop("읽을 수 있는 직원이 없습니다.");
        return { ok: true, filename: body.name || "업로드한 파일", count: list.length, dupCount: dup,
          diff: dDiff(D.employees, list), check: dDeptCheck(list), list };
      }
      const c = { no: col(["사번", "사원번호", "사번입력"]), nm: col(["이름", "성명", "직원이름"]),
        dt: col(["일자", "봉사일", "날짜"]), ct: col(["봉사내용", "내용"]),
        tp: col(["봉사구분", "대분류", "구분"]), hr: col(["봉사시간", "시간"]),
        cn: col(["인정횟수", "횟수"]), pt: col(["지급포인트", "포인트"]),
        ps: col(["포인트신청여부", "신청여부"]) };
      if (c.no < 0) stop("'사번' 칸이 필요합니다.");
      const out = [];
      for (const r of rest) {
        const no = String(r[c.no] || "").trim(); if (!no) continue;
        const cnt = r[c.cn];
        out.push({ empNo: no, name: String(r[c.nm] || "").trim(),
          date: String(r[c.dt] || "").trim(), content: String(r[c.ct] || "").trim(),
          type: String(r[c.tp] || "").includes("내부") ? "내부" : "외부",
          hours: Number(r[c.hr]) || 0,
          count: cnt === "" || cnt === undefined ? "" : Number(cnt),
          points: Number(String(r[c.pt] || "").replace(/[^\d.-]/g, "")) || 0,
          pointStatus: String(r[c.ps] || "").trim() });
      }
      if (!out.length) stop("읽을 수 있는 봉사 내역이 없습니다.");
      D.records = out; saveDemo();
      const known = new Set(D.employees.map((e) => String(e.empNo)));
      return { ok: true, count: out.length, orphan: out.filter((r) => !known.has(r.empNo)).length };
    }
    case "/api/admin/apply-employees": {
      needAdm();
      const diff = dDiff(D.employees, body.list);
      const map = new Map(D.employees.map((e) => [String(e.empNo), e]));
      for (const e of body.list)
        map.set(String(e.empNo), { ...(map.get(String(e.empNo)) || {}), ...e, status: "active" });
      if (body.retire) for (const e of diff.missing) {
        const t = map.get(String(e.empNo)); if (t) t.status = "retired";
      }
      D.employees = [...map.values()];
      const issued = [];
      if (body.makeAcc) {
        const have = new Set(D.accounts.map((a) => String(a.empNo)));
        for (const e of diff.added) {
          if (have.has(String(e.empNo))) continue;
          const pw = pwFromPhone(e.phone);
          D.accounts.push({ empNo: String(e.empNo), pw, mustChange: true });
          issued.push({ empNo: e.empNo, name: e.name, dept: e.dept, pw });
        }
      }
      saveDemo();
      return { ok: true, added: diff.added.length, changed: diff.changed.length,
        retired: body.retire ? diff.missing.length : 0, back: diff.back.length, issued };
    }
    case "/api/admin/donation-delete":
      needAdm();
      D.donations = D.donations.filter((x) => x.id !== body.id);
      saveDemo(); return { ok: true };
  }
  stop("없는 기능입니다.");
}

/* ── 올린 파일 읽기 — 체험판은 CSV만 ── */
async function readCsv(file) {
  if (!(file instanceof File)) stop("파일을 읽지 못했습니다.");
  if (/\.(xlsx|xls)$/i.test(file.name))
    stop("체험판은 엑셀 파일을 읽지 못합니다. 엑셀에서 [다른 이름으로 저장 → CSV UTF-8]로 저장해 올려 주세요. 원내 설치판은 .xlsx 를 그대로 읽습니다.");
  if (!/\.csv$/i.test(file.name)) stop("CSV 파일을 올려 주세요.");
  const buf = new Uint8Array(await file.arrayBuffer());
  let text;
  if (buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) text = new TextDecoder("utf-8").decode(buf).slice(1);
  else {
    text = new TextDecoder("utf-8").decode(buf);
    if (text.includes("\uFFFD")) { try { text = new TextDecoder("euc-kr").decode(buf); } catch { /* 그대로 */ } }
  }
  const rows = []; let row = [], cell = "", qq = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (qq) {
      if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else qq = false; }
      else cell += ch;
      continue;
    }
    if (ch === '"') { qq = true; continue; }
    if (ch === ",") { row.push(cell.trim()); cell = ""; continue; }
    if (ch === "\n") { row.push(cell.trim()); rows.push(row); row = []; cell = ""; continue; }
    if (ch === "\r") continue;
    cell += ch;
  }
  if (cell || row.length) { row.push(cell.trim()); rows.push(row); }
  return rows.filter((r) => r.some((c) => c !== ""));
}

/* ── 체험판에서는 파일 내려받기가 막혀 있어 내용을 보여줍니다 ── */
function downloadCsv(filename, rows) {
  if (!rows.length) { warn("내려받을 자료가 없습니다."); return; }
  const head = Object.keys(rows[0]);
  const wrap = document.createElement("div");
  wrap.className = "dlgwrap";
  wrap.innerHTML = `<div class="dlg" style="max-width:820px" role="dialog" aria-modal="true">
    <h3>${esc(filename)}</h3>
    <p>체험판은 파일 내려받기가 막혀 있어 내용만 보여드립니다. 원내 설치판에서는 같은 내용이
       CSV 파일로 저장되어 엑셀에서 바로 열립니다. (${rows.length}줄${rows.length > 60 ? " 중 앞 60줄" : ""})</p>
    <div class="scrollx" style="max-height:46vh;overflow:auto"><table class="tbl">
      <thead><tr>${head.map((h) => `<th style="white-space:nowrap">${esc(h)}</th>`).join("")}</tr></thead>
      <tbody>${rows.slice(0, 60).map((r) => `<tr>${head.map((h) =>
        `<td style="white-space:nowrap">${esc(r[h])}</td>`).join("")}</tr>`).join("")}</tbody>
    </table></div>
    <div class="btns" style="margin-top:16px;justify-content:flex-end">
      <button class="btn" data-close>닫기</button></div></div>`;
  wrap.addEventListener("click", (ev) => {
    if (ev.target === wrap || ev.target.closest("[data-close]")) wrap.remove();
  });
  document.body.appendChild(wrap);
  wrap.querySelector("[data-close]").focus();
}

/* ══════════ 로그인 화면에 체험 계정 안내를 덧붙입니다 ══════════ */
const baseLogin = screenLogin;
screenLogin = function () {
  const year = String(new Date().getFullYear());
  const rows = DEMO_EMP.map((e) => {
    const my = D.records.filter((r) => String(r.empNo) === e.empNo);
    const s = round2(my.filter((r) => String(r.date).startsWith(year))
      .reduce((a, r) => a + scoreOf(r), 0));
    return `<button class="row" data-act="fill" data-v="${e.empNo}" data-p="${e.pw}">
      <div class="r1"><b>${esc(e.name)}</b><span class="key">${e.empNo} / ${e.pw}</span></div>
      <div class="r2">${esc(e.dept)} · ${year}년 ${s}점${s < ANNUAL_DUTY
        ? ' <b style="color:var(--color-danger)">(의무 미충족)</b>' : ""} · 봉사 ${my.length}건</div>
    </button>`;
  }).join("");
  const notice = Note("amber", "<b>체험판입니다.</b> 서버 없이 이 브라우저 안에서만 돌아갑니다. "
    + "바꾸신 내용은 이 기기에만 남고 다른 사람에게는 보이지 않으며, "
    + "아래 계정은 실제 직원이 아닌 가명입니다.");
  const panel = `
    <div class="accs">
      <div style="text-align:center">
        <button class="linkb" data-act="toggleacc">
          ${S.showAcc ? "체험 계정 닫기" : "체험 계정으로 바로 들어가기 (담당자 1 · 직원 10)"}</button>
      </div>
      ${S.showAcc ? `<div class="inner" style="margin-top:12px">
        <div class="gh">담당자 — 누르면 바로 들어갑니다</div>
        <button class="row" data-act="fill" data-v="admin" data-p="1234">
          <div class="r1"><b>사회사업실 담당자</b><span class="key">admin / 1234</span></div>
          <div class="r2">모집 공고 등록 · 신청 승인 · 직원 관리 · 명단 내려받기</div></button>
        <div class="gh">직원 — 누르면 바로 들어갑니다</div>${rows}
      </div>` : ""}
      <div style="text-align:center;margin-top:16px">
        <button class="linkb" data-act="resetdemo">체험 내용 지우고 처음 상태로</button></div>
    </div>`;
  return baseLogin()
    .replace('<div class="box">', notice + '<div class="box">')
    .replace('<div class="mission">', panel + '<div class="mission">');
};

/* ── 체험 자료 읽기 ── */
loadDemo();
