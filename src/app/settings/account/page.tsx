"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AlertTriangle, ArrowLeft, Download, Trash2 } from "lucide-react"

import { supabase } from "@/lib/supabase"
import { useAuth } from "@/components/auth-provider"
import { useToast } from "@/components/toast-provider"
import { useConfirm } from "@/components/confirm-dialog"

export default function AccountSettingsPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const { showToast } = useToast()
  const { confirm } = useConfirm()
  const [confirmEmail, setConfirmEmail] = useState("")
  const [deleting, setDeleting] = useState(false)
  const [exporting, setExporting] = useState(false)

  async function handleExport() {
    if (!user) return
    setExporting(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        showToast("세션이 만료되었습니다. 다시 로그인해주세요.", "error")
        setExporting(false)
        return
      }
      const res = await fetch("/api/account/export", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (!res.ok) {
        const data = await res.json()
        showToast(data.error || "내보내기에 실패했습니다.", "error")
        setExporting(false)
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `neon-agora-export-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
      showToast("데이터가 다운로드되었습니다.", "success")
    } catch {
      showToast("내보내기 중 오류가 발생했습니다.", "error")
    }
    setExporting(false)
  }

  const emailMatch = user?.email && confirmEmail === user.email

  async function handleDelete() {
    if (!user || !emailMatch) return

    const ok = await confirm({
      title: "정말 계정을 삭제하시겠습니까?",
      message: "이 작업은 되돌릴 수 없습니다. 모든 데이터가 영구적으로 삭제됩니다.",
      confirmText: "삭제",
      variant: "danger",
    })
    if (!ok) return

    const ok2 = await confirm({
      title: "최종 확인",
      message: "계정 삭제를 진행합니다. 정말 확실합니까?",
      confirmText: "영구 삭제",
      variant: "danger",
    })
    if (!ok2) return

    setDeleting(true)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        showToast("세션이 만료되었습니다. 다시 로그인해주세요.", "error")
        setDeleting(false)
        return
      }

      const res = await fetch("/api/account/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ confirmEmail }),
      })

      if (!res.ok) {
        const data = await res.json()
        showToast(data.error || "계정 삭제에 실패했습니다.", "error")
        setDeleting(false)
        return
      }

      await supabase.auth.signOut()
      showToast("계정이 삭제되었습니다. 안녕히 가세요.", "success")
      router.push("/")
    } catch {
      showToast("계정 삭제 중 오류가 발생했습니다.", "error")
      setDeleting(false)
    }
  }

  if (authLoading) return null

  if (!user) {
    return (
      <div className="min-h-screen bg-black text-zinc-100">
        <div className="mx-auto max-w-lg px-4 py-20 text-center">
          <AlertTriangle className="mx-auto size-8 text-zinc-600" />
          <p className="mt-4 text-sm text-zinc-400">로그인이 필요합니다.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-zinc-100">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(1200px_circle_at_50%_10%,rgba(239,68,68,0.08),transparent_55%)]" />
      </div>

      <div className="relative mx-auto w-full max-w-lg px-4 py-10 sm:px-6">
        <nav className="mb-6">
          <Link
            href="/settings/profile"
            className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-200"
          >
            <ArrowLeft className="size-4" />
            프로필 설정으로 돌아가기
          </Link>
        </nav>

        {/* 내 데이터 내보내기 */}
        <div className="mb-8 rounded-2xl border border-cyan-400/20 bg-cyan-400/5 p-6">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl border border-cyan-400/30 bg-cyan-400/10 text-cyan-400">
              <Download className="size-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-cyan-300">내 데이터 내보내기</h2>
              <p className="text-xs text-zinc-500">프로필, 토론, 댓글, 투표 등 모든 데이터를 JSON으로 다운로드</p>
            </div>
          </div>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-cyan-400/30 bg-cyan-400/10 py-3 text-sm font-medium text-cyan-200 transition hover:bg-cyan-400/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Download className="size-4" />
            {exporting ? "내보내는 중…" : "데이터 다운로드"}
          </button>
        </div>

        <header className="mb-8 flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-xl border border-red-500/30 bg-red-500/10 text-red-400">
            <AlertTriangle className="size-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-red-400">위험 구역</h1>
            <p className="text-xs text-zinc-500">계정 삭제는 되돌릴 수 없습니다</p>
          </div>
        </header>

        <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6">
          <h2 className="mb-2 text-sm font-semibold text-red-300">계정 영구 삭제</h2>
          <p className="mb-4 text-xs leading-relaxed text-zinc-400">
            계정을 삭제하면 다음이 영구적으로 처리됩니다:
          </p>
          <ul className="mb-6 space-y-1.5 text-xs text-zinc-500">
            <li className="flex items-center gap-2">
              <span className="size-1 rounded-full bg-red-400" />
              작성한 댓글이 &ldquo;[삭제된 계정]&rdquo;으로 변경
            </li>
            <li className="flex items-center gap-2">
              <span className="size-1 rounded-full bg-red-400" />
              프로필 정보 초기화
            </li>
            <li className="flex items-center gap-2">
              <span className="size-1 rounded-full bg-red-400" />
              알림 및 북마크 삭제
            </li>
            <li className="flex items-center gap-2">
              <span className="size-1 rounded-full bg-red-400" />
              로그인 불가 (계정 복구 불가)
            </li>
          </ul>

          {/* 이메일 확인 */}
          <div className="mb-4 space-y-2">
            <label className="text-xs font-medium text-zinc-400">
              확인을 위해 이메일을 입력하세요
            </label>
            <input
              type="email"
              value={confirmEmail}
              onChange={(e) => setConfirmEmail(e.target.value)}
              placeholder={user.email ?? "이메일 입력"}
              className="w-full rounded-xl border border-red-500/20 bg-black/40 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 transition focus:border-red-500/40 focus:outline-none focus:ring-1 focus:ring-red-500/30"
            />
            {confirmEmail && !emailMatch && (
              <p className="text-[11px] text-red-400">이메일이 일치하지 않습니다.</p>
            )}
          </div>

          {/* 삭제 버튼 */}
          <button
            onClick={handleDelete}
            disabled={!emailMatch || deleting}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 py-3 text-sm font-medium text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Trash2 className="size-4" />
            {deleting ? "삭제 중…" : "계정 영구 삭제"}
          </button>
        </div>
      </div>
    </div>
  )
}
