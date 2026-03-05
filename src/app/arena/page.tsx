"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Flame } from "lucide-react"

import { supabase } from "@/lib/supabase"
import { ArenaGrid, type ArenaDebate } from "@/components/arena-grid"

export default function ArenaPage() {
  const [debates, setDebates] = useState<ArenaDebate[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase.rpc("get_hot_debates", {
        p_limit: 3,
      })

      if (!error && data) {
        setDebates(data as ArenaDebate[])
      }
      setLoading(false)
    }

    load()
  }, [])

  return (
    <div className="min-h-screen bg-black text-zinc-100">
      {/* 배경 */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(1200px_circle_at_50%_20%,rgba(239,68,68,0.18),transparent_55%),radial-gradient(900px_circle_at_20%_60%,rgba(249,115,22,0.14),transparent_55%),radial-gradient(900px_circle_at_80%_80%,rgba(234,179,8,0.10),transparent_60%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.06),transparent_35%,rgba(255,255,255,0.04))] opacity-30" />
      </div>

      <div className="relative mx-auto w-full max-w-5xl px-4 py-10 sm:px-6">
        {/* 네비게이션 */}
        <nav className="mb-6 flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-200"
          >
            <ArrowLeft className="size-4" />
            홈으로
          </Link>
          <span className="text-[11px] tracking-widest text-zinc-600">
            ARENA MODE
          </span>
        </nav>

        {/* 헤더 */}
        <div className="mb-8 text-center">
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-red-400/30 bg-red-400/10 px-3 py-1">
            <Flame className="arena-fire-flicker size-4 text-red-400" />
            <span className="text-[10px] font-bold tracking-widest text-red-300">
              LIVE BATTLE ARENA
            </span>
            <Flame className="arena-fire-flicker size-4 text-orange-400" />
          </div>
          <h1
            className="text-3xl font-extrabold tracking-tight text-zinc-50 sm:text-4xl"
            style={{
              textShadow:
                "0 0 20px rgba(239,68,68,0.4), 0 0 40px rgba(239,68,68,0.2)",
            }}
          >
            열기장 모드
          </h1>
          <p className="mt-2 text-sm text-zinc-400">
            지금 가장 뜨거운 TOP 3 토론을 실시간으로 모니터링하세요
          </p>
        </div>

        {/* 그리드 */}
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="size-8 animate-spin rounded-full border-2 border-red-400/30 border-t-red-400" />
          </div>
        ) : (
          <ArenaGrid initialDebates={debates} />
        )}

        {/* 30초 갱신 안내 */}
        <div className="mt-6 text-center text-[10px] text-zinc-600">
          <span className="inline-flex items-center gap-1">
            <span className="size-1.5 rounded-full bg-red-400 animate-pulse" />
            30초마다 자동 갱신 · 모멘텀 = (최근 투표 + 댓글×2) / 총 투표 × 100
          </span>
        </div>
      </div>
    </div>
  )
}
