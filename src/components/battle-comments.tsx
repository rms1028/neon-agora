"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { ArrowUpDown, Clock, Loader2, ThumbsUp, X } from "lucide-react"
import Link from "next/link"

import { CommentComposer } from "@/components/comment-composer"
import { CommentCard } from "@/components/comment-card"
import { ReportModal } from "@/components/report-modal"
import { MarkdownContent } from "@/components/markdown-content"
import { useCommentState } from "@/hooks/useCommentState"
import { useCommentPagination } from "@/hooks/useCommentPagination"
import { timeAgo } from "@/lib/utils"
import type { BattleComment, SortMode } from "@/types/comments"

export type { BattleComment, CommentPoll } from "@/types/comments"

/* ─── Avatar colors (cycling) ─── */
const COLORS = ["#00e4a5", "#ff4d8d", "#55b3ff", "#ffd055", "#c084fc", "#ff8a50"]
function getColor(index: number) { return COLORS[index % COLORS.length] }

/* ─── Helpers ─── */
function getReplyCount(commentId: string, replyMap: Record<string, BattleComment[]>) {
  return (replyMap[commentId] ?? []).filter(r => !r.isDeleted).length
}

export function BattleComments({
  threadId,
  comments,
  isClosed,
  threadCreatedBy,
  template,
  hasMoreComments: initialHasMore = false,
  nextCursor: initialCursor = null,
}: {
  threadId: string
  comments: BattleComment[]
  isClosed?: boolean
  threadCreatedBy?: string
  template?: string
  proPercent?: number
  conPercent?: number
  totalVotes?: number
  proCount?: number
  conCount?: number
  hasMoreComments?: boolean
  nextCursor?: { created_at: string; id: string } | null
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [composeOpen, setComposeOpen] = useState(false)
  const [freeSortBy, setFreeSortBy] = useState<"hot" | "latest">("hot")
  const panelRef = useRef<HTMLDivElement>(null)

  const state = useCommentState({ threadId, comments, template })
  const {
    user, profile, blockedIds, mounted, reactingId,
    replyingTo, setReplyingTo, editingId, editContent, setEditContent,
    reportTarget, setReportTarget, factChecks, factCheckingId,
    coachResults, coachingId, sentiments, userFeaturedBadges,
    counts, setCounts, my, localComments, setLocalComments,
    handleFactCheck, handleCoach, handleStartEdit, handleCancelEdit,
    handleSaveEdit, handleTogglePin, handleDelete, handleReact,
  } = state

  const { hasMore, loadingMore, loadMore } = useCommentPagination({
    threadId, initialHasMore, initialCursor, setLocalComments, setCounts,
  })

  /* ─── Derive top-level + reply map ─── */
  const { topComments, replyMap } = useMemo(() => {
    const top: BattleComment[] = []
    const rm: Record<string, BattleComment[]> = {}
    for (const c of localComments) {
      if (c.parentId) {
        if (!rm[c.parentId]) rm[c.parentId] = []
        rm[c.parentId].push(c)
      } else if (!c.isDeleted) {
        top.push(c)
      }
    }
    for (const key of Object.keys(rm)) {
      rm[key].sort((a, b) => {
        const ta = a.created_at ? new Date(a.created_at).getTime() : 0
        const tb = b.created_at ? new Date(b.created_at).getTime() : 0
        return ta - tb
      })
    }
    return { topComments: top, replyMap: rm }
  }, [localComments])

  /* ─── Sort ─── */
  const sortedComments = useMemo(() => {
    const arr = [...topComments]
    if (freeSortBy === "latest") {
      arr.sort((a, b) => {
        const ta = a.created_at ? new Date(a.created_at).getTime() : 0
        const tb = b.created_at ? new Date(b.created_at).getTime() : 0
        return tb - ta
      })
    } else {
      arr.sort((a, b) => {
        const scoreA = (counts[a.id]?.like ?? a.likeCount) + (counts[a.id]?.fire ?? a.fireCount) * 2 + getReplyCount(a.id, replyMap)
        const scoreB = (counts[b.id]?.like ?? b.likeCount) + (counts[b.id]?.fire ?? b.fireCount) * 2 + getReplyCount(b.id, replyMap)
        return scoreB - scoreA
      })
    }
    return arr
  }, [topComments, counts, replyMap, freeSortBy])

  /* Total reactions count */
  const totalReactions = useMemo(() => {
    return sortedComments.reduce((acc, c) => {
      return acc + (counts[c.id]?.like ?? c.likeCount) + (counts[c.id]?.fire ?? c.fireCount)
    }, 0)
  }, [sortedComments, counts])

  /* Total reply count */
  const totalReplies = useMemo(() => {
    return Object.values(replyMap).reduce((acc, arr) => acc + arr.filter(r => !r.isDeleted).length, 0)
  }, [replyMap])

  /* ─── Selected comment for thread panel ─── */
  const selectedComment = useMemo(() => {
    if (!selectedId) return null
    return localComments.find(c => c.id === selectedId) ?? null
  }, [selectedId, localComments])

  const selectedReplies = useMemo(() => {
    if (!selectedId) return []
    return (replyMap[selectedId] ?? []).filter(r => !r.isDeleted && !(r.userId && blockedIds.has(r.userId)))
  }, [selectedId, replyMap, blockedIds])

  const isPanelOpen = selectedComment !== null

  /* Close panel on Escape */
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (composeOpen) setComposeOpen(false)
        else setSelectedId(null)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [composeOpen])

  /* ─── Render thread panel comment ─── */
  function renderPanelComment(c: BattleComment, isReply = false) {
    const isOwn = user?.id === c.userId
    const isThreadCreator = user?.id === threadCreatedBy
    const canCoach = isOwn && user && (profile?.xp ?? 0) >= 30

    return (
      <CommentCard
        key={c.id}
        comment={c}
        showTime={mounted}
        likeCount={counts[c.id]?.like ?? 0}
        myReaction={my[c.id] ?? null}
        reacting={reactingId === c.id}
        onReact={(r) => handleReact(c.id, r)}
        onReply={!isReply && !isClosed ? () => setReplyingTo(cur => cur === c.id ? null : c.id) : undefined}
        onReport={!isOwn && user ? () => setReportTarget({ targetType: "comment", targetId: c.id, targetUserId: c.userId }) : undefined}
        isBlocked={c.userId ? blockedIds.has(c.userId) : false}
        factCheck={null}
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
        coaching={canCoach ? (coachResults[c.id] ?? null) : null}
        onCoach={canCoach ? () => handleCoach(c.id) : undefined}
        coaching_loading={coachingId === c.id}
        sentiment={sentiments[c.id] ?? null}
        featuredBadges={c.userId ? userFeaturedBadges[c.userId] ?? [] : []}
        counts={counts[c.id]}
      />
    )
  }

  return (
    <section className="flex h-full flex-col" style={{ background: "#0a0f14" }}>
      {/* ═══ Sticky Header ═══ */}
      <header className="px-4 py-2.5 md:px-6" style={{
        position: "sticky", top: 0, zIndex: 20, flexShrink: 0,
        background: "rgba(10,15,20,0.92)", backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(255,255,255,0.03)",
      }}>
        {/* 1줄: 정보 + 의견쓰기 */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 overflow-hidden">
            <p className="whitespace-nowrap text-[11px] text-zinc-600">
              자유토론 · {sortedComments.length}개 의견
            </p>
            {totalReactions > 0 && (
              <span className="whitespace-nowrap text-[11px] text-zinc-600">
                · {totalReactions} 반응
              </span>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {/* 정렬 토글 */}
            <div className="flex items-center gap-0.5 rounded-lg border border-white/[0.06] bg-white/[0.02] p-0.5">
              <button
                type="button"
                onClick={() => setFreeSortBy("hot")}
                className={`inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-1 text-[10px] font-semibold transition-all ${
                  freeSortBy === "hot"
                    ? "bg-amber-500/15 text-amber-300 shadow-sm"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                <ThumbsUp className="size-2.5" />
                좋아요
              </button>
              <button
                type="button"
                onClick={() => setFreeSortBy("latest")}
                className={`inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-1 text-[10px] font-semibold transition-all ${
                  freeSortBy === "latest"
                    ? "bg-cyan-500/15 text-cyan-300 shadow-sm"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                <Clock className="size-2.5" />
                최신
              </button>
            </div>
            {!isClosed && (
              <button
                type="button"
                onClick={() => setComposeOpen(true)}
                style={{
                  padding: "8px 20px", borderRadius: 12, border: "none",
                  background: "rgba(255,255,255,0.06)", color: "#ccc",
                  fontSize: 13, fontWeight: 700, cursor: "pointer",
                  transition: "all 0.15s",
                }}
                className="hover:!bg-white hover:!text-black"
              >
                의견 쓰기
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Closed banner */}
      {isClosed && (
        <div className="shrink-0 border-b border-red-500/20 bg-red-500/[0.03] px-4 py-2 text-center text-[11px] font-bold tracking-wide text-red-400/80">
          DEBATE CLOSED — 이 토론은 마감되었습니다
        </div>
      )}

      {/* ─── Content: Masonry Grid + Thread Panel ─── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* ═══ Masonry Card Grid ═══ */}
        <div className={`flex flex-col min-h-0 transition-all duration-300 ease-out ${
          isPanelOpen ? "w-0 md:w-[55%] hidden md:flex" : "w-full"
        }`}>
          <div className="flex-1 overflow-y-auto side-panel-scroll px-4 pb-24 pt-4 md:px-6 md:pb-24 md:pt-5">
            {sortedComments.length === 0 ? (
              <div style={{
                display: "flex", flexDirection: "column", alignItems: "center",
                justifyContent: "center", padding: "80px 0", textAlign: "center",
              }}>
                <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.2 }}>💬</div>
                <div style={{ fontSize: 16, fontWeight: 600, color: "#555", marginBottom: 6 }}>아직 의견이 없습니다</div>
                <div style={{ fontSize: 12, color: "#333" }}>첫 번째 의견을 남겨보세요</div>
              </div>
            ) : (
              <div style={{ columns: "2 320px", columnGap: 16 }}>
                {sortedComments.map((c, i) => {
                  const color = getColor(i)
                  const likeCount = (counts[c.id]?.like ?? c.likeCount)
                  const isLiked = (my[c.id] ?? null) === "like"
                  const replyCount = getReplyCount(c.id, replyMap)
                  const isSelected = selectedId === c.id

                  if (c.userId && blockedIds.has(c.userId)) return null

                  return (
                    <div
                      key={c.id}
                      onClick={() => setSelectedId(isSelected ? null : c.id)}
                      style={{
                        breakInside: "avoid", marginBottom: 16,
                        borderRadius: 18, overflow: "hidden",
                        background: isSelected ? "rgba(0,228,165,0.04)" : "rgba(255,255,255,0.02)",
                        border: isSelected ? "1px solid rgba(0,228,165,0.25)" : "1px solid rgba(255,255,255,0.04)",
                        transition: "all 0.2s", cursor: "pointer",
                      }}
                      className="hover:border-white/10 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(0,0,0,0.2)]"
                    >
                      <div style={{ padding: "18px 20px" }}>
                        {/* Profile */}
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                          {/* Avatar */}
                          <div style={{
                            width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                            background: `${color}15`, border: `1.5px solid ${color}30`,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 14, fontWeight: 800, color: color,
                          }}>
                            {c.displayName.slice(0, 1)}
                          </div>
                          <div>
                            {c.userId ? (
                              <Link
                                href={`/profile/${c.userId}`}
                                onClick={e => e.stopPropagation()}
                                style={{ fontSize: 13, fontWeight: 700, color: "#ccc" }}
                                className="hover:underline"
                              >
                                {c.displayName}
                              </Link>
                            ) : (
                              <div style={{ fontSize: 13, fontWeight: 700, color: "#ccc" }}>{c.displayName}</div>
                            )}
                            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                              {c.customTitle && (
                                <span style={{ fontSize: 9, color: color, fontWeight: 700 }}>{c.customTitle}</span>
                              )}
                              <span style={{ fontSize: 9, color: "#333" }} suppressHydrationWarning>
                                {c.customTitle ? "· " : ""}{mounted ? timeAgo(c.created_at) : ""}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Text */}
                        <div style={{
                          fontSize: 14, color: "#aaa", lineHeight: 1.75,
                          margin: "0 0 16px", wordBreak: "keep-all",
                        }}>
                          <MarkdownContent content={c.content.replace(/@\[([^\]]+)\]\(([^)]+)\)/g, "[@$1](/profile/$2)")} />
                        </div>

                        {/* Actions bar */}
                        <div style={{
                          display: "flex", alignItems: "center", gap: 14,
                          paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.03)",
                        }}>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleReact(c.id, "like")
                            }}
                            disabled={reactingId === c.id || isClosed}
                            style={{
                              display: "flex", alignItems: "center", gap: 4,
                              background: "none", border: "none",
                              color: isLiked ? "#ff4d8d" : "#555",
                              fontSize: 12, cursor: "pointer",
                              fontWeight: isLiked ? 700 : 500,
                              transition: "all 0.12s",
                            }}
                          >
                            {isLiked ? "\u2665" : "\u2661"} {likeCount > 0 ? likeCount : ""}
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              setSelectedId(c.id)
                            }}
                            style={{
                              display: "flex", alignItems: "center", gap: 4,
                              background: "none", border: "none",
                              color: "#555", fontSize: 12, cursor: "pointer",
                            }}
                          >
                            💬 {replyCount > 0 ? replyCount : ""}
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Load more */}
            {hasMore && (
              <div style={{ display: "flex", justifyContent: "center", padding: "24px 0" }}>
                <button
                  type="button"
                  onClick={loadMore}
                  disabled={loadingMore}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    padding: "8px 20px", borderRadius: 20,
                    border: "1px solid rgba(255,255,255,0.06)",
                    background: "rgba(255,255,255,0.02)",
                    color: "#555", fontSize: 11, fontWeight: 700,
                    cursor: "pointer", transition: "all 0.15s",
                  }}
                >
                  {loadingMore && <Loader2 className="size-3 animate-spin" />}
                  {loadingMore ? "불러오는 중…" : "더 보기"}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ═══ Right: Thread Panel ═══ */}
        {isPanelOpen && selectedComment && (
          <>
            <div
              className="fixed inset-0 z-40 bg-black/50 md:hidden"
              onClick={() => setSelectedId(null)}
            />
            <div
              ref={panelRef}
              className="thread-panel flex flex-col border-l border-white/[0.06] fixed inset-y-0 right-0 z-50 w-full max-w-[420px] md:static md:z-auto md:w-[45%] md:max-w-none"
              style={{ background: "#0c1117" }}
            >
              {/* Panel header */}
              <div className="shrink-0 flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="h-4 w-[3px] rounded-sm bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]" />
                  <span className="text-sm font-bold text-zinc-200">쓰레드</span>
                  <span className="text-[10px] text-zinc-600">
                    {selectedReplies.length}개 답글
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedId(null)}
                  className="grid size-7 place-items-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-zinc-500 transition hover:bg-white/[0.08] hover:text-white"
                >
                  <X className="size-3.5" />
                </button>
              </div>

              {/* Panel body */}
              <div className="flex-1 overflow-y-auto side-panel-scroll px-4 py-3">
                <div className="thread-root mb-4">
                  {renderPanelComment(selectedComment)}
                </div>

                {replyingTo === selectedComment.id && !isClosed && (
                  <div className="ml-6 mb-4 thread-reply-line pl-4 py-2">
                    <CommentComposer
                      threadId={threadId}
                      parentId={selectedComment.id}
                      onSubmitted={() => setReplyingTo(null)}
                      template="free"
                    />
                  </div>
                )}

                {selectedReplies.length > 0 && (
                  <div className="thread-replies space-y-0">
                    {selectedReplies.map((reply) => (
                      <div key={reply.id} className="thread-reply-item relative ml-6 pl-4">
                        <div className="thread-connect-line absolute left-0 top-0 bottom-0 w-px bg-white/[0.06]" />
                        <div className="thread-connect-branch absolute left-0 top-5 w-4 h-px bg-white/[0.06]" />
                        {renderPanelComment(reply, true)}
                      </div>
                    ))}
                  </div>
                )}

                {selectedReplies.length === 0 && !replyingTo && (
                  <div className="text-center py-8 text-[12px] text-zinc-700">
                    아직 답글이 없습니다. 첫 대화를 시작해보세요.
                  </div>
                )}
              </div>

              {/* Fixed bottom reply input */}
              {!isClosed && (
                <div className="shrink-0 border-t border-white/[0.06] px-4 py-3" style={{ background: "#0c1117" }}>
                  <CommentComposer
                    threadId={threadId}
                    parentId={selectedComment.id}
                    template="free"
                    variant="fixed-bar"
                    onSubmitted={() => {}}
                  />
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* ═══ Compose Modal ═══ */}
      {composeOpen && (
        <>
          <div
            onClick={() => setComposeOpen(false)}
            style={{
              position: "fixed", inset: 0, zIndex: 200,
              background: "rgba(0,0,0,0.5)",
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
            }}
          />
          <div style={{
            position: "fixed", top: "50%", left: "50%",
            transform: "translate(-50%, -50%)", zIndex: 201,
            width: "min(540px, 90vw)",
            borderRadius: 20,
            background: "rgba(14,14,20,0.98)",
            border: "1px solid rgba(255,255,255,0.06)",
            padding: "28px 28px 20px",
            boxShadow: "0 24px 80px rgba(0,0,0,0.5)",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <span style={{ fontSize: 16, fontWeight: 800, color: "#eee" }}>의견 작성</span>
              <button
                type="button"
                onClick={() => setComposeOpen(false)}
                className="grid size-8 place-items-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-zinc-500 transition hover:bg-white/[0.08] hover:text-white"
              >
                <X className="size-4" />
              </button>
            </div>
            <CommentComposer
              threadId={threadId}
              template="free"
              onSubmitted={() => setComposeOpen(false)}
            />
          </div>
        </>
      )}

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
