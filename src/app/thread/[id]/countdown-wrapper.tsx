"use client"

import { useCallback } from "react"
import { useRouter } from "next/navigation"
import { DebateCountdown } from "@/components/debate-countdown"
import { useToast } from "@/components/toast-provider"

export function CountdownWrapper({
  expiresAt,
  isClosed,
  threadId,
}: {
  expiresAt: string | null
  isClosed: boolean
  threadId: string
}) {
  const router = useRouter()
  const { showToast } = useToast()

  const handleExpire = useCallback(() => {
    fetch("/api/auto-close", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ threadId }),
    })
      .then((r) => r.json())
      .then(() => {
        showToast("토론이 마감되었습니다.", "info")
        router.refresh()
      })
      .catch(() => {})
  }, [threadId, showToast, router])

  return (
    <DebateCountdown
      expiresAt={expiresAt}
      isClosed={isClosed}
      threadId={threadId}
      onExpire={handleExpire}
    />
  )
}
