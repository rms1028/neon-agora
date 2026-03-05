import { rateLimitResponse } from "@/lib/rate-limit"
import { authenticateUser } from "@/lib/auth-guard"
import { supabaseAdmin } from "@/lib/supabase-admin"

const EARLY_VOTE_THRESHOLD = 10

export async function POST(req: Request) {
  try {
    const limited = await rateLimitResponse(req, 10, 60000)
    if (limited) return limited

    const { threadId } = await req.json()
    if (!threadId || typeof threadId !== "string") {
      return Response.json({ error: "threadId가 필요합니다." }, { status: 400 })
    }

    // 인증 + 밴 체크
    const auth = await authenticateUser(req)
    if ("error" in auth) return auth.error
    const { user } = auth

    // 이미 판결이 있는지 확인
    const { data: thread } = await supabaseAdmin
      .from("threads")
      .select("ai_verdict")
      .eq("id", threadId)
      .maybeSingle()

    if (!thread) {
      return Response.json({ error: "토론을 찾을 수 없습니다." }, { status: 404 })
    }
    if (thread.ai_verdict) {
      return Response.json({ error: "이미 판결이 완료되었습니다." }, { status: 409 })
    }

    // 투표 삽입 (중복 시 무시)
    const { error: insertError } = await supabaseAdmin
      .from("judge_early_votes")
      .insert({ thread_id: threadId, user_id: user.id })

    if (insertError && insertError.code !== "23505") {
      return Response.json({ error: "투표 등록에 실패했습니다." }, { status: 500 })
    }

    // 현재 투표 수
    const { count } = await supabaseAdmin
      .from("judge_early_votes")
      .select("id", { count: "exact", head: true })
      .eq("thread_id", threadId)

    const voteCount = count ?? 0
    const thresholdReached = voteCount >= EARLY_VOTE_THRESHOLD

    return Response.json({ voteCount, thresholdReached })
  } catch (err) {
    console.error("[JudgeVote] Error:", err)
    return Response.json({ error: "서버 오류가 발생했습니다." }, { status: 500 })
  }
}
