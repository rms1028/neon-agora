"use client"

import { useCallback, useEffect, useState } from "react"
import { MessageSquarePlus, X } from "lucide-react"

import { supabase } from "@/lib/supabase"
import { useAuth } from "@/components/auth-provider"
import { useToast } from "@/components/toast-provider"
import { getDisplayName } from "@/lib/utils"

type DebateRequest = {
  id: string
  sender_id: string
  topic: string
  mode: "pro" | "con" | "free"
  senderName: string
}

const MODE_LABEL: Record<string, string> = {
  pro: "찬성",
  con: "반대",
  free: "자유",
}

const MODE_STYLE: Record<string, string> = {
  pro: "border-cyan-400/40 bg-cyan-400/15 text-cyan-200",
  con: "border-fuchsia-400/40 bg-fuchsia-400/15 text-fuchsia-200",
  free: "border-violet-400/40 bg-violet-400/15 text-violet-200",
}

export function DebateRequestToast() {
  const { user } = useAuth()
  const { showToast } = useToast()
  const [queue, setQueue] = useState<DebateRequest[]>([])

  // Realtime 구독: 내가 receiver인 새 요청
  useEffect(() => {
    if (!user) return

    const channel = supabase
      .channel(`debate-req-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "debate_requests",
          filter: `receiver_id=eq.${user.id}`,
        },
        async (payload) => {
          const row = payload.new as {
            id: string
            sender_id: string
            topic: string
            mode: "pro" | "con" | "free"
          }

          // sender 닉네임 조회
          const { data: profile } = await supabase
            .from("profiles")
            .select("display_name")
            .eq("id", row.sender_id)
            .single()

          const senderName = getDisplayName(
            profile
              ? { display_name: (profile as { display_name?: string | null }).display_name, id: row.sender_id }
              : row.sender_id
          )

          setQueue((prev) => [
            ...prev,
            {
              id: row.id,
              sender_id: row.sender_id,
              topic: row.topic,
              mode: row.mode,
              senderName,
            },
          ])
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [user?.id])

  const dismiss = useCallback((id: string) => {
    setQueue((prev) => prev.filter((r) => r.id !== id))
  }, [])

  const handleAccept = useCallback(async (req: DebateRequest) => {
    const { error } = await supabase
      .from("debate_requests")
      .update({ status: "accepted" })
      .eq("id", req.id)

    if (error) {
      showToast("수락에 실패했습니다.", "error")
      return
    }
    showToast(`${req.senderName}님의 토론 신청을 수락했습니다!`, "success")
    dismiss(req.id)
  }, [showToast, dismiss])

  const handleDecline = useCallback(async (req: DebateRequest) => {
    const { error } = await supabase
      .from("debate_requests")
      .update({ status: "declined" })
      .eq("id", req.id)

    if (error) {
      showToast("거절에 실패했습니다.", "error")
      return
    }
    dismiss(req.id)
  }, [showToast, dismiss])

  if (queue.length === 0) return null

  return (
    <div className="fixed bottom-4 left-4 z-[998] flex flex-col gap-3 max-sm:bottom-20 max-sm:left-2 max-sm:right-2">
      {queue.map((req) => (
        <div
          key={req.id}
          className="animate-slide-up w-80 max-sm:w-full rounded-2xl border border-emerald-400/30 bg-gray-950/95 p-4 shadow-[0_0_30px_rgba(52,211,153,0.15)] backdrop-blur"
        >
          {/* 헤더 */}
          <div className="mb-3 flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="grid size-7 shrink-0 place-items-center rounded-lg border border-emerald-400/30 bg-emerald-400/10 text-emerald-300">
                <MessageSquarePlus className="size-3.5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-emerald-200">토론 신청</p>
                <p className="text-[11px] text-zinc-400">{req.senderName}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => dismiss(req.id)}
              className="shrink-0 rounded-full p-1 text-zinc-500 transition hover:bg-white/10 hover:text-zinc-300"
            >
              <X className="size-3.5" />
            </button>
          </div>

          {/* 주제 + 모드 */}
          <p className="mb-2 line-clamp-2 text-sm text-zinc-100">{req.topic}</p>
          <span
            className={`inline-block rounded-full border px-2 py-0.5 text-[11px] font-semibold ${MODE_STYLE[req.mode]}`}
          >
            {MODE_LABEL[req.mode]}
          </span>

          {/* 액션 버튼 */}
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => handleDecline(req)}
              className="flex-1 rounded-xl border border-white/10 bg-white/5 py-2 text-xs font-medium text-zinc-400 transition hover:bg-white/10 hover:text-zinc-200"
            >
              거절
            </button>
            <button
              type="button"
              onClick={() => handleAccept(req)}
              className="flex-1 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 py-2 text-xs font-semibold text-black transition hover:brightness-110"
            >
              {/* 자유 모드일 때 '참여' 텍스트 */}
              {req.mode === "free" ? "참여" : "수락"}
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
