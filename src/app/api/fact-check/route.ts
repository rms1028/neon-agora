import { rateLimitResponse } from "@/lib/rate-limit"
import { callGemini, extractJson } from "@/lib/gemini"
import { authenticateUser } from "@/lib/auth-guard"
import { supabaseAdmin } from "@/lib/supabase-admin"

export const maxDuration = 60

type FactCheckResult = {
  verdict: "확인됨" | "의심" | "거짓" | "판단불가"
  explanation: string
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

    // XP 확인 (50 XP 이상)
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("xp")
      .eq("id", user.id)
      .maybeSingle()

    if (!profile || profile.xp < 50) {
      return Response.json(
        { error: "50 XP 이상만 팩트체크를 요청할 수 있습니다." },
        { status: 403 }
      )
    }

    // 중복 체크
    const { data: existing } = await supabaseAdmin
      .from("fact_checks")
      .select("id")
      .eq("comment_id", commentId)
      .maybeSingle()

    if (existing) {
      return Response.json(
        { error: "이미 팩트체크가 완료된 댓글입니다." },
        { status: 409 }
      )
    }

    // 댓글 데이터 로드
    const { data: comment } = await supabaseAdmin
      .from("comments")
      .select("content, side, thread_id")
      .eq("id", commentId)
      .maybeSingle()

    if (!comment) {
      return Response.json({ error: "댓글을 찾을 수 없습니다." }, { status: 404 })
    }

    // 토론 제목 로드 (컨텍스트용)
    const { data: thread } = await supabaseAdmin
      .from("threads")
      .select("title")
      .eq("id", comment.thread_id)
      .maybeSingle()

    // Gemini API 호출
    const systemPrompt = `당신은 팩트체크 전문 AI입니다. 주어진 댓글의 사실 여부를 검증합니다.
반드시 아래 JSON 형식으로만 응답하세요. 다른 텍스트는 절대 포함하지 마세요.

{
  "verdict": "확인됨 또는 의심 또는 거짓 또는 판단불가",
  "explanation": "판단 근거 설명 (2-3문장, 한국어)"
}`

    const userPrompt = `다음 댓글의 사실 여부를 검증해주세요.

## 토론 제목
${thread?.title ?? "(알 수 없음)"}

## 댓글 내용
${comment.content}

## 입장
${comment.side === "pro" ? "찬성" : "반대"}`

    const aiResult = await callGemini({
      systemPrompt,
      userPrompt,
      temperature: 0.3,
      maxOutputTokens: 1024,
    })

    if ("error" in aiResult) {
      console.error("[FactCheck] Gemini error:", aiResult.error)
      if (aiResult.status === 429) {
        return new Response(JSON.stringify({ error: aiResult.error }), { status: 429, headers: { "Content-Type": "application/json", "Retry-After": "60" } })
      }
      return Response.json({ error: aiResult.error }, { status: aiResult.status })
    }

    const parsed = extractJson<Partial<FactCheckResult>>(aiResult.text)
    if (!parsed) {
      return Response.json({ error: "AI 응답을 파싱할 수 없습니다." }, { status: 500 })
    }

    const validVerdicts = ["확인됨", "의심", "거짓", "판단불가"]
    const verdict = validVerdicts.includes(parsed.verdict ?? "")
      ? (parsed.verdict as FactCheckResult["verdict"])
      : "판단불가"
    const explanation = String(parsed.explanation || "판단 근거를 생성할 수 없습니다.")

    // DB 저장
    const { error: saveError } = await supabaseAdmin
      .from("fact_checks")
      .insert({
        comment_id: commentId,
        verdict,
        explanation,
        checked_by: user.id,
      })

    if (saveError) {
      console.error("[FactCheck] DB save error:", saveError.message)
      return Response.json({ error: "팩트체크 저장에 실패했습니다." }, { status: 500 })
    }

    return Response.json({ verdict, explanation })
  } catch (err) {
    console.error("[FactCheck] Unexpected error:", err)
    return Response.json({ error: "서버 오류가 발생했습니다." }, { status: 500 })
  }
}
