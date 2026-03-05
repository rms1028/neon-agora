import Link from "next/link"
import {
  ArrowLeft,
  BarChart3,
  Clock,
  Flame,
  MessageSquareText,
  Swords,
  TrendingUp,
  Users,
} from "lucide-react"

import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export const revalidate = 300

const PRESET_TAGS = ["AI", "정치", "경제", "사회", "기술", "문화", "교육", "환경", "기타"]

const TAG_COLORS: Record<string, string> = {
  AI: "#22d3ee",
  정치: "#ec4899",
  경제: "#f59e0b",
  사회: "#a78bfa",
  기술: "#34d399",
  문화: "#fb923c",
  교육: "#60a5fa",
  환경: "#4ade80",
  기타: "#a1a1aa",
}

type DayStats = { date: string; threads: number; comments: number }

async function fetchStats() {
  // 오늘 기준 (UTC)
  const now = new Date()
  const todayStr = now.toISOString().slice(0, 10)
  const weekAgo = new Date(now.getTime() - 7 * 86400000)

  // 토론 수
  const { count: totalThreads } = await supabase
    .from("threads")
    .select("id", { count: "exact", head: true })

  // 댓글 수
  const { count: totalComments } = await supabase
    .from("comments")
    .select("id", { count: "exact", head: true })

  // 총 투표수 (최근 1000개 스레드 기준)
  const { data: voteData } = await supabase
    .from("threads")
    .select("pro_count, con_count")
    .order("created_at", { ascending: false })
    .limit(1000)
  let totalVotes = 0
  for (const row of voteData ?? []) {
    totalVotes += (Number(row.pro_count) || 0) + (Number(row.con_count) || 0)
  }

  // 오늘 토론/댓글/투표
  const { count: todayThreads } = await supabase
    .from("threads")
    .select("id", { count: "exact", head: true })
    .gte("created_at", todayStr)

  const { count: todayComments } = await supabase
    .from("comments")
    .select("id", { count: "exact", head: true })
    .gte("created_at", todayStr)

  // 주간 활동 (7일)
  const { data: weekThreads } = await supabase
    .from("threads")
    .select("created_at")
    .gte("created_at", weekAgo.toISOString())

  const { data: weekComments } = await supabase
    .from("comments")
    .select("created_at")
    .gte("created_at", weekAgo.toISOString())

  const dayMap: Record<string, DayStats> = {}
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86400000)
    const ds = d.toISOString().slice(0, 10)
    dayMap[ds] = { date: ds, threads: 0, comments: 0 }
  }
  for (const t of weekThreads ?? []) {
    const ds = String(t.created_at ?? "").slice(0, 10)
    if (dayMap[ds]) dayMap[ds].threads++
  }
  for (const c of weekComments ?? []) {
    const ds = String(c.created_at ?? "").slice(0, 10)
    if (dayMap[ds]) dayMap[ds].comments++
  }
  const weeklyData = Object.values(dayMap)

  // 인기 토론 Top 5
  const { data: topThreads } = await supabase
    .from("threads")
    .select("id, title, pro_count, con_count")
    .order("pro_count", { ascending: false })
    .limit(5)

  // 카테고리 분포 (최근 1000개 제한)
  const { data: allThreadsForTags } = await supabase
    .from("threads")
    .select("tag")
    .order("created_at", { ascending: false })
    .limit(1000)
  const tagCounts: Record<string, number> = {}
  for (const t of allThreadsForTags ?? []) {
    const tag = String(t.tag ?? "기타")
    tagCounts[tag] = (tagCounts[tag] ?? 0) + 1
  }

  // 시간대별 활동 (최근 댓글 2000개 기준)
  const { data: allComments } = await supabase
    .from("comments")
    .select("created_at")
    .order("created_at", { ascending: false })
    .limit(2000)
  const hourCounts = new Array(24).fill(0)
  for (const c of allComments ?? []) {
    const h = new Date(String(c.created_at ?? "")).getHours()
    if (Number.isFinite(h)) hourCounts[h]++
  }

  return {
    totalThreads: totalThreads ?? 0,
    totalComments: totalComments ?? 0,
    totalVotes,
    todayThreads: todayThreads ?? 0,
    todayComments: todayComments ?? 0,
    weeklyData,
    topThreads: (topThreads ?? []).map((t) => ({
      id: String(t.id),
      title: String(t.title),
      total: (Number(t.pro_count) || 0) + (Number(t.con_count) || 0),
    })),
    tagCounts,
    hourCounts,
  }
}

// ─── 차트 컴포넌트들 (CSS/SVG only) ─────────────────────────

function WeeklyBarChart({ data }: { data: DayStats[] }) {
  const maxVal = Math.max(1, ...data.map((d) => Math.max(d.threads, d.comments)))
  return (
    <div className="flex items-end gap-2">
      {data.map((d) => {
        const dayLabel = new Date(d.date + "T00:00:00").toLocaleDateString("ko-KR", { weekday: "short" })
        return (
          <div key={d.date} className="flex flex-1 flex-col items-center gap-1">
            <div className="flex w-full items-end gap-0.5" style={{ height: 120 }}>
              <div
                className="flex-1 rounded-t bg-gradient-to-t from-cyan-500 to-cyan-300"
                style={{
                  height: `${Math.max(4, (d.threads / maxVal) * 100)}%`,
                  boxShadow: d.threads > 0 ? "0 0 8px rgba(34,211,238,0.3)" : undefined,
                }}
                title={`토론 ${d.threads}개`}
              />
              <div
                className="flex-1 rounded-t bg-gradient-to-t from-fuchsia-500 to-fuchsia-300"
                style={{
                  height: `${Math.max(4, (d.comments / maxVal) * 100)}%`,
                  boxShadow: d.comments > 0 ? "0 0 8px rgba(236,72,153,0.3)" : undefined,
                }}
                title={`댓글 ${d.comments}개`}
              />
            </div>
            <span className="text-[10px] text-zinc-500">{dayLabel}</span>
          </div>
        )
      })}
    </div>
  )
}

function CategoryDonut({ tagCounts }: { tagCounts: Record<string, number> }) {
  const total = Object.values(tagCounts).reduce((a, b) => a + b, 0)
  if (total === 0) {
    return <div className="py-8 text-center text-sm text-zinc-500">데이터 없음</div>
  }

  const size = 160
  const strokeWidth = 24
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  let offset = 0

  const entries = Object.entries(tagCounts)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])

  return (
    <div className="flex items-center justify-center gap-6">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {entries.map(([tag, count]) => {
          const pct = count / total
          const dashLength = pct * circumference
          const dashGap = circumference - dashLength
          const currentOffset = offset
          offset += dashLength
          return (
            <circle
              key={tag}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={TAG_COLORS[tag] ?? "#a1a1aa"}
              strokeWidth={strokeWidth}
              strokeDasharray={`${dashLength} ${dashGap}`}
              strokeDashoffset={-currentOffset}
              strokeLinecap="butt"
              style={{ transition: "stroke-dasharray 0.5s" }}
            />
          )
        })}
        <text x="50%" y="50%" textAnchor="middle" dy="0.35em" fill="#fff" fontSize="18" fontWeight="bold">
          {total}
        </text>
      </svg>
      <div className="space-y-1.5">
        {entries.map(([tag, count]) => (
          <div key={tag} className="flex items-center gap-2 text-xs">
            <span
              className="size-2.5 rounded-full"
              style={{ backgroundColor: TAG_COLORS[tag] ?? "#a1a1aa" }}
            />
            <span className="text-zinc-300">{tag}</span>
            <span className="text-zinc-500">{count}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function HourlyHeatmap({ hourCounts }: { hourCounts: number[] }) {
  const maxVal = Math.max(1, ...hourCounts)
  return (
    <div className="grid grid-cols-12 gap-1">
      {hourCounts.map((count, h) => {
        const intensity = count / maxVal
        return (
          <div
            key={h}
            className="flex flex-col items-center gap-1"
            title={`${h}시: ${count}개`}
          >
            <div
              className="aspect-square w-full rounded"
              style={{
                backgroundColor: intensity > 0
                  ? `rgba(34, 211, 238, ${0.1 + intensity * 0.8})`
                  : "rgba(255,255,255,0.04)",
                boxShadow: intensity > 0.5
                  ? `0 0 ${Math.round(intensity * 12)}px rgba(34,211,238,${intensity * 0.4})`
                  : undefined,
              }}
            />
            <span className="text-[8px] text-zinc-600">{h}</span>
          </div>
        )
      })}
    </div>
  )
}

// ─── 메인 페이지 ─────────────────────────────────────────────

export default async function StatsPage() {
  const stats = await fetchStats()

  return (
    <div className="min-h-screen bg-black text-zinc-100">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(1200px_circle_at_30%_10%,rgba(34,211,238,0.12),transparent_55%),radial-gradient(900px_circle_at_70%_80%,rgba(236,72,153,0.10),transparent_55%)]" />
      </div>

      <div className="relative mx-auto w-full max-w-5xl px-4 py-10 sm:px-6">
        <nav className="mb-6 flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-200"
          >
            <ArrowLeft className="size-4" />
            아고라로
          </Link>
          <span className="text-[11px] tracking-widest text-zinc-600">
            ANALYTICS DASHBOARD
          </span>
        </nav>

        <header className="mb-8 space-y-2">
          <div className="flex items-center gap-2">
            <BarChart3 className="size-5 text-cyan-300" />
            <h1 className="text-2xl font-semibold text-zinc-50">토론 통계</h1>
          </div>
          <p className="text-sm text-zinc-400">네온 아고라의 실시간 활동 데이터</p>
        </header>

        <div className="space-y-6">
          {/* 섹션 1: 오늘의 수치 */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Card className="border-cyan-400/20 bg-black/40 backdrop-blur">
              <CardContent className="px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="grid size-10 place-items-center rounded-xl border border-cyan-400/25 bg-cyan-400/10 text-cyan-300">
                    <Swords className="size-5" />
                  </div>
                  <div>
                    <div className="text-[11px] text-zinc-500">오늘 토론</div>
                    <div className="text-xl font-bold text-cyan-100">
                      {stats.todayThreads}
                      <span className="ml-1 text-xs font-normal text-zinc-500">/ {stats.totalThreads}개</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-fuchsia-400/20 bg-black/40 backdrop-blur">
              <CardContent className="px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="grid size-10 place-items-center rounded-xl border border-fuchsia-400/25 bg-fuchsia-400/10 text-fuchsia-300">
                    <MessageSquareText className="size-5" />
                  </div>
                  <div>
                    <div className="text-[11px] text-zinc-500">오늘 댓글</div>
                    <div className="text-xl font-bold text-fuchsia-100">
                      {stats.todayComments}
                      <span className="ml-1 text-xs font-normal text-zinc-500">/ {stats.totalComments}개</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-emerald-400/20 bg-black/40 backdrop-blur">
              <CardContent className="px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="grid size-10 place-items-center rounded-xl border border-emerald-400/25 bg-emerald-400/10 text-emerald-300">
                    <Users className="size-5" />
                  </div>
                  <div>
                    <div className="text-[11px] text-zinc-500">총 투표수</div>
                    <div className="text-xl font-bold text-emerald-100">
                      {stats.totalVotes.toLocaleString()}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 섹션 2: 주간 활동 */}
          <Card className="border-white/10 bg-black/40 backdrop-blur">
            <CardHeader>
              <div className="flex items-center gap-2">
                <TrendingUp className="size-4 text-cyan-300" />
                <CardTitle className="text-sm text-zinc-100">주간 활동</CardTitle>
              </div>
              <div className="flex items-center gap-4 text-[11px]">
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-cyan-400" /> 토론
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-fuchsia-400" /> 댓글
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <WeeklyBarChart data={stats.weeklyData} />
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* 섹션 3: 인기 토론 Top 5 */}
            <Card className="border-white/10 bg-black/40 backdrop-blur">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Flame className="size-4 text-amber-300" />
                  <CardTitle className="text-sm text-zinc-100">인기 토론 Top 5</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {stats.topThreads.length === 0 ? (
                  <div className="py-4 text-center text-sm text-zinc-500">토론 없음</div>
                ) : (
                  stats.topThreads.map((t, i) => (
                    <Link
                      key={t.id}
                      href={`/thread/${t.id}`}
                      className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 transition hover:border-cyan-400/30 hover:bg-cyan-400/[0.03]"
                    >
                      <span className="w-5 text-center text-xs font-bold text-zinc-600">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span className="flex-1 truncate text-sm text-zinc-200">{t.title}</span>
                      <span className="shrink-0 text-xs font-semibold text-zinc-400">
                        {t.total} 투표
                      </span>
                    </Link>
                  ))
                )}
              </CardContent>
            </Card>

            {/* 섹션 4: 카테고리 분포 */}
            <Card className="border-white/10 bg-black/40 backdrop-blur">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <BarChart3 className="size-4 text-emerald-300" />
                  <CardTitle className="text-sm text-zinc-100">카테고리 분포</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <CategoryDonut tagCounts={stats.tagCounts} />
              </CardContent>
            </Card>
          </div>

          {/* 섹션 5: 시간대별 활동 */}
          <Card className="border-white/10 bg-black/40 backdrop-blur">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Clock className="size-4 text-violet-300" />
                <CardTitle className="text-sm text-zinc-100">시간대별 활동 히트맵</CardTitle>
              </div>
              <p className="text-[11px] text-zinc-500">댓글 기준, 0~23시</p>
            </CardHeader>
            <CardContent>
              <HourlyHeatmap hourCounts={stats.hourCounts} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
