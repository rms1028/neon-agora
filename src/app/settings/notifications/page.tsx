"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Bell } from "lucide-react"

import { supabase } from "@/lib/supabase"
import { useAuth } from "@/components/auth-provider"
import { useToast } from "@/components/toast-provider"

type Settings = {
  comment_enabled: boolean
  vote_enabled: boolean
  mention_enabled: boolean
  tag_enabled: boolean
  duel_enabled: boolean
}

const DEFAULTS: Settings = {
  comment_enabled: true,
  vote_enabled: true,
  mention_enabled: true,
  tag_enabled: true,
  duel_enabled: true,
}

const LABELS: { key: keyof Settings; label: string; desc: string }[] = [
  { key: "comment_enabled", label: "댓글 알림", desc: "내 토론에 새 댓글이 달릴 때" },
  { key: "vote_enabled", label: "투표 알림", desc: "내 토론에 투표가 들어올 때" },
  { key: "mention_enabled", label: "멘션 알림", desc: "누군가 나를 @멘션할 때" },
  { key: "tag_enabled", label: "태그 알림", desc: "구독 카테고리에 새 토론이 열릴 때" },
  { key: "duel_enabled", label: "대결 알림", desc: "대결 신청을 받거나 결과가 나올 때" },
]

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
        checked ? "bg-cyan-400" : "bg-zinc-700"
      }`}
    >
      <span
        className={`pointer-events-none inline-block size-5 rounded-full bg-white shadow-lg transition-transform ${
          checked ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  )
}

export default function NotificationSettingsPage() {
  const { user, loading: authLoading } = useAuth()
  const { showToast } = useToast()
  const [settings, setSettings] = useState<Settings>(DEFAULTS)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (authLoading || !user) return
    let cancelled = false
    ;(async () => {
      const { data } = await supabase
        .from("notification_settings")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle()
      if (cancelled) return
      if (data) {
        setSettings({
          comment_enabled: data.comment_enabled ?? true,
          vote_enabled: data.vote_enabled ?? true,
          mention_enabled: data.mention_enabled ?? true,
          tag_enabled: data.tag_enabled ?? true,
          duel_enabled: data.duel_enabled ?? true,
        })
      }
      setLoaded(true)
    })()
    return () => { cancelled = true }
  }, [user?.id, authLoading])

  const handleToggle = useCallback(
    async (key: keyof Settings, value: boolean) => {
      if (!user) return
      setSettings((prev) => ({ ...prev, [key]: value }))

      const { error } = await supabase
        .from("notification_settings")
        .upsert({ user_id: user.id, [key]: value }, { onConflict: "user_id" })

      if (error) {
        setSettings((prev) => ({ ...prev, [key]: !value }))
        showToast("설정 저장에 실패했습니다.", "error")
      }
    },
    [user, showToast]
  )

  if (authLoading) return null

  if (!user) {
    return (
      <div className="min-h-screen bg-black text-zinc-100">
        <div className="mx-auto max-w-lg px-4 py-20 text-center">
          <Bell className="mx-auto size-8 text-zinc-600" />
          <p className="mt-4 text-sm text-zinc-400">로그인이 필요합니다.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-zinc-100">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(1200px_circle_at_30%_10%,rgba(34,211,238,0.12),transparent_55%)]" />
      </div>

      <div className="relative mx-auto w-full max-w-lg px-4 py-10 sm:px-6">
        <nav className="mb-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-200"
          >
            <ArrowLeft className="size-4" />
            돌아가기
          </Link>
        </nav>

        <header className="mb-8 flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-xl border border-cyan-400/30 bg-cyan-400/10 text-cyan-300">
            <Bell className="size-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-zinc-50">알림 설정</h1>
            <p className="text-xs text-zinc-500">
              받고 싶은 알림을 선택하세요
            </p>
          </div>
        </header>

        <div className="space-y-1">
          {LABELS.map((item) => (
            <div
              key={item.key}
              className="flex items-center justify-between rounded-2xl border border-white/[0.08] bg-black/30 px-5 py-4 backdrop-blur"
            >
              <div>
                <div className="text-sm font-medium text-zinc-100">
                  {item.label}
                </div>
                <div className="mt-0.5 text-xs text-zinc-500">{item.desc}</div>
              </div>
              {loaded ? (
                <Toggle
                  checked={settings[item.key]}
                  onChange={(v) => handleToggle(item.key, v)}
                />
              ) : (
                <div className="h-6 w-11 animate-pulse rounded-full bg-zinc-800" />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
