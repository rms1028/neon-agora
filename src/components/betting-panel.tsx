"use client"

import { useCallback, useEffect, useState } from "react"
import { Coins } from "lucide-react"

import { Button } from "@/components/ui/button"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/components/auth-provider"
import { useToast } from "@/components/toast-provider"
import { useProfile } from "@/components/profile-provider"

type Bet = { side: "pro" | "con"; amount: number }

export function BettingPanel({
  threadId,
  isClosed,
}: {
  threadId: string
  isClosed?: boolean
}) {
  const { user } = useAuth()
  const { showToast } = useToast()
  const { profile, addXp } = useProfile()

  const [proPool, setProPool] = useState(0)
  const [conPool, setConPool] = useState(0)
  const [myBet, setMyBet] = useState<Bet | null>(null)
  const [amount, setAmount] = useState(50)
  const [side, setSide] = useState<"pro" | "con">("pro")
  const [placing, setPlacing] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data: bets } = await supabase
        .from("thread_bets")
        .select("user_id, side, amount")
        .eq("thread_id", threadId)

      if (cancelled) return

      let pro = 0, con = 0
      for (const b of bets ?? []) {
        const row = b as Record<string, unknown>
        if (row.side === "pro") pro += Number(row.amount) || 0
        else con += Number(row.amount) || 0
        if (user && row.user_id === user.id) {
          setMyBet({ side: row.side as "pro" | "con", amount: Number(row.amount) || 0 })
        }
      }
      setProPool(pro)
      setConPool(con)
      setLoaded(true)
    })()
    return () => { cancelled = true }
  }, [threadId, user?.id])

  // 실시간
  useEffect(() => {
    const channel = supabase
      .channel(`bets-${threadId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "thread_bets", filter: `thread_id=eq.${threadId}` },
        (payload) => {
          const row = payload.new as Record<string, unknown>
          const amt = Number(row.amount) || 0
          if (row.side === "pro") setProPool((p) => p + amt)
          else setConPool((p) => p + amt)
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [threadId])

  const handleBet = useCallback(async () => {
    if (!user || myBet || isClosed || placing) return
    if ((profile?.xp ?? 0) < amount) {
      showToast(`XP가 부족합니다. (보유: ${profile?.xp ?? 0})`, "info")
      return
    }

    setPlacing(true)
    const betSide = side
    const betAmount = amount

    const { error } = await supabase.from("thread_bets").insert({
      thread_id: threadId,
      user_id: user.id,
      side: betSide,
      amount: betAmount,
    })

    if (error) {
      setPlacing(false)
      if (error.code === "23505") {
        showToast("이미 배팅했습니다.", "info")
        setMyBet({ side: betSide, amount: betAmount })
      } else {
        showToast("배팅에 실패했습니다.", "error")
      }
      return
    }

    // DB 성공 후에만 XP 차감
    setMyBet({ side: betSide, amount: betAmount })
    addXp(-betAmount)
    setPlacing(false)
    showToast(`${betSide === "pro" ? "찬성" : "반대"}에 ${betAmount} XP 배팅!`, "success")
  }, [user, myBet, isClosed, placing, profile?.xp, amount, side, threadId, showToast, addXp])

  if (!loaded) return null

  const totalPool = proPool + conPool
  const proPct = totalPool > 0 ? Math.round((proPool / totalPool) * 100) : 50

  return (
    <div className="rounded-2xl border border-amber-400/20 bg-black/30 p-5 backdrop-blur">
      <div className="mb-4 flex items-center gap-2.5">
        <div
          className="grid size-8 place-items-center rounded-lg border border-amber-400/30 bg-amber-400/10 text-amber-300"
          style={{ boxShadow: "0 0 12px rgba(245,158,11,0.3)" }}
        >
          <Coins className="size-4 betting-coin-spin" />
        </div>
        <div>
          <div className="text-sm font-semibold text-zinc-100">포인트 배팅</div>
          <div className="text-[10px] text-zinc-500">XP를 걸고 예측하세요</div>
        </div>
      </div>

      {/* 풀 현황 */}
      <div className="mb-4 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-cyan-300">찬성 풀: {proPool} XP</span>
          <span className="text-fuchsia-300">반대 풀: {conPool} XP</span>
        </div>
        <div className="relative h-2.5 overflow-hidden rounded-full bg-white/[0.06]">
          <div
            className="absolute inset-y-0 left-0 rounded-l-full bg-gradient-to-r from-cyan-500 to-cyan-400 transition-all duration-500"
            style={{ width: `${proPct}%` }}
          />
          <div
            className="absolute inset-y-0 right-0 rounded-r-full bg-gradient-to-l from-fuchsia-500 to-fuchsia-400 transition-all duration-500"
            style={{ width: `${100 - proPct}%` }}
          />
        </div>
        <div className="text-center text-[10px] text-zinc-500">
          총 {totalPool} XP · {totalPool > 0 ? `찬성 ${proPct}% · 반대 ${100 - proPct}%` : "첫 배팅을 해보세요"}
        </div>
      </div>

      {/* 배팅 UI */}
      {myBet ? (
        <div className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-3 text-center">
          <div className="text-xs text-zinc-400">내 배팅</div>
          <div className="mt-1 text-sm font-semibold text-amber-200">
            {myBet.side === "pro" ? "찬성" : "반대"} · {myBet.amount} XP
          </div>
        </div>
      ) : isClosed ? (
        <div className="text-center text-xs text-zinc-500">마감된 토론은 배팅할 수 없습니다.</div>
      ) : !user ? (
        <div className="text-center text-xs text-zinc-500">로그인 후 배팅할 수 있습니다.</div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSide("pro")}
              className={`flex-1 rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                side === "pro"
                  ? "border-cyan-400/50 bg-cyan-400/15 text-cyan-100"
                  : "border-white/10 bg-white/5 text-zinc-400"
              }`}
            >
              찬성
            </button>
            <button
              type="button"
              onClick={() => setSide("con")}
              className={`flex-1 rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                side === "con"
                  ? "border-fuchsia-400/50 bg-fuchsia-400/15 text-fuchsia-100"
                  : "border-white/10 bg-white/5 text-zinc-400"
              }`}
            >
              반대
            </button>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="range"
              min={10}
              max={500}
              step={10}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="flex-1 accent-amber-400"
            />
            <span className="w-16 text-right text-sm font-semibold text-amber-200">
              {amount} XP
            </span>
          </div>

          <Button
            onClick={handleBet}
            disabled={placing}
            className="w-full bg-gradient-to-r from-amber-400 to-orange-400 font-semibold text-black shadow-[0_0_18px_rgba(245,158,11,0.4)] hover:from-amber-300 hover:to-orange-300"
          >
            <Coins className="size-4" />
            {placing ? "배팅 중…" : `${amount} XP 배팅하기`}
          </Button>
        </div>
      )}
    </div>
  )
}
