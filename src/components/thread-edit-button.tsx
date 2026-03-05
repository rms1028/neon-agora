"use client"

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { useRouter } from "next/navigation"
import { Pencil, Trash2, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/components/auth-provider"
import { useToast } from "@/components/toast-provider"
import { useConfirm } from "@/components/confirm-dialog"

const CATEGORIES = [
  "AI", "정치", "경제", "사회", "기술", "문화", "교육", "환경", "기타",
]

export function ThreadEditButton({
  threadId,
  threadCreatedBy,
  initialTitle,
  initialContent,
  initialTag,
  isClosed,
}: {
  threadId: string
  threadCreatedBy: string
  initialTitle: string
  initialContent: string
  initialTag: string
  isClosed: boolean
}) {
  const router = useRouter()
  const { user } = useAuth()
  const { showToast } = useToast()
  const { confirm } = useConfirm()

  const [mounted, setMounted] = useState(false)
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState(initialTitle)
  const [content, setContent] = useState(initialContent)
  const [tag, setTag] = useState(initialTag)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // 본인 + 마감 안됨 + 로그인 상태에서만 렌더
  if (!mounted || !user || user.id !== threadCreatedBy || isClosed) return null

  async function handleSave() {
    const trimmedTitle = title.trim()
    const trimmedContent = content.trim()

    if (!trimmedTitle) {
      showToast("제목을 입력해주세요.", "info")
      return
    }

    setSaving(true)
    const { error } = await supabase
      .from("threads")
      .update({
        title: trimmedTitle,
        content: trimmedContent,
        tag: tag || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", threadId)
      .eq("created_by", user!.id)

    setSaving(false)

    if (error) {
      showToast("토론 수정에 실패했습니다.", "error")
      return
    }

    showToast("토론이 수정되었습니다!", "success")
    setOpen(false)
    router.refresh()
  }

  function handleClose() {
    setOpen(false)
    setTitle(initialTitle)
    setContent(initialContent)
    setTag(initialTag)
  }

  async function handleDelete() {
    const ok = await confirm({
      title: "토론 삭제",
      message: "정말 이 토론을 삭제하시겠습니까? 삭제하면 되돌릴 수 없습니다.",
      confirmText: "삭제",
      variant: "danger",
    })
    if (!ok) return

    setDeleting(true)
    const { error } = await supabase
      .from("threads")
      .delete()
      .eq("id", threadId)
      .eq("created_by", user!.id)

    if (error) {
      showToast("토론 삭제에 실패했습니다.", "error")
      setDeleting(false)
      return
    }

    showToast("토론이 삭제되었습니다.", "success")
    router.push("/")
  }

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => setOpen(true)}
        className="border-white/15 bg-white/5 text-zinc-100 hover:bg-white/10"
      >
        <Pencil className="size-3.5" />
        수정
      </Button>

      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={handleDelete}
        disabled={deleting}
        className="border-red-400/30 bg-red-400/10 text-red-200 hover:bg-red-400/20"
      >
        <Trash2 className="size-3.5" />
        {deleting ? "삭제 중…" : "삭제"}
      </Button>

      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
            onClick={(e) => {
              if (e.target === e.currentTarget) handleClose()
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") handleClose()
            }}
          >
            <div className="relative mx-4 w-full max-w-lg rounded-3xl border border-white/10 bg-zinc-950 p-6 shadow-2xl">
              {/* 닫기 */}
              <button
                type="button"
                onClick={handleClose}
                className="absolute top-4 right-4 rounded-full p-1 text-zinc-500 hover:bg-white/10 hover:text-zinc-300"
              >
                <X className="size-5" />
              </button>

              <h2 className="mb-5 text-lg font-semibold text-zinc-100">
                토론 수정
              </h2>

              <div className="space-y-4">
                {/* 제목 */}
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-zinc-400">
                    제목
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    maxLength={100}
                    className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-zinc-100 outline-none focus:border-cyan-400/40"
                  />
                </div>

                {/* 내용 */}
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-zinc-400">
                    내용
                  </label>
                  <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    rows={4}
                    maxLength={2000}
                    className="w-full resize-none rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-zinc-100 outline-none focus:border-cyan-400/40"
                  />
                </div>

                {/* 카테고리 */}
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-zinc-400">
                    카테고리
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {CATEGORIES.map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setTag(tag === cat ? "" : cat)}
                        className={[
                          "rounded-full border px-3 py-1 text-xs font-medium transition",
                          tag === cat
                            ? "border-cyan-400/40 bg-cyan-400/15 text-cyan-100"
                            : "border-white/10 bg-white/5 text-zinc-400 hover:bg-white/10",
                        ].join(" ")}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 저장 */}
                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleClose}
                    className="border-white/10 text-zinc-400"
                  >
                    취소
                  </Button>
                  <Button
                    type="button"
                    onClick={handleSave}
                    disabled={saving || !title.trim()}
                    className="bg-gradient-to-r from-cyan-300 via-sky-200 to-fuchsia-300 text-sm font-semibold text-black hover:from-cyan-200 hover:via-sky-100 hover:to-fuchsia-200 disabled:opacity-60"
                  >
                    {saving ? "저장 중…" : "저장"}
                  </Button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  )
}
