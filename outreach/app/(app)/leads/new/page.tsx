import LeadForm from "@/components/LeadForm"
export default function New() {
  return <div className="space-y-3"><h1 className="text-lg font-bold">영업대상 직접 입력</h1><LeadForm />
    <p className="text-xs text-slate-500">같은 기관+이메일(또는 담당자)이 이미 있으면 새로 만들지 않고 정보를 병합합니다. 수신동의는 실제로 확인된 경우에만 체크하세요.</p></div>
}
