"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { ArrowUpDown, Check, CornerDownRight, Flag, GraduationCap, Loader2, Pencil, Pin, Plus, ScanSearch, ThumbsDown, ThumbsUp, Trash2, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { CommentComposer } from "@/components/comment-composer"
import { MarkdownContent } from "@/components/markdown-content"
import { ReportModal } from "@/components/report-modal"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/components/auth-provider"
import { useToast } from "@/components/toast-provider"
import { useProfile } from "@/components/profile-provider"
import { useBlocks } from "@/hooks/useBlocks"
import { UserTitleBadge } from "@/components/user-title-badge"
import { CoachingPanel, type CoachingResult } from "@/components/coaching-panel"
import { useConfirm } from "@/components/confirm-dialog"
import { timeAgo } from "@/lib/utils"
import { getFeaturedBadge, type FeaturedBadgeDef } from "@/lib/gamification"

type Side = "pro" | "con"
type Reaction = "like" | "dislike" | "fire"
type SortMode = "recent" | "liked"

type FactCheck = {
  verdict: "확인됨" | "의심" | "거짓" | "판단불가"
  explanation: string
}

export type CommentPoll = {
  pollId: string
  question: string
  proCount: number
  conCount: number
}

export type BattleComment = {
  id: string
  content: string
  created_at: string | null
  side: Side | null
  userId?: string
  parentId?: string | null
  displayName: string
  likeCount: number
  dislikeCount: number
  fireCount: number
  updatedAt?: string | null
  isDeleted?: boolean
  isPinned?: boolean
  customTitle?: string | null
  poll?: CommentPoll | null
}

/** @[name](uuid) → [@name](/profile/uuid) — 마크다운 링크로 변환 */
function preprocessMentions(text: string): string {
  return text.replace(/@\[([^\]]+)\]\(([^)]+)\)/g, "[@$1](/profile/$2)")
}

function formatDateTime(value: string | null) {
  return timeAgo(value)
}

function CommentPollUI({ poll }: { poll: CommentPoll }) {
  const { user } = useAuth()
  const { showToast } = useToast()
  const [pro, setPro] = useState(poll.proCount)
  const [con, setCon] = useState(poll.conCount)
  const [voted, setVoted] = useState<"pro" | "con" | null>(null)
  const [voting, setVoting] = useState(false)

  const total = pro + con
  const proPct = total > 0 ? Math.round((pro / total) * 100) : 50

  const handleVote = async (voteType: "pro" | "con") => {
    if (!user || voted || voting) return
    setVoting(true)

    // 낙관적 업데이트
    if (voteType === "pro") setPro((p) => p + 1)
    else setCon((p) => p + 1)
    setVoted(voteType)

    const { error } = await supabase.rpc("cast_poll_vote", {
      p_poll_id: poll.pollId,
      p_user_id: user.id,
      p_vote_type: voteType,
    })

    if (error) {
      // PGRST202 fallback
      if (error.code === "PGRST202") {
        const { error: insertErr } = await supabase
          .from("comment_poll_votes")
          .insert({ poll_id: poll.pollId, user_id: user.id, vote_type: voteType })
        if (insertErr) {
          if (voteType === "pro") setPro((p) => p - 1)
          else setCon((p) => p - 1)
          setVoted(null)
          showToast(insertErr.code === "23505" ? "이미 투표했습니다." : "투표에 실패했습니다.", "info")
        }
      } else {
        if (voteType === "pro") setPro((p) => p - 1)
        else setCon((p) => p - 1)
        setVoted(null)
        showToast("이미 투표했습니다.", "info")
      }
    }
    setVoting(false)
  }

  return (
    <div className="mt-3 rounded-xl border border-white/10 bg-black/30 p-3">
      <div className="mb-2 text-xs font-medium text-zinc-300">{poll.question}</div>
      {voted ? (
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-[11px]">
            <span className="w-8 text-cyan-300">찬성</span>
            <div className="relative flex-1 h-4 overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className="poll-result-fill absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-[#00FFD1]/80 to-[#00FFD1]"
                style={{ "--poll-width": `${proPct}%` } as React.CSSProperties}
              />
              <span className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold text-white">
                {proPct}%
              </span>
            </div>
            <span className="w-6 text-right text-zinc-500">{pro}</span>
          </div>
          <div className="flex items-center gap-2 text-[11px]">
            <span className="w-8 text-fuchsia-300">반대</span>
            <div className="relative flex-1 h-4 overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className="poll-result-fill absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-[#FF00FF]/80 to-[#FF00FF]"
                style={{ "--poll-width": `${100 - proPct}%` } as React.CSSProperties}
              />
              <span className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold text-white">
                {100 - proPct}%
              </span>
            </div>
            <span className="w-6 text-right text-zinc-500">{con}</span>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleVote("pro")}
            disabled={!user || voting}
            className="flex-1 rounded-lg border border-[#00FFD1]/30 bg-[#00FFD1]/10 py-1.5 text-xs font-semibold text-[#00FFD1] transition hover:bg-[#00FFD1]/20 disabled:opacity-50"
          >
            찬성
          </button>
          <button
            type="button"
            onClick={() => handleVote("con")}
            disabled={!user || voting}
            className="flex-1 rounded-lg border border-[#FF00FF]/30 bg-[#FF00FF]/10 py-1.5 text-xs font-semibold text-[#FF00FF] transition hover:bg-[#FF00FF]/20 disabled:opacity-50"
          >
            반대
          </button>
        </div>
      )}
    </div>
  )
}

function CommentCard({
  comment,
  tone,
  showTime,
  likeCount,
  myReaction,
  reacting,
  onReact,
  onReply,
  onReport,
  isBlocked,
  factCheck,
  onFactCheck,
  factChecking,
  isClosed,
  isOwn,
  editingId,
  editContent,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onChangeEdit,
  onDelete,
  onTogglePin,
  canPin,
  coaching,
  onCoach,
  coaching_loading,
  sentiment,
  featuredBadges,
}: {
  comment: BattleComment
  tone: "pro" | "con" | "neutral"
  showTime: boolean
  likeCount: number
  myReaction: Reaction | null
  reacting: boolean
  onReact: (reaction: Reaction) => void
  onReply?: () => void
  onReport?: () => void
  isBlocked?: boolean
  factCheck?: FactCheck | null
  onFactCheck?: () => void
  factChecking?: boolean
  isClosed?: boolean
  isOwn?: boolean
  editingId?: string | null
  editContent?: string
  onStartEdit?: () => void
  onCancelEdit?: () => void
  onSaveEdit?: () => void
  onChangeEdit?: (value: string) => void
  onDelete?: () => void
  onTogglePin?: () => void
  canPin?: boolean
  coaching?: CoachingResult | null
  onCoach?: () => void
  coaching_loading?: boolean
  sentiment?: string | null
  featuredBadges?: FeaturedBadgeDef[]
}) {
  if (isBlocked) {
    return (
      <div className="py-0.5 text-[11px] italic text-zinc-600">
        차단한 사용자의 댓글입니다
      </div>
    )
  }

  // 소프트 삭제된 댓글
  if (comment.isDeleted) {
    return (
      <div className="py-0.5 text-[11px] italic text-zinc-600">
        삭제된 댓글입니다
      </div>
    )
  }

  const isEditing = editingId === comment.id

  /* ── 자유 토론: 디스코드/슬랙 스타일 채팅 ── */
  if (tone === "neutral") {
    return (
      <div className="group relative flex gap-3 px-4 py-1 transition-colors hover:bg-white/[0.04]">
        {/* 아바타 */}
        <div className="mt-0.5 grid size-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#39FF14]/70 via-emerald-500 to-teal-500 text-xs font-bold text-black shadow-[0_0_12px_rgba(57,255,20,0.15)]">
          {comment.displayName.slice(0, 2)}
        </div>

        <div className="min-w-0 flex-1">
          {/* 헤더: 닉네임 + 시간 */}
          <div className="flex items-center gap-2">
            {comment.userId ? (
              <Link
                href={`/profile/${comment.userId}`}
                className="text-[13px] font-semibold text-[#39FF14] transition-colors hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                {comment.displayName}
              </Link>
            ) : (
              <span className="text-[13px] font-semibold text-[#39FF14]">
                {comment.displayName}
              </span>
            )}
            {comment.customTitle && (
              <UserTitleBadge titleKey={comment.customTitle} />
            )}
            {featuredBadges?.map((fb) => (
              <span
                key={fb.key}
                className={`featured-badge-glow inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[9px] font-semibold ${fb.borderClass} ${fb.bgClass} ${fb.textClass}`}
                title={fb.name}
              >
                {fb.icon}
              </span>
            ))}
            {comment.isPinned && (
              <span className="inline-flex items-center gap-0.5 rounded-full border border-yellow-400/30 bg-yellow-400/10 px-1.5 py-0.5 text-[9px] font-semibold text-yellow-200 pin-pulse">
                <Pin className="size-2.5" />
              </span>
            )}
            {comment.updatedAt && (
              <span className="text-[10px] text-zinc-600">(수정됨)</span>
            )}
            <span className="text-[10px] text-zinc-600" suppressHydrationWarning>
              {showTime ? formatDateTime(comment.created_at) : ""}
            </span>
          </div>

          {/* 본문 */}
          {isEditing ? (
            <div className="mt-1 space-y-1.5">
              <textarea
                value={editContent ?? ""}
                onChange={(e) => onChangeEdit?.(e.target.value)}
                rows={2}
                maxLength={500}
                className="w-full resize-none rounded-md border border-[#39FF14]/20 bg-black/50 px-3 py-1.5 text-sm text-zinc-100 outline-none focus:border-[#39FF14]/40"
              />
              <div className="flex items-center justify-end gap-1.5">
                <button type="button" onClick={onCancelEdit} className="rounded-md px-2 py-0.5 text-[11px] text-zinc-500 transition hover:bg-white/10 hover:text-zinc-300">
                  취소
                </button>
                <button type="button" onClick={onSaveEdit} className="rounded-md bg-[#39FF14]/15 px-2.5 py-0.5 text-[11px] font-medium text-[#39FF14] transition hover:bg-[#39FF14]/25">
                  저장
                </button>
              </div>
            </div>
          ) : (
            <div className="text-[14px] leading-relaxed text-zinc-200">
              <MarkdownContent content={preprocessMentions(comment.content)} />
            </div>
          )}

          {/* 댓글 미니 투표 */}
          {comment.poll && <CommentPollUI poll={comment.poll} />}

          {/* 리액션 바 (호버 시 나타남) */}
          <div className="mt-0.5 flex items-center gap-1">
            <button
              type="button"
              onClick={() => onReact("like")}
              disabled={reacting}
              aria-pressed={myReaction === "like"}
              className={[
                "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] transition",
                "disabled:cursor-not-allowed disabled:opacity-60",
                myReaction === "like"
                  ? "bg-[#39FF14]/15 text-[#39FF14]"
                  : likeCount > 0
                    ? "text-zinc-500 hover:bg-white/5 hover:text-zinc-300"
                    : "text-zinc-700 opacity-0 group-hover:opacity-100 hover:bg-white/5 hover:text-zinc-400",
              ].join(" ")}
            >
              <ThumbsUp className="size-3" />
              {likeCount > 0 && <span>{likeCount}</span>}
            </button>

            {onReply && !isClosed && (
              <button type="button" onClick={onReply} className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-zinc-700 opacity-0 transition group-hover:opacity-100 hover:bg-white/5 hover:text-zinc-400">
                <CornerDownRight className="size-3" /> 답글
              </button>
            )}

            {onReport && (
              <button type="button" onClick={onReport} className="rounded px-1 py-0.5 text-zinc-700 opacity-0 transition group-hover:opacity-100 hover:bg-white/5 hover:text-zinc-400">
                <Flag className="size-3" />
              </button>
            )}
          </div>
        </div>

        {/* 호버 시 우상단 액션 (수정/삭제/고정) */}
        <div className="absolute top-1 right-2 hidden items-center gap-0.5 rounded-md border border-white/[0.06] bg-zinc-900/90 px-1 py-0.5 shadow-lg group-hover:flex">
          {isOwn && !isClosed && !isEditing && (
            <>
              <button type="button" onClick={onStartEdit} className="rounded p-1 text-zinc-500 transition hover:bg-white/10 hover:text-zinc-300" title="수정">
                <Pencil className="size-3" />
              </button>
              <button type="button" onClick={onDelete} className="rounded p-1 text-zinc-500 transition hover:bg-red-400/10 hover:text-red-300" title="삭제">
                <Trash2 className="size-3" />
              </button>
            </>
          )}
          {canPin && !isClosed && (
            <button type="button" onClick={onTogglePin} className={`rounded p-1 transition ${comment.isPinned ? "text-yellow-300 hover:text-yellow-100" : "text-zinc-500 hover:bg-white/10 hover:text-zinc-300"}`} title={comment.isPinned ? "고정 해제" : "댓글 고정"}>
              <Pin className="size-3" />
            </button>
          )}
        </div>
      </div>
    )
  }

  /* ── 찬반 토론: 기존 카드 레이아웃 ── */
  const bubble =
    tone === "pro"
      ? "border-[#00FFD1]/30 bg-[#00FFD1]/10 shadow-[0_0_28px_rgba(0,255,209,0.18)]"
      : "border-[#FF00FF]/30 bg-[#FF00FF]/10 shadow-[0_0_28px_rgba(255,0,255,0.18)]"
  const badge =
    tone === "pro"
      ? "text-[#00FFD1] bg-[#00FFD1]/10 border-[#00FFD1]/20"
      : "text-[#FF00FF] bg-[#FF00FF]/10 border-[#FF00FF]/20"
  const label =
    tone === "pro" ? "찬성" : "반대"

  return (
    <div className={`rounded-2xl border p-5 ${bubble}`}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className={[
              "grid size-10 place-items-center rounded-full text-xs font-bold text-black",
              tone === "pro"
                ? "bg-gradient-to-br from-[#00FFD1] via-[#00FFD1]/80 to-[#00FFD1]/60 shadow-[0_0_14px_rgba(0,255,209,0.35)]"
                : "bg-gradient-to-br from-[#FF00FF] via-[#FF00FF]/80 to-[#FF00FF]/60 shadow-[0_0_14px_rgba(255,0,255,0.35)]",
            ].join(" ")}
          >
            {comment.displayName.slice(0, 2)}
          </div>
          <div className="flex flex-col">
            {comment.userId ? (
              <Link
                href={`/profile/${comment.userId}`}
                className="text-sm font-semibold text-zinc-100 transition-colors hover:text-cyan-200"
                onClick={(e) => e.stopPropagation()}
              >
                {comment.displayName}
              </Link>
            ) : (
              <span className="text-sm font-semibold text-zinc-100">
                {comment.displayName}
              </span>
            )}
            <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
              {comment.customTitle && (
                <UserTitleBadge titleKey={comment.customTitle} />
              )}
              {featuredBadges?.map((fb) => (
                <span
                  key={fb.key}
                  className={`featured-badge-glow inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[9px] font-semibold ${fb.borderClass} ${fb.bgClass} ${fb.textClass}`}
                  title={fb.name}
                >
                  {fb.icon}
                </span>
              ))}
              {comment.isPinned && (
                <span className="inline-flex items-center gap-0.5 rounded-full border border-yellow-400/30 bg-yellow-400/10 px-1.5 py-0.5 text-[10px] font-semibold text-yellow-200 pin-pulse">
                  <Pin className="size-2.5" />
                  고정
                </span>
              )}
              {sentiment && (
                <span className={`sentiment-badge inline-flex items-center rounded-full border px-1.5 py-0.5 text-[9px] font-semibold ${
                  sentiment === "공격적" ? "border-red-400/30 bg-red-400/10 text-red-300" :
                  sentiment === "논리적" ? "border-cyan-400/30 bg-cyan-400/10 text-cyan-300" :
                  sentiment === "감성적" ? "border-pink-400/30 bg-pink-400/10 text-pink-300" :
                  sentiment === "유머" ? "border-yellow-400/30 bg-yellow-400/10 text-yellow-300" :
                  "border-zinc-400/30 bg-zinc-400/10 text-zinc-400"
                }`}>
                  {sentiment}
                </span>
              )}
              {comment.updatedAt && (
                <span className="text-[10px] text-zinc-500">(수정됨)</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* 핀 토글 (스레드 작성자만) */}
          {canPin && !isClosed && (
            <button
              type="button"
              onClick={onTogglePin}
              className={`rounded-full p-1 transition ${
                comment.isPinned
                  ? "text-yellow-300 hover:text-yellow-100"
                  : "text-zinc-500 hover:bg-white/10 hover:text-zinc-300"
              }`}
              title={comment.isPinned ? "고정 해제" : "댓글 고정"}
            >
              <Pin className="size-3" />
            </button>
          )}
          {/* 수정/삭제 버튼 (본인 + 마감 안됨 + 삭제 안됨) */}
          {isOwn && !isClosed && !isEditing && (
            <>
              <button
                type="button"
                onClick={onStartEdit}
                className="rounded-full p-1 text-zinc-500 transition hover:bg-white/10 hover:text-zinc-300"
                title="수정"
              >
                <Pencil className="size-3" />
              </button>
              <button
                type="button"
                onClick={onDelete}
                className="rounded-full p-1 text-zinc-500 transition hover:bg-red-400/10 hover:text-red-300"
                title="삭제"
              >
                <Trash2 className="size-3" />
              </button>
            </>
          )}
          <span className="text-[11px] text-zinc-400" suppressHydrationWarning>
            {showTime ? formatDateTime(comment.created_at) : ""}
          </span>
        </div>
      </div>

      {/* 수정 모드 */}
      {isEditing ? (
        <div className="space-y-2">
          <textarea
            value={editContent ?? ""}
            onChange={(e) => onChangeEdit?.(e.target.value)}
            rows={3}
            maxLength={500}
            className="w-full resize-none rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-zinc-100 outline-none"
          />
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onCancelEdit}
              className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-zinc-400 transition hover:bg-white/10"
            >
              <X className="size-3" />
              취소
            </button>
            <button
              type="button"
              onClick={onSaveEdit}
              className="inline-flex items-center gap-1 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-2.5 py-1 text-[11px] font-medium text-cyan-200 transition hover:bg-cyan-400/20"
            >
              <Check className="size-3" />
              저장
            </button>
          </div>
        </div>
      ) : (
        <MarkdownContent content={preprocessMentions(comment.content)} />
      )}

      {/* 팩트체크 배지 */}
      {factCheck && (
        <div className={`mt-2 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold ${
          factCheck.verdict === "확인됨" ? "border-emerald-400/40 bg-emerald-400/15 text-emerald-200" :
          factCheck.verdict === "의심" ? "border-amber-400/40 bg-amber-400/15 text-amber-200" :
          factCheck.verdict === "거짓" ? "border-red-400/40 bg-red-400/15 text-red-200" :
          "border-zinc-400/40 bg-zinc-400/15 text-zinc-300"
        }`} title={factCheck.explanation}>
          <ScanSearch className="size-3" />
          팩트체크: {factCheck.verdict}
        </div>
      )}

      {/* 댓글 미니 투표 */}
      {comment.poll && <CommentPollUI poll={comment.poll} />}

      {/* 리액션 버튼 */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {/* 👍 좋아요 */}
        <button
          type="button"
          onClick={() => onReact("like")}
          disabled={reacting}
          aria-pressed={myReaction === "like"}
          className={[
            "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition",
            "disabled:cursor-not-allowed disabled:opacity-60",
            myReaction === "like"
              ? "border-cyan-400/40 bg-cyan-400/15 text-cyan-100 shadow-[0_0_16px_rgba(34,211,238,0.18)]"
              : "border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10",
          ].join(" ")}
        >
          <ThumbsUp className="size-3.5" />
          {likeCount}
        </button>

        {/* 답글 */}
        {onReply && !isClosed && (
          <button
            type="button"
            onClick={onReply}
            className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-zinc-400 transition hover:bg-white/10 hover:text-zinc-200"
          >
            <CornerDownRight className="size-3" />
            답글
          </button>
        )}

        {/* 팩트체크 */}
        {onFactCheck && !factCheck && !isClosed && (
          <button
            type="button"
            onClick={onFactCheck}
            disabled={factChecking}
            className="inline-flex items-center gap-1 rounded-full border border-violet-400/30 bg-violet-400/10 px-2.5 py-1 text-[11px] font-medium text-violet-200 transition hover:bg-violet-400/20 disabled:opacity-60"
          >
            <ScanSearch className="size-3" />
            {factChecking ? "체크 중…" : "팩트체크"}
          </button>
        )}

        {/* 코칭 */}
        {onCoach && !coaching && !isClosed && (
          <button
            type="button"
            onClick={onCoach}
            disabled={coaching_loading}
            className="inline-flex items-center gap-1 rounded-full border border-teal-400/30 bg-teal-400/10 px-2.5 py-1 text-[11px] font-medium text-teal-200 transition hover:bg-teal-400/20 disabled:opacity-60"
          >
            <GraduationCap className="size-3" />
            {coaching_loading ? "분석 중…" : "AI 코칭"}
          </button>
        )}

        {/* 신고 */}
        {onReport && (
          <button
            type="button"
            onClick={onReport}
            className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-zinc-500 transition hover:bg-white/10 hover:text-zinc-300"
          >
            <Flag className="size-3" />
          </button>
        )}
      </div>

      {/* 코칭 결과 패널 */}
      {coaching && <CoachingPanel result={coaching} />}
    </div>
  )
}

function ColumnHeader({
  title,
  side,
  count,
  onCompose,
}: {
  title: string
  side: Side
  count: number
  onCompose: () => void
}) {
  const tone =
    side === "pro"
      ? {
          ring: "ring-[#00FFD1]/25",
          border: "border-[#00FFD1]/20",
          bg: "bg-[#00FFD1]/10",
          text: "text-[#00FFD1]",
          plus:
            "border-[#00FFD1]/30 bg-[#00FFD1]/10 text-[#00FFD1] hover:bg-[#00FFD1]/20",
        }
      : {
          ring: "ring-[#FF00FF]/25",
          border: "border-[#FF00FF]/20",
          bg: "bg-[#FF00FF]/10",
          text: "text-[#FF00FF]",
          plus:
            "border-[#FF00FF]/30 bg-[#FF00FF]/10 text-[#FF00FF] hover:bg-[#FF00FF]/20",
        }

  return (
    <div
      className={`flex items-center justify-between rounded-2xl border ${tone.border} ${tone.bg} px-4 py-3 ring-1 ${tone.ring}`}
    >
      <div className="flex items-center gap-2">
        <div className={`text-sm font-semibold ${tone.text}`}>{title}</div>
        <span className="rounded-full border border-white/10 bg-black/30 px-2 py-0.5 text-[11px] text-zinc-300">
          {count}
        </span>
      </div>
      <Button
        type="button"
        size="icon-sm"
        variant="outline"
        onClick={onCompose}
        className={tone.plus}
        aria-label={`${title} 댓글 작성`}
      >
        <Plus className="size-4" />
      </Button>
    </div>
  )
}

export function BattleComments({
  threadId,
  comments,
  isClosed,
  threadCreatedBy,
  template,
  proCount: votePro = 0,
  conCount: voteCon = 0,
  hasMoreComments: initialHasMore = false,
  nextCursor: initialCursor = null,
}: {
  threadId: string
  comments: BattleComment[]
  isClosed?: boolean
  threadCreatedBy?: string
  template?: string
  proCount?: number
  conCount?: number
  hasMoreComments?: boolean
  nextCursor?: { created_at: string; id: string } | null
}) {
  const { user, loading } = useAuth()
  const { showToast } = useToast()
  const { profile, awardXp } = useProfile()
  const { blockedIds } = useBlocks()
  const { confirm } = useConfirm()

  const [open, setOpen] = useState<Side | null>(null)
  const [mobileTab, setMobileTab] = useState<Side>("pro")
  const [mounted, setMounted] = useState(false)
  const [reactingId, setReactingId] = useState<string | null>(null)
  const [sortMode, setSortMode] = useState<SortMode>("recent")
  const [replyingTo, setReplyingTo] = useState<string | null>(null)

  // 댓글 수정/삭제
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState("")

  // 신고 모달
  const [reportTarget, setReportTarget] = useState<{
    targetType: "comment" | "thread" | "user"
    targetId: string
    targetUserId?: string
  } | null>(null)

  // 팩트체크
  const [factChecks, setFactChecks] = useState<Record<string, FactCheck>>({})
  const [factCheckingId, setFactCheckingId] = useState<string | null>(null)

  // 코칭
  const [coachResults, setCoachResults] = useState<Record<string, CoachingResult>>({})
  const [coachingId, setCoachingId] = useState<string | null>(null)

  // 감성 분석
  const [sentiments, setSentiments] = useState<Record<string, string>>({})

  // 특별 뱃지 (논리왕/아고라의 별)
  const [userFeaturedBadges, setUserFeaturedBadges] = useState<Record<string, FeaturedBadgeDef[]>>({})

  // 페이지네이션
  const [hasMore, setHasMore] = useState(initialHasMore)
  const [cursor, setCursor] = useState<{ created_at: string; id: string } | null>(initialCursor)
  const [loadingMore, setLoadingMore] = useState(false)

  const [counts, setCounts] = useState<
    Record<string, { like: number; dislike: number; fire: number }>
  >({})
  const [my, setMy] = useState<Record<string, Reaction | null>>({})
  const pendingReactions = useRef<Set<string>>(new Set())
  const [localComments, setLocalComments] = useState<BattleComment[]>(comments)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    setLocalComments(comments)
  }, [comments])

  // 페이지네이션 props 동기화
  useEffect(() => {
    setHasMore(initialHasMore)
    setCursor(initialCursor)
  }, [initialHasMore, initialCursor])

  // 특별 뱃지 로드
  useEffect(() => {
    const userIds = [...new Set(comments.map((c) => c.userId).filter(Boolean))]
    if (userIds.length === 0) return
    let cancelled = false
    ;(async () => {
      const { data } = await supabase
        .from("user_achievements")
        .select("user_id, achievement_key")
        .in("user_id", userIds)
        .in("achievement_key", ["logic_king", "agora_star"])
      if (cancelled || !data) return
      const map: Record<string, FeaturedBadgeDef[]> = {}
      for (const row of data as { user_id: string; achievement_key: string }[]) {
        const badge = getFeaturedBadge(row.achievement_key)
        if (badge) {
          if (!map[row.user_id]) map[row.user_id] = []
          map[row.user_id].push(badge)
        }
      }
      setUserFeaturedBadges(map)
    })()
    return () => { cancelled = true }
  }, [comments])

  // 초기 카운트 동기화
  useEffect(() => {
    const next: Record<string, { like: number; dislike: number; fire: number }> = {}
    for (const c of comments) {
      next[c.id] = {
        like: Number.isFinite(c.likeCount) ? c.likeCount : 0,
        dislike: Number.isFinite(c.dislikeCount) ? c.dislikeCount : 0,
        fire: Number.isFinite(c.fireCount) ? c.fireCount : 0,
      }
    }
    setCounts(next)
  }, [comments])

  // ── 더 보기 (페이지네이션) ──
  const loadMore = useCallback(async () => {
    if (!cursor || loadingMore || !hasMore) return
    setLoadingMore(true)

    // 다음 20개 top-level 댓글
    const { data: nextTopLevel } = await supabase
      .from("comments")
      .select("id, content, created_at, user_id, side, parent_id, updated_at, is_deleted, is_pinned")
      .eq("thread_id", threadId)
      .is("parent_id", null)
      .lt("created_at", cursor.created_at)
      .order("created_at", { ascending: false })
      .limit(20)

    if (!nextTopLevel || nextTopLevel.length === 0) {
      setHasMore(false)
      setLoadingMore(false)
      return
    }

    const newTopLevelIds = nextTopLevel
      .map((c) => String((c as Record<string, unknown>).id ?? ""))
      .filter(Boolean)

    // replies 로드
    let newReplies: typeof nextTopLevel = []
    if (newTopLevelIds.length > 0) {
      const { data: replies } = await supabase
        .from("comments")
        .select("id, content, created_at, user_id, side, parent_id, updated_at, is_deleted, is_pinned")
        .eq("thread_id", threadId)
        .in("parent_id", newTopLevelIds)
        .order("created_at", { ascending: true })
      newReplies = replies ?? []
    }

    const allNewComments = [...nextTopLevel, ...newReplies]
    const allNewIds = allNewComments
      .map((c) => String((c as Record<string, unknown>).id ?? ""))
      .filter(Boolean)

    // 프로필 로드
    const userIds = [...new Set(
      allNewComments
        .map((c) => String((c as Record<string, unknown>).user_id ?? ""))
        .filter(Boolean)
    )]
    const profileMap: Record<string, { display_name: string | null; custom_title: string | null }> = {}
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, display_name, custom_title")
        .in("id", userIds)
      for (const p of profiles ?? []) {
        const pr = p as Record<string, unknown>
        profileMap[String(pr.id ?? "")] = {
          display_name: typeof pr.display_name === "string" ? pr.display_name : null,
          custom_title: typeof pr.custom_title === "string" ? pr.custom_title : null,
        }
      }
    }

    // 리액션 카운트 로드
    const newReactionCounts: Record<string, { like: number; dislike: number; fire: number }> = {}
    if (allNewIds.length > 0) {
      const { data: reactions } = await supabase
        .from("comment_reactions")
        .select("comment_id, reaction")
        .in("comment_id", allNewIds)

      for (const r of reactions ?? []) {
        const row = r as Record<string, unknown>
        const cid = String(row.comment_id ?? "")
        if (!cid) continue
        const cur = newReactionCounts[cid] ?? { like: 0, dislike: 0, fire: 0 }
        if (row.reaction === "like") cur.like += 1
        if (row.reaction === "dislike") cur.dislike += 1
        if (row.reaction === "fire") cur.fire += 1
        newReactionCounts[cid] = cur
      }
    }

    // BattleComment 변환
    const { getDisplayName } = await import("@/lib/utils")
    const newCommentDtos: BattleComment[] = allNewComments.map((c, idx) => {
      const row = c as Record<string, unknown>
      const cid = String(row.id ?? `new-${idx}`)
      const uid = String(row.user_id ?? "")
      const profile = profileMap[uid]
      const rawParentId = row.parent_id
      const parentId = typeof rawParentId === "string" && (rawParentId as string).trim().length > 0
        ? rawParentId as string : null

      return {
        id: cid,
        content: String(row.content ?? ""),
        created_at: typeof row.created_at === "string" ? row.created_at : null,
        side: row.side === "pro" ? "pro" as const : row.side === "con" ? "con" as const : null,
        userId: uid,
        parentId,
        displayName: getDisplayName({ id: uid, display_name: profile?.display_name }),
        likeCount: newReactionCounts[cid]?.like ?? 0,
        dislikeCount: newReactionCounts[cid]?.dislike ?? 0,
        fireCount: newReactionCounts[cid]?.fire ?? 0,
        updatedAt: typeof row.updated_at === "string" ? row.updated_at : null,
        isDeleted: row.is_deleted === true,
        isPinned: row.is_pinned === true,
        customTitle: profile?.custom_title ?? null,
        poll: null,
      }
    })

    // 중복 제거 후 append
    setLocalComments((prev) => {
      const existingIds = new Set(prev.map((c) => c.id))
      const unique = newCommentDtos.filter((c) => !existingIds.has(c.id))
      return [...prev, ...unique]
    })

    // counts merge
    setCounts((prev) => {
      const merged = { ...prev }
      for (const [cid, val] of Object.entries(newReactionCounts)) {
        merged[cid] = val
      }
      // 리액션이 없는 새 댓글도 초기화
      for (const dto of newCommentDtos) {
        if (!merged[dto.id]) {
          merged[dto.id] = { like: dto.likeCount, dislike: dto.dislikeCount, fire: dto.fireCount }
        }
      }
      return merged
    })

    // 커서 갱신
    const lastNew = nextTopLevel[nextTopLevel.length - 1] as Record<string, unknown>
    if (nextTopLevel.length < 20) {
      setHasMore(false)
      setCursor(null)
    } else {
      setCursor({
        created_at: String(lastNew.created_at ?? ""),
        id: String(lastNew.id ?? ""),
      })
    }

    setLoadingMore(false)
  }, [cursor, loadingMore, hasMore, threadId])

  // 내 리액션 로드
  useEffect(() => {
    if (!mounted) return
    if (!user || loading) {
      setMy({})
      return
    }
    const ids = comments.map((c) => c.id).filter(Boolean)
    if (ids.length === 0) return

    let cancelled = false
    ;(async () => {
      const { data, error } = await supabase
        .from("comment_reactions")
        .select("comment_id, reaction")
        .eq("user_id", user.id)
        .in("comment_id", ids)

      if (cancelled) return
      if (error) return

      const next: Record<string, Reaction | null> = {}
      for (const row of data ?? []) {
        const r = row as Record<string, unknown>
        const cid = String(r.comment_id ?? "")
        const reaction =
          r.reaction === "like" || r.reaction === "dislike" || r.reaction === "fire"
            ? (r.reaction as Reaction)
            : null
        if (cid) next[cid] = reaction
      }
      setMy(next)
    })()

    return () => {
      cancelled = true
    }
  }, [mounted, user?.id, loading, comments])

  // 팩트체크 로드
  useEffect(() => {
    const ids = localComments.map((c) => c.id).filter(Boolean)
    if (ids.length === 0) return
    let cancelled = false
    ;(async () => {
      const { data, error } = await supabase
        .from("fact_checks")
        .select("comment_id, verdict, explanation")
        .in("comment_id", ids)
      if (cancelled || error) return
      const map: Record<string, FactCheck> = {}
      for (const row of data ?? []) {
        const r = row as Record<string, unknown>
        const cid = String(r.comment_id ?? "")
        if (cid) {
          map[cid] = {
            verdict: r.verdict as FactCheck["verdict"],
            explanation: String(r.explanation ?? ""),
          }
        }
      }
      setFactChecks(map)
    })()
    return () => { cancelled = true }
  }, [localComments.length])

  // 팩트체크 실시간 구독
  useEffect(() => {
    const channel = supabase
      .channel(`fact-checks-rt-${threadId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "fact_checks" },
        (payload) => {
          const row = payload.new as Record<string, unknown>
          const cid = String(row.comment_id ?? "")
          if (!cid) return
          setFactChecks((prev) => ({
            ...prev,
            [cid]: {
              verdict: row.verdict as FactCheck["verdict"],
              explanation: String(row.explanation ?? ""),
            },
          }))
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [threadId])

  const handleFactCheck = useCallback(async (commentId: string) => {
    if (!user) {
      showToast("로그인이 필요합니다.", "info")
      return
    }
    if ((profile?.xp ?? 0) < 50) {
      showToast("50 XP 이상 필요합니다.", "info")
      return
    }
    if (factChecks[commentId]) return

    setFactCheckingId(commentId)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) {
      showToast("인증 세션이 만료되었습니다.", "error")
      setFactCheckingId(null)
      return
    }

    const res = await fetch("/api/fact-check", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ commentId }),
    })

    if (!res.ok) {
      const json = await res.json().catch(() => ({})) as { error?: string }
      showToast(json.error ?? "팩트체크에 실패했습니다.", "error")
      setFactCheckingId(null)
      return
    }

    const data = await res.json() as FactCheck
    setFactChecks((prev) => ({ ...prev, [commentId]: data }))
    awardXp("fact_check")
    showToast("팩트체크가 완료되었습니다!", "success")
    setFactCheckingId(null)
  }, [user, profile?.xp, factChecks, showToast, awardXp])

  // 코칭 데이터 로드
  useEffect(() => {
    const ids = localComments.map((c) => c.id).filter(Boolean)
    if (ids.length === 0) return
    let cancelled = false
    ;(async () => {
      const { data, error } = await supabase
        .from("comment_coaching")
        .select("comment_id, scores, strengths, improvements")
        .in("comment_id", ids)
      if (cancelled || error) return
      const map: Record<string, CoachingResult> = {}
      for (const row of data ?? []) {
        const r = row as Record<string, unknown>
        const cid = String(r.comment_id ?? "")
        if (cid) {
          map[cid] = {
            scores: r.scores as CoachingResult["scores"],
            strengths: r.strengths as string[],
            improvements: r.improvements as string[],
          }
        }
      }
      setCoachResults(map)
    })()
    return () => { cancelled = true }
  }, [localComments.length])

  // 감성 데이터 로드
  useEffect(() => {
    const ids = localComments.map((c) => c.id).filter(Boolean)
    if (ids.length === 0) return
    let cancelled = false
    ;(async () => {
      const { data, error } = await supabase
        .from("comment_sentiments")
        .select("comment_id, tone")
        .in("comment_id", ids)
      if (cancelled || error) return
      const map: Record<string, string> = {}
      for (const row of data ?? []) {
        const r = row as Record<string, unknown>
        const cid = String(r.comment_id ?? "")
        if (cid) map[cid] = String(r.tone ?? "")
      }
      setSentiments(map)
    })()
    return () => { cancelled = true }
  }, [localComments.length])

  // 미분석 댓글 자동 감성 분석 트리거
  const sentimentTriggeredRef = useRef<Set<string>>(new Set())
  useEffect(() => {
    if (!user) return
    const unanalyzed = localComments
      .filter((c) => !c.isDeleted && c.content && !sentiments[c.id] && !sentimentTriggeredRef.current.has(c.id))
      .map((c) => c.id)
      .slice(0, 20)

    if (unanalyzed.length === 0) return

    // 중복 트리거 방지: 요청 보낸 ID를 기록
    for (const id of unanalyzed) sentimentTriggeredRef.current.add(id)

    ;(async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) return

      fetch("/api/sentiment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ commentIds: unanalyzed }),
      }).catch(() => {})
    })()
  }, [user, localComments.length])

  // 감성 분석 실시간 구독
  useEffect(() => {
    const channel = supabase
      .channel(`sentiments-rt-${threadId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "comment_sentiments" },
        (payload) => {
          const row = payload.new as Record<string, unknown>
          const cid = String(row.comment_id ?? "")
          if (!cid) return
          setSentiments((prev) => ({ ...prev, [cid]: String(row.tone ?? "") }))
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [threadId])

  // 코칭 실시간 구독
  useEffect(() => {
    const channel = supabase
      .channel(`coaching-rt-${threadId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "comment_coaching" },
        (payload) => {
          const row = payload.new as Record<string, unknown>
          const cid = String(row.comment_id ?? "")
          if (!cid) return
          setCoachResults((prev) => ({
            ...prev,
            [cid]: {
              scores: row.scores as CoachingResult["scores"],
              strengths: row.strengths as string[],
              improvements: row.improvements as string[],
            },
          }))
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [threadId])

  const handleCoach = useCallback(async (commentId: string) => {
    if (!user) {
      showToast("로그인이 필요합니다.", "info")
      return
    }
    if ((profile?.xp ?? 0) < 30) {
      showToast("30 XP 이상 필요합니다.", "info")
      return
    }
    if (coachResults[commentId]) return

    setCoachingId(commentId)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) {
      showToast("인증 세션이 만료되었습니다.", "error")
      setCoachingId(null)
      return
    }

    const res = await fetch("/api/coach", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ commentId }),
    })

    if (!res.ok) {
      const json = await res.json().catch(() => ({})) as { error?: string }
      showToast(json.error ?? "코칭에 실패했습니다.", "error")
      setCoachingId(null)
      return
    }

    const data = await res.json() as CoachingResult
    setCoachResults((prev) => ({ ...prev, [commentId]: data }))
    awardXp("coaching")
    showToast("AI 코칭이 완료되었습니다!", "success")
    setCoachingId(null)
  }, [user, profile?.xp, coachResults, showToast, awardXp])

  const handleStartEdit = useCallback((commentId: string, currentContent: string) => {
    setEditingId(commentId)
    setEditContent(currentContent)
  }, [])

  const handleCancelEdit = useCallback(() => {
    setEditingId(null)
    setEditContent("")
  }, [])

  const handleSaveEdit = useCallback(async (commentId: string) => {
    if (!user) return
    const trimmed = editContent.trim()
    if (!trimmed) return

    // 낙관적 업데이트
    const prevComments = localComments
    setLocalComments((prev) =>
      prev.map((c) =>
        c.id === commentId
          ? { ...c, content: trimmed, updatedAt: new Date().toISOString() }
          : c
      )
    )
    setEditingId(null)
    setEditContent("")

    const { error } = await supabase
      .from("comments")
      .update({ content: trimmed, updated_at: new Date().toISOString() })
      .eq("id", commentId)
      .eq("user_id", user.id)

    if (error) {
      setLocalComments(prevComments) // 롤백
      showToast("댓글 수정에 실패했습니다.", "error")
    }
  }, [user, editContent, localComments, showToast])

  const handleTogglePin = useCallback(async (commentId: string, pin: boolean) => {
    if (!user) return

    // 낙관적 업데이트
    const prevComments = localComments
    setLocalComments((prev) => {
      // pin=true → 기존 핀 해제 + 새 핀
      if (pin) {
        return prev.map((c) =>
          c.id === commentId
            ? { ...c, isPinned: true }
            : { ...c, isPinned: false }
        )
      }
      return prev.map((c) =>
        c.id === commentId ? { ...c, isPinned: false } : c
      )
    })

    if (pin) {
      // 기존 핀 해제
      await supabase
        .from("comments")
        .update({ is_pinned: false })
        .eq("thread_id", threadId)
        .eq("is_pinned", true)
    }

    const { error } = await supabase
      .from("comments")
      .update({ is_pinned: pin })
      .eq("id", commentId)

    if (error) {
      setLocalComments(prevComments)
      showToast("댓글 고정에 실패했습니다.", "error")
    }
  }, [user, localComments, threadId, showToast])

  const handleDelete = useCallback(async (commentId: string) => {
    if (!user) return
    const ok = await confirm({
      title: "댓글 삭제",
      message: "정말 이 댓글을 삭제하시겠습니까?",
      confirmText: "삭제",
      variant: "danger",
    })
    if (!ok) return

    // 낙관적 업데이트
    const prevComments = localComments
    setLocalComments((prev) =>
      prev.map((c) =>
        c.id === commentId ? { ...c, isDeleted: true, content: "" } : c
      )
    )

    const { error } = await supabase
      .from("comments")
      .update({ is_deleted: true, content: "", updated_at: new Date().toISOString() })
      .eq("id", commentId)
      .eq("user_id", user.id)

    if (error) {
      setLocalComments(prevComments) // 롤백
      showToast("댓글 삭제에 실패했습니다.", "error")
    }
  }, [user, localComments, showToast])

  // 오토스크롤용 ref
  const chatEndRef = useRef<HTMLDivElement>(null)

  const { pro, con, all, replyMap } = useMemo(() => {
    const pro: BattleComment[] = []
    const con: BattleComment[] = []
    const all: BattleComment[] = []
    const replyMap: Record<string, BattleComment[]> = {}

    for (const c of localComments) {
      if (c.parentId) {
        const parentKey = c.parentId
        if (!replyMap[parentKey]) replyMap[parentKey] = []
        replyMap[parentKey].push(c)
      } else if (!c.isDeleted) {
        if (c.side === "pro") pro.push(c)
        else if (c.side === "con") con.push(c)
        all.push(c)
      } else if (template === "free") {
        // 자유 토론: 삭제 댓글도 all에 포함 (그룹핑용)
        all.push(c)
      }
    }

    // Sort replies by time ascending
    for (const key of Object.keys(replyMap)) {
      replyMap[key].sort((a, b) => {
        const ta = a.created_at ? new Date(a.created_at).getTime() : 0
        const tb = b.created_at ? new Date(b.created_at).getTime() : 0
        return ta - tb
      })
    }

    function sortComments(list: BattleComment[]) {
      if (sortMode === "liked") {
        return [...list].sort(
          (a, b) =>
            (counts[b.id]?.like ?? b.likeCount) -
            (counts[a.id]?.like ?? a.likeCount)
        )
      }
      return [...list].sort((a, b) => {
        const ta = a.created_at ? new Date(a.created_at).getTime() : 0
        const tb = b.created_at ? new Date(b.created_at).getTime() : 0
        return tb - ta
      })
    }

    // Free 토론: 메시지 그룹핑 (연속 같은 유저, 5분 이내 → _isGrouped)
    const sortedAll = sortComments(all)
    // 표시 순서(sortedAll) 기준으로 그룹핑 — 바로 위 메시지가 같은 유저면 아바타 숨김
    if (template === "free") {
      for (let i = 0; i < sortedAll.length; i++) {
        ;(sortedAll[i] as BattleComment & { _isGrouped?: boolean })._isGrouped = false
      }
      for (let i = 1; i < sortedAll.length; i++) {
        const cur = sortedAll[i]
        const prev = sortedAll[i - 1]
        if (prev && !prev.isDeleted && !cur.isDeleted && prev.userId === cur.userId) {
          const tCur = cur.created_at ? new Date(cur.created_at).getTime() : 0
          const tPrev = prev.created_at ? new Date(prev.created_at).getTime() : 0
          if (Math.abs(tCur - tPrev) < 5 * 60 * 1000) {
            ;(cur as BattleComment & { _isGrouped?: boolean })._isGrouped = true
          }
        }
      }
    }

    return { pro: sortComments(pro), con: sortComments(con), all: sortedAll, replyMap }
  }, [localComments, sortMode, counts, template])

  // Free 토론: 새 댓글 추가 시 오토스크롤
  useEffect(() => {
    if (template === "free") {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }
  }, [localComments.length, template])

  const handleReact = useCallback(async (commentId: string, reaction: Reaction) => {
    if (!user) {
      showToast("VIP 로그인 유저만 리액션을 달 수 있어요.", "info")
      return
    }
    if (reactingId === commentId) return

    const prev = my[commentId] ?? null
    const next: Reaction | null = prev === reaction ? null : reaction

    // 낙관적 업데이트
    pendingReactions.current.add(commentId)
    setReactingId(commentId)
    setMy((cur) => ({ ...cur, [commentId]: next }))
    setCounts((cur) => {
      const base = cur[commentId] ?? { like: 0, dislike: 0, fire: 0 }
      let like = base.like
      let dislike = base.dislike
      let fire = base.fire

      if (prev === "like") like = Math.max(0, like - 1)
      if (prev === "dislike") dislike = Math.max(0, dislike - 1)
      if (prev === "fire") fire = Math.max(0, fire - 1)
      if (next === "like") like += 1
      if (next === "dislike") dislike += 1
      if (next === "fire") fire += 1

      return { ...cur, [commentId]: { like, dislike, fire } }
    })

    const rollback = () => {
      setMy((cur) => ({ ...cur, [commentId]: prev }))
      setCounts((cur) => {
        const base = cur[commentId] ?? { like: 0, dislike: 0, fire: 0 }
        let like = base.like
        let dislike = base.dislike
        let fire = base.fire
        if (next === "like") like = Math.max(0, like - 1)
        if (next === "dislike") dislike = Math.max(0, dislike - 1)
        if (next === "fire") fire = Math.max(0, fire - 1)
        if (prev === "like") like += 1
        if (prev === "dislike") dislike += 1
        if (prev === "fire") fire += 1
        return { ...cur, [commentId]: { like, dislike, fire } }
      })
    }

    const { error: delErr } = await supabase
      .from("comment_reactions")
      .delete()
      .match({ comment_id: commentId, user_id: user.id })

    if (delErr) {
      rollback()
      setTimeout(() => pendingReactions.current.delete(commentId), 500)
      setReactingId(null)
      showToast("리액션 저장에 실패했어요. (테이블/RLS 확인)", "error")
      return
    }

    if (next) {
      const { error: insErr } = await supabase.from("comment_reactions").insert({
        comment_id: commentId,
        user_id: user.id,
        reaction: next,
      })
      if (insErr) {
        rollback()
        setTimeout(() => pendingReactions.current.delete(commentId), 500)
        setReactingId(null)
        showToast("리액션 저장에 실패했어요. (테이블/RLS 확인)", "error")
        return
      }
    }

    setTimeout(() => pendingReactions.current.delete(commentId), 500)
    setReactingId(null)
  }, [user, reactingId, my, showToast])

  // 실시간 댓글 구독 (INSERT + UPDATE)
  useEffect(() => {
    const channel = supabase
      .channel(`comments-rt-${threadId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "comments",
          filter: `thread_id=eq.${threadId}`,
        },
        async (payload) => {
          const row = payload.new as Record<string, unknown>
          const cid = String(row.id ?? "")
          if (!cid) return

          const userIdRaw = row.user_id
          const idStr =
            typeof userIdRaw === "string" ? userIdRaw : String(userIdRaw ?? "")

          // 프로필에서 실제 닉네임 조회
          let displayName = "익명"
          if (idStr) {
            const { data: prof } = await supabase
              .from("profiles")
              .select("display_name")
              .eq("id", idStr)
              .maybeSingle()
            const dn = (prof as Record<string, unknown> | null)?.display_name
            if (typeof dn === "string" && dn.trim()) {
              displayName = dn
            } else {
              const short = idStr.replace(/-/g, "").slice(0, 5)
              displayName = short ? `유저 ${short}` : "익명"
            }
          }

          setLocalComments((prev) => {
            if (prev.some((c) => c.id === cid)) return prev
            const createdRaw = row.created_at
            const created =
              typeof createdRaw === "string" && createdRaw.trim().length > 0
                ? createdRaw
                : null
            const side =
              row.side === "pro" ? "pro" : row.side === "con" ? "con" : null
            const rawParentId = row.parent_id
            const parentId = typeof rawParentId === "string" && rawParentId.trim().length > 0
              ? rawParentId : null
            const newComment: BattleComment = {
              id: cid,
              content: String(row.content ?? ""),
              created_at: created,
              side,
              userId: idStr,
              parentId,
              displayName,
              likeCount: 0,
              dislikeCount: 0,
              fireCount: 0,
            }
            return [newComment, ...prev]
          })
          setCounts((prev) => ({ ...prev, [cid]: { like: 0, dislike: 0, fire: 0 } }))
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "comments",
          filter: `thread_id=eq.${threadId}`,
        },
        (payload) => {
          const row = payload.new as Record<string, unknown>
          const cid = String(row.id ?? "")
          if (!cid) return

          setLocalComments((prev) =>
            prev.map((c) => {
              if (c.id !== cid) return c
              return {
                ...c,
                content: String(row.content ?? c.content),
                isDeleted: row.is_deleted === true,
                updatedAt: typeof row.updated_at === "string" ? row.updated_at : c.updatedAt,
              }
            })
          )
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [threadId])

  // 실시간 리액션 구독
  useEffect(() => {
    const channel = supabase
      .channel(`reactions-rt-${threadId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "comment_reactions" },
        (payload) => {
          const row = (
            payload.eventType === "DELETE" ? payload.old : payload.new
          ) as Record<string, unknown>
          const commentId = String(row.comment_id ?? "")
          if (!commentId) return
          if (pendingReactions.current.has(commentId)) return
          const reaction = String(row.reaction ?? "")
          if (reaction !== "like" && reaction !== "dislike" && reaction !== "fire") return

          const delta = payload.eventType === "DELETE" ? -1 : 1
          setCounts((prev) => {
            const base = prev[commentId] ?? { like: 0, dislike: 0, fire: 0 }
            return {
              ...prev,
              [commentId]: {
                like: Math.max(0, base.like + (reaction === "like" ? delta : 0)),
                dislike: Math.max(0, base.dislike + (reaction === "dislike" ? delta : 0)),
                fire: Math.max(0, base.fire + (reaction === "fire" ? delta : 0)),
              },
            }
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [threadId])

  function renderComment(c: BattleComment, tone: "pro" | "con" | "neutral") {
    const replies = replyMap[c.id] ?? []
    const isOwn = user?.id === c.userId
    const canFactCheck = user && (profile?.xp ?? 0) >= 50 && !isOwn
    const isThreadCreator = user?.id === threadCreatedBy
    const canCoach = isOwn && user && (profile?.xp ?? 0) >= 30

    return (
      <div key={c.id}>
        <CommentCard
          comment={c}
          tone={tone}
          showTime={mounted}
          likeCount={counts[c.id]?.like ?? 0}
          myReaction={my[c.id] ?? null}
          reacting={reactingId === c.id}
          onReact={(r) => handleReact(c.id, r)}
          onReply={() => setReplyingTo((cur) => (cur === c.id ? null : c.id))}
          onReport={!isOwn && user ? () => setReportTarget({
            targetType: "comment",
            targetId: c.id,
            targetUserId: c.userId,
          }) : undefined}
          isBlocked={c.userId ? blockedIds.has(c.userId) : false}
          factCheck={template !== "free" ? (factChecks[c.id] ?? null) : null}
          onFactCheck={template !== "free" && canFactCheck ? () => handleFactCheck(c.id) : undefined}
          factChecking={template !== "free" && factCheckingId === c.id}
          isClosed={isClosed}
          isOwn={isOwn}
          editingId={editingId}
          editContent={editingId === c.id ? editContent : undefined}
          onStartEdit={() => handleStartEdit(c.id, c.content)}
          onCancelEdit={handleCancelEdit}
          onSaveEdit={() => handleSaveEdit(c.id)}
          onChangeEdit={setEditContent}
          onDelete={() => handleDelete(c.id)}
          canPin={isThreadCreator}
          onTogglePin={() => handleTogglePin(c.id, !c.isPinned)}
          coaching={null}
          onCoach={undefined}
          coaching_loading={false}
          sentiment={null}
          featuredBadges={c.userId ? userFeaturedBadges[c.userId] ?? [] : []}
        />

        {/* 인라인 답글 작성 */}
        {replyingTo === c.id && !isClosed && (
          <div className={tone === "neutral"
            ? "ml-[52px] mt-0.5 border-l-2 border-zinc-700/50 pl-4 py-1.5"
            : "ml-6 mt-2 rounded-2xl border border-white/10 bg-black/35 p-3 backdrop-blur"
          }>
            <CommentComposer
              threadId={threadId}
              fixedSide={template === "free" ? undefined : (c.side ?? undefined)}
              parentId={c.id}
              onSubmitted={() => setReplyingTo(null)}
              template={template}
            />
          </div>
        )}

        {/* 답글 목록 */}
        {replies.length > 0 && (
          <div className={tone === "neutral"
            ? "ml-[52px] mt-0.5 space-y-0 border-l-2 border-zinc-700/50 pl-0"
            : "ml-6 mt-2 space-y-2 border-l-2 pl-3 border-white/[0.08]"
          }>
            {(() => {
              // neutral 톤: 연속 삭제 답글 그룹핑
              if (tone === "neutral") {
                const els: React.ReactNode[] = []
                let ri = 0
                while (ri < replies.length) {
                  const reply = replies[ri]
                  if (reply.isDeleted || (reply.userId && blockedIds.has(reply.userId))) {
                    let delCount = 0
                    const startRi = ri
                    while (ri < replies.length && (replies[ri].isDeleted || (replies[ri].userId && blockedIds.has(replies[ri].userId!)))) {
                      delCount++
                      ri++
                    }
                    els.push(
                      <div key={`rdel-${startRi}`} className="py-0.5">
                        <span className="text-[10px] italic text-zinc-700">
                          {delCount === 1 ? "삭제된 답글" : `삭제된 답글 ${delCount}개`}
                        </span>
                      </div>
                    )
                    continue
                  }
                  const isReplyOwn = user?.id === reply.userId
                  els.push(
                    <CommentCard
                      key={reply.id}
                      comment={reply}
                      tone={tone}
                      showTime={mounted}
                      likeCount={counts[reply.id]?.like ?? 0}
                      myReaction={my[reply.id] ?? null}
                      reacting={reactingId === reply.id}
                      onReact={(r) => handleReact(reply.id, r)}
                      onReply={() => setReplyingTo((cur) => (cur === c.id ? null : c.id))}
                      onReport={user && !isReplyOwn ? () => setReportTarget({
                        targetType: "comment",
                        targetId: reply.id,
                        targetUserId: reply.userId,
                      }) : undefined}
                      isBlocked={false}
                      factCheck={null}
                      factChecking={false}
                      isClosed={isClosed}
                      isOwn={isReplyOwn}
                      editingId={editingId}
                      editContent={editingId === reply.id ? editContent : undefined}
                      onStartEdit={() => handleStartEdit(reply.id, reply.content)}
                      onCancelEdit={handleCancelEdit}
                      onSaveEdit={() => handleSaveEdit(reply.id)}
                      onChangeEdit={setEditContent}
                      onDelete={() => handleDelete(reply.id)}
                      coaching={null}
                      onCoach={undefined}
                      coaching_loading={false}
                      sentiment={null}
                      featuredBadges={reply.userId ? userFeaturedBadges[reply.userId] ?? [] : []}
                    />
                  )
                  ri++
                }
                return els
              }

              // pro/con 톤: 기존 1:1 렌더링
              return replies.map((reply) => {
                const isReplyOwn = user?.id === reply.userId
                return (
                  <CommentCard
                    key={reply.id}
                    comment={reply}
                    tone={tone}
                    showTime={mounted}
                    likeCount={counts[reply.id]?.like ?? 0}
                    myReaction={my[reply.id] ?? null}
                    reacting={reactingId === reply.id}
                    onReact={(r) => handleReact(reply.id, r)}
                    onReply={() => setReplyingTo((cur) => (cur === c.id ? null : c.id))}
                    onReport={user && !isReplyOwn ? () => setReportTarget({
                      targetType: "comment",
                      targetId: reply.id,
                      targetUserId: reply.userId,
                    }) : undefined}
                    isBlocked={reply.userId ? blockedIds.has(reply.userId) : false}
                    factCheck={template !== "free" ? (factChecks[reply.id] ?? null) : null}
                    onFactCheck={template !== "free" && user && (profile?.xp ?? 0) >= 50 && !isReplyOwn
                      ? () => handleFactCheck(reply.id)
                      : undefined}
                    factChecking={template !== "free" && factCheckingId === reply.id}
                    isClosed={isClosed}
                    isOwn={isReplyOwn}
                    editingId={editingId}
                    editContent={editingId === reply.id ? editContent : undefined}
                    onStartEdit={() => handleStartEdit(reply.id, reply.content)}
                    onCancelEdit={handleCancelEdit}
                    onSaveEdit={() => handleSaveEdit(reply.id)}
                    onChangeEdit={setEditContent}
                    onDelete={() => handleDelete(reply.id)}
                    coaching={null}
                    onCoach={undefined}
                    coaching_loading={false}
                    sentiment={null}
                    featuredBadges={reply.userId ? userFeaturedBadges[reply.userId] ?? [] : []}
                  />
                )
              })
            })()}
          </div>
        )}
      </div>
    )
  }

  // ══════ 투표 비율 (strict 게이지용) ══════
  const voteTotal = votePro + voteCon
  const yesPct = voteTotal > 0 ? Math.round((votePro / voteTotal) * 100) : 50
  const noPct = 100 - yesPct

  // ══════════════════════════════════════════════════════════════
  // STRICT: 풀스크린 스플릿 레이아웃
  // ══════════════════════════════════════════════════════════════
  if (template !== "free") {
    return (
      <section className="flex h-full flex-col">
        {/* 마감 배너 */}
        {isClosed && (
          <div className="shrink-0 border-b border-red-400/20 bg-red-400/5 px-4 py-2 text-center text-xs font-medium text-red-300">
            이 토론은 마감되었습니다. 더 이상 의견을 작성할 수 없습니다.
          </div>
        )}

        {/* ── 모바일: 탭 전환 + 미니 게이지 ── */}
        <div className="flex shrink-0 items-center border-b border-white/[0.06] sm:hidden">
          <button
            type="button"
            onClick={() => setMobileTab("pro")}
            className={`flex-1 py-3 text-center text-sm font-bold transition ${
              mobileTab === "pro"
                ? "border-b-2 border-[#00FFD1] bg-[#00FFD1]/5 text-[#00FFD1]"
                : "text-zinc-500"
            }`}
          >
            <ThumbsUp className="mb-0.5 inline size-3.5" /> 찬성 {pro.length}
          </button>
          <div className="flex w-14 shrink-0 flex-col items-center justify-center gap-0.5 self-stretch border-x border-white/[0.06] bg-black/40">
            <span className="text-[10px] font-black text-[#00FFD1]">{yesPct}</span>
            <div className="h-px w-4 bg-zinc-600" />
            <span className="text-[10px] font-black text-[#FF00FF]">{noPct}</span>
          </div>
          <button
            type="button"
            onClick={() => setMobileTab("con")}
            className={`flex-1 py-3 text-center text-sm font-bold transition ${
              mobileTab === "con"
                ? "border-b-2 border-[#FF00FF] bg-[#FF00FF]/5 text-[#FF00FF]"
                : "text-zinc-500"
            }`}
          >
            <ThumbsDown className="mb-0.5 inline size-3.5" /> 반대 {con.length}
          </button>
        </div>

        {/* ── 스플릿 본체 ── */}
        <div className="relative flex flex-1" style={{ minHeight: 0 }}>

          {/* ===== 찬성 컬럼 ===== */}
          <div
            className={`flex flex-1 flex-col bg-gradient-to-b from-[#00FFD1]/[0.04] via-transparent to-transparent ${
              mobileTab === "con" ? "hidden sm:flex" : "flex"
            }`}
          >
            {/* 컬럼 헤더 (데스크톱) */}
            <div className="hidden shrink-0 items-center justify-between border-b border-[#00FFD1]/10 bg-[#00FFD1]/[0.03] px-5 py-3 sm:flex">
              <div className="flex items-center gap-2.5">
                <div className="size-2.5 rounded-full bg-[#00FFD1] shadow-[0_0_10px_rgba(0,255,209,0.6)]" />
                <span className="text-sm font-bold tracking-wide text-[#00FFD1]">찬성</span>
                <span className="rounded-full border border-[#00FFD1]/20 bg-[#00FFD1]/10 px-2.5 py-0.5 text-[11px] font-semibold text-[#00FFD1]/80">
                  {pro.length}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSortMode((s) => (s === "recent" ? "liked" : "recent"))}
                className="inline-flex items-center gap-1 text-[10px] text-zinc-500 transition hover:text-zinc-300"
              >
                <ArrowUpDown className="size-3" />
                {sortMode === "liked" ? "좋아요순" : "최신순"}
              </button>
            </div>

            {/* 찬성 댓글 피드 */}
            <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
              {pro.length === 0 ? (
                <div className="flex h-full items-center justify-center">
                  <p className="text-sm text-zinc-600">첫 번째 찬성 의견을 남겨보세요</p>
                </div>
              ) : (
                pro.map((c) => renderComment(c, "pro"))
              )}
              {hasMore && (
                <div className="flex justify-center py-2">
                  <button
                    type="button"
                    onClick={loadMore}
                    disabled={loadingMore}
                    className="inline-flex items-center gap-1.5 rounded-full border border-[#00FFD1]/30 bg-[#00FFD1]/10 px-4 py-2 text-xs font-medium text-[#00FFD1] transition hover:bg-[#00FFD1]/20 disabled:opacity-50"
                  >
                    {loadingMore ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : null}
                    {loadingMore ? "로딩 중…" : "더 보기"}
                  </button>
                </div>
              )}
              <div className="h-24 shrink-0" />
            </div>
          </div>

          {/* ===== 중앙 게이지 디바이더 (데스크톱) ===== */}
          <div className="relative hidden w-[56px] shrink-0 flex-col items-center border-x border-white/[0.06] bg-black/50 sm:flex">
            {/* PRO 비율 */}
            <div className="shrink-0 pb-2 pt-4 text-center">
              <div className="text-xl font-black leading-none text-[#00FFD1] drop-shadow-[0_0_8px_rgba(0,255,209,0.4)]">
                {yesPct}
              </div>
              <div className="mt-0.5 text-[8px] font-bold tracking-[0.2em] text-[#00FFD1]/50">
                PRO
              </div>
            </div>

            {/* 수직 게이지 바 */}
            <div className="relative mx-auto w-2.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className="absolute inset-x-0 top-0 rounded-full bg-gradient-to-b from-[#00FFD1] to-[#00FFD1]/50 transition-all duration-1000 ease-out"
                style={{ height: `${yesPct}%` }}
              />
              <div
                className="absolute inset-x-0 bottom-0 rounded-full bg-gradient-to-t from-[#FF00FF] to-[#FF00FF]/50 transition-all duration-1000 ease-out"
                style={{ height: `${noPct}%` }}
              />
            </div>

            {/* VS 뱃지 */}
            <div className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2">
              <div className="vs-badge-pulse grid size-11 place-items-center rounded-full border border-white/20 bg-black shadow-[0_0_24px_rgba(0,255,209,0.2),0_0_24px_rgba(255,0,255,0.2)]">
                <span className="bg-gradient-to-b from-[#00FFD1] to-[#FF00FF] bg-clip-text text-[11px] font-black text-transparent">
                  VS
                </span>
              </div>
            </div>

            {/* CON 비율 */}
            <div className="shrink-0 pb-4 pt-2 text-center">
              <div className="mb-0.5 text-[8px] font-bold tracking-[0.2em] text-[#FF00FF]/50">
                CON
              </div>
              <div className="text-xl font-black leading-none text-[#FF00FF] drop-shadow-[0_0_8px_rgba(255,0,255,0.4)]">
                {noPct}
              </div>
            </div>
          </div>

          {/* ===== 반대 컬럼 ===== */}
          <div
            className={`flex flex-1 flex-col bg-gradient-to-b from-[#FF00FF]/[0.04] via-transparent to-transparent ${
              mobileTab === "pro" ? "hidden sm:flex" : "flex"
            }`}
          >
            {/* 컬럼 헤더 (데스크톱) */}
            <div className="hidden shrink-0 items-center justify-between border-b border-[#FF00FF]/10 bg-[#FF00FF]/[0.03] px-5 py-3 sm:flex">
              <div className="flex items-center gap-2.5">
                <div className="size-2.5 rounded-full bg-[#FF00FF] shadow-[0_0_10px_rgba(255,0,255,0.6)]" />
                <span className="text-sm font-bold tracking-wide text-[#FF00FF]">반대</span>
                <span className="rounded-full border border-[#FF00FF]/20 bg-[#FF00FF]/10 px-2.5 py-0.5 text-[11px] font-semibold text-[#FF00FF]/80">
                  {con.length}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSortMode((s) => (s === "recent" ? "liked" : "recent"))}
                className="inline-flex items-center gap-1 text-[10px] text-zinc-500 transition hover:text-zinc-300"
              >
                <ArrowUpDown className="size-3" />
                {sortMode === "liked" ? "좋아요순" : "최신순"}
              </button>
            </div>

            {/* 반대 댓글 피드 */}
            <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
              {con.length === 0 ? (
                <div className="flex h-full items-center justify-center">
                  <p className="text-sm text-zinc-600">첫 번째 반대 의견을 남겨보세요</p>
                </div>
              ) : (
                con.map((c) => renderComment(c, "con"))
              )}
              {hasMore && (
                <div className="flex justify-center py-2">
                  <button
                    type="button"
                    onClick={loadMore}
                    disabled={loadingMore}
                    className="inline-flex items-center gap-1.5 rounded-full border border-[#FF00FF]/30 bg-[#FF00FF]/10 px-4 py-2 text-xs font-medium text-[#FF00FF] transition hover:bg-[#FF00FF]/20 disabled:opacity-50"
                  >
                    {loadingMore ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : null}
                    {loadingMore ? "로딩 중…" : "더 보기"}
                  </button>
                </div>
              )}
              <div className="h-24 shrink-0" />
            </div>
          </div>

          {/* ===== 플로팅 CTA 버튼 ===== */}
          {!isClosed && !open && (
            <div className="pointer-events-none absolute inset-x-0 bottom-6 z-20 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setOpen("pro")}
                className="pointer-events-auto inline-flex items-center gap-2 rounded-full border border-[#00FFD1]/40 bg-black/80 px-5 py-3 text-sm font-bold text-[#00FFD1] shadow-[0_4px_24px_rgba(0,255,209,0.3)] backdrop-blur-sm transition hover:bg-[#00FFD1]/15 hover:shadow-[0_4px_32px_rgba(0,255,209,0.45)]"
              >
                <Plus className="size-4" />
                찬성 의견
              </button>
              <button
                type="button"
                onClick={() => setOpen("con")}
                className="pointer-events-auto inline-flex items-center gap-2 rounded-full border border-[#FF00FF]/40 bg-black/80 px-5 py-3 text-sm font-bold text-[#FF00FF] shadow-[0_4px_24px_rgba(255,0,255,0.3)] backdrop-blur-sm transition hover:bg-[#FF00FF]/15 hover:shadow-[0_4px_32px_rgba(255,0,255,0.45)]"
              >
                <Plus className="size-4" />
                반대 의견
              </button>
            </div>
          )}

          {/* ===== 작성 오버레이 (하단 슬라이드업) ===== */}
          {open && !isClosed && (
            <div className="absolute inset-x-0 bottom-0 z-30 border-t border-white/10 bg-black/95 p-4 backdrop-blur-xl sm:p-6">
              <div className="mx-auto max-w-2xl">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`size-3 rounded-full ${open === "pro" ? "bg-[#00FFD1] shadow-[0_0_8px_rgba(0,255,209,0.5)]" : "bg-[#FF00FF] shadow-[0_0_8px_rgba(255,0,255,0.5)]"}`} />
                    <span className={`text-sm font-bold ${open === "pro" ? "text-[#00FFD1]" : "text-[#FF00FF]"}`}>
                      {open === "pro" ? "찬성" : "반대"} 의견 작성
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOpen(null)}
                    className="rounded-full p-1.5 text-zinc-500 transition hover:bg-white/10 hover:text-zinc-200"
                  >
                    <X className="size-5" />
                  </button>
                </div>
                <CommentComposer
                  threadId={threadId}
                  fixedSide={open}
                  onSubmitted={() => setOpen(null)}
                />
              </div>
            </div>
          )}
        </div>

        {/* 신고 모달 */}
        {reportTarget && (
          <ReportModal
            isOpen={true}
            onClose={() => setReportTarget(null)}
            targetType={reportTarget.targetType}
            targetId={reportTarget.targetId}
            targetUserId={reportTarget.targetUserId}
          />
        )}
      </section>
    )
  }

  // ══════════════════════════════════════════════════════════════
  // FREE: 와이드 채팅 레이아웃 (Discord/Slack 스타일)
  // ══════════════════════════════════════════════════════════════
  return (
    <section className="flex h-full flex-col">
      {/* 마감 배너 */}
      {isClosed && (
        <div className="shrink-0 border-b border-red-400/20 bg-red-400/5 px-4 py-1.5 text-center text-[11px] font-medium text-red-300">
          이 토론은 마감되었습니다.
        </div>
      )}

      {/* 상단 바: 실시간 + 정렬 */}
      <div className="flex shrink-0 items-center justify-between border-b border-white/[0.06] px-4 py-1.5">
        <div className="flex items-center gap-2">
          <span className="live-pulse-dot inline-block size-1.5 rounded-full bg-[#39FF14]" />
          <span className="text-[10px] font-medium uppercase tracking-widest text-[#39FF14]/50">Live</span>
          <span className="text-[10px] text-zinc-600">{all.length}개의 메시지</span>
        </div>
        <button
          type="button"
          onClick={() => setSortMode((cur) => (cur === "recent" ? "liked" : "recent"))}
          className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-medium transition ${
            sortMode === "liked"
              ? "bg-amber-400/10 text-amber-300"
              : "text-zinc-600 hover:bg-white/5 hover:text-zinc-400"
          }`}
        >
          <ArrowUpDown className="size-2.5" />
          {sortMode === "liked" ? "좋아요순" : "최신순"}
        </button>
      </div>

      {/* 메시지 리스트 (스크롤 영역) */}
      <div className="flex-1 overflow-y-auto" style={{ minHeight: 0 }}>
        <div className="mx-auto max-w-5xl py-2">
          {all.length === 0 ? (
            <div className="flex min-h-[50vh] items-center justify-center">
              <div className="text-center">
                <div className="mx-auto mb-3 grid size-12 place-items-center rounded-full border border-[#39FF14]/10 bg-[#39FF14]/5">
                  <svg className="size-6 text-[#39FF14]/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
                  </svg>
                </div>
                <p className="text-sm text-zinc-500">
                  아직 대화가 시작되지 않았어요
                </p>
                <p className="mt-1 text-xs text-zinc-700">
                  첫 번째 의견을 남겨보세요!
                </p>
              </div>
            </div>
          ) : (
            <div>
              {(() => {
                const elements: React.ReactNode[] = []
                let i = 0
                let isFirstVisible = true
                while (i < all.length) {
                  const c = all[i]
                  // 연속 삭제 댓글 그룹핑
                  if (c.isDeleted) {
                    let delCount = 0
                    const startIdx = i
                    while (i < all.length && all[i].isDeleted) {
                      delCount++
                      i++
                    }
                    elements.push(
                      <div key={`del-${startIdx}`} className={`mx-auto max-w-5xl px-4 py-1 ${isFirstVisible ? "" : "mt-2"}`}>
                        <span className="text-[11px] italic text-zinc-700">
                          삭제된 메시지 {delCount}개
                        </span>
                      </div>
                    )
                    isFirstVisible = false
                    continue
                  }

                  const isGrouped = (c as BattleComment & { _isGrouped?: boolean })._isGrouped
                  const spacing = isFirstVisible ? "" : isGrouped ? "mt-0.5" : "mt-4"
                  elements.push(
                    <div
                      key={c.id}
                      className={`chat-bubble-enter ${spacing}`}
                      style={{ animationDelay: `${Math.min(i * 15, 150)}ms` }}
                    >
                      {isGrouped ? (
                        <div className="group relative px-4 py-0.5 transition-colors hover:bg-white/[0.04]">
                          <div className="ml-[52px] text-[14px] leading-relaxed text-zinc-200">
                            <MarkdownContent content={preprocessMentions(c.content)} />
                          </div>
                        </div>
                      ) : (
                        renderComment(c, "neutral")
                      )}
                    </div>
                  )
                  isFirstVisible = false
                  i++
                }
                return elements
              })()}
            </div>
          )}
          {hasMore && (
            <div className="flex justify-center py-3">
              <button
                type="button"
                onClick={loadMore}
                disabled={loadingMore}
                className="inline-flex items-center gap-1.5 rounded-full border border-[#39FF14]/30 bg-[#39FF14]/10 px-4 py-2 text-xs font-medium text-[#39FF14] transition hover:bg-[#39FF14]/20 disabled:opacity-50"
              >
                {loadingMore ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : null}
                {loadingMore ? "로딩 중…" : "이전 메시지 더 보기"}
              </button>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>
      </div>

      {/* 하단 입력창: 플로팅 슬림 바 */}
      {!isClosed && (
        <div className="shrink-0 px-4 pb-3 pt-1">
          <div className="mx-auto max-w-5xl">
            <CommentComposer
              threadId={threadId}
              template="free"
              onSubmitted={() => {}}
            />
          </div>
        </div>
      )}

      {/* 신고 모달 */}
      {reportTarget && (
        <ReportModal
          isOpen={true}
          onClose={() => setReportTarget(null)}
          targetType={reportTarget.targetType}
          targetId={reportTarget.targetId}
          targetUserId={reportTarget.targetUserId}
        />
      )}
    </section>
  )
}
