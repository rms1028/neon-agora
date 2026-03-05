"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Play, Swords, Trophy } from "lucide-react"

import { supabase } from "@/lib/supabase"
import { useAuth } from "@/components/auth-provider"
import { useToast } from "@/components/toast-provider"
import { TournamentBracket, type TournamentMatch } from "@/components/tournament-bracket"
import { useParams } from "next/navigation"

type Tournament = {
  id: string
  title: string
  description: string
  status: "recruiting" | "active" | "completed"
  bracket_size: number
  round_duration: number
  current_round: number
  created_by: string
  winner_thread_id: string | null
  created_at: string
}

type ThreadInfo = {
  id: string
  title: string
}

export default function TournamentDetailPage() {
  const params = useParams()
  const id = params.id as string
  const { user } = useAuth()
  const { showToast } = useToast()

  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [matches, setMatches] = useState<TournamentMatch[]>([])
  const [threads, setThreads] = useState<Record<string, ThreadInfo>>({})
  const [loading, setLoading] = useState(true)
  const [advancing, setAdvancing] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)

    const { data: t } = await supabase
      .from("tournaments")
      .select("*")
      .eq("id", id)
      .maybeSingle()

    if (!t) {
      setLoading(false)
      return
    }

    setTournament(t as Tournament)

    const { data: matchRows } = await supabase
      .from("tournament_matches")
      .select("*")
      .eq("tournament_id", id)
      .order("round")
      .order("match_index")

    setMatches((matchRows ?? []) as TournamentMatch[])

    // 관련 스레드 정보 로드
    const { data: entries } = await supabase
      .from("tournament_entries")
      .select("thread_id")
      .eq("tournament_id", id)

    const threadIds = (entries ?? []).map((e: { thread_id: string }) => e.thread_id)
    if (threadIds.length > 0) {
      const { data: threadRows } = await supabase
        .from("threads")
        .select("id, title")
        .in("id", threadIds)

      const map: Record<string, ThreadInfo> = {}
      for (const tr of threadRows ?? []) {
        const row = tr as ThreadInfo
        map[row.id] = row
      }
      setThreads(map)
    }

    setLoading(false)
  }, [id])

  useEffect(() => {
    loadData()
  }, [loadData])

  const totalRounds = tournament
    ? Math.ceil(Math.log2(tournament.bracket_size))
    : 1

  const handleAdvance = useCallback(async () => {
    if (!user || !tournament) return
    setAdvancing(true)

    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) {
      showToast("인증 세션이 만료되었습니다.", "error")
      setAdvancing(false)
      return
    }

    const res = await fetch("/api/tournaments/advance", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ tournamentId: tournament.id }),
    })

    const data = await res.json() as { status?: string; error?: string; winner?: string }

    if (!res.ok) {
      showToast(data.error ?? "라운드 진행에 실패했습니다.", "error")
      setAdvancing(false)
      return
    }

    if (data.status === "completed") {
      showToast("토너먼트가 완료되었습니다! 승자 XP +200", "success")
    } else {
      showToast("다음 라운드로 진행되었습니다!", "success")
    }

    setAdvancing(false)
    loadData()
  }, [user, tournament, showToast, loadData])

  const isCreator = user?.id === tournament?.created_by
  const canAdvance = isCreator && tournament?.status === "active"

  // 승자 스레드 타이틀
  const winnerTitle = tournament?.winner_thread_id
    ? threads[tournament.winner_thread_id]?.title ?? ""
    : ""

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-zinc-100">
        <div className="mx-auto max-w-5xl px-4 py-10">
          <div className="h-8 w-40 animate-pulse rounded-xl bg-white/[0.06]" />
          <div className="mt-4 h-64 animate-pulse rounded-2xl bg-white/[0.04]" />
        </div>
      </div>
    )
  }

  if (!tournament) {
    return (
      <div className="min-h-screen bg-black text-zinc-100">
        <div className="mx-auto max-w-5xl px-4 py-10">
          <Link href="/tournaments" className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-200">
            <ArrowLeft className="size-4" /> 토너먼트 목록
          </Link>
          <div className="mt-8 rounded-2xl border border-white/10 bg-black/40 p-8 text-center">
            <p className="text-zinc-400">토너먼트를 찾을 수 없습니다.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-zinc-100">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(1200px_circle_at_20%_10%,rgba(34,211,238,0.18),transparent_55%),radial-gradient(900px_circle_at_80%_20%,rgba(236,72,153,0.14),transparent_55%)]" />
      </div>

      <div className="relative mx-auto w-full max-w-5xl px-4 py-10 sm:px-6">
        <nav className="mb-6 flex items-center justify-between">
          <Link
            href="/tournaments"
            className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-200"
          >
            <ArrowLeft className="size-4" />
            토너먼트 목록
          </Link>
          <span className="text-[11px] tracking-widest text-zinc-600">BRACKET</span>
        </nav>

        {/* 헤더 */}
        <div className="mb-6 rounded-3xl bg-gradient-to-r from-cyan-500/25 via-fuchsia-500/15 to-emerald-400/15 p-px">
          <div className="rounded-3xl border border-white/10 bg-black/45 p-6 backdrop-blur">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <Swords className="size-5 text-cyan-300" />
                  <h1 className="text-xl font-bold">{tournament.title}</h1>
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                    tournament.status === "active"
                      ? "border-cyan-400/30 bg-cyan-400/10 text-cyan-200"
                      : tournament.status === "completed"
                        ? "border-yellow-400/30 bg-yellow-400/10 text-yellow-200"
                        : "border-white/10 bg-white/5 text-zinc-400"
                  }`}>
                    {tournament.status === "active" ? "진행중" : tournament.status === "completed" ? "완료" : "모집중"}
                  </span>
                </div>
                {tournament.description && (
                  <p className="mt-1 text-sm text-zinc-400">{tournament.description}</p>
                )}
                <div className="mt-2 flex items-center gap-4 text-xs text-zinc-500">
                  <span>{tournament.bracket_size}강</span>
                  <span>라운드 {tournament.current_round}</span>
                  <span>{tournament.round_duration}시간/라운드</span>
                </div>
              </div>

              {canAdvance && (
                <button
                  type="button"
                  onClick={handleAdvance}
                  disabled={advancing}
                  className="shrink-0 inline-flex items-center gap-2 rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-200 transition hover:bg-cyan-400/20 disabled:opacity-50"
                >
                  <Play className="size-4" />
                  {advancing ? "진행 중…" : "다음 라운드"}
                </button>
              )}
            </div>

            {/* 완료 시 승자 */}
            {tournament.status === "completed" && winnerTitle && (
              <div className="mt-4 rounded-xl border border-yellow-400/30 bg-yellow-400/[0.06] p-4 text-center tournament-winner-glow">
                <Trophy className="mx-auto size-6 text-yellow-300" />
                <div className="mt-2 text-sm font-semibold text-yellow-100">
                  우승: {winnerTitle}
                </div>
                <div className="mt-1 text-[11px] text-zinc-500">+200 XP 보상</div>
              </div>
            )}
          </div>
        </div>

        {/* 대진표 */}
        <div className="rounded-2xl border border-white/10 bg-black/30 p-6 backdrop-blur">
          <TournamentBracket
            matches={matches}
            threads={threads}
            totalRounds={totalRounds}
            currentRound={tournament.current_round}
          />
        </div>
      </div>
    </div>
  )
}
