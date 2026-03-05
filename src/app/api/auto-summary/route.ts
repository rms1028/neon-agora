import { rateLimitResponse } from "@/lib/rate-limit"
import { callGemini, extractJson } from "@/lib/gemini"
import { authenticateUser } from "@/lib/auth-guard"
import { supabaseAdmin } from "@/lib/supabase-admin"

export const maxDuration = 60

export type AutoSummary = {
  key_points: string[]
  pro_main: string
  con_main: string
  consensus: string
  generated_at: string
}

export async function POST(req: Request) {
  try {
    const limited = await rateLimitResponse(req, 5, 60000)
    if (limited) return limited

    // ① 요청 파싱
    const { threadId } = await req.json()
    if (!threadId || typeof threadId !== "string") {
      return Response.json({ error: "threadId가 필요합니다." }, { status: 400 })
    }

    // ② 인증 (시스템 키 or 로그인 유저)
    const systemKey = req.headers.get("X-System-Key")
    const isSystem = systemKey === process.env.CRON_SECRET && !!systemKey

    if (!isSystem) {
      const auth = await authenticateUser(req)
      if ("error" in auth) return auth.error
    }

    // ③ 토론 로드
    const { data: thread } = await supabaseAdmin
      .from("threads")
      .select("id, title, content, ai_auto_summary")
      .eq("id", threadId)
      .maybeSingle()

    if (!thread) {
      return Response.json({ error: "토론을 찾을 수 없습니다." }, { status: 404 })
    }

    // 이미 요약이 있으면 반환
    if (thread.ai_auto_summary && typeof thread.ai_auto_summary === "object") {
      return Response.json(thread.ai_auto_summary)
    }

    // ④ 댓글 수 확인
    const { count } = await supabaseAdmin
      .from("comments")
      .select("id", { count: "exact", head: true })
      .eq("thread_id", threadId)

    if (!count || count < 10) {
      return Response.json(
        { error: "댓글이 10개 이상이어야 자동 요약이 생성됩니다." },
        { status: 400 }
      )
    }

    // ⑤ Race condition 방지: 빈 객체로 먼저 잠금
    const { data: lockResult } = await supabaseAdmin
      .from("threads")
      .update({ ai_auto_summary: {} })
      .eq("id", threadId)
      .is("ai_auto_summary", null)
      .select("id")

    if (!lockResult || lockResult.length === 0) {
      // 이미 다른 요청이 처리 중 — 잠시 후 결과 반환 시도
      return Response.json(
        { error: "요약이 이미 생성 중입니다." },
        { status: 409 }
      )
    }

    // 락 획득 후 AI 처리 — 실패 시 반드시 락 해제
    const releaseLock = () =>
      supabaseAdmin
        .from("threads")
        .update({ ai_auto_summary: null })
        .eq("id", threadId)

    try {
      // ⑥ 댓글 수집 (최대 40개)
      const { data: comments } = await supabaseAdmin
        .from("comments")
        .select("content, side")
        .eq("thread_id", threadId)
        .order("created_at", { ascending: false })
        .limit(40)

      const proComments = (comments ?? []).filter((c) => c.side === "pro")
      const conComments = (comments ?? []).filter((c) => c.side === "con")

      const fmtList = (list: { content: string }[]) =>
        list.length > 0
          ? list.map((c, i) => `[${i + 1}] ${c.content}`).join("\n")
          : "(댓글 없음)"

      // ⑦ AI 프롬프트 구성
      const userPrompt = `다음 토론의 핵심을 요약해주세요.

## 토론 제목
${thread.title}

## 토론 본문
${thread.content || "(본문 없음)"}

## 찬성 측 댓글 (${proComments.length}개)
${fmtList(proComments)}

## 반대 측 댓글 (${conComments.length}개)
${fmtList(conComments)}

전체 토론 흐름을 분석하여 핵심 포인트, 각 진영의 주요 논점, 합의점을 정리해주세요.`

      const systemPrompt = `당신은 '네온 아고라' 토론 요약 AI입니다. 중립적이고 간결하게 토론을 요약합니다.
반드시 아래 JSON 형식으로만 응답하세요. 다른 텍스트는 절대 포함하지 마세요.

{
  "key_points": ["핵심 포인트 1 (한국어)", "핵심 포인트 2", "핵심 포인트 3"],
  "pro_main": "찬성 측 핵심 논점 요약 (2-3문장, 한국어)",
  "con_main": "반대 측 핵심 논점 요약 (2-3문장, 한국어)",
  "consensus": "양측의 공통점이나 합의 가능 지점 (1-2문장, 한국어. 없으면 핵심 쟁점 설명)"
}`

      // ⑧ Gemini API 호출
      const aiResult = await callGemini({
        systemPrompt,
        userPrompt,
        temperature: 0.5,
        maxOutputTokens: 65536,
      })

      if ("error" in aiResult) {
        console.error("[AutoSummary] Gemini error:", aiResult.error)
        await releaseLock()
        return Response.json({ error: aiResult.error }, { status: aiResult.status })
      }

      // ⑨ 응답 파싱
      const parsed = extractJson<Partial<AutoSummary>>(aiResult.text)
      if (!parsed) {
        console.error("[AutoSummary] JSON parse failed. Raw:", aiResult.text.slice(0, 500))
        await releaseLock()
        return Response.json({ error: "AI 응답을 파싱할 수 없습니다." }, { status: 500 })
      }

      // 값 정규화
      const result: AutoSummary = {
        key_points: Array.isArray(parsed.key_points)
          ? parsed.key_points.map(String).slice(0, 5)
          : ["요약 데이터 없음"],
        pro_main: String(parsed.pro_main || "분석 데이터 없음"),
        con_main: String(parsed.con_main || "분석 데이터 없음"),
        consensus: String(parsed.consensus || "합의점을 도출할 수 없습니다."),
        generated_at: new Date().toISOString(),
      }

      // ⑩ DB 저장
      const { error: saveError } = await supabaseAdmin
        .from("threads")
        .update({ ai_auto_summary: result })
        .eq("id", threadId)

      if (saveError) {
        console.error("[AutoSummary] DB save error:", saveError.message)
        return Response.json({ error: "요약 저장에 실패했습니다." }, { status: 500 })
      }

      return Response.json(result)
    } catch (aiErr) {
      // AI 처리 중 예외 시 락 해제
      console.error("[AutoSummary] AI processing error, releasing lock:", aiErr)
      try { await releaseLock() } catch { /* ignore */ }
      return Response.json({ error: "AI 처리 중 오류가 발생했습니다." }, { status: 500 })
    }
  } catch (err) {
    console.error("[AutoSummary] Unexpected error:", err)
    return Response.json({ error: "서버 오류가 발생했습니다." }, { status: 500 })
  }
}
