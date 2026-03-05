"use client"

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import Link from "next/link"
import {
  ArrowLeft,
  Bookmark,
  ChevronDown,
  ChevronUp,
  Flame,
  Lock,
  MessageSquareText,
  Pencil,
  Scale,
  Shield,
  Swords,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  X,
  Zap,
} from "lucide-react"

import { supabase } from "@/lib/supabase"
import { useAuth } from "@/components/auth-provider"
import { useProfile } from "@/components/profile-provider"
import { useConfirm } from "@/components/confirm-dialog"
import { getTier, TIERS, xpProgress } from "@/lib/xp"
import { getLevel } from "@/lib/gamification"
import { FEATURED_BADGES } from "@/lib/gamification"
import { ACHIEVEMENTS } from "@/lib/achievements"
import { Button } from "@/components/ui/button"
import { getDisplayName } from "@/lib/utils"
import { UserTitleBadge } from "@/components/user-title-badge"
import { TitleSelectorModal } from "@/components/title-selector-modal"

/* ─── 타입 ──────────────────────────────────────────── */

type ThreadItem = {
  id: string
  title: string
  content: string
  tag: string
  created_at: string | null
  pro_count: number
  con_count: number
  template: string
  is_closed: boolean
}

type CommentHistoryItem = {
  id: string
  thread_id: string
  threadTitle: string
  content: string
  side: "pro" | "con" | null
  created_at: string | null
  reactions: { like: number; dislike: number; fire: number }
}

type VoteHistoryItem = {
  thread_id: string
  threadTitle: string
  vote_type: "pro" | "con"
}

type BookmarkItem = {
  thread_id: string
  title: string
  pro_count: number
  con_count: number
}

type ActivityData = {
  threads: ThreadItem[]
  commentCount: number
  totalLikes: number
  totalFires: number
  proVoteCount: number
  conVoteCount: number
  verdictCount: number
  commentHistory: CommentHistoryItem[]
  voteHistory: VoteHistoryItem[]
  bookmarks: BookmarkItem[]
}

/* ─── 날짜 포맷 (hydration 안전) ────────────────────── */

function formatDate(iso: string | null): string {
  if (!iso) return ""
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`
}

/* ─── 스켈레톤 ─────────────────────────────────────── */

function Bone({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-white/[0.07] ${className ?? ""}`}
    />
  )
}

function ProfileSkeleton() {
  return (
    <div className="flex flex-1 flex-col gap-4">
      {/* 컴팩트 헤더 */}
      <div className="rounded-2xl bg-gradient-to-r from-cyan-500/20 via-fuchsia-500/10 to-emerald-400/10 p-px">
        <div className="flex items-center gap-4 rounded-2xl bg-black/50 px-5 py-4 backdrop-blur">
          <Bone className="size-12 shrink-0 rounded-xl" />
          <div className="flex-1 space-y-2">
            <Bone className="h-4 w-40" />
            <Bone className="h-2 w-full max-w-xs" />
          </div>
          <Bone className="h-7 w-16 rounded-lg" />
          <Bone className="h-7 w-16 rounded-lg" />
        </div>
      </div>

      {/* 2-col 그리드 */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          <Bone className="h-3 w-24" />
          <div className="grid grid-cols-4 gap-2">
            {Array.from({ length: 7 }).map((_, i) => (
              <Bone key={i} className="h-16 rounded-xl" />
            ))}
          </div>
        </div>
        <div className="space-y-3">
          <Bone className="h-16 rounded-xl" />
          <div className="flex gap-2">
            {[0, 1, 2, 3].map((i) => (
              <Bone key={i} className="h-20 flex-1 rounded-xl" />
            ))}
          </div>
        </div>
      </div>

      {/* 업적 가로 스크롤 */}
      <div className="flex gap-2 overflow-hidden">
        {Array.from({ length: 8 }).map((_, i) => (
          <Bone key={i} className="h-16 w-20 shrink-0 rounded-xl" />
        ))}
      </div>

      {/* 3-col 하단 */}
      <div className="grid flex-1 gap-4 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="space-y-2">
            <Bone className="h-3 w-24" />
            {[0, 1, 2].map((j) => (
              <Bone key={j} className="h-12 rounded-xl" />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

/* ─── 배지 컬렉션 섹션 (컴팩트 가로 1줄) ────────────── */

function BadgeCollectionSection({ xp }: { xp: number }) {
  const currentTier = getTier(xp)
  const currentTierIdx = TIERS.findIndex(
    (t) => t.badgeName === currentTier.badgeName
  )

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs font-semibold text-zinc-100">
        <Shield className="size-3.5 text-fuchsia-300" />
        배지 컬렉션
      </div>

      <div className="flex gap-2">
        {TIERS.map((tier, idx) => {
          const unlocked = idx <= currentTierIdx
          const isCurrent = idx === currentTierIdx

          return (
            <div
              key={tier.badgeName}
              className={`relative flex-1 rounded-xl border p-2.5 text-center transition-all ${
                unlocked
                  ? `border-white/15 bg-gradient-to-b ${tier.cardGradient}`
                  : "border-white/[0.06] bg-white/[0.02]"
              } ${isCurrent ? "ring-1 ring-white/20" : ""}`}
              style={
                unlocked
                  ? {
                      boxShadow: `0 0 12px ${tier.glowShadow.split(",")[0]?.split("rgba")[1] ? `rgba${tier.glowShadow.split("rgba")[1]?.split(")")[0]})` : "transparent"}`,
                    }
                  : undefined
              }
            >
              {!unlocked && (
                <div className="absolute inset-0 z-10 grid place-items-center rounded-xl bg-black/60 backdrop-blur-[2px]">
                  <Lock className="size-3.5 text-zinc-600" />
                </div>
              )}

              <div
                className={`mx-auto grid size-8 place-items-center rounded-lg text-sm font-bold ${
                  unlocked
                    ? `bg-gradient-to-br ${tier.avatarGradient} text-black`
                    : "bg-zinc-800 text-zinc-600"
                }`}
              >
                {idx === 0
                  ? "🌱"
                  : idx === 1
                    ? "⚔️"
                    : idx === 2
                      ? "💎"
                      : "👑"}
              </div>

              <div
                className={`mt-1 text-[10px] font-semibold ${
                  unlocked ? tier.textClass : "text-zinc-600"
                }`}
              >
                {tier.badgeName}
              </div>

              {isCurrent && (
                <div className="mt-0.5 text-[8px] font-bold tracking-widest text-emerald-400">
                  CURRENT
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* 다음 배지까지 진행바 */}
      {currentTierIdx < TIERS.length - 1 && (
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
          <div className="flex items-center justify-between text-[10px] text-zinc-500">
            <span>
              다음:{" "}
              <span className={TIERS[currentTierIdx + 1].textClass}>
                {TIERS[currentTierIdx + 1].badgeName}
              </span>
            </span>
            <span>
              {xp} / {TIERS[currentTierIdx + 1].minXp} XP
            </span>
          </div>
          <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className={`h-full rounded-full bg-gradient-to-r ${TIERS[currentTierIdx + 1].avatarGradient} transition-all duration-700`}
              style={{
                width: `${Math.min(
                  100,
                  ((xp - TIERS[currentTierIdx].minXp) /
                    (TIERS[currentTierIdx + 1].minXp -
                      TIERS[currentTierIdx].minXp)) *
                    100
                )}%`,
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}

/* ─── 특별 뱃지 섹션 ─────────────── */

function FeaturedBadgeSection() {
  const { achievements } = useProfile()

  const earned = FEATURED_BADGES.filter((b) => achievements.includes(b.key))
  if (earned.length === 0 && !FEATURED_BADGES.some(() => true)) return null

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs font-semibold text-zinc-100">
        <Shield className="size-3.5 text-cyan-300" />
        특별 뱃지
      </div>
      <div className="flex gap-3">
        {FEATURED_BADGES.map((fb) => {
          const unlocked = achievements.includes(fb.key)
          return (
            <div
              key={fb.key}
              className={`flex items-center gap-2 rounded-xl border px-4 py-3 transition-all ${
                unlocked
                  ? `${fb.borderClass} ${fb.bgClass} featured-badge-glow`
                  : "border-white/[0.06] bg-white/[0.02] opacity-40"
              }`}
              style={unlocked ? { boxShadow: `0 0 20px ${fb.neonColor}` } : undefined}
            >
              <span className="text-xl">{fb.icon}</span>
              <div>
                <div className={`text-xs font-bold ${unlocked ? fb.textClass : "text-zinc-500"}`}>
                  {fb.name}
                </div>
                <div className="text-[10px] text-zinc-500">
                  {fb.key === "logic_king" ? "AI 코칭 90점+ 3회" : "좋아요 50개+"}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ─── 업적 그리드 섹션 (가로 스크롤 1줄) ─────────────── */

const ACHIEVEMENT_ICONS: Record<string, string> = {
  ThumbsUp: "👍",
  MessageSquare: "💬",
  Sparkles: "✨",
  Crown: "👑",
  Zap: "⚡",
  Star: "⭐",
  Flame: "🔥",
  Trophy: "🏆",
}

function AchievementGrid() {
  const { achievements } = useProfile()

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs font-semibold text-zinc-100">
        <Shield className="size-3.5 text-amber-300" />
        업적
        <span className="rounded-full border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] text-zinc-400">
          {achievements.length} / {ACHIEVEMENTS.length}
        </span>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {ACHIEVEMENTS.map((ach) => {
          const unlocked = achievements.includes(ach.key)
          return (
            <div
              key={ach.key}
              className={[
                "relative w-[5.5rem] shrink-0 rounded-xl border p-2.5 text-center transition-all",
                unlocked
                  ? "border-white/15 bg-white/[0.04]"
                  : "border-white/[0.06] bg-white/[0.02] opacity-40",
                unlocked ? "achievement-unlock badge-slot-active" : "",
              ].join(" ")}
              style={
                unlocked
                  ? { boxShadow: `0 0 12px ${ach.glowColor}` }
                  : undefined
              }
            >
              <div className="mx-auto text-lg">
                {ACHIEVEMENT_ICONS[ach.icon] ?? "🏅"}
              </div>
              <div
                className={`mt-1 text-[9px] font-semibold leading-tight ${
                  unlocked ? ach.color : "text-zinc-600"
                }`}
              >
                {ach.name}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ─── 댓글 히스토리 섹션 (컴팩트) ────────────────────── */

function CommentHistorySection({
  comments,
  total,
}: {
  comments: CommentHistoryItem[]
  total: number
}) {
  const [showAll, setShowAll] = useState(false)
  const visible = showAll ? comments : comments.slice(0, 3)

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs font-semibold text-zinc-100">
        <MessageSquareText className="size-3.5 text-emerald-300" />
        내가 쓴 댓글
        <span className="rounded-full border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] text-zinc-400">
          {total}개
        </span>
      </div>

      {comments.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-center">
          <div className="text-xs text-zinc-400">아직 작성한 댓글이 없어요.</div>
        </div>
      ) : (
        <>
          {visible.map((c) => (
            <Link
              key={c.id}
              href={`/thread/${c.thread_id}`}
              className="group block rounded-lg border-l-2 border-[#39FF14]/20 bg-white/[0.02] py-2 pl-3 pr-2.5 transition-all hover:border-[#39FF14]/40 hover:bg-white/[0.04]"
            >
              <div className="truncate text-[10px] text-zinc-600 group-hover:text-zinc-400">
                {c.threadTitle}
              </div>
              <div className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-zinc-200">
                &ldquo;{c.content}&rdquo;
              </div>
              <div className="mt-1.5 flex items-center gap-2 text-[10px] text-zinc-500">
                <span
                  className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-medium ${
                    c.side === "pro"
                      ? "bg-[#00FFD1]/10 text-[#00FFD1]/70"
                      : c.side === "con"
                        ? "bg-[#FF00FF]/10 text-[#FF00FF]/70"
                        : "bg-white/5 text-zinc-500"
                  }`}
                >
                  {c.side === "pro"
                    ? "찬성"
                    : c.side === "con"
                      ? "반대"
                      : "자유"}
                </span>
                {c.reactions.like > 0 && (
                  <span className="inline-flex items-center gap-0.5">
                    <ThumbsUp className="size-2.5 text-emerald-400/50" />
                    {c.reactions.like}
                  </span>
                )}
                {c.reactions.fire > 0 && (
                  <span className="inline-flex items-center gap-0.5">
                    <Flame className="size-2.5 text-orange-400/50" />
                    {c.reactions.fire}
                  </span>
                )}
              </div>
            </Link>
          ))}

          {comments.length > 3 && (
            <button
              onClick={() => setShowAll((p) => !p)}
              className="flex w-full items-center justify-center gap-1 rounded-lg bg-white/[0.03] py-1.5 text-[10px] text-zinc-500 transition-colors hover:bg-white/[0.06] hover:text-zinc-300"
            >
              {showAll ? (
                <>
                  접기 <ChevronUp className="size-3" />
                </>
              ) : (
                <>
                  전체 {comments.length}개 보기{" "}
                  <ChevronDown className="size-3" />
                </>
              )}
            </button>
          )}
        </>
      )}
    </div>
  )
}

/* ─── 투표 기록 섹션 (컴팩트) ────────────────────────── */

function VoteHistorySection({ votes }: { votes: VoteHistoryItem[] }) {
  const [showAll, setShowAll] = useState(false)
  const visible = showAll ? votes : votes.slice(0, 3)

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs font-semibold text-zinc-100">
        <Scale className="size-3.5 text-amber-300" />
        투표 기록
        <span className="rounded-full border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] text-zinc-400">
          {votes.length}건
        </span>
      </div>

      {votes.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-center">
          <div className="text-xs text-zinc-400">아직 투표 기록이 없어요.</div>
        </div>
      ) : (
        <>
          {visible.map((v, i) => (
            <Link
              key={`${v.thread_id}-${i}`}
              href={`/thread/${v.thread_id}`}
              className="group flex items-center gap-2 rounded-lg bg-white/[0.02] px-3 py-2 transition-all hover:bg-white/[0.05]"
            >
              <span
                className={`inline-flex shrink-0 items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[9px] font-bold ${
                  v.vote_type === "pro"
                    ? "border-[#00FFD1]/25 bg-[#00FFD1]/10 text-[#00FFD1]"
                    : "border-[#FF00FF]/25 bg-[#FF00FF]/10 text-[#FF00FF]"
                }`}
              >
                {v.vote_type === "pro" ? (
                  <>
                    <ThumbsUp className="size-2" /> 찬성
                  </>
                ) : (
                  <>
                    <ThumbsDown className="size-2" /> 반대
                  </>
                )}
              </span>
              <span className="min-w-0 flex-1 truncate text-xs text-zinc-300 group-hover:text-zinc-100">
                {v.threadTitle}
              </span>
            </Link>
          ))}

          {votes.length > 3 && (
            <button
              onClick={() => setShowAll((p) => !p)}
              className="flex w-full items-center justify-center gap-1 rounded-lg bg-white/[0.03] py-1.5 text-[10px] text-zinc-500 transition-colors hover:bg-white/[0.06] hover:text-zinc-300"
            >
              {showAll ? (
                <>
                  접기 <ChevronUp className="size-3" />
                </>
              ) : (
                <>
                  전체 {votes.length}건 보기{" "}
                  <ChevronDown className="size-3" />
                </>
              )}
            </button>
          )}
        </>
      )}
    </div>
  )
}

/* ─── 북마크 섹션 (컴팩트) ────────────────────────────── */

function BookmarkSection({ bookmarks }: { bookmarks: BookmarkItem[] }) {
  const [showAll, setShowAll] = useState(false)
  const visible = showAll ? bookmarks : bookmarks.slice(0, 3)

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs font-semibold text-zinc-100">
        <Bookmark className="size-3.5 text-amber-300" />
        내 북마크
        <span className="rounded-full border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] text-zinc-400">
          {bookmarks.length}개
        </span>
      </div>

      {bookmarks.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-center">
          <div className="text-xs text-zinc-400">북마크한 토론이 없어요.</div>
        </div>
      ) : (
        <>
          {visible.map((b) => {
            const total = b.pro_count + b.con_count
            const proPct = total > 0 ? Math.round((b.pro_count / total) * 100) : 50

            return (
              <Link
                key={b.thread_id}
                href={`/thread/${b.thread_id}`}
                className="group block rounded-lg bg-white/[0.02] px-3 py-2 transition-all hover:bg-white/[0.05]"
              >
                <div className="flex items-center gap-2">
                  <Bookmark className="size-3 shrink-0 fill-amber-400 text-amber-400" />
                  <span className="min-w-0 flex-1 truncate text-xs font-medium text-zinc-100 group-hover:text-amber-100">
                    {b.title}
                  </span>
                </div>
                {total > 0 && (
                  <div className="mt-1.5 ml-5 flex h-1 overflow-hidden rounded-full bg-white/[0.06]">
                    <div
                      className="rounded-l-full bg-cyan-400/60"
                      style={{ width: `${proPct}%` }}
                    />
                    <div
                      className="rounded-r-full bg-fuchsia-400/60"
                      style={{ width: `${100 - proPct}%` }}
                    />
                  </div>
                )}
              </Link>
            )
          })}

          {bookmarks.length > 3 && (
            <button
              onClick={() => setShowAll((p) => !p)}
              className="flex w-full items-center justify-center gap-1 rounded-lg bg-white/[0.03] py-1.5 text-[10px] text-zinc-500 transition-colors hover:bg-white/[0.06] hover:text-zinc-300"
            >
              {showAll ? (
                <>
                  접기 <ChevronUp className="size-3" />
                </>
              ) : (
                <>
                  전체 {bookmarks.length}개 보기{" "}
                  <ChevronDown className="size-3" />
                </>
              )}
            </button>
          )}
        </>
      )}
    </div>
  )
}

/* ─── 찬반 성향 게이지 ─────────────────────────────── */

function getStanceTitle(proPct: number): { emoji: string; label: string } {
  if (proPct >= 80) return { emoji: "🔥", label: "불도저 같은 확신러" }
  if (proPct <= 20) return { emoji: "🔥", label: "불도저 같은 확신러" }
  if (proPct >= 40 && proPct <= 60) return { emoji: "⚖️", label: "냉철한 균형의 수호자" }
  return { emoji: "⚔️", label: "날카로운 논리 사냥꾼" }
}

function TendencyGauge({
  proCount,
  conCount,
}: {
  proCount: number
  conCount: number
}) {
  const total = proCount + conCount
  if (total === 0) return null

  const proPct = Math.round((proCount / total) * 100)
  const conPct = 100 - proPct
  const title = getStanceTitle(proPct)

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
      <div className="mb-1.5 text-[10px] tracking-widest text-zinc-600">
        STANCE TENDENCY
      </div>
      {/* 동적 칭호 */}
      <div className="mb-2 text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.06] bg-gradient-to-r from-[#00FFD1]/[0.06] via-transparent to-[#FF00FF]/[0.06] px-3 py-1 text-[11px] font-medium text-zinc-300">
          <span>{title.emoji}</span>
          <span className="bg-gradient-to-r from-[#00FFD1]/80 via-zinc-300 to-[#FF00FF]/80 bg-clip-text text-transparent">
            {title.label}
          </span>
        </span>
      </div>
      <div className="flex items-center justify-between text-[11px]">
        <span className="inline-flex items-center gap-1 text-[#00FFD1]">
          <ThumbsUp className="size-3" /> 찬성 {proPct}%
        </span>
        <span className="inline-flex items-center gap-1 text-[#FF00FF]">
          반대 {conPct}% <ThumbsDown className="size-3" />
        </span>
      </div>
      <div className="mt-1.5 flex h-2.5 overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className="rounded-l-full bg-[#00FFD1] transition-all duration-700"
          style={{ width: `${proPct}%` }}
        />
        <div
          className="rounded-r-full bg-[#FF00FF] transition-all duration-700"
          style={{ width: `${conPct}%` }}
        />
      </div>
      <div className="mt-1.5 text-center text-[10px] text-zinc-600">
        총 {total}표 참여
      </div>
    </div>
  )
}

/* ─── 메인 페이지 ───────────────────────────────────── */

export default function ProfilePage() {
  const { user, loading: authLoading } = useAuth()
  const { profile, setCustomTitle } = useProfile()
  const { confirm } = useConfirm()
  const [activity, setActivity] = useState<ActivityData | null>(null)
  const [titleModalOpen, setTitleModalOpen] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [editThread, setEditThread] = useState<ThreadItem | null>(null)
  const [editTitle, setEditTitle] = useState("")
  const [editContent, setEditContent] = useState("")
  const [editTag, setEditTag] = useState("")
  const [saving, setSaving] = useState(false)
  const [showAllThreads, setShowAllThreads] = useState(false)

  useEffect(() => {
    if (authLoading || !user) {
      setActivity(null)
      return
    }

    let cancelled = false
    setActivity(null)

    ;(async () => {
      /* ── Group 1: 병렬 쿼리 ── */
      // 1차: created_by = 내 ID로 검색
      let threadsRes = await supabase
        .from("threads")
        .select("*")
        .eq("created_by", user.id)
        .order("created_at", { ascending: false })

      // (orphan thread 조회 제거 — 보안 취약점 수정)

      if (threadsRes.error) {
        console.error("[Profile] 토론 조회 실패:", threadsRes.error.message, threadsRes.error.code)
      }

      const [commentFullRes, votesRes, commentCountRes] =
        await Promise.all([
          // 내가 쓴 댓글 (최근 20개)
          supabase
            .from("comments")
            .select("*")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(40),
          // 내 투표 기록
          supabase
            .from("thread_votes")
            .select("thread_id, vote_type")
            .eq("user_id", user.id),
          // 전체 댓글 수 (placeholder — 클라이언트에서 필터 후 재계산)
          supabase
            .from("comments")
            .select("id", { count: "exact", head: true })
            .eq("user_id", user.id),
        ])

      if (cancelled) return

      const threads = (threadsRes.data ?? []).map((r: Record<string, unknown>) => ({
        id: String(r.id ?? ""),
        title: String(r.title ?? ""),
        content: String(r.content ?? ""),
        tag: String(r.tag ?? ""),
        created_at: typeof r.created_at === "string" ? r.created_at : null,
        pro_count: Number(r.pro_count) || 0,
        con_count: Number(r.con_count) || 0,
        template: typeof r.template === "string" ? r.template : "free",
        is_closed: r.is_closed === true,
      })) as ThreadItem[]
      // 삭제된 댓글 필터링
      const myCommentsFull = (commentFullRes.data ?? [])
        .filter((r: Record<string, unknown>) => r.is_deleted !== true)
        .slice(0, 20) as Array<{
        id: string
        thread_id: string
        content: string
        side: "pro" | "con" | null
        created_at: string | null
      }>
      const myVotes = (votesRes.data ?? []) as Array<{
        thread_id: string
        vote_type: "pro" | "con"
      }>
      // 삭제되지 않은 댓글만 카운트
      const allCommentsRaw = commentFullRes.data ?? []
      const commentCount = allCommentsRaw.filter((r: Record<string, unknown>) => r.is_deleted !== true).length

      /* ── Group 2: 의존 쿼리 ── */

      // 댓글+투표에 관련된 thread ID 수집
      const relatedThreadIds = new Set<string>()
      myCommentsFull.forEach((c) => relatedThreadIds.add(c.thread_id))
      myVotes.forEach((v) => relatedThreadIds.add(v.thread_id))

      // thread title 일괄 조회
      const titleMap = new Map<string, string>()
      if (relatedThreadIds.size > 0) {
        const { data: titleRows } = await supabase
          .from("threads")
          .select("id, title")
          .in("id", Array.from(relatedThreadIds))
        ;(titleRows ?? []).forEach((r: { id: string; title: string }) => {
          titleMap.set(r.id, r.title)
        })
      }

      // 내 댓글 ID 목록
      const myCommentIds = myCommentsFull.map((c) => c.id)

      // 전체 댓글 ID (좋아요/불꽃 집계용)
      const { data: allMyCommentRows } = await supabase
        .from("comments")
        .select("id")
        .eq("user_id", user.id)
      const allMyCommentIds = (allMyCommentRows ?? []).map(
        (c: { id: string }) => c.id
      )

      // 리액션 카운트 (최근 20개 댓글)
      const reactionMap = new Map<
        string,
        { like: number; dislike: number; fire: number }
      >()
      myCommentIds.forEach((id) =>
        reactionMap.set(id, { like: 0, dislike: 0, fire: 0 })
      )

      if (myCommentIds.length > 0) {
        const { data: reactionRows } = await supabase
          .from("comment_reactions")
          .select("comment_id, reaction")
          .in("comment_id", myCommentIds)
        ;(reactionRows ?? []).forEach(
          (r: { comment_id: string; reaction: string }) => {
            const entry = reactionMap.get(r.comment_id)
            if (entry && (r.reaction === "like" || r.reaction === "dislike" || r.reaction === "fire")) {
              entry[r.reaction]++
            }
          }
        )
      }

      // totalLikes, totalFires (전체 댓글 대상)
      let totalLikes = 0
      let totalFires = 0
      if (allMyCommentIds.length > 0) {
        const [likesRes, firesRes] = await Promise.all([
          supabase
            .from("comment_reactions")
            .select("id", { count: "exact", head: true })
            .eq("reaction", "like")
            .in("comment_id", allMyCommentIds),
          supabase
            .from("comment_reactions")
            .select("id", { count: "exact", head: true })
            .eq("reaction", "fire")
            .in("comment_id", allMyCommentIds),
        ])
        totalLikes = likesRes.count ?? 0
        totalFires = firesRes.count ?? 0
      }

      // verdictCount: 내가 참여한 스레드(생성/댓글/투표) 중 ai_verdict 있는 수
      const participatedThreadIds = new Set<string>()
      threads.forEach((t) => participatedThreadIds.add(t.id))
      myCommentsFull.forEach((c) => participatedThreadIds.add(c.thread_id))
      myVotes.forEach((v) => participatedThreadIds.add(v.thread_id))

      let verdictCount = 0
      if (participatedThreadIds.size > 0) {
        const { count } = await supabase
          .from("threads")
          .select("id", { count: "exact", head: true })
          .in("id", Array.from(participatedThreadIds))
          .not("ai_verdict", "is", null)
        verdictCount = count ?? 0
      }

      // 북마크 목록
      let bookmarks: BookmarkItem[] = []
      const { data: bmRows, error: bmErr } = await supabase
        .from("bookmarks")
        .select("thread_id")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
      if (!bmErr && bmRows && bmRows.length > 0) {
        const bmThreadIds = bmRows.map((r: { thread_id: string }) => r.thread_id)
        const { data: bmThreads } = await supabase
          .from("threads")
          .select("id, title, pro_count, con_count")
          .in("id", bmThreadIds)
        if (bmThreads) {
          const bmMap = new Map(
            (bmThreads as Array<{ id: string; title: string; pro_count: number; con_count: number }>)
              .map((t) => [t.id, t])
          )
          // 북마크 순서 유지
          bookmarks = bmThreadIds
            .map((tid: string) => {
              const t = bmMap.get(tid)
              return t
                ? { thread_id: t.id, title: t.title, pro_count: t.pro_count ?? 0, con_count: t.con_count ?? 0 }
                : null
            })
            .filter((b): b is BookmarkItem => b !== null)
        }
      }

      // 투표 통계
      const proVoteCount = myVotes.filter(
        (v) => v.vote_type === "pro"
      ).length
      const conVoteCount = myVotes.filter(
        (v) => v.vote_type === "con"
      ).length

      // 댓글 히스토리 조립
      const commentHistory: CommentHistoryItem[] = myCommentsFull.map((c) => ({
        id: c.id,
        thread_id: c.thread_id,
        threadTitle: titleMap.get(c.thread_id) ?? "삭제된 토론",
        content: c.content,
        side: c.side,
        created_at: c.created_at,
        reactions: reactionMap.get(c.id) ?? { like: 0, dislike: 0, fire: 0 },
      }))

      // 투표 기록 조립
      const voteHistory: VoteHistoryItem[] = myVotes.map((v) => ({
        thread_id: v.thread_id,
        threadTitle: titleMap.get(v.thread_id) ?? "삭제된 토론",
        vote_type: v.vote_type,
      }))

      if (cancelled) return
      setActivity({
        threads,
        commentCount,
        totalLikes,
        totalFires,
        proVoteCount,
        conVoteCount,
        verdictCount,
        commentHistory,
        voteHistory,
        bookmarks,
      })
    })()

    return () => {
      cancelled = true
    }
  }, [user?.id, authLoading])

  /* ── 토론 삭제 ── */
  async function handleDeleteThread(threadId: string) {
    if (!user || deleting) return
    const ok = await confirm({
      title: "토론 삭제",
      message: "정말 이 토론을 삭제하시겠습니까? 삭제하면 되돌릴 수 없습니다.",
      confirmText: "삭제",
      variant: "danger",
    })
    if (!ok) {
      setConfirmDeleteId(null)
      return
    }
    setDeleting(true)
    const { error, data } = await supabase
      .from("threads")
      .delete()
      .eq("id", threadId)
      .eq("created_by", user.id)
      .select("id")
    setDeleting(false)
    setConfirmDeleteId(null)
    if (error) {
      console.error("[Profile] 토론 삭제 실패:", error.message, error.code)
      alert("토론 삭제에 실패했습니다: " + (error.message || error.code))
      return
    }
    if (!data || data.length === 0) {
      alert("삭제 권한이 없거나 이미 삭제된 토론입니다. Supabase SQL Editor에서 fix-threads-rls.sql을 실행해주세요.")
      return
    }
    setActivity((prev) =>
      prev ? { ...prev, threads: prev.threads.filter((t) => t.id !== threadId) } : prev
    )
  }

  /* ── 토론 수정 모달 열기 ── */
  function openEditModal(t: ThreadItem) {
    setEditThread(t)
    setEditTitle(t.title)
    setEditContent(t.content)
    setEditTag(t.tag)
  }

  function closeEditModal() {
    setEditThread(null)
    setEditTitle("")
    setEditContent("")
    setEditTag("")
  }

  async function handleSaveThread() {
    if (!user || !editThread || saving) return
    const trimTitle = editTitle.trim()
    if (!trimTitle) return
    setSaving(true)
    const { error, data } = await supabase
      .from("threads")
      .update({
        title: trimTitle,
        content: editContent.trim(),
        tag: editTag || null,
      })
      .eq("id", editThread.id)
      .eq("created_by", user.id)
      .select("id")
    setSaving(false)
    if (error) {
      console.error("[Profile] 토론 수정 실패:", error.message, error.code)
      alert("토론 수정에 실패했습니다: " + (error.message || error.code))
      return
    }
    if (!data || data.length === 0) {
      alert("수정 권한이 없습니다. Supabase SQL Editor에서 fix-threads-rls.sql을 실행해주세요.")
      return
    }
    setActivity((prev) =>
      prev
        ? {
            ...prev,
            threads: prev.threads.map((t) =>
              t.id === editThread.id
                ? { ...t, title: trimTitle, content: editContent.trim(), tag: editTag }
                : t
            ),
          }
        : prev
    )
    closeEditModal()
  }

  /* ── 로딩 중 ── */
  if (authLoading || (user && !activity)) {
    return (
      <div className="flex min-h-screen flex-col bg-black text-zinc-100">
        <div className="pointer-events-none fixed inset-0">
          <div className="absolute inset-0 bg-[radial-gradient(900px_circle_at_20%_10%,rgba(34,211,238,0.10),transparent_55%),radial-gradient(700px_circle_at_80%_20%,rgba(236,72,153,0.08),transparent_55%)]" />
        </div>
        <div className="relative w-full flex-1 px-6 py-8 sm:px-10 lg:px-12">
          <Bone className="mb-6 h-4 w-24" />
          <ProfileSkeleton />
        </div>
      </div>
    )
  }

  /* ── 미로그인 ── */
  if (!user) {
    return (
      <div className="min-h-screen bg-black text-zinc-100">
        <div className="relative mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-200"
          >
            <ArrowLeft className="size-4" />
            홈으로
          </Link>
          <div className="mt-12 rounded-2xl border border-white/10 bg-black/40 p-12 text-center backdrop-blur">
            <div className="mx-auto grid size-16 place-items-center rounded-2xl border border-fuchsia-400/20 bg-fuchsia-400/5 text-fuchsia-300">
              <Swords className="size-7" />
            </div>
            <div className="mt-5 text-xl font-semibold text-zinc-100">
              전투원 인증이 필요해
            </div>
            <div className="mt-2 text-sm text-zinc-400">
              마이페이지는 로그인한 유저만 접근할 수 있어요.
            </div>
            <div className="mt-8">
              <Link href="/">
                <Button className="bg-white text-black hover:bg-white/90">
                  홈으로 돌아가기
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  /* ── 본문 ── */
  if (!activity) return null

  const xp = profile?.xp ?? 0
  const tier = getTier(xp)
  const badge = tier.badgeName
  const { pct, current, total, next } = xpProgress(xp)
  const displayName = profile?.displayName || getDisplayName(user.id)
  const avatarInitials = displayName.slice(0, 2).toUpperCase()

  const visibleThreads = showAllThreads
    ? activity.threads
    : activity.threads.slice(0, 3)

  // 자유/격돌 전적 분류
  const freeThreads = activity.threads.filter((t) => t.template === "free")
  const clashThreads = activity.threads.filter((t) => t.template === "strict")

  const STATS = [
    { value: freeThreads.length, label: "자유 토론", icon: MessageSquareText, color: "green" },
    { value: clashThreads.length, label: "찬반 격돌", icon: Swords, color: "clash" },
    { value: activity.commentCount, label: "작성 댓글", icon: MessageSquareText, color: "zinc" },
    { value: activity.proVoteCount, label: "찬성 투표", icon: ThumbsUp, color: "cyan" },
    { value: activity.conVoteCount, label: "반대 투표", icon: ThumbsDown, color: "magenta" },
    { value: activity.totalLikes, label: "받은 좋아요", icon: ThumbsUp, color: "amber" },
    { value: activity.verdictCount, label: "AI 판결", icon: Scale, color: "amber" },
  ] as const

  const colorMap: Record<string, { border: string; bg: string; text: string; icon: string }> = {
    green:   { border: "border-[#39FF14]/15", bg: "bg-[#39FF14]/5",  text: "text-[#39FF14]",   icon: "text-[#39FF14]/60" },
    clash:   { border: "border-[#00FFD1]/15", bg: "bg-[#00FFD1]/5",  text: "text-[#00FFD1]",   icon: "text-[#00FFD1]/60" },
    cyan:    { border: "border-[#00FFD1]/15", bg: "bg-[#00FFD1]/5",  text: "text-[#00FFD1]",   icon: "text-[#00FFD1]/60" },
    magenta: { border: "border-[#FF00FF]/15", bg: "bg-[#FF00FF]/5",  text: "text-[#FF00FF]",   icon: "text-[#FF00FF]/60" },
    zinc:    { border: "border-zinc-400/15",  bg: "bg-zinc-400/5",   text: "text-zinc-100",    icon: "text-zinc-400/60" },
    amber:   { border: "border-amber-400/15", bg: "bg-amber-400/5",  text: "text-amber-100",   icon: "text-amber-400/60" },
  }

  return (
    <div className="flex min-h-screen flex-col bg-black text-zinc-100">
      {/* 배경 그라데이션 */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(1100px_circle_at_15%_10%,rgba(34,211,238,0.12),transparent_55%),radial-gradient(800px_circle_at_85%_15%,rgba(236,72,153,0.10),transparent_55%),radial-gradient(800px_circle_at_50%_90%,rgba(52,211,153,0.07),transparent_60%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.04),transparent_30%)] opacity-40" />
      </div>

      <div className="relative w-full flex-1 px-6 py-6 sm:px-10 lg:px-12">
        {/* 네비게이션 */}
        <nav className="mb-5 flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-200"
          >
            <ArrowLeft className="size-4" />
            아고라로
          </Link>
          <span className="text-[11px] tracking-widest text-zinc-600">
            MERCENARY FILE
          </span>
        </nav>

        <div className="flex flex-1 flex-col gap-4">
          {/* ━━━━ 컴팩트 프로필 헤더 (한 줄) ━━━━ */}
          <div
            className={`rounded-2xl bg-gradient-to-r ${tier.cardGradient} p-px`}
            style={{ boxShadow: tier.glowShadow }}
          >
            <div className="rounded-2xl border border-white/10 bg-black/50 px-5 py-4 backdrop-blur">
              <div className="flex items-center gap-4">
                {/* 아바타 (48px) */}
                <div className="relative shrink-0">
                  <div
                    className={`grid size-12 place-items-center rounded-xl bg-gradient-to-br ${tier.avatarGradient} text-base font-bold text-black`}
                    style={{ boxShadow: tier.avatarShadow }}
                  >
                    {avatarInitials}
                  </div>
                  <span className="absolute -right-0.5 -bottom-0.5 size-3 rounded-full border-2 border-black bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
                </div>

                {/* 이름 + 배지 + XP */}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-semibold text-zinc-100">
                      {displayName}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${tier.pillClasses}`}
                    >
                      <Swords className="size-2.5" />
                      {badge}
                    </span>
                    <span className="level-number-glow inline-flex items-center rounded-md border border-cyan-400/30 bg-cyan-400/10 px-1.5 py-0.5 text-[10px] font-bold text-cyan-300">
                      Lv.{getLevel(xp)}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${tier.pillClasses}`}
                    >
                      <Zap className="size-2.5" />
                      {xp} XP
                    </span>
                    {profile?.customTitle && (
                      <UserTitleBadge titleKey={profile.customTitle} />
                    )}
                  </div>

                  {/* XP 미니 진행바 */}
                  <div className="mt-1.5 flex items-center gap-3">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                      <div
                        className={`h-full rounded-full bg-gradient-to-r ${tier.avatarGradient} transition-all duration-700`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="shrink-0 text-[10px] text-zinc-500">
                      {next ? (
                        <>
                          {current}/{total}
                        </>
                      ) : (
                        <span className={tier.textClass}>MAX</span>
                      )}
                    </span>
                  </div>
                </div>

                {/* 버튼들 */}
                <div className="hidden shrink-0 items-center gap-2 sm:flex">
                  <button
                    type="button"
                    onClick={() => setTitleModalOpen(true)}
                    className="inline-flex items-center rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-[10px] font-medium text-zinc-400 transition hover:bg-white/10 hover:text-zinc-200"
                  >
                    칭호 변경
                  </button>
                  <Link
                    href="/settings/profile"
                    className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-[10px] font-medium text-zinc-400 transition hover:bg-white/10 hover:text-zinc-200"
                  >
                    <Pencil className="size-2.5" />
                    프로필 수정
                  </Link>
                  <Link
                    href="/settings/security"
                    className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-[10px] font-medium text-zinc-400 transition hover:bg-white/10 hover:text-zinc-200"
                  >
                    <Shield className="size-2.5" />
                    보안
                  </Link>
                  <Link
                    href="/bookmarks"
                    className="inline-flex items-center gap-1 rounded-lg border border-cyan-400/20 bg-cyan-400/10 px-2.5 py-1.5 text-[10px] font-medium text-cyan-300 transition hover:bg-cyan-400/20"
                  >
                    <Bookmark className="size-2.5" />
                    내 북마크
                  </Link>
                </div>
              </div>

              {/* 모바일: 버튼 2줄차 */}
              <div className="mt-3 flex flex-wrap items-center gap-2 sm:hidden">
                <button
                  type="button"
                  onClick={() => setTitleModalOpen(true)}
                  className="inline-flex items-center rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-[10px] font-medium text-zinc-400 transition hover:bg-white/10 hover:text-zinc-200"
                >
                  칭호 변경
                </button>
                <Link
                  href="/settings/profile"
                  className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-[10px] font-medium text-zinc-400 transition hover:bg-white/10 hover:text-zinc-200"
                >
                  <Pencil className="size-2.5" />
                  프로필 수정
                </Link>
                <Link
                  href="/settings/security"
                  className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-[10px] font-medium text-zinc-400 transition hover:bg-white/10 hover:text-zinc-200"
                >
                  <Shield className="size-2.5" />
                  보안
                </Link>
                <Link
                  href="/bookmarks"
                  className="inline-flex items-center gap-1 rounded-lg border border-cyan-400/20 bg-cyan-400/10 px-2.5 py-1.5 text-[10px] font-medium text-cyan-300 transition hover:bg-cyan-400/20"
                >
                  <Bookmark className="size-2.5" />
                  내 북마크
                </Link>
              </div>
            </div>
          </div>

          <TitleSelectorModal
            isOpen={titleModalOpen}
            onClose={() => setTitleModalOpen(false)}
            currentTitle={profile?.customTitle ?? null}
            onSelect={setCustomTitle}
          />

          {/* ━━━━ 중앙 2컬럼: Stats + 성향/배지 ━━━━ */}
          <div className="grid gap-4 lg:grid-cols-2">
            {/* 좌측: Combat Stats */}
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
              <div className="mb-3 text-[10px] tracking-widest text-zinc-600">
                COMBAT STATS
              </div>
              <div className="grid grid-cols-4 gap-2">
                {STATS.map((s) => {
                  const c = colorMap[s.color]
                  const Icon = s.icon
                  return (
                    <div
                      key={s.label}
                      className={`rounded-xl border ${c.border} ${c.bg} p-3 text-center`}
                    >
                      <div className={`text-xl font-bold tabular-nums ${c.text}`}>
                        {s.value}
                      </div>
                      <div className="mt-1 flex items-center justify-center gap-1 text-[10px] text-zinc-500">
                        <Icon className={`size-2.5 ${c.icon}`} />
                        {s.label}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* 우측: 성향 게이지 + 배지 컬렉션 */}
            <div className="space-y-3">
              <TendencyGauge
                proCount={activity.proVoteCount}
                conCount={activity.conVoteCount}
              />
              <BadgeCollectionSection xp={xp} />
            </div>
          </div>

          {/* ━━━━ 특별 뱃지 ━━━━ */}
          <FeaturedBadgeSection />

          {/* ━━━━ 업적 (가로 스크롤 1줄) ━━━━ */}
          <AchievementGrid />

          {/* ━━━━ 하단 3컬럼: 토론 / 댓글 / 투표+북마크 ━━━━ */}
          <div className="grid flex-1 gap-4 lg:grid-cols-3">
            {/* 좌: 내가 연 토론 */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-zinc-100">
                <Swords className="size-3.5 text-cyan-300" />
                내가 연 토론
                <span className="rounded-full border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] text-zinc-400">
                  {activity.threads.length}개
                </span>
              </div>

              {activity.threads.length === 0 ? (
                <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-center">
                  <div className="text-xs text-zinc-400">
                    아직 연 토론이 없어요.
                  </div>
                </div>
              ) : (
                <>
                  {visibleThreads.map((t) => {
                    const tplBadge =
                      t.template === "strict"
                        ? { label: "CLASH", cls: "border-[#00FFD1]/30 bg-[#00FFD1]/10 text-[#00FFD1]" }
                        : null

                    return (
                      <div
                        key={t.id}
                        className="group rounded-xl bg-white/[0.02] p-2.5 transition-all hover:bg-white/[0.05]"
                      >
                        <Link href={`/thread/${t.id}`} className="block">
                          <div className="flex items-start justify-between gap-2">
                            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-zinc-100 group-hover:text-white">
                              {t.title}
                            </span>
                            <div className="flex shrink-0 items-center gap-1">
                              {tplBadge && (
                                <span
                                  className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[9px] font-bold tracking-wide ${tplBadge.cls}`}
                                >
                                  {tplBadge.label}
                                </span>
                              )}
                              {t.is_closed && (
                                <span className="inline-flex items-center rounded-md border border-red-400/20 bg-red-400/10 px-1 py-0.5 text-[9px] text-red-300">
                                  <Lock className="size-2.5" />
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="mt-1.5 flex items-center gap-2.5 text-[10px] text-zinc-500">
                            <span className="inline-flex items-center gap-1">
                              <span className="size-1.5 rounded-full bg-[#00FFD1]/60" />
                              찬성 {t.pro_count ?? 0}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <span className="size-1.5 rounded-full bg-[#FF00FF]/60" />
                              반대 {t.con_count ?? 0}
                            </span>
                            <span className="text-zinc-700">
                              {formatDate(t.created_at)}
                            </span>
                          </div>
                        </Link>

                        {/* 수정/삭제 아이콘 (호버 시 표시) */}
                        <div className="mt-1.5 flex items-center gap-1 border-t border-white/[0.03] pt-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                          <button
                            type="button"
                            onClick={() => openEditModal(t)}
                            className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] text-zinc-500 transition hover:bg-white/10 hover:text-cyan-300"
                          >
                            <Pencil className="size-2.5" />
                            수정
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteThread(t.id)}
                            disabled={deleting}
                            className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] text-zinc-500 transition hover:bg-white/10 hover:text-red-300 disabled:opacity-50"
                          >
                            <Trash2 className="size-2.5" />
                            삭제
                          </button>
                        </div>
                      </div>
                    )
                  })}

                  {activity.threads.length > 3 && (
                    <button
                      onClick={() => setShowAllThreads((p) => !p)}
                      className="flex w-full items-center justify-center gap-1 rounded-lg bg-white/[0.03] py-1.5 text-[10px] text-zinc-500 transition-colors hover:bg-white/[0.06] hover:text-zinc-300"
                    >
                      {showAllThreads ? (
                        <>
                          접기 <ChevronUp className="size-3" />
                        </>
                      ) : (
                        <>
                          전체 {activity.threads.length}개 보기{" "}
                          <ChevronDown className="size-3" />
                        </>
                      )}
                    </button>
                  )}
                </>
              )}
            </div>

            {/* 중앙: 내가 쓴 댓글 */}
            <CommentHistorySection
              comments={activity.commentHistory}
              total={activity.commentCount}
            />

            {/* 우: 투표 기록 + 북마크 */}
            <div className="space-y-4">
              <VoteHistorySection votes={activity.voteHistory} />
              <BookmarkSection bookmarks={activity.bookmarks} />
            </div>
          </div>
        </div>
      </div>

      {/* ── 토론 수정 모달 (portal) ── */}
      {editThread &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
            onClick={(e) => {
              if (e.target === e.currentTarget) closeEditModal()
            }}
          >
            <div className="relative mx-4 w-full max-w-lg rounded-3xl border border-white/10 bg-zinc-950 p-6 shadow-2xl">
              <button
                type="button"
                onClick={closeEditModal}
                className="absolute top-4 right-4 rounded-full p-1 text-zinc-500 hover:bg-white/10 hover:text-zinc-300"
              >
                <X className="size-5" />
              </button>

              <h2 className="mb-5 text-lg font-semibold text-zinc-100">
                토론 수정
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-zinc-400">
                    제목
                  </label>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    maxLength={100}
                    className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-zinc-100 outline-none focus:border-cyan-400/40"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-zinc-400">
                    내용
                  </label>
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    rows={4}
                    maxLength={2000}
                    className="w-full resize-none rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-zinc-100 outline-none focus:border-cyan-400/40"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-zinc-400">
                    카테고리
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      "AI",
                      "정치",
                      "경제",
                      "사회",
                      "기술",
                      "문화",
                      "교육",
                      "환경",
                      "기타",
                    ].map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() =>
                          setEditTag(editTag === cat ? "" : cat)
                        }
                        className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                          editTag === cat
                            ? "border-cyan-400/40 bg-cyan-400/15 text-cyan-100"
                            : "border-white/10 bg-white/5 text-zinc-400 hover:bg-white/10"
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    variant="outline"
                    onClick={closeEditModal}
                    className="border-white/10 text-zinc-400"
                  >
                    취소
                  </Button>
                  <Button
                    onClick={handleSaveThread}
                    disabled={saving || !editTitle.trim()}
                    className="bg-gradient-to-r from-cyan-300 via-sky-200 to-fuchsia-300 text-sm font-semibold text-black hover:from-cyan-200 hover:via-sky-100 hover:to-fuchsia-200 disabled:opacity-60"
                  >
                    {saving ? "저장 중…" : "저장"}
                  </Button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  )
}
