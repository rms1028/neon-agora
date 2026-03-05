"use client"

import { type ReactNode } from "react"
import { Lock } from "lucide-react"
import { useProfile } from "@/components/profile-provider"

export function XpGate({
  children,
  requiredXp = 30,
}: {
  children: ReactNode
  requiredXp?: number
}) {
  const { profile } = useProfile()
  const currentXp = profile?.xp ?? 0
  const locked = currentXp < requiredXp

  if (!locked) return <>{children}</>

  return (
    <div className="relative">
      <div className="pointer-events-none opacity-40 grayscale">{children}</div>
      <div className="absolute inset-0 z-10 flex cursor-not-allowed items-center justify-center rounded-2xl">
        <div className="flex flex-col items-center gap-2 rounded-xl border border-white/10 bg-black/70 px-5 py-3 backdrop-blur">
          <div className="rounded-full border border-white/10 bg-white/5 p-2.5">
            <Lock className="size-5 text-zinc-500" />
          </div>
          <span className="text-[11px] font-medium text-zinc-500">
            XP {requiredXp} 필요 (현재 {currentXp})
          </span>
        </div>
      </div>
    </div>
  )
}
