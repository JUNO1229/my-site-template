"use client";
import { PopMenu } from "./Ui";
import { Icon } from "./Icons";
import { canEditRoom, type Me } from "@/lib/perm";
import { toMin } from "@/lib/util";
import type { Appt, Item, Patient, Room, Status } from "@/lib/types";

const hm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
interface Props {
  a: Appt; patient?: Patient; item?: Item; room?: Room; conflict?: string; today: string; nowMin: number; me: Me | null;
  onOpen: (a: Appt) => void; onStatus: (a: Appt, s: Status) => void; showRoom?: boolean; delay?: number; compact?: boolean; hideItem?: boolean;
}
/** C09 일정 카드 — 진행 중은 그라데이션, 지난 일정은 50% 투명 */
export default function ApptCard({ a, patient, item, room, conflict, today, nowMin, me, onOpen, onStatus, showRoom = true, delay = 0, compact = false, hideItem = false }: Props) {
  const s = toMin(a.time), e = s + (item?.duration ?? 50);
  const current = a.date === today && a.status !== "취소" && nowMin >= s && nowMin < e;
  const past = !current && (a.date < today || (a.date === today && nowMin >= e));
  const can = canEditRoom(me, item?.roomId);
  const menu = [
    ...(can && a.status !== "완료" ? [{ label: "완료 처리", onClick: () => onStatus(a, "완료") }] : []),
    ...(can && a.status !== "예약" ? [{ label: "예약으로 되돌리기", onClick: () => onStatus(a, "예약") }] : []),
    ...(can && a.status !== "취소" ? [{ label: "예약 취소", danger: true, onClick: () => onStatus(a, "취소") }] : []),
    { label: can ? "상세·수정" : "상세 보기", onClick: () => onOpen(a) },
  ];
  if (compact) return ( // 한 화면에 하루 일정이 모두 보이도록 1줄로 압축한 카드: 시작시간 · 이름(병동) · (옵션/치료) · 완료·충돌 표시 · 메뉴
    <div className={`acard compact ${current ? "current" : ""} ${past ? "past" : ""} s-${a.status} ${conflict ? "conflict" : ""}`} style={{ animationDelay: `${delay}ms` }}
      role="button" tabIndex={0} onClick={() => onOpen(a)} onKeyDown={(ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); onOpen(a); } }}
      title={`${hm(s)}–${hm(e)} ${item?.name ?? ""}${a.option ? " · " + a.option : ""} · ${a.status}${current ? " · 진행 중" : ""}`}
      aria-label={`${a.time} ${patient?.name ?? ""} ${item?.name ?? ""} ${a.status}`}>
      <span className="ac-t">{hm(s)}</span>
      <span className="ac-n"><b>{patient?.name ?? "?"}</b>{patient?.ward && (patient.ward === "외" ? <small className="out"><span className="full">외래</span><span className="short">외</span></small> : <small>{patient.ward}병동</small>)}
        {a.option && <em className="ac-opt">{a.option}</em>}{!hideItem && item?.name && <em className="ac-it">{item.name}</em>}</span>
      {current && <i className="live-dot" title="진행 중" />}
      {conflict && <span className="warn-ic" title={conflict}><Icon name="alert" size={14} /></span>}
      {a.status === "완료" && <span className="ac-done" title="치료완료"><Icon name="check" size={14} /></span>}{a.status === "취소" && <span className="ac-cancel">취소</span>}
      <PopMenu items={menu} label="일정 메뉴" tone={current ? "on-grad" : ""} />
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
