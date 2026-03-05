"use client"

import { Bell, BellOff } from "lucide-react"
import { useAuth } from "@/components/auth-provider"
import { useThreadMute } from "@/hooks/useThreadMute"

export function MuteButton({ threadId }: { threadId: string }) {
  const { user } = useAuth()
  const { muted, loading, toggleMute } = useThreadMute(threadId)

  if (!user) return null

  return (
    <button
      onClick={toggleMute}
      disabled={loading}
      className={`inline-flex items-center justify-center rounded-lg border p-1.5 text-xs transition ${
        muted
          ? "border-amber-400/30 bg-amber-400/10 text-amber-300"
          : "border-white/10 bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-zinc-200"
      }`}
      title={muted ? "알림 켜기" : "알림 끄기"}
    >
      {muted ? <BellOff className="size-3.5" /> : <Bell className="size-3.5" />}
    </button>
  )
}
