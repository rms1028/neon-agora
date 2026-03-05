"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Crown, Timer, Zap } from "lucide-react"

import { supabase } from "@/lib/supabase"
import { useAuth } from "@/components/auth-provider"

type Season = {
  id: string
  name: string
  ends_at: string
}

export function SeasonBanner() {
  const { user } = useAuth()
  const [season, setSeason] = useState<Season | null>(null)
  const [myRank, setMyRank] = useState<number | null>(null)
  const [myXp, setMyXp] = useState(0)
  const [daysLeft, setDaysLeft] = useState(0)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data } = await supabase
        .from("seasons")
        .select("id, name, ends_at")
        .eq("is_active", true)
        .maybeSingle()

      if (cancelled || !data) return
      setSeason(data as Season)

      const endsAt = new Date(data.ends_at as string)
      const diffMs = endsAt.getTime() - Date.now()
      setDaysLeft(Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24))))

      if (user) {
        const { data: ranking } = await supabase
          .from("season_rankings")
          .select("season_xp")
          .eq("season_id", data.id)
          .eq("user_id", user.id)
          .maybeSingle()

        if (cancelled) return
        if (ranking) {
          setMyXp(Number((ranking as Record<string, unknown>).season_xp) || 0)

          // Calculate rank
          const { count } = await supabase
            .from("season_rankings")
            .select("*", { count: "exact", head: true })
            .eq("season_id", data.id)
            .gt("season_xp", Number((ranking as Record<string, unknown>).season_xp) || 0)

          if (!cancelled) setMyRank((count ?? 0) + 1)
        }
      }
    })()
    return () => { cancelled = true }
  }, [user?.id])

  if (!season) return null

  return (
    <Link href="/seasons" className="block">
      <div className="season-active-glow rounded-xl border border-yellow-400/20 bg-gradient-to-br from-yellow-400/10 to-amber-400/5 p-3 backdrop-blur transition hover:border-yellow-400/30">
        <div className="mb-2 flex items-center gap-2">
          <Crown className="size-4 text-yellow-400" />
          <span className="text-xs font-bold text-yellow-200">{season.name}</span>
        </div>

        <div className="flex items-center justify-between text-[11px]">
          <div className="flex items-center gap-1 text-zinc-400">
            <Timer className="size-3" />
            {daysLeft}일 남음
          </div>
          {user && (
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-0.5 text-yellow-300">
                <Zap className="size-3" />
                {myXp}
              </span>
              {myRank && (
                <span className="rounded-full border border-yellow-400/20 bg-yellow-400/10 px-1.5 py-0.5 text-[10px] font-semibold text-yellow-200">
                  #{myRank}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </Link>
  )
}
