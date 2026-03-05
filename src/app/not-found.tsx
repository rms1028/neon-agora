import Link from "next/link"

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-black text-zinc-100">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(800px_circle_at_50%_40%,rgba(236,72,153,0.12),transparent_55%)]" />
      </div>

      <div className="relative mx-4 max-w-md text-center">
        {/* glitch 404 */}
        <div className="mb-6 text-8xl font-black tracking-tighter">
          <span className="bg-gradient-to-r from-fuchsia-400 via-cyan-300 to-fuchsia-400 bg-clip-text text-transparent">
            404
          </span>
        </div>

        <h1 className="mb-2 text-xl font-bold text-zinc-100">
          신호를 찾을 수 없습니다
        </h1>
        <p className="mb-8 text-sm leading-relaxed text-zinc-500">
          요청한 페이지가 네온 아고라에 존재하지 않거나,
          <br />
          이미 삭제되었습니다.
        </p>

        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-6 py-3 text-sm font-medium text-cyan-200 transition hover:bg-cyan-400/20 hover:shadow-[0_0_20px_rgba(34,211,238,0.2)]"
        >
          홈으로 돌아가기
        </Link>
      </div>
    </div>
  )
}
