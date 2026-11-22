import { unsubscribe } from "@/app/actions"

export const dynamic = "force-dynamic"
export default async function Unsub({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  async function confirmIt() { "use server"; await unsubscribe(token) }
  return (
    <main className="mx-auto mt-24 max-w-sm">
      <form action={confirmIt} className="card space-y-3 text-center">
        <h1 className="font-bold">수신거부</h1>
        <p className="text-sm text-slate-600">버튼을 누르면 이후 이메일·문자 발송이 모두 중단됩니다.</p>
        <button className="btn w-full">수신거부 확정</button>
      </form>
    </main>
  )
}
