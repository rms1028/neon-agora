"use client"

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { Check, Crown, X } from "lucide-react"

import { supabase } from "@/lib/supabase"
import { getAvailableTitles, type TitleDef } from "@/lib/titles"
import { useAuth } from "@/components/auth-provider"
import { useProfile } from "@/components/profile-provider"
import { useToast } from "@/components/toast-provider"

export function TitleSelectorModal({
  isOpen,
  onClose,
  currentTitle,
  onSelect,
}: {
  isOpen: boolean
  onClose: () => void
  currentTitle: string | null
  onSelect: (key: string | null) => void
}) {
  const { user } = useAuth()
  const { achievements } = useProfile()
  const { showToast } = useToast()
  const [saving, setSaving] = useState(false)
  const [selected, setSelected] = useState<string | null>(currentTitle)

  useEffect(() => {
    setSelected(currentTitle)
  }, [currentTitle, isOpen])

  if (!isOpen) return null

  const available = getAvailableTitles(achievements)

  async function handleSave() {
    if (!user) return
    setSaving(true)

    const { error } = await supabase
      .from("profiles")
      .update({ custom_title: selected })
      .eq("id", user.id)

    if (error) {
      showToast("칭호 변경에 실패했습니다.", "error")
    } else {
      onSelect(selected)
      showToast("칭호가 변경되었습니다!", "success")
      onClose()
    }
    setSaving(false)
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="relative w-full max-w-md rounded-3xl border border-white/10 bg-black/90 p-6 shadow-2xl">
        {/* 닫기 */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 rounded-full p-1 text-zinc-500 transition hover:bg-white/10 hover:text-zinc-300"
        >
          <X className="size-4" />
        </button>

        <div className="mb-4 flex items-center gap-2 text-base font-semibold text-zinc-100">
          <Crown className="size-5 text-amber-300" />
          칭호 선택
        </div>

        <div className="space-y-2">
          {/* 칭호 해제 옵션 */}
          <button
            type="button"
            onClick={() => setSelected(null)}
            className={`flex w-full items-center justify-between rounded-xl border p-3 text-left transition ${
              selected === null
                ? "border-cyan-400/40 bg-cyan-400/10"
                : "border-white/10 bg-white/5 hover:bg-white/10"
            }`}
          >
            <div>
              <div className="text-sm font-medium text-zinc-200">칭호 없음</div>
              <div className="text-[11px] text-zinc-500">칭호를 표시하지 않습니다</div>
            </div>
            {selected === null && <Check className="size-4 text-cyan-300" />}
          </button>

          {available.length === 0 && (
            <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-center text-sm text-zinc-500">
              아직 해금된 칭호가 없습니다. 업적을 달성해보세요!
            </div>
          )}

          {available.map((t: TitleDef) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setSelected(t.key)}
              className={`flex w-full items-center justify-between rounded-xl border p-3 text-left transition ${
                selected === t.key
                  ? `${t.bgClass} border-opacity-60`
                  : "border-white/10 bg-white/5 hover:bg-white/10"
              }`}
            >
              <div>
                <div className={`text-sm font-semibold ${t.colorClass}`}>
                  {t.name}
                </div>
                <div className="text-[11px] text-zinc-500">{t.description}</div>
              </div>
              {selected === t.key && <Check className={`size-4 ${t.colorClass}`} />}
            </button>
          ))}
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-zinc-400 transition hover:bg-white/10"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm font-medium text-cyan-200 transition hover:bg-cyan-400/20 disabled:opacity-60"
          >
            {saving ? "저장 중…" : "저장"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
