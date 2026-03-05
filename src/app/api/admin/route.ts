import { rateLimitResponse } from "@/lib/rate-limit"
import { supabaseAdmin } from "@/lib/supabase-admin"

async function verifyAdmin(req: Request) {
  const authHeader = req.headers.get("Authorization")
  const token = authHeader?.replace("Bearer ", "").trim()
  if (!token) return null

  const {
    data: { user },
    error,
  } = await supabaseAdmin.auth.getUser(token)
  if (error || !user) return null

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle()

  if (!profile?.is_admin) return null
  return user
}

async function logAdminAction(
  adminId: string,
  action: string,
  targetType: string | null,
  targetId: string | null,
  details: Record<string, unknown> = {},
) {
  await supabaseAdmin
    .from("admin_logs")
    .insert({ admin_id: adminId, action, target_type: targetType, target_id: targetId, details })
    .then(({ error }) => {
      if (error) console.error("[AdminLog] insert error:", error.message)
    })
}

export async function POST(req: Request) {
  try {
    const limited = await rateLimitResponse(req, 20, 60000, true)
    if (limited) return limited

    const admin = await verifyAdmin(req)
    if (!admin) {
      return Response.json({ error: "관리자 권한이 필요합니다." }, { status: 403 })
    }

    const body = await req.json()
    const { action } = body

    // ── resolve_report ──
    if (action === "resolve_report") {
      const { reportId, status } = body
      if (!reportId || !["resolved", "dismissed"].includes(status)) {
        return Response.json({ error: "잘못된 요청입니다." }, { status: 400 })
      }

      const { data: existing } = await supabaseAdmin
        .from("reports")
        .select("id")
        .eq("id", reportId)
        .maybeSingle()
      if (!existing) {
        return Response.json({ error: "신고를 찾을 수 없습니다." }, { status: 404 })
      }

      const { error } = await supabaseAdmin
        .from("reports")
        .update({
          status,
          resolved_by: admin.id,
          resolved_at: new Date().toISOString(),
        })
        .eq("id", reportId)

      if (error) {
        return Response.json({ error: "신고 처리에 실패했습니다." }, { status: 500 })
      }

      await logAdminAction(admin.id, "resolve_report", "report", reportId, { status })
      return Response.json({ success: true })
    }

    // ── blind_content (콘텐츠 블라인드) ──
    if (action === "blind_content") {
      const { reportId, contentType, contentId } = body
      if (!contentId || !contentType || !["comment", "thread"].includes(contentType)) {
        return Response.json({ error: "잘못된 요청입니다. contentType은 comment 또는 thread여야 합니다." }, { status: 400 })
      }

      if (contentType === "comment") {
        const { data: existing } = await supabaseAdmin
          .from("comments")
          .select("id")
          .eq("id", contentId)
          .maybeSingle()
        if (!existing) return Response.json({ error: "댓글을 찾을 수 없습니다." }, { status: 404 })

        const { error } = await supabaseAdmin
          .from("comments")
          .update({ is_deleted: true, content: "[관리자에 의해 블라인드 처리됨]" })
          .eq("id", contentId)
        if (error) return Response.json({ error: "블라인드 처리 실패" }, { status: 500 })
      } else if (contentType === "thread") {
        const { data: existing } = await supabaseAdmin
          .from("threads")
          .select("id")
          .eq("id", contentId)
          .maybeSingle()
        if (!existing) return Response.json({ error: "토론을 찾을 수 없습니다." }, { status: 404 })

        const { error } = await supabaseAdmin
          .from("threads")
          .update({ is_closed: true, title: "[블라인드] " + (body.originalTitle || ""), content: "[관리자에 의해 블라인드 처리됨]" })
          .eq("id", contentId)
        if (error) return Response.json({ error: "블라인드 처리 실패" }, { status: 500 })
      }

      // 신고도 함께 처리
      if (reportId) {
        await supabaseAdmin
          .from("reports")
          .update({ status: "resolved", resolved_by: admin.id, resolved_at: new Date().toISOString() })
          .eq("id", reportId)
      }

      await logAdminAction(admin.id, "blind_content", contentType, contentId, { reportId })
      return Response.json({ success: true })
    }

    // ── ban_user (기간 제재) ──
    if (action === "ban_user") {
      const { userId, days } = body
      if (!userId) {
        return Response.json({ error: "userId가 필요합니다." }, { status: 400 })
      }
      if (days !== undefined && days !== null && (typeof days !== "number" || days < 1 || days > 3650)) {
        return Response.json({ error: "days는 1~3650 사이의 숫자여야 합니다." }, { status: 400 })
      }

      const bannedUntil =
        days && days > 0
          ? new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
          : null

      const { error } = await supabaseAdmin
        .from("profiles")
        .update({ banned_until: bannedUntil })
        .eq("id", userId)

      if (error) {
        return Response.json({ error: "제재 처리에 실패했습니다." }, { status: 500 })
      }

      await logAdminAction(admin.id, "ban_user", "user", userId, { days, banned_until: bannedUntil })
      return Response.json({ success: true, banned_until: bannedUntil })
    }

    // ── permanent_ban (영구 제재) ──
    if (action === "permanent_ban") {
      const { userId, reportId } = body
      if (!userId) {
        return Response.json({ error: "userId가 필요합니다." }, { status: 400 })
      }

      // 9999일 = 약 27년 = 사실상 영구
      const bannedUntil = new Date(Date.now() + 9999 * 24 * 60 * 60 * 1000).toISOString()

      const { error } = await supabaseAdmin
        .from("profiles")
        .update({ banned_until: bannedUntil })
        .eq("id", userId)

      if (error) return Response.json({ error: "영구 제재 실패" }, { status: 500 })

      if (reportId) {
        await supabaseAdmin
          .from("reports")
          .update({ status: "resolved", resolved_by: admin.id, resolved_at: new Date().toISOString() })
          .eq("id", reportId)
      }

      await logAdminAction(admin.id, "permanent_ban", "user", userId, { reportId })
      return Response.json({ success: true, banned_until: bannedUntil })
    }

    // ── adjust_xp (XP 조정) ──
    if (action === "adjust_xp") {
      const { userId, amount } = body
      if (!userId || typeof amount !== "number") {
        return Response.json({ error: "userId와 amount가 필요합니다." }, { status: 400 })
      }
      if (amount < -10000 || amount > 10000) {
        return Response.json({ error: "amount는 -10000~10000 사이여야 합니다." }, { status: 400 })
      }

      // 원자적 XP 조정 시도
      const { error: rpcErr } = await supabaseAdmin.rpc("increment_xp", {
        p_user_id: userId,
        p_amount: amount,
      })

      if (rpcErr) {
        console.warn("[Admin] increment_xp RPC failed, using fallback:", rpcErr.message)
        // RPC 없으면 fallback (read-then-write)
        const { data: profile } = await supabaseAdmin
          .from("profiles")
          .select("xp")
          .eq("id", userId)
          .maybeSingle()

        if (!profile) return Response.json({ error: "유저를 찾을 수 없습니다." }, { status: 404 })

        const newXp = Math.max(0, (profile.xp || 0) + amount)

        const { error } = await supabaseAdmin
          .from("profiles")
          .update({ xp: newXp })
          .eq("id", userId)

        if (error) return Response.json({ error: "XP 조정 실패" }, { status: 500 })

        await logAdminAction(admin.id, "adjust_xp", "user", userId, { amount, newXp })
        return Response.json({ success: true, newXp })
      }

      // RPC 성공 시 현재 XP 조회
      const { data: updatedProfile } = await supabaseAdmin
        .from("profiles")
        .select("xp")
        .eq("id", userId)
        .maybeSingle()

      const newXp = updatedProfile?.xp ?? 0
      await logAdminAction(admin.id, "adjust_xp", "user", userId, { amount, newXp })
      return Response.json({ success: true, newXp })
    }

    // ── grant_badge (배지 부여) ──
    if (action === "grant_badge") {
      const { userId, badge } = body
      if (!userId || !badge) {
        return Response.json({ error: "userId와 badge가 필요합니다." }, { status: 400 })
      }

      const { data: existing } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("id", userId)
        .maybeSingle()
      if (!existing) return Response.json({ error: "유저를 찾을 수 없습니다." }, { status: 404 })

      const { error } = await supabaseAdmin
        .from("profiles")
        .update({ badge })
        .eq("id", userId)

      if (error) return Response.json({ error: "배지 부여 실패" }, { status: 500 })

      await logAdminAction(admin.id, "grant_badge", "user", userId, { badge })
      return Response.json({ success: true })
    }

    // ── retrial_judgment (AI 판결 재심사) ──
    if (action === "retrial_judgment") {
      const { threadId } = body
      if (!threadId) {
        return Response.json({ error: "threadId가 필요합니다." }, { status: 400 })
      }

      const { data: existing } = await supabaseAdmin
        .from("threads")
        .select("id")
        .eq("id", threadId)
        .maybeSingle()
      if (!existing) return Response.json({ error: "토론을 찾을 수 없습니다." }, { status: 404 })

      // ai_verdict, ai_summary 초기화하여 재판결 가능 상태로
      const { error } = await supabaseAdmin
        .from("threads")
        .update({ ai_verdict: null, ai_summary: null })
        .eq("id", threadId)

      if (error) return Response.json({ error: "재심사 초기화 실패" }, { status: 500 })

      await logAdminAction(admin.id, "retrial_judgment", "thread", threadId, {})
      return Response.json({ success: true })
    }

    // ── delete_content ──
    if (action === "delete_content") {
      const { contentType, contentId } = body
      if (!contentId || !["comment", "thread"].includes(contentType)) {
        return Response.json({ error: "잘못된 요청입니다. contentType은 comment 또는 thread여야 합니다." }, { status: 400 })
      }

      if (contentType === "comment") {
        const { data: existing } = await supabaseAdmin
          .from("comments")
          .select("id")
          .eq("id", contentId)
          .maybeSingle()
        if (!existing) return Response.json({ error: "댓글을 찾을 수 없습니다." }, { status: 404 })

        const { error } = await supabaseAdmin
          .from("comments")
          .update({ is_deleted: true, content: "[관리자에 의해 삭제됨]" })
          .eq("id", contentId)

        if (error) {
          return Response.json({ error: "댓글 삭제에 실패했습니다." }, { status: 500 })
        }
      } else if (contentType === "thread") {
        const { data: existing } = await supabaseAdmin
          .from("threads")
          .select("id")
          .eq("id", contentId)
          .maybeSingle()
        if (!existing) return Response.json({ error: "토론을 찾을 수 없습니다." }, { status: 404 })

        const { error } = await supabaseAdmin
          .from("threads")
          .delete()
          .eq("id", contentId)

        if (error) {
          return Response.json({ error: "토론 삭제에 실패했습니다." }, { status: 500 })
        }
      }

      await logAdminAction(admin.id, "delete_content", contentType, contentId, {})
      return Response.json({ success: true })
    }

    // ── get_stats ──
    if (action === "get_stats") {
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      const [users, threads, comments, pendingReports, todayThreads, todayComments] = await Promise.all([
        supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }),
        supabaseAdmin.from("threads").select("id", { count: "exact", head: true }),
        supabaseAdmin.from("comments").select("id", { count: "exact", head: true }),
        supabaseAdmin
          .from("reports")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending"),
        supabaseAdmin
          .from("threads")
          .select("id", { count: "exact", head: true })
          .gte("created_at", today.toISOString()),
        supabaseAdmin
          .from("comments")
          .select("id", { count: "exact", head: true })
          .gte("created_at", today.toISOString()),
      ])

      return Response.json({
        totalUsers: users.count ?? 0,
        totalThreads: threads.count ?? 0,
        totalComments: comments.count ?? 0,
        pendingReports: pendingReports.count ?? 0,
        todayThreads: todayThreads.count ?? 0,
        todayComments: todayComments.count ?? 0,
      })
    }

    // ── get_ai_logs (AI 판결 로그) ──
    if (action === "get_ai_logs") {
      const { data, error } = await supabaseAdmin
        .from("threads")
        .select("id, title, ai_verdict, ai_summary, is_closed, created_at")
        .not("ai_verdict", "is", null)
        .order("created_at", { ascending: false })
        .limit(30)

      if (error) return Response.json({ error: "AI 로그 조회 실패" }, { status: 500 })
      return Response.json({ logs: data ?? [] })
    }

    // ── get_admin_logs (감사 로그) ──
    if (action === "get_admin_logs") {
      const { data, error } = await supabaseAdmin
        .from("admin_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50)

      if (error) return Response.json({ error: "감사 로그 조회 실패" }, { status: 500 })
      return Response.json({ logs: data ?? [] })
    }

    return Response.json({ error: "알 수 없는 액션입니다." }, { status: 400 })
  } catch (err) {
    console.error("[Admin API] Error:", err)
    return Response.json({ error: "서버 오류가 발생했습니다." }, { status: 500 })
  }
}
