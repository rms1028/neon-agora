"use client"

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import Link from "next/link"
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Flame,
  Lock,
  Pencil,
  Settings,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  X,
} from "lucide-react"

import { supabase } from "@/lib/supabase"
import { useAuth } from "@/components/auth-provider"
import { useProfile } from "@/components/profile-provider"
import { useConfirm } from "@/components/confirm-dialog"
import { Button } from "@/components/ui/button"
import { getDisplayName } from "@/lib/utils"
import { xpProgress } from "@/lib/xp"
import { getLevel } from "@/lib/gamification"

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

type ActivityData = {
  threads: ThreadItem[]
  commentCount: number
  totalLikes: number
  commentHistory: CommentHistoryItem[]
  proVoteCount: number
  conVoteCount: number
  joinDate: string | null
}

/* ─── 날짜 포맷 ────────────────────────────────────── */

function formatDate(iso: string | null): string {
  if (!iso) return ""
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`
}

function timeAgo(iso: string | null): string {
  if (!iso) return ""
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${Math.max(1, mins)}분 전`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}시간 전`
  const days = Math.floor(hrs / 24)
  return `${days}일 전`
}

/* ─── 성향 라벨 ────────────────────────────────────── */

function getStanceLabel(proPct: number): string {
  if (proPct >= 80 || proPct <= 20) return "불도저 같은 확신력"
  if (proPct >= 40 && proPct <= 60) return "냉철한 균형의 수호자"
  return "날카로운 논리 사냥꾼"
}

/* ─── 스켈레톤 ─────────────────────────────────────── */

function Bone({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-white/[0.07] ${className ?? ""}`} />
}

function ProfileSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6 px-4 py-6 md:grid-cols-[1fr_360px] md:px-10 md:py-6">
      <div className="space-y-6">
        <Bone className="h-40 rounded-[20px]" />
        <div className="grid grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => <Bone key={i} className="h-24 rounded-[14px]" />)}
        </div>
        <Bone className="h-10 w-full" />
        {[0, 1, 2].map((i) => <Bone key={i} className="h-20 rounded-[14px]" />)}
      </div>
      <div className="space-y-3">
        <Bone className="h-44 rounded-[16px]" />
        <Bone className="h-48 rounded-[16px]" />
        <Bone className="h-28 rounded-[16px]" />
        <Bone className="h-28 rounded-[16px]" />
      </div>
    </div>
  )
}

/* ─── 탭 타입 ──────────────────────────────────────── */

type TabKey = "debates" | "comments"

/* ─── 메인 페이지 ───────────────────────────────────── */

export default function ProfilePage() {
  const { user, loading: authLoading } = useAuth()
  const { profile } = useProfile()
  const { confirm } = useConfirm()
  const [activity, setActivity] = useState<ActivityData | null>(null)
  const [activeTab, setActiveTab] = useState<TabKey>("debates")
  const [deleting, setDeleting] = useState(false)
  const [editThread, setEditThread] = useState<ThreadItem | null>(null)
  const [editTitle, setEditTitle] = useState("")
  const [editContent, setEditContent] = useState("")
  const [editTag, setEditTag] = useState("")
  const [saving, setSaving] = useState(false)
  const [showAll, setShowAll] = useState(false)

  useEffect(() => {
    if (authLoading || !user) { setActivity(null); return }
    let cancelled = false
    setActivity(null)

    ;(async () => {
      const [threadsRes, commentFullRes, votesRes, profileRes] = await Promise.all([
        supabase.from("threads").select("*").eq("created_by", user.id).order("created_at", { ascending: false }),
        supabase.from("comments").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(40),
        supabase.from("thread_votes").select("thread_id, vote_type").eq("user_id", user.id),
        supabase.from("profiles").select("created_at").eq("id", user.id).single(),
      ])
      if (cancelled) return

      const threads = (threadsRes.data ?? []).map((r: Record<string, unknown>) => ({
        id: String(r.id ?? ""), title: String(r.title ?? ""), content: String(r.content ?? ""),
        tag: String(r.tag ?? ""), created_at: typeof r.created_at === "string" ? r.created_at : null,
        pro_count: Number(r.pro_count) || 0, con_count: Number(r.con_count) || 0,
        template: typeof r.template === "string" ? r.template : "free", is_closed: r.is_closed === true,
      })) as ThreadItem[]

      const myCommentsFull = (commentFullRes.data ?? [])
        .filter((r: Record<string, unknown>) => r.is_deleted !== true)
        .slice(0, 20) as Array<{ id: string; thread_id: string; content: string; side: "pro" | "con" | null; created_at: string | null }>

      const commentCount = (commentFullRes.data ?? []).filter((r: Record<string, unknown>) => r.is_deleted !== true).length

      const myVotes = (votesRes.data ?? []) as Array<{ thread_id: string; vote_type: "pro" | "con" }>
      const proVoteCount = myVotes.filter((v) => v.vote_type === "pro").length
      const conVoteCount = myVotes.filter((v) => v.vote_type === "con").length

      const relatedThreadIds = new Set<string>()
      myCommentsFull.forEach((c) => relatedThreadIds.add(c.thread_id))
      const titleMap = new Map<string, string>()
      if (relatedThreadIds.size > 0) {
        const { data: titleRows } = await supabase.from("threads").select("id, title").in("id", Array.from(relatedThreadIds))
        ;(titleRows ?? []).forEach((r: { id: string; title: string }) => { titleMap.set(r.id, r.title) })
      }

      const myCommentIds = myCommentsFull.map((c) => c.id)
      const reactionMap = new Map<string, { like: number; dislike: number; fire: number }>()
      myCommentIds.forEach((id) => reactionMap.set(id, { like: 0, dislike: 0, fire: 0 }))
      if (myCommentIds.length > 0) {
        const { data: reactionRows } = await supabase.from("comment_reactions").select("comment_id, reaction").in("comment_id", myCommentIds)
        ;(reactionRows ?? []).forEach((r: { comment_id: string; reaction: string }) => {
          const entry = reactionMap.get(r.comment_id)
          if (entry && (r.reaction === "like" || r.reaction === "dislike" || r.reaction === "fire")) entry[r.reaction]++
        })
      }

      const { data: allMyCommentRows } = await supabase.from("comments").select("id").eq("user_id", user.id)
      const allMyCommentIds = (allMyCommentRows ?? []).map((c: { id: string }) => c.id)
      let totalLikes = 0
      if (allMyCommentIds.length > 0) {
        const { count } = await supabase.from("comment_reactions").select("id", { count: "exact", head: true }).eq("reaction", "like").in("comment_id", allMyCommentIds)
        totalLikes = count ?? 0
      }

      const commentHistory: CommentHistoryItem[] = myCommentsFull.map((c) => ({
        id: c.id, thread_id: c.thread_id, threadTitle: titleMap.get(c.thread_id) ?? "삭제된 토론",
        content: c.content, side: c.side, created_at: c.created_at,
        reactions: reactionMap.get(c.id) ?? { like: 0, dislike: 0, fire: 0 },
      }))

      const joinDate = typeof profileRes.data?.created_at === "string"
        ? profileRes.data.created_at
        : (user as { created_at?: string }).created_at ?? null

      if (cancelled) return
      setActivity({ threads, commentCount, totalLikes, commentHistory, proVoteCount, conVoteCount, joinDate })
    })()
    return () => { cancelled = true }
  }, [user?.id, authLoading])

  /* ── 토론 삭제 ── */
  async function handleDeleteThread(threadId: string) {
    if (!user || deleting) return
    const ok = await confirm({ title: "토론 삭제", message: "정말 이 토론을 삭제하시겠습니까?", confirmText: "삭제", variant: "danger" })
    if (!ok) return
    setDeleting(true)
    const { error, data } = await supabase.from("threads").delete().eq("id", threadId).eq("created_by", user.id).select("id")
    setDeleting(false)
    if (error) { alert("삭제 실패: " + error.message); return }
    if (!data || data.length === 0) { alert("삭제 권한이 없습니다."); return }
    setActivity((prev) => prev ? { ...prev, threads: prev.threads.filter((t) => t.id !== threadId) } : prev)
  }

  /* ── 토론 수정 ── */
  function openEditModal(t: ThreadItem) { setEditThread(t); setEditTitle(t.title); setEditContent(t.content); setEditTag(t.tag) }
  function closeEditModal() { setEditThread(null); setEditTitle(""); setEditContent(""); setEditTag("") }

  async function handleSaveThread() {
    if (!user || !editThread || saving) return
    const trimTitle = editTitle.trim()
    if (!trimTitle) return
    setSaving(true)
    const { error, data } = await supabase.from("threads").update({ title: trimTitle, content: editContent.trim(), tag: editTag || null }).eq("id", editThread.id).eq("created_by", user.id).select("id")
    setSaving(false)
    if (error) { alert("수정 실패: " + error.message); return }
    if (!data || data.length === 0) { alert("수정 권한이 없습니다."); return }
    setActivity((prev) => prev ? { ...prev, threads: prev.threads.map((t) => t.id === editThread.id ? { ...t, title: trimTitle, content: editContent.trim(), tag: editTag } : t) } : prev)
    closeEditModal()
  }

  /* ── 로딩 ── */
  if (authLoading || (user && !activity)) {
    return (
      <div style={{ minHeight: "100vh", background: "#0a0a0f", color: "#eee" }}>
        <div style={{ padding: "32px" }}><ProfileSkeleton /></div>
      </div>
    )
  }

  /* ── 미로그인 ── */
  if (!user) {
    return (
      <div style={{ minHeight: "100vh", background: "#0a0a0f", color: "#eee", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚔️</div>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>로그인이 필요합니다</h2>
          <p style={{ fontSize: 14, color: "#555", marginBottom: 24 }}>마이페이지는 로그인 후 이용할 수 있어요.</p>
          <Link href="/"><Button className="bg-white text-black hover:bg-zinc-200">홈으로</Button></Link>
        </div>
      </div>
    )
  }

  if (!activity) return null

  const xp = profile?.xp ?? 0
  const level = getLevel(xp)
  const { pct: xpPct } = xpProgress(xp)
  const displayName = profile?.displayName || getDisplayName(user.id)
  const avatarInitial = displayName.slice(0, 1)
  const streakDays = profile?.streakDays ?? 0

  const totalVotes = activity.proVoteCount + activity.conVoteCount
  const proPct = totalVotes > 0 ? Math.round((activity.proVoteCount / totalVotes) * 100) : 50
  const conPct = 100 - proPct

  const items = activeTab === "debates" ? activity.threads : activity.commentHistory
  const visibleItems = showAll ? items : items.slice(0, 10)

  const TABS: { key: TabKey; label: string; count: number }[] = [
    { key: "debates", label: "내 토론", count: activity.threads.length },
    { key: "comments", label: "내 댓글", count: activity.commentCount },
  ]

  const NEON_BADGES = [
    { name: "네온 뉴비", icon: "🌟", color: "#55b3ff", tooltip: "가입 시 자동 획득", unlocked: true },
    { name: "네온 레귤러", icon: "⚡", color: "#00e4a5", tooltip: "토론 5개 참여 시 획득", unlocked: activity.threads.length >= 5 },
    { name: "네온 코어", icon: "💎", color: "#c084fc", tooltip: "토론 20개 + 댓글 50개 달성 시 획득", unlocked: activity.threads.length >= 20 && activity.commentCount >= 50 },
    { name: "네온 레전드", icon: "👑", color: "#ffd055", tooltip: "토론 50개 + 좋아요 200개 달성 시 획득", unlocked: activity.threads.length >= 50 && activity.totalLikes >= 200 },
    { name: "네온 이터널", icon: "🔥", color: "#ff4d8d", tooltip: "100일 연속 활동 시 획득", unlocked: streakDays >= 100 },
  ]
  const currentBadgeIdx = [...NEON_BADGES].reverse().findIndex((b) => b.unlocked)
  const currentBadge = currentBadgeIdx >= 0 ? NEON_BADGES[NEON_BADGES.length - 1 - currentBadgeIdx] : NEON_BADGES[0]
  const currentBadgeRealIdx = NEON_BADGES.indexOf(currentBadge)
  const nextBadge = currentBadgeRealIdx < NEON_BADGES.length - 1 ? NEON_BADGES[currentBadgeRealIdx + 1] : null

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0f", color: "#eee", fontFamily: "'Noto Sans KR', sans-serif", position: "relative", overflow: "hidden" }}>
      {/* Ambient background */}
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, height: 400, background: "radial-gradient(ellipse at 30% 0%, rgba(0,228,165,0.04) 0%, transparent 60%), radial-gradient(ellipse at 70% 0%, rgba(192,132,252,0.03) 0%, transparent 60%)", pointerEvents: "none" }} />

      {/* Header */}
      <header className="px-4 md:px-10" style={{ paddingTop: 16, paddingBottom: 16, borderBottom: "1px solid rgba(255,255,255,0.03)", background: "rgba(10,10,15,0.8)", backdropFilter: "blur(20px)", position: "sticky", top: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href="/" className="shrink-0" style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.06)", color: "#666", fontSize: 13, padding: "6px 12px", borderRadius: 8, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4, whiteSpace: "nowrap" }}>
            <ArrowLeft style={{ width: 14, height: 14 }} /> <span className="hidden sm:inline">홈</span>
          </Link>
          <span className="whitespace-nowrap text-sm font-bold text-zinc-500 md:text-[15px]">MY PROFILE</span>
        </div>
        <div className="flex shrink-0 gap-1.5 sm:gap-2">
          <Link href="/settings/notifications" className="hidden sm:inline-flex" style={{ padding: "7px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)", color: "#999", textDecoration: "none", alignItems: "center", gap: 4, whiteSpace: "nowrap" }}>
            <Settings style={{ width: 12, height: 12 }} /> 설정
          </Link>
          <Link href="/settings/profile" style={{ padding: "7px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, border: "1px solid rgba(0,228,165,0.2)", background: "rgba(0,228,165,0.06)", color: "#00e4a5", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4, whiteSpace: "nowrap" }}>
            <Pencil style={{ width: 12, height: 12 }} /> 수정
          </Link>
        </div>
      </header>

      {/* Content: 2 column */}
      <div className="grid grid-cols-1 gap-6 px-4 py-6 pb-16 md:grid-cols-[1fr_360px] md:px-10 md:py-6 md:pb-16" style={{ position: "relative" }}>

        {/* ─── LEFT: Profile + Activity ─── */}
        <div>
          {/* Profile Card */}
          <div className="profile-fadeUp" style={{ borderRadius: 20, background: "linear-gradient(135deg, rgba(0,228,165,0.03) 0%, rgba(192,132,252,0.02) 100%)", border: "1px solid rgba(0,228,165,0.08)", marginBottom: 24, position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: 0, right: 0, width: 120, height: 120, background: "radial-gradient(circle at top right, rgba(192,132,252,0.06), transparent 70%)" }} />

            <div className="px-5 pt-6 sm:px-8 sm:pt-8">
              {/* 모바일: 세로 중앙 / 데스크탑: 가로 */}
              <div className="flex flex-col items-center gap-3 text-center sm:flex-row sm:items-center sm:gap-5 sm:text-left">
                {/* Avatar */}
                <div className="profile-avatar-glow" style={{ width: 72, height: 72, borderRadius: 20, background: "linear-gradient(135deg, rgba(0,228,165,0.15), rgba(0,200,255,0.1))", border: "2px solid rgba(0,228,165,0.25)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, fontWeight: 900, color: "#00e4a5", position: "relative", flexShrink: 0 }}>
                  {avatarInitial}
                  <div style={{ position: "absolute", bottom: -2, right: -2, width: 14, height: 14, borderRadius: "50%", background: "#00e4a5", border: "3px solid #0a0a0f" }} />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                    <span className="text-xl font-black text-zinc-100 sm:text-[22px]">{displayName}</span>
                    <span className="whitespace-nowrap rounded-lg border border-purple-400/20 bg-purple-400/10 px-2.5 py-0.5 text-[11px] font-extrabold text-purple-300" style={{ fontFamily: "'JetBrains Mono', monospace" }}>Lv.{level}</span>
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                    <span className="whitespace-nowrap text-xs font-semibold" style={{ color: currentBadge.color }}>{currentBadge.icon} {currentBadge.name}</span>
                    {activity.joinDate && <span className="whitespace-nowrap text-[11px] text-zinc-600">· {formatDate(activity.joinDate)} 가입</span>}
                  </div>
                </div>

                {/* XP */}
                <div className="mt-1 sm:mt-0 sm:text-right">
                  <div className="flex items-center justify-center gap-1 text-sm font-extrabold text-amber-300 sm:justify-end" style={{ fontFamily: "'JetBrains Mono', monospace" }}>⚡ {xp} XP</div>
                  {nextBadge && <div className="mt-0.5 whitespace-nowrap text-[10px] text-zinc-600">다음: {nextBadge.name}</div>}
                </div>
              </div>
            </div>

            {/* XP Bar — full width at card bottom */}
            <div style={{ padding: "18px 0 0" }}>
              <div style={{ height: 6, background: "rgba(255,255,255,0.04)", borderRadius: "0 0 20px 20px" }}>
                <div style={{ height: "100%", borderRadius: "0 0 20px 20px", width: `${xpPct}%`, background: "linear-gradient(90deg, #00e4a5, #c084fc)", transition: "width 0.5s", boxShadow: "0 0 10px rgba(0,228,165,0.3)" }} />
              </div>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="profile-fadeUp" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 24, animationDelay: "0.1s" }}>
            {([
              { label: "토론", value: activity.threads.length, color: "#00e4a5", icon: "⚔️" },
              { label: "댓글", value: activity.commentCount, color: "#55b3ff", icon: "💬" },
              { label: "받은 좋아요", value: activity.totalLikes, color: "#ff4d8d", icon: "♥" },
            ] as const).map((s) => (
              <div key={s.label} className="profile-stat-card" style={{ padding: "18px 16px", borderRadius: 14, textAlign: "center", background: "rgba(255,255,255,0.015)", border: `1px solid ${s.color}10`, transition: "all 0.15s" }}>
                <div style={{ fontSize: 12, marginBottom: 6 }}>{s.icon}</div>
                <div style={{ fontSize: 26, fontWeight: 900, color: s.color, fontFamily: "'JetBrains Mono', monospace", lineHeight: 1 }}>{s.value}</div>
                <div style={{ fontSize: 11, color: "#555", marginTop: 4 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div className="profile-fadeUp" style={{ display: "flex", gap: 0, marginBottom: 20, borderBottom: "1px solid rgba(255,255,255,0.04)", animationDelay: "0.15s" }}>
            {TABS.map((t) => (
              <button key={t.key} onClick={() => { setActiveTab(t.key); setShowAll(false) }} style={{ padding: "12px 20px", border: "none", background: "transparent", fontSize: 14, fontWeight: activeTab === t.key ? 700 : 500, color: activeTab === t.key ? "#eee" : "#555", cursor: "pointer", fontFamily: "inherit", borderBottom: activeTab === t.key ? "2px solid #00e4a5" : "2px solid transparent", transition: "all 0.15s" }}>
                {t.label} <span style={{ color: activeTab === t.key ? "#00e4a5" : "#444", fontSize: 12 }}>{t.count}</span>
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {items.length === 0 && (
              <div style={{ padding: "48px 0", textAlign: "center", fontSize: 14, color: "#555" }}>
                {activeTab === "debates" ? "아직 작성한 토론이 없어요." : "아직 작성한 댓글이 없어요."}
              </div>
            )}

            {/* 내 토론 */}
            {activeTab === "debates" && (visibleItems as ThreadItem[]).map((t, i) => {
              const isClash = t.template === "strict"
              const accent = isClash ? "#00e4a5" : "#55b3ff"
              return (
                <div key={t.id} className="profile-fadeUp profile-list-card" style={{ padding: "16px 20px", borderRadius: 14, background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.04)", display: "flex", alignItems: "center", gap: 14, transition: "all 0.15s", animationDelay: `${i * 0.05}s` }}>
                  <div style={{ width: 3, height: 36, borderRadius: 2, background: accent, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Link href={`/thread/${t.id}`} style={{ textDecoration: "none" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <span style={{ fontSize: 16, fontWeight: 700, color: "#ddd", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.title}</span>
                        <span style={{ fontSize: 9, fontWeight: 800, color: accent, background: `${accent}12`, padding: "2px 8px", borderRadius: 6, fontFamily: "'JetBrains Mono', monospace", flexShrink: 0 }}>{isClash ? "CLASH" : "FREE"}</span>
                        {t.is_closed && <span style={{ fontSize: 9, color: "#666", background: "rgba(255,255,255,0.04)", padding: "2px 6px", borderRadius: 6, flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 2 }}><Lock style={{ width: 10, height: 10 }} /> 마감</span>}
                      </div>
                      <div style={{ fontSize: 11, color: "#555", display: "flex", gap: 8 }}>
                        {isClash && <span>찬성 {t.pro_count} · 반대 {t.con_count}</span>}
                        {t.tag && <span>#{t.tag}</span>}
                        <span>{timeAgo(t.created_at)}</span>
                      </div>
                    </Link>
                    {/* 수정/삭제 */}
                    <div style={{ marginTop: 8, display: "flex", gap: 8, opacity: 0 }} className="profile-card-actions">
                      <button type="button" onClick={() => openEditModal(t)} style={{ fontSize: 11, color: "#555", background: "none", border: "none", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 3, fontFamily: "inherit" }}><Pencil style={{ width: 10, height: 10 }} /> 수정</button>
                      <button type="button" onClick={() => handleDeleteThread(t.id)} disabled={deleting} style={{ fontSize: 11, color: "#555", background: "none", border: "none", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 3, fontFamily: "inherit" }}><Trash2 style={{ width: 10, height: 10 }} /> 삭제</button>
                    </div>
                  </div>
                  <Link href={`/thread/${t.id}`} style={{ fontSize: 14, color: "#333", textDecoration: "none" }}>→</Link>
                </div>
              )
            })}

            {/* 내 댓글 */}
            {activeTab === "comments" && (visibleItems as CommentHistoryItem[]).map((c, i) => (
              <Link key={c.id} href={`/thread/${c.thread_id}`} style={{ textDecoration: "none" }}>
                <div className="profile-fadeUp profile-list-card" style={{ padding: "16px 20px", borderRadius: 14, background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.04)", transition: "all 0.15s", animationDelay: `${i * 0.05}s` }}>
                  <div style={{ fontSize: 11, color: "#555", marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
                    <span>{c.threadTitle}</span>
                    {c.side && (
                      <span style={{ fontSize: 9, fontWeight: 700, color: c.side === "pro" ? "#00e4a5" : "#ff4d8d", background: c.side === "pro" ? "rgba(0,228,165,0.1)" : "rgba(255,77,141,0.1)", padding: "1px 6px", borderRadius: 6 }}>
                        {c.side === "pro" ? "찬성" : "반대"}
                      </span>
                    )}
                    <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
                      {c.reactions.like > 0 && <span style={{ display: "inline-flex", alignItems: "center", gap: 2 }}><ThumbsUp style={{ width: 10, height: 10 }} /> {c.reactions.like}</span>}
                      {c.reactions.fire > 0 && <span style={{ display: "inline-flex", alignItems: "center", gap: 2 }}><Flame style={{ width: 10, height: 10 }} /> {c.reactions.fire}</span>}
                      {timeAgo(c.created_at)}
                    </span>
                  </div>
                  <p style={{ fontSize: 14, color: "#bbb", lineHeight: 1.6, margin: 0 }}>{c.content}</p>
                </div>
              </Link>
            ))}

            {/* 더보기 */}
            {items.length > 10 && (
              <button onClick={() => setShowAll((p) => !p)} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4, width: "100%", padding: "10px", fontSize: 12, color: "#555", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>
                {showAll ? <>접기 <ChevronUp style={{ width: 14, height: 14 }} /></> : <>전체 {items.length}개 보기 <ChevronDown style={{ width: 14, height: 14 }} /></>}
              </button>
            )}
          </div>
        </div>

        {/* ─── RIGHT: HUD Panel ─── */}
        <div className="md:sticky md:top-[100px] md:self-start">
          {/* HUD Header + Rank */}
          <div className="profile-fadeUp" style={{ padding: "18px 20px", borderRadius: 16, background: "linear-gradient(135deg, rgba(0,228,165,0.04), rgba(192,132,252,0.03))", border: "1px solid rgba(0,228,165,0.08)", marginBottom: 12, animationDelay: "0.1s" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: "#00e4a5", fontFamily: "'Orbitron', 'JetBrains Mono', monospace", letterSpacing: 1 }}>HUD</span>
                <span className="profile-online-glow" style={{ fontSize: 9, color: "#00e4a5", background: "rgba(0,228,165,0.1)", padding: "2px 6px", borderRadius: 6, fontWeight: 700 }}>● ONLINE</span>
              </div>
            </div>
            <div style={{ padding: "14px 16px", borderRadius: 12, background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.03)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: 11, color: "#666" }}>CURRENT RANK</span>
                <span style={{ fontSize: 12, fontWeight: 800, color: "#ffd055", fontFamily: "'JetBrains Mono', monospace" }}>⚡ {xp} XP</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 20 }}>{currentBadge.icon}</span>
                <span style={{ fontSize: 16, fontWeight: 800, color: currentBadge.color }}>{currentBadge.name}</span>
                <span style={{ fontSize: 10, fontWeight: 800, color: "#c084fc", background: "rgba(192,132,252,0.12)", padding: "2px 8px", borderRadius: 6, fontFamily: "'JetBrains Mono', monospace" }}>Lv.{level}</span>
              </div>
              <div style={{ fontSize: 10, color: "#555", marginBottom: 6 }}>
                {nextBadge ? `다음: ${nextBadge.name} — ${nextBadge.tooltip}` : "🎉 최고 등급 달성!"}
              </div>
              <div style={{ height: 4, borderRadius: 2, background: "rgba(255,255,255,0.04)" }}>
                <div style={{ height: "100%", borderRadius: 2, width: `${xpPct}%`, background: `linear-gradient(90deg, ${currentBadge.color}, ${nextBadge?.color ?? currentBadge.color})`, boxShadow: `0 0 8px ${currentBadge.color}44` }} />
              </div>
            </div>
          </div>

          {/* Badge Collection */}
          <div className="profile-fadeUp" style={{ padding: "18px 20px", borderRadius: 16, background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.04)", marginBottom: 12, animationDelay: "0.15s" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#888", marginBottom: 14 }}>BADGE COLLECTION</div>
            {/* 상단 3개 */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 8 }}>
              {NEON_BADGES.slice(0, 3).map((b, idx) => {
                const isCurrent = idx === currentBadgeRealIdx
                return (
                  <div key={b.name} title={b.tooltip} className="profile-badge-card" style={{ padding: "14px 6px", borderRadius: 12, textAlign: "center", background: b.unlocked ? `${b.color}08` : "rgba(255,255,255,0.01)", border: isCurrent ? `1.5px solid ${b.color}44` : "1px solid rgba(255,255,255,0.03)", opacity: b.unlocked ? 1 : 0.4, position: "relative", transition: "all 0.15s", cursor: "default" }}>
                    {isCurrent && <div style={{ position: "absolute", top: 5, right: 5, fontSize: 7, fontWeight: 800, color: b.color, background: `${b.color}18`, padding: "1px 5px", borderRadius: 4 }}>NOW</div>}
                    <div style={{ fontSize: 20, marginBottom: 5 }}>{b.unlocked ? b.icon : "🔒"}</div>
                    <div style={{ fontSize: 9, fontWeight: 600, color: b.unlocked ? b.color : "#444", lineHeight: 1.3, wordBreak: "keep-all" }}>{b.name}</div>
                  </div>
                )
              })}
            </div>
            {/* 하단 2개 */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {NEON_BADGES.slice(3).map((b, rawIdx) => {
                const idx = rawIdx + 3
                const isCurrent = idx === currentBadgeRealIdx
                return (
                  <div key={b.name} title={b.tooltip} className="profile-badge-card" style={{ padding: "14px 6px", borderRadius: 12, textAlign: "center", background: b.unlocked ? `${b.color}08` : "rgba(255,255,255,0.01)", border: isCurrent ? `1.5px solid ${b.color}44` : "1px solid rgba(255,255,255,0.03)", opacity: b.unlocked ? 1 : 0.4, position: "relative", transition: "all 0.15s", cursor: "default" }}>
                    {isCurrent && <div style={{ position: "absolute", top: 5, right: 5, fontSize: 7, fontWeight: 800, color: b.color, background: `${b.color}18`, padding: "1px 5px", borderRadius: 4 }}>NOW</div>}
                    <div style={{ fontSize: 20, marginBottom: 5 }}>{b.unlocked ? b.icon : "🔒"}</div>
                    <div style={{ fontSize: 9, fontWeight: 600, color: b.unlocked ? b.color : "#444", lineHeight: 1.3, wordBreak: "keep-all" }}>{b.name}</div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Streak */}
          <div className="profile-fadeUp" style={{ padding: "18px 20px", borderRadius: 16, background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.04)", marginBottom: 12, animationDelay: "0.2s" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#888", marginBottom: 10 }}>STREAK</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 28 }}>🔥</span>
              <div>
                <div style={{ fontSize: 24, fontWeight: 900, color: "#ffd055", fontFamily: "'JetBrains Mono', monospace", lineHeight: 1 }}>{streakDays}일 연속</div>
                <div style={{ fontSize: 10, color: "#555", marginTop: 2 }}>목표: 7일 연속</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 4, marginTop: 12 }}>
              {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                <div key={d} style={{ flex: 1, height: 8, borderRadius: 4, background: d <= streakDays ? "#ffd055" : "rgba(255,255,255,0.06)", border: d <= streakDays ? "none" : "1px solid rgba(255,255,255,0.06)", transition: "all 0.3s" }} />
              ))}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontSize: 8, color: "#444" }}>
              {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                <span key={d} style={{ flex: 1, textAlign: "center", color: d <= streakDays ? "#ffd055" : "#333" }}>{d}</span>
              ))}
            </div>
          </div>

          {/* Stance Tendency */}
          {totalVotes > 0 && (
            <div className="profile-fadeUp" style={{ padding: "18px 20px", borderRadius: 16, background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.04)", animationDelay: "0.25s" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#888", marginBottom: 12 }}>STANCE TENDENCY</div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 11 }}>
                <span style={{ color: "#00e4a5", fontWeight: 700 }}>찬성 {proPct}%</span>
                <span style={{ color: "#ff4d8d", fontWeight: 700 }}>반대 {conPct}%</span>
              </div>
              <div style={{ display: "flex", height: 4, borderRadius: 2, gap: 2 }}>
                <div style={{ width: `${proPct}%`, background: "#00e4a5", borderRadius: 2 }} />
                <div style={{ width: `${conPct}%`, background: "#ff4d8d", borderRadius: 2 }} />
              </div>
              <div style={{ marginTop: 10, padding: "8px 12px", borderRadius: 8, background: "rgba(0,228,165,0.06)", textAlign: "center", fontSize: 11, color: "#00e4a5", fontWeight: 600 }}>
                🔥 {getStanceLabel(proPct)}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── 토론 수정 모달 ── */}
      {editThread && createPortal(
        <div style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }} onClick={(e) => { if (e.target === e.currentTarget) closeEditModal() }}>
          <div style={{ position: "relative", margin: "0 16px", width: "100%", maxWidth: 480, borderRadius: 20, border: "1px solid rgba(255,255,255,0.08)", background: "#0f0f14", padding: 24 }}>
            <button type="button" onClick={closeEditModal} style={{ position: "absolute", top: 16, right: 16, background: "none", border: "none", color: "#555", cursor: "pointer" }}><X style={{ width: 20, height: 20 }} /></button>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "#eee", marginBottom: 20 }}>토론 수정</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, color: "#666", marginBottom: 6 }}>제목</label>
                <input type="text" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} maxLength={100} style={{ width: "100%", padding: "10px 14px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(0,0,0,0.3)", color: "#eee", fontSize: 14, outline: "none", fontFamily: "inherit" }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, color: "#666", marginBottom: 6 }}>내용</label>
                <textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} rows={4} maxLength={2000} style={{ width: "100%", padding: "10px 14px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(0,0,0,0.3)", color: "#eee", fontSize: 14, outline: "none", resize: "none", fontFamily: "inherit" }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, color: "#666", marginBottom: 6 }}>카테고리</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {["AI", "정치", "경제", "사회", "기술", "문화", "교육", "환경", "기타"].map((cat) => (
                    <button key={cat} type="button" onClick={() => setEditTag(editTag === cat ? "" : cat)} style={{ padding: "4px 12px", borderRadius: 20, border: editTag === cat ? "1px solid rgba(0,228,165,0.4)" : "1px solid rgba(255,255,255,0.06)", background: editTag === cat ? "rgba(0,228,165,0.1)" : "rgba(255,255,255,0.03)", color: editTag === cat ? "#00e4a5" : "#888", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, paddingTop: 8 }}>
                <Button variant="outline" onClick={closeEditModal} className="border-white/10 text-zinc-400">취소</Button>
                <Button onClick={handleSaveThread} disabled={saving || !editTitle.trim()} style={{ background: "linear-gradient(90deg, #00e4a5, #c084fc)", color: "#000", fontWeight: 700 }}>
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
