"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { AlertTriangle, ArrowLeft, Bookmark, Save, ShieldCheck, User } from "lucide-react"

import { supabase } from "@/lib/supabase"
import { useAuth } from "@/components/auth-provider"
import { useToast } from "@/components/toast-provider"
import { useProfile } from "@/components/profile-provider"
import { AvatarUpload } from "@/components/avatar-upload"

export default function ProfileSettingsPage() {
  const { user, loading: authLoading } = useAuth()
  const { showToast } = useToast()
  const { refreshDisplayName } = useProfile()
  const [displayName, setDisplayName] = useState("")
  const [bio, setBio] = useState("")
  const [avatarUrl, setAvatarUrl] = useState("")
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (authLoading || !user) return
    let cancelled = false
    ;(async () => {
      const { data } = await supabase
        .from("profiles")
        .select("display_name, bio, avatar_url")
        .eq("id", user.id)
        .maybeSingle()
      if (cancelled) return
      if (data) {
        setDisplayName(data.display_name ?? "")
        setBio(data.bio ?? "")
        setAvatarUrl(data.avatar_url ?? "")
      }
      setLoaded(true)
    })()
    return () => { cancelled = true }
  }, [user?.id, authLoading])

  const handleSave = useCallback(async () => {
    if (!user) return
    const trimmedName = displayName.trim()
    if (trimmedName.length > 20) {
      showToast("닉네임은 20자 이하로 입력해주세요.", "error")
      return
    }
    if (bio.length > 200) {
      showToast("자기소개는 200자 이하로 입력해주세요.", "error")
      return
    }

    setSaving(true)
    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: trimmedName || null,
        bio: bio.trim() || null,
        avatar_url: avatarUrl.trim() || null,
      })
      .eq("id", user.id)

    setSaving(false)
    if (error) {
      showToast("저장에 실패했습니다.", "error")
      return
    }
    refreshDisplayName(trimmedName || null)
    showToast("프로필이 저장되었습니다!", "success")
  }, [user, displayName, bio, avatarUrl, showToast, refreshDisplayName])

  if (authLoading) return null

  if (!user) {
    return (
      <div className="min-h-screen bg-black text-zinc-100">
        <div className="mx-auto max-w-lg px-4 py-20 text-center">
          <User className="mx-auto size-8 text-zinc-600" />
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
            href="/profile"
            className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-200"
          >
            <ArrowLeft className="size-4" />
            프로필로 돌아가기
          </Link>
        </nav>

        <header className="mb-8 flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-xl border border-fuchsia-400/30 bg-fuchsia-400/10 text-fuchsia-300">
            <User className="size-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-zinc-50">프로필 수정</h1>
            <p className="text-xs text-zinc-500">닉네임과 소개를 설정하세요</p>
          </div>
        </header>

        <div className="space-y-5">
          {/* 닉네임 */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-zinc-400">
              닉네임 <span className="text-zinc-600">({displayName.length}/20)</span>
            </label>
            {loaded ? (
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={20}
                placeholder="표시될 이름을 입력하세요"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 transition focus:border-fuchsia-400/40 focus:outline-none focus:ring-1 focus:ring-fuchsia-400/30"
              />
            ) : (
              <div className="h-11 w-full animate-pulse rounded-xl bg-zinc-800" />
            )}
          </div>

          {/* 자기소개 */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-zinc-400">
              자기소개 <span className="text-zinc-600">({bio.length}/200)</span>
            </label>
            {loaded ? (
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                maxLength={200}
                rows={3}
                placeholder="자신을 소개해보세요"
                className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 transition focus:border-fuchsia-400/40 focus:outline-none focus:ring-1 focus:ring-fuchsia-400/30"
              />
            ) : (
              <div className="h-20 w-full animate-pulse rounded-xl bg-zinc-800" />
            )}
          </div>

          {/* 아바타 */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-zinc-400">
              아바타 <span className="text-zinc-600">(선택)</span>
            </label>
            {loaded ? (
              <AvatarUpload
                userId={user.id}
                currentUrl={avatarUrl}
                onUploaded={(url) => setAvatarUrl(url)}
              />
            ) : (
              <div className="flex items-center gap-5">
                <div className="size-24 animate-pulse rounded-full bg-zinc-800" />
              </div>
            )}
          </div>

          {/* 저장 버튼 */}
          <button
            onClick={handleSave}
            disabled={saving || !loaded}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-fuchsia-500 py-3 text-sm font-medium text-white shadow-[0_0_20px_rgba(236,72,153,0.3)] transition hover:bg-fuchsia-600 disabled:opacity-50"
          >
            <Save className="size-4" />
            {saving ? "저장 중…" : "저장"}
          </button>

          {/* 보안 설정 링크 */}
          <Link
            href="/settings/security"
            className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 py-3 text-sm font-medium text-zinc-400 transition hover:bg-white/10 hover:text-zinc-200"
          >
            <ShieldCheck className="size-4" />
            보안 설정 (비밀번호 변경)
          </Link>

          {/* 내 북마크 링크 */}
          <Link
            href="/bookmarks"
            className="flex items-center justify-center gap-2 rounded-xl border border-cyan-400/20 bg-cyan-400/10 py-3 text-sm font-medium text-cyan-300 transition hover:bg-cyan-400/20"
          >
            <Bookmark className="size-4" />
            내 북마크
          </Link>

          {/* 계정 삭제 링크 */}
          <Link
            href="/settings/account"
            className="flex items-center justify-center gap-2 rounded-xl border border-red-500/20 bg-red-500/5 py-3 text-sm font-medium text-red-400 transition hover:bg-red-500/10"
          >
            <AlertTriangle className="size-4" />
            계정 삭제
          </Link>
        </div>
      </div>
    </div>
  )
}
