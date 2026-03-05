"use client"

import {
  Bell,
  BellRing,
  Bookmark,
  BookmarkCheck,
  Clock,
  Flame,
  Globe,
  Hourglass,
  Loader2,
  Lock,
  MessageSquareText,
  ScanSearch,
  Share2,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
  Users,
  X,
  Zap,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
} from "@/components/ui/card"
import { NewThreadModal } from "@/components/new-thread-modal"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/components/auth-provider"
import { useToast } from "@/components/toast-provider"
import { useProfile } from "@/components/profile-provider"
import { useTagSubscriptions } from "@/hooks/useTagSubscriptions"
import { timeAgo } from "@/lib/utils"
import { DebateCountdown } from "@/components/debate-countdown"

export type Debate = {
  id: string
  title: string
  description: string
  tag: string
  yesPct: number
  proCount: number
  conCount: number
  endsIn: string
  hot: boolean
  createdAt: string
  isClosed?: boolean
  template?: string
  commentCount?: number
  expiresAt?: string
  aiVerdict?: string | null
}

const TEMPLATE_BADGES: Record<string, { label: string; color: string }> = {
  strict: { label: "CLASH", color: "border-[#00FFD1]/30 bg-[#00FFD1]/10 text-[#00FFD1]" },
}

type SortBy = "latest" | "popular" | "hot" | "ending"
type StatusFilter = "all" | "live" | "settled" | "my"

const PRESET_TAGS = [
  "AI", "정치", "경제", "사회", "기술", "문화", "교육", "환경", "기타",
]

const PAGE_SIZE = 20

// RPC 함수 미존재 시 직접 순차 업데이트로 폴백
async function castVoteFallback({
  supabase: sb,
  id,
  userId,
  type,
  prev,
}: {
  supabase: typeof import("@/lib/supabase").supabase
  id: string
  userId: string
  type: "pro" | "con"
  prev: "pro" | "con" | null
}): Promise<{ ok: boolean }> {
  let voteErr: { code?: string } | null = null
  if (prev === type) {
    const { error } = await sb.from("thread_votes").delete()
      .eq("thread_id", id).eq("user_id", userId)
    voteErr = error
  } else if (prev !== null) {
    const { error } = await sb.from("thread_votes").update({ vote_type: type })
      .eq("thread_id", id).eq("user_id", userId)
    voteErr = error
  } else {
    const { error } = await sb.from("thread_votes")
      .insert({ thread_id: id, user_id: userId, vote_type: type })
    voteErr = error
  }
  if (voteErr && voteErr.code !== "42P01" && voteErr.code !== "PGRST205") {
    console.error("[Vote Fallback] thread_votes 오류:", voteErr.code)
    return { ok: false }
  }

  const { data: row } = await sb.from("threads")
    .select("pro_count, con_count").eq("id", id).single()
  if (!row) return { ok: false }

  const proDelta =
    prev === type ? (type === "pro" ? -1 : 0)
    : prev !== null ? (type === "pro" ? 1 : -1)
    : type === "pro" ? 1 : 0
  const conDelta =
    prev === type ? (type === "con" ? -1 : 0)
    : prev !== null ? (type === "con" ? 1 : -1)
    : type === "con" ? 1 : 0

  const { error: countErr } = await sb.from("threads").update({
    pro_count: Math.max(0, (row.pro_count ?? 0) + proDelta),
    con_count: Math.max(0, (row.con_count ?? 0) + conDelta),
  }).eq("id", id)

  if (countErr) {
    console.error("[Vote Fallback] threads 오류:", countErr.code)
    return { ok: false }
  }
  return { ok: true }
}

function formatCompact(n: number) {
  return new Intl.NumberFormat("ko-KR", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(n)
}

/* ─── 검색 하이라이트 ──────────────────────────────── */

function HighlightText({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>
  const escaped = query.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const parts = text.split(new RegExp(`(${escaped})`, "gi"))
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.trim().toLowerCase() ? (
          <mark
            key={i}
            className="rounded-sm bg-cyan-400/25 px-0.5 text-cyan-100"
          >
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  )
}

/* ─── raw row → Debate (클라이언트 무한스크롤용) ──── */

function rawToDebate(row: Record<string, unknown>): Debate {
  const pro = Math.max(0, Number(row.pro_count) || 0)
  const con = Math.max(0, Number(row.con_count) || 0)
  const total = pro + con
  return {
    id: String(row.id),
    title: String(row.title ?? "제목 없는 토론"),
    description: String(row.content ?? ""),
    tag: String(row.tag ?? "토론"),
    yesPct: total > 0 ? Math.round((pro / total) * 100) : 50,
    proCount: pro,
    conCount: con,
    endsIn: "상시",
    hot: total >= 10,
    createdAt: String(row.created_at ?? new Date().toISOString()),
    isClosed: row.is_closed === true,
    template: typeof row.template === "string" ? row.template : undefined,
    commentCount: typeof row.comment_count === "number" ? row.comment_count : undefined,
    expiresAt: typeof row.expires_at === "string" ? row.expires_at : undefined,
    aiVerdict: typeof row.ai_verdict === "string" ? row.ai_verdict : null,
  }
}

/* ─── 토론 카드 (Polymarket 스타일 컴팩트) ────────── */

function DebateCard({
  debate,
  onVote,
  onOpen,
  isVoting,
  myVote,
  searchQuery,
  isBookmarked,
  onBookmark,
  onShare,
}: {
  debate: Debate
  onVote: (id: string, type: "pro" | "con") => void
  onOpen: (id: string) => void
  isVoting: boolean
  myVote: "pro" | "con" | null
  searchQuery?: string
  isBookmarked?: boolean
  onBookmark?: (id: string) => void
  onShare?: (debate: Debate) => void
}) {
  const isFree = !debate.template || debate.template === "free"
  const total = debate.proCount + debate.conCount
  const proPct = total > 0 ? Math.round((debate.proCount / total) * 100) : 50
  const conPct = 100 - proPct
  const winner: "pro" | "con" | null =
    Math.abs(proPct - conPct) >= 5 ? (proPct > conPct ? "pro" : "con") : null

  const q = searchQuery?.trim() ?? ""

  return (
    <div
      className={`group/card cursor-pointer rounded-xl border p-px backdrop-blur transition-all duration-200 ${
        debate.hot && !isFree
          ? "hot-border-flow bg-black/40 hover:shadow-[0_0_30px_rgba(249,115,22,0.15)]"
          : isFree
            ? "border-[#39FF14]/[0.08] bg-black/40 hover:border-[#39FF14]/20 hover:shadow-[0_0_30px_rgba(57,255,20,0.06)]"
            : "border-white/[0.08] bg-black/40 hover:border-white/15 hover:shadow-[0_0_30px_rgba(34,211,238,0.08)]"
      }`}
      onClick={() => onOpen(debate.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onOpen(debate.id)
      }}
      aria-label={`토론 상세 보기: ${debate.title}`}
    >
      <div className="flex h-full flex-col p-4">
        {/* 상단: 태그 + 뱃지 */}
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] ${
            isFree
              ? "border-[#39FF14]/15 bg-[#39FF14]/5 text-[#39FF14]/80"
              : "border-white/10 bg-white/5 text-zinc-300"
          }`}>
            <Zap className={`size-2.5 ${isFree ? "text-[#39FF14]/60" : "text-cyan-300"}`} />
            {debate.tag}
          </span>
          {isFree && (
            <span className="inline-flex items-center gap-1 rounded-full border border-[#39FF14]/20 bg-[#39FF14]/10 px-1.5 py-0.5 text-[10px] font-medium text-[#39FF14]/80">
              FREE
            </span>
          )}
          {debate.hot && (
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] text-amber-200">
              <Flame className="size-2.5" />
              HOT
            </span>
          )}
          {debate.isClosed && (
            <span className="inline-flex items-center gap-1 rounded-full border border-red-400/30 bg-red-400/10 px-1.5 py-0.5 text-[10px] text-red-200">
              <Lock className="size-2.5" />
              마감
            </span>
          )}
          {debate.template && TEMPLATE_BADGES[debate.template] && (
            <span className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] ${TEMPLATE_BADGES[debate.template].color}`}>
              {TEMPLATE_BADGES[debate.template].label}
            </span>
          )}
        </div>

        {/* 제목 */}
        <h3 className="mt-1 mb-2 line-clamp-2 text-lg font-bold leading-snug text-white/90 group-hover/card:text-white">
          {q ? <HighlightText text={debate.title} query={q} /> : debate.title}
        </h3>

        {isFree ? (
          /* ━━━ 자유 토론: 미리보기 + 메타 + 입장 버튼 ━━━ */
          <>
            {/* 본문 미리보기 */}
            {debate.description ? (
              <p className="mb-3 line-clamp-2 text-[13px] leading-relaxed text-zinc-400">
                {debate.description}
              </p>
            ) : (
              <p className="mb-3 line-clamp-2 text-[13px] leading-relaxed text-zinc-600 italic">
                자유롭게 의견을 나눠보세요. 첫 번째 댓글의 주인공이 되어보세요!
              </p>
            )}

            {/* 메타 정보 — 얇은 한 줄 */}
            <div className="mb-3 flex flex-wrap items-center gap-2.5 text-[11px]">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-900/20 px-2.5 py-1 text-teal-400">
                <MessageSquareText className="size-3" />
                <span className="font-semibold tabular-nums">{debate.commentCount ?? 0}</span>
                <span className="text-teal-400/60">댓글</span>
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.04] px-2.5 py-1 text-zinc-400">
                <Users className="size-3" />
                <span className="font-semibold tabular-nums">{formatCompact(total)}</span>
                <span className="text-zinc-500">참여</span>
              </span>
              {debate.createdAt && (
                <span className="inline-flex items-center gap-1 text-zinc-600">
                  <Clock className="size-3" />
                  {timeAgo(debate.createdAt)}
                </span>
              )}
              <DebateCountdown
                expiresAt={debate.expiresAt}
                isClosed={debate.isClosed}
                size="sm"
              />
            </div>

            {/* spacer */}
            <div className="mt-auto" />

            {/* 입장하기 버튼 + 북마크/공유 */}
            <div
              className="flex items-center gap-1.5"
              onClick={(e) => e.stopPropagation()}
            >
              <Button
                size="sm"
                variant="outline"
                className="h-8 flex-1 border-[#39FF14]/25 bg-[#39FF14]/10 text-xs font-medium text-[#39FF14] transition hover:bg-[#39FF14]/20 hover:shadow-[0_0_12px_rgba(57,255,20,0.15)]"
                onClick={(e) => {
                  e.stopPropagation()
                  onOpen(debate.id)
                }}
              >
                <MessageSquareText className="size-3.5" />
                자유롭게 의견 남기기
              </Button>
              {onBookmark && (
                <Button
                  size="icon-sm"
                  variant="outline"
                  className={`size-8 shrink-0 ${
                    isBookmarked
                      ? "border-amber-400/40 bg-amber-400/15 text-amber-300 hover:bg-amber-400/20"
                      : "border-white/15 bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-zinc-100"
                  }`}
                  aria-label={isBookmarked ? "북마크 해제" : "북마크"}
                  onClick={(e) => {
                    e.stopPropagation()
                    onBookmark(debate.id)
                  }}
                >
                  {isBookmarked ? <BookmarkCheck className="size-3.5" /> : <Bookmark className="size-3.5" />}
                </Button>
              )}
              {onShare && (
                <Button
                  size="icon-sm"
                  variant="outline"
                  className="size-8 shrink-0 border-white/15 bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-zinc-100"
                  aria-label="공유"
                  onClick={(e) => {
                    e.stopPropagation()
                    onShare(debate)
                  }}
                >
                  <Share2 className="size-3.5" />
                </Button>
              )}
            </div>
          </>
        ) : (
          /* ━━━ 찬반 토론: 게이지 + 투표 버튼 ━━━ */
          <>
            {/* 찬반 퍼센티지 — Polymarket 스타일 큰 숫자 */}
            <div className="mb-3 flex items-end justify-between">
              <div className="space-y-0.5">
                <div className="text-[10px] text-zinc-500">찬성</div>
                <div className={`text-2xl font-extrabold tabular-nums leading-none ${
                  winner === "pro" ? "text-cyan-300" : "text-cyan-300/70"
                }`}>
                  {proPct}<span className="text-sm font-bold">%</span>
                </div>
              </div>
              <div className="space-y-0.5 text-right">
                <div className="text-[10px] text-zinc-500">반대</div>
                <div className={`text-2xl font-extrabold tabular-nums leading-none ${
                  winner === "con" ? "text-fuchsia-300" : "text-fuchsia-300/70"
                }`}>
                  {conPct}<span className="text-sm font-bold">%</span>
                </div>
              </div>
            </div>

            {/* 컴팩트 게이지 바 */}
            <div className="relative mb-3 h-2 overflow-hidden rounded-full bg-white/[0.08]">
              <div
                className={`absolute inset-y-0 left-0 rounded-l-full ${
                  winner === "pro"
                    ? "bg-gradient-to-r from-cyan-400 to-sky-400"
                    : "bg-cyan-500/80"
                }`}
                style={{ width: `${proPct}%` }}
              />
              <div
                className={`absolute inset-y-0 right-0 rounded-r-full ${
                  winner === "con"
                    ? "bg-gradient-to-l from-fuchsia-400 to-pink-400"
                    : "bg-fuchsia-500/80"
                }`}
                style={{ width: `${conPct}%` }}
              />
            </div>

            {/* spacer → 하단 고정 */}
            <div className="mt-auto" />

            {/* 참여자 수 + 시간 */}
            <div className="mb-3 flex items-center gap-3 text-[11px] text-zinc-500">
              <span className="flex items-center gap-1.5">
                <Users className="size-3 text-zinc-400" />
                {formatCompact(total)}명 참여
              </span>
              {debate.createdAt && (
                <span className="flex items-center gap-1">
                  <Clock className="size-3 text-zinc-500" />
                  {timeAgo(debate.createdAt)}
                </span>
              )}
              <DebateCountdown
                expiresAt={debate.expiresAt}
                isClosed={debate.isClosed}
                size="sm"
              />
            </div>

            {/* 투표 버튼 행 */}
            <div
              className="flex items-center gap-1.5"
              onClick={(e) => e.stopPropagation()}
            >
              <Button
                size="sm"
                variant="outline"
                disabled={isVoting || debate.isClosed}
                onClick={(e) => {
                  e.stopPropagation()
                  onVote(debate.id, "pro")
                }}
                className={`h-8 flex-1 text-xs ${
                  myVote === "pro"
                    ? "border-cyan-400/60 bg-cyan-400/25 text-cyan-50 shadow-[0_0_10px_rgba(34,211,238,0.25)] ring-1 ring-cyan-400/40 hover:bg-cyan-400/30"
                    : "border-cyan-400/30 bg-cyan-400/10 text-cyan-100 hover:bg-cyan-400/20"
                }`}
              >
                <ThumbsUp className="size-3.5" />
                찬성
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={isVoting || debate.isClosed}
                onClick={(e) => {
                  e.stopPropagation()
                  onVote(debate.id, "con")
                }}
                className={`h-8 flex-1 text-xs ${
                  myVote === "con"
                    ? "border-fuchsia-400/60 bg-fuchsia-400/25 text-fuchsia-50 shadow-[0_0_10px_rgba(236,72,153,0.25)] ring-1 ring-fuchsia-400/40 hover:bg-fuchsia-400/30"
                    : "border-fuchsia-400/30 bg-fuchsia-400/10 text-fuchsia-100 hover:bg-fuchsia-400/20"
                }`}
              >
                <ThumbsDown className="size-3.5" />
                반대
              </Button>

              {/* 북마크 + 공유 */}
              {onBookmark && (
                <Button
                  size="icon-sm"
                  variant="outline"
                  className={`size-8 shrink-0 ${
                    isBookmarked
                      ? "border-amber-400/40 bg-amber-400/15 text-amber-300 hover:bg-amber-400/20"
                      : "border-white/15 bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-zinc-100"
                  }`}
                  aria-label={isBookmarked ? "북마크 해제" : "북마크"}
                  onClick={(e) => {
                    e.stopPropagation()
                    onBookmark(debate.id)
                  }}
                >
                  {isBookmarked ? <BookmarkCheck className="size-3.5" /> : <Bookmark className="size-3.5" />}
                </Button>
              )}
              {onShare && (
                <Button
                  size="icon-sm"
                  variant="outline"
                  className="size-8 shrink-0 border-white/15 bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-zinc-100"
                  aria-label="공유"
                  onClick={(e) => {
                    e.stopPropagation()
                    onShare(debate)
                  }}
                >
                  <Share2 className="size-3.5" />
                </Button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

/* ─── 메인 리스트 ──────────────────────────────────── */

export function DebateList({ initialDebates, initialTag }: { initialDebates: Debate[]; initialTag?: string | null }) {
  const { user } = useAuth()
  const { showToast } = useToast()
  const { isBanned, profile, awardXp } = useProfile()
  const router = useRouter()
  const { subscribed: subscribedTags, toggleSubscription } = useTagSubscriptions()
  const [debates, setDebates] = useState<Debate[]>(initialDebates)
  const debatesRef = useRef<Debate[]>(initialDebates)
  useEffect(() => { debatesRef.current = debates }, [debates])
  const [sortBy, setSortBy] = useState<SortBy>("latest")
  const [filterTag, setFilterTag] = useState<string | null>(initialTag ?? null)
  const [userVotes, setUserVotes] = useState<Record<string, "pro" | "con">>({})
  const [votingId, setVotingId] = useState<string | null>(null)

  // ── HOT 피드 ──
  const [hotDebates, setHotDebates] = useState<Debate[]>([])
  const [hotLoading, setHotLoading] = useState(false)
  const hotTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── 검색 ──
  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedQuery, setDebouncedQuery] = useState("")
  const [serverResults, setServerResults] = useState<Debate[] | null>(null)
  const [searchLoading, setSearchLoading] = useState(false)
  const [glitchKey, setGlitchKey] = useState(0)

  // ── 상태 필터 ──
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [myThreadIds, setMyThreadIds] = useState<Set<string> | null>(null)
  const [myThreadIdsLoading, setMyThreadIdsLoading] = useState(false)

  // ── 무한 스크롤 ──
  const [hasMore, setHasMore] = useState(initialDebates.length >= 30)
  const [loadingMore, setLoadingMore] = useState(false)
  const sentinelRef = useRef<HTMLDivElement>(null)

  // ── 북마크 ──
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set())

  // ── Refs ──
  const userVotesRef = useRef<Record<string, "pro" | "con">>({})
  const votingSet = useRef<Set<string>>(new Set())
  const pendingVotes = useRef<Set<string>>(new Set())

  useEffect(() => {
    userVotesRef.current = userVotes
  }, [userVotes])

  useEffect(() => {
    setDebates(initialDebates)
  }, [initialDebates])

  // URL 태그 변경 시 필터 동기화
  useEffect(() => {
    setFilterTag(initialTag ?? null)
  }, [initialTag])

  // ── 디바운스 ──
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery.trim()), 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // ── 서버 사이드 검색 ──
  useEffect(() => {
    if (!debouncedQuery) {
      setServerResults(null)
      setSearchLoading(false)
      return
    }
    let cancelled = false
    setSearchLoading(true)
    const escaped = debouncedQuery.replace(/[%_]/g, (c) => `\\${c}`)
    const pattern = `%${escaped}%`
    ;(async () => {
      const { data, error } = await supabase
        .from("threads")
        .select("*, comments(count)")
        .or(`title.ilike.${pattern},content.ilike.${pattern},tag.ilike.${pattern}`)
        .order("created_at", { ascending: false })
        .limit(50)
      if (cancelled) return
      if (error) {
        setServerResults([])
        setSearchLoading(false)
        return
      }
      const rows = (data ?? []) as (Record<string, unknown> & { comments?: { count: number }[] })[]
      const results = rows.map((row) => {
        const d = rawToDebate(row)
        const commentAgg = row.comments
        d.commentCount = Array.isArray(commentAgg) && commentAgg.length > 0
          ? commentAgg[0].count
          : 0
        return d
      })
      setServerResults(results)
      setSearchLoading(false)
      setGlitchKey((k) => k + 1)
    })()
    return () => { cancelled = true }
  }, [debouncedQuery])

  // ── "내가 참여한" thread IDs 로딩 ──
  useEffect(() => {
    if (statusFilter !== "my" || !user) {
      setMyThreadIds(null)
      return
    }
    let cancelled = false
    setMyThreadIdsLoading(true)
    ;(async () => {
      const [votesRes, commentsRes] = await Promise.all([
        supabase.from("thread_votes").select("thread_id").eq("user_id", user.id),
        supabase.from("comments").select("thread_id").eq("user_id", user.id),
      ])
      if (cancelled) return
      const ids = new Set<string>()
      for (const r of votesRes.data ?? []) ids.add(r.thread_id as string)
      for (const r of commentsRes.data ?? []) ids.add(r.thread_id as string)
      setMyThreadIds(ids)
      setMyThreadIdsLoading(false)
    })()
    return () => { cancelled = true }
  }, [statusFilter, user?.id])

  // ── 서버 검색 결과 투표 상태 로딩 ──
  useEffect(() => {
    if (!user || !serverResults || serverResults.length === 0) return
    let cancelled = false
    const unknownIds = serverResults
      .map((d) => d.id)
      .filter((id) => !(id in userVotesRef.current))
    if (unknownIds.length === 0) return
    ;(async () => {
      const { data } = await supabase
        .from("thread_votes")
        .select("thread_id, vote_type")
        .eq("user_id", user.id)
        .in("thread_id", unknownIds)
      if (cancelled) return
      if (data && data.length > 0) {
        setUserVotes((v) => {
          const n = { ...v }
          for (const row of data) {
            n[row.thread_id as string] = row.vote_type as "pro" | "con"
          }
          userVotesRef.current = n
          return n
        })
      }
    })()
    return () => { cancelled = true }
  }, [user?.id, serverResults])

  // HOT 피드 로드 + 실시간 갱신
  const loadHotDebates = useCallback(async () => {
    const { data, error } = await supabase.rpc("get_hot_scored_debates", { p_limit: 5 })
    if (error) {
      // RPC 없으면 fallback: 투표 많은 순
      if (error.code === "PGRST202") {
        const fallback = [...debatesRef.current]
          .filter((d) => !d.isClosed)
          .sort((a, b) => {
            const scoreA = ((a.proCount + a.conCount) * 2 + (a.commentCount ?? 0) * 5) / Math.pow((Date.now() - new Date(a.createdAt).getTime()) / 3600000 + 2, 1.5)
            const scoreB = ((b.proCount + b.conCount) * 2 + (b.commentCount ?? 0) * 5) / Math.pow((Date.now() - new Date(b.createdAt).getTime()) / 3600000 + 2, 1.5)
            return scoreB - scoreA
          })
          .slice(0, 5)
        setHotDebates(fallback)
      } else {
        console.warn("[loadHotDebates] Unexpected error:", error.code, error.message)
      }
      return
    }
    const items = ((data ?? []) as Record<string, unknown>[]).map((row) => {
      const d = rawToDebate(row)
      d.commentCount = typeof row.comment_count === "number" ? row.comment_count : 0
      d.hot = true
      return d
    })
    setHotDebates(items)
  }, [])

  useEffect(() => {
    if (sortBy !== "hot") {
      if (hotTimerRef.current) clearInterval(hotTimerRef.current)
      return
    }
    setHotLoading(true)
    loadHotDebates().then(() => setHotLoading(false))
    // 30초마다 재계산
    hotTimerRef.current = setInterval(() => {
      loadHotDebates()
    }, 30000)
    return () => {
      if (hotTimerRef.current) clearInterval(hotTimerRef.current)
    }
  }, [sortBy, loadHotDebates])

  // 내 투표 기록 로드
  const debateIdsKey = useMemo(
    () => initialDebates.map((d) => d.id).sort().join(","),
    [initialDebates]
  )

  useEffect(() => {
    if (!user || !debateIdsKey) {
      setUserVotes({})
      userVotesRef.current = {}
      return
    }
    let cancelled = false
    const ids = debateIdsKey.split(",").filter(Boolean)
    ;(async () => {
      const { data } = await supabase
        .from("thread_votes")
        .select("thread_id, vote_type")
        .eq("user_id", user.id)
        .in("thread_id", ids)
      if (cancelled) return
      const map: Record<string, "pro" | "con"> = {}
      for (const row of data ?? []) {
        map[row.thread_id as string] = row.vote_type as "pro" | "con"
      }
      setUserVotes(map)
      userVotesRef.current = map
    })()
    return () => { cancelled = true }
  }, [user?.id, debateIdsKey])

  // 내 북마크 로드
  useEffect(() => {
    if (!user) {
      setBookmarkedIds(new Set())
      return
    }
    let cancelled = false
    ;(async () => {
      const { data, error } = await supabase
        .from("bookmarks")
        .select("thread_id")
        .eq("user_id", user.id)
      if (cancelled) return
      if (error) {
        if (error.code !== "42P01" && error.code !== "PGRST205") {
          console.error("[Bookmarks]", error.code)
        }
        return
      }
      setBookmarkedIds(new Set((data ?? []).map((r) => r.thread_id as string)))
    })()
    return () => { cancelled = true }
  }, [user?.id])

  // 실시간 투표 구독
  useEffect(() => {
    const channel = supabase
      .channel("threads-realtime")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "threads" },
        (payload) => {
          const row = payload.new as Record<string, unknown>
          const rid = String(row.id ?? "")
          if (!rid || pendingVotes.current.has(rid)) return
          const pro = Math.max(0, Number(row.pro_count) || 0)
          const con = Math.max(0, Number(row.con_count) || 0)
          const total = pro + con
          setDebates((prev) =>
            prev.map((d) =>
              d.id !== rid
                ? d
                : {
                    ...d,
                    proCount: pro,
                    conCount: con,
                    yesPct:
                      total > 0
                        ? Math.max(0, Math.min(100, Math.round((pro / total) * 100)))
                        : 50,
                  }
            )
          )
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  // ── 무한 스크롤: loadMore ──
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return
    setLoadingMore(true)
    const { data, error } = await supabase
      .from("threads")
      .select("*, comments(count)")
      .order("created_at", { ascending: false })
      .range(debates.length, debates.length + PAGE_SIZE - 1)

    if (error || !data || data.length === 0) {
      setHasMore(false)
      setLoadingMore(false)
      return
    }

    const newDebates = (data as (Record<string, unknown> & { comments?: { count: number }[] })[]).map((row) => {
      const d = rawToDebate(row)
      const commentAgg = row.comments
      d.commentCount = Array.isArray(commentAgg) && commentAgg.length > 0
        ? commentAgg[0].count
        : 0
      return d
    })
    setDebates((prev) => {
      const existingIds = new Set(prev.map((d) => d.id))
      const unique = newDebates.filter((d) => !existingIds.has(d.id))
      return [...prev, ...unique]
    })
    if (data.length < PAGE_SIZE) setHasMore(false)
    setLoadingMore(false)
  }, [debates.length, loadingMore, hasMore])

  // ── 필터 활성 여부 (무한스크롤 OFF 조건) ──
  const isFilterActive = !!debouncedQuery || statusFilter !== "all" || sortBy === "ending"

  // ── IntersectionObserver ──
  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isFilterActive) {
          loadMore()
        }
      },
      { rootMargin: "300px" }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [loadMore, isFilterActive])

  // ── 필터 / 정렬 로직 ──
  const availableTags = useMemo(() => {
    const set = new Set<string>()
    for (const d of debates) if (d.tag) set.add(d.tag)
    return PRESET_TAGS.filter((t) => set.has(t))
  }, [debates])

  // 기본 데이터: 서버 검색 결과 또는 로컬 debates
  const baseData = serverResults ?? debates

  // 상태 필터
  const statusFiltered = useMemo(() => {
    if (statusFilter === "all") return baseData
    if (statusFilter === "live") return baseData.filter((d) => !d.isClosed && !d.aiVerdict)
    if (statusFilter === "settled") return baseData.filter((d) => !!d.aiVerdict || d.isClosed)
    if (statusFilter === "my") {
      if (!myThreadIds) return []
      return baseData.filter((d) => myThreadIds.has(d.id))
    }
    return baseData
  }, [baseData, statusFilter, myThreadIds])

  // 태그 필터
  const tagFiltered = useMemo(() => {
    return filterTag ? statusFiltered.filter((d) => d.tag === filterTag) : statusFiltered
  }, [statusFiltered, filterTag])

  // 정렬
  const sorted = useMemo(() => {
    if (sortBy === "hot") return hotDebates
    if (sortBy === "popular") {
      return [...tagFiltered].sort(
        (a, b) => b.proCount + b.conCount - (a.proCount + a.conCount)
      )
    }
    if (sortBy === "ending") {
      return [...tagFiltered]
        .filter((d) => !d.isClosed && d.expiresAt)
        .sort((a, b) => {
          const aTime = new Date(a.expiresAt!).getTime()
          const bTime = new Date(b.expiresAt!).getTime()
          return aTime - bTime
        })
    }
    // latest
    return [...tagFiltered].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
  }, [sortBy, tagFiltered, hotDebates])

  // ── 핸들러 ──
  const handleVote = useCallback(
    async (id: string, type: "pro" | "con") => {
      if (!user) {
        showToast("로그인이 필요한 기능입니다.", "info")
        return
      }

      if (isBanned) {
        const until = profile?.bannedUntil ? new Date(profile.bannedUntil).toLocaleDateString("ko-KR") : ""
        showToast(`계정이 정지되었습니다. 해제: ${until}`, "error")
        return
      }

      if (votingSet.current.has(id)) return
      votingSet.current.add(id)
      setVotingId(id)
      pendingVotes.current.add(id)

      const prev = userVotesRef.current[id] ?? null

      const proDelta =
        prev === type         ? (type === "pro" ? -1 : 0)
        : prev !== null       ? (type === "pro" ? 1 : -1)
                              : (type === "pro" ? 1 : 0)
      const conDelta =
        prev === type         ? (type === "con" ? -1 : 0)
        : prev !== null       ? (type === "con" ? 1 : -1)
                              : (type === "con" ? 1 : 0)
      const newVote: "pro" | "con" | null = prev === type ? null : type

      setDebates((cur) =>
        cur.map((d) => {
          if (d.id !== id) return d
          const np = Math.max(0, d.proCount + proDelta)
          const nc = Math.max(0, d.conCount + conDelta)
          const t = np + nc
          return {
            ...d,
            proCount: np,
            conCount: nc,
            yesPct: t > 0 ? Math.round((np / t) * 100) : 50,
          }
        })
      )
      setUserVotes((v) => {
        const n = { ...v }
        if (newVote !== null) n[id] = newVote
        else delete n[id]
        userVotesRef.current = n
        return n
      })

      const { data, error } = await supabase.rpc("cast_vote", {
        p_thread_id: id,
        p_user_id: user.id,
        p_vote_type: type,
      })

      if (error?.code === "PGRST202") {
        const fallbackResult = await castVoteFallback({
          supabase, id, userId: user.id, type, prev,
        })
        setTimeout(() => pendingVotes.current.delete(id), 500)
        votingSet.current.delete(id)
        setVotingId(null)

        if (!fallbackResult.ok) {
          setDebates((cur) =>
            cur.map((d) => {
              if (d.id !== id) return d
              const np = Math.max(0, d.proCount - proDelta)
              const nc = Math.max(0, d.conCount - conDelta)
              const t = np + nc
              return { ...d, proCount: np, conCount: nc, yesPct: t > 0 ? Math.round((np / t) * 100) : 50 }
            })
          )
          setUserVotes((v) => {
            const n = { ...v }
            if (prev !== null) n[id] = prev; else delete n[id]
            userVotesRef.current = n
            return n
          })
        }
        return
      }

      setTimeout(() => pendingVotes.current.delete(id), 500)
      votingSet.current.delete(id)
      setVotingId(null)

      if (error) {
        console.error("[Vote RPC]", error.code, error.message)
        setDebates((cur) =>
          cur.map((d) => {
            if (d.id !== id) return d
            const np = Math.max(0, d.proCount - proDelta)
            const nc = Math.max(0, d.conCount - conDelta)
            const t = np + nc
            return { ...d, proCount: np, conCount: nc, yesPct: t > 0 ? Math.round((np / t) * 100) : 50 }
          })
        )
        setUserVotes((v) => {
          const n = { ...v }
          if (prev !== null) n[id] = prev; else delete n[id]
          userVotesRef.current = n
          return n
        })
        return
      }

      const result = data as {
        pro_count: number
        con_count: number
        new_vote: string | null
      }
      setDebates((cur) =>
        cur.map((d) => {
          if (d.id !== id) return d
          const t = result.pro_count + result.con_count
          return {
            ...d,
            proCount: result.pro_count,
            conCount: result.con_count,
            yesPct: t > 0 ? Math.round((result.pro_count / t) * 100) : 50,
          }
        })
      )
      setUserVotes((v) => {
        const n = { ...v }
        if (result.new_vote !== null) n[id] = result.new_vote as "pro" | "con"
        else delete n[id]
        userVotesRef.current = n
        return n
      })

      // 첫 투표일 때만 XP 지급 (전환/취소 제외)
      if (prev === null && result.new_vote !== null) {
        awardXp("vote")
      }
    },
    [user, showToast, isBanned, profile, awardXp]
  )

  const handleBookmark = useCallback(
    async (threadId: string) => {
      if (!user) {
        showToast("로그인이 필요한 기능입니다.", "info")
        return
      }
      const wasBookmarked = bookmarkedIds.has(threadId)

      setBookmarkedIds((prev) => {
        const next = new Set(prev)
        if (wasBookmarked) next.delete(threadId)
        else next.add(threadId)
        return next
      })

      if (wasBookmarked) {
        const { error } = await supabase
          .from("bookmarks")
          .delete()
          .eq("user_id", user.id)
          .eq("thread_id", threadId)
        if (error && error.code !== "42P01" && error.code !== "PGRST205") {
          setBookmarkedIds((prev) => new Set([...prev, threadId]))
          showToast("북마크 해제에 실패했습니다.", "error")
        } else {
          showToast("북마크가 해제되었습니다.", "info")
        }
      } else {
        const { error } = await supabase
          .from("bookmarks")
          .insert({ user_id: user.id, thread_id: threadId })
        if (error && error.code !== "42P01" && error.code !== "PGRST205") {
          setBookmarkedIds((prev) => {
            const next = new Set(prev)
            next.delete(threadId)
            return next
          })
          showToast("북마크에 실패했습니다.", "error")
        } else {
          showToast("북마크에 추가되었습니다!", "success")
        }
      }
    },
    [user, bookmarkedIds, showToast]
  )

  const handleShare = useCallback(
    async (debate: Debate) => {
      const url = `${window.location.origin}/thread/${debate.id}`
      try {
        if (navigator.share) {
          await navigator.share({ title: debate.title, url })
        } else {
          await navigator.clipboard.writeText(url)
          showToast("링크가 복사되었습니다!", "success")
        }
      } catch {
        // 사용자가 공유 취소한 경우 무시
      }
    },
    [showToast]
  )

  function handleOpenThread(id: string) {
    router.push(`/thread/${id}`)
  }

  return (
    <section className="space-y-4">
      {/* 헤더: 검색 + 정렬 */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <h2 className="text-sm font-semibold tracking-wide text-zinc-200">
              라이브 토론
            </h2>
            <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-zinc-500">
              {debates.length}개
            </span>
          </div>

          <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-black/40 p-1 backdrop-blur">
            <button
              onClick={() => setSortBy("hot")}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-200 ${
                sortBy === "hot"
                  ? "bg-orange-500/20 text-orange-200 shadow-[0_0_14px_rgba(249,115,22,0.25)] ring-1 ring-orange-400/40"
                  : "text-zinc-500 hover:bg-white/5 hover:text-zinc-300"
              }`}
            >
              <Flame className="size-3.5" />
              HOT
            </button>
            <button
              onClick={() => setSortBy("latest")}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-200 ${
                sortBy === "latest"
                  ? "bg-cyan-500/20 text-cyan-200 shadow-[0_0_14px_rgba(34,211,238,0.20)] ring-1 ring-cyan-400/40"
                  : "text-zinc-500 hover:bg-white/5 hover:text-zinc-300"
              }`}
            >
              <Clock className="size-3.5" />
              최신순
            </button>
            <button
              onClick={() => setSortBy("popular")}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-200 ${
                sortBy === "popular"
                  ? "bg-fuchsia-500/20 text-fuchsia-200 shadow-[0_0_14px_rgba(236,72,153,0.20)] ring-1 ring-fuchsia-400/40"
                  : "text-zinc-500 hover:bg-white/5 hover:text-zinc-300"
              }`}
            >
              <TrendingUp className="size-3.5" />
              인기순
            </button>
            <button
              onClick={() => setSortBy("ending")}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-200 ${
                sortBy === "ending"
                  ? "bg-amber-500/20 text-amber-200 shadow-[0_0_14px_rgba(245,158,11,0.20)] ring-1 ring-amber-400/40"
                  : "text-zinc-500 hover:bg-white/5 hover:text-zinc-300"
              }`}
            >
              <Hourglass className="size-3.5" />
              종료 임박
            </button>
          </div>
        </div>

        {/* 검색 입력 */}
        <div className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 backdrop-blur transition-all ${
          searchQuery
            ? "border-cyan-400/50 bg-white/[0.06] shadow-[0_0_20px_rgba(34,211,238,0.1)] search-glow-active"
            : "border-white/[0.08] bg-white/[0.04] focus-within:border-cyan-400/40 focus-within:bg-white/[0.06] focus-within:shadow-[0_0_20px_rgba(34,211,238,0.1)]"
        }`}>
          {searchLoading ? (
            <Loader2 className="size-4 shrink-0 animate-spin text-cyan-400" />
          ) : (
            <ScanSearch className="size-4 shrink-0 text-zinc-400" />
          )}
          <input
            className="w-full bg-transparent text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none"
            placeholder={searchLoading ? "서버에서 검색 중…" : "토론 검색: 제목, 내용, 태그…"}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="토론 검색"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="shrink-0 text-zinc-500 transition-colors hover:text-zinc-300"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        {/* 검색 결과 카운트 */}
        {debouncedQuery && (
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <ScanSearch className="size-3.5 text-cyan-400/60" />
            <span>
              &ldquo;<span className="text-cyan-200">{debouncedQuery}</span>
              &rdquo; 검색 결과{" "}
              <span className="font-semibold text-zinc-200">
                {sorted.length}
              </span>
              건
              {statusFilter !== "all" && (
                <span className="ml-1 text-zinc-500">
                  ({statusFilter === "live" ? "진행 중" : statusFilter === "settled" ? "판결 완료" : "내가 참여한"})
                </span>
              )}
              {filterTag && (
                <span className="ml-1 text-zinc-500">
                  · {filterTag}
                </span>
              )}
            </span>
          </div>
        )}
      </div>

      {/* 상태 필터 칩 */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-semibold tracking-widest text-zinc-600">STATUS</span>
        {([
          { key: "all" as StatusFilter, label: "전체", color: "cyan" },
          { key: "live" as StatusFilter, label: "진행 중", color: "green" },
          { key: "settled" as StatusFilter, label: "판결 완료", color: "violet" },
          { key: "my" as StatusFilter, label: "내가 참여한", color: "amber" },
        ] as const).map(({ key, label, color }) => {
          const active = statusFilter === key
          const colorMap: Record<string, { active: string; inactive: string }> = {
            cyan:   { active: "border-cyan-400/50 bg-cyan-400/15 text-cyan-100 shadow-[0_0_10px_rgba(34,211,238,0.2)]",   inactive: "border-white/10 bg-white/5 text-zinc-400 hover:border-white/20 hover:text-zinc-200" },
            green:  { active: "border-green-400/50 bg-green-400/15 text-green-100 shadow-[0_0_10px_rgba(74,222,128,0.2)]", inactive: "border-white/10 bg-white/5 text-zinc-400 hover:border-white/20 hover:text-zinc-200" },
            violet: { active: "border-violet-400/50 bg-violet-400/15 text-violet-100 shadow-[0_0_10px_rgba(139,92,246,0.2)]", inactive: "border-white/10 bg-white/5 text-zinc-400 hover:border-white/20 hover:text-zinc-200" },
            amber:  { active: "border-amber-400/50 bg-amber-400/15 text-amber-100 shadow-[0_0_10px_rgba(245,158,11,0.2)]", inactive: "border-white/10 bg-white/5 text-zinc-400 hover:border-white/20 hover:text-zinc-200" },
          }
          return (
            <button
              key={key}
              type="button"
              onClick={() => {
                if (key === "my" && !user) {
                  showToast("로그인이 필요한 기능입니다.", "info")
                  return
                }
                setStatusFilter(key)
              }}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                active ? colorMap[color].active : colorMap[color].inactive
              }`}
            >
              {label}
              {key === "my" && myThreadIdsLoading && (
                <Loader2 className="ml-1 inline size-3 animate-spin" />
              )}
            </button>
          )
        })}
      </div>

      {/* 카테고리 필터 — 수평 탭 */}
      {availableTags.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setFilterTag(null)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
              filterTag === null
                ? "border-cyan-400/50 bg-cyan-400/15 text-cyan-100 shadow-[0_0_10px_rgba(34,211,238,0.2)]"
                : "border-white/10 bg-white/5 text-zinc-400 hover:border-white/20 hover:text-zinc-200"
            }`}
          >
            전체
          </button>
          {availableTags.map((t) => {
            const isSub = subscribedTags.has(t)
            return (
              <div key={t} className="flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => setFilterTag((cur) => (cur === t ? null : t))}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                    filterTag === t
                      ? "border-fuchsia-400/50 bg-fuchsia-400/15 text-fuchsia-100 shadow-[0_0_10px_rgba(236,72,153,0.2)]"
                      : "border-white/10 bg-white/5 text-zinc-400 hover:border-white/20 hover:text-zinc-200"
                  }`}
                >
                  {t}
                </button>
                {user && (
                  <button
                    type="button"
                    onClick={() => toggleSubscription(t)}
                    className={`relative grid size-6 place-items-center rounded-full border transition ${
                      isSub
                        ? "border-violet-400/50 bg-violet-400/15 text-violet-300"
                        : "border-white/10 bg-white/5 text-zinc-500 hover:border-white/20 hover:text-zinc-300"
                    }`}
                    aria-label={isSub ? `${t} 구독 해제` : `${t} 구독`}
                    title={isSub ? `${t} 알림 구독 중` : `${t} 새 토론 알림 받기`}
                  >
                    {isSub ? (
                      <BellRing className="size-3" />
                    ) : (
                      <Bell className="size-3" />
                    )}
                    {isSub && (
                      <span className="absolute -right-0.5 -top-0.5 size-1.5 rounded-full bg-violet-400 shadow-[0_0_4px_rgba(139,92,246,0.8)]" />
                    )}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* HOT 헤더 */}
      {sortBy === "hot" && (
        <div className="flex items-center gap-2 rounded-xl border border-orange-500/20 bg-orange-500/5 px-4 py-2.5">
          <Zap className="size-4 text-orange-400" />
          <span className="text-sm font-semibold text-orange-200">HOT 현장</span>
          <span className="text-[11px] text-orange-400/60">— 알고리즘 기반 실시간 순위 (30초 갱신)</span>
        </div>
      )}

      {/* HOT 로딩 */}
      {sortBy === "hot" && hotLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="flex items-center gap-2 text-sm text-orange-300">
            <div className="size-4 animate-spin rounded-full border-2 border-orange-400/30 border-t-orange-400" />
            HOT 토론 계산 중…
          </div>
        </div>
      )}

      {/* 토론 목록 — 멀티 컬럼 그리드 */}
      <div
        key={glitchKey}
        className={`grid gap-3 sm:grid-cols-2 2xl:grid-cols-3 ${debouncedQuery ? "search-results-glitch" : ""}`}
      >
        {sorted.length === 0 && !(sortBy === "hot" && hotLoading) ? (
          <Card className="col-span-full border-white/10 bg-black/30 backdrop-blur">
            <CardContent className="px-6 py-10">
              <div className="mx-auto max-w-md text-center">
                <div className="mx-auto grid size-12 place-items-center rounded-2xl border border-white/10 bg-white/5 text-cyan-200">
                  {debouncedQuery ? (
                    <ScanSearch className="size-5" />
                  ) : (
                    <Sparkles className="size-5" />
                  )}
                </div>
                <div className="mt-4 font-mono text-lg font-semibold text-zinc-100">
                  {debouncedQuery
                    ? "해당 주파수의 토론을 찾을 수 없습니다"
                    : statusFilter === "my"
                      ? "아직 참여한 토론이 없습니다"
                      : statusFilter === "settled"
                        ? "판결 완료된 토론이 없습니다"
                        : statusFilter === "live"
                          ? "진행 중인 토론이 없습니다"
                          : sortBy === "ending"
                            ? "종료 임박 토론이 없습니다"
                            : "새로운 토론을 기다리고 있습니다"}
                </div>
                <div className="mt-2 text-sm text-zinc-400">
                  {debouncedQuery
                    ? "다른 키워드로 검색하거나, 아래 추천 태그를 살펴보세요."
                    : statusFilter === "my"
                      ? "토론에 투표하거나 댓글을 남기면 여기에 표시됩니다."
                      : "첫 번째 토론을 열어 네온 아고라의 신호를 켜주세요."}
                </div>
                {/* 추천 태그 (검색 빈 상태) */}
                {debouncedQuery && (
                  <div className="mt-4 flex flex-wrap justify-center gap-2">
                    {["AI", "정치", "경제", "사회", "기술"].map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => {
                          setSearchQuery("")
                          setFilterTag(tag)
                        }}
                        className="rounded-full border border-cyan-400/20 bg-cyan-400/5 px-3 py-1 text-xs text-cyan-300 transition hover:bg-cyan-400/15"
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                )}
                {!debouncedQuery && statusFilter === "all" && sortBy !== "ending" && (
                  <div className="mt-5">
                    <NewThreadModal />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ) : (
          sorted.map((debate) => (
            <DebateCard
              key={debate.id}
              debate={debate}
              onVote={handleVote}
              onOpen={handleOpenThread}
              isVoting={votingId === debate.id}
              myVote={userVotes[debate.id] ?? null}
              searchQuery={searchQuery}
              isBookmarked={bookmarkedIds.has(debate.id)}
              onBookmark={handleBookmark}
              onShare={handleShare}
            />
          ))
        )}
      </div>

      {/* 무한 스크롤 감지 영역 */}
      {!isFilterActive && hasMore && (
        <div ref={sentinelRef} className="flex justify-center py-6">
          {loadingMore ? (
            <div className="flex items-center gap-2 text-sm text-zinc-500">
              <div className="size-4 animate-spin rounded-full border-2 border-zinc-600 border-t-cyan-400" />
              토론 불러오는 중...
            </div>
          ) : (
            <div className="text-xs text-zinc-600">↓ 스크롤하면 더 불러와요</div>
          )}
        </div>
      )}

      {/* 더 이상 없음 */}
      {!isFilterActive && !hasMore && debates.length > 0 && (
        <div className="py-4 text-center text-xs text-zinc-600">
          모든 토론을 불러왔습니다
        </div>
      )}
    </section>
  )
}
