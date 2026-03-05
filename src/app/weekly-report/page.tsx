import Link from "next/link"
import {
  ArrowLeft,
  CalendarDays,
  Crown,
  Flame,
  MessageSquareText,
  TrendingUp,
  Users,
} from "lucide-react"

import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export const revalidate = 600

async function fetchWeeklyReport() {
  const now = new Date()
  const weekAgo = new Date(now.getTime() - 7 * 86400000)
  const weekAgoISO = weekAgo.toISOString()

  // 이번 주 토론 TOP3 (투표 합산 기준)
  const { data: topThreads } = await supabase
    .from("threads")
    .select("id, title, tag, pro_count, con_count, created_at")
    .gte("created_at", weekAgoISO)
    .order("pro_count", { ascending: false })
    .limit(20)

  const sorted = (topThreads ?? [])
    .map((t) => ({
      id: String(t.id),
      title: String(t.title),
      tag: String(t.tag ?? ""),
      total: (Number(t.pro_count) || 0) + (Number(t.con_count) || 0),
      proCount: Number(t.pro_count) || 0,
      conCount: Number(t.con_count) || 0,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 3)

  // 이번 주 총 토론/댓글/투표
  const { count: weekThreadCount } = await supabase
    .from("threads")
    .select("id", { count: "exact", head: true })
    .gte("created_at", weekAgoISO)

  const { count: weekCommentCount } = await supabase
    .from("comments")
    .select("id", { count: "exact", head: true })
    .gte("created_at", weekAgoISO)

  // MVP 유저 — 이번 주 댓글 수 기준
  const { data: weekComments } = await supabase
    .from("comments")
    .select("user_id")
    .gte("created_at", weekAgoISO)

  const userCommentMap: Record<string, number> = {}
  for (const c of weekComments ?? []) {
    const uid = String((c as Record<string, unknown>).user_id ?? "")
    if (uid) userCommentMap[uid] = (userCommentMap[uid] ?? 0) + 1
  }

  const mvpEntries = Object.entries(userCommentMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)

  const mvpUsers = mvpEntries.map(([uid, count]) => ({
    userId: uid,
    displayName: `유저 ${uid.replace(/-/g, "").slice(0, 5)}`,
    commentCount: count,
  }))

  // 키워드 — 이번 주 토론 제목에서 추출
  const allTitles = (topThreads ?? []).map((t) => String(t.title ?? ""))
  const wordMap: Record<string, number> = {}
  for (const title of allTitles) {
    const words = title.split(/\s+/).filter((w) => w.length >= 2 && w.length <= 10)
    for (const w of words) {
      wordMap[w] = (wordMap[w] ?? 0) + 1
    }
  }
  const topKeywords = Object.entries(wordMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([word]) => word)

  // 카테고리 분포
  const tagMap: Record<string, number> = {}
  for (const t of topThreads ?? []) {
    const tag = String(t.tag ?? "기타")
    tagMap[tag] = (tagMap[tag] ?? 0) + 1
  }

  return {
    topThreads: sorted,
    weekThreadCount: weekThreadCount ?? 0,
    weekCommentCount: weekCommentCount ?? 0,
    mvpUsers,
    topKeywords,
    tagMap,
  }
}

const MEDAL = ["🥇", "🥈", "🥉"]

export default async function WeeklyReportPage() {
  const report = await fetchWeeklyReport()

  const weekLabel = (() => {
    const now = new Date()
    const weekAgo = new Date(now.getTime() - 7 * 86400000)
    const fmt = (d: Date) =>
      `${d.getMonth() + 1}/${d.getDate()}`
    return `${fmt(weekAgo)} ~ ${fmt(now)}`
  })()

  return (
    <div className="min-h-screen bg-black text-zinc-100">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(1200px_circle_at_30%_10%,rgba(34,211,238,0.12),transparent_55%),radial-gradient(900px_circle_at_70%_80%,rgba(236,72,153,0.10),transparent_55%)]" />
      </div>

      <div className="relative mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
        <nav className="mb-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-200"
          >
            <ArrowLeft className="size-4" />
            아고라로
          </Link>
        </nav>

        <header className="mb-8 space-y-2">
          <div className="flex items-center gap-2">
            <CalendarDays className="size-5 text-cyan-300" />
            <h1 className="text-2xl font-semibold text-zinc-50">주간 리포트</h1>
          </div>
          <p className="text-sm text-zinc-400">{weekLabel} 네온 아고라 활동 요약</p>
        </header>

        <div className="space-y-6">
          {/* 참여 통계 */}
          <div className="grid grid-cols-2 gap-4">
            <Card className="weekly-stat-enter border-cyan-400/20 bg-black/40 backdrop-blur">
              <CardContent className="px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="grid size-10 place-items-center rounded-xl border border-cyan-400/25 bg-cyan-400/10 text-cyan-300">
                    <TrendingUp className="size-5" />
                  </div>
                  <div>
                    <div className="text-[11px] text-zinc-500">주간 토론</div>
                    <div className="text-xl font-bold text-cyan-100">
                      {report.weekThreadCount}개
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="weekly-stat-enter border-fuchsia-400/20 bg-black/40 backdrop-blur" style={{ animationDelay: "0.1s" }}>
              <CardContent className="px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="grid size-10 place-items-center rounded-xl border border-fuchsia-400/25 bg-fuchsia-400/10 text-fuchsia-300">
                    <MessageSquareText className="size-5" />
                  </div>
                  <div>
                    <div className="text-[11px] text-zinc-500">주간 댓글</div>
                    <div className="text-xl font-bold text-fuchsia-100">
                      {report.weekCommentCount}개
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* TOP3 토론 */}
          <Card className="border-white/10 bg-black/40 backdrop-blur">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Flame className="size-4 text-amber-300" />
                <CardTitle className="text-sm text-zinc-100">이번 주 TOP 3 토론</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {report.topThreads.length === 0 ? (
                <div className="py-4 text-center text-sm text-zinc-500">이번 주 토론이 없습니다</div>
              ) : (
                report.topThreads.map((t, i) => (
                  <Link
                    key={t.id}
                    href={`/thread/${t.id}`}
                    className="weekly-stat-enter flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 transition hover:border-cyan-400/30 hover:bg-cyan-400/[0.03]"
                    style={{ animationDelay: `${i * 0.1}s` }}
                  >
                    <span className="text-lg">{MEDAL[i]}</span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-zinc-100">{t.title}</div>
                      <div className="mt-1 flex items-center gap-3 text-[11px] text-zinc-500">
                        {t.tag && (
                          <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5">
                            {t.tag}
                          </span>
                        )}
                        <span>찬성 {t.proCount}</span>
                        <span>반대 {t.conCount}</span>
                      </div>
                    </div>
                    <span className="shrink-0 text-sm font-bold text-cyan-200">
                      {t.total} 투표
                    </span>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>

          {/* MVP 유저 */}
          <Card className="border-white/10 bg-black/40 backdrop-blur">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Crown className="size-4 text-amber-300" />
                <CardTitle className="text-sm text-zinc-100">MVP 유저</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {report.mvpUsers.length === 0 ? (
                <div className="py-4 text-center text-sm text-zinc-500">데이터 없음</div>
              ) : (
                report.mvpUsers.map((u, i) => (
                  <Link
                    key={u.userId}
                    href={`/profile/${u.userId}`}
                    className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 transition hover:border-fuchsia-400/30"
                  >
                    <span className="text-lg">{MEDAL[i]}</span>
                    <div className="flex-1">
                      <span className="text-sm font-medium text-zinc-200">
                        {u.displayName}
                      </span>
                    </div>
                    <span className="text-xs text-zinc-400">
                      <Users className="mr-1 inline size-3" />
                      댓글 {u.commentCount}개
                    </span>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>

          {/* 키워드 클라우드 */}
          {report.topKeywords.length > 0 && (
            <Card className="border-white/10 bg-black/40 backdrop-blur">
              <CardHeader>
                <CardTitle className="text-sm text-zinc-100">주간 키워드</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {report.topKeywords.map((kw) => (
                    <span
                      key={kw}
                      className="rounded-full border border-cyan-400/20 bg-cyan-400/5 px-3 py-1 text-xs text-cyan-200"
                    >
                      #{kw}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
