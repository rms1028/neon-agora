"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Crown, Swords, Trophy, Zap } from "lucide-react"

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { supabase } from "@/lib/supabase"
import { getTier } from "@/lib/xp"
import { getLevel } from "@/lib/gamification"
import { UserTitleBadge } from "@/components/user-title-badge"
import { getDisplayName } from "@/lib/utils"

type LeaderEntry = {
  id: string
  xp: number
  badge: string
  custom_title: string | null
  display_name: string | null
}

// 순위별 스타일 정의
const RANK_META = [
  {
    // 🥇 1위 — 황금 네온
    rankLabel: null, // 아이콘 사용
    rowClass: "border-yellow-400/30 bg-yellow-400/[0.05]",
    rankTextClass: "text-yellow-300",
    nameClass: "text-yellow-100",
    rowShadow: "0 0 24px rgba(234,179,8,0.15), inset 0 0 0 1px rgba(234,179,8,0.1)",
    shimmer: true,
  },
  {
    // 🥈 2위 — 실버
    rankLabel: "02",
    rowClass: "border-white/10 bg-white/[0.025]",
    rankTextClass: "text-zinc-400",
    nameClass: "text-zinc-200",
    rowShadow: "",
    shimmer: false,
  },
  {
    // 🥉 3위 — 브론즈
    rankLabel: "03",
    rowClass: "border-amber-700/20 bg-amber-900/[0.04]",
    rankTextClass: "text-amber-600/80",
    nameClass: "text-zinc-200",
    rowShadow: "",
    shimmer: false,
  },
  {
    rankLabel: "04",
    rowClass: "border-white/[0.06] bg-transparent",
    rankTextClass: "text-zinc-600",
    nameClass: "text-zinc-400",
    rowShadow: "",
    shimmer: false,
  },
  {
    rankLabel: "05",
    rowClass: "border-white/[0.06] bg-transparent",
    rankTextClass: "text-zinc-600",
    nameClass: "text-zinc-400",
    rowShadow: "",
    shimmer: false,
  },
] as const

function Bone({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-xl bg-white/[0.06] ${className ?? ""}`}
    />
  )
}

export function LeaderBoard() {
  const [entries, setEntries] = useState<LeaderEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function load() {
      const { data } = await supabase
        .from("profiles")
        .select("id, xp, badge, custom_title, display_name")
        .order("xp", { ascending: false })
        .limit(5)
      if (!cancelled) {
        setEntries((data ?? []) as LeaderEntry[])
        setLoading(false)
      }
    }

    load()

    // 누군가 XP 획득 → 순위 즉시 갱신
    const channel = supabase
      .channel("profiles-leaderboard")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles" },
        () => { load() }
      )
      .subscribe()

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [])

  return (
    <Card className="border-white/10 bg-black/30 backdrop-blur">
      <CardHeader className="pb-3">
        {/* 헤더 */}
        <div className="flex items-center gap-2.5">
          <div className="grid size-8 place-items-center rounded-xl border border-yellow-400/25 bg-yellow-400/10 text-yellow-300"
            style={{ boxShadow: "0 0 16px rgba(234,179,8,0.25)" }}
          >
            <Crown className="size-4" />
          </div>
          <div>
            <CardTitle className="text-sm text-zinc-100">톱 용병</CardTitle>
            <p className="text-[10px] tracking-widest text-zinc-500">LEADERBOARD</p>
          </div>
          <span className="ml-auto inline-flex items-center gap-1 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-0.5 text-[9px] font-semibold text-emerald-400">
            <span className="size-1.5 rounded-full bg-emerald-400 shadow-[0_0_4px_rgba(52,211,153,0.8)]" />
            LIVE
          </span>
        </div>
      </CardHeader>

      <CardContent className="space-y-1.5 pt-0">
        {loading ? (
          // 스켈레톤
          [0, 1, 2, 3, 4].map((i) => (
            <Bone key={i} className="h-[52px]" />
          ))
        ) : entries.length === 0 ? (
          <div className="py-8 text-center">
            <div className="mx-auto grid size-10 place-items-center rounded-xl border border-white/10 bg-white/5 text-zinc-500">
              <Swords className="size-5" />
            </div>
            <p className="mt-3 text-xs text-zinc-500">
              아직 용병이 없어. 첫 번째 전사가 되어봐.
            </p>
          </div>
        ) : (
          entries.map((entry, i) => {
            const meta = RANK_META[i] ?? RANK_META[4]
            const tier = getTier(entry.xp)
            const operativeId = getDisplayName(entry)
            const isFirst = i === 0

            return (
              <div
                key={entry.id}
                className={`relative flex items-center gap-2.5 overflow-hidden rounded-xl border px-3 py-2 transition-all duration-300 ${meta.rowClass}`}
                style={meta.rowShadow ? { boxShadow: meta.rowShadow } : undefined}
              >
                {/* 1위 shimmer 오버레이 */}
                {meta.shimmer && (
                  <div
                    className="pointer-events-none absolute inset-0 gauge-shimmer opacity-60"
                    style={{
                      background:
                        "linear-gradient(90deg, transparent 0%, rgba(234,179,8,0.08) 50%, transparent 100%)",
                      backgroundSize: "200% 100%",
                    }}
                  />
                )}

                {/* 순위 */}
                <div className="relative w-7 shrink-0 text-center">
                  {isFirst ? (
                    <Crown
                      className="mx-auto size-4 text-yellow-300"
                      style={{ filter: "drop-shadow(0 0 6px rgba(234,179,8,0.8))" }}
                    />
                  ) : (
                    <span className={`text-[11px] font-bold tabular-nums tracking-wider ${meta.rankTextClass}`}>
                      {meta.rankLabel}
                    </span>
                  )}
                </div>

                {/* 아바타 (티어 색상) */}
                <div
                  className={`relative grid size-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br ${tier.avatarGradient} text-[11px] font-bold text-black`}
                  style={isFirst ? { boxShadow: "0 0 12px rgba(234,179,8,0.5)" } : undefined}
                >
                  {operativeId.slice(0, 2)}
                  {/* 1위 온라인 dot */}
                  {isFirst && (
                    <span className="absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full border border-black bg-yellow-400 shadow-[0_0_6px_rgba(234,179,8,0.9)]" />
                  )}
                </div>

                {/* 텍스트 정보 */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className={`truncate text-xs font-semibold ${meta.nameClass}`}>
                      {operativeId}
                    </span>
                    {entry.custom_title && (
                      <UserTitleBadge titleKey={entry.custom_title} />
                    )}
                  </div>
                  <div className={`flex items-center gap-1 text-[10px] ${tier.textClass}`}>
                    {entry.badge}
                    <span className="rounded border border-cyan-400/20 bg-cyan-400/5 px-1 text-[8px] font-bold text-cyan-400/80">
                      Lv.{getLevel(entry.xp)}
                    </span>
                  </div>
                </div>

                {/* XP */}
                <div
                  className={`relative shrink-0 flex items-center gap-0.5 text-xs font-bold tabular-nums ${isFirst ? "text-yellow-200" : tier.textClass}`}
                >
                  <Zap className="size-3" />
                  {entry.xp.toLocaleString()}
                </div>
              </div>
            )
          })
        )}

        {/* 하단 안내 + 전체 랭킹 링크 */}
        {!loading && entries.length > 0 && (
          <div className="space-y-2 pt-1">
            <p className="text-center text-[10px] text-zinc-600">
              토론하고 댓글 달아 순위를 올려봐 ⚡
            </p>
            <Link
              href="/rankings"
              className="flex items-center justify-center gap-1.5 rounded-xl border border-amber-400/20 bg-amber-400/5 px-3 py-2 text-[11px] font-medium text-amber-200 transition hover:bg-amber-400/10"
            >
              <Trophy className="size-3.5" />
              전체 랭킹 보기
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
