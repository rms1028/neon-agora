import { rateLimitResponse } from "@/lib/rate-limit"
import { callGemini, extractJson } from "@/lib/gemini"
import { authenticateUser } from "@/lib/auth-guard"
import { supabaseAdmin } from "@/lib/supabase-admin"

export const maxDuration = 60

const MIN_COMMENTS_PER_SIDE = 3
const EARLY_VOTE_THRESHOLD = 10

export type JudgeResult = {
  pro_summary: string
  con_summary: string
  winner: "pro" | "con" | "draw"
  verdict_reason: string
  pro_score: number
  con_score: number
  judged_at: string
}

export async function POST(req: Request) {
  try {
    const limited = await rateLimitResponse(req, 5, 60000)
    if (limited) return limited

    const { threadId } = await req.json()
    if (!threadId || typeof threadId !== "string") {
      return Response.json({ error: "threadId가 필요합니다." }, { status: 400 })
    }

    // ① 인증 (시스템 키 or 로그인 유저)
    const systemKey = req.headers.get("X-System-Key")
    const isSystem = systemKey === process.env.CRON_SECRET && !!systemKey

    if (!isSystem) {
      const auth = await authenticateUser(req)
      if ("error" in auth) return auth.error
    }

    // ② 토론 데이터 로드
    const { data: thread } = await supabaseAdmin
      .from("threads")
      .select("id, title, content, ai_verdict, is_closed")
      .eq("id", threadId)
      .maybeSingle()

    if (!thread) {
      return Response.json({ error: "토론을 찾을 수 없습니다." }, { status: 404 })
    }

    // ③ 중복 판결 방지
    if (thread.ai_verdict) {
      return Response.json(
        { error: "이미 판결이 완료된 토론입니다." },
        { status: 409 }
      )
    }

    // ④ 댓글 수집 + 조건 확인
    const { data: comments } = await supabaseAdmin
      .from("comments")
      .select("content, side")
      .eq("thread_id", threadId)
      .eq("is_deleted", false)
      .order("created_at", { ascending: false })
      .limit(60)

    const proComments = (comments ?? []).filter((c) => c.side === "pro")
    const conComments = (comments ?? []).filter((c) => c.side === "con")

    if (proComments.length < MIN_COMMENTS_PER_SIDE || conComments.length < MIN_COMMENTS_PER_SIDE) {
      return Response.json(
        { error: `양측 각각 ${MIN_COMMENTS_PER_SIDE}개 이상의 의견이 필요합니다.` },
        { status: 400 }
      )
    }

    // ⑤ 트리거 조건: 마감 OR 조기 투표 충족
    if (!thread.is_closed) {
      const { count } = await supabaseAdmin
        .from("judge_early_votes")
        .select("id", { count: "exact", head: true })
        .eq("thread_id", threadId)

      if ((count ?? 0) < EARLY_VOTE_THRESHOLD) {
        return Response.json(
          { error: "토론이 마감되거나 조기 판결 투표가 충족되어야 합니다." },
          { status: 403 }
        )
      }
    }

    // ⑥ 프롬프트 구성
    const fmtList = (list: { content: string }[]) =>
      list.length > 0
        ? list.map((c, i) => `[${i + 1}] ${c.content}`).join("\n")
        : "(댓글 없음)"

    const userPrompt = `다음 토론을 분석하여 판결을 내려주세요.

## 토론 제목
${thread.title}

## 토론 본문
${thread.content || "(본문 없음)"}

## 찬성 측 댓글 (${proComments.length}개)
${fmtList(proComments)}

## 반대 측 댓글 (${conComments.length}개)
${fmtList(conComments)}

각 진영의 논리 강도를 평가하고 더 설득력 있는 쪽의 손을 들어주세요.`

    const systemPrompt = `당신은 '네온 아고라'의 AI 사이버 판사입니다. 편향 없이 논리와 근거의 질을 평가합니다.
반드시 아래 JSON 형식으로만 응답하세요. 다른 텍스트는 절대 포함하지 마세요.

{
  "pro_summary": "찬성 측 핵심 논리 요약 (2-3문장, 한국어)",
  "con_summary": "반대 측 핵심 논리 요약 (2-3문장, 한국어)",
  "winner": "pro 또는 con 또는 draw",
  "verdict_reason": "최종 판결 이유 (3-4문장. 어느 쪽의 논리가 왜 더 설득력 있는지 명확하게, 한국어)",
  "pro_score": 찬성 측 논리 점수 (0~100 정수),
  "con_score": 반대 측 논리 점수 (0~100 정수)
}`

    // ⑦ Gemini API 호출
    const aiResult = await callGemini({
      systemPrompt,
      userPrompt,
      temperature: 0.7,
      maxOutputTokens: 65536,
    })

    if ("error" in aiResult) {
      console.error("[CyberJudge] Gemini error:", aiResult.error)
      return Response.json({ error: aiResult.error }, { status: aiResult.status })
    }

    // ⑧ 응답 파싱
    const parsed = extractJson<Partial<JudgeResult>>(aiResult.text)
    if (!parsed) {
      return Response.json({ error: "AI 응답을 파싱할 수 없습니다." }, { status: 500 })
    }

    const winner: "pro" | "con" | "draw" = ["pro", "con", "draw"].includes(parsed.winner ?? "")
      ? (parsed.winner as "pro" | "con" | "draw")
      : "draw"
    const proScore = Math.max(0, Math.min(100, Math.round(Number(parsed.pro_score) || 50)))
    const conScore = Math.max(0, Math.min(100, Math.round(Number(parsed.con_score) || 50)))

    const judgeResult: JudgeResult = {
      pro_summary: String(parsed.pro_summary || "분석 데이터 없음"),
      con_summary: String(parsed.con_summary || "분석 데이터 없음"),
      winner,
      verdict_reason: String(parsed.verdict_reason || "판결 이유를 생성할 수 없습니다."),
      pro_score: proScore,
      con_score: conScore,
      judged_at: new Date().toISOString(),
    }

    // ⑨ DB 저장
    const { error: saveError } = await supabaseAdmin
      .from("threads")
      .update({ ai_summary: judgeResult, ai_verdict: winner })
      .eq("id", threadId)

    if (saveError) {
      console.error("[CyberJudge] DB save error:", saveError.message)
      return Response.json({ error: "판결 저장에 실패했습니다." }, { status: 500 })
    }

    // ⑩ AI 판결 완료 알림 — 투표/댓글 참여자에게 알림
    try {
      const { data: threadData } = await supabaseAdmin
        .from("threads")
        .select("title, created_by")
        .eq("id", threadId)
        .maybeSingle()
      const threadTitle = String((threadData as Record<string, unknown>)?.title ?? "")

      // 투표자 + 댓글 작성자 수집
      const [{ data: voters }, { data: commenters }] = await Promise.all([
        supabaseAdmin.from("thread_votes").select("user_id").eq("thread_id", threadId),
        supabaseAdmin.from("comments").select("user_id").eq("thread_id", threadId),
      ])
      const participantIds = new Set<string>()
      for (const r of voters ?? []) participantIds.add(String((r as Record<string, unknown>).user_id))
      for (const r of commenters ?? []) participantIds.add(String((r as Record<string, unknown>).user_id))
      if (threadData && (threadData as Record<string, unknown>).created_by) {
        participantIds.add(String((threadData as Record<string, unknown>).created_by))
      }

      const winnerLabel = winner === "pro" ? "찬성" : winner === "con" ? "반대" : "무승부"
      const notifications = [...participantIds].map((uid) => ({
        user_id: uid,
        type: "ai_result",
        thread_id: threadId,
        thread_title: threadTitle,
        message: `AI 판사가 판결했습니다: ${winnerLabel} — "${threadTitle}"`,
      }))
      if (notifications.length > 0) {
        await supabaseAdmin.from("notifications").insert(notifications)
      }
    } catch (e) {
      console.error("[CyberJudge] Notification error:", e)
    }

    return Response.json(judgeResult)
  } catch (err) {
    console.error("[CyberJudge] Unexpected error:", err)
    return Response.json({ error: "서버 오류가 발생했습니다." }, { status: 500 })
  }
}
