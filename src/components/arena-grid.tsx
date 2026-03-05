"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { Flame, MessageSquareText, TrendingUp, Users, Zap } from "lucide-react"

import { supabase } from "@/lib/supabase"

export type ArenaDebate = {
  thread_id: string
  title: string
  tag: string | null
  pro_count: number
  con_count: number
  total_votes: number
  comment_count: number
  recent_votes: number
  recent_comments: number
  momentum: number
  participant_count: number
}

const RANK_STYLES = [
  { badge: "#1", color: "text-amber-300", border: "border-amber-400/50", bg: "bg-amber-400/10", glow: "0 0 20px rgba(234,179,8,0.3)" },
  { badge: "#2", color: "text-zinc-300", border: "border-zinc-400/40", bg: "bg-zinc-400/10", glow: "0 0 12px rgba(161,161,170,0.2)" },
  { badge: "#3", color: "text-amber-600", border: "border-amber-600/40", bg: "bg-amber-600/10", glow: "0 0 12px rgba(180,83,9,0.2)" },
]

function MomentumBar({ momentum }: { momentum: number }) {
  const capped = Math.min(momentum, 100)
  const colorClass =
    capped >= 60
      ? "from-red-500 to-orange-400"
      : capped >= 30
        ? "from-amber-500 to-yellow-400"
        : "from-emerald-500 to-green-400"

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[10px]">
        <span className="tracking-widest text-zinc-500">MOMENTUM</span>
        <span className="font-mono font-bold text-zinc-300">{momentum.toFixed(1)}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className={`arena-momentum-fill h-full rounded-full bg-gradient-to-r ${colorClass}`}
          style={{ "--momentum-width": `${capped}%` } as React.CSSProperties}
        />
      </div>
    </div>
  )
}

export function ArenaGrid({ initialDebates }: { initialDebates: ArenaDebate[] }) {
  const [debates, setDebates] = useState<ArenaDebate[]>(initialDebates)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const refresh = useCallback(async () => {
    const { data, error } = await supabase.rpc("get_hot_debates", { p_limit: 3 })
    if (!error && data) {
      setDebates(data as ArenaDebate[])
    }
  }, [])

  // 30초 폴링
  useEffect(() => {
    intervalRef.current = setInterval(refresh, 30000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [refresh])

  // Realtime 구독 (투표 변경 감지)
  useEffect(() => {
    const channel = supabase
      .channel("arena-realtime")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "threads" },
        () => { refresh() }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [refresh])

  if (debates.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-black/40 p-8 text-center backdrop-blur">
        <Flame className="mx-auto size-8 text-zinc-600" />
        <p className="mt-3 text-sm text-zinc-400">
          현재 활성 토론이 없습니다. 첫 토론을 시작해보세요!
        </p>
      </div>
    )
  }

  return (
    <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-3">
      {debates.map((d, i) => {
        const rank = RANK_STYLES[i] ?? RANK_STYLES[2]
        const totalVotes = d.total_votes || 1
        const proPct = Math.round((d.pro_count / totalVotes) * 100)
        const conPct = 100 - proPct

        return (
          <div
            key={d.thread_id}
            className={`arena-pulse relative overflow-hidden rounded-2xl border ${rank.border} bg-black/50 p-5 backdrop-blur`}
            style={{ boxShadow: rank.glow }}
          >
            {/* 순위 배지 */}
            <div
              className={`absolute right-4 top-4 grid size-8 place-items-center rounded-full border ${rank.border} ${rank.bg} font-mono text-xs font-black ${rank.color}`}
            >
              {rank.badge}
            </div>

            {/* 태그 */}
            {d.tag && (
              <span className="mb-2 inline-flex rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-zinc-400">
                {d.tag}
              </span>
            )}

            {/* 제목 */}
            <Link href={`/thread/${d.thread_id}`}>
              <h3 className="mb-3 line-clamp-2 pr-10 text-sm font-semibold text-zinc-100 hover:text-cyan-200 transition-colors">
                {d.title}
              </h3>
            </Link>

            {/* 투표 게이지 바 */}
            <div className="mb-4 space-y-1.5">
              <div className="flex justify-between text-[10px]">
                <span className="text-cyan-300">찬성 {proPct}%</span>
                <span className="text-fuchsia-300">반대 {conPct}%</span>
              </div>
              <div className="relative h-2 overflow-hidden rounded-full bg-white/[0.06]">
                <div
                  className="absolute inset-y-0 left-0 rounded-l-full bg-gradient-to-r from-cyan-500 to-cyan-400 transition-all duration-700"
                  style={{ width: `${proPct}%` }}
                />
                <div
                  className="absolute inset-y-0 right-0 rounded-r-full bg-gradient-to-l from-fuchsia-500 to-fuchsia-400 transition-all duration-700"
                  style={{ width: `${conPct}%` }}
                />
              </div>
            </div>

            {/* 스탯 4개 */}
            <div className="mb-4 grid grid-cols-2 gap-2">
              <div className="flex items-center gap-1.5 text-[10px] text-zinc-400">
                <Users className="size-3 text-zinc-500" />
                <span>참여자 {d.participant_count}</span>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-zinc-400">
                <TrendingUp className="size-3 text-zinc-500" />
                <span>총 {d.total_votes}표</span>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-zinc-400">
                <MessageSquareText className="size-3 text-zinc-500" />
                <span>댓글 {d.comment_count}개</span>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-zinc-400">
                <Zap className="size-3 text-zinc-500" />
                <span>최근 {d.recent_votes + d.recent_comments}/hr</span>
              </div>
            </div>

            {/* 모멘텀 바 */}
            <MomentumBar momentum={d.momentum} />

            {/* 입장 CTA */}
            <Link
              href={`/thread/${d.thread_id}`}
              className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-xl border border-red-400/30 bg-red-400/10 py-2 text-xs font-semibold text-red-200 transition hover:bg-red-400/20"
            >
              <Flame className="arena-fire-flicker size-3.5" />
              입장하기
            </Link>
          </div>
        )
      })}
    </div>
  )
}
