import { rateLimitResponse } from "@/lib/rate-limit"
import { callGemini, extractJson } from "@/lib/gemini"
import { authenticateUser } from "@/lib/auth-guard"
import { supabaseAdmin } from "@/lib/supabase-admin"

export const maxDuration = 60

type ClashReport = {
  momentum: "pro" | "con" | "even"
  pro_summary: string
  con_summary: string
  key_arguments: { side: "pro" | "con"; point: string }[]
  verdict_hint: string
  generated_at: string
}

export async function POST(req: Request) {
  try {
    const limited = await rateLimitResponse(req, 5, 60000)
    if (limited) return limited

    const { threadId } = await req.json()
    if (!threadId || typeof threadId !== "string") {
      return Response.json({ error: "threadId가 필요합니다." }, { status: 400 })
    }

    // 인증 + 밴 체크
    const auth = await authenticateUser(req)
    if ("error" in auth) return auth.error

    // 스레드 확인
    const { data: thread } = await supabaseAdmin
      .from("threads")
      .select("id, title, content, template, pro_count, con_count, ai_summary")
      .eq("id", threadId)
      .maybeSingle()

    if (!thread) {
      return Response.json({ error: "토론을 찾을 수 없습니다." }, { status: 404 })
    }

    if (thread.template !== "strict") {
      return Response.json({ error: "찬반 격돌 토론만 리포트를 생성할 수 있습니다." }, { status: 400 })
    }

    // 댓글 조회 (최근 50개)
    const { data: comments } = await supabaseAdmin
      .from("comments")
      .select("id, content, side, user_id, is_deleted")
      .eq("thread_id", threadId)
      .order("created_at", { ascending: false })
      .limit(50)

    const activeComments = (comments ?? []).filter(
      (c: Record<string, unknown>) => c.is_deleted !== true && (c.side === "pro" || c.side === "con")
    )

    if (activeComments.length < 2) {
      return Response.json({ error: "분석할 댓글이 충분하지 않습니다. (최소 2개)" }, { status: 400 })
    }

    const proComments = activeComments
      .filter((c: Record<string, unknown>) => c.side === "pro")
      .map((c: Record<string, unknown>) => String(c.content))
      .slice(0, 20)

    const conComments = activeComments
      .filter((c: Record<string, unknown>) => c.side === "con")
      .map((c: Record<string, unknown>) => String(c.content))
      .slice(0, 20)

    // Gemini API 호출
    const systemPrompt = `당신은 온라인 토론 분석 전문 AI입니다. 찬반 토론의 양측 댓글을 분석하여 현재 여론의 흐름과 핵심 논거를 요약합니다.
반드시 아래 JSON 형식으로만 응답하세요. 다른 텍스트는 절대 포함하지 마세요.

{
  "momentum": "pro 또는 con 또는 even",
  "pro_summary": "찬성 측의 핵심 주장 요약 (2-3문장, 한국어)",
  "con_summary": "반대 측의 핵심 주장 요약 (2-3문장, 한국어)",
  "key_arguments": [
    { "side": "pro", "point": "핵심 논거 1" },
    { "side": "con", "point": "핵심 논거 2" },
    { "side": "pro", "point": "핵심 논거 3" },
    { "side": "con", "point": "핵심 논거 4" }
  ],
  "verdict_hint": "현재 토론의 흐름에 대한 한 줄 평가 (한국어)"
}`

    const userPrompt = `다음 찬반 토론을 분석해주세요.

## 토론 제목
${thread.title}

## 토론 내용
${thread.content ?? ""}

## 현재 투표 현황
찬성 ${thread.pro_count ?? 0}표 / 반대 ${thread.con_count ?? 0}표

## 찬성 측 댓글 (${proComments.length}개)
${proComments.map((c: string, i: number) => `${i + 1}. ${c}`).join("\n")}

## 반대 측 댓글 (${conComments.length}개)
${conComments.map((c: string, i: number) => `${i + 1}. ${c}`).join("\n")}`

    const aiResult = await callGemini({
      systemPrompt,
      userPrompt,
      temperature: 0.4,
      maxOutputTokens: 2048,
    })

    if ("error" in aiResult) {
      console.error("[ClashReport] Gemini error:", aiResult.error)
      return Response.json({ error: aiResult.error }, { status: aiResult.status })
    }

    const rawParsed = extractJson<Record<string, unknown>>(aiResult.text)
    if (!rawParsed) {
      console.error("[ClashReport] JSON 파싱 실패:", aiResult.text.slice(0, 500))
      return Response.json({ error: "AI 응답 파싱에 실패했습니다." }, { status: 502 })
    }

    const report: ClashReport = {
      momentum: rawParsed.momentum === "pro" || rawParsed.momentum === "con" ? rawParsed.momentum : "even",
      pro_summary: String(rawParsed.pro_summary ?? ""),
      con_summary: String(rawParsed.con_summary ?? ""),
      key_arguments: Array.isArray(rawParsed.key_arguments)
        ? (rawParsed.key_arguments as { side?: string; point?: string }[]).slice(0, 6).map((a) => ({
            side: (a.side === "pro" || a.side === "con" ? a.side : "pro") as "pro" | "con",
            point: String(a.point ?? ""),
          }))
        : [],
      verdict_hint: String(rawParsed.verdict_hint ?? ""),
      generated_at: new Date().toISOString(),
    }

    // DB에 저장 (ai_summary JSONB에 clash_report로 저장)
    const existingSummary = thread.ai_summary && typeof thread.ai_summary === "object"
      ? thread.ai_summary as Record<string, unknown>
      : {}
    const updatedSummary = { ...existingSummary, clash_report: report }

    await supabaseAdmin
      .from("threads")
      .update({ ai_summary: updatedSummary })
      .eq("id", threadId)

    return Response.json({ report })
  } catch (err) {
    console.error("[ClashReport] 서버 오류:", err)
    return Response.json({ error: "서버 오류가 발생했습니다." }, { status: 500 })
  }
}
