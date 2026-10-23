import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-lg flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="rounded-full bg-demo-soft px-3 py-1 text-sm font-semibold text-demo">404</p>
      <h1 className="text-2xl font-bold">화면을 찾을 수 없습니다</h1>
      <p className="text-ink-2">주소가 바뀌었거나 아직 만들지 않은 화면입니다. 향후 확장 기능은 &lsquo;확장 미리보기&rsquo;에서 확인할 수 있습니다.</p>
      <div className="flex gap-2">
        <Link href="/dashboard" className="press rounded-xl bg-primary px-5 py-3 font-semibold text-primary-fg">대시보드로</Link>
        <Link href="/future" className="press rounded-xl border border-line px-5 py-3 font-semibold">확장 미리보기</Link>
      </div>
    </main>
  );
}
