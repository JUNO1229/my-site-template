import Link from 'next/link'
export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-5 py-12">
      <div><span className="logo" style={{ width: 48, height: 48, fontSize: 24 }}>P</span>
        <h1 className="serif mt-4 text-3xl font-extrabold">프레스노트</h1>
        <p className="mt-2 text-muted">현장에서 사진과 메모를 보내면, 편집국이 기사로 만들어 확인을 받은 뒤 당일 게재합니다.</p></div>
      <Link href="/m" className="btn btn-primary btn-lg">고객 제보하기 (모바일)</Link>
      <Link href="/desk" className="btn btn-lg">편집국 로그인</Link>
    </main>
  )
}
