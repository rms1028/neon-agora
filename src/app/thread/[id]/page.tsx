import { cache } from "react"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

import type { Metadata } from "next"
import { supabase } from "@/lib/supabase"
import { getDisplayName } from "@/lib/utils"
import { BattleComments } from "@/components/battle-comments"
import { ProConBattle } from "@/components/procon-battle"
import { CyberJudgePanel, type JudgeResult } from "@/components/cyber-judge-panel"
import { ShareButton } from "@/components/share-button"
import { ThreadEditButton } from "@/components/thread-edit-button"
import { MuteButton } from "./mute-button"
import { CountdownWrapper } from "./countdown-wrapper"
import { AutoSummaryCard, type AutoSummary } from "@/components/auto-summary-card"
import { DebateReplay } from "@/components/debate-replay"
import { AIDebatePanel } from "@/components/ai-debate-panel"
import { XpGate } from "@/components/xp-gate"

export const revalidate = 15

type ThreadRow = Record<string, unknown>

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

function pickSide(value: unknown): "pro" | "con" | null {
  if (value === "pro" || value === "con") return value
  return null
}

const getThread = cache(async (id: string) => {
  const { data } = await supabase
    .from("threads")
    .select("*")
    .eq("id", id)
    .maybeSingle()
  return data
})

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const thread = await getThread(id)
  if (!thread) return { title: "토론을 찾을 수 없습니다 | 네온 아고라" }

  const t = thread as Record<string, unknown>
  const title = String(t.title ?? "토론")
  const pro = Number(t.pro_count) || 0
  const con = Number(t.con_count) || 0
  const desc = `찬성 ${pro} vs 반대 ${con} — ${String(t.content ?? "").slice(0, 120)}`
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://neon-agora.vercel.app"
  const ogImage = `${siteUrl}/og-default.png`

  return {
    title: `${title} | 네온 아고라`,
    description: desc,
    alternates: { canonical: `${siteUrl}/thread/${id}` },
    openGraph: { title, description: desc, type: "article", url: `${siteUrl}/thread/${id}`, images: [{ url: ogImage, width: 1200, height: 630, alt: title }] },
    twitter: { card: "summary_large_image", title, description: desc, images: [ogImage] },
  }
}

export default async function ThreadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const thread = await getThread(id)

  if (!thread) {
    return (
      <div className="min-h-screen text-zinc-100" style={{ background: "#0a0f14" }}>
        <div className="relative mx-auto w-full max-w-4xl px-4 py-12">
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-200">
            <ArrowLeft className="size-4" /> 홈으로
          </Link>
          <div className="mt-8 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8 text-center backdrop-blur">
            <div className="text-lg font-semibold text-zinc-100">토론을 찾을 수 없어요</div>
            <div className="mt-2 text-sm text-zinc-500">존재하지 않거나 삭제된 토론일 수 있어요.</div>
          </div>
        </div>
      </div>
    )
  }

  /* ─── Parse thread data ─── */
  const row = thread as ThreadRow
  const title = pickString(row, ["title", "subject", "name"], "제목 없는 토론")
  const createdBy = typeof row.created_by === "string" ? row.created_by : ""
  const template = typeof row.template === "string" ? row.template : "free"
  const content = pickString(row, ["content", "description", "body"], "")
  const tag = pickString(row, ["tag"], "")
  const threadUpdatedAt = typeof row.updated_at === "string" ? row.updated_at : null
  const proCount = Math.max(0, pickNumber(row, ["pro_count", "proCount"], 0))
  const conCount = Math.max(0, pickNumber(row, ["con_count", "conCount"], 0))
  const totalVotes = proCount + conCount
  const yesPct = totalVotes > 0 ? Math.round((proCount / totalVotes) * 100) : 50
  const noPct = Math.max(0, Math.min(100, 100 - yesPct))

  const expiresAt = typeof row.expires_at === "string" ? row.expires_at : null
  let isClosed = row.is_closed === true
  if (!isClosed && expiresAt && new Date(expiresAt).getTime() <= Date.now()) isClosed = true

  /* ─── Parse AI data ─── */
  let aiSummary: JudgeResult | null = null
  if (row.ai_summary) {
    let parsed: unknown = row.ai_summary
    if (typeof parsed === "string") { try { parsed = JSON.parse(parsed) } catch { parsed = null } }
    if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed) && (parsed as JudgeResult).pro_summary) {
      aiSummary = parsed as JudgeResult
    }
  }
  const aiVerdict = typeof row.ai_verdict === "string" ? row.ai_verdict : null

  let autoSummary: AutoSummary | null = null
  if (row.ai_auto_summary) {
    let parsedAuto: unknown = row.ai_auto_summary
    if (typeof parsedAuto === "string") { try { parsedAuto = JSON.parse(parsedAuto) } catch { parsedAuto = null } }
    if (parsedAuto !== null && typeof parsedAuto === "object" && !Array.isArray(parsedAuto) && Array.isArray((parsedAuto as AutoSummary).key_points)) {
      autoSummary = parsedAuto as AutoSummary
    }
  }

  /* ─── Fetch comments ─── */
  const PAGE_SIZE = 20
  const { data: topLevelComments, count: totalTopLevel } = await supabase
    .from("comments")
    .select("id, content, created_at, user_id, side, parent_id, updated_at, is_deleted, is_pinned", { count: "exact" })
    .eq("thread_id", id).is("parent_id", null).order("created_at", { ascending: false }).limit(PAGE_SIZE)

  const topLevelIds = (topLevelComments ?? []).map((c) => String((c as Record<string, unknown>)?.id ?? "")).filter((v) => v.length > 0)

  let replyComments: typeof topLevelComments = []
  if (topLevelIds.length > 0) {
    const { data: replies } = await supabase.from("comments").select("id, content, created_at, user_id, side, parent_id, updated_at, is_deleted, is_pinned").eq("thread_id", id).in("parent_id", topLevelIds).order("created_at", { ascending: true })
    replyComments = replies ?? []
  }

  const commentsAll = [...(topLevelComments ?? []), ...(replyComments ?? [])]
  const hasMoreComments = (totalTopLevel ?? 0) > PAGE_SIZE
  const lastTopLevel = topLevelComments?.length ? topLevelComments[topLevelComments.length - 1] as Record<string, unknown> : null
  const nextCursor = hasMoreComments && lastTopLevel ? { created_at: String(lastTopLevel.created_at ?? ""), id: String(lastTopLevel.id ?? "") } : null

  const commentIds = (commentsAll ?? []).map((c) => String((c as Record<string, unknown>)?.id ?? "")).filter((v) => v.length > 0)
  const commentUserIds = [...new Set((commentsAll ?? []).map((c) => String((c as Record<string, unknown>)?.user_id ?? "")).filter((v) => v.length > 0))]

  const [reactionsResult, profilesResult, pollsResult] = await Promise.all([
    commentIds.length > 0 ? supabase.from("comment_reactions").select("comment_id, reaction").in("comment_id", commentIds) : Promise.resolve({ data: null, error: null }),
    commentUserIds.length > 0 ? supabase.from("profiles").select("id, custom_title, display_name").in("id", commentUserIds) : Promise.resolve({ data: null }),
    commentIds.length > 0 ? supabase.from("comment_polls").select("id, comment_id, question, pro_count, con_count").in("comment_id", commentIds) : Promise.resolve({ data: null }),
  ])

  const reactionCounts: Record<string, { like: number; fire: number; clap: number; think: number }> = {}
  if (!reactionsResult.error) {
    for (const r of reactionsResult.data ?? []) {
      const rr = r as Record<string, unknown>; const cid = String(rr?.comment_id ?? ""); if (!cid) continue
      const cur = reactionCounts[cid] ?? { like: 0, fire: 0, clap: 0, think: 0 }
      if (rr?.reaction === "like") cur.like += 1
      if (rr?.reaction === "fire") cur.fire += 1
      if (rr?.reaction === "clap") cur.clap += 1
      if (rr?.reaction === "think") cur.think += 1
      reactionCounts[cid] = cur
    }
  }

  const userTitleMap: Record<string, string | null> = {}; const userNameMap: Record<string, string | null> = {}
  for (const p of profilesResult.data ?? []) {
    const pr = p as Record<string, unknown>; const uid = String(pr.id ?? "")
    userTitleMap[uid] = typeof pr.custom_title === "string" ? pr.custom_title : null
    userNameMap[uid] = typeof pr.display_name === "string" ? pr.display_name : null
  }

  const pollMap: Record<string, { pollId: string; question: string; proCount: number; conCount: number }> = {}
  for (const p of pollsResult.data ?? []) {
    const pr = p as Record<string, unknown>; const cid = String(pr.comment_id ?? "")
    if (cid) pollMap[cid] = { pollId: String(pr.id ?? ""), question: String(pr.question ?? ""), proCount: Number(pr.pro_count) || 0, conCount: Number(pr.con_count) || 0 }
  }

  const commentDtos = (commentsAll ?? []).map((c, idx) => {
    const cRow = c as Record<string, unknown>
    const createdRaw = cRow?.created_at; const created = typeof createdRaw === "string" && createdRaw.trim().length > 0 ? createdRaw : null
    const rawUserId = cRow?.user_id; const userIdStr = typeof rawUserId === "string" ? rawUserId : String(rawUserId ?? "")
    const commentId = typeof cRow?.id === "string" && (cRow.id as string).trim().length > 0 ? cRow.id as string : `missing-${id}-${idx}`
    const rawParentId = cRow?.parent_id; const parentId = typeof rawParentId === "string" && rawParentId.trim().length > 0 ? rawParentId : null
    const rawUpdatedAt = cRow?.updated_at; const updatedAt = typeof rawUpdatedAt === "string" && rawUpdatedAt.trim().length > 0 ? rawUpdatedAt : null

    return {
      id: commentId, content: String(cRow?.content ?? ""), created_at: created,
      side: template === "free" ? null : pickSide(cRow?.side),
      userId: userIdStr, parentId, displayName: getDisplayName({ id: userIdStr, display_name: userNameMap[userIdStr] }),
      likeCount: reactionCounts[commentId]?.like ?? 0,
      fireCount: reactionCounts[commentId]?.fire ?? 0,
      clapCount: reactionCounts[commentId]?.clap ?? 0,
      thinkCount: reactionCounts[commentId]?.think ?? 0,
      dislikeCount: 0,
      updatedAt, isDeleted: cRow?.is_deleted === true, isPinned: cRow?.is_pinned === true,
      customTitle: userTitleMap[userIdStr] ?? null, poll: pollMap[commentId] ?? null,
    }
  })

  const isStrict = template === "strict"

  /* ═══════════════════════════════════════════
     STRICT TEMPLATE → ProConBattle
     ═══════════════════════════════════════════ */
  if (isStrict) {
    const proCommentCount = commentDtos.filter(c => c.side === "pro" && !c.isDeleted && !c.parentId).length
    const conCommentCount = commentDtos.filter(c => c.side === "con" && !c.isDeleted && !c.parentId).length

    const isImbalanced = Math.abs(proCommentCount - conCommentCount) >= 2
    const weakerSide = proCommentCount < conCommentCount ? "찬성" : "반대"

    const proconToolsBlock = (
      <>
        <CyberJudgePanel threadId={id} initialSummary={aiSummary} initialVerdict={aiVerdict} isClosed={isClosed} proCommentCount={proCommentCount} conCommentCount={conCommentCount} />
        {/* AI 반론 생성기 (replaces AIDebatePanel) */}
        {!isClosed && (
          <div style={{ padding: "14px 16px", borderRadius: 14, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#bbb" }}>AI 반론 생성기</span>
            </div>
            {isImbalanced ? (
              <>
                <p style={{ fontSize: 10, color: "#666", lineHeight: 1.4, marginBottom: 6 }}>
                  <strong style={{ color: weakerSide === "찬성" ? "#00e4a5" : "#ff4d8d" }}>{weakerSide}</strong> 측 의견이 부족합니다
                </p>
                <XpGate requiredXp={30}>
                  <AIDebatePanel threadId={id} threadTitle={title} />
                </XpGate>
              </>
            ) : (
              <p style={{ fontSize: 10, color: "#555", lineHeight: 1.4 }}>양쪽 의견이 균형을 이루고 있습니다</p>
            )}
          </div>
        )}
        <AutoSummaryCard threadId={id} commentCount={commentDtos.length} initialSummary={autoSummary} />
        {isClosed && <DebateReplay threadId={id} />}
      </>
    )

    const headerActions = (
      <>
        <ThreadEditButton threadId={id} threadCreatedBy={createdBy} initialTitle={title} initialContent={content} initialTag={tag} isClosed={isClosed} />
        <MuteButton threadId={id} />
        <ShareButton title={title} threadId={id} />
      </>
    )

    const countdownSlot = <CountdownWrapper expiresAt={expiresAt} isClosed={isClosed} threadId={id} />

    return (
      <ProConBattle
        threadId={id} title={title} description={content} tag={tag} isClosed={isClosed}
        threadCreatedBy={createdBy} template={template}
        proPercent={yesPct} conPercent={noPct} totalVotes={totalVotes}
        proCount={proCount} conCount={conCount}
        expiresAt={expiresAt} threadUpdatedAt={threadUpdatedAt}
        comments={commentDtos}
        hasMoreComments={hasMoreComments} nextCursor={nextCursor}
        headerActions={headerActions} countdown={countdownSlot}
        toolsBlock={proconToolsBlock}
      />
    )
  }

  /* ═══════════════════════════════════════════
     FREE TEMPLATE → Card Grid (BattleComments)
     ═══════════════════════════════════════════ */
  return (
    <div className="flex h-full flex-col overflow-hidden text-zinc-100" style={{ background: "#0a0f14" }}>
      {/* ═══ Header bar ═══ */}
      <div className="shrink-0 border-b border-white/[0.04] px-3 py-2 md:px-6" style={{ background: "#0a0f14", position: "relative", zIndex: 10 }}>
        <div className="flex items-center gap-2">
          <Link href="/" className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.03] text-zinc-500 transition hover:bg-white/[0.06] hover:text-zinc-200">
            <ArrowLeft className="size-4" />
          </Link>
          <div className="flex min-w-0 flex-1 items-center gap-2">
            {tag && <span className="whitespace-nowrap text-[10px] font-bold tracking-wider text-zinc-600">#{tag}</span>}
            {threadUpdatedAt && <span className="whitespace-nowrap text-[9px] text-zinc-700">(수정됨)</span>}
            <CountdownWrapper expiresAt={expiresAt} isClosed={isClosed} threadId={id} />
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <ShareButton title={title} threadId={id} />
            <ThreadEditButton threadId={id} threadCreatedBy={createdBy} initialTitle={title} initialContent={content} initialTag={tag} isClosed={isClosed} />
            <MuteButton threadId={id} />
          </div>
        </div>
      </div>

      {/* ═══ Title area ═══ */}
      <div className="shrink-0" style={{ background: "#0a0f14", position: "relative", zIndex: 10, padding: "12px 16px" }}>
        <h1 style={{ fontSize: 18, fontWeight: 800, color: "#eee", wordBreak: "keep-all", overflowWrap: "break-word", lineHeight: 1.4, margin: 0, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
          {title}
        </h1>
        {content && (
          <p style={{ fontSize: 13, color: "#888", lineHeight: 1.6, marginTop: 6, wordBreak: "keep-all", overflowWrap: "break-word", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
            {content}
          </p>
        )}
      </div>

      {/* ═══ Card Grid ═══ */}
      <div className="flex-1 min-h-0 pb-20 md:pb-0">
        <BattleComments
          threadId={id} comments={commentDtos} isClosed={isClosed}
          threadCreatedBy={createdBy} template="free"
          hasMoreComments={hasMoreComments} nextCursor={nextCursor}
        />
      </div>
    </div>
  )
}
