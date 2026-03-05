import { cache } from "react"
import Link from "next/link"
import { ArrowLeft, Clock, MessageSquareText, ThumbsDown, ThumbsUp, Users } from "lucide-react"

import type { Metadata } from "next"
import { supabase } from "@/lib/supabase"
import { getDisplayName, timeAgo } from "@/lib/utils"
import { BattleComments } from "@/components/battle-comments"
import { HallOfFame, type HallOfFameComment } from "@/components/hall-of-fame"
import { CyberJudgePanel, type JudgeResult } from "@/components/cyber-judge-panel"
import { ShareButton } from "@/components/share-button"
import { ThreadEditButton } from "@/components/thread-edit-button"
import { MuteButton } from "./mute-button"
import { CountdownWrapper } from "./countdown-wrapper"
import { LiveDebatePanel } from "@/components/live-debate-panel"
import { VoteTrendChart } from "@/components/vote-trend-chart"
import { VoteActivityFeed } from "@/components/vote-activity-feed"
import { AutoSummaryCard, type AutoSummary } from "@/components/auto-summary-card"
import { ThreadTimeline } from "@/components/thread-timeline"

import { DebateReplay } from "@/components/debate-replay"
import { AIDebatePanel } from "@/components/ai-debate-panel"
import { DuelPanel } from "@/components/duel-panel"
import { ClashReportPanel } from "@/components/clash-report-panel"
import { SideChampions } from "@/components/side-champions"
import { ToolDrawer } from "@/components/tool-drawer"
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

function formatDateTime(value: unknown) {
  return timeAgo(String(value ?? ""))
}

function pickSide(value: unknown): "pro" | "con" | null {
  if (value === "pro" || value === "con") return value
  return null
}

// 요청 내 중복 쿼리 방지 (generateMetadata + page 컴포넌트)
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

  if (!thread) {
    return { title: "토론을 찾을 수 없습니다 | 네온 아고라" }
  }

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
    openGraph: {
      title,
      description: desc,
      type: "article",
      url: `${siteUrl}/thread/${id}`,
      images: [{ url: ogImage, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: desc,
      images: [ogImage],
    },
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
      <div className="min-h-screen bg-black text-zinc-100">
        <div className="relative mx-auto w-full max-w-4xl px-4 py-12">
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-200">
            <ArrowLeft className="size-4" /> 홈으로
          </Link>
          <div className="mt-8 rounded-2xl border border-white/10 bg-black/40 p-8 text-center backdrop-blur">
            <div className="text-lg font-semibold text-zinc-100">
              토론을 찾을 수 없어요
            </div>
            <div className="mt-2 text-sm text-zinc-400">
              존재하지 않거나 삭제된 토론일 수 있어요.
            </div>
          </div>
        </div>
      </div>
    )
  }

  const row = thread as ThreadRow
  const title = pickString(row, ["title", "subject", "name"], "제목 없는 토론")

  // AI 판결 데이터 (JSONB가 string으로 올 수 있으므로 파싱 방어)
  let aiSummary: JudgeResult | null = null
  if (row.ai_summary) {
    let parsed: unknown = row.ai_summary
    if (typeof parsed === "string") {
      try { parsed = JSON.parse(parsed) } catch { parsed = null }
    }
    if (
      parsed !== null &&
      typeof parsed === "object" &&
      !Array.isArray(parsed) &&
      (parsed as JudgeResult).pro_summary
    ) {
      aiSummary = parsed as JudgeResult
    }
  }
  const aiVerdict =
    typeof row.ai_verdict === "string" ? row.ai_verdict : null

  // Clash Report 파싱 (ai_summary.clash_report)
  type ClashReport = {
    momentum: "pro" | "con" | "even"
    pro_summary: string
    con_summary: string
    key_arguments: { side: "pro" | "con"; point: string }[]
    verdict_hint: string
    generated_at: string
  }
  let clashReport: ClashReport | null = null
  if (row.ai_summary) {
    let parsedCR: unknown = row.ai_summary
    if (typeof parsedCR === "string") {
      try { parsedCR = JSON.parse(parsedCR) } catch { parsedCR = null }
    }
    if (parsedCR && typeof parsedCR === "object" && !Array.isArray(parsedCR)) {
      const cr = (parsedCR as Record<string, unknown>).clash_report
      if (cr && typeof cr === "object" && !Array.isArray(cr)) {
        clashReport = cr as ClashReport
      }
    }
  }

  // AI 자동 요약 파싱
  let autoSummary: AutoSummary | null = null
  if (row.ai_auto_summary) {
    let parsedAuto: unknown = row.ai_auto_summary
    if (typeof parsedAuto === "string") {
      try { parsedAuto = JSON.parse(parsedAuto) } catch { parsedAuto = null }
    }
    if (
      parsedAuto !== null &&
      typeof parsedAuto === "object" &&
      !Array.isArray(parsedAuto) &&
      Array.isArray((parsedAuto as AutoSummary).key_points)
    ) {
      autoSummary = parsedAuto as AutoSummary
    }
  }

  const expiresAt = typeof row.expires_at === "string" ? row.expires_at : null
  let isClosed = row.is_closed === true

  // SSR 만료 감지: expires_at이 지났으면 UI에서 즉시 마감 처리 (실제 DB 업데이트는 클라이언트 CountdownWrapper + Cron이 처리)
  if (!isClosed && expiresAt && new Date(expiresAt).getTime() <= Date.now()) {
    isClosed = true
  }

  const closedAt = typeof row.closed_at === "string" ? row.closed_at : null
  const createdBy = typeof row.created_by === "string" ? row.created_by : ""
  const template = typeof row.template === "string" ? row.template : "free"
  const content = pickString(row, ["content", "description", "body"], "")
  const tag = pickString(row, ["tag"], "")
  const threadUpdatedAt = typeof row.updated_at === "string" ? row.updated_at : null
  const proCount = Math.max(0, pickNumber(row, ["pro_count", "proCount"], 0))
  const conCount = Math.max(0, pickNumber(row, ["con_count", "conCount"], 0))
  const totalVotes = proCount + conCount
  const yesPct =
    totalVotes > 0 ? Math.round((proCount / totalVotes) * 100) : 50
  const noPct = Math.max(0, Math.min(100, 100 - yesPct))

  const PAGE_SIZE = 20

  // top-level 댓글만 20개 + 총 개수
  const { data: topLevelComments, count: totalTopLevel } = await supabase
    .from("comments")
    .select("id, content, created_at, user_id, side, parent_id, updated_at, is_deleted, is_pinned", { count: "exact" })
    .eq("thread_id", id)
    .is("parent_id", null)
    .order("created_at", { ascending: false })
    .limit(PAGE_SIZE)

  const topLevelIds = (topLevelComments ?? [])
    .map((c) => String((c as Record<string, unknown>)?.id ?? ""))
    .filter((v) => v.length > 0)

  // top-level의 replies 로드
  let replyComments: typeof topLevelComments = []
  if (topLevelIds.length > 0) {
    const { data: replies } = await supabase
      .from("comments")
      .select("id, content, created_at, user_id, side, parent_id, updated_at, is_deleted, is_pinned")
      .eq("thread_id", id)
      .in("parent_id", topLevelIds)
      .order("created_at", { ascending: true })
    replyComments = replies ?? []
  }

  const comments = [...(topLevelComments ?? []), ...(replyComments ?? [])]
  const hasMoreComments = (totalTopLevel ?? 0) > PAGE_SIZE

  // 다음 커서: 마지막 top-level 댓글
  const lastTopLevel = topLevelComments?.length
    ? topLevelComments[topLevelComments.length - 1] as Record<string, unknown>
    : null
  const nextCursor = hasMoreComments && lastTopLevel
    ? { created_at: String(lastTopLevel.created_at ?? ""), id: String(lastTopLevel.id ?? "") }
    : null

  const commentIds = (comments ?? [])
    .map((c) => String((c as Record<string, unknown>)?.id ?? ""))
    .filter((v) => v.length > 0)

  // 댓글 유저 ID 수집 (reactions/profiles/polls 3개 쿼리에 공용)
  const commentUserIds = [...new Set(
    (comments ?? [])
      .map((c) => String((c as Record<string, unknown>)?.user_id ?? ""))
      .filter((v) => v.length > 0)
  )]

  // reactions + profiles + polls 3개 쿼리 병렬 실행
  const [reactionsResult, profilesResult, pollsResult] = await Promise.all([
    // 리액션
    commentIds.length > 0
      ? supabase.from("comment_reactions").select("comment_id, reaction").in("comment_id", commentIds)
      : Promise.resolve({ data: null, error: null }),
    // 프로필
    commentUserIds.length > 0
      ? supabase.from("profiles").select("id, custom_title, display_name").in("id", commentUserIds)
      : Promise.resolve({ data: null }),
    // 폴
    commentIds.length > 0
      ? supabase.from("comment_polls").select("id, comment_id, question, pro_count, con_count").in("comment_id", commentIds)
      : Promise.resolve({ data: null }),
  ])

  const reactionCounts: Record<string, { like: number; dislike: number; fire: number }> = {}
  if (!reactionsResult.error) {
    for (const r of reactionsResult.data ?? []) {
      const row = r as Record<string, unknown>
      const cid = String(row?.comment_id ?? "")
      if (!cid) continue
      const cur = reactionCounts[cid] ?? { like: 0, dislike: 0, fire: 0 }
      if (row?.reaction === "like") cur.like += 1
      if (row?.reaction === "dislike") cur.dislike += 1
      if (row?.reaction === "fire") cur.fire += 1
      reactionCounts[cid] = cur
    }
  }

  const userTitleMap: Record<string, string | null> = {}
  const userNameMap: Record<string, string | null> = {}
  for (const p of profilesResult.data ?? []) {
    const pr = p as Record<string, unknown>
    const uid = String(pr.id ?? "")
    userTitleMap[uid] = typeof pr.custom_title === "string" ? pr.custom_title : null
    userNameMap[uid] = typeof pr.display_name === "string" ? pr.display_name : null
  }

  const pollMap: Record<string, { pollId: string; question: string; proCount: number; conCount: number }> = {}
  for (const p of pollsResult.data ?? []) {
    const pr = p as Record<string, unknown>
    const cid = String(pr.comment_id ?? "")
    if (cid) {
      pollMap[cid] = {
        pollId: String(pr.id ?? ""),
        question: String(pr.question ?? ""),
        proCount: Number(pr.pro_count) || 0,
        conCount: Number(pr.con_count) || 0,
      }
    }
  }

  const commentDtos = (comments ?? []).map((c, idx) => {
    const row = c as Record<string, unknown>
    const idRaw = row?.id
    const createdRaw = row?.created_at
    const created =
      typeof createdRaw === "string" && createdRaw.trim().length > 0
        ? createdRaw
        : null

    const rawUserId = row?.user_id
    const userIdStr = typeof rawUserId === "string" ? rawUserId : String(rawUserId ?? "")

    const commentId =
      typeof idRaw === "string" && idRaw.trim().length > 0
        ? idRaw
        : `missing-${id}-${idx}`

    const rawParentId = row?.parent_id
    const parentId = typeof rawParentId === "string" && rawParentId.trim().length > 0
      ? rawParentId
      : null

    const rawUpdatedAt = row?.updated_at
    const updatedAt = typeof rawUpdatedAt === "string" && rawUpdatedAt.trim().length > 0
      ? rawUpdatedAt : null

    return {
      id: commentId,
      content: String(row?.content ?? ""),
      created_at: created,
      side: pickSide(row?.side),
      userId: userIdStr,
      parentId,
      displayName: getDisplayName({ id: userIdStr, display_name: userNameMap[userIdStr] }),
      likeCount: reactionCounts[commentId]?.like ?? 0,
      dislikeCount: reactionCounts[commentId]?.dislike ?? 0,
      fireCount: reactionCounts[commentId]?.fire ?? 0,
      updatedAt,
      isDeleted: row?.is_deleted === true,
      isPinned: row?.is_pinned === true,
      customTitle: userTitleMap[userIdStr] ?? null,
      poll: pollMap[commentId] ?? null,
    }
  })

  // 양측 댓글 수 (AI 판사 조건 판별용)
  const proCommentCount = commentDtos.filter((c) => c.side === "pro" && !c.isDeleted).length
  const conCommentCount = commentDtos.filter((c) => c.side === "con" && !c.isDeleted).length

  // 명예의 전당 데이터
  const hallOfFameComments: HallOfFameComment[] = commentDtos
    .filter((c) => !c.isDeleted && !c.parentId)
    .map((c) => ({
      id: c.id,
      content: c.content,
      side: c.side,
      userId: c.userId,
      displayName: c.displayName,
      likeCount: c.likeCount,
      isPinned: c.isPinned,
      customTitle: c.customTitle,
    }))

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-black text-zinc-100">
      {/* ── 배경 이펙트 ── */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(1200px_circle_at_20%_10%,rgba(34,211,238,0.18),transparent_55%),radial-gradient(900px_circle_at_80%_20%,rgba(236,72,153,0.14),transparent_55%),radial-gradient(900px_circle_at_50%_90%,rgba(52,211,153,0.10),transparent_60%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.06),transparent_35%,rgba(255,255,255,0.04))] opacity-30" />
      </div>

      {/* ═══════════ 컴팩트 헤더 ═══════════ */}
      <header className={`relative shrink-0 border-b ${
        template === "free"
          ? "border-[#39FF14]/15 bg-gradient-to-r from-[#39FF14]/5 via-black/80 to-[#39FF14]/5"
          : "border-[#00FFD1]/15 bg-gradient-to-r from-[#00FFD1]/5 via-black/80 to-[#FF00FF]/5"
      } backdrop-blur`}>
        <div className="mx-auto max-w-7xl px-4 py-2.5 sm:px-6">
          {/* Row 1: 네비게이션 + 액션 */}
          <div className="flex items-center justify-between">
            <Link href="/" className="inline-flex items-center gap-1.5 text-xs text-zinc-500 transition hover:text-zinc-200">
              <ArrowLeft className="size-3.5" />
              <span className="hidden sm:inline">돌아가기</span>
            </Link>
            <div className="flex items-center gap-1.5">
              <ThreadEditButton
                threadId={id}
                threadCreatedBy={createdBy}
                initialTitle={title}
                initialContent={content}
                initialTag={tag}
                isClosed={isClosed}
              />
              <MuteButton threadId={id} />
              <ShareButton title={title} threadId={id} />
            </div>
          </div>

          {/* Row 2: 제목 + 배지 */}
          <div className="mt-1.5 flex items-center gap-2">
            <h1 className="min-w-0 flex-1 truncate text-base font-bold text-zinc-50 sm:text-lg">
              {title}
            </h1>
            {threadUpdatedAt && (
              <span className="shrink-0 rounded-full border border-zinc-400/20 bg-zinc-400/10 px-1.5 py-0.5 text-[9px] font-medium text-zinc-500">
                수정됨
              </span>
            )}
            <CountdownWrapper
              expiresAt={expiresAt}
              isClosed={isClosed}
              threadId={id}
            />
          </div>

          {/* Row 3: 본문 미리보기 (접을 수 있음) */}
          {content && (
            <details className="mt-1 group">
              <summary className="cursor-pointer text-xs leading-relaxed text-zinc-400 line-clamp-1 marker:text-zinc-600 group-open:line-clamp-none">
                {content}
              </summary>
            </details>
          )}

          {/* Row 4: 인라인 스탯 */}
          {template === "free" ? (
            <div className="mt-2 flex items-center gap-4 text-[11px]">
              <span className="inline-flex items-center gap-1 text-[#39FF14]/80">
                <Users className="size-3" /> {commentUserIds.length}명
              </span>
              <span className="inline-flex items-center gap-1 text-[#39FF14]/80">
                <MessageSquareText className="size-3" /> {commentDtos.length}개
              </span>
              <span className="inline-flex items-center gap-1 text-zinc-500">
                <Clock className="size-3" /> {formatDateTime(row.created_at)}
              </span>
            </div>
          ) : (
            <div className="mt-2 flex items-center gap-3">
              <span className="shrink-0 text-[11px] font-semibold text-[#00FFD1]">
                찬성 {yesPct}%
                {yesPct - noPct >= 5 && (
                  <span className="winning-badge ml-1 rounded-full border border-[#00FFD1]/40 bg-[#00FFD1]/15 px-1 py-px text-[8px] font-bold">WIN</span>
                )}
              </span>
              <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-[#FF00FF]/25">
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-[#00FFD1] transition-all"
                  style={{ width: `${yesPct}%` }}
                />
                <div className="pointer-events-none absolute inset-0 rounded-full ring-1 ring-white/10" />
              </div>
              <span className="shrink-0 text-[11px] font-semibold text-[#FF00FF]">
                {noPct - yesPct >= 5 && (
                  <span className="winning-badge mr-1 rounded-full border border-[#FF00FF]/40 bg-[#FF00FF]/15 px-1 py-px text-[8px] font-bold">WIN</span>
                )}
                반대 {noPct}%
              </span>
              <span className="shrink-0 text-[10px] text-zinc-600">
                ({proCount}:{conCount}, 총{totalVotes})
              </span>
            </div>
          )}
        </div>
      </header>

      {/* ═══════════ 도구 서랍 (자유 토론에서는 숨김) ═══════════ */}
      {template !== "free" && (
        <ToolDrawer template={template}>
          {/* 찬반 격돌: 투표 상세 + 트렌드 */}
          {template === "strict" && (
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-xl border border-[#00FFD1]/15 bg-[#00FFD1]/5 p-2.5">
                <div className="text-[9px] text-[#00FFD1]/60">찬성</div>
                <div className="mt-0.5 inline-flex items-center gap-1.5 text-sm font-semibold text-[#00FFD1]">
                  <ThumbsUp className="size-3" /> {proCount}
                </div>
              </div>
              <div className="rounded-xl border border-[#FF00FF]/15 bg-[#FF00FF]/5 p-2.5">
                <div className="text-[9px] text-[#FF00FF]/60">반대</div>
                <div className="mt-0.5 inline-flex items-center gap-1.5 text-sm font-semibold text-[#FF00FF]">
                  <ThumbsDown className="size-3" /> {conCount}
                </div>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-2.5">
                <div className="text-[9px] text-zinc-500">총 투표</div>
                <div className="mt-0.5 inline-flex items-center gap-1.5 text-sm font-semibold text-zinc-100">
                  <Users className="size-3 text-emerald-200" /> {totalVotes}
                </div>
              </div>
            </div>
          )}

          {template === "strict" && <VoteTrendChart threadId={id} />}
          {template === "strict" && <VoteActivityFeed threadId={id} />}

          {/* AI Clash Report + Side Champions */}
          {template === "strict" && (
            <>
              <ClashReportPanel
                threadId={id}
                initialReport={clashReport}
                commentCount={commentDtos.length}
              />
              <SideChampions
                threadId={id}
                comments={commentDtos.map((c) => ({
                  id: c.id,
                  userId: c.userId,
                  displayName: c.displayName,
                  side: c.side,
                  likeCount: c.likeCount,
                }))}
              />
            </>
          )}

          {/* AI 자동 요약 */}
          <AutoSummaryCard
            threadId={id}
            commentCount={commentDtos.length}
            initialSummary={autoSummary}
          />

          {/* AI 사이버 판사 — 3단계 동적 상태 */}
          <CyberJudgePanel
            threadId={id}
            initialSummary={aiSummary}
            initialVerdict={aiVerdict}
            isClosed={isClosed}
            proCommentCount={proCommentCount}
            conCommentCount={conCommentCount}
          />

          {/* 라이브 디베이트 */}
          {!isClosed && (
            <LiveDebatePanel
              threadId={id}
              threadCreatedBy={createdBy}
              isClosed={isClosed}
            />
          )}

          {/* AI 토론 상대 — XP 부족 시 잠금 오버레이 */}
          {!isClosed && (
            <XpGate requiredXp={30}>
              <AIDebatePanel threadId={id} threadTitle={title} />
            </XpGate>
          )}

          {/* 유저 대결 */}
          <DuelPanel threadId={id} isClosed={isClosed} />

          {/* 토론 리플레이 */}
          {isClosed && <DebateReplay threadId={id} />}

          {/* 명예의 전당 (찬반 격돌) */}
          {template === "strict" && (
            <HallOfFame
              comments={hallOfFameComments}
              threadCreatedBy={createdBy}
            />
          )}

          {/* 토론 타임라인 */}
          <ThreadTimeline threadId={id} />
        </ToolDrawer>
      )}

      {/* ═══════════ 댓글 영역 ═══════════ */}
      {template === "strict" ? (
        /* 찬반 격돌: 풀스크린 스플릿 (BattleComments가 내부 스크롤 처리) */
        <div className="relative flex-1" style={{ minHeight: 0 }}>
          <BattleComments
            threadId={id}
            comments={commentDtos}
            isClosed={isClosed}
            threadCreatedBy={createdBy}
            template={template}
            proCount={proCount}
            conCount={conCount}
            hasMoreComments={hasMoreComments}
            nextCursor={nextCursor}
          />
        </div>
      ) : (
        /* 자유 토론: 디스코드 스타일 (BattleComments가 내부 스크롤 처리) */
        <div className="relative flex-1" style={{ minHeight: 0 }}>
          <BattleComments threadId={id} comments={commentDtos} isClosed={isClosed} threadCreatedBy={createdBy} template={template} hasMoreComments={hasMoreComments} nextCursor={nextCursor} />
        </div>
      )}
    </div>
  )
}

