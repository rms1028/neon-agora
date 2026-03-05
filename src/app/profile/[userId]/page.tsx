"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft,
  Ban,
  MessageSquarePlus,
  MessageSquareText,
  Shield,
  Swords,
  ThumbsUp,
  UserPlus,
  UserCheck,
  Zap,
} from "lucide-react"

import { supabase } from "@/lib/supabase"
import { useAuth } from "@/components/auth-provider"
import { useToast } from "@/components/toast-provider"
import { useBlocks } from "@/hooks/useBlocks"
import { useConfirm } from "@/components/confirm-dialog"
import { getDisplayName } from "@/lib/utils"
import { getTier, xpProgress } from "@/lib/xp"
import { ACHIEVEMENTS } from "@/lib/achievements"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { DuelChallengeModal } from "@/components/duel-challenge-modal"
import { DebateRequestModal } from "@/components/debate-request-modal"

type PublicProfileData = {
  xp: number
  displayName: string | null
  threadCount: number
  commentCount: number
  totalLikes: number
  followerCount: number
  followingCount: number
  threads: Array<{
    id: string
    title: string
    pro_count: number
    con_count: number
  }>
  achievements: string[]
}

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

function Bone({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-white/[0.07] ${className ?? ""}`}
    />
  )
}

export default function PublicProfilePage() {
  const params = useParams()
  const userId = params.userId as string
  const { user } = useAuth()
  const { showToast } = useToast()
  const { confirm } = useConfirm()
  const [data, setData] = useState<PublicProfileData | null>(null)
  const [loading, setLoading] = useState(true)
  const [isFollowing, setIsFollowing] = useState(false)
  const [followLoading, setFollowLoading] = useState(false)
  const [duelModalOpen, setDuelModalOpen] = useState(false)
  const [debateRequestOpen, setDebateRequestOpen] = useState(false)

  const { blockedIds, blockUser, unblockUser } = useBlocks()
  const isOwnProfile = user?.id === userId
  const isBlockedByMe = blockedIds.has(userId)

  // 프로필 데이터 로드
  useEffect(() => {
    let cancelled = false
    setLoading(true)

    ;(async () => {
      // 7개 독립 쿼리 병렬 실행
      const [
        profileResult,
        threadsResult,
        commentCountResult,
        myCommentsResult,
        followerResult,
        followingResult,
        achResult,
      ] = await Promise.all([
        supabase.from("profiles").select("xp, display_name").eq("id", userId).single(),
        supabase.from("threads").select("id, title, pro_count, con_count").eq("created_by", userId).order("created_at", { ascending: false }).limit(10),
        supabase.from("comments").select("id", { count: "exact", head: true }).eq("user_id", userId),
        supabase.from("comments").select("id").eq("user_id", userId),
        supabase.from("follows").select("id", { count: "exact", head: true }).eq("following_id", userId),
        supabase.from("follows").select("id", { count: "exact", head: true }).eq("follower_id", userId),
        supabase.from("user_achievements").select("achievement_key").eq("user_id", userId),
      ])

      if (cancelled) return

      const profile = profileResult.data
      const threads = threadsResult.data
      const commentCount = commentCountResult.count
      const commentIds = (myCommentsResult.data ?? []).map((c: { id: string }) => c.id)

      // 의존 쿼리: 좋아요 수 (commentIds 필요)
      let totalLikes = 0
      if (commentIds.length > 0) {
        const { count } = await supabase
          .from("comment_reactions")
          .select("id", { count: "exact", head: true })
          .eq("reaction", "like")
          .in("comment_id", commentIds)
        totalLikes = count ?? 0
      }

      const followerCount = !followerResult.error ? (followerResult.count ?? 0) : 0
      const followingCount = !followingResult.error ? (followingResult.count ?? 0) : 0
      const userAchievements = (achResult.data ?? []).map(
        (r: { achievement_key: string }) => r.achievement_key
      )

      if (cancelled) return
      setData({
        xp: (profile as { xp?: number } | null)?.xp ?? 0,
        displayName: (profile as { display_name?: string | null } | null)?.display_name ?? null,
        threadCount: (threads ?? []).length,
        commentCount: commentCount ?? 0,
        totalLikes,
        followerCount,
        followingCount,
        threads: (threads ?? []) as PublicProfileData["threads"],
        achievements: userAchievements,
      })
      setLoading(false)
    })()

    return () => { cancelled = true }
  }, [userId])

  // 팔로우 상태 확인
  useEffect(() => {
    if (!user || isOwnProfile) return
    let cancelled = false
    ;(async () => {
      const { data: row, error } = await supabase
        .from("follows")
        .select("id")
        .eq("follower_id", user.id)
        .eq("following_id", userId)
        .maybeSingle()
      if (cancelled) return
      if (!error) setIsFollowing(!!row)
    })()
    return () => { cancelled = true }
  }, [user?.id, userId, isOwnProfile])

  async function handleFollow() {
    if (!user) {
      showToast("로그인이 필요합니다.", "info")
      return
    }
    setFollowLoading(true)

    if (isFollowing) {
      await supabase
        .from("follows")
        .delete()
        .eq("follower_id", user.id)
        .eq("following_id", userId)
      setIsFollowing(false)
      setData((d) =>
        d ? { ...d, followerCount: Math.max(0, d.followerCount - 1) } : d
      )
      showToast("팔로우가 해제되었습니다.", "info")
    } else {
      const { error } = await supabase
        .from("follows")
        .insert({ follower_id: user.id, following_id: userId })
      if (!error) {
        setIsFollowing(true)
        setData((d) =>
          d ? { ...d, followerCount: d.followerCount + 1 } : d
        )
        showToast("팔로우했습니다!", "success")
      }
    }
    setFollowLoading(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-zinc-100">
        <div className="pointer-events-none fixed inset-0">
          <div className="absolute inset-0 bg-[radial-gradient(900px_circle_at_20%_10%,rgba(34,211,238,0.10),transparent_55%)]" />
        </div>
        <div className="relative mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
          <Bone className="mb-8 h-5 w-28" />
          <div className="space-y-6">
            <div className="rounded-3xl bg-gradient-to-r from-cyan-500/20 via-fuchsia-500/10 to-emerald-400/10 p-px">
              <div className="rounded-3xl bg-black/50 p-6 backdrop-blur">
                <div className="flex gap-5">
                  <Bone className="size-20 shrink-0 rounded-2xl" />
                  <div className="flex-1 space-y-3">
                    <Bone className="h-5 w-40" />
                    <Bone className="h-4 w-28" />
                    <Bone className="h-2 w-full" />
                  </div>
                </div>
                <div className="mt-6 grid grid-cols-3 gap-3">
                  <Bone className="h-20 rounded-2xl" />
                  <Bone className="h-20 rounded-2xl" />
                  <Bone className="h-20 rounded-2xl" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!data) {
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
          <div className="mt-12 text-center text-zinc-400">
            유저를 찾을 수 없습니다.
          </div>
        </div>
      </div>
    )
  }

  const xp = data.xp
  const tier = getTier(xp)
  const { pct, current, total, next } = xpProgress(xp)
  const displayName = data.displayName || getDisplayName(userId)
  const avatarInitials = displayName.slice(0, 2).toUpperCase()

  return (
    <div className="min-h-screen bg-black text-zinc-100">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(1100px_circle_at_15%_10%,rgba(34,211,238,0.12),transparent_55%),radial-gradient(800px_circle_at_85%_15%,rgba(236,72,153,0.10),transparent_55%)]" />
      </div>

      <div className="relative mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
        <nav className="mb-8 flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-200"
          >
            <ArrowLeft className="size-4" />
            아고라로
          </Link>
          <span className="text-[11px] tracking-widest text-zinc-600">
            OPERATIVE FILE
          </span>
        </nav>

        <div className="space-y-6">
          {/* 프로필 카드 */}
          <div
            className={`rounded-3xl bg-gradient-to-r ${tier.cardGradient} p-px`}
            style={{ boxShadow: tier.glowShadow }}
          >
            <div className="rounded-3xl border border-white/10 bg-black/50 p-6 backdrop-blur">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
                <div className="relative shrink-0">
                  <div
                    className={`grid size-20 place-items-center rounded-2xl bg-gradient-to-br ${tier.avatarGradient} text-2xl font-bold text-black`}
                    style={{ boxShadow: tier.avatarShadow }}
                  >
                    {avatarInitials}
                  </div>
                </div>

                <div className="min-w-0 flex-1 space-y-3">
                  <div>
                    <div className="text-[11px] tracking-widest text-zinc-600">
                      OPERATIVE
                    </div>
                    <div className="mt-0.5 truncate text-base font-semibold text-zinc-100">
                      {displayName}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${tier.pillClasses}`}
                    >
                      <Swords className="size-3" />
                      {tier.badgeName}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${tier.pillClasses}`}
                    >
                      <Zap className="size-3" />
                      {xp} XP
                    </span>
                  </div>

                  {/* XP 바 */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] text-zinc-500">
                      <span>XP 진행도</span>
                      {next ? (
                        <span>{current} / {total}</span>
                      ) : (
                        <span className={tier.textClass}>MAX</span>
                      )}
                    </div>
                    <Progress
                      value={pct}
                      className={`h-2 bg-white/10 ${tier.progressIndicator} [&_[data-slot=progress-indicator]]:transition-all [&_[data-slot=progress-indicator]]:duration-700`}
                    />
                  </div>

                  {/* 팔로우 정보 + 버튼 */}
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-3 text-xs text-zinc-400">
                      <span>
                        팔로워{" "}
                        <span className="font-semibold text-zinc-200">
                          {data.followerCount}
                        </span>
                      </span>
                      <span>
                        팔로잉{" "}
                        <span className="font-semibold text-zinc-200">
                          {data.followingCount}
                        </span>
                      </span>
                    </div>

                    {!isOwnProfile && user && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={followLoading}
                        onClick={handleFollow}
                        className={
                          isFollowing
                            ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200 hover:bg-emerald-400/20"
                            : "border-cyan-400/30 bg-cyan-400/10 text-cyan-200 hover:bg-cyan-400/20"
                        }
                      >
                        {isFollowing ? (
                          <>
                            <UserCheck className="size-3.5" />
                            팔로잉
                          </>
                        ) : (
                          <>
                            <UserPlus className="size-3.5" />
                            팔로우
                          </>
                        )}
                      </Button>
                    )}

                    {!isOwnProfile && user && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          if (isBlockedByMe) {
                            const ok = await unblockUser(userId)
                            if (ok) showToast("차단이 해제되었습니다.", "info")
                          } else {
                            const confirmed = await confirm({
                              title: "사용자 차단",
                              message: "이 사용자를 차단하시겠습니까?",
                              confirmText: "차단",
                              variant: "danger",
                            })
                            if (!confirmed) return
                            const ok = await blockUser(userId)
                            if (ok) showToast("사용자를 차단했습니다.", "success")
                          }
                        }}
                        className={
                          isBlockedByMe
                            ? "border-red-400/30 bg-red-400/10 text-red-200 hover:bg-red-400/20"
                            : "border-white/15 bg-white/5 text-zinc-400 hover:bg-white/10"
                        }
                      >
                        <Ban className="size-3.5" />
                        {isBlockedByMe ? "차단 해제" : "차단"}
                      </Button>
                    )}

                    {!isOwnProfile && user && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setDuelModalOpen(true)}
                        className="border-amber-400/30 bg-amber-400/10 text-amber-200 hover:bg-amber-400/20"
                      >
                        <Swords className="size-3.5" />
                        대결 신청
                      </Button>
                    )}

                    {!isOwnProfile && user && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setDebateRequestOpen(true)}
                        className="border-emerald-400/30 bg-emerald-400/10 text-emerald-200 hover:bg-emerald-400/20"
                      >
                        <MessageSquarePlus className="size-3.5" />
                        토론 신청
                      </Button>
                    )}

                    {isOwnProfile && (
                      <Link href="/profile">
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-white/15 bg-white/5 text-xs text-zinc-400 hover:bg-white/10"
                        >
                          내 프로필로
                        </Button>
                      </Link>
                    )}
                  </div>
                </div>
              </div>

              <div className="my-5 border-t border-white/10" />

              {/* 전투 통계 */}
              <div className="mb-2 text-[11px] tracking-widest text-zinc-600">
                COMBAT STATS
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-2xl border border-cyan-400/15 bg-cyan-400/5 p-4 text-center">
                  <div className="text-2xl font-bold tabular-nums text-cyan-100">
                    {data.threadCount}
                  </div>
                  <div className="mt-1.5 flex items-center justify-center gap-1 text-[11px] text-zinc-500">
                    <Swords className="size-3 text-cyan-400/60" />
                    열린 토론
                  </div>
                </div>
                <div className="rounded-2xl border border-fuchsia-400/15 bg-fuchsia-400/5 p-4 text-center">
                  <div className="text-2xl font-bold tabular-nums text-fuchsia-100">
                    {data.commentCount}
                  </div>
                  <div className="mt-1.5 flex items-center justify-center gap-1 text-[11px] text-zinc-500">
                    <MessageSquareText className="size-3 text-fuchsia-400/60" />
                    작성 댓글
                  </div>
                </div>
                <div className="rounded-2xl border border-emerald-400/15 bg-emerald-400/5 p-4 text-center">
                  <div className="text-2xl font-bold tabular-nums text-emerald-100">
                    {data.totalLikes}
                  </div>
                  <div className="mt-1.5 flex items-center justify-center gap-1 text-[11px] text-zinc-500">
                    <ThumbsUp className="size-3 text-emerald-400/60" />
                    받은 좋아요
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 업적 그리드 */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
              <Shield className="size-4 text-amber-300" />
              업적
              <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-zinc-400">
                {data.achievements.length} / {ACHIEVEMENTS.length}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {ACHIEVEMENTS.map((ach) => {
                const unlocked = data.achievements.includes(ach.key)
                return (
                  <div
                    key={ach.key}
                    className={[
                      "relative rounded-2xl border p-4 text-center transition-all",
                      unlocked
                        ? "border-white/15 bg-white/[0.04]"
                        : "border-white/[0.06] bg-white/[0.02] opacity-40",
                      unlocked ? "badge-slot-active" : "",
                    ].join(" ")}
                    style={
                      unlocked
                        ? { boxShadow: `0 0 20px ${ach.glowColor}` }
                        : undefined
                    }
                  >
                    <div className="mx-auto text-2xl">
                      {ACHIEVEMENT_ICONS[ach.icon] ?? "🏅"}
                    </div>
                    <div
                      className={`mt-2 text-xs font-semibold ${
                        unlocked ? ach.color : "text-zinc-600"
                      }`}
                    >
                      {ach.name}
                    </div>
                    <div className="mt-0.5 text-[10px] text-zinc-500">
                      {ach.description}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* 토론 목록 */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
              <Swords className="size-4 text-cyan-300" />
              토론 목록
            </div>

            {data.threads.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
                <div className="text-sm text-zinc-400">
                  아직 토론이 없습니다.
                </div>
              </div>
            ) : (
              data.threads.map((t) => (
                <Link
                  key={t.id}
                  href={`/thread/${t.id}`}
                  className="group block rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition-all hover:border-cyan-400/30 hover:bg-cyan-400/[0.04]"
                >
                  <div className="truncate text-sm font-medium text-zinc-100 group-hover:text-cyan-100">
                    {t.title}
                  </div>
                  <div className="mt-1.5 flex items-center gap-3 text-[11px] text-zinc-500">
                    <span className="inline-flex items-center gap-1">
                      <span className="size-1.5 rounded-full bg-cyan-400/60" />
                      찬성 {t.pro_count ?? 0}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <span className="size-1.5 rounded-full bg-fuchsia-400/60" />
                      반대 {t.con_count ?? 0}
                    </span>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>

      {duelModalOpen && (
        <DuelChallengeModal
          opponentId={userId}
          onClose={() => setDuelModalOpen(false)}
        />
      )}

      {debateRequestOpen && (
        <DebateRequestModal
          opponentId={userId}
          onClose={() => setDebateRequestOpen(false)}
        />
      )}
    </div>
  )
}
