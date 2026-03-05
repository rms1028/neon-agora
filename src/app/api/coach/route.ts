import { rateLimitResponse } from "@/lib/rate-limit"
import { callGemini, extractJson } from "@/lib/gemini"
import { authenticateUser } from "@/lib/auth-guard"
import { supabaseAdmin } from "@/lib/supabase-admin"

export const maxDuration = 60

type CoachResult = {
  scores: { logic: number; persuasion: number; evidence: number; overall: number }
  strengths: string[]
  improvements: string[]
}

export async function POST(req: Request) {
  try {
    const limited = await rateLimitResponse(req, 5, 60000)
    if (limited) return limited

    const { commentId } = await req.json()
    if (!commentId || typeof commentId !== "string") {
      return Response.json({ error: "commentId가 필요합니다." }, { status: 400 })
    }

    // 인증 + 밴 체크
    const auth = await authenticateUser(req)
    if ("error" in auth) return auth.error
    const { user } = auth

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("xp")
      .eq("id", user.id)
      .maybeSingle()

    if (!profile || profile.xp < 30) {
      return Response.json(
        { error: "30 XP 이상만 코칭을 요청할 수 있습니다." },
        { status: 403 }
      )
    }

    // 중복 체크
    const { data: existing } = await supabaseAdmin
      .from("comment_coaching")
      .select("id")
      .eq("comment_id", commentId)
      .maybeSingle()

    if (existing) {
      return Response.json(
        { error: "이미 코칭이 완료된 댓글입니다." },
        { status: 409 }
      )
    }

    const { data: comment } = await supabaseAdmin
      .from("comments")
      .select("content, side, thread_id, user_id")
      .eq("id", commentId)
      .maybeSingle()

    if (!comment) {
      return Response.json({ error: "댓글을 찾을 수 없습니다." }, { status: 404 })
    }

    // 본인 댓글만 코칭 가능
    if (comment.user_id !== user.id) {
      return Response.json({ error: "본인의 댓글만 코칭받을 수 있습니다." }, { status: 403 })
    }

    const { data: thread } = await supabaseAdmin
      .from("threads")
      .select("title")
      .eq("id", comment.thread_id)
      .maybeSingle()

    const systemPrompt = `당신은 토론 코치 AI입니다. 댓글의 논증 품질을 분석합니다.
반드시 아래 JSON 형식으로만 응답하세요.

{
  "scores": { "logic": 0-100, "persuasion": 0-100, "evidence": 0-100, "overall": 0-100 },
  "strengths": ["강점1", "강점2"],
  "improvements": ["개선점1", "개선점2"]
}

- logic: 논리적 일관성과 논증 구조
- persuasion: 설득력과 수사법
- evidence: 근거와 데이터 제시
- overall: 종합 점수
- strengths: 잘한 점 2-3개 (한국어, 짧게)
- improvements: 개선할 점 2-3개 (한국어, 짧게)`

    const userPrompt = `다음 토론 댓글을 분석해주세요.

## 토론 제목
${thread?.title ?? "(알 수 없음)"}

## 입장
${comment.side === "pro" ? "찬성" : "반대"}

## 댓글 내용
${comment.content}`

    const aiResult = await callGemini({
      systemPrompt,
      userPrompt,
      temperature: 0.4,
      maxOutputTokens: 1024,
    })

    if ("error" in aiResult) {
      console.error("[Coach] Gemini error:", aiResult.error)
      if (aiResult.status === 429) {
        return new Response(JSON.stringify({ error: aiResult.error }), { status: 429, headers: { "Content-Type": "application/json", "Retry-After": "60" } })
      }
      return Response.json({ error: aiResult.error }, { status: aiResult.status })
    }

    const parsed = extractJson<Partial<CoachResult>>(aiResult.text)
    if (!parsed) {
      return Response.json({ error: "AI 응답을 파싱할 수 없습니다." }, { status: 500 })
    }

    const clamp = (n: unknown) => Math.max(0, Math.min(100, Number(n) || 0))
    const scores = {
      logic: clamp(parsed.scores?.logic),
      persuasion: clamp(parsed.scores?.persuasion),
      evidence: clamp(parsed.scores?.evidence),
      overall: clamp(parsed.scores?.overall),
    }
    const strengths = Array.isArray(parsed.strengths) ? parsed.strengths.map(String).slice(0, 5) : []
    const improvements = Array.isArray(parsed.improvements) ? parsed.improvements.map(String).slice(0, 5) : []

    const { error: saveError } = await supabaseAdmin
      .from("comment_coaching")
      .insert({
        comment_id: commentId,
        user_id: user.id,
        scores,
        strengths,
        improvements,
      })

    if (saveError) {
      return Response.json({ error: "코칭 저장에 실패했습니다." }, { status: 500 })
    }

    return Response.json({ scores, strengths, improvements })
  } catch (err) {
    console.error("[Coach] Unexpected error:", err)
    return Response.json({ error: "서버 오류가 발생했습니다." }, { status: 500 })
  }
}
