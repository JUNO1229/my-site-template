import { HttpError } from "./auth";
import { isDate, need, str } from "./validate";

export function validSickroom(b: Record<string, unknown>) {
  const roomNo = str(b.roomNo, 10); need(/^[0-9A-Za-z가-힣-]{1,10}$/.test(roomNo), "병실번호는 숫자/문자/하이픈 10자 이내로 입력해 주세요");
  const beds = Number(b.beds); need(Number.isInteger(beds) && beds >= 1 && beds <= 30, "병상수는 1~30 사이 정수여야 합니다");
  const start = str(b.startDate, 10), end = str(b.endDate, 10);
  need(!start || isDate(start), "시작일 형식이 올바르지 않습니다"); need(!end || isDate(end), "종료일 형식이 올바르지 않습니다");
  if (start && end && end < start) throw new HttpError(400, "종료일은 시작일 이후여야 합니다");
  return { roomNo, beds, start, end, note: str(b.note, 200) };
}
