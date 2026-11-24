import { isDate, need, str, WARDS } from "./validate";

export function validPatient(b: Record<string, unknown>) {
  const name = str(b.name, 50); need(name, "환자명을 입력해 주세요");
  const ward = str(b.ward); need(WARDS.includes(ward), "병동이 올바르지 않습니다");
  const d = (v: unknown) => { const s = str(v); need(!s || isDate(s), "날짜 형식이 올바르지 않습니다"); return s; };
  const amt = b.contractAmount === null || b.contractAmount === "" || b.contractAmount === undefined ? null : Number(b.contractAmount);
  need(amt === null || (Number.isInteger(amt) && amt >= 0 && amt <= 2000000000), "계약금액은 0 이상의 정수여야 합니다");
  return { contractAmount: amt, name, ward, chartNo: str(b.chartNo, 30), bed: str(b.bed, 20), admit: d(b.admitDate), discharge: d(b.dischargeDate), plan: str(b.plan, 500), notes: str(b.notes, 500) };
}
