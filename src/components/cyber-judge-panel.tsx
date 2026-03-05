"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  Bot,
  ChevronDown,
  Crown,
  Loader2,
  Scale,
  Shield,
  Sparkles,
  Swords,
  ThumbsUp,
  Zap,
} from "lucide-react"

import { supabase } from "@/lib/supabase"
import { useAuth } from "@/components/auth-provider"
import { useToast } from "@/components/toast-provider"

// ── 타입 ─────────────────────────────────────────────────────────────────────

export type JudgeResult = {
  pro_summary: string
  con_summary: string
  winner: "pro" | "con" | "draw"
  verdict_reason: string
  pro_score: number
  con_score: number
  judged_at?: string
}

// ── 상수 ─────────────────────────────────────────────────────────────────────

const MIN_PER_SIDE = 3
const EARLY_VOTE_THRESHOLD = 10

const ANALYZE_STEPS = [
  "토론 데이터 수집 중...",
  "찬반 논리 패턴 분석 중...",
  "판결문 작성 중...",
]

// ── 조기 판결 투표 게이지 ──────────────────────────────────────────────────────

function EarlyVoteGauge({
  count,
  threshold,
}: {
  count: number
  threshold: number
}) {
  const pct = Math.min(100, (count / threshold) * 100)
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-[10px]">
        <span className="text-zinc-500">조기 판결 동의</span>
        <span className="font-semibold text-[#00FFD1]">
          {count}/{threshold}명
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/[0.06] ring-1 ring-white/[0.08]">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#00FFD1] to-[#00FFD1]/50 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

// ── 판결 스코어 게이지 ────────────────────────────────────────────────────────

function ScoreGauge({
  proScore,
  conScore,
  winner,
}: {
  proScore: number
  conScore: number
  winner: "pro" | "con" | "draw"
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span
          className={`inline-flex items-center gap-1 ${
            winner === "pro"
              ? "font-semibold text-[#00FFD1]"
              : "text-[#00FFD1]/60"
          }`}
        >
          찬성 {proScore}%
          {winner === "pro" && <Crown className="size-3" />}
        </span>
        <span className="text-[10px] tracking-widest text-zinc-600">
          LOGIC SCORE
        </span>
        <span
          className={`inline-flex items-center gap-1 ${
            winner === "con"
              ? "font-semibold text-[#FF00FF]"
              : "text-[#FF00FF]/60"
          }`}
        >
          {winner === "con" && <Crown className="size-3" />}
          반대 {conScore}%
        </span>
      </div>

      <div className="relative h-3 overflow-hidden rounded-full bg-white/[0.06] ring-1 ring-white/10">
        <div
          className={`absolute inset-y-0 left-0 rounded-l-full transition-all duration-1000 ${
            winner === "pro"
              ? "gauge-shimmer bg-gradient-to-r from-[#00FFD1] via-[#00FFD1]/80 to-emerald-400"
              : "bg-gradient-to-r from-[#00FFD1]/50 to-[#00FFD1]/30"
          }`}
          style={{
            width: `${proScore}%`,
            boxShadow:
              winner === "pro"
                ? "0 0 14px rgba(0,255,209,0.5), inset 0 1px 0 rgba(255,255,255,0.2)"
                : undefined,
          }}
        />
        <div
          className={`absolute inset-y-0 right-0 rounded-r-full transition-all duration-1000 ${
            winner === "con"
              ? "gauge-shimmer bg-gradient-to-l from-[#FF00FF] via-[#FF00FF]/80 to-pink-400"
              : "bg-gradient-to-l from-[#FF00FF]/50 to-[#FF00FF]/30"
          }`}
          style={{
            width: `${conScore}%`,
            boxShadow:
              winner === "con"
                ? "0 0 14px rgba(255,0,255,0.5), inset 0 1px 0 rgba(255,255,255,0.2)"
                : undefined,
          }}
        />
        <div
          className="pointer-events-none absolute inset-y-0 z-10 w-px bg-white/25"
          style={{
            left: `${proScore}%`,
            transition: "left 1000ms cubic-bezier(0.34, 1.56, 0.64, 1)",
          }}
        />
      </div>
    </div>
  )
}

// ── 판결 카드 (펼침 시 표시) ─────────────────────────────────────────────────

function VerdictCard({ summary }: { summary: JudgeResult }) {
  const win = summary.winner

  const theme =
    win === "pro"
      ? {
          gradient: "from-[#00FFD1]/20 via-emerald-500/10 to-transparent",
          border: "border-[#00FFD1]/30",
          glow: "0 0 40px rgba(0,255,209,0.15), 0 0 80px rgba(0,255,209,0.06)",
          icon: "border-[#00FFD1]/30 bg-[#00FFD1]/10 text-[#00FFD1]",
          iconGlow: "0 0 18px rgba(0,255,209,0.4)",
          label: "찬성 측 승리",
          labelClass:
            "border-[#00FFD1]/50 bg-[#00FFD1]/15 text-[#00FFD1] shadow-[0_0_18px_rgba(0,255,209,0.3)]",
          proBox: "border-[#00FFD1]/30 bg-[#00FFD1]/[0.06]",
          conBox: "border-white/10 bg-white/[0.03]",
          verdictBox: "border-[#00FFD1]/20 bg-[#00FFD1]/[0.04]",
          verdictTitle: "text-[#00FFD1]",
          scanColor: "rgba(0,255,209,0.4)",
        }
      : win === "con"
        ? {
            gradient: "from-[#FF00FF]/20 via-pink-500/10 to-transparent",
            border: "border-[#FF00FF]/30",
            glow: "0 0 40px rgba(255,0,255,0.15), 0 0 80px rgba(255,0,255,0.06)",
            icon: "border-[#FF00FF]/30 bg-[#FF00FF]/10 text-[#FF00FF]",
            iconGlow: "0 0 18px rgba(255,0,255,0.4)",
            label: "반대 측 승리",
            labelClass:
              "border-[#FF00FF]/50 bg-[#FF00FF]/15 text-[#FF00FF] shadow-[0_0_18px_rgba(255,0,255,0.3)]",
            proBox: "border-white/10 bg-white/[0.03]",
            conBox: "border-[#FF00FF]/30 bg-[#FF00FF]/[0.06]",
            verdictBox: "border-[#FF00FF]/20 bg-[#FF00FF]/[0.04]",
            verdictTitle: "text-[#FF00FF]",
            scanColor: "rgba(255,0,255,0.4)",
          }
        : {
            gradient: "from-amber-500/18 via-yellow-500/8 to-transparent",
            border: "border-amber-400/30",
            glow: "0 0 40px rgba(234,179,8,0.12), 0 0 80px rgba(234,179,8,0.05)",
            icon: "border-amber-400/30 bg-amber-400/10 text-amber-300",
            iconGlow: "0 0 18px rgba(234,179,8,0.4)",
            label: "무승부",
            labelClass:
              "border-amber-400/50 bg-amber-400/15 text-amber-100 shadow-[0_0_18px_rgba(234,179,8,0.3)]",
            proBox: "border-[#00FFD1]/15 bg-[#00FFD1]/[0.03]",
            conBox: "border-[#FF00FF]/15 bg-[#FF00FF]/[0.03]",
            verdictBox: "border-amber-400/20 bg-amber-400/[0.04]",
            verdictTitle: "text-amber-300",
            scanColor: "rgba(234,179,8,0.3)",
          }

  return (
    <div className="judge-reveal">
      <div
        className={`rounded-2xl bg-gradient-to-r ${theme.gradient} p-px`}
        style={{ boxShadow: theme.glow }}
      >
        <div
          className={`relative overflow-hidden rounded-2xl border ${theme.border} bg-black/60 backdrop-blur`}
        >
          <div className="judge-grid-bg pointer-events-none absolute inset-0 opacity-100" />
          <div className="pointer-events-none absolute inset-x-0 top-0">
            <div
              className="cyber-scan-line-slow absolute inset-x-0 h-[1.5px]"
              style={{
                background: `linear-gradient(90deg, transparent 0%, ${theme.scanColor} 40%, ${theme.scanColor} 60%, transparent 100%)`,
              }}
            />
          </div>

          <div className="relative space-y-5 p-5">
            {/* 헤더 */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div
                  className={`grid size-9 shrink-0 place-items-center rounded-xl border ${theme.icon}`}
                  style={{ boxShadow: theme.iconGlow }}
                >
                  <Scale className="size-4" />
                </div>
                <div>
                  <div
                    className="cyber-glitch-text font-mono text-xs font-black tracking-[0.3em] text-[#00FFD1]"
                    style={{ textShadow: "0 0 10px rgba(0,255,209,0.6)" }}
                  >
                    CYBER JUDGE
                  </div>
                  <div className="text-[9px] tracking-widest text-zinc-600">
                    AI VERDICT · gemini-flash
                  </div>
                </div>
              </div>
              <span
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold ${theme.labelClass}`}
              >
                <Crown className="size-3" />
                {theme.label}
              </span>
            </div>

            {/* 찬반 요약 */}
            <div className="grid grid-cols-2 gap-3">
              <div className={`rounded-xl border p-3.5 ${theme.proBox}`}>
                <div className="mb-2 flex items-center gap-1.5">
                  <span className="text-[9px] font-bold tracking-widest text-[#00FFD1]">
                    찬성 측 논리
                  </span>
                  {win === "pro" && (
                    <span className="inline-flex items-center gap-0.5 rounded-full border border-[#00FFD1]/40 bg-[#00FFD1]/10 px-1.5 py-0.5 text-[8px] font-bold text-[#00FFD1]">
                      <Crown className="size-2" /> 승
                    </span>
                  )}
                </div>
                <p className="text-xs leading-relaxed text-zinc-300">
                  {summary.pro_summary}
                </p>
              </div>
              <div className={`rounded-xl border p-3.5 ${theme.conBox}`}>
                <div className="mb-2 flex items-center gap-1.5">
                  <span className="text-[9px] font-bold tracking-widest text-[#FF00FF]">
                    반대 측 논리
                  </span>
                  {win === "con" && (
                    <span className="inline-flex items-center gap-0.5 rounded-full border border-[#FF00FF]/40 bg-[#FF00FF]/10 px-1.5 py-0.5 text-[8px] font-bold text-[#FF00FF]">
                      <Crown className="size-2" /> 승
                    </span>
                  )}
                </div>
                <p className="text-xs leading-relaxed text-zinc-300">
                  {summary.con_summary}
                </p>
              </div>
            </div>

            {/* 스코어 */}
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3.5">
              <div className="mb-2.5 flex items-center gap-1.5">
                <Zap className="size-3.5 text-zinc-500" />
                <span className="text-[9px] tracking-widest text-zinc-500">
                  LOGIC STRENGTH ANALYSIS
                </span>
              </div>
              <ScoreGauge
                proScore={summary.pro_score}
                conScore={summary.con_score}
                winner={win}
              />
            </div>

            {/* 최종 판결문 */}
            <div className={`rounded-xl border p-4 ${theme.verdictBox}`}>
              <div className="mb-2.5 flex items-center gap-2">
                <Shield className={`size-4 ${theme.verdictTitle}`} />
                <span
                  className={`text-[10px] font-bold tracking-widest ${theme.verdictTitle}`}
                >
                  최종 판결문
                </span>
              </div>
              <p className="text-sm leading-relaxed text-zinc-200">
                {summary.verdict_reason}
              </p>
              {summary.judged_at && (
                <div className="mt-2.5 text-right text-[9px] text-zinc-600">
                  {(() => {
                    const d = new Date(summary.judged_at!)
                    const pad = (n: number) => String(n).padStart(2, "0")
                    return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
                  })()}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── 분석 중 상태 ─────────────────────────────────────────────────────────────

function AnalyzingCard({ stepIdx }: { stepIdx: number }) {
  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-[#00FFD1]/25 bg-black/50 p-5 backdrop-blur"
      style={{ boxShadow: "0 0 30px rgba(0,255,209,0.1)" }}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0">
        <div className="cyber-scan-line absolute inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-[#00FFD1] to-transparent" />
      </div>
      <div className="judge-grid-bg pointer-events-none absolute inset-0" />

      <div className="relative space-y-4">
        <div className="flex items-center gap-3">
          <div
            className="grid size-9 place-items-center rounded-xl border border-[#00FFD1]/30 bg-[#00FFD1]/10 text-[#00FFD1]"
            style={{
              boxShadow: "0 0 18px rgba(0,255,209,0.35)",
              animation: "badge-glow 1.5s ease-in-out infinite",
            }}
          >
            <Bot className="size-5" />
          </div>
          <div>
            <div
              className="font-mono text-xs font-black tracking-[0.3em] text-[#00FFD1]"
              style={{ textShadow: "0 0 10px rgba(0,255,209,0.7)" }}
            >
              ANALYZING<span className="cursor-blink">_</span>
            </div>
            <div className="text-[9px] tracking-widest text-zinc-600">
              CYBER JUDGE ONLINE · 데이터 처리 중
            </div>
          </div>
        </div>

        <div className="space-y-1.5 rounded-xl border border-white/[0.06] bg-black/40 p-3.5">
          {ANALYZE_STEPS.map((step, i) => (
            <div
              key={step}
              className={`flex items-center gap-2 font-mono text-xs transition-all duration-700 ${
                i < stepIdx
                  ? "text-[#00FFD1]/50"
                  : i === stepIdx
                    ? "text-[#00FFD1]"
                    : "text-zinc-700"
              }`}
            >
              <span
                className={
                  i < stepIdx
                    ? "text-emerald-500"
                    : i === stepIdx
                      ? "text-[#00FFD1]"
                      : "text-zinc-700"
                }
              >
                {i < stepIdx ? "✓" : i === stepIdx ? ">" : "·"}
              </span>
              <span>{step}</span>
              {i === stepIdx && (
                <span className="cursor-blink inline-block h-3 w-0.5 bg-[#00FFD1]" />
              )}
            </div>
          ))}
        </div>

        <p className="text-center text-[10px] text-zinc-600">
          gemini-flash가 논리 패턴을 분석 중입니다...
        </p>
      </div>
    </div>
  )
}

// ── 메인 패널 ────────────────────────────────────────────────────────────────

export function CyberJudgePanel({
  threadId,
  initialSummary,
  initialVerdict,
  isClosed,
  proCommentCount,
  conCommentCount,
}: {
  threadId: string
  initialSummary: JudgeResult | null
  initialVerdict: string | null
  isClosed: boolean
  proCommentCount: number
  conCommentCount: number
}) {
  const { user } = useAuth()
  const { showToast } = useToast()

  const [summary, setSummary] = useState<JudgeResult | null>(initialSummary)
  const [judgeState, setJudgeState] = useState<
    "idle" | "analyzing" | "done"
  >(initialVerdict ? "done" : "idle")
  const [stepIdx, setStepIdx] = useState(0)
  const [earlyVoteCount, setEarlyVoteCount] = useState(0)
  const [hasVoted, setHasVoted] = useState(false)
  const [voting, setVoting] = useState(false)
  const [verdictOpen, setVerdictOpen] = useState(false)
  const autoTriggered = useRef(false)

  const conditionsMet =
    proCommentCount >= MIN_PER_SIDE && conCommentCount >= MIN_PER_SIDE

  // ── 초기 투표 데이터 로드 ──
  useEffect(() => {
    supabase
      .from("judge_early_votes")
      .select("user_id")
      .eq("thread_id", threadId)
      .then(({ data }) => {
        setEarlyVoteCount(data?.length ?? 0)
        if (user && data) {
          setHasVoted(data.some((v) => v.user_id === user.id))
        }
      })
  }, [threadId, user])

  // ── Realtime: 판결 도착 ──
  useEffect(() => {
    const ch = supabase
      .channel(`judge-${threadId}`)
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
          if (!row.ai_verdict || !row.ai_summary) return

          let parsed: JudgeResult
          if (typeof row.ai_summary === "string") {
            try {
              parsed = JSON.parse(row.ai_summary)
            } catch {
              return
            }
          } else {
            parsed = row.ai_summary as JudgeResult
          }
          if (!parsed.pro_summary || !parsed.con_summary) return

          setSummary(parsed)
          setJudgeState("done")
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(ch)
    }
  }, [threadId])

  // ── Realtime: 조기 투표 ──
  useEffect(() => {
    if (judgeState === "done") return
    const ch = supabase
      .channel(`judge-votes-${threadId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "judge_early_votes",
          filter: `thread_id=eq.${threadId}`,
        },
        () => {
          setEarlyVoteCount((c) => c + 1)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(ch)
    }
  }, [threadId, judgeState])

  // ── 분석 단계 순환 ──
  useEffect(() => {
    if (judgeState !== "analyzing") {
      setStepIdx(0)
      return
    }
    const timer = setInterval(() => {
      setStepIdx((i) => Math.min(i + 1, ANALYZE_STEPS.length - 1))
    }, 1800)
    return () => clearInterval(timer)
  }, [judgeState])

  // ── 마감 시 자동 판결 트리거 ──
  useEffect(() => {
    if (
      isClosed &&
      conditionsMet &&
      judgeState === "idle" &&
      !summary &&
      user &&
      !autoTriggered.current
    ) {
      autoTriggered.current = true
      triggerJudgment()
    }
  }, [isClosed, conditionsMet, judgeState, summary, user])

  // ── 판결 트리거 (자동/조기) ──
  const triggerJudgment = useCallback(async () => {
    if (!user) return
    setJudgeState("analyzing")

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      const res = await fetch("/api/judge", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token ?? ""}`,
        },
        body: JSON.stringify({ threadId }),
      })

      if (res.status === 409) {
        // 이미 판결 완료 — realtime에서 받을 것
        return
      }

      if (!res.ok) {
        setJudgeState("idle")
        return
      }

      const data = (await res.json()) as JudgeResult
      setSummary(data)
      setJudgeState("done")
    } catch {
      setJudgeState("idle")
    }
  }, [user, threadId])

  // ── 조기 투표 핸들러 ──
  const handleEarlyVote = useCallback(async () => {
    if (!user || hasVoted || voting) return
    setVoting(true)

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      const res = await fetch("/api/judge-vote", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token ?? ""}`,
        },
        body: JSON.stringify({ threadId }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        showToast(
          (err as { error?: string }).error ?? "투표에 실패했습니다.",
          "error"
        )
        return
      }

      const { voteCount, thresholdReached } = (await res.json()) as {
        voteCount: number
        thresholdReached: boolean
      }
      setHasVoted(true)
      setEarlyVoteCount(voteCount)

      if (thresholdReached) {
        showToast("조기 판결이 시작되었습니다!", "success")
        triggerJudgment()
      } else {
        showToast("조기 판결에 동의했습니다.", "success")
      }
    } catch {
      showToast("투표 중 오류가 발생했습니다.", "error")
    } finally {
      setVoting(false)
    }
  }, [user, hasVoted, voting, threadId, showToast, triggerJudgment])

  // ═════════════════════════════════════════════════════════════════════════════
  //  RENDER
  // ═════════════════════════════════════════════════════════════════════════════

  // ── 상태 3: 판결 완료 ──
  if (judgeState === "done" && summary) {
    const winLabel =
      summary.winner === "pro"
        ? "찬성 측 승리"
        : summary.winner === "con"
          ? "반대 측 승리"
          : "무승부"
    const winColor =
      summary.winner === "pro"
        ? "text-[#00FFD1]"
        : summary.winner === "con"
          ? "text-[#FF00FF]"
          : "text-amber-300"
    const borderGlow =
      summary.winner === "pro"
        ? "border-[#00FFD1]/40 shadow-[0_0_20px_rgba(0,255,209,0.15)]"
        : summary.winner === "con"
          ? "border-[#FF00FF]/40 shadow-[0_0_20px_rgba(255,0,255,0.15)]"
          : "border-amber-400/40 shadow-[0_0_20px_rgba(234,179,8,0.12)]"

    return (
      <div>
        {/* 컴팩트 판결 바 + 네온 보더 애니메이션 */}
        <button
          type="button"
          onClick={() => setVerdictOpen((v) => !v)}
          className={`judge-neon-border w-full overflow-hidden rounded-2xl border bg-black/40 text-left backdrop-blur transition-all ${borderGlow}`}
        >
          <div className="flex items-center gap-3 px-4 py-3.5">
            <div
              className="grid size-9 shrink-0 place-items-center rounded-xl border border-[#00FFD1]/25 bg-[#00FFD1]/10 text-[#00FFD1]"
              style={{ boxShadow: "0 0 12px rgba(0,255,209,0.25)" }}
            >
              <Scale className="size-4" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-zinc-100">
                  AI 판결 완료
                </span>
                <span
                  className={`inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-semibold ${winColor}`}
                >
                  <Crown className="size-2.5" />
                  {winLabel}
                </span>
              </div>
              <div className="mt-0.5 text-[10px] text-zinc-500">
                찬성 {summary.pro_score}점 vs 반대 {summary.con_score}점
              </div>
            </div>

            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[#00FFD1]/25 bg-[#00FFD1]/10 px-3 py-1.5 text-[11px] font-semibold text-[#00FFD1] transition hover:bg-[#00FFD1]/20">
              판결문 확인하기
              <ChevronDown
                className={`size-3.5 transition-transform duration-300 ${verdictOpen ? "rotate-180" : ""}`}
              />
            </span>
          </div>
        </button>

        {/* 확장 판결 내용 */}
        <div
          className="grid transition-[grid-template-rows] duration-300 ease-in-out"
          style={{ gridTemplateRows: verdictOpen ? "1fr" : "0fr" }}
        >
          <div className="overflow-hidden">
            <div className="pt-3">
              <VerdictCard summary={summary} />
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── 분석 중 ──
  if (judgeState === "analyzing") {
    return <AnalyzingCard stepIdx={stepIdx} />
  }

  // ── 상태 1: 조건 미달 (양측 댓글 부족) ──
  if (!conditionsMet) {
    const proPct = Math.min(100, (proCommentCount / MIN_PER_SIDE) * 100)
    const conPct = Math.min(100, (conCommentCount / MIN_PER_SIDE) * 100)

    return (
      <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-black/30 p-4 backdrop-blur transition-all">
        <div className="flex items-center gap-3">
          <div className="grid size-9 shrink-0 place-items-center rounded-xl border border-zinc-700/80 bg-zinc-800/50 text-zinc-600">
            <Scale className="size-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-zinc-500">
              AI 사이버 판사
            </div>
            <div className="mt-0.5 text-[11px] text-zinc-600">
              조건 부족: 양측 각각 {MIN_PER_SIDE}개 이상의 의견이 필요합니다
            </div>
          </div>
          <span className="shrink-0 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-[11px] text-zinc-600">
            마감 후 자동 판결
          </span>
        </div>

        {/* 양측 진행도 */}
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-[#00FFD1]/50">찬성 의견</span>
              <span className="text-zinc-600">
                {proCommentCount}/{MIN_PER_SIDE}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className="h-full rounded-full bg-[#00FFD1]/30 transition-all duration-500"
                style={{ width: `${proPct}%` }}
              />
            </div>
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-[#FF00FF]/50">반대 의견</span>
              <span className="text-zinc-600">
                {conCommentCount}/{MIN_PER_SIDE}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className="h-full rounded-full bg-[#FF00FF]/30 transition-all duration-500"
                style={{ width: `${conPct}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── 마감됨 + 조건 충족 + 판결 대기중 ──
  if (isClosed) {
    return (
      <div
        className="overflow-hidden rounded-2xl border border-[#00FFD1]/20 bg-black/40 p-4 backdrop-blur"
        style={{ boxShadow: "0 0 20px rgba(0,255,209,0.06)" }}
      >
        <div className="flex items-center gap-3">
          <div
            className="grid size-9 shrink-0 place-items-center rounded-xl border border-[#00FFD1]/25 bg-[#00FFD1]/10 text-[#00FFD1]"
            style={{
              boxShadow: "0 0 12px rgba(0,255,209,0.2)",
              animation: "badge-glow 1.5s ease-in-out infinite",
            }}
          >
            <Bot className="size-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-zinc-100">
              AI 판결 생성 중
            </div>
            <div className="mt-0.5 text-[11px] text-[#00FFD1]/60">
              토론이 마감되었습니다. AI 판결문을 생성하고 있습니다...
            </div>
          </div>
          <Loader2 className="size-5 shrink-0 animate-spin text-[#00FFD1]/50" />
        </div>
      </div>
    )
  }

  // ── 상태 2: 조건 충족, 자동 판결 대기 + 조기 투표 ──
  return (
    <div
      className="overflow-hidden rounded-2xl border border-[#00FFD1]/15 bg-gradient-to-r from-[#00FFD1]/[0.04] via-black/40 to-[#FF00FF]/[0.04] p-4 backdrop-blur transition-all"
      style={{ boxShadow: "0 0 15px rgba(0,255,209,0.05)" }}
    >
      <div className="flex items-start gap-3">
        <div
          className="grid size-9 shrink-0 place-items-center rounded-xl border border-[#00FFD1]/20 bg-[#00FFD1]/10 text-[#00FFD1]"
          style={{ boxShadow: "0 0 10px rgba(0,255,209,0.12)" }}
        >
          <Scale className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-zinc-100">
            AI 사이버 판사
          </div>
          <div className="mt-1.5 inline-flex items-center gap-1.5 rounded-full border border-[#00FFD1]/20 bg-[#00FFD1]/[0.08] px-2.5 py-1 text-[10px] font-medium text-[#00FFD1]">
            <Sparkles className="size-3" />
            토론 마감 시 AI 판결문이 자동 발행됩니다
          </div>
        </div>
      </div>

      {/* 조기 판결 투표 */}
      <div className="mt-3.5 rounded-xl border border-white/[0.08] bg-black/30 p-3">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <EarlyVoteGauge
              count={earlyVoteCount}
              threshold={EARLY_VOTE_THRESHOLD}
            />
          </div>
          <button
            type="button"
            onClick={handleEarlyVote}
            disabled={!user || hasVoted || voting}
            className={`shrink-0 rounded-lg border px-3 py-1.5 text-[11px] font-semibold transition ${
              hasVoted
                ? "border-[#00FFD1]/25 bg-[#00FFD1]/10 text-[#00FFD1]"
                : "border-white/15 bg-white/5 text-zinc-300 hover:border-[#00FFD1]/25 hover:bg-[#00FFD1]/10 hover:text-[#00FFD1]"
            } disabled:cursor-not-allowed disabled:opacity-50`}
          >
            {voting ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : hasVoted ? (
              <span className="inline-flex items-center gap-1">
                <Swords className="size-3" /> 동의 완료
              </span>
            ) : (
              <span className="inline-flex items-center gap-1">
                <ThumbsUp className="size-3" /> 조기 판결 요청
              </span>
            )}
          </button>
        </div>
        <p className="mt-2 text-[10px] text-zinc-600">
          {EARLY_VOTE_THRESHOLD}명이 동의하면 마감 전이라도 AI 판결이
          시작됩니다.
        </p>
      </div>
    </div>
  )
}
