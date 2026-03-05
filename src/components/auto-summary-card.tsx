"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Sparkles, ThumbsUp, ThumbsDown, Lightbulb, ListChecks } from "lucide-react"

import { supabase } from "@/lib/supabase"
import { useAuth } from "@/components/auth-provider"

// ── 타입 ──────────────────────────────────────────────────────────────────────

export type AutoSummary = {
  key_points: string[]
  pro_main: string
  con_main: string
  consensus: string
  generated_at?: string
}

type SummaryState = "hidden" | "generating" | "done"

const SCAN_STEPS = [
  "댓글 데이터 수집 중...",
  "찬반 논점 분석 중...",
  "핵심 포인트 추출 중...",
]

// ── 메인 컴포넌트 ─────────────────────────────────────────────────────────────

export function AutoSummaryCard({
  threadId,
  commentCount,
  initialSummary,
}: {
  threadId: string
  commentCount: number
  initialSummary: AutoSummary | null
}) {
  const { user } = useAuth()
  const [summary, setSummary] = useState<AutoSummary | null>(initialSummary)
  const [state, setState] = useState<SummaryState>(() => {
    if (initialSummary) return "done"
    if (commentCount >= 10) return "generating"
    return "hidden"
  })
  const [stepIdx, setStepIdx] = useState(0)
  const stepTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const requested = useRef(false)

  // ── 실시간 구독: 다른 유저가 트리거한 요약도 즉시 반영 ──
  useEffect(() => {
    const channel = supabase
      .channel(`auto-summary-${threadId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "threads",
          filter: `id=eq.${threadId}`,
        },
        (payload) => {
          const row = payload.new as Record<string, unknown>
          if (!row.ai_auto_summary) return

          let parsed: AutoSummary
          if (typeof row.ai_auto_summary === "string") {
            try {
              parsed = JSON.parse(row.ai_auto_summary)
            } catch {
              return
            }
          } else {
            parsed = row.ai_auto_summary as AutoSummary
          }

          // 빈 잠금 객체({})는 무시
          if (!parsed.key_points) return

          setSummary(parsed)
          setState("done")
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [threadId])

  // ── 자동 요약 요청 ──
  const requestSummary = useCallback(async () => {
    if (requested.current || !user) return
    requested.current = true

    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session?.access_token) return

    const res = await fetch("/api/auto-summary", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ threadId }),
    })

    if (res.ok) {
      const data = (await res.json()) as AutoSummary
      if (data.key_points) {
        setSummary(data)
        setState("done")
      }
    } else {
      // 409 = 이미 생성 중, realtime으로 결과 올 것
      if (res.status !== 409) {
        setState("hidden")
      }
    }
  }, [user, threadId])

  // ── generating 상태일 때 자동 요청 ──
  useEffect(() => {
    if (state === "generating" && user && !requested.current) {
      requestSummary()
    }
  }, [state, user, requestSummary])

  // ── 스캔 애니메이션 스텝 ──
  useEffect(() => {
    if (state === "generating") {
      stepTimer.current = setInterval(() => {
        setStepIdx((i) => (i + 1) % SCAN_STEPS.length)
      }, 2000)
    } else {
      if (stepTimer.current) clearInterval(stepTimer.current)
      setStepIdx(0)
    }
    return () => {
      if (stepTimer.current) clearInterval(stepTimer.current)
    }
  }, [state])

  // ── hidden ──
  if (state === "hidden") return null

  // ── generating ──
  if (state === "generating" && !summary) {
    return (
      <div
        className="relative overflow-hidden rounded-2xl border border-emerald-400/30 bg-black/50 p-5 backdrop-blur"
        style={{ boxShadow: "0 0 40px rgba(52,211,153,0.10)" }}
      >
        {/* 스캔라인 */}
        <div className="pointer-events-none absolute inset-x-0 top-0">
          <div className="cyber-scan-line absolute inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-emerald-400 to-transparent" />
        </div>

        <div className="relative space-y-4">
          <div className="flex items-center gap-3">
            <div
              className="grid size-9 place-items-center rounded-xl border border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
              style={{
                boxShadow: "0 0 16px rgba(52,211,153,0.35)",
                animation: "badge-glow 1.5s ease-in-out infinite",
              }}
            >
              <Sparkles className="size-4" />
            </div>
            <div>
              <div
                className="font-mono text-xs font-black tracking-[0.3em] text-emerald-300"
                style={{ textShadow: "0 0 10px rgba(52,211,153,0.7)" }}
              >
                AUTO SUMMARIZING<span className="cursor-blink">_</span>
              </div>
              <div className="text-[9px] tracking-widest text-zinc-600">
                댓글 {commentCount}개 분석 중
              </div>
            </div>
          </div>

          <div className="space-y-1.5 rounded-xl border border-white/[0.06] bg-black/40 p-3">
            {SCAN_STEPS.map((step, i) => (
              <div
                key={step}
                className={`flex items-center gap-2 font-mono text-[11px] transition-all duration-700 ${
                  i < stepIdx
                    ? "text-emerald-300/60"
                    : i === stepIdx
                      ? "text-emerald-200"
                      : "text-zinc-700"
                }`}
              >
                <span
                  className={
                    i < stepIdx
                      ? "text-emerald-500"
                      : i === stepIdx
                        ? "text-emerald-400"
                        : "text-zinc-700"
                  }
                >
                  {i < stepIdx ? "✓" : i === stepIdx ? ">" : "·"}
                </span>
                {step}
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // ── done ──
  if (!summary) return null

  return (
    <div className="summary-reveal">
      <div
        className="rounded-3xl bg-gradient-to-r from-emerald-500/20 via-teal-500/12 to-cyan-400/12 p-px"
        style={{ boxShadow: "0 0 50px rgba(52,211,153,0.12)" }}
      >
        <div className="relative overflow-hidden rounded-3xl border border-emerald-400/25 bg-black/55 backdrop-blur">
          {/* 그리드 배경 */}
          <div
            className="pointer-events-none absolute inset-0 opacity-50"
            style={{
              backgroundImage:
                "linear-gradient(rgba(52,211,153,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(52,211,153,0.04) 1px, transparent 1px)",
              backgroundSize: "20px 20px",
            }}
          />

          <div className="relative space-y-5 p-5">
            {/* 헤더 */}
            <div className="flex items-center gap-3">
              <div
                className="grid size-9 shrink-0 place-items-center rounded-xl border border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
                style={{ boxShadow: "0 0 14px rgba(52,211,153,0.4)" }}
              >
                <Sparkles className="size-4" />
              </div>
              <div>
                <div
                  className="font-mono text-xs font-black tracking-[0.3em] text-emerald-300"
                  style={{ textShadow: "0 0 10px rgba(52,211,153,0.6)" }}
                >
                  AI AUTO SUMMARY
                </div>
                <div className="text-[9px] tracking-widest text-zinc-600">
                  {commentCount}개 댓글 기반 자동 생성
                </div>
              </div>
            </div>

            {/* 핵심 포인트 */}
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4">
              <div className="mb-2.5 flex items-center gap-1.5">
                <ListChecks className="size-3.5 text-emerald-400" />
                <span className="text-[9px] font-bold tracking-widest text-emerald-400">
                  핵심 포인트
                </span>
              </div>
              <ul className="space-y-1.5">
                {summary.key_points.map((point, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 font-mono text-xs leading-relaxed text-zinc-300"
                  >
                    <span className="mt-0.5 shrink-0 text-emerald-400/70">•</span>
                    {point}
                  </li>
                ))}
              </ul>
            </div>

            {/* 찬반 핵심 논점 2단 */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/[0.04] p-4">
                <div className="mb-2 flex items-center gap-1.5">
                  <ThumbsUp className="size-3 text-cyan-400" />
                  <span className="text-[9px] font-bold tracking-widest text-cyan-400">
                    찬성 핵심 논점
                  </span>
                </div>
                <p className="font-mono text-xs leading-relaxed text-zinc-300">
                  {summary.pro_main}
                </p>
              </div>

              <div className="rounded-2xl border border-fuchsia-400/20 bg-fuchsia-400/[0.04] p-4">
                <div className="mb-2 flex items-center gap-1.5">
                  <ThumbsDown className="size-3 text-fuchsia-400" />
                  <span className="text-[9px] font-bold tracking-widest text-fuchsia-400">
                    반대 핵심 논점
                  </span>
                </div>
                <p className="font-mono text-xs leading-relaxed text-zinc-300">
                  {summary.con_main}
                </p>
              </div>
            </div>

            {/* 합의점 */}
            <div className="rounded-2xl border border-emerald-400/15 bg-emerald-400/[0.03] p-4">
              <div className="mb-2 flex items-center gap-1.5">
                <Lightbulb className="size-3.5 text-emerald-300" />
                <span className="text-[9px] font-bold tracking-widest text-emerald-300">
                  합의점 / 핵심 쟁점
                </span>
              </div>
              <p className="font-mono text-xs leading-relaxed text-zinc-200">
                {summary.consensus}
              </p>
            </div>

            {/* 생성 시간 */}
            {summary.generated_at && (
              <div className="text-right font-mono text-[10px] text-zinc-600">
                GENERATED:{" "}
                {(() => {
                  const d = new Date(summary.generated_at!)
                  const pad = (n: number) => String(n).padStart(2, "0")
                  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
                })()}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
