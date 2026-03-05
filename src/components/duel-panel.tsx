"use client"

import { useCallback, useEffect, useState } from "react"
import { Check, Crown, Swords, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/components/auth-provider"
import { useToast } from "@/components/toast-provider"

type Duel = {
  id: string
  thread_id: string
  challenger_id: string
  opponent_id: string
  challenger_side: "pro" | "con"
  status: string
  challenger_argument: string | null
  opponent_argument: string | null
  vote_challenger: number
  vote_opponent: number
  winner_id: string | null
}

export function DuelPanel({
  threadId,
  isClosed,
}: {
  threadId: string
  isClosed?: boolean
}) {
  const { user } = useAuth()
  const { showToast } = useToast()

  const [duels, setDuels] = useState<Duel[]>([])
  const [loaded, setLoaded] = useState(false)
  const [voting, setVoting] = useState<string | null>(null)
  const [myVotes, setMyVotes] = useState<Record<string, string>>({})
  const [arguments_, setArguments_] = useState<Record<string, string>>({})
  const [submittingArg, setSubmittingArg] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data } = await supabase
        .from("duels")
        .select("*")
        .eq("thread_id", threadId)
        .order("created_at", { ascending: false })

      if (cancelled) return
      setDuels((data ?? []) as Duel[])

      // 내 투표 로드
      if (user) {
        const duelIds = (data ?? []).map((d: Record<string, unknown>) => String(d.id))
        if (duelIds.length > 0) {
          const { data: votes } = await supabase
            .from("duel_votes")
            .select("duel_id, voted_for")
            .eq("user_id", user.id)
            .in("duel_id", duelIds)
          if (!cancelled) {
            const map: Record<string, string> = {}
            for (const v of votes ?? []) {
              const r = v as Record<string, unknown>
              map[String(r.duel_id)] = String(r.voted_for)
            }
            setMyVotes(map)
          }
        }
      }

      setLoaded(true)
    })()
    return () => { cancelled = true }
  }, [threadId, user?.id])

  // 실시간 대결 상태
  useEffect(() => {
    const channel = supabase
      .channel(`duels-${threadId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "duels", filter: `thread_id=eq.${threadId}` },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setDuels((prev) => [payload.new as Duel, ...prev])
          } else if (payload.eventType === "UPDATE") {
            setDuels((prev) =>
              prev.map((d) => d.id === (payload.new as Duel).id ? (payload.new as Duel) : d)
            )
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [threadId])

  const handleAcceptDecline = useCallback(async (duelId: string, accept: boolean) => {
    if (!user) return
    const { error } = await supabase
      .from("duels")
      .update({ status: accept ? "active" : "declined" })
      .eq("id", duelId)

    if (error) {
      showToast("처리에 실패했습니다.", "error")
    } else {
      showToast(accept ? "대결을 수락했습니다!" : "대결을 거절했습니다.", accept ? "success" : "info")
    }
  }, [user, showToast])

  const handleVote = useCallback(async (duelId: string, votedFor: string) => {
    if (!user || myVotes[duelId] || voting) return
    setVoting(duelId)

    const { error } = await supabase.rpc("cast_duel_vote", {
      p_duel_id: duelId,
      p_user_id: user.id,
      p_voted_for: votedFor,
    })

    if (error) {
      if (error.code === "PGRST202") {
        // RPC 미존재 fallback
        const { error: insertErr } = await supabase
          .from("duel_votes")
          .insert({ duel_id: duelId, user_id: user.id, voted_for: votedFor })
        if (insertErr) {
          showToast("이미 투표했거나 참가자는 투표할 수 없습니다.", "info")
          setVoting(null)
          return
        }
      } else {
        showToast(error.message?.includes("participant") ? "참가자는 투표할 수 없습니다." : "이미 투표했습니다.", "info")
        setVoting(null)
        return
      }
    }

    setMyVotes((prev) => ({ ...prev, [duelId]: votedFor }))
    setVoting(null)
    showToast("투표 완료!", "success")
  }, [user, myVotes, voting, showToast])

  const handleSubmitArgument = useCallback(async (duelId: string, isChallenger: boolean) => {
    if (!user) return
    const text = (arguments_[duelId] ?? "").trim()
    if (!text) return
    setSubmittingArg(true)

    const field = isChallenger ? "challenger_argument" : "opponent_argument"
    const { error } = await supabase
      .from("duels")
      .update({ [field]: text })
      .eq("id", duelId)

    setSubmittingArg(false)
    if (error) {
      showToast("논증 제출에 실패했습니다.", "error")
    } else {
      setArguments_((prev) => ({ ...prev, [duelId]: "" }))
      showToast("논증이 제출되었습니다!", "success")
    }
  }, [user, arguments_, showToast])

  if (!loaded) return null
  if (duels.length === 0) return null

  return (
    <div className="space-y-4">
      {duels.map((duel) => {
        const isChallenger = user?.id === duel.challenger_id
        const isOpponent = user?.id === duel.opponent_id
        const isParticipant = isChallenger || isOpponent
        const challengerShort = duel.challenger_id.replace(/-/g, "").slice(0, 5)
        const opponentShort = duel.opponent_id.replace(/-/g, "").slice(0, 5)
        const opponentSide = duel.challenger_side === "pro" ? "con" : "pro"

        return (
          <div
            key={duel.id}
            className="duel-card-enter rounded-2xl border border-amber-400/20 bg-black/30 p-5 backdrop-blur"
          >
            {/* 헤더 */}
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="grid size-8 place-items-center rounded-lg border border-amber-400/30 bg-amber-400/10 text-amber-300">
                  <Swords className="size-4" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-zinc-100">유저 대결</div>
                  <div className="text-[10px] text-zinc-500">
                    유저 {challengerShort} vs 유저 {opponentShort}
                  </div>
                </div>
              </div>
              <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold ${
                duel.status === "pending" ? "border-amber-400/30 bg-amber-400/10 text-amber-200" :
                duel.status === "active" ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200" :
                duel.status === "completed" ? "border-cyan-400/30 bg-cyan-400/10 text-cyan-200" :
                "border-red-400/30 bg-red-400/10 text-red-200"
              }`}>
                {duel.status === "pending" ? "대기 중" :
                 duel.status === "active" ? "진행 중" :
                 duel.status === "completed" ? "완료" :
                 duel.status === "declined" ? "거절됨" : duel.status}
              </span>
            </div>

            {/* pending — 수락/거절 */}
            {duel.status === "pending" && isOpponent && (
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => handleAcceptDecline(duel.id, true)}
                  className="flex-1 bg-gradient-to-r from-emerald-400 to-cyan-400 text-black"
                >
                  <Check className="size-4" />
                  수락
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleAcceptDecline(duel.id, false)}
                  className="flex-1 border-red-400/30 text-red-300"
                >
                  <X className="size-4" />
                  거절
                </Button>
              </div>
            )}

            {duel.status === "pending" && isChallenger && (
              <div className="text-center text-xs text-zinc-500">
                상대방의 수락을 기다리고 있습니다…
              </div>
            )}

            {/* active — 논증 + 투표 */}
            {duel.status === "active" && (
              <div className="space-y-4">
                {/* VS 디스플레이 */}
                <div className="flex items-center gap-4">
                  <div className={`flex-1 rounded-xl border p-3 ${
                    duel.challenger_side === "pro" ? "border-cyan-400/20 bg-cyan-400/5" : "border-fuchsia-400/20 bg-fuchsia-400/5"
                  }`}>
                    <div className={`text-[10px] font-semibold ${duel.challenger_side === "pro" ? "text-cyan-300" : "text-fuchsia-300"}`}>
                      {duel.challenger_side === "pro" ? "찬성" : "반대"} · 유저 {challengerShort}
                    </div>
                    {duel.challenger_argument ? (
                      <div className="mt-1 text-xs text-zinc-300">{duel.challenger_argument}</div>
                    ) : isChallenger ? (
                      <div className="mt-2 space-y-2">
                        <textarea
                          value={arguments_[duel.id] ?? ""}
                          onChange={(e) => setArguments_((prev) => ({ ...prev, [duel.id]: e.target.value.slice(0, 500) }))}
                          placeholder="논증을 입력하세요…"
                          rows={2}
                          className="w-full resize-none rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-xs text-zinc-100 outline-none"
                        />
                        <Button
                          size="sm"
                          onClick={() => handleSubmitArgument(duel.id, true)}
                          disabled={submittingArg || !(arguments_[duel.id] ?? "").trim()}
                          className="w-full bg-amber-400/20 text-amber-200 text-xs"
                        >
                          논증 제출
                        </Button>
                      </div>
                    ) : (
                      <div className="mt-1 text-[10px] text-zinc-600">아직 논증을 작성하지 않았습니다</div>
                    )}
                  </div>

                  <div className="duel-vs-pulse font-mono text-lg font-black text-amber-400">VS</div>

                  <div className={`flex-1 rounded-xl border p-3 ${
                    opponentSide === "pro" ? "border-cyan-400/20 bg-cyan-400/5" : "border-fuchsia-400/20 bg-fuchsia-400/5"
                  }`}>
                    <div className={`text-[10px] font-semibold ${opponentSide === "pro" ? "text-cyan-300" : "text-fuchsia-300"}`}>
                      {opponentSide === "pro" ? "찬성" : "반대"} · 유저 {opponentShort}
                    </div>
                    {duel.opponent_argument ? (
                      <div className="mt-1 text-xs text-zinc-300">{duel.opponent_argument}</div>
                    ) : isOpponent ? (
                      <div className="mt-2 space-y-2">
                        <textarea
                          value={arguments_[duel.id] ?? ""}
                          onChange={(e) => setArguments_((prev) => ({ ...prev, [duel.id]: e.target.value.slice(0, 500) }))}
                          placeholder="논증을 입력하세요…"
                          rows={2}
                          className="w-full resize-none rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-xs text-zinc-100 outline-none"
                        />
                        <Button
                          size="sm"
                          onClick={() => handleSubmitArgument(duel.id, false)}
                          disabled={submittingArg || !(arguments_[duel.id] ?? "").trim()}
                          className="w-full bg-amber-400/20 text-amber-200 text-xs"
                        >
                          논증 제출
                        </Button>
                      </div>
                    ) : (
                      <div className="mt-1 text-[10px] text-zinc-600">아직 논증을 작성하지 않았습니다</div>
                    )}
                  </div>
                </div>

                {/* 커뮤니티 투표 */}
                {!isParticipant && user && !myVotes[duel.id] && (
                  <div className="space-y-2">
                    <div className="text-center text-xs text-zinc-400">누구의 논증이 더 설득력 있나요?</div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleVote(duel.id, duel.challenger_id)}
                        disabled={voting === duel.id}
                        className="flex-1 rounded-lg border border-cyan-400/30 bg-cyan-400/10 py-2 text-xs font-semibold text-cyan-200 transition hover:bg-cyan-400/20 disabled:opacity-50"
                      >
                        유저 {challengerShort}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleVote(duel.id, duel.opponent_id)}
                        disabled={voting === duel.id}
                        className="flex-1 rounded-lg border border-fuchsia-400/30 bg-fuchsia-400/10 py-2 text-xs font-semibold text-fuchsia-200 transition hover:bg-fuchsia-400/20 disabled:opacity-50"
                      >
                        유저 {opponentShort}
                      </button>
                    </div>
                  </div>
                )}

                {/* 투표 현황 */}
                {(duel.vote_challenger > 0 || duel.vote_opponent > 0) && (
                  <div className="flex items-center gap-2 text-[11px]">
                    <span className="text-cyan-300">{duel.vote_challenger}표</span>
                    <div className="relative flex-1 h-2 overflow-hidden rounded-full bg-white/[0.06]">
                      <div
                        className="absolute inset-y-0 left-0 rounded-l-full bg-cyan-400 transition-all"
                        style={{ width: `${(duel.vote_challenger / Math.max(1, duel.vote_challenger + duel.vote_opponent)) * 100}%` }}
                      />
                    </div>
                    <span className="text-fuchsia-300">{duel.vote_opponent}표</span>
                  </div>
                )}
              </div>
            )}

            {/* completed — 승자 */}
            {duel.status === "completed" && (
              <div className="text-center">
                {duel.winner_id ? (
                  <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/40 bg-amber-400/15 px-4 py-2 text-sm font-semibold text-amber-200">
                    <Crown className="size-4" />
                    유저 {duel.winner_id.replace(/-/g, "").slice(0, 5)} 승리!
                  </div>
                ) : (
                  <div className="text-xs text-zinc-500">무승부</div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
