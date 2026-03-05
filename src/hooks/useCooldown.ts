"use client"

import { useCallback, useEffect, useRef, useState } from "react"

export function useCooldown(ms: number): {
  canFire: boolean
  remainSec: number
  fire: () => void
} {
  const lastRef = useRef<number>(0)
  const [remainSec, setRemainSec] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  useEffect(() => {
    return clearTimer
  }, [clearTimer])

  const fire = useCallback(() => {
    lastRef.current = Date.now()
    setRemainSec(Math.ceil(ms / 1000))

    clearTimer()
    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - lastRef.current
      const left = Math.ceil((ms - elapsed) / 1000)
      if (left <= 0) {
        setRemainSec(0)
        clearTimer()
      } else {
        setRemainSec(left)
      }
    }, 1000)
  }, [ms, clearTimer])

  const canFire = remainSec <= 0

  return { canFire, remainSec, fire }
}
