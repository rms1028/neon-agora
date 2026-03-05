import { rateLimitResponse } from "@/lib/rate-limit"
import { authenticateUser } from "@/lib/auth-guard"
import { supabaseAdmin } from "@/lib/supabase-admin"

export async function POST(req: Request) {
  try {
    const limited = await rateLimitResponse(req, 3, 60000, true)
    if (limited) return limited

    // 인증 + 밴 체크
    const auth = await authenticateUser(req)
    if ("error" in auth) return auth.error
    const { user } = auth

    // 이메일 확인
    const { confirmEmail } = await req.json()
    if (!confirmEmail || confirmEmail !== user.email) {
      return Response.json({ error: "이메일이 일치하지 않습니다." }, { status: 400 })
    }

    // 0. 프로필 존재 확인
    const { data: profileExists } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("id", user.id)
      .maybeSingle()
    if (!profileExists) {
      console.warn(`[AccountDelete] Profile not found for user ${user.id}, proceeding with auth deletion only`)
    }

    // 1. 댓글 소프트삭제
    const { error: commentsErr } = await supabaseAdmin
      .from("comments")
      .update({ is_deleted: true, content: "[삭제된 계정]" })
      .eq("user_id", user.id)
    if (commentsErr) console.error("[AccountDelete] comments soft-delete failed:", commentsErr.message)

    // 2. 프로필 초기화
    const { error: profileErr } = await supabaseAdmin
      .from("profiles")
      .update({
        xp: 0,
        badge: "네온 뉴비",
        display_name: null,
        avatar_url: null,
        bio: null,
        custom_title: null,
      })
      .eq("id", user.id)
    if (profileErr) console.error("[AccountDelete] profile reset failed:", profileErr.message)

    // 3. 알림 삭제
    const { error: notiErr } = await supabaseAdmin
      .from("notifications")
      .delete()
      .eq("user_id", user.id)
    if (notiErr) console.error("[AccountDelete] notifications delete failed:", notiErr.message)

    // 4. 북마크 삭제
    const { error: bookmarkErr } = await supabaseAdmin
      .from("bookmarks")
      .delete()
      .eq("user_id", user.id)
    if (bookmarkErr) console.error("[AccountDelete] bookmarks delete failed:", bookmarkErr.message)

    // 5. 계정 삭제
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user.id)
    if (deleteError) {
      return Response.json({ error: "계정 삭제에 실패했습니다." }, { status: 500 })
    }

    return Response.json({ success: true })
  } catch (err) {
    console.error("[AccountDelete] Unexpected error:", err)
    return Response.json({ error: "서버 오류가 발생했습니다." }, { status: 500 })
  }
}
