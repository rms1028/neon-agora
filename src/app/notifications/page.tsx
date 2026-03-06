"use client"

import Link from "next/link"
import { ArrowLeft, Bell, BellOff } from "lucide-react"

import { useNotifications } from "@/components/notification-provider"
import { useAuth } from "@/components/auth-provider"
import { timeAgo } from "@/lib/utils"

export default function NotificationsPage() {
  const { user } = useAuth()
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications()

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-zinc-100">
        <div className="text-center">
          <Bell className="mx-auto mb-4 size-10 text-zinc-600" />
          <h2 className="mb-2 text-lg font-bold">로그인이 필요합니다</h2>
          <p className="mb-6 text-sm text-zinc-500">알림은 로그인 후 확인할 수 있어요.</p>
          <Link href="/" className="rounded-lg bg-white/10 px-4 py-2 text-sm text-zinc-200 transition hover:bg-white/15">
            홈으로
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-zinc-100">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(800px_circle_at_50%_10%,rgba(34,211,238,0.08),transparent_55%)]" />
      </div>

      <div className="relative mx-auto w-full max-w-2xl px-4 py-10 pb-24 sm:px-6">
        <nav className="mb-6 flex items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-200">
            <ArrowLeft className="size-4" />
            홈으로
          </Link>
          <span className="text-[11px] tracking-widest text-zinc-600">NOTIFICATIONS</span>
        </nav>

        <header className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="size-5 text-cyan-300" />
            <h1 className="text-xl font-bold text-zinc-50">알림</h1>
            {unreadCount > 0 && (
              <span className="rounded-full bg-cyan-400/15 px-2 py-0.5 text-[11px] font-bold text-cyan-300">
                {unreadCount}개 새 알림
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={markAllRead}
              className="whitespace-nowrap rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-zinc-400 transition hover:bg-white/10 hover:text-zinc-200"
            >
              모두 읽음
            </button>
          )}
        </header>

        {notifications.length === 0 ? (
          <div className="py-20 text-center">
            <BellOff className="mx-auto mb-4 size-10 text-zinc-700" />
            <p className="text-sm text-zinc-500">아직 알림이 없습니다</p>
            <p className="mt-1 text-xs text-zinc-600">토론에 참여하면 알림을 받을 수 있어요</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {notifications.map((n) => (
              <Link
                key={n.id}
                href={n.thread_id ? `/thread/${n.thread_id}` : "#"}
                onClick={() => { if (!n.read) markRead(n.id) }}
                className={`block rounded-xl border px-4 py-3 transition ${
                  n.read
                    ? "border-white/[0.04] bg-transparent"
                    : "border-cyan-400/15 bg-cyan-400/[0.03]"
                } hover:bg-white/[0.03]`}
              >
                <div className="flex items-start gap-3">
                  {!n.read && <div className="mt-1.5 size-2 shrink-0 rounded-full bg-cyan-400" />}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-zinc-200">{n.message}</p>
                    {n.thread_title && (
                      <p className="mt-0.5 truncate text-xs text-zinc-500">{n.thread_title}</p>
                    )}
                    <p className="mt-1 text-[11px] text-zinc-600" suppressHydrationWarning>
                      {timeAgo(n.created_at)}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
