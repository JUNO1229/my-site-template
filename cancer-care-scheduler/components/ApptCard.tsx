"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { PopMenu } from "./Ui";
import { Icon } from "./Icons";
import { canEditRoom, type Me } from "@/lib/perm";
import { useUi } from "@/lib/ui";
import { toMin } from "@/lib/util";
import { isOff, type Appt, type Item, type Patient, type Room, type Status } from "@/lib/types";

/** 카드에 마우스를 올리면 뜨는 상세 정보창 (시스템 스타일) */
function HoverTip({ anchor, children }: { anchor: HTMLElement; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null); const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  useEffect(() => {
    const r = anchor.getBoundingClientRect(), m = ref.current; if (!m) return;
    const w = m.offsetWidth, h = m.offsetHeight;
    const top = r.bottom + 8 + h > innerHeight - 8 ? Math.max(8, r.top - 8 - h) : r.bottom + 8;
    setPos({ top, left: Math.min(Math.max(8, r.left), innerWidth - w - 8) });
  }, [anchor]);
  return createPortal(<div ref={ref} className="hovertip" role="tooltip" style={{ top: pos?.top ?? 0, left: pos?.left ?? 0, visibility: pos ? "visible" : "hidden" }}>{children}</div>, document.body);
}
const hm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
interface Props {
  a: Appt; patient?: Patient; item?: Item; room?: Room; conflict?: string; today: string; nowMin: number; me: Me | null;
  onOpen: (a: Appt) => void; onStatus: (a: Appt, s: Status) => void; showRoom?: boolean; delay?: number; compact?: boolean; hideItem?: boolean;
}
/** C09 일정 카드 — 진행 중은 그라데이션, 지난 일정은 50% 투명 */
export default function ApptCard({ a, patient, item, room, conflict, today, nowMin, me, onOpen, onStatus, showRoom = true, delay = 0, compact = false, hideItem = false }: Props) {
  const s = toMin(a.time), e = s + (item?.duration ?? 50);
  const current = a.date === today && !isOff(a.status) && nowMin >= s && nowMin < e;
  const past = !current && (a.date < today || (a.date === today && nowMin >= e));
  const can = canEditRoom(me, item?.roomId); const { openMove } = useUi();
  const menu = [
    ...(can && a.status !== "완료" ? [{ label: "완료 처리", onClick: () => onStatus(a, "완료") }] : []),
    ...(can && a.status !== "예약" ? [{ label: "예약으로 되돌리기", onClick: () => onStatus(a, "예약") }] : []),
    ...(can && a.status !== "연기" ? [{ label: "연기 처리", onClick: () => onStatus(a, "연기") }] : []),
    ...(can && (a.status === "예약" || (a.status === "연기" && !/로 옮김/.test(a.memo))) ? [{ label: "연기 후 다른 날로 옮기기", onClick: () => openMove(a) }] : []),
    ...(can && a.status !== "취소" ? [{ label: "예약 취소", danger: true, onClick: () => onStatus(a, "취소") }] : []),
    { label: can ? "상세·수정" : "상세 보기", onClick: () => onOpen(a) },
  ];
  const [tipEl, setTipEl] = useState<HTMLElement | null>(null); const tipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tipOn = (e: React.MouseEvent<HTMLElement>) => { const el = e.currentTarget; if (tipTimer.current) clearTimeout(tipTimer.current); tipTimer.current = setTimeout(() => setTipEl(el), 280); };
  const tipOff = () => { if (tipTimer.current) clearTimeout(tipTimer.current); setTipEl(null); };
  useEffect(() => () => { if (tipTimer.current) clearTimeout(tipTimer.current); }, []);
  if (compact) return ( // 한 화면에 하루 일정이 모두 보이도록 1줄로 압축한 카드: 시작시간 · 이름(병동) · (옵션/치료) · 완료·충돌 표시 · 메뉴
    <div className={`acard compact ${current ? "current" : ""} ${past ? "past" : ""} s-${a.status} ${conflict ? "conflict" : ""}`} style={{ animationDelay: `${delay}ms` }}
      role="button" tabIndex={0} onClick={() => onOpen(a)} onKeyDown={(ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); onOpen(a); } }}
      onMouseEnter={tipOn} onMouseLeave={tipOff} onMouseDown={tipOff}
      aria-label={`${a.time} ${patient?.name ?? ""} ${item?.name ?? ""} ${a.status}`}>
      <span className="ac-t">{hm(s)}</span>
      <div className="ac-body">
        <span className="ac-n"><b>{patient?.name ?? "?"}</b>{a.option && <em className="ac-opt">{a.option}</em>}{!hideItem && item?.name && <em className="ac-it">{item.name}</em>}
          {patient?.ward && (patient.ward === "외" ? <small className="out"><span className="full">외래</span><span className="short">외</span></small> : <small>{patient.ward}병동</small>)}</span>
      </div>
      {conflict && <span className="warn-ic"><Icon name="alert" size={14} /></span>}
      <span className="ac-s">{current && <em className="ac-live">진행 중</em>}<em className={`pill st-${a.status}`} aria-label={a.status}>{a.status === "완료" && <Icon name="check" size={11} />}<span className="full">{a.status}</span>{a.status !== "완료" && <span className="short">{a.status.slice(0, 1)}</span>}</em></span>
      <span onMouseEnter={tipOff}><PopMenu items={menu} label="일정 메뉴" tone={current ? "on-grad" : ""} /></span>
      {tipEl && <HoverTip anchor={tipEl}>
        <div className="ht-head"><b>{patient?.name ?? "?"}</b>{patient?.ward && <span>{patient.ward === "외" ? "외래" : `${patient.ward}병동`}{patient.bed ? ` · ${patient.bed}${/^\d/.test(patient.bed) ? "호" : ""}` : ""}</span>}<em className={`pill st-${a.status}`}>{a.status}</em></div>
        <dl>
          <dt>시간</dt><dd>{hm(s)} – {hm(e)}{current && <i className="ht-live">진행 중</i>}</dd>
          <dt>치료</dt><dd>{room?.name}{item && item.name !== room?.name ? ` · ${item.name}` : ""}</dd>
          <dt>옵션</dt><dd>{a.option || "J"}</dd>
          {a.memo && <><dt>비고</dt><dd>{a.memo}</dd></>}
        </dl>
        {conflict && <p className="ht-warn"><Icon name="alert" size={13} /> {conflict}</p>}
      </HoverTip>}
    </div>
  );
  return (
    <div className={`acard ${current ? "current" : ""} ${past ? "past" : ""} s-${a.status} ${conflict ? "conflict" : ""}`} style={{ animationDelay: `${delay}ms` }}
      role="button" tabIndex={0} onClick={() => onOpen(a)} onKeyDown={(ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); onOpen(a); } }}
      aria-label={`${a.time} ${patient?.name ?? ""} ${item?.name ?? ""} ${a.status}`}>
      <div className="ac-main">
        <div className="ac-title">{patient?.name ?? "?"}{patient?.ward && <small>{patient.ward === "외" ? "외래" : `${patient.ward}병동`}</small>}
          {conflict && <span className="warn-ic" title={conflict}><Icon name="alert" size={15} /></span>}</div>
        <div className="ac-cap">{item?.name}{a.option && ` · ${a.option}`}{showRoom && room && ` · ${room.name}`}</div>
        <div className="ac-time"><Icon name="clock" size={13} />{hm(s)} – {hm(e)}{current && <b className="live">진행 중</b>}</div>
      </div>
      <div className="ac-side">
        <span className={`pill st-${a.status}`}>{a.status === "완료" && <Icon name="check" size={12} />}{a.status}</span>
        <PopMenu items={menu} label="일정 메뉴" tone={current ? "on-grad" : ""} />
      </div>
    </div>
  );
}
