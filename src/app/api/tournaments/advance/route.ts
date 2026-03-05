import { rateLimitResponse } from "@/lib/rate-limit"
import { authenticateUser } from "@/lib/auth-guard"
import { supabaseAdmin } from "@/lib/supabase-admin"

export const maxDuration = 30

export async function POST(req: Request) {
  try {
    const limited = await rateLimitResponse(req, 10, 60000)
    if (limited) return limited

    const { tournamentId } = await req.json()
    if (!tournamentId || typeof tournamentId !== "string") {
      return Response.json({ error: "tournamentId가 필요합니다." }, { status: 400 })
    }

    // 인증 + 밴 체크
    const auth = await authenticateUser(req)
    if ("error" in auth) return auth.error
    const { user } = auth

    // 토너먼트 로드
    const { data: tournament } = await supabaseAdmin
      .from("tournaments")
      .select("*")
      .eq("id", tournamentId)
      .maybeSingle()

    if (!tournament) {
      return Response.json({ error: "토너먼트를 찾을 수 없습니다." }, { status: 404 })
    }

    if (tournament.created_by !== user.id) {
      return Response.json({ error: "토너먼트 생성자만 라운드를 진행할 수 있습니다." }, { status: 403 })
    }

    if (tournament.status === "completed") {
      return Response.json({ error: "이미 완료된 토너먼트입니다." }, { status: 409 })
    }

    // 현재 라운드 매치 로드
    const { data: currentMatches } = await supabaseAdmin
      .from("tournament_matches")
      .select("*")
      .eq("tournament_id", tournamentId)
      .eq("round", tournament.current_round)
      .order("match_index")

    if (!currentMatches || currentMatches.length === 0) {
      return Response.json({ error: "현재 라운드 매치가 없습니다." }, { status: 400 })
    }

    // 시간 체크: 모든 매치의 ends_at이 지났는지 확인
    const now = new Date()
    for (const match of currentMatches) {
      if (!match.winner_thread && match.ends_at && new Date(match.ends_at) > now) {
        return Response.json(
          { error: "현재 라운드가 아직 진행 중입니다. 종료 시간 이후에 진행해주세요." },
          { status: 400 },
        )
      }
    }

    // 각 매치 승자 결정 (투표 수 스냅샷)
    const updatedMatches = []
    for (const match of currentMatches) {
      if (match.winner_thread) {
        updatedMatches.push(match)
        continue
      }

      // 각 토론의 투표 수 가져오기
      let votesA = 0
      let votesB = 0

      if (match.thread_a) {
        const { data: threadA } = await supabaseAdmin
          .from("threads")
          .select("pro_count, con_count")
          .eq("id", match.thread_a)
          .maybeSingle()
        votesA = (threadA?.pro_count ?? 0) + (threadA?.con_count ?? 0)
      }

      if (match.thread_b) {
        const { data: threadB } = await supabaseAdmin
          .from("threads")
          .select("pro_count, con_count")
          .eq("id", match.thread_b)
          .maybeSingle()
        votesB = (threadB?.pro_count ?? 0) + (threadB?.con_count ?? 0)
      }

      // BYE 처리
      if (!match.thread_b) {
        const winner = match.thread_a
        await supabaseAdmin
          .from("tournament_matches")
          .update({ winner_thread: winner, votes_a: votesA, votes_b: 0 })
          .eq("id", match.id)
        updatedMatches.push({ ...match, winner_thread: winner, votes_a: votesA, votes_b: 0 })
        continue
      }

      // 동점 시 랜덤 승자 결정 (thread_a 편향 방지)
      let winner: string
      if (votesA === votesB) {
        winner = Math.random() < 0.5 ? match.thread_a : match.thread_b
      } else {
        winner = votesA > votesB ? match.thread_a : match.thread_b
      }
      const loser = winner === match.thread_a ? match.thread_b : match.thread_a

      // 멱등성: winner_thread IS NULL 조건으로 중복 업데이트 방지
      const { error: matchUpdateErr } = await supabaseAdmin
        .from("tournament_matches")
        .update({ winner_thread: winner, votes_a: votesA, votes_b: votesB })
        .eq("id", match.id)
        .is("winner_thread", null)
      if (matchUpdateErr) {
        console.error(`[Tournament Advance] Match ${match.id} update failed:`, matchUpdateErr.message)
      }

      // 탈락 처리
      if (loser) {
        const { error: elimErr } = await supabaseAdmin
          .from("tournament_entries")
          .update({ eliminated_in: tournament.current_round })
          .eq("tournament_id", tournamentId)
          .eq("thread_id", loser)
        if (elimErr) {
          console.error(`[Tournament Advance] Elimination failed for ${loser}:`, elimErr.message)
        }
      }

      updatedMatches.push({ ...match, winner_thread: winner, votes_a: votesA, votes_b: votesB })
    }

    // 승자들 수집
    const winners = updatedMatches
      .map((m) => m.winner_thread)
      .filter(Boolean) as string[]

    // 최종 라운드 (승자 1명) → 완료
    if (winners.length === 1) {
      await supabaseAdmin
        .from("tournaments")
        .update({
          status: "completed",
          winner_thread_id: winners[0],
          completed_at: new Date().toISOString(),
          current_round: tournament.current_round,
        })
        .eq("id", tournamentId)

      // 승자 토론 작성자에게 XP +200 (원자적 증가 RPC)
      const { data: winnerThread } = await supabaseAdmin
        .from("threads")
        .select("created_by")
        .eq("id", winners[0])
        .maybeSingle()

      if (winnerThread?.created_by) {
        const { error: rpcErr } = await supabaseAdmin.rpc("increment_xp", {
          p_user_id: winnerThread.created_by,
          p_amount: 200,
        })
        if (rpcErr) {
          // RPC 없으면 fallback (read-then-write)
          const { data: profile } = await supabaseAdmin
            .from("profiles")
            .select("xp")
            .eq("id", winnerThread.created_by)
            .maybeSingle()
          if (profile) {
            await supabaseAdmin
              .from("profiles")
              .update({ xp: (profile.xp ?? 0) + 200 })
              .eq("id", winnerThread.created_by)
          }
        }
      }

      return Response.json({ status: "completed", winner: winners[0] })
    }

    // 다음 라운드 생성 — 중복 방지: 이미 다음 라운드가 존재하면 스킵
    const nextRound = tournament.current_round + 1
    const { data: existingNext } = await supabaseAdmin
      .from("tournament_matches")
      .select("id")
      .eq("tournament_id", tournamentId)
      .eq("round", nextRound)
      .limit(1)

    if (existingNext && existingNext.length > 0) {
      console.warn(`[Tournament Advance] Round ${nextRound} already exists, skipping creation`)
    } else {
      const nextMatches = []
      for (let i = 0; i < winners.length; i += 2) {
        nextMatches.push({
          tournament_id: tournamentId,
          round: nextRound,
          match_index: Math.floor(i / 2),
          thread_a: winners[i],
          thread_b: winners[i + 1] ?? null,
          starts_at: new Date().toISOString(),
          ends_at: new Date(
            Date.now() + tournament.round_duration * 60 * 60 * 1000
          ).toISOString(),
        })
      }

      const { error: insertErr } = await supabaseAdmin.from("tournament_matches").insert(nextMatches)
      if (insertErr) {
        console.error("[Tournament Advance] Next round insert failed:", insertErr.message)
        return Response.json({ error: "다음 라운드 생성에 실패했습니다." }, { status: 500 })
      }
    }

    await supabaseAdmin
      .from("tournaments")
      .update({ current_round: nextRound, status: "active" })
      .eq("id", tournamentId)

    return Response.json({ status: "advanced", round: nextRound })
  } catch (err) {
    console.error("[Tournament Advance] Error:", err)
    return Response.json({ error: "서버 오류가 발생했습니다." }, { status: 500 })
  }
}
