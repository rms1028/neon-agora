"use client"

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { MessageSquarePlus, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/components/auth-provider"
import { useToast } from "@/components/toast-provider"

type Mode = "pro" | "con" | "free"

export function DebateRequestModal({
  opponentId,
  onClose,
}: {
  opponentId: string
  onClose: () => void
}) {
  const { user } = useAuth()
  const { showToast } = useToast()

  const [mounted, setMounted] = useState(false)
  const [topic, setTopic] = useState("")
  const [mode, setMode] = useState<Mode>("pro")
  const [loading, setLoading] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !topic.trim()) return

    setLoading(true)
    const { error } = await supabase.from("debate_requests").insert({
      sender_id: user.id,
      receiver_id: opponentId,
      topic: topic.trim(),
      mode,
    })
    setLoading(false)

    if (error) {
      showToast("토론 신청에 실패했습니다.", "error")
      return
    }

    showToast("토론을 신청했습니다! 상대방의 응답을 기다려주세요.", "success")
    onClose()
  }

  if (!mounted) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[999] flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="duel-card-enter relative w-full max-w-md rounded-2xl border border-emerald-400/30 bg-gray-950 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 inline-flex size-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-zinc-400 transition hover:bg-white/10"
        >
          <X className="size-4" />
        </button>

        <div className="mb-5 flex items-center gap-3">
          <div
            className="grid size-9 place-items-center rounded-xl border border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
            style={{ boxShadow: "0 0 14px rgba(52,211,153,0.3)" }}
          >
            <MessageSquarePlus className="size-4" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-zinc-50">토론 신청</h2>
            <p className="text-xs text-zinc-500">주제를 입력하고 입장을 정하세요</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 주제 입력 */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-zinc-400">토론 주제</label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value.slice(0, 200))}
              placeholder="토론하고 싶은 주제를 입력하세요"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-emerald-400/40"
            />
            <div className="text-right text-[11px] text-zinc-600">
              {topic.length}/200
            </div>
          </div>

          {/* 모드 선택 */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-zinc-400">내 입장</label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setMode("pro")}
                className={`flex-1 rounded-xl border py-2.5 text-sm font-semibold transition ${
                  mode === "pro"
                    ? "border-cyan-400/50 bg-cyan-400/15 text-cyan-100"
                    : "border-white/10 bg-white/5 text-zinc-400"
                }`}
              >
                찬성
              </button>
              <button
                type="button"
                onClick={() => setMode("con")}
                className={`flex-1 rounded-xl border py-2.5 text-sm font-semibold transition ${
                  mode === "con"
                    ? "border-fuchsia-400/50 bg-fuchsia-400/15 text-fuchsia-100"
                    : "border-white/10 bg-white/5 text-zinc-400"
                }`}
              >
                반대
              </button>
              <button
                type="button"
                onClick={() => setMode("free")}
                className={`flex-1 rounded-xl border py-2.5 text-sm font-semibold transition ${
                  mode === "free"
                    ? "border-violet-400/50 bg-violet-400/15 text-violet-100"
                    : "border-white/10 bg-white/5 text-zinc-400"
                }`}
              >
                자유
              </button>
            </div>
          </div>

          {/* 자유 모드 안내 */}
          {mode === "free" && (
            <p className="rounded-lg border border-violet-400/20 bg-violet-400/5 px-3 py-2 text-[11px] text-violet-300">
              자유 토론: 찬반 없이 자유롭게 의견을 교환합니다. 양측 모두 side=&apos;free&apos;로 참여하며, 승패 판정 없이 논리적 깊이 + 소통 점수 기반으로 XP가 지급됩니다.
            </p>
          )}

          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1 border-white/15 bg-white/5 text-zinc-300"
            >
              취소
            </Button>
            <Button
              type="submit"
              disabled={loading || !topic.trim()}
              className="flex-1 bg-gradient-to-r from-emerald-400 to-teal-400 font-semibold text-black shadow-[0_0_20px_rgba(52,211,153,0.4)]"
            >
              <MessageSquarePlus className="size-4" />
              {loading ? "신청 중…" : "토론 신청"}
            </Button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}
