"use client"

import * as Sentry from "@sentry/nextjs"
import { useEffect } from "react"

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("[Error Boundary]", error)
    Sentry.captureException(error)
  }, [error])

  return (
    <div className="flex min-h-screen items-center justify-center bg-black text-zinc-100">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(800px_circle_at_50%_40%,rgba(239,68,68,0.1),transparent_55%)]" />
      </div>

      <div className="relative mx-4 max-w-md text-center">
        <div className="mx-auto mb-6 grid size-16 place-items-center rounded-2xl border border-red-400/30 bg-red-400/10 text-red-400">
          <svg
            className="size-8"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
            />
          </svg>
        </div>

        <h1 className="mb-2 text-xl font-bold text-zinc-100">
          시스템 오류 발생
        </h1>
        <p className="mb-8 text-sm leading-relaxed text-zinc-500">
          예기치 않은 오류가 발생했습니다.
          <br />
          잠시 후 다시 시도해주세요.
        </p>

        <button
          onClick={reset}
          className="inline-flex items-center gap-2 rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-6 py-3 text-sm font-medium text-cyan-200 transition hover:bg-cyan-400/20 hover:shadow-[0_0_20px_rgba(34,211,238,0.2)]"
        >
          다시 시도
        </button>
      </div>
    </div>
  )
}
