"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  AlertTriangle,
  ArrowLeft,
  Award,
  Ban,
  BarChart3,
  Bot,
  Check,
  ChevronDown,
  ClipboardList,
  Eye,
  EyeOff,
  FileText,
  Gavel,
  Loader2,
  MessageSquare,
  Minus,
  Plus,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  ShieldOff,
  Terminal,
  Trash2,
  Users,
  X,
  Zap,
} from "lucide-react"

import { supabase } from "@/lib/supabase"
import { useAuth } from "@/components/auth-provider"
import { useToast } from "@/components/toast-provider"
import { getDisplayName, timeAgo } from "@/lib/utils"

type Tab = "stats" | "reports" | "users" | "ai_logs" | "audit"
type ReportStatus = "pending" | "resolved" | "dismissed"

type Report = {
  id: string
  target_type: string
  target_id: string
  reason: string
  description: string
  reporter_id: string
  status: ReportStatus
  created_at: string
  target_user_id?: string
}

type UserRow = {
  id: string
  xp: number
  badge: string
  display_name: string | null
  is_admin: boolean
  banned_until: string | null
}

type Stats = {
  totalUsers: number
  totalThreads: number
  totalComments: number
  pendingReports: number
  todayThreads: number
  todayComments: number
}

type AILog = {
  id: string
  title: string
  ai_verdict: string | null
  ai_summary: Record<string, unknown> | null
  is_closed: boolean
  created_at: string
}

type AuditLog = {
  id: string
  admin_id: string
  action: string
  target_type: string | null
  target_id: string | null
  details: Record<string, unknown>
  created_at: string
}

async function adminFetch(action: string, body: Record<string, unknown> = {}) {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session?.access_token) throw new Error("인증 만료")

  const res = await fetch("/api/admin", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ action, ...body }),
  })

  if (!res.ok) {
    const json = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(json.error ?? "요청 실패")
  }

  return res.json()
}

// ── Matrix Rain Text ──
function MatrixRain() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-[0.04]">
      {Array.from({ length: 12 }).map((_, i) => (
        <div
          key={i}
          className="admin-matrix-column absolute top-0 font-mono text-[10px] leading-3 text-cyan-400"
          style={{
            left: `${(i / 12) * 100}%`,
            animationDelay: `${i * 0.3}s`,
            animationDuration: `${8 + (i % 4) * 2}s`,
          }}
        >
          {Array.from({ length: 40 }).map((_, j) => (
            <div key={j}>{String.fromCharCode(0x30A0 + Math.floor(Math.random() * 96))}</div>
          ))}
        </div>
      ))}
    </div>
  )
}

export default function AdminPage() {
  const { user, loading: authLoading } = useAuth()
  const { showToast } = useToast()
  const router = useRouter()

  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)
  const [tab, setTab] = useState<Tab>("stats")

  // Reports
  const [reports, setReports] = useState<Report[]>([])
  const [reportsLoading, setReportsLoading] = useState(false)
  const [statusFilter, setStatusFilter] = useState<ReportStatus>("pending")
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [expandedReport, setExpandedReport] = useState<string | null>(null)

  // Users
  const [users, setUsers] = useState<UserRow[]>([])
  const [usersLoading, setUsersLoading] = useState(false)
  const [userSearch, setUserSearch] = useState("")
  const [banDays, setBanDays] = useState<Record<string, number>>({})
  const [banningId, setBanningId] = useState<string | null>(null)
  const [xpAdjust, setXpAdjust] = useState<Record<string, number>>({})
  const [badgeInput, setBadgeInput] = useState<Record<string, string>>({})

  // Stats
  const [stats, setStats] = useState<Stats | null>(null)
  const [statsLoading, setStatsLoading] = useState(false)

  // AI Logs
  const [aiLogs, setAiLogs] = useState<AILog[]>([])
  const [aiLogsLoading, setAiLogsLoading] = useState(false)
  const [retrialId, setRetrialId] = useState<string | null>(null)

  // Audit Logs
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  const [auditLoading, setAuditLoading] = useState(false)

  // Admin check
  useEffect(() => {
    if (authLoading) return
    if (!user) {
      router.replace("/")
      return
    }
    let cancelled = false
    ;(async () => {
      const { data } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", user.id)
        .maybeSingle()
      if (cancelled) return
      if (!data?.is_admin) {
        router.replace("/")
        return
      }
      setIsAdmin(true)
    })()
    return () => {
      cancelled = true
    }
  }, [user, authLoading, router])

  // Load reports
  const loadReports = useCallback(async () => {
    setReportsLoading(true)
    const { data } = await supabase
      .from("reports")
      .select("*")
      .eq("status", statusFilter)
      .order("created_at", { ascending: false })
      .limit(50)
    setReports((data as Report[]) ?? [])
    setReportsLoading(false)
  }, [statusFilter])

  useEffect(() => {
    if (isAdmin && tab === "reports") loadReports()
  }, [isAdmin, tab, loadReports])

  // Load users
  const loadUsers = useCallback(async () => {
    setUsersLoading(true)
    let query = supabase
      .from("profiles")
      .select("id, xp, badge, display_name, is_admin, banned_until")
      .order("xp", { ascending: false })
      .limit(50)

    if (userSearch.trim()) {
      query = query.ilike("display_name", `%${userSearch.trim()}%`)
    }

    const { data } = await query
    setUsers((data as UserRow[]) ?? [])
    setUsersLoading(false)
  }, [userSearch])

  useEffect(() => {
    if (isAdmin && tab === "users") loadUsers()
  }, [isAdmin, tab, loadUsers])

  // Load stats
  useEffect(() => {
    if (!isAdmin || tab !== "stats") return
    setStatsLoading(true)
    adminFetch("get_stats")
      .then((d) => setStats(d as Stats))
      .catch(() => {})
      .finally(() => setStatsLoading(false))
  }, [isAdmin, tab])

  // Load AI logs
  useEffect(() => {
    if (!isAdmin || tab !== "ai_logs") return
    setAiLogsLoading(true)
    adminFetch("get_ai_logs")
      .then((d) => setAiLogs(((d as { logs: AILog[] }).logs) ?? []))
      .catch(() => {})
      .finally(() => setAiLogsLoading(false))
  }, [isAdmin, tab])

  // Load audit logs
  useEffect(() => {
    if (!isAdmin || tab !== "audit") return
    setAuditLoading(true)
    adminFetch("get_admin_logs")
      .then((d) => setAuditLogs(((d as { logs: AuditLog[] }).logs) ?? []))
      .catch(() => {})
      .finally(() => setAuditLoading(false))
  }, [isAdmin, tab])

  // ── Actions ──

  const handleResolveReport = async (reportId: string, status: "resolved" | "dismissed") => {
    setProcessingId(reportId)
    try {
      await adminFetch("resolve_report", { reportId, status })
      setReports((prev) => prev.filter((r) => r.id !== reportId))
      showToast(status === "resolved" ? "신고가 처리되었습니다." : "신고가 무시되었습니다.", "success")
    } catch (e) {
      showToast((e as Error).message, "error")
    }
    setProcessingId(null)
  }

  const handleBlindContent = async (report: Report) => {
    setProcessingId(report.id)
    try {
      await adminFetch("blind_content", {
        reportId: report.id,
        contentType: report.target_type,
        contentId: report.target_id,
      })
      setReports((prev) => prev.filter((r) => r.id !== report.id))
      showToast("콘텐츠가 블라인드 처리되었습니다.", "success")
    } catch (e) {
      showToast((e as Error).message, "error")
    }
    setProcessingId(null)
  }

  const handleBanFromReport = async (report: Report, days: number) => {
    if (!report.target_user_id) {
      showToast("대상 유저를 특정할 수 없습니다.", "error")
      return
    }
    setProcessingId(report.id)
    try {
      await adminFetch("ban_user", { userId: report.target_user_id, days })
      await adminFetch("resolve_report", { reportId: report.id, status: "resolved" })
      setReports((prev) => prev.filter((r) => r.id !== report.id))
      showToast(`유저가 ${days}일간 제재되었습니다.`, "success")
    } catch (e) {
      showToast((e as Error).message, "error")
    }
    setProcessingId(null)
  }

  const handlePermanentBan = async (report: Report) => {
    if (!report.target_user_id) {
      showToast("대상 유저를 특정할 수 없습니다.", "error")
      return
    }
    setProcessingId(report.id)
    try {
      await adminFetch("permanent_ban", { userId: report.target_user_id, reportId: report.id })
      setReports((prev) => prev.filter((r) => r.id !== report.id))
      showToast("영구 제재가 적용되었습니다.", "success")
    } catch (e) {
      showToast((e as Error).message, "error")
    }
    setProcessingId(null)
  }

  const handleBanUser = async (userId: string) => {
    const days = banDays[userId] ?? 1
    setBanningId(userId)
    try {
      await adminFetch("ban_user", { userId, days })
      setUsers((prev) =>
        prev.map((u) =>
          u.id === userId
            ? { ...u, banned_until: days > 0 ? new Date(Date.now() + days * 86400000).toISOString() : null }
            : u,
        ),
      )
      showToast(days > 0 ? `${days}일간 제재되었습니다.` : "제재가 해제되었습니다.", "success")
    } catch (e) {
      showToast((e as Error).message, "error")
    }
    setBanningId(null)
  }

  const handleUnban = async (userId: string) => {
    setBanningId(userId)
    try {
      await adminFetch("ban_user", { userId, days: 0 })
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, banned_until: null } : u)))
      showToast("제재가 해제되었습니다.", "success")
    } catch (e) {
      showToast((e as Error).message, "error")
    }
    setBanningId(null)
  }

  const handleAdjustXp = async (userId: string, amount: number) => {
    try {
      const result = await adminFetch("adjust_xp", { userId, amount }) as { newXp: number }
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, xp: result.newXp } : u)))
      showToast(`XP ${amount > 0 ? "+" : ""}${amount} 적용됨 (현재: ${result.newXp})`, "success")
      setXpAdjust((prev) => ({ ...prev, [userId]: 0 }))
    } catch (e) {
      showToast((e as Error).message, "error")
    }
  }

  const handleGrantBadge = async (userId: string) => {
    const badge = badgeInput[userId]
    if (!badge) return
    try {
      await adminFetch("grant_badge", { userId, badge })
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, badge } : u)))
      showToast(`배지가 "${badge}"(으)로 변경되었습니다.`, "success")
      setBadgeInput((prev) => ({ ...prev, [userId]: "" }))
    } catch (e) {
      showToast((e as Error).message, "error")
    }
  }

  const handleRetrial = async (threadId: string) => {
    setRetrialId(threadId)
    try {
      await adminFetch("retrial_judgment", { threadId })
      setAiLogs((prev) => prev.map((l) => (l.id === threadId ? { ...l, ai_verdict: null, ai_summary: null } : l)))
      showToast("AI 판결이 초기화되었습니다. 재판결이 가능합니다.", "success")
    } catch (e) {
      showToast((e as Error).message, "error")
    }
    setRetrialId(null)
  }

  // ── Loading / Auth guard ──

  if (authLoading || isAdmin === null) {
    return (
      <div className="grid min-h-screen place-items-center bg-black">
        <div className="text-center">
          <div className="admin-matrix-loader mx-auto mb-4 size-12 rounded-lg border border-cyan-400/30 bg-cyan-400/5">
            <Terminal className="mx-auto mt-3 size-6 text-cyan-400 opacity-60" />
          </div>
          <p className="font-mono text-xs text-cyan-400/60">SYSTEM LOADING...</p>
        </div>
      </div>
    )
  }

  if (!isAdmin) return null

  const TABS: { key: Tab; icon: typeof Shield; label: string; color: string }[] = [
    { key: "stats", icon: BarChart3, label: "통계", color: "cyan" },
    { key: "reports", icon: ShieldAlert, label: "신고 센터", color: "amber" },
    { key: "users", icon: Users, label: "유저 관리", color: "emerald" },
    { key: "ai_logs", icon: Bot, label: "AI 로그", color: "violet" },
    { key: "audit", icon: ClipboardList, label: "감사 로그", color: "fuchsia" },
  ]

  const verdictLabel = (v: string | null) =>
    v === "pro" ? "찬성 승" : v === "con" ? "반대 승" : v === "draw" ? "무승부" : "—"
  const verdictColor = (v: string | null) =>
    v === "pro" ? "text-cyan-300" : v === "con" ? "text-fuchsia-300" : v === "draw" ? "text-amber-300" : "text-zinc-500"

  const actionLabel: Record<string, string> = {
    resolve_report: "신고 처리",
    blind_content: "블라인드",
    ban_user: "기간 제재",
    permanent_ban: "영구 제재",
    adjust_xp: "XP 조정",
    grant_badge: "배지 부여",
    retrial_judgment: "재심사",
    delete_content: "콘텐츠 삭제",
  }

  return (
    <div className="min-h-screen bg-black text-zinc-100">
      {/* Background effects */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(800px_circle_at_50%_-5%,rgba(34,211,238,0.08),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(600px_circle_at_100%_100%,rgba(236,72,153,0.04),transparent_60%)]" />
        {/* Grid overlay */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(34,211,238,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,0.4) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
      </div>

      <div className="relative mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
        {/* Header */}
        <nav className="mb-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 font-mono text-xs text-cyan-400/60 transition hover:text-cyan-300"
          >
            <ArrowLeft className="size-3.5" />
            cd ~/home
          </Link>
        </nav>

        <header className="mb-8 flex items-center gap-4">
          <div className="relative grid size-12 place-items-center rounded-xl border border-cyan-400/30 bg-cyan-400/5">
            <MatrixRain />
            <Shield className="relative z-10 size-6 text-cyan-300" />
          </div>
          <div>
            <h1 className="flex items-center gap-2 font-mono text-lg font-bold text-cyan-200">
              <span className="text-cyan-400">$</span> ADMIN_DASHBOARD
              <span className="cursor-blink ml-1 inline-block h-5 w-0.5 bg-cyan-400" />
            </h1>
            <p className="font-mono text-[11px] text-zinc-600">
              data_center v2.0 — 운영 · 보안 · 감시
            </p>
          </div>
        </header>

        {/* Tabs */}
        <div className="mb-6 flex gap-1 overflow-x-auto rounded-xl border border-cyan-400/10 bg-cyan-400/[0.02] p-1">
          {TABS.map((t) => {
            const Icon = t.icon
            const isActive = tab === t.key
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-lg py-2.5 font-mono text-xs font-medium transition ${
                  isActive
                    ? "bg-cyan-400/10 text-cyan-200 shadow-[0_0_12px_rgba(34,211,238,0.15)]"
                    : "text-zinc-600 hover:text-zinc-400"
                }`}
              >
                <Icon className="size-3.5" />
                <span className="hidden sm:inline">{t.label}</span>
              </button>
            )
          })}
        </div>

        {/* ═══════════════ STATS TAB ═══════════════ */}
        {tab === "stats" && (
          <div>
            {statsLoading || !stats ? (
              <div className="py-16 text-center">
                <Loader2 className="mx-auto size-6 animate-spin text-cyan-400" />
                <p className="mt-2 font-mono text-[10px] text-cyan-400/40">LOADING METRICS...</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Neon Stat Widgets */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {[
                    { icon: Users, label: "총 유저", value: stats.totalUsers, glow: "cyan" },
                    { icon: FileText, label: "총 토론", value: stats.totalThreads, glow: "emerald" },
                    { icon: MessageSquare, label: "총 댓글", value: stats.totalComments, glow: "violet" },
                    { icon: AlertTriangle, label: "미처리 신고", value: stats.pendingReports, glow: "amber" },
                    { icon: Zap, label: "오늘 토론", value: stats.todayThreads, glow: "fuchsia" },
                    { icon: MessageSquare, label: "오늘 댓글", value: stats.todayComments, glow: "cyan" },
                  ].map((card) => {
                    const Icon = card.icon
                    const colors: Record<string, string> = {
                      cyan: "border-cyan-400/20 bg-cyan-400/[0.03] text-cyan-300 shadow-[0_0_20px_rgba(34,211,238,0.08)]",
                      emerald: "border-emerald-400/20 bg-emerald-400/[0.03] text-emerald-300 shadow-[0_0_20px_rgba(52,211,153,0.08)]",
                      violet: "border-violet-400/20 bg-violet-400/[0.03] text-violet-300 shadow-[0_0_20px_rgba(139,92,246,0.08)]",
                      amber: "border-amber-400/20 bg-amber-400/[0.03] text-amber-300 shadow-[0_0_20px_rgba(251,191,36,0.08)]",
                      fuchsia: "border-fuchsia-400/20 bg-fuchsia-400/[0.03] text-fuchsia-300 shadow-[0_0_20px_rgba(236,72,153,0.08)]",
                    }
                    return (
                      <div
                        key={card.label}
                        className={`hud-card rounded-xl border p-4 ${colors[card.glow]}`}
                      >
                        <Icon className="size-5 opacity-50" />
                        <div className="mt-3 font-mono text-2xl font-bold">{card.value.toLocaleString()}</div>
                        <div className="mt-1 font-mono text-[10px] opacity-50">{card.label}</div>
                      </div>
                    )
                  })}
                </div>

                {/* Quick status line */}
                <div className="rounded-lg border border-cyan-400/10 bg-cyan-400/[0.02] px-4 py-3">
                  <div className="flex items-center gap-2 font-mono text-[11px] text-cyan-400/60">
                    <Terminal className="size-3.5" />
                    <span>
                      system_status: <span className="text-emerald-400">ONLINE</span>
                      {" | "}pending_reports: <span className={stats.pendingReports > 0 ? "text-amber-400" : "text-emerald-400"}>{stats.pendingReports}</span>
                      {" | "}today_activity: <span className="text-cyan-300">{stats.todayThreads + stats.todayComments}</span>
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══════════════ REPORTS TAB ═══════════════ */}
        {tab === "reports" && (
          <div className="space-y-4">
            {/* Status filter */}
            <div className="flex items-center gap-2">
              {(["pending", "resolved", "dismissed"] as ReportStatus[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatusFilter(s)}
                  className={`rounded-lg px-3 py-1.5 font-mono text-[11px] font-medium transition ${
                    statusFilter === s
                      ? "bg-amber-400/10 text-amber-300 shadow-[0_0_8px_rgba(251,191,36,0.15)]"
                      : "text-zinc-600 hover:bg-white/5 hover:text-zinc-400"
                  }`}
                >
                  {s === "pending" ? "⚠ 대기중" : s === "resolved" ? "✓ 처리됨" : "✕ 기각됨"}
                </button>
              ))}
              <button
                type="button"
                onClick={loadReports}
                className="ml-auto rounded-lg p-1.5 text-zinc-600 hover:text-zinc-400"
              >
                <RefreshCw className="size-3.5" />
              </button>
            </div>

            {reportsLoading ? (
              <div className="py-16 text-center">
                <Loader2 className="mx-auto size-6 animate-spin text-amber-400" />
              </div>
            ) : reports.length === 0 ? (
              <div className="rounded-xl border border-white/5 bg-white/[0.02] py-16 text-center">
                <ShieldAlert className="mx-auto size-8 text-zinc-700" />
                <p className="mt-2 font-mono text-xs text-zinc-600">
                  {statusFilter === "pending" ? "처리 대기 중인 신고가 없습니다." : "해당 상태의 신고가 없습니다."}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {reports.map((r) => {
                  const isExpanded = expandedReport === r.id
                  return (
                    <div
                      key={r.id}
                      className="rounded-xl border border-amber-400/10 bg-amber-400/[0.02] transition hover:border-amber-400/20"
                    >
                      <div className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 text-xs">
                              <span className="rounded border border-amber-400/20 bg-amber-400/10 px-1.5 py-0.5 font-mono text-[10px] font-bold text-amber-300">
                                {r.target_type.toUpperCase()}
                              </span>
                              <span className="rounded border border-red-400/20 bg-red-400/5 px-1.5 py-0.5 font-mono text-[10px] text-red-300">
                                {r.reason}
                              </span>
                            </div>
                            {r.description && (
                              <p className="mt-2 text-sm text-zinc-300">{r.description}</p>
                            )}
                            <div className="mt-2 flex items-center gap-3 font-mono text-[10px] text-zinc-600">
                              <span>신고자: {r.reporter_id.slice(0, 8)}…</span>
                              <span>대상: {r.target_id.slice(0, 8)}…</span>
                              <span>{timeAgo(r.created_at)}</span>
                            </div>
                          </div>

                          {statusFilter === "pending" && (
                            <button
                              type="button"
                              onClick={() => setExpandedReport(isExpanded ? null : r.id)}
                              className="shrink-0 rounded-lg border border-cyan-400/20 bg-cyan-400/5 p-1.5 text-cyan-300 transition hover:bg-cyan-400/10"
                            >
                              <ChevronDown className={`size-4 transition ${isExpanded ? "rotate-180" : ""}`} />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Expanded action panel */}
                      {isExpanded && statusFilter === "pending" && (
                        <div className="border-t border-amber-400/10 bg-black/30 px-4 py-3">
                          <p className="mb-2 font-mono text-[10px] text-zinc-500">관리자 조치 선택:</p>
                          <div className="flex flex-wrap gap-2">
                            {/* 무시 */}
                            <button
                              type="button"
                              onClick={() => handleResolveReport(r.id, "dismissed")}
                              disabled={processingId === r.id}
                              className="inline-flex items-center gap-1 rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-1.5 font-mono text-[11px] text-zinc-400 transition hover:bg-zinc-700/50 disabled:opacity-50"
                            >
                              <X className="size-3" />
                              무시
                            </button>

                            {/* 콘텐츠 블라인드 */}
                            <button
                              type="button"
                              onClick={() => handleBlindContent(r)}
                              disabled={processingId === r.id}
                              className="inline-flex items-center gap-1 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-1.5 font-mono text-[11px] text-amber-300 transition hover:bg-amber-400/20 disabled:opacity-50"
                            >
                              <EyeOff className="size-3" />
                              블라인드
                            </button>

                            {/* 1일 차단 */}
                            <button
                              type="button"
                              onClick={() => handleBanFromReport(r, 1)}
                              disabled={processingId === r.id}
                              className="inline-flex items-center gap-1 rounded-lg border border-orange-400/30 bg-orange-400/10 px-3 py-1.5 font-mono text-[11px] text-orange-300 transition hover:bg-orange-400/20 disabled:opacity-50"
                            >
                              <Ban className="size-3" />
                              1일 차단
                            </button>

                            {/* 영구 제재 */}
                            <button
                              type="button"
                              onClick={() => handlePermanentBan(r)}
                              disabled={processingId === r.id}
                              className="inline-flex items-center gap-1 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 font-mono text-[11px] text-red-400 transition hover:bg-red-500/20 disabled:opacity-50"
                            >
                              <ShieldOff className="size-3" />
                              영구 제재
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ═══════════════ USERS TAB ═══════════════ */}
        {tab === "users" && (
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-cyan-400/40" />
              <input
                type="text"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="닉네임으로 검색..."
                className="w-full rounded-xl border border-cyan-400/10 bg-cyan-400/[0.02] py-2.5 pl-10 pr-4 font-mono text-sm text-zinc-100 placeholder:text-zinc-700 focus:border-cyan-400/30 focus:outline-none focus:shadow-[0_0_12px_rgba(34,211,238,0.1)]"
              />
            </div>

            {usersLoading ? (
              <div className="py-16 text-center">
                <Loader2 className="mx-auto size-6 animate-spin text-cyan-400" />
              </div>
            ) : (
              <div className="space-y-2">
                {users.map((u) => {
                  const isBanned = u.banned_until && new Date(u.banned_until).getTime() > Date.now()
                  const isPermanentBan = u.banned_until && new Date(u.banned_until).getTime() > Date.now() + 365 * 86400000 * 10
                  return (
                    <div
                      key={u.id}
                      className={`rounded-xl border p-4 ${
                        isPermanentBan
                          ? "border-red-500/30 bg-red-500/[0.03]"
                          : isBanned
                            ? "border-orange-400/20 bg-orange-400/[0.03]"
                            : "border-cyan-400/10 bg-cyan-400/[0.02]"
                      }`}
                    >
                      {/* User info row */}
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm font-medium text-zinc-100">
                              {getDisplayName({ id: u.id, display_name: u.display_name })}
                            </span>
                            {u.is_admin && (
                              <span className="rounded border border-cyan-400/30 bg-cyan-400/10 px-1.5 py-0.5 font-mono text-[9px] font-bold text-cyan-300">
                                ADMIN
                              </span>
                            )}
                            {isPermanentBan && (
                              <span className="rounded border border-red-500/30 bg-red-500/10 px-1.5 py-0.5 font-mono text-[9px] font-bold text-red-400">
                                PERMA-BAN
                              </span>
                            )}
                            {isBanned && !isPermanentBan && (
                              <span className="rounded border border-orange-400/30 bg-orange-400/10 px-1.5 py-0.5 font-mono text-[9px] font-bold text-orange-300">
                                BANNED
                              </span>
                            )}
                          </div>
                          <div className="mt-1 flex items-center gap-3 font-mono text-[10px] text-zinc-600">
                            <span>XP: <span className="text-cyan-400/80">{u.xp}</span></span>
                            <span>배지: <span className="text-violet-400/80">{u.badge}</span></span>
                            <span className="text-zinc-700">{u.id.slice(0, 8)}…</span>
                          </div>
                        </div>

                        {/* Ban/Unban quick actions */}
                        {!u.is_admin && (
                          <div className="flex shrink-0 items-center gap-2">
                            {isBanned ? (
                              <button
                                type="button"
                                onClick={() => handleUnban(u.id)}
                                disabled={banningId === u.id}
                                className="inline-flex items-center gap-1 rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1.5 font-mono text-[11px] font-medium text-emerald-300 transition hover:bg-emerald-400/20 disabled:opacity-50"
                              >
                                <Check className="size-3" />
                                해제
                              </button>
                            ) : (
                              <>
                                <select
                                  value={banDays[u.id] ?? 1}
                                  onChange={(e) => setBanDays((prev) => ({ ...prev, [u.id]: Number(e.target.value) }))}
                                  className="rounded-lg border border-white/10 bg-black/50 px-2 py-1.5 font-mono text-[11px] text-zinc-300"
                                >
                                  <option value={1}>1일</option>
                                  <option value={3}>3일</option>
                                  <option value={7}>7일</option>
                                  <option value={30}>30일</option>
                                </select>
                                <button
                                  type="button"
                                  onClick={() => handleBanUser(u.id)}
                                  disabled={banningId === u.id}
                                  className="inline-flex items-center gap-1 rounded-lg border border-red-400/30 bg-red-400/10 px-2.5 py-1.5 font-mono text-[11px] font-medium text-red-300 transition hover:bg-red-400/20 disabled:opacity-50"
                                >
                                  <Ban className="size-3" />
                                  제재
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </div>

                      {/* XP / Badge adjustment (non-admin only) */}
                      {!u.is_admin && (
                        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/5 pt-3">
                          {/* XP Adjust */}
                          <div className="flex items-center gap-1">
                            <span className="font-mono text-[10px] text-zinc-600">XP:</span>
                            <button
                              type="button"
                              onClick={() => setXpAdjust((p) => ({ ...p, [u.id]: (p[u.id] ?? 0) - 50 }))}
                              className="grid size-6 place-items-center rounded border border-white/10 text-zinc-500 hover:text-zinc-300"
                            >
                              <Minus className="size-3" />
                            </button>
                            <input
                              type="number"
                              value={xpAdjust[u.id] ?? 0}
                              onChange={(e) => setXpAdjust((p) => ({ ...p, [u.id]: Number(e.target.value) }))}
                              className="w-16 rounded border border-white/10 bg-black/50 px-2 py-1 text-center font-mono text-[11px] text-zinc-200"
                            />
                            <button
                              type="button"
                              onClick={() => setXpAdjust((p) => ({ ...p, [u.id]: (p[u.id] ?? 0) + 50 }))}
                              className="grid size-6 place-items-center rounded border border-white/10 text-zinc-500 hover:text-zinc-300"
                            >
                              <Plus className="size-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleAdjustXp(u.id, xpAdjust[u.id] ?? 0)}
                              disabled={!xpAdjust[u.id]}
                              className="rounded-lg border border-cyan-400/20 bg-cyan-400/5 px-2 py-1 font-mono text-[10px] text-cyan-300 transition hover:bg-cyan-400/10 disabled:opacity-30"
                            >
                              적용
                            </button>
                          </div>

                          {/* Badge grant */}
                          <div className="flex items-center gap-1">
                            <span className="font-mono text-[10px] text-zinc-600">배지:</span>
                            <input
                              type="text"
                              value={badgeInput[u.id] ?? ""}
                              onChange={(e) => setBadgeInput((p) => ({ ...p, [u.id]: e.target.value }))}
                              placeholder={u.badge}
                              className="w-24 rounded border border-white/10 bg-black/50 px-2 py-1 font-mono text-[11px] text-zinc-200 placeholder:text-zinc-700"
                            />
                            <button
                              type="button"
                              onClick={() => handleGrantBadge(u.id)}
                              disabled={!badgeInput[u.id]}
                              className="rounded-lg border border-violet-400/20 bg-violet-400/5 px-2 py-1 font-mono text-[10px] text-violet-300 transition hover:bg-violet-400/10 disabled:opacity-30"
                            >
                              <Award className="inline size-3" /> 부여
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ═══════════════ AI LOGS TAB ═══════════════ */}
        {tab === "ai_logs" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bot className="size-4 text-violet-400" />
                <span className="font-mono text-xs text-violet-300">AI_JUDGE_LOGS</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setAiLogsLoading(true)
                  adminFetch("get_ai_logs")
                    .then((d) => setAiLogs(((d as { logs: AILog[] }).logs) ?? []))
                    .catch(() => {})
                    .finally(() => setAiLogsLoading(false))
                }}
                className="rounded-lg p-1.5 text-zinc-600 hover:text-zinc-400"
              >
                <RefreshCw className="size-3.5" />
              </button>
            </div>

            {aiLogsLoading ? (
              <div className="py-16 text-center">
                <Loader2 className="mx-auto size-6 animate-spin text-violet-400" />
              </div>
            ) : aiLogs.length === 0 ? (
              <div className="rounded-xl border border-white/5 bg-white/[0.02] py-16 text-center">
                <Bot className="mx-auto size-8 text-zinc-700" />
                <p className="mt-2 font-mono text-xs text-zinc-600">AI 판결 기록이 없습니다.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {aiLogs.map((log) => {
                  const summary = log.ai_summary as Record<string, unknown> | null
                  return (
                    <div
                      key={log.id}
                      className="rounded-xl border border-violet-400/10 bg-violet-400/[0.02] p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <Link
                            href={`/thread/${log.id}`}
                            className="font-mono text-sm font-medium text-zinc-200 hover:text-cyan-200"
                          >
                            {log.title}
                          </Link>
                          <div className="mt-1.5 flex items-center gap-3 font-mono text-[10px]">
                            <span className={verdictColor(log.ai_verdict)}>
                              판결: {verdictLabel(log.ai_verdict)}
                            </span>
                            {summary && (
                              <>
                                <span className="text-cyan-400/60">
                                  찬성 {String(summary.pro_score ?? "?")}점
                                </span>
                                <span className="text-fuchsia-400/60">
                                  반대 {String(summary.con_score ?? "?")}점
                                </span>
                              </>
                            )}
                            <span className="text-zinc-700">{timeAgo(log.created_at)}</span>
                          </div>
                          {summary?.verdict_reason ? (
                            <p className="mt-2 text-[11px] leading-relaxed text-zinc-500">
                              {String(summary.verdict_reason)}
                            </p>
                          ) : null}
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRetrial(log.id)}
                          disabled={retrialId === log.id || !log.ai_verdict}
                          className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-fuchsia-400/30 bg-fuchsia-400/10 px-3 py-1.5 font-mono text-[11px] font-medium text-fuchsia-300 transition hover:bg-fuchsia-400/20 disabled:opacity-30"
                        >
                          {retrialId === log.id ? (
                            <Loader2 className="size-3 animate-spin" />
                          ) : (
                            <Gavel className="size-3" />
                          )}
                          재심사
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ═══════════════ AUDIT LOG TAB ═══════════════ */}
        {tab === "audit" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ClipboardList className="size-4 text-fuchsia-400" />
                <span className="font-mono text-xs text-fuchsia-300">ADMIN_AUDIT_LOG</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setAuditLoading(true)
                  adminFetch("get_admin_logs")
                    .then((d) => setAuditLogs(((d as { logs: AuditLog[] }).logs) ?? []))
                    .catch(() => {})
                    .finally(() => setAuditLoading(false))
                }}
                className="rounded-lg p-1.5 text-zinc-600 hover:text-zinc-400"
              >
                <RefreshCw className="size-3.5" />
              </button>
            </div>

            {auditLoading ? (
              <div className="py-16 text-center">
                <Loader2 className="mx-auto size-6 animate-spin text-fuchsia-400" />
              </div>
            ) : auditLogs.length === 0 ? (
              <div className="rounded-xl border border-white/5 bg-white/[0.02] py-16 text-center">
                <ClipboardList className="mx-auto size-8 text-zinc-700" />
                <p className="mt-2 font-mono text-xs text-zinc-600">감사 로그가 없습니다.</p>
              </div>
            ) : (
              <div className="space-y-1">
                {auditLogs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-center gap-3 rounded-lg border border-white/5 bg-white/[0.01] px-4 py-2.5"
                  >
                    <div className="grid size-6 shrink-0 place-items-center rounded bg-fuchsia-400/10 text-fuchsia-400">
                      <Terminal className="size-3" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 font-mono text-[11px]">
                        <span className="rounded bg-cyan-400/10 px-1.5 py-0.5 text-[10px] text-cyan-300">
                          {actionLabel[log.action] ?? log.action}
                        </span>
                        {log.target_type && (
                          <span className="text-zinc-600">
                            {log.target_type}:{log.target_id?.slice(0, 8)}…
                          </span>
                        )}
                      </div>
                      {log.details && Object.keys(log.details).length > 0 && (
                        <p className="mt-0.5 font-mono text-[10px] text-zinc-700">
                          {JSON.stringify(log.details).slice(0, 80)}
                        </p>
                      )}
                    </div>
                    <div className="shrink-0 font-mono text-[10px] text-zinc-700">
                      {timeAgo(log.created_at)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Footer terminal line */}
        <div className="mt-12 border-t border-cyan-400/10 pt-4">
          <p className="font-mono text-[10px] text-cyan-400/30">
            neon_agora://admin_panel — access_level: <span className="text-cyan-400/50">SUPERUSER</span>
            {" | "}session: <span className="text-cyan-400/50">{user?.id?.slice(0, 8)}…</span>
          </p>
        </div>
      </div>
    </div>
  )
}
