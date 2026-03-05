"use client"

import { useCallback, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Eye, EyeOff, Lock, ShieldCheck } from "lucide-react"

import { supabase } from "@/lib/supabase"
import { useAuth } from "@/components/auth-provider"
import { useToast } from "@/components/toast-provider"

export default function SecuritySettingsPage() {
  const { user, loading: authLoading } = useAuth()
  const { showToast } = useToast()

  const [currentPw, setCurrentPw] = useState("")
  const [newPw, setNewPw] = useState("")
  const [confirmPw, setConfirmPw] = useState("")
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [saving, setSaving] = useState(false)

  const isEmailProvider =
    user?.app_metadata?.provider === "email" ||
    user?.app_metadata?.providers?.includes("email")

  const isLongEnough = newPw.length >= 6
  const isMatch = newPw === confirmPw && confirmPw.length > 0

  const handleChangePassword = useCallback(async () => {
    if (!user || !isEmailProvider) return
    if (!currentPw.trim()) {
      showToast("현재 비밀번호를 입력해주세요.", "error")
      return
    }
    if (!isLongEnough) {
      showToast("새 비밀번호는 6자 이상이어야 합니다.", "error")
      return
    }
    if (!isMatch) {
      showToast("새 비밀번호가 일치하지 않습니다.", "error")
      return
    }

    setSaving(true)

    // 현재 비밀번호 검증
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email!,
      password: currentPw,
    })

    if (signInError) {
      showToast("현재 비밀번호가 올바르지 않습니다.", "error")
      setSaving(false)
      return
    }

    // 비밀번호 변경
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPw,
    })

    setSaving(false)

    if (updateError) {
      showToast("비밀번호 변경에 실패했습니다: " + updateError.message, "error")
      return
    }

    showToast("비밀번호가 변경되었습니다!", "success")
    setCurrentPw("")
    setNewPw("")
    setConfirmPw("")
  }, [user, isEmailProvider, currentPw, newPw, confirmPw, isLongEnough, isMatch, showToast])

  if (authLoading) return null

  if (!user) {
    return (
      <div className="min-h-screen bg-black text-zinc-100">
        <div className="mx-auto max-w-lg px-4 py-20 text-center">
          <Lock className="mx-auto size-8 text-zinc-600" />
          <p className="mt-4 text-sm text-zinc-400">로그인이 필요합니다.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-zinc-100">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(1200px_circle_at_30%_10%,rgba(236,72,153,0.12),transparent_55%)]" />
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

        <header className="mb-8 flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-xl border border-fuchsia-400/30 bg-fuchsia-400/10 text-fuchsia-300">
            <ShieldCheck className="size-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-zinc-50">보안 설정</h1>
            <p className="text-xs text-zinc-500">비밀번호를 변경합니다</p>
          </div>
        </header>

        {!isEmailProvider ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
            <Lock className="mx-auto size-8 text-zinc-500" />
            <p className="mt-3 text-sm text-zinc-400">
              소셜 로그인 계정은 비밀번호를 변경할 수 없습니다.
            </p>
            <p className="mt-1 text-xs text-zinc-600">
              {user.app_metadata?.provider ?? "OAuth"} 계정으로 로그인 중
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {/* 현재 비밀번호 */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-zinc-400">
                현재 비밀번호
              </label>
              <div className="relative">
                <input
                  type={showCurrent ? "text" : "password"}
                  value={currentPw}
                  onChange={(e) => setCurrentPw(e.target.value)}
                  placeholder="현재 비밀번호를 입력하세요"
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 pr-10 text-sm text-zinc-100 placeholder:text-zinc-600 transition focus:border-fuchsia-400/40 focus:outline-none focus:ring-1 focus:ring-fuchsia-400/30"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                >
                  {showCurrent ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </button>
              </div>
            </div>

            {/* 새 비밀번호 */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-zinc-400">
                새 비밀번호
              </label>
              <div className="relative">
                <input
                  type={showNew ? "text" : "password"}
                  value={newPw}
                  onChange={(e) => setNewPw(e.target.value)}
                  placeholder="6자 이상의 새 비밀번호"
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 pr-10 text-sm text-zinc-100 placeholder:text-zinc-600 transition focus:border-fuchsia-400/40 focus:outline-none focus:ring-1 focus:ring-fuchsia-400/30"
                />
                <button
                  type="button"
                  onClick={() => setShowNew((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                >
                  {showNew ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </button>
              </div>
              {newPw.length > 0 && (
                <div className="flex items-center gap-2 text-[11px]">
                  <span
                    className={
                      isLongEnough ? "text-emerald-400" : "text-red-400"
                    }
                  >
                    {isLongEnough ? "✓" : "✗"} 6자 이상
                  </span>
                </div>
              )}
            </div>

            {/* 비밀번호 확인 */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-zinc-400">
                비밀번호 확인
              </label>
              <input
                type="password"
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
                placeholder="새 비밀번호를 다시 입력하세요"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 transition focus:border-fuchsia-400/40 focus:outline-none focus:ring-1 focus:ring-fuchsia-400/30"
              />
              {confirmPw.length > 0 && (
                <div className="flex items-center gap-2 text-[11px]">
                  <span
                    className={isMatch ? "text-emerald-400" : "text-red-400"}
                  >
                    {isMatch ? "✓" : "✗"} 비밀번호 일치
                  </span>
                </div>
              )}
            </div>

            {/* 변경 버튼 */}
            <button
              onClick={handleChangePassword}
              disabled={saving || !currentPw || !isLongEnough || !isMatch}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-fuchsia-500 py-3 text-sm font-medium text-white shadow-[0_0_20px_rgba(236,72,153,0.3)] transition hover:bg-fuchsia-600 disabled:opacity-50"
            >
              <Lock className="size-4" />
              {saving ? "변경 중…" : "비밀번호 변경"}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
