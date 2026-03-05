import { type User } from "@supabase/supabase-js"
import { supabaseAdmin } from "@/lib/supabase-admin"

/**
 * Authenticate a request via Bearer token and check ban status.
 * Returns the authenticated user + token, or an error Response.
 */
export async function authenticateUser(
  req: Request,
): Promise<{ user: User; token: string } | { error: Response }> {
  const authHeader =
    req.headers.get("Authorization") ?? req.headers.get("authorization")
  const token = authHeader?.replace("Bearer ", "").trim()

  if (!token) {
    return {
      error: Response.json({ error: "인증이 필요합니다." }, { status: 401 }),
    }
  }

  const {
    data: { user },
    error: authError,
  } = await supabaseAdmin.auth.getUser(token)

  if (authError || !user) {
    return {
      error: Response.json({ error: "인증에 실패했습니다." }, { status: 401 }),
    }
  }

  // Ban check
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("banned_until")
    .eq("id", user.id)
    .maybeSingle()

  if (profile?.banned_until) {
    const bannedUntil = new Date(profile.banned_until)
    if (bannedUntil > new Date()) {
      const remaining = Math.ceil(
        (bannedUntil.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
      )
      return {
        error: Response.json(
          {
            error: `계정이 정지되었습니다. 남은 기간: ${remaining}일 (${bannedUntil.toLocaleDateString("ko-KR")}까지)`,
          },
          { status: 403 },
        ),
      }
    }
  }

  return { user, token }
}
