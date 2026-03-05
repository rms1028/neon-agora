"use client"

import * as Sentry from "@sentry/nextjs"
import { useEffect } from "react"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html lang="ko">
      <body className="bg-black text-zinc-100">
        <div className="flex min-h-screen items-center justify-center">
          <div className="mx-4 max-w-md text-center">
            <h1 className="mb-4 text-xl font-bold">시스템 오류 발생</h1>
            <p className="mb-6 text-sm text-zinc-400">
              예기치 않은 오류가 발생했습니다. 잠시 후 다시 시도해주세요.
            </p>
            <button
              onClick={reset}
              className="rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-6 py-3 text-sm font-medium text-cyan-200 transition hover:bg-cyan-400/20"
            >
              다시 시도
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
