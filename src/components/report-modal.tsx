"use client"

import { useState } from "react"
import { AlertTriangle, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/components/auth-provider"
import { useToast } from "@/components/toast-provider"

const REASONS = ["욕설", "스팸", "허위정보", "기타"] as const

export function ReportModal({
  isOpen,
  onClose,
  targetType,
  targetId,
  targetUserId,
}: {
  isOpen: boolean
  onClose: () => void
  targetType: "comment" | "thread" | "user"
  targetId: string
  targetUserId?: string
}) {
  const { user } = useAuth()
  const { showToast } = useToast()
  const [reason, setReason] = useState<string>("")
  const [detail, setDetail] = useState("")
  const [submitting, setSubmitting] = useState(false)

  if (!isOpen) return null

  async function handleSubmit() {
    if (!user) {
      showToast("로그인이 필요합니다.", "info")
      return
    }
    if (!reason) {
      showToast("신고 사유를 선택해주세요.", "info")
      return
    }

    setSubmitting(true)
    const { error } = await supabase.from("reports").insert({
      reporter_id: user.id,
      target_type: targetType,
      target_id: targetId,
      reason,
      detail: detail.trim() || null,
    })
    setSubmitting(false)

    if (error) {
      if (error.code === "42P01" || error.code === "PGRST205") {
        showToast("신고 기능 테이블이 아직 생성되지 않았습니다.", "error")
      } else {
        showToast("신고 접수에 실패했습니다.", "error")
      }
      return
    }

    showToast("신고가 접수되었습니다.", "success")
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-md rounded-2xl border border-white/10 bg-black/90 p-6 shadow-2xl backdrop-blur">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
            <AlertTriangle className="size-4 text-amber-300" />
            신고하기
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-500 transition hover:text-zinc-300"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <div className="text-xs text-zinc-400">신고 사유</div>
            <div className="grid grid-cols-2 gap-2">
              {REASONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setReason(r)}
                  className={`rounded-xl border px-3 py-2 text-xs font-medium transition ${
                    reason === r
                      ? "border-amber-400/50 bg-amber-400/15 text-amber-100"
                      : "border-white/10 bg-white/5 text-zinc-400 hover:bg-white/10"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-xs text-zinc-400">상세 내용 (선택)</div>
            <textarea
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              placeholder="추가 설명이 있다면 적어주세요…"
              rows={3}
              maxLength={500}
              className="w-full resize-none rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none"
            />
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1 border-white/10 bg-white/5 text-zinc-400 hover:bg-white/10"
            >
              취소
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={submitting || !reason}
              className="flex-1 bg-amber-500/80 text-black hover:bg-amber-500/90 disabled:opacity-60"
            >
              {submitting ? "접수 중…" : "신고 접수"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
