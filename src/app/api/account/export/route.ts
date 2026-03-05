import { rateLimitResponse } from "@/lib/rate-limit"
import { authenticateUser } from "@/lib/auth-guard"
import { supabaseAdmin } from "@/lib/supabase-admin"

export async function GET(req: Request) {
  try {
    // 24시간에 3회 제한
    const limited = await rateLimitResponse(req, 3, 86400000)
    if (limited) return limited

    // 인증 + 밴 체크
    const auth = await authenticateUser(req)
    if ("error" in auth) return auth.error
    const { user } = auth

    const userId = user.id

    // 병렬 fetch
    const [
      { data: profile },
      { data: threads },
      { data: comments },
      { data: votes },
      { data: bookmarks },
      { data: achievements },
      { data: following },
      { data: followers },
    ] = await Promise.all([
      supabaseAdmin.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabaseAdmin.from("threads").select("id, title, content, tag, template, pro_count, con_count, created_at, is_closed").eq("created_by", userId).order("created_at", { ascending: false }).limit(500),
      supabaseAdmin.from("comments").select("id, thread_id, content, side, created_at, parent_id").eq("user_id", userId).order("created_at", { ascending: false }).limit(2000),
      supabaseAdmin.from("thread_votes").select("thread_id, vote_type, created_at").eq("user_id", userId).limit(2000),
      supabaseAdmin.from("bookmarks").select("thread_id, created_at").eq("user_id", userId).limit(500),
      supabaseAdmin.from("user_achievements").select("achievement_key, unlocked_at").eq("user_id", userId),
      supabaseAdmin.from("follows").select("following_id, created_at").eq("follower_id", userId).limit(500),
      supabaseAdmin.from("follows").select("follower_id, created_at").eq("following_id", userId).limit(500),
    ])

    const exportData = {
      exported_at: new Date().toISOString(),
      user: {
        id: userId,
        email: user.email,
        created_at: user.created_at,
      },
      profile: profile ?? null,
      threads: threads ?? [],
      comments: comments ?? [],
      votes: votes ?? [],
      bookmarks: bookmarks ?? [],
      achievements: achievements ?? [],
      following: following ?? [],
      followers: followers ?? [],
    }

    const json = JSON.stringify(exportData, null, 2)
    const date = new Date().toISOString().slice(0, 10)

    return new Response(json, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="neon-agora-export-${date}.json"`,
      },
    })
  } catch (err) {
    console.error("[Export] Unexpected error:", err)
    return Response.json({ error: "서버 오류가 발생했습니다." }, { status: 500 })
  }
}
