"use client"

import { useCallback, useEffect, useState } from "react"
import { BarChart3, Loader2, Sparkles, ThumbsDown, ThumbsUp, TrendingUp } from "lucide-react"

import { supabase } from "@/lib/supabase"
import { useAuth } from "@/components/auth-provider"
import { useToast } from "@/components/toast-provider"

type ClashReport = {
  momentum: "pro" | "con" | "even"
  pro_summary: string
  con_summary: string
  key_arguments: { side: "pro" | "con"; point: string }[]
  verdict_hint: string
  generated_at: string
}

export function ClashReportPanel({
  threadId,
  initialReport,
  commentCount,
}: {
  threadId: string
  initialReport: ClashReport | null
  commentCount: number
}) {
  const { user } = useAuth()
  const { showToast } = useToast()
  const [report, setReport] = useState<ClashReport | null>(initialReport)
  const [analyzing, setAnalyzing] = useState(false)

  // Realtime 구독: ai_summary 변경 감지
  useEffect(() => {
    const channel = supabase
      .channel(`clash-report-${threadId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "threads", filter: `id=eq.${threadId}` },
        (payload) => {
          const summary = payload.new?.ai_summary
          if (summary && typeof summary === "object" && !Array.isArray(summary)) {
            const s = summary as Record<string, unknown>
            if (s.clash_report && typeof s.clash_report === "object") {
              setReport(s.clash_report as ClashReport)
            }
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [threadId])

  const handleGenerate = useCallback(async () => {
    if (!user || analyzing) return
    setAnalyzing(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch("/api/clash-report", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token ?? ""}`,
        },
        body: JSON.stringify({ threadId }),
      })

      if (!res.ok) {
        const err = await res.json()
        showToast(err.error ?? "리포트 생성 실패", "error")
        return
      }

      const { report: newReport } = await res.json()
      setReport(newReport)
      showToast("AI 여론 리포트가 생성되었습니다!", "success")
    } catch {
      showToast("리포트 생성 중 오류가 발생했습니다.", "error")
    } finally {
      setAnalyzing(false)
    }
  }, [user, threadId, analyzing, showToast])

  // 리포트 없으면 생성 버튼만 표시
  if (!report) {
    return (
      <div className="rounded-2xl border border-[#00FFD1]/15 bg-gradient-to-r from-[#00FFD1]/5 via-transparent to-[#FF00FF]/5 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="size-4 text-[#00FFD1]" />
            <span className="text-xs font-semibold text-zinc-200">AI CLASH REPORT</span>
            <span className="rounded-full border border-white/10 bg-white/5 px-1.5 py-0.5 text-[9px] text-zinc-500">
              댓글 {commentCount}개 분석
            </span>
          </div>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={analyzing || !user || commentCount < 2}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#00FFD1]/30 bg-[#00FFD1]/10 px-3 py-1.5 text-[11px] font-semibold text-[#00FFD1] transition hover:bg-[#00FFD1]/20 disabled:opacity-50"
          >
            {analyzing ? (
              <>
                <Loader2 className="size-3 animate-spin" />
                분석 중...
              </>
            ) : (
              <>
                <Sparkles className="size-3" />
                리포트 생성
              </>
            )}
          </button>
        </div>
        {commentCount < 2 && (
          <p className="mt-2 text-[10px] text-zinc-600">
            댓글이 2개 이상이어야 리포트를 생성할 수 있습니다.
          </p>
        )}
      </div>
    )
  }

  // 리포트 표시
  const momentumLabel =
    report.momentum === "pro" ? "찬성 우세" : report.momentum === "con" ? "반대 우세" : "팽팽"
  const momentumColor =
    report.momentum === "pro" ? "text-[#00FFD1]" : report.momentum === "con" ? "text-[#FF00FF]" : "text-zinc-300"

  return (
    <div className="overflow-hidden rounded-2xl border border-[#00FFD1]/15 bg-black/40 backdrop-blur">
      {/* 헤더 */}
      <div className="flex items-center justify-between bg-gradient-to-r from-[#00FFD1]/10 via-transparent to-[#FF00FF]/10 px-4 py-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="size-4 text-[#00FFD1]" />
          <span className="text-xs font-bold tracking-wider text-zinc-100">AI CLASH REPORT</span>
        </div>
        <div className="flex items-center gap-2">
          <div className={`flex items-center gap-1 text-xs font-semibold ${momentumColor}`}>
            <TrendingUp className="size-3" />
            {momentumLabel}
          </div>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={analyzing}
            className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[10px] text-zinc-400 transition hover:bg-white/10 disabled:opacity-50"
          >
            {analyzing ? <Loader2 className="size-2.5 animate-spin" /> : <Sparkles className="size-2.5" />}
            갱신
          </button>
        </div>
      </div>

      {/* 양측 요약 2컬럼 */}
      <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2">
        <div className="rounded-xl border border-[#00FFD1]/15 bg-[#00FFD1]/5 p-3">
          <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold text-[#00FFD1]">
            <ThumbsUp className="size-3" />
            찬성 측 핵심
          </div>
          <p className="text-xs leading-relaxed text-zinc-300">{report.pro_summary}</p>
        </div>
        <div className="rounded-xl border border-[#FF00FF]/15 bg-[#FF00FF]/5 p-3">
          <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold text-[#FF00FF]">
            <ThumbsDown className="size-3" />
            반대 측 핵심
          </div>
          <p className="text-xs leading-relaxed text-zinc-300">{report.con_summary}</p>
        </div>
      </div>

      {/* 핵심 논거 */}
      {report.key_arguments.length > 0 && (
        <div className="border-t border-white/[0.06] px-4 py-3">
          <div className="mb-2 text-[10px] font-semibold tracking-wider text-zinc-500">KEY ARGUMENTS</div>
          <div className="space-y-1.5">
            {report.key_arguments.map((arg, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className={`mt-0.5 inline-flex shrink-0 items-center rounded-full border px-1.5 py-0.5 text-[8px] font-bold ${
                  arg.side === "pro"
                    ? "border-[#00FFD1]/30 bg-[#00FFD1]/10 text-[#00FFD1]"
                    : "border-[#FF00FF]/30 bg-[#FF00FF]/10 text-[#FF00FF]"
                }`}>
                  {arg.side === "pro" ? "PRO" : "CON"}
                </span>
                <span className="text-[11px] leading-relaxed text-zinc-300">{arg.point}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 한 줄 평가 */}
      {report.verdict_hint && (
        <div className="border-t border-white/[0.06] bg-white/[0.02] px-4 py-2.5">
          <p className="text-center text-[11px] italic text-zinc-400">
            &ldquo;{report.verdict_hint}&rdquo;
          </p>
        </div>
      )}
    </div>
  )
}
