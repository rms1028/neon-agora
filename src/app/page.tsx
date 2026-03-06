import Link from "next/link"
import {
  Bot,
  Briefcase,
  Flame,
  Globe,
  GraduationCap,
  Landmark,
  Leaf,
  Monitor,
  MoreHorizontal,
  Palette,
  Sparkles,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react"

import {
  Card,
  CardContent,
} from "@/components/ui/card"
import { supabase } from "@/lib/supabase"
import { DebateList } from "@/components/debate-list"
import type { Debate } from "@/components/debate-list"
import { HeaderAuth } from "@/components/header-auth"
import { HotDebatesCarousel } from "@/components/hot-debates-carousel"
import { SidebarBookmarks } from "@/components/sidebar-bookmarks"

export const revalidate = 30

type ThreadRow = Record<string, unknown>

const PRESET_TAGS = [
  "AI", "정치", "경제", "사회", "기술", "문화", "교육", "환경", "기타",
]

const TAG_ICON_MAP: Record<string, { icon: typeof Globe; colorClass: string }> = {
  AI:   { icon: Bot,            colorClass: "text-cyan-400" },
  정치: { icon: Landmark,       colorClass: "text-rose-400" },
  경제: { icon: Briefcase,      colorClass: "text-emerald-400" },
  사회: { icon: Users,          colorClass: "text-amber-400" },
  기술: { icon: Monitor,        colorClass: "text-blue-400" },
  문화: { icon: Palette,        colorClass: "text-purple-400" },
  교육: { icon: GraduationCap,  colorClass: "text-teal-400" },
  환경: { icon: Leaf,           colorClass: "text-green-400" },
  기타: { icon: MoreHorizontal, colorClass: "text-zinc-400" },
}

function clampPct(n: number) {
  if (!Number.isFinite(n)) return 50
  return Math.max(0, Math.min(100, Math.round(n)))
}

function pickString(row: ThreadRow, keys: string[], fallback = "") {
  for (const k of keys) {
    const v = row[k]
    if (typeof v === "string" && v.trim().length > 0) return v
  }
  return fallback
}

function pickNumber(row: ThreadRow, keys: string[], fallback = 0) {
  for (const k of keys) {
    const v = row[k]
    if (typeof v === "number" && Number.isFinite(v)) return v
    if (typeof v === "string") {
      const parsed = Number(v)
      if (Number.isFinite(parsed)) return parsed
    }
  }
  return fallback
}

function pickBoolean(row: ThreadRow, keys: string[], fallback = false) {
  for (const k of keys) {
    const v = row[k]
    if (typeof v === "boolean") return v
    if (typeof v === "number") return v !== 0
    if (typeof v === "string") {
      const s = v.toLowerCase()
      if (s === "true" || s === "1" || s === "yes") return true
      if (s === "false" || s === "0" || s === "no") return false
    }
  }
  return fallback
}

function formatEndsIn(row: ThreadRow) {
  const direct = pickString(row, ["ends_in", "endsIn"], "")
  if (direct) return direct

  const raw = row["ends_at"] ?? row["endsAt"] ?? row["end_at"] ?? row["endAt"]
  if (!raw) return "상시"

  const end = raw instanceof Date ? raw : new Date(String(raw))
  if (Number.isNaN(end.getTime())) return "상시"

  const diffMs = end.getTime() - Date.now()
  if (diffMs <= 0) return "마감"

  const minutes = Math.floor(diffMs / 60000)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days >= 1) return `${days}일`
  if (hours >= 1) return `${hours}시간`
  return `${Math.max(1, minutes)}분`
}

function threadToDebate(row: ThreadRow): Debate | null {
  const id = pickString(row, ["id", "thread_id", "threadId"], "")
  if (!id) return null

  const title = pickString(row, ["title", "subject", "name"], "제목 없는 토론")
  const description = pickString(
    row,
    ["description", "summary", "content", "body"],
    ""
  )
  const tag = pickString(row, ["tag", "category", "topic"], "토론")

  const proCount = Math.max(0, pickNumber(row, ["pro_count", "proCount"], 0))
  const conCount = Math.max(0, pickNumber(row, ["con_count", "conCount"], 0))
  const total = proCount + conCount
  const yesPct = total > 0 ? clampPct((proCount / total) * 100) : 50

  const endsIn = formatEndsIn(row)
  const hot =
    pickBoolean(row, ["hot", "is_hot", "trending"], false) || total >= 10

  const createdAt = String(
    row["created_at"] ?? row["createdAt"] ?? new Date().toISOString()
  )

  const template = pickString(row, ["template"], "free")

  const expiresAt = typeof row["expires_at"] === "string" ? row["expires_at"] as string : undefined
  const isClosed = pickBoolean(row, ["is_closed"], false)
  const aiVerdict = pickString(row, ["ai_verdict"], "") || null

  return {
    id,
    title,
    description,
    tag,
    yesPct,
    proCount,
    conCount,
    endsIn,
    hot,
    createdAt,
    template,
    expiresAt,
    isClosed,
    aiVerdict,
  }
}

async function fetchDebates(tag?: string): Promise<Debate[]> {
  let query = supabase
    .from("threads")
    .select("id, title, content, tag, pro_count, con_count, created_at, is_closed, expires_at, template, ai_verdict, comments(count)")
    .order("created_at", { ascending: false })
    .limit(30)

  if (tag) {
    query = query.eq("tag", tag)
  }

  const { data, error } = await query

  if (error) return []
  const rows = (data ?? []) as (ThreadRow & { comments?: { count: number }[] })[]
  return rows.reduce<Debate[]>((acc, row) => {
    const debate = threadToDebate(row)
    if (!debate) return acc
    const commentAgg = row.comments
    debate.commentCount = Array.isArray(commentAgg) && commentAgg.length > 0
      ? commentAgg[0].count
      : 0
    acc.push(debate)
    return acc
  }, [])
}

/* 투표수 기준 상위 5개 — 캐러셀용 */
async function fetchTopBattles(): Promise<Debate[]> {
  const { data, error } = await supabase
    .from("threads")
    .select("id, title, content, tag, pro_count, con_count, created_at, is_closed, expires_at, template, ai_verdict")
    .order("pro_count", { ascending: false })
    .limit(20)

  if (error || !data) return []
  const rows = (data as ThreadRow[]).map(threadToDebate).filter((d): d is Debate => d !== null)
  return rows
    .sort((a, b) => (b.proCount + b.conCount) - (a.proCount + a.conCount))
    .slice(0, 5)
}


function formatCompact(n: number) {
  return new Intl.NumberFormat("ko-KR", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(n)
}

function NeonStat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <Card className="border-white/10 bg-black/30 py-4 shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_0_40px_rgba(34,211,238,0.08)]">
      <CardContent className="px-4">
        <div className="flex items-center gap-3">
          <div className="grid size-9 place-items-center rounded-lg border border-white/10 bg-white/5 text-cyan-300">
            {icon}
          </div>
          <div className="min-w-0">
            <div className="text-xs text-zinc-400">{label}</div>
            <div className="truncate text-sm font-semibold text-zinc-100">
              {value}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ tag?: string }>
}) {
  const params = await searchParams
  const activeTag = params.tag ?? null

  const [debates, topBattles] = await Promise.all([
    fetchDebates(activeTag ?? undefined),
    fetchTopBattles(),
  ])

  const totalVotes = debates.reduce(
    (acc, d) => acc + d.proCount + d.conCount,
    0
  )
  const hotCount = debates.filter((d) => d.hot).length

  return (
    <div className="min-h-screen bg-black text-zinc-100">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(1200px_circle_at_20%_10%,rgba(34,211,238,0.18),transparent_55%),radial-gradient(900px_circle_at_80%_20%,rgba(236,72,153,0.14),transparent_55%),radial-gradient(900px_circle_at_50%_90%,rgba(52,211,153,0.10),transparent_60%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.06),transparent_35%,rgba(255,255,255,0.04))] opacity-30" />
      </div>

      <div className="relative mx-auto w-full max-w-[1920px] px-4 py-10 sm:px-6 lg:px-10">
        {/* 최상단 네비게이션 바 */}
        <nav className="mb-6 flex items-center justify-between">
          <span className="text-[11px] tracking-widest text-zinc-600">
            NEON AGORA v1.0
          </span>
          <HeaderAuth />
        </nav>

        {/* ═══ 타이틀 바 ═══ */}
        <div className="mb-5 flex flex-col justify-between gap-3 md:flex-row md:items-end">
          <div>
            <div className="mb-1 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[10px] text-zinc-300">
              <Sparkles className="size-3 text-cyan-300" />
              CYBERPUNK DISCUSSION PLAZA
            </div>
            <h1 className="hero-title-glow text-2xl font-extrabold tracking-tight text-zinc-50 sm:text-4xl">
              네온 아고라
            </h1>
          </div>

          <div className="grid grid-cols-3 gap-2 md:w-[440px]">
            <NeonStat
              icon={<TrendingUp className="size-4" />}
              label="투표"
              value={formatCompact(totalVotes)}
            />
            <NeonStat
              icon={<Users className="size-4" />}
              label="토론"
              value={formatCompact(debates.length)}
            />
            <NeonStat
              icon={<Flame className="size-4" />}
              label="핫"
              value={`${hotCount}개`}
            />
          </div>
        </div>

        {/* ═══ 모바일 카테고리 칩 바 ═══ */}
        <div className="mb-4 flex gap-2 overflow-x-auto scrollbar-hide md:hidden">
          <Link
            href="/"
            className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-medium transition-all ${
              activeTag === null
                ? "bg-cyan-400/10 text-cyan-200 ring-1 ring-cyan-400/25"
                : "border border-white/10 text-zinc-400"
            }`}
          >
            <Globe className="size-3 text-cyan-400" />
            전체
          </Link>
          {PRESET_TAGS.map((tag) => {
            const tagMeta = TAG_ICON_MAP[tag]
            const IconComp = tagMeta?.icon ?? Zap
            const iconColor = tagMeta?.colorClass ?? "text-zinc-400"
            const isActive = activeTag === tag
            return (
              <Link
                key={tag}
                href={`/?tag=${tag}`}
                className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-medium transition-all ${
                  isActive
                    ? "bg-fuchsia-400/10 text-fuchsia-200 ring-1 ring-fuchsia-400/25"
                    : "border border-white/10 text-zinc-400"
                }`}
              >
                <IconComp className={`size-3 ${isActive ? "text-fuchsia-300" : iconColor}`} />
                {tag}
              </Link>
            )
          })}
        </div>

        {/* ═══ 2컬럼 대시보드 레이아웃 ═══ */}
        <main className="grid gap-5 md:grid-cols-[200px_1fr] lg:grid-cols-[220px_1fr] xl:grid-cols-[240px_1fr]">

          {/* ── 좌측: 카테고리 + 북마크 ── */}
          <aside className="hidden md:block">
            <div className="sticky top-24 space-y-4">
              {/* 카테고리 */}
              <div className="rounded-xl border border-white/[0.08] bg-black/30 p-3 backdrop-blur">
                <div className="mb-2 text-[10px] font-semibold tracking-widest text-zinc-500">
                  CATEGORIES
                </div>
                <nav className="space-y-0.5">
                  <Link
                    href="/"
                    className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-[11px] font-medium transition-all ${
                      activeTag === null
                        ? "bg-cyan-400/10 text-cyan-200 ring-1 ring-cyan-400/25"
                        : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
                    }`}
                  >
                    <Globe className="size-3.5 text-cyan-400" />
                    전체
                  </Link>
                  {PRESET_TAGS.map((tag) => {
                    const tagMeta = TAG_ICON_MAP[tag]
                    const IconComp = tagMeta?.icon ?? Zap
                    const iconColor = tagMeta?.colorClass ?? "text-zinc-400"
                    const isActive = activeTag === tag
                    return (
                      <Link
                        key={tag}
                        href={`/?tag=${tag}`}
                        className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-[11px] font-medium transition-all ${
                          isActive
                            ? "bg-fuchsia-400/10 text-fuchsia-200 ring-1 ring-fuchsia-400/25"
                            : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
                        }`}
                      >
                        <IconComp className={`size-3.5 ${isActive ? "text-fuchsia-300" : iconColor}`} />
                        {tag}
                      </Link>
                    )
                  })}
                </nav>
              </div>

              <SidebarBookmarks />
            </div>
          </aside>

          {/* ── 메인: 캐러셀 + 토론 그리드 ── */}
          <div className="min-w-0 space-y-5">
            {/* MAIN AGORA 캐러셀 */}
            <HotDebatesCarousel hotDebates={topBattles} />

            {/* 토론 목록 */}
            <DebateList initialDebates={debates} initialTag={activeTag} />
          </div>

        </main>
      </div>
    </div>
  )
}
