"use client"

import { useEffect, useRef, useState } from "react"
import { Clock, Lock, Timer } from "lucide-react"

type Props = {
  expiresAt?: string | null
  isClosed?: boolean
  threadId?: string
  onExpire?: () => void
  size?: "sm" | "md"
}

function formatRemaining(ms: number): string {
  if (ms <= 0) return "00:00"
  const totalSec = Math.floor(ms / 1000)
  const days = Math.floor(totalSec / 86400)
  const hours = Math.floor((totalSec % 86400) / 3600)
  const minutes = Math.floor((totalSec % 3600) / 60)
  const seconds = totalSec % 60

  if (days >= 1) return `${days}일 ${hours}시간`
  if (hours >= 1) return `${hours}시간 ${String(minutes).padStart(2, "0")}분`
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
}

export function DebateCountdown({ expiresAt, isClosed, onExpire, size = "md" }: Props) {
  const [msLeft, setMsLeft] = useState(() => {
    if (!expiresAt) return -1
    return Math.max(0, new Date(expiresAt).getTime() - Date.now())
  })
  const firedRef = useRef(false)

  useEffect(() => {
    if (!expiresAt || isClosed) return

    const tick = () => {
      const remaining = Math.max(0, new Date(expiresAt).getTime() - Date.now())
      setMsLeft(remaining)
      if (remaining <= 0 && !firedRef.current) {
        firedRef.current = true
        onExpire?.()
      }
    }

    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [expiresAt, isClosed, onExpire])

  const isSm = size === "sm"

  // 마감된 토론
  if (isClosed) {
    return (
      <span className={`inline-flex items-center gap-1 rounded-full border border-red-400/40 bg-red-400/15 ${
        isSm ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-[10px]"
      } font-semibold text-red-300`}>
        <Lock className={isSm ? "size-2.5" : "size-2.5"} />
        마감
      </span>
    )
  }

  // expires_at 없음 → 상시
  if (!expiresAt || msLeft < 0) {
    return (
      <span className={`inline-flex items-center gap-1 text-zinc-500 ${
        isSm ? "text-[10px]" : "text-[11px]"
      }`}>
        <Clock className="size-3" />
        상시
      </span>
    )
  }

  // 만료됨 (아직 is_closed가 반영 안 된 찰나)
  if (msLeft <= 0) {
    return (
      <span className={`inline-flex items-center gap-1 rounded-full border border-red-400/40 bg-red-400/15 ${
        isSm ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-[10px]"
      } font-semibold text-red-300`}>
        <Lock className="size-2.5" />
        마감 중...
      </span>
    )
  }

  const isUrgent = msLeft < 10 * 60 * 1000 // 10분 미만

  return (
    <span className={[
      "inline-flex items-center gap-1 rounded-full border font-semibold tabular-nums",
      isSm ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-[11px]",
      isUrgent
        ? "border-red-400/50 bg-red-500/15 text-red-300 countdown-urgent"
        : "border-amber-400/30 bg-amber-500/10 text-amber-200",
    ].join(" ")}>
      <Timer className={isSm ? "size-2.5" : "size-3"} />
      {formatRemaining(msLeft)}
    </span>
  )
}
