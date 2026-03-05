"use client"

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { Swords, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/components/auth-provider"
import { useToast } from "@/components/toast-provider"

type SimpleThread = { id: string; title: string }

export function DuelChallengeModal({
  opponentId,
  onClose,
}: {
  opponentId: string
  onClose: () => void
}) {
  const { user } = useAuth()
  const { showToast } = useToast()

  const [mounted, setMounted] = useState(false)
  const [threads, setThreads] = useState<SimpleThread[]>([])
  const [selectedThread, setSelectedThread] = useState("")
  const [side, setSide] = useState<"pro" | "con">("pro")
  const [loading, setLoading] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  // 유저의 토론 로드
  useEffect(() => {
    if (!user) return
    ;(async () => {
      const { data } = await supabase
        .from("threads")
        .select("id, title")
        .eq("is_closed", false)
        .order("created_at", { ascending: false })
        .limit(20)
      setThreads((data ?? []).map((t) => ({
        id: String((t as Record<string, unknown>).id),
        title: String((t as Record<string, unknown>).title),
      })))
    })()
  }, [user?.id])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !selectedThread) return

    setLoading(true)
    const { error } = await supabase.from("duels").insert({
      thread_id: selectedThread,
      challenger_id: user.id,
      opponent_id: opponentId,
      challenger_side: side,
    })
    setLoading(false)

    if (error) {
      showToast("대결 신청에 실패했습니다.", "error")
      return
    }

    showToast("대결을 신청했습니다! 상대방의 수락을 기다려주세요.", "success")
    onClose()
  }

  if (!mounted) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[999] flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="duel-card-enter relative w-full max-w-md rounded-2xl border border-amber-400/30 bg-gray-950 p-6 shadow-2xl"
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
            className="grid size-9 place-items-center rounded-xl border border-amber-400/30 bg-amber-400/10 text-amber-300"
            style={{ boxShadow: "0 0 14px rgba(245,158,11,0.3)" }}
          >
            <Swords className="size-4" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-zinc-50">대결 신청</h2>
            <p className="text-xs text-zinc-500">토론을 선택하고 입장을 정하세요</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 토론 선택 */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-zinc-400">토론 선택</label>
            <select
              value={selectedThread}
              onChange={(e) => setSelectedThread(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-zinc-100 outline-none"
            >
              <option value="" className="bg-zinc-900">토론을 선택하세요</option>
              {threads.map((t) => (
                <option key={t.id} value={t.id} className="bg-zinc-900">
                  {t.title}
                </option>
              ))}
            </select>
          </div>

          {/* 사이드 선택 */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-zinc-400">내 입장</label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSide("pro")}
                className={`flex-1 rounded-xl border py-2.5 text-sm font-semibold transition ${
                  side === "pro"
                    ? "border-cyan-400/50 bg-cyan-400/15 text-cyan-100"
                    : "border-white/10 bg-white/5 text-zinc-400"
                }`}
              >
                찬성
              </button>
              <button
                type="button"
                onClick={() => setSide("con")}
                className={`flex-1 rounded-xl border py-2.5 text-sm font-semibold transition ${
                  side === "con"
                    ? "border-fuchsia-400/50 bg-fuchsia-400/15 text-fuchsia-100"
                    : "border-white/10 bg-white/5 text-zinc-400"
                }`}
              >
                반대
              </button>
            </div>
          </div>

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
              disabled={loading || !selectedThread}
              className="flex-1 bg-gradient-to-r from-amber-400 to-orange-400 font-semibold text-black shadow-[0_0_20px_rgba(245,158,11,0.4)]"
            >
              <Swords className="size-4" />
              {loading ? "신청 중…" : "대결 신청"}
            </Button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}
