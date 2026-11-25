"use client";
import { PopMenu } from "./Ui";
import { Icon } from "./Icons";
import { canEditRoom, type Me } from "@/lib/perm";
import { toMin } from "@/lib/util";
import type { Appt, Item, Patient, Room, Status } from "@/lib/types";

const hm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
interface Props {
  a: Appt; patient?: Patient; item?: Item; room?: Room; conflict?: string; today: string; nowMin: number; me: Me | null;
  onOpen: (a: Appt) => void; onStatus: (a: Appt, s: Status) => void; showRoom?: boolean; delay?: number;
}
/** C09 일정 카드 — 진행 중은 그라데이션, 지난 일정은 50% 투명 */
export default function ApptCard({ a, patient, item, room, conflict, today, nowMin, me, onOpen, onStatus, showRoom = true, delay = 0 }: Props) {
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
