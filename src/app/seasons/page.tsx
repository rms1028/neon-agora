import Link from "next/link"
import { ArrowLeft, Calendar, Crown, Medal, Timer, Trophy, Zap } from "lucide-react"

import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export const revalidate = 120

type SeasonRow = {
  id: string
  name: string
  starts_at: string
  ends_at: string
  is_active: boolean
  rewards: Record<string, unknown> | null
}

type LeaderRow = {
  user_id: string
  season_xp: number
  rank: number
  badge: string
}

function formatDate(val: string) {
  const d = new Date(val)
  if (Number.isNaN(d.getTime())) return ""
  return new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium" }).format(d)
}

function daysLeft(endsAt: string) {
  const diffMs = new Date(endsAt).getTime() - Date.now()
  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)))
}

function shortId(uid: string) {
  return uid.replace(/-/g, "").slice(0, 6)
}

const RANK_STYLES: Record<number, string> = {
  1: "text-yellow-300 border-yellow-400/30 bg-yellow-400/10",
  2: "text-zinc-300 border-zinc-400/30 bg-zinc-400/10",
  3: "text-amber-400 border-amber-400/30 bg-amber-400/10",
}

export default async function SeasonsPage() {
  // 활성 시즌
  const { data: activeRaw } = await supabase
    .from("seasons")
    .select("*")
    .eq("is_active", true)
    .maybeSingle()

  const activeSeason = activeRaw as SeasonRow | null

  // 과거 시즌
  const { data: pastRaw } = await supabase
    .from("seasons")
    .select("*")
    .eq("is_active", false)
    .order("ends_at", { ascending: false })
    .limit(10)

  const pastSeasons = (pastRaw ?? []) as SeasonRow[]

  // 활성 시즌 리더보드
  let leaderboard: LeaderRow[] = []
  if (activeSeason) {
    try {
      const { data } = await supabase.rpc("get_season_leaderboard", {
        p_season_id: activeSeason.id,
        p_limit: 20,
      })
      leaderboard = (data ?? []) as LeaderRow[]
    } catch {
      // RPC 없으면 빈 배열
    }
  }

  return (
    <div className="min-h-screen bg-black text-zinc-100">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(1200px_circle_at_20%_10%,rgba(234,179,8,0.12),transparent_55%),radial-gradient(900px_circle_at_80%_20%,rgba(245,158,11,0.10),transparent_55%)]" />
      </div>

      <div className="relative mx-auto w-full max-w-4xl px-4 py-10 sm:px-6">
        <nav className="mb-6 flex items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-200">
            <ArrowLeft className="size-4" /> 홈으로
          </Link>
          <span className="text-[11px] tracking-widest text-zinc-600">SEASONS</span>
        </nav>

        <h1 className="mb-8 text-3xl font-extrabold tracking-tight">
          <Crown className="mr-2 inline size-8 text-yellow-400" />
          시즌 랭킹
        </h1>

        {/* 활성 시즌 */}
        {activeSeason ? (
          <div className="mb-8">
            <div className="season-active-glow rounded-3xl border border-yellow-400/20 bg-gradient-to-br from-yellow-400/10 via-amber-400/5 to-transparent p-6">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <div className="mb-1 text-[10px] tracking-widest text-yellow-400/70">ACTIVE SEASON</div>
                  <h2 className="text-xl font-bold text-yellow-200">{activeSeason.name}</h2>
                </div>
                <div className="flex items-center gap-2 rounded-full border border-yellow-400/20 bg-yellow-400/10 px-3 py-1.5 text-xs text-yellow-200">
                  <Timer className="size-3.5" />
                  {daysLeft(activeSeason.ends_at)}일 남음
                </div>
              </div>
              <div className="flex items-center gap-3 text-xs text-zinc-400">
                <Calendar className="size-3.5" />
                {formatDate(activeSeason.starts_at)} ~ {formatDate(activeSeason.ends_at)}
              </div>
            </div>

            {/* 리더보드 */}
            <div className="mt-6">
              <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-zinc-100">
                <Trophy className="size-4 text-yellow-400" />
                시즌 리더보드 TOP 20
              </h3>

              {leaderboard.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center text-sm text-zinc-500">
                  아직 시즌 참가자가 없습니다.
                </div>
              ) : (
                <div className="space-y-2">
                  {leaderboard.map((row, idx) => {
                    const rank = idx + 1
                    const style = RANK_STYLES[rank] ?? "text-zinc-400 border-white/10 bg-white/5"
                    return (
                      <Link
                        key={row.user_id}
                        href={`/profile/${row.user_id}`}
                        className={`flex items-center justify-between rounded-xl border px-4 py-3 transition hover:bg-white/5 ${style}`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="w-6 text-center text-sm font-bold">
                            {rank <= 3 ? (
                              <Medal className={`inline size-5 ${rank === 1 ? "text-yellow-400" : rank === 2 ? "text-zinc-300" : "text-amber-500"}`} />
                            ) : (
                              rank
                            )}
                          </span>
                          <div className="grid size-8 place-items-center rounded-full bg-gradient-to-br from-yellow-300 to-amber-400 text-[11px] font-semibold text-black">
                            {shortId(row.user_id).slice(0, 2)}
                          </div>
                          <div>
                            <div className="text-xs font-medium">유저 {shortId(row.user_id)}</div>
                            <div className="text-[10px] text-zinc-500">{row.badge}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 text-sm font-bold">
                          <Zap className="size-3.5" />
                          {row.season_xp}
                        </div>
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        ) : (
          <Card className="mb-8 border-white/10 bg-black/40">
            <CardContent className="p-6 text-center text-sm text-zinc-500">
              현재 활성 시즌이 없습니다.
            </CardContent>
          </Card>
        )}

        {/* 과거 시즌 */}
        {pastSeasons.length > 0 && (
          <div>
            <h3 className="mb-4 text-sm font-semibold text-zinc-400">과거 시즌</h3>
            <div className="space-y-2">
              {pastSeasons.map((s) => (
                <Card key={s.id} className="border-white/10 bg-black/30">
                  <CardHeader className="gap-1 py-3">
                    <CardTitle className="text-sm text-zinc-200">{s.name}</CardTitle>
                    <div className="text-[11px] text-zinc-500">
                      {formatDate(s.starts_at)} ~ {formatDate(s.ends_at)}
                    </div>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
