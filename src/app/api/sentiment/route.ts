import { rateLimitResponse } from "@/lib/rate-limit"
import { callGemini, extractJsonArray } from "@/lib/gemini"
import { authenticateUser } from "@/lib/auth-guard"
import { supabaseAdmin } from "@/lib/supabase-admin"

export const maxDuration = 60

type SentimentItem = {
  comment_id: string
  tone: string
  confidence: number
}

export async function POST(req: Request) {
  try {
    const limited = await rateLimitResponse(req, 5, 60000)
    if (limited) return limited

    const { commentIds } = await req.json()
    if (!Array.isArray(commentIds) || commentIds.length === 0) {
      return Response.json({ error: "commentIds 배열이 필요합니다." }, { status: 400 })
    }

    const ids = commentIds.slice(0, 20).filter((id): id is string => typeof id === "string")
    if (ids.length === 0) {
      return Response.json({ error: "유효한 commentId가 없습니다." }, { status: 400 })
    }

    // 인증 + 밴 체크
    const auth = await authenticateUser(req)
    if ("error" in auth) return auth.error

    // 이미 분석된 댓글 제외
    const { data: existingRows } = await supabaseAdmin
      .from("comment_sentiments")
      .select("comment_id")
      .in("comment_id", ids)

    const existingSet = new Set(
      (existingRows ?? []).map((r: Record<string, unknown>) => String(r.comment_id))
    )
    const newIds = ids.filter((id) => !existingSet.has(id))
    if (newIds.length === 0) {
      return Response.json({ results: [] })
    }

    // 댓글 내용 로드
    const { data: comments } = await supabaseAdmin
      .from("comments")
      .select("id, content")
      .in("id", newIds)

    if (!comments || comments.length === 0) {
      return Response.json({ results: [] })
    }

    const commentTexts = (comments as { id: string; content: string }[])
      .map((c, i) => `[${i}] ID: ${c.id}\n내용: ${c.content}`)
      .join("\n\n")

    const systemPrompt = `당신은 감성 분석 AI입니다. 각 댓글의 감정 톤을 분류합니다.
반드시 아래 JSON 배열 형식으로만 응답하세요.

[
  { "comment_id": "...", "tone": "공격적 또는 논리적 또는 감성적 또는 중립적 또는 유머", "confidence": 0-100 }
]

- 공격적: 비하, 욕설, 공격적 어조
- 논리적: 이성적, 근거 기반
- 감성적: 감정 호소, 공감
- 중립적: 무감정, 사실만 서술
- 유머: 재치, 밈, 유머 사용`

    const aiResult = await callGemini({
      systemPrompt,
      userPrompt: `다음 댓글들의 감정 톤을 분류해주세요.\n\n${commentTexts}`,
      temperature: 0.2,
      maxOutputTokens: 2048,
    })

    if ("error" in aiResult) {
      console.error("[Sentiment] Gemini error:", aiResult.error)
      if (aiResult.status === 429) {
        return new Response(JSON.stringify({ error: aiResult.error }), { status: 429, headers: { "Content-Type": "application/json", "Retry-After": "60" } })
      }
      return Response.json({ error: aiResult.error }, { status: aiResult.status })
    }

    const parsed = extractJsonArray<SentimentItem>(aiResult.text)
    if (!parsed) {
      return Response.json({ error: "AI 응답을 파싱할 수 없습니다." }, { status: 500 })
    }

    const validTones = ["공격적", "논리적", "감성적", "중립적", "유머"]
    const toInsert = parsed
      .filter((item) => item.comment_id && validTones.includes(item.tone))
      .map((item) => ({
        comment_id: item.comment_id,
        tone: item.tone,
        confidence: Math.max(0, Math.min(100, Number(item.confidence) || 50)),
      }))

    if (toInsert.length > 0) {
      await supabaseAdmin
        .from("comment_sentiments")
        .insert(toInsert)
        .select() // ON CONFLICT handled by UNIQUE constraint — duplicates fail silently
    }

    return Response.json({ results: toInsert })
  } catch (err) {
    console.error("[Sentiment] Unexpected error:", err)
    return Response.json({ error: "서버 오류가 발생했습니다." }, { status: 500 })
  }
}
