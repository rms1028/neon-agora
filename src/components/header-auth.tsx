"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { LogIn, LogOut, Moon, Sun, User } from "lucide-react"

import { Button } from "@/components/ui/button"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/components/auth-provider"
import { useToast } from "@/components/toast-provider"
import { useProfile } from "@/components/profile-provider"
import { AuthModal } from "@/components/auth-modal"
import { NotificationBell } from "@/components/notification-bell"
import { useTheme } from "@/components/theme-provider"
import { getDisplayName } from "@/lib/utils"

export function HeaderAuth() {
  const { user, loading } = useAuth()
  const { showToast } = useToast()
  const { profile } = useProfile()
  const { theme, toggleTheme } = useTheme()
  const [modalOpen, setModalOpen] = useState(false)
  const searchParams = useSearchParams()

  // ?auth=required 감지 → 로그인 모달 자동 열기
  useEffect(() => {
    if (searchParams.get("auth") === "required" && !user && !loading) {
      setModalOpen(true)
      showToast("로그인이 필요한 페이지입니다.", "info")
      // URL에서 쿼리 파라미터 제거
      window.history.replaceState({}, "", window.location.pathname)
    }
  }, [searchParams, user, loading])

  async function handleSignOut() {
    await supabase.auth.signOut()
    showToast("로그아웃 되었습니다.", "info")
  }

  // 테마 토글 버튼
  const themeButton = (
    <Button
      variant="outline"
      size="icon-sm"
      onClick={toggleTheme}
      className="border-white/15 bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-zinc-100"
      aria-label={theme === "dark" ? "라이트 모드" : "다크 모드"}
    >
      {theme === "dark" ? (
        <Sun className="size-3.5" />
      ) : (
        <Moon className="size-3.5" />
      )}
    </Button>
  )

  // 세션 로딩 중엔 아무것도 렌더링하지 않음 (레이아웃 깜빡임 방지)
  if (loading) {
    return (
      <div className="flex items-center gap-2">
        {themeButton}
        <div className="h-8 w-24 animate-pulse rounded-lg bg-white/5" />
      </div>
    )
  }

  if (user) {
    const displayLabel = profile?.displayName || getDisplayName(user.id)
    return (
      <div className="flex items-center gap-2">
        {themeButton}
        <NotificationBell />
        {/* 사용자 닉네임 pill → 마이페이지 링크 */}
        <Link
          href="/profile"
          className="inline-flex items-center gap-1.5 rounded-full border border-fuchsia-400/20 bg-fuchsia-400/10 px-3 py-1.5 transition hover:border-fuchsia-400/40 hover:bg-fuchsia-400/20"
        >
          <div className="grid size-4 place-items-center rounded-full bg-fuchsia-400/30 text-fuchsia-300">
            <User className="size-2.5" />
          </div>
          <span className="max-w-[100px] truncate text-xs text-fuchsia-200">
            {displayLabel}
          </span>
        </Link>

        {/* 로그아웃 버튼 */}
        <Button
          variant="outline"
          size="sm"
          onClick={handleSignOut}
          className="border-white/15 bg-white/5 text-xs text-zinc-400 hover:bg-white/10 hover:text-zinc-100"
        >
          <LogOut className="size-3.5" />
          로그아웃
        </Button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      {themeButton}
      <Button
        onClick={() => setModalOpen(true)}
        variant="outline"
        className="border-fuchsia-400/30 bg-fuchsia-400/10 text-fuchsia-200 hover:bg-fuchsia-400/20"
      >
        <LogIn className="size-4" />
        로그인
      </Button>

      <AuthModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  )
}
