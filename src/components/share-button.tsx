"use client"

import { Link2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useToast } from "@/components/toast-provider"

export function ShareButton({
  title,
  threadId,
}: {
  title: string
  threadId: string
}) {
  const { showToast } = useToast()

  async function handleShare() {
    const url = `${window.location.origin}/thread/${threadId}`
    try {
      if (navigator.share) {
        await navigator.share({ title, url })
      } else {
        await navigator.clipboard.writeText(url)
        showToast("링크가 복사되었습니다!", "success")
      }
    } catch {
      // 사용자가 공유 취소
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleShare}
      className="border-white/15 bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-zinc-100"
    >
      <Link2 className="size-3.5" />
      공유
    </Button>
  )
}
