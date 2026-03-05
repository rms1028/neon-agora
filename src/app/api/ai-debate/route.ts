import { rateLimitResponse } from "@/lib/rate-limit"
import { callGemini } from "@/lib/gemini"
import { authenticateUser } from "@/lib/auth-guard"
import { supabaseAdmin } from "@/lib/supabase-admin"

export const maxDuration = 60

export async function POST(req: Request) {
  try {
    const limited = await rateLimitResponse(req, 5, 60000)
    if (limited) return limited

    const { threadId, userMessage, userSide, turnNumber } = await req.json()

    if (!threadId || !userMessage || !userSide || typeof turnNumber !== "number") {
      return Response.json({ error: "필수 파라미터가 누락되었습니다." }, { status: 400 })
    }

    if (typeof userMessage !== "string" || userMessage.length > 500) {
      return Response.json({ error: "메시지는 500자 이내여야 합니다." }, { status: 400 })
    }

    if (turnNumber < 1 || turnNumber > 5) {
      return Response.json({ error: "최대 5턴까지 대화할 수 있습니다." }, { status: 400 })
    }

    if (userSide !== "pro" && userSide !== "con") {
      return Response.json({ error: "유효하지 않은 입장입니다." }, { status: 400 })
    }

    // 인증 + 밴 체크
    const auth = await authenticateUser(req)
    if ("error" in auth) return auth.error
    const { user } = auth

    // XP 확인 (30 이상)
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("xp")
      .eq("id", user.id)
      .maybeSingle()

    if (!profile || profile.xp < 30) {
      return Response.json(
        { error: "30 XP 이상부터 AI 토론을 할 수 있습니다." },
        { status: 403 }
      )
    }

    // 토론 데이터 로드
    const { data: thread } = await supabaseAdmin
      .from("threads")
      .select("title, content")
      .eq("id", threadId)
      .maybeSingle()

    if (!thread) {
      return Response.json({ error: "토론을 찾을 수 없습니다." }, { status: 404 })
    }

    // 이전 대화 로드
    const { data: prevMessages } = await supabaseAdmin
      .from("ai_debate_messages")
      .select("user_message, ai_message, turn_number, user_side")
      .eq("thread_id", threadId)
      .eq("user_id", user.id)
      .order("turn_number", { ascending: true })

    const aiSide = userSide === "pro" ? "반대" : "찬성"
    const userSideLabel = userSide === "pro" ? "찬성" : "반대"

    // 대화 히스토리 구성
    let history = ""
    for (const msg of prevMessages ?? []) {
      const m = msg as Record<string, unknown>
      history += `\n[${userSideLabel} 유저] ${m.user_message}\n[${aiSide} AI] ${m.ai_message}\n`
    }

    const systemPrompt = `당신은 네온 아고라의 AI 토론 상대입니다. 당신은 "${aiSide}" 입장을 취합니다.
토론 주제: ${thread.title}
${thread.content ? `배경: ${thread.content}` : ""}

규칙:
- 항상 ${aiSide} 입장에서 논리적으로 반론하세요
- 한국어로 2-3문장으로 간결하게 답변하세요
- 상대방의 논점을 인정하면서도 반박 포인트를 제시하세요
- 턴 ${turnNumber}/5 — ${turnNumber === 5 ? "마지막 턴이니 정리 발언을 해주세요" : "대화를 이어가세요"}`

    const userPrompt = history
      ? `${history}\n[${userSideLabel} 유저] ${userMessage}\n\n위 대화를 이어서 ${aiSide} 입장에서 반론해주세요.`
      : `[${userSideLabel} 유저] ${userMessage}\n\n${aiSide} 입장에서 반론해주세요.`

    // Gemini API 호출
    const aiResult = await callGemini({
      systemPrompt,
      userPrompt,
      temperature: 0.8,
      maxOutputTokens: 512,
    })

    if ("error" in aiResult) {
      console.error("[AIDebate] Gemini error:", aiResult.error)
      if (aiResult.status === 429) {
        return new Response(JSON.stringify({ error: aiResult.error }), { status: 429, headers: { "Content-Type": "application/json", "Retry-After": "60" } })
      }
      return Response.json({ error: aiResult.error }, { status: aiResult.status })
    }

    const aiMessage = aiResult.text

    // DB 저장
    await supabaseAdmin.from("ai_debate_messages").insert({
      thread_id: threadId,
      user_id: user.id,
      user_side: userSide,
      user_message: userMessage.slice(0, 500),
      ai_message: aiMessage,
      turn_number: turnNumber,
    })

    return Response.json({ aiMessage, turnNumber })
  } catch (err) {
    console.error("[AIDebate] Unexpected error:", err)
    return Response.json({ error: "서버 오류가 발생했습니다." }, { status: 500 })
  }
}
