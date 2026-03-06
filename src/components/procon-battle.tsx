"use client"

import { type ReactNode, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { Flag, Loader2, Pencil, Pin, Settings2, Trash2 } from "lucide-react"

import { CommentComposer } from "@/components/comment-composer"
import { MarkdownContent } from "@/components/markdown-content"
import { UserTitleBadge } from "@/components/user-title-badge"
import { ReportModal } from "@/components/report-modal"
import { useCommentState } from "@/hooks/useCommentState"
import { useCommentPagination } from "@/hooks/useCommentPagination"
import { timeAgo } from "@/lib/utils"
import type { BattleComment, SortMode } from "@/types/comments"

export type { BattleComment } from "@/types/comments"

/* ─── Colors ─── */
const PRO = "#00e4a5"
const CON = "#ff4d8d"

/* ════════════════════════════════════════════════════════
   ProConBattle — 채팅 스타일 찬반토론
   ════════════════════════════════════════════════════════ */
export function ProConBattle({
  threadId, title, description, tag, isClosed, threadCreatedBy, template,
  proPercent, conPercent, totalVotes, proCount: initProCount, conCount: initConCount,
  expiresAt, threadUpdatedAt,
  comments, hasMoreComments, nextCursor,
  headerActions, countdown, toolsBlock,
}: {
  threadId: string; title: string; description?: string; tag: string
  isClosed: boolean; threadCreatedBy: string; template: string
  proPercent: number; conPercent: number; totalVotes: number
  proCount: number; conCount: number
  expiresAt: string | null; threadUpdatedAt: string | null
  comments: BattleComment[]
  hasMoreComments: boolean
  nextCursor: { created_at: string; id: string } | null
  headerActions?: ReactNode; countdown?: ReactNode
  toolsBlock?: ReactNode
}) {
  const [toolsOpen, setToolsOpen] = useState(false)
  const [inputSide, setInputSide] = useState<"pro" | "con">("pro")
  const feedRef = useRef<HTMLDivElement>(null)

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
    threadId, initialHasMore: hasMoreComments, initialCursor: nextCursor, setLocalComments, setCounts,
  })

  /* ─── Merge all comments into a single time-sorted feed ─── */
  const derived = useMemo(() => {
    const topLevel: BattleComment[] = []
    const replies: Record<string, BattleComment[]> = {}

    for (const c of localComments) {
      if (c.parentId) {
        if (!replies[c.parentId]) replies[c.parentId] = []
        replies[c.parentId].push(c)
      } else if (!c.isDeleted) {
        topLevel.push(c)
      }
    }
    for (const key of Object.keys(replies)) {
      replies[key].sort((a, b) => {
        const ta = a.created_at ? new Date(a.created_at).getTime() : 0
        const tb = b.created_at ? new Date(b.created_at).getTime() : 0
        return ta - tb
      })
    }
    // Time-sorted ascending (oldest first, like a chat)
    topLevel.sort((a, b) => {
      const ta = a.created_at ? new Date(a.created_at).getTime() : 0
      const tb = b.created_at ? new Date(b.created_at).getTime() : 0
      return ta - tb
    })
    return { feed: topLevel, replies }
  }, [localComments])

  const feed = derived.feed
  const replyMap = derived.replies
  const proCount = feed.filter(c => c.side === "pro").length
  const conCount = feed.filter(c => c.side === "con").length
  const participantCount = useMemo(() => {
    const ids = new Set<string>()
    for (const c of localComments) { if (c.userId) ids.add(c.userId) }
    return ids.size
  }, [localComments])

  /* ─── Auto-scroll on new message ─── */
  const prevCountRef = useRef(feed.length)
  useEffect(() => {
    if (feed.length > prevCountRef.current) {
      setTimeout(() => {
        feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight, behavior: "smooth" })
      }, 50)
    }
    prevCountRef.current = feed.length
  }, [feed.length])

  /* ─── Expanded replies state ─── */
  const [expandedReplies, setExpandedReplies] = useState<Set<string>>(new Set())
  function toggleReplies(id: string) {
    setExpandedReplies(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  /* ─── Render Chat Bubble ─── */
  function renderBubble(c: BattleComment) {
    const isPro = c.side === "pro"
    const accent = isPro ? PRO : CON
    const likeCount = counts[c.id]?.like ?? c.likeCount
    const myReaction = my[c.id] ?? null
    const voted = myReaction === "like"
    const isOwn = user?.id === c.userId
    const isThreadCreator = user?.id === threadCreatedBy
    const replies = (replyMap[c.id] ?? []).filter(r => !r.isDeleted && !(r.userId && blockedIds.has(r.userId)))
    const repliesExpanded = expandedReplies.has(c.id)

    if (c.userId && blockedIds.has(c.userId)) return null

    return (
      <div
        key={c.id}
        className="group/msg"
        style={{ display: "flex", gap: 10 }}
      >
        {/* Avatar */}
        <div style={{
          width: 32, height: 32, borderRadius: 10, flexShrink: 0,
          background: isPro ? "rgba(0,228,165,0.12)" : "rgba(255,77,141,0.12)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 13, fontWeight: 800, color: accent,
          marginTop: 2,
        }}>
          {c.displayName.slice(0, 1)}
        </div>

        {/* Content area */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Name + time */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
            {c.userId ? (
              <Link href={`/profile/${c.userId}`} style={{ fontSize: 13, fontWeight: 700, color: accent }} className="hover:underline" onClick={e => e.stopPropagation()}>
                {c.displayName}
              </Link>
            ) : (
              <span style={{ fontSize: 13, fontWeight: 700, color: accent }}>{c.displayName}</span>
            )}
            {c.customTitle && <UserTitleBadge titleKey={c.customTitle} />}
            {c.isPinned && <span className="inline-flex items-center gap-0.5 rounded-full border border-yellow-400/30 bg-yellow-400/10 px-1 py-0.5 text-[8px] font-bold text-yellow-200"><Pin className="size-2" /></span>}
            <span style={{ fontSize: 10, color: "#555" }} suppressHydrationWarning>{mounted ? timeAgo(c.created_at) : ""}</span>
          </div>

          {/* Message body */}
          <div
            className="group relative max-w-[80%] md:max-w-[65%]"
            style={{
              padding: "10px 16px",
              borderRadius: 12,
              background: isPro ? "rgba(0,228,165,0.08)" : "rgba(255,77,141,0.08)",
              width: "fit-content",
            }}
          >
            {/* Hover actions */}
            <div className="absolute right-1 top-1 hidden items-center gap-0.5 rounded-lg border border-white/[0.04] bg-[#0d0d0d]/95 px-1 py-0.5 shadow-xl group-hover:flex z-[2]">
              {isOwn && !isClosed && editingId !== c.id && (
                <>
                  <button type="button" onClick={() => handleStartEdit(c.id, c.content)} className="rounded p-1 text-zinc-600 hover:text-zinc-300" title="수정"><Pencil className="size-3" /></button>
                  <button type="button" onClick={() => handleDelete(c.id)} className="rounded p-1 text-zinc-600 hover:text-red-400" title="삭제"><Trash2 className="size-3" /></button>
                </>
              )}
              {isThreadCreator && !isClosed && (
                <button type="button" onClick={() => handleTogglePin(c.id, !c.isPinned)} className={`rounded p-1 ${c.isPinned ? "text-yellow-300" : "text-zinc-600 hover:text-zinc-300"}`}><Pin className="size-3" /></button>
              )}
              {!isOwn && user && (
                <button type="button" onClick={() => setReportTarget({ targetType: "comment", targetId: c.id, targetUserId: c.userId })} className="rounded p-1 text-zinc-600 hover:text-zinc-400"><Flag className="size-3" /></button>
              )}
            </div>

            {editingId === c.id ? (
              <div className="space-y-1.5">
                <textarea value={editContent} onChange={e => setEditContent(e.target.value)} rows={3} maxLength={500} className="w-full resize-none rounded-lg border border-white/[0.08] bg-black/60 px-3 py-2 text-[13px] text-zinc-100 outline-none focus:border-zinc-600" />
                <div className="flex justify-end gap-1.5">
                  <button type="button" onClick={handleCancelEdit} className="rounded px-2.5 py-1 text-[11px] text-zinc-500 hover:text-zinc-300">취소</button>
                  <button type="button" onClick={() => handleSaveEdit(c.id)} className="rounded px-3 py-1 text-[11px] font-bold" style={{ background: `${accent}15`, color: accent }}>저장</button>
                </div>
              </div>
            ) : (
              <div style={{ fontSize: 14, color: "#ccc", lineHeight: 1.6, margin: 0, wordBreak: "keep-all" }}>
                <MarkdownContent content={c.content.replace(/@\[([^\]]+)\]\(([^)]+)\)/g, "[@$1](/profile/$2)")} />
              </div>
            )}
          </div>

          {/* Fact-check badge */}
          {factChecks[c.id] && (
            <div className={`mt-1 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-bold ${
              factChecks[c.id].verdict === "확인됨" ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300" :
              factChecks[c.id].verdict === "의심" ? "border-amber-400/30 bg-amber-400/10 text-amber-300" :
              factChecks[c.id].verdict === "거짓" ? "border-red-400/30 bg-red-400/10 text-red-300" :
              "border-zinc-600 bg-zinc-800 text-zinc-400"
            }`}>팩트체크: {factChecks[c.id].verdict}</div>
          )}

          {/* Actions: vote + reply — hover only */}
          <div className="hidden group-hover/msg:flex" style={{ gap: 6, marginTop: 4, alignItems: "center" }}>
            <button
              type="button"
              onClick={() => handleReact(c.id, "like")}
              disabled={reactingId === c.id || isClosed}
              style={{
                display: "inline-flex", alignItems: "center", gap: 4,
                padding: "2px 8px", borderRadius: 12, fontSize: 11,
                border: voted ? `1px solid ${accent}55` : "1px solid rgba(255,255,255,0.05)",
                background: voted ? `${accent}10` : "transparent",
                color: voted ? accent : "#555", cursor: "pointer",
                fontWeight: 600, transition: "all 0.12s",
              }}
            >
              {voted ? "\u25B2" : "\u25B3"} {likeCount}
            </button>
            {!isClosed && (
              <button
                type="button"
                onClick={() => {
                  toggleReplies(c.id)
                  if (!expandedReplies.has(c.id)) setReplyingTo(c.id)
                }}
                style={{
                  padding: "2px 8px", borderRadius: 12, fontSize: 10,
                  border: "1px solid rgba(255,255,255,0.04)", background: "transparent",
                  color: "#444", cursor: "pointer", transition: "all 0.12s",
                }}
              >
                답글{replies.length > 0 ? ` ${replies.length}` : ""}
              </button>
            )}
          </div>
          {/* Always show vote count if voted */}
          {voted && (
            <div className="group-hover/msg:hidden" style={{ marginTop: 4 }}>
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 4,
                padding: "2px 8px", borderRadius: 12, fontSize: 11,
                border: `1px solid ${accent}55`, background: `${accent}10`,
                color: accent, fontWeight: 600,
              }}>
                {"\u25B2"} {likeCount}
              </span>
            </div>
          )}
          {/* Always show reply count badge if has replies and not hovered */}
          {!voted && replies.length > 0 && (
            <div className="group-hover/msg:hidden" style={{ marginTop: 4 }}>
              <button
                type="button"
                onClick={() => toggleReplies(c.id)}
                style={{
                  padding: "2px 8px", borderRadius: 12, fontSize: 10,
                  border: "1px solid rgba(255,255,255,0.04)", background: "transparent",
                  color: "#444", cursor: "pointer",
                }}
              >
                답글 {replies.length}
              </button>
            </div>
          )}

          {/* Replies — collapsible inline */}
          {repliesExpanded && (
            <div style={{ marginTop: 8, paddingLeft: 12, borderLeft: `1px solid ${accent}15`, display: "flex", flexDirection: "column", gap: 6 }}>
              {replies.map(reply => {
                const rLike = counts[reply.id]?.like ?? reply.likeCount
                const rVoted = (my[reply.id] ?? null) === "like"
                const rIsOwn = user?.id === reply.userId
                return (
                  <div key={reply.id} className="group/reply relative" style={{ display: "flex", gap: 8 }}>
                    {/* Reply avatar */}
                    <div style={{
                      width: 24, height: 24, borderRadius: 8, flexShrink: 0,
                      background: `${accent}10`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 10, fontWeight: 700, color: accent, marginTop: 1,
                    }}>
                      {reply.displayName.slice(0, 1)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span style={{ fontSize: 11, fontWeight: 700, color: "#888" }}>{reply.displayName}</span>
                        <span style={{ fontSize: 9, color: "#444" }} suppressHydrationWarning>{mounted ? timeAgo(reply.created_at) : ""}</span>
                        {rIsOwn && !isClosed && editingId !== reply.id && (
                          <div className="hidden items-center gap-0.5 group-hover/reply:flex">
                            <button type="button" onClick={() => handleStartEdit(reply.id, reply.content)} className="rounded p-0.5 text-zinc-600 hover:text-zinc-300"><Pencil className="size-2.5" /></button>
                            <button type="button" onClick={() => handleDelete(reply.id)} className="rounded p-0.5 text-zinc-600 hover:text-red-400"><Trash2 className="size-2.5" /></button>
                          </div>
                        )}
                      </div>
                      {editingId === reply.id ? (
                        <div className="space-y-1">
                          <textarea value={editContent} onChange={e => setEditContent(e.target.value)} rows={2} maxLength={500} className="w-full resize-none rounded border border-white/[0.08] bg-black/60 px-2 py-1 text-[12px] text-zinc-100 outline-none" />
                          <div className="flex justify-end gap-1">
                            <button type="button" onClick={handleCancelEdit} className="text-[10px] text-zinc-500">취소</button>
                            <button type="button" onClick={() => handleSaveEdit(reply.id)} className="text-[10px] font-bold" style={{ color: accent }}>저장</button>
                          </div>
                        </div>
                      ) : (
                        <div style={{ fontSize: 12, lineHeight: 1.5, color: "#999" }}>
                          <MarkdownContent content={reply.content.replace(/@\[([^\]]+)\]\(([^)]+)\)/g, "[@$1](/profile/$2)")} />
                        </div>
                      )}
                      <button type="button" onClick={() => handleReact(reply.id, "like")} disabled={reactingId === reply.id} className="mt-0.5 inline-flex items-center gap-1 text-[10px] transition" style={{ color: rVoted ? accent : "#444" }}>
                        {rVoted ? "\u25B2" : "\u25B3"} {rLike > 0 ? rLike : ""}
                      </button>
                    </div>
                  </div>
                )
              })}

              {/* Reply composer */}
              {replyingTo === c.id && !isClosed && (
                <div style={{ marginTop: 4 }}>
                  <CommentComposer
                    threadId={threadId}
                    fixedSide={c.side ?? undefined}
                    parentId={c.id}
                    onSubmitted={() => setReplyingTo(null)}
                    template={template}
                    variant="fixed-bar"
                  />
                </div>
              )}

              {/* Write reply button if composer not open */}
              {replyingTo !== c.id && !isClosed && (
                <button
                  type="button"
                  onClick={() => setReplyingTo(c.id)}
                  style={{
                    padding: "4px 10px", borderRadius: 10, fontSize: 11,
                    border: "1px solid rgba(255,255,255,0.04)", background: "transparent",
                    color: "#444", cursor: "pointer", alignSelf: "flex-start",
                  }}
                >
                  답글 쓰기
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: "#0a0a0f", color: "#eee" }}>
      {/* ═══ HEADER ═══ */}
      <header className="px-3 py-2 md:px-5 md:py-3" style={{
        background: "#0a0a0f",
        borderBottom: "1px solid rgba(255,255,255,0.04)",
        flexShrink: 0,
      }}>
        {/* 1줄: ← + 메타 + 액션 */}
        <div className="flex items-center gap-2">
          <Link href="/" className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.03] text-zinc-500 transition hover:bg-white/[0.06] hover:text-zinc-200" style={{ fontSize: 18 }}>
            {"\u2190"}
          </Link>
          <div className="flex min-w-0 flex-1 items-center gap-2">
            {countdown}
            <span className="whitespace-nowrap text-[11px] text-zinc-600">
              {participantCount}명 참여
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => setToolsOpen(true)}
              className="inline-flex size-9 items-center justify-center rounded-lg border border-emerald-400/25 bg-emerald-400/8 text-emerald-300 transition hover:bg-emerald-400/15 md:h-8 md:w-auto md:gap-1.5 md:px-3"
            >
              <Settings2 className="size-3.5" />
              <span className="hidden md:inline text-[12px] font-medium">도구</span>
            </button>
            {headerActions}
          </div>
        </div>

        {/* 2줄: 찬반 비율 바 */}
        <div className="mt-2 flex items-center gap-2">
          <span style={{ fontSize: 11, fontWeight: 800, color: PRO, fontFamily: "var(--font-orbitron), monospace", minWidth: 32 }}>{proPercent}%</span>
          <div style={{ flex: 1, display: "flex", height: 3, borderRadius: 2, gap: 2 }}>
            <div style={{ width: `${proPercent}%`, background: PRO, borderRadius: 2, transition: "width 0.5s" }} />
            <div style={{ width: `${conPercent}%`, background: CON, borderRadius: 2, transition: "width 0.5s" }} />
          </div>
          <span style={{ fontSize: 11, fontWeight: 800, color: CON, fontFamily: "var(--font-orbitron), monospace", minWidth: 32, textAlign: "right" }}>{conPercent}%</span>
        </div>
      </header>

      {/* ═══ TITLE AREA ═══ */}
      <div style={{ background: "#0a0a0f", position: "relative", zIndex: 10, padding: "12px 16px", flexShrink: 0 }}>
        <h1 style={{ fontSize: 18, fontWeight: 800, color: "#eee", wordBreak: "keep-all", overflowWrap: "break-word", lineHeight: 1.4, margin: 0, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
          {title}
        </h1>
        {description && (
          <p style={{ fontSize: 13, color: "#888", lineHeight: 1.6, marginTop: 6, wordBreak: "keep-all", overflowWrap: "break-word", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
            {description}
          </p>
        )}
      </div>

      {/* ═══ CLOSED BANNER ═══ */}
      {isClosed && (
        <div className="px-3 md:px-6" style={{ flexShrink: 0 }}>
          <div style={{ marginTop: 8 }} className="rounded-xl border border-red-500/20 bg-red-500/[0.03] px-4 py-2.5 text-center text-[12px] font-bold tracking-wide text-red-400/80">
            DEBATE CLOSED — 이 토론은 마감되었습니다
          </div>
        </div>
      )}

      {/* ═══ CHAT FEED ═══ */}
      <div
        ref={feedRef}
        className="p-4 pb-24 md:px-6 md:pb-4"
        style={{
          flex: 1, overflowY: "auto",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Load more (at top of feed) */}
          {hasMore && (
            <div className="flex justify-center py-2">
              <button type="button" onClick={loadMore} disabled={loadingMore} className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.06] bg-white/[0.02] px-5 py-2 text-[11px] font-bold text-zinc-500 hover:bg-white/[0.04] disabled:opacity-40">
                {loadingMore && <Loader2 className="size-3 animate-spin" />}
                {loadingMore ? "불러오는 중…" : "이전 의견 더 보기"}
              </button>
            </div>
          )}

          {/* Start marker */}
          <div style={{ textAlign: "left", padding: "4px 0 4px 46px", fontSize: 11, color: "#333" }}>
            토론이 시작되었습니다
          </div>

          {feed.map(msg => renderBubble(msg))}

          {feed.length === 0 && (
            <div style={{ textAlign: "center", padding: "40px 0", fontSize: 14, color: "#444" }}>
              아직 의견이 없습니다. 첫 번째 의견을 남겨보세요!
            </div>
          )}
        </div>
      </div>

      {/* ═══ INPUT BAR ═══ */}
      {!isClosed && (
        <div style={{
          flexShrink: 0,
          display: "flex", alignItems: "center", gap: 6,
          padding: "10px 16px",
          marginBottom: 60,
          background: "rgba(14,14,20,0.95)", backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderTop: "1px solid rgba(255,255,255,0.03)",
        }}>
          {/* Side toggle — compact pills */}
          <div style={{ display: "flex", gap: 3, flexShrink: 0 }}>
            {([
              { id: "pro" as const, label: "찬성", color: PRO },
              { id: "con" as const, label: "반대", color: CON },
            ]).map(s => (
              <button
                key={s.id}
                type="button"
                onClick={() => setInputSide(s.id)}
                style={{
                  padding: "5px 12px", borderRadius: 16, fontSize: 11, fontWeight: 700,
                  border: inputSide === s.id ? `1.5px solid ${s.color}` : "1px solid rgba(255,255,255,0.06)",
                  background: inputSide === s.id ? `${s.color}12` : "transparent",
                  color: inputSide === s.id ? s.color : "#555",
                  cursor: "pointer", transition: "all 0.15s",
                }}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* Composer — fills remaining space */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <CommentComposer
              threadId={threadId}
              fixedSide={inputSide}
              template={template}
              variant="fixed-bar"
            />
          </div>
        </div>
      )}

      {/* ═══ TOOLS SLIDE-IN PANEL ═══ */}
      {toolsOpen && (
        <>
          <div
            onClick={() => setToolsOpen(false)}
            style={{
              position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)",
              zIndex: 199, animation: "procon-fadein-anim 0.15s ease",
            }}
          />
          <div style={{
            position: "fixed", top: 0, right: 0, width: "min(340px, 90vw)", height: "100vh",
            background: "rgba(14,14,20,0.98)", backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            borderLeft: "1px solid rgba(255,255,255,0.04)",
            zIndex: 200, overflowY: "auto", padding: 24,
            animation: "procon-slidein 0.2s ease",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
              <span style={{ fontSize: 16, fontWeight: 800, color: "#eee" }}>도구 & 분석</span>
              <button
                type="button"
                onClick={() => setToolsOpen(false)}
                style={{
                  width: 32, height: 32, borderRadius: 8,
                  border: "1px solid rgba(255,255,255,0.06)", background: "transparent",
                  color: "#666", fontSize: 14, cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
                className="hover:bg-white/[0.04] hover:text-white transition"
              >
                {"\u2715"}
              </button>
            </div>

            <div className="flex flex-col gap-3">
              {toolsBlock}
            </div>
          </div>
        </>
      )}

      {/* Report modal */}
      {reportTarget && (
        <ReportModal isOpen={true} onClose={() => setReportTarget(null)} targetType={reportTarget.targetType} targetId={reportTarget.targetId} targetUserId={reportTarget.targetUserId} />
      )}
    </div>
  )
}
