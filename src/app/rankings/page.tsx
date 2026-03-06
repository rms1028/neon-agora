import Link from "next/link"
import { ArrowLeft, Crown, Swords, Trophy, Zap } from "lucide-react"

import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getTier } from "@/lib/xp"
import { getDisplayName } from "@/lib/utils"
import { UserSearchBar } from "@/components/user-search"

export const revalidate = 120

const TABS = ["전체", "AI", "정치", "경제", "사회", "기술", "문화", "교육", "환경", "기타"]

type RankEntry = {
  id: string
  displayName: string
  score: number
  xp?: number
  badge?: string
}

async function fetchOverallRanking(): Promise<RankEntry[]> {
  const { data } = await supabase
    .from("profiles")
    .select("id, xp, badge, display_name")
    .order("xp", { ascending: false })
    .limit(20)

  return (data ?? []).map((row) => ({
    id: String(row.id),
    displayName: getDisplayName(row as { id?: string; display_name?: string | null }),
    score: Number(row.xp) || 0,
    xp: Number(row.xp) || 0,
    badge: String(row.badge ?? ""),
  }))
}

async function fetchCategoryRanking(tag: string): Promise<RankEntry[]> {
  // 해당 카테고리 토론 (최근 500개 제한, created_by와 id 한 번에 조회)
  const { data: threads } = await supabase
    .from("threads")
    .select("id, created_by")
    .eq("tag", tag)
    .order("created_at", { ascending: false })
    .limit(500)

  const tids = (threads ?? []).map((t) => String(t.id))

  // 해당 카테고리 댓글 작성자 → 점수: comments × 1 (최근 2000개 제한)
  const commentScores: Record<string, number> = {}
  if (tids.length > 0) {
    const batchSize = 200
    for (let i = 0; i < tids.length; i += batchSize) {
      const batch = tids.slice(i, i + batchSize)
      const { data: comments } = await supabase
        .from("comments")
        .select("user_id")
        .in("thread_id", batch)
        .limit(2000)

      for (const c of comments ?? []) {
        const uid = String(c.user_id)
        commentScores[uid] = (commentScores[uid] ?? 0) + 1
      }
    }
  }

  // 토론 점수 합산
  const userScores: Record<string, number> = {}
  for (const t of threads ?? []) {
    const uid = String(t.created_by)
    if (!uid) continue
    userScores[uid] = (userScores[uid] ?? 0) + 3
  }

  // 댓글 점수 합산
  for (const [uid, count] of Object.entries(commentScores)) {
    userScores[uid] = (userScores[uid] ?? 0) + count
  }

  // XP 로드 (상위 20명만)
  const topUserIds = Object.entries(userScores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([uid]) => uid)
  if (topUserIds.length === 0) return []

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, xp, badge, display_name")
    .in("id", topUserIds)

  const profileMap: Record<string, { xp: number; badge: string; display_name: string | null }> = {}
  for (const p of profiles ?? []) {
    profileMap[String(p.id)] = {
      xp: Number(p.xp) || 0,
      badge: String(p.badge ?? ""),
      display_name: typeof p.display_name === "string" ? p.display_name : null,
    }
  }

  return topUserIds.map((uid) => ({
    id: uid,
    displayName: getDisplayName({ id: uid, display_name: profileMap[uid]?.display_name }),
    score: userScores[uid] ?? 0,
    xp: profileMap[uid]?.xp ?? 0,
    badge: profileMap[uid]?.badge ?? "",
  }))
}

export default async function RankingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const { tab: rawTab } = await searchParams
  const activeTab = TABS.includes(rawTab ?? "") ? rawTab! : "전체"

  const entries = activeTab === "전체"
    ? await fetchOverallRanking()
    : await fetchCategoryRanking(activeTab)

  return (
    <div className="min-h-screen bg-black text-zinc-100">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(1200px_circle_at_50%_10%,rgba(234,179,8,0.12),transparent_55%),radial-gradient(900px_circle_at_80%_70%,rgba(236,72,153,0.08),transparent_55%)]" />
      </div>

      <div className="relative mx-auto w-full max-w-4xl px-4 py-10 sm:px-6">
        <nav className="mb-6 flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-200"
          >
            <ArrowLeft className="size-4" />
            아고라로
          </Link>
          <span className="text-[11px] tracking-widest text-zinc-600">
            RANKINGS
          </span>
        </nav>

        <header className="mb-8 space-y-2">
          <div className="flex items-center gap-2">
            <Trophy className="size-5 text-amber-300" />
            <h1 className="text-2xl font-semibold text-zinc-50">랭킹</h1>
          </div>
          <p className="text-sm text-zinc-400">
            {activeTab === "전체" ? "XP 기준 전체 랭킹" : `${activeTab} 카테고리 기여도 랭킹`}
          </p>
        </header>

        {/* 유저 검색 */}
        <div className="mb-6">
          <UserSearchBar />
        </div>

        {/* 탭 */}
        <div className="mb-6 flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {TABS.map((t) => (
            <Link
              key={t}
              href={`/rankings${t === "전체" ? "" : `?tab=${encodeURIComponent(t)}`}`}
              className={`shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                activeTab === t
                  ? "border-amber-400/50 bg-amber-400/15 text-amber-100 shadow-[0_0_12px_rgba(234,179,8,0.2)]"
                  : "border-white/10 bg-white/5 text-zinc-400 hover:border-white/20 hover:text-zinc-200"
              }`}
            >
              {t}
            </Link>
          ))}
        </div>

        {/* 랭킹 목록 */}
        <Card className="border-white/10 bg-black/40 backdrop-blur">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Crown className="size-4 text-yellow-300" />
              <CardTitle className="text-sm text-zinc-100">
                {activeTab === "전체" ? "전체 XP 랭킹" : `${activeTab} 카테고리 랭킹`}
              </CardTitle>
              <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-zinc-500">
                Top {entries.length}
              </span>
            </div>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {entries.length === 0 ? (
              <div className="py-12 text-center">
                <div className="mx-auto grid size-12 place-items-center rounded-xl border border-white/10 bg-white/5 text-zinc-500">
                  <Swords className="size-5" />
                </div>
                <p className="mt-4 text-sm text-zinc-500">아직 데이터가 없습니다.</p>
              </div>
            ) : (
              entries.map((entry, i) => {
                const tier = getTier(entry.xp ?? 0)
                const isFirst = i === 0
                const isSecond = i === 1
                const isThird = i === 2
                const isPodium = i < 3

                const rowBorder = isFirst
                  ? "border-yellow-400/30 bg-yellow-400/[0.05]"
                  : isSecond
                    ? "border-white/10 bg-white/[0.025]"
                    : isThird
                      ? "border-amber-700/20 bg-amber-900/[0.04]"
                      : "border-white/[0.06] bg-transparent"

                const rowShadow = isFirst
                  ? "0 0 24px rgba(234,179,8,0.15)"
                  : undefined

                return (
                  <Link
                    key={entry.id}
                    href={`/profile/${entry.id}`}
                    className={`relative flex items-center gap-3 overflow-hidden rounded-xl border px-4 py-3 transition-all hover:bg-white/[0.03] ${rowBorder}`}
                    style={rowShadow ? { boxShadow: rowShadow } : undefined}
                  >
                    {/* 순위 */}
                    <div className="w-8 shrink-0 text-center">
                      {isFirst ? (
                        <Crown
                          className="mx-auto size-5 text-yellow-300"
                          style={{ filter: "drop-shadow(0 0 6px rgba(234,179,8,0.8))" }}
                        />
                      ) : (
                        <span className={`text-xs font-bold tabular-nums ${isPodium ? "text-zinc-400" : "text-zinc-600"}`}>
                          {String(i + 1).padStart(2, "0")}
                        </span>
                      )}
                    </div>

                    {/* 아바타 */}
                    <div
                      className={`grid size-9 shrink-0 place-items-center rounded-lg bg-gradient-to-br ${tier.avatarGradient} text-xs font-bold text-black`}
                      style={isFirst ? { boxShadow: "0 0 12px rgba(234,179,8,0.5)" } : undefined}
                    >
                      {entry.displayName.slice(0, 2)}
                    </div>

                    {/* 텍스트 */}
                    <div className="min-w-0 flex-1">
                      <div className={`truncate text-sm font-semibold ${isPodium ? "text-zinc-200" : "text-zinc-400"}`}>
                        {entry.displayName}
                      </div>
                      <div className={`text-[10px] ${tier.textClass}`}>
                        {tier.badgeName}
                      </div>
                    </div>

                    {/* 점수 */}
                    <div className={`shrink-0 flex items-center gap-1 text-xs font-bold tabular-nums ${isFirst ? "text-yellow-200" : tier.textClass}`}>
                      <Zap className="size-3" />
                      {activeTab === "전체" ? `${entry.score} XP` : `${entry.score}점`}
                    </div>
                  </Link>
                )
              })
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
