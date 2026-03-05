import { rateLimitResponse } from "@/lib/rate-limit"
import { supabaseAdmin } from "@/lib/supabase-admin"

/** fetch with 1 retry on failure */
async function fetchWithRetry(url: string, init: RequestInit, label: string) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, init)
      if (res.ok || res.status < 500) return
      console.error(`[${label}] attempt ${attempt + 1} status: ${res.status}`)
    } catch (e) {
      console.error(`[${label}] attempt ${attempt + 1} error:`, e)
    }
  }
}

// ─── GET: Vercel Cron 배치 마감 ───────────────────────────────────────────
export async function GET(req: Request) {
  try {
    // CRON_SECRET 검증 — 미설정/빈 문자열 시에도 차단
    const authHeader = req.headers.get("authorization")
    const cronSecret = process.env.CRON_SECRET
    if (!cronSecret || cronSecret.length < 8 || authHeader !== `Bearer ${cronSecret}`) {
      return Response.json({ error: "Unauthorized" }, { status: 401 })
    }

    // 만료된 미마감 스레드 최대 50건 조회
    const { data: expired, error: queryError } = await supabaseAdmin
      .from("threads")
      .select("id, template, title, created_by")
      .eq("is_closed", false)
      .not("expires_at", "is", null)
      .lte("expires_at", new Date().toISOString())
      .limit(50)

    if (queryError) {
      console.error("[AutoClose Cron] Query error:", queryError.message)
      return Response.json({ error: "DB 조회 실패" }, { status: 500 })
    }

    if (!expired || expired.length === 0) {
      return Response.json({ closed: 0, total: 0 })
    }

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000")
    const systemHeaders = {
      "Content-Type": "application/json",
      "X-System-Key": process.env.CRON_SECRET || "",
    }

    let closedCount = 0

    for (const thread of expired) {
      const { data: updated } = await supabaseAdmin
        .from("threads")
        .update({ is_closed: true, closed_at: new Date().toISOString() })
        .eq("id", thread.id)
        .eq("is_closed", false)
        .select("id")

      if (!updated || updated.length === 0) continue
      closedCount++

      // 마감 알림 — 투표/댓글 참여자에게
      try {
        const [{ data: voters }, { data: commenters }] = await Promise.all([
          supabaseAdmin.from("thread_votes").select("user_id").eq("thread_id", thread.id),
          supabaseAdmin.from("comments").select("user_id").eq("thread_id", thread.id),
        ])
        const pids = new Set<string>()
        for (const r of voters ?? []) pids.add(String((r as Record<string, unknown>).user_id))
        for (const r of commenters ?? []) pids.add(String((r as Record<string, unknown>).user_id))
        if (thread.created_by) pids.add(String(thread.created_by))

        const threadTitle = String(thread.title ?? "")
        const notifs = [...pids].map((uid) => ({
          user_id: uid,
          type: "deadline",
          thread_id: thread.id,
          thread_title: threadTitle,
          message: `토론이 마감되었습니다: "${threadTitle}"`,
        }))
        if (notifs.length > 0) {
          await supabaseAdmin.from("notifications").insert(notifs)
        }
      } catch (e) {
        console.error("[AutoClose Cron] notification error:", e)
      }

      // fire-and-forget with retry: 자동 요약
      fetchWithRetry(`${baseUrl}/api/auto-summary`, {
        method: "POST",
        headers: systemHeaders,
        body: JSON.stringify({ threadId: thread.id }),
      }, "AutoClose Cron auto-summary")

      // strict 템플릿만 AI 판사
      if (thread.template === "strict") {
        fetchWithRetry(`${baseUrl}/api/judge`, {
          method: "POST",
          headers: systemHeaders,
          body: JSON.stringify({ threadId: thread.id }),
        }, "AutoClose Cron judge")
      }
    }

    return Response.json({ closed: closedCount, total: expired.length })
  } catch (err) {
    console.error("[AutoClose Cron] Unexpected error:", err)
    return Response.json({ error: "서버 오류" }, { status: 500 })
  }
}

// ─── POST: 단건 마감 ──────────────────────────────────────────────────────
export async function POST(req: Request) {
  try {
    const limited = await rateLimitResponse(req, 10, 60000)
    if (limited) return limited

    // 인증 확인: Bearer 토큰 또는 시스템 키
    const authHeader = req.headers.get("authorization")
    const systemKey = req.headers.get("x-system-key")
    const cronSecret = process.env.CRON_SECRET

    if (systemKey && cronSecret && systemKey === cronSecret) {
      // 내부 시스템 호출 (Cron에서 fire-and-forget) → 허용
    } else if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.replace("Bearer ", "")
      const { error: authError } = await supabaseAdmin.auth.getUser(token)
      if (authError) {
        return Response.json({ error: "유효하지 않은 토큰입니다." }, { status: 401 })
      }
    } else {
      return Response.json({ error: "인증이 필요합니다." }, { status: 401 })
    }

    const { threadId } = await req.json()
    if (!threadId || typeof threadId !== "string") {
      return Response.json({ error: "threadId가 필요합니다." }, { status: 400 })
    }

    // ① 스레드 조회 + 만료 시간 검증 (서버 타임)
    const { data: thread } = await supabaseAdmin
      .from("threads")
      .select("id, expires_at, is_closed, template")
      .eq("id", threadId)
      .maybeSingle()

    if (!thread) {
      return Response.json({ error: "토론을 찾을 수 없습니다." }, { status: 404 })
    }

    if (thread.is_closed) {
      return Response.json({ already: true })
    }

    if (!thread.expires_at) {
      return Response.json({ error: "만료 시간이 설정되지 않은 토론입니다." }, { status: 400 })
    }

    const expiresAt = new Date(thread.expires_at)
    if (expiresAt.getTime() > Date.now()) {
      return Response.json({ error: "아직 만료되지 않았습니다." }, { status: 400 })
    }

    // ② 원자적 마감 (is_closed=false → true, 중복 방지)
    const { data: updated, error: updateError } = await supabaseAdmin
      .from("threads")
      .update({ is_closed: true, closed_at: new Date().toISOString() })
      .eq("id", threadId)
      .eq("is_closed", false)
      .select("id")

    if (updateError) {
      console.error("[AutoClose] DB error:", updateError.message)
      return Response.json({ error: "마감 처리 실패." }, { status: 500 })
    }

    if (!updated || updated.length === 0) {
      return Response.json({ already: true })
    }

    // ③ fire-and-forget: AI 판사 (strict만) + 자동 요약
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000")
    const systemHeaders = {
      "Content-Type": "application/json",
      "X-System-Key": process.env.CRON_SECRET || "",
    }

    // 자동 요약 (모든 템플릿) — with retry
    fetchWithRetry(`${baseUrl}/api/auto-summary`, {
      method: "POST",
      headers: systemHeaders,
      body: JSON.stringify({ threadId }),
    }, "AutoClose auto-summary")

    // AI 판사 (strict 템플릿만) — with retry
    if (thread.template === "strict") {
      fetchWithRetry(`${baseUrl}/api/judge`, {
        method: "POST",
        headers: systemHeaders,
        body: JSON.stringify({ threadId }),
      }, "AutoClose judge")
    }

    return Response.json({ closed: true })
  } catch (err) {
    console.error("[AutoClose] Unexpected error:", err)
    return Response.json({ error: "서버 오류가 발생했습니다." }, { status: 500 })
  }
}
