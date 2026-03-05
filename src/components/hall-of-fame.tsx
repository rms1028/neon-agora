"use client"

import { Pin, Trophy } from "lucide-react"
import Link from "next/link"

export type HallOfFameComment = {
  id: string
  content: string
  side: "pro" | "con" | null
  userId: string
  displayName: string
  likeCount: number
  isPinned: boolean
  customTitle?: string | null
}

export function HallOfFame({
  comments,
  threadCreatedBy,
  onTogglePin,
  currentUserId,
}: {
  comments: HallOfFameComment[]
  threadCreatedBy: string
  onTogglePin?: (commentId: string, pin: boolean) => void
  currentUserId?: string
}) {
  // 고정 댓글 + likeCount >= 3 인 상위 3개 (중복 제거)
  const pinned = comments.filter((c) => c.isPinned)
  const topLiked = comments
    .filter((c) => c.likeCount >= 3 && !c.isPinned)
    .sort((a, b) => b.likeCount - a.likeCount)
    .slice(0, 3)

  const hallComments = [...pinned, ...topLiked]
  if (hallComments.length === 0) return null

  const isCreator = currentUserId === threadCreatedBy

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-amber-200">
        <Trophy className="size-4" />
        명예의 전당
        <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-2 py-0.5 text-[11px] text-amber-300">
          {hallComments.length}
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {hallComments.map((c) => {
          const isPinned = c.isPinned
          const sideBadge =
            c.side === "pro"
              ? "border-cyan-400/30 bg-cyan-400/10 text-cyan-200"
              : c.side === "con"
                ? "border-fuchsia-400/30 bg-fuchsia-400/10 text-fuchsia-200"
                : "border-white/10 bg-white/5 text-zinc-300"
          const sideLabel = c.side === "pro" ? "찬성" : c.side === "con" ? "반대" : "미지정"

          return (
            <div
              key={c.id}
              className={`relative rounded-2xl border p-4 backdrop-blur ${
                isPinned
                  ? "border-yellow-400/40 bg-yellow-400/[0.06] hall-of-fame-card"
                  : "border-amber-400/25 bg-amber-400/[0.04] hall-of-fame-card"
              }`}
            >
              {/* 배지 */}
              <div className="mb-2 flex items-center gap-2">
                {isPinned && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-yellow-400/40 bg-yellow-400/15 px-2 py-0.5 text-[10px] font-semibold text-yellow-200 pin-pulse">
                    <Pin className="size-2.5" />
                    고정됨
                  </span>
                )}
                {!isPinned && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[10px] font-semibold text-amber-200">
                    <Trophy className="size-2.5" />
                    명예의 전당
                  </span>
                )}
                <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${sideBadge}`}>
                  {sideLabel}
                </span>
              </div>

              {/* 유저 정보 */}
              <div className="mb-2 flex items-center gap-2">
                <div className={`grid size-6 place-items-center rounded-full text-[9px] font-semibold text-black ${
                  c.side === "pro" ? "bg-gradient-to-br from-cyan-300 to-emerald-300" : "bg-gradient-to-br from-fuchsia-300 to-rose-300"
                }`}>
                  {c.displayName.slice(0, 2)}
                </div>
                <Link
                  href={`/profile/${c.userId}`}
                  className="text-xs font-medium text-zinc-200 hover:text-cyan-200"
                >
                  {c.displayName}
                </Link>
              </div>

              {/* 내용 */}
              <p className="line-clamp-2 text-sm text-zinc-300">{c.content}</p>

              {/* 좋아요 수 + 핀 토글 */}
              <div className="mt-2 flex items-center justify-between">
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-200">
                  ❤️ {c.likeCount}
                </span>
                {isCreator && onTogglePin && (
                  <button
                    type="button"
                    onClick={() => onTogglePin(c.id, !isPinned)}
                    className={`rounded-full p-1 text-xs transition ${
                      isPinned
                        ? "text-yellow-300 hover:text-yellow-100"
                        : "text-zinc-500 hover:text-zinc-300"
                    }`}
                    title={isPinned ? "고정 해제" : "댓글 고정"}
                  >
                    <Pin className="size-3.5" />
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
