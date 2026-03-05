"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { Bell, Bot, CheckCheck, Clock, Hash, MessageSquarePlus, MessageSquareText, Settings, Swords, ThumbsUp } from "lucide-react"

import { useAuth } from "@/components/auth-provider"
import { useNotifications } from "@/components/notification-provider"
import { timeAgo } from "@/lib/utils"

export function NotificationBell() {
  const { user } = useAuth()
  const { notifications, unreadCount, markRead, markAllRead } =
    useNotifications()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener("mousedown", onMouseDown)
    return () => document.removeEventListener("mousedown", onMouseDown)
  }, [open])

  if (!user) return null

  return (
    <div ref={ref} className="relative">
      {/* 벨 아이콘 버튼 */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`relative grid size-8 place-items-center rounded-lg border text-zinc-300 transition hover:bg-white/10 hover:text-zinc-100 ${
          unreadCount > 0
            ? "border-fuchsia-400/40 bg-fuchsia-500/10 bell-neon-pulse"
            : "border-white/10 bg-white/5"
        }`}
        aria-label="알림"
      >
        <Bell className={`size-4 ${unreadCount > 0 ? "text-fuchsia-300" : ""}`} />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 grid size-4 place-items-center rounded-full bg-fuchsia-500 text-[9px] font-bold text-white shadow-[0_0_8px_rgba(236,72,153,0.8)]">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* 드롭다운 패널 */}
      {open && (
        <div className="absolute right-0 top-10 z-50 w-80 rounded-2xl border border-white/10 bg-zinc-950/95 shadow-2xl backdrop-blur">
          {/* 헤더 */}
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <span className="text-sm font-semibold text-zinc-100">알림</span>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-zinc-200"
              >
                <CheckCheck className="size-3.5" />
                모두 읽기
              </button>
            )}
          </div>

          {/* 알림 목록 */}
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="py-10 text-center">
                <Bell className="mx-auto size-6 text-zinc-600" />
                <p className="mt-2 text-xs text-zinc-500">
                  아직 알림이 없어요
                </p>
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={`border-b border-white/[0.06] transition hover:bg-white/5 ${
                    !n.read ? "bg-fuchsia-500/[0.04]" : ""
                  }`}
                >
                  <Link
                    href={n.thread_id ? `/thread/${n.thread_id}` : "/"}
                    onClick={() => {
                      markRead(n.id)
                      setOpen(false)
                    }}
                    className="flex items-start gap-3 px-4 py-3"
                  >
                    {/* 타입 아이콘 */}
                    <div
                      className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-full ${
                        n.type === "comment"
                          ? "bg-cyan-400/15 text-cyan-300"
                          : n.type === "mention"
                            ? "bg-emerald-400/15 text-emerald-300"
                            : n.type === "tag_thread"
                              ? "bg-violet-400/15 text-violet-300"
                              : n.type === "duel"
                                ? "bg-amber-400/15 text-amber-300"
                                : n.type === "debate_request"
                                  ? "bg-emerald-400/15 text-emerald-300"
                                  : n.type === "ai_result"
                                    ? "bg-purple-400/15 text-purple-300"
                                    : n.type === "deadline"
                                      ? "bg-orange-400/15 text-orange-300"
                                      : "bg-fuchsia-400/15 text-fuchsia-300"
                      }`}
                    >
                      {n.type === "comment" ? (
                        <MessageSquareText className="size-3.5" />
                      ) : n.type === "mention" ? (
                        <MessageSquareText className="size-3.5" />
                      ) : n.type === "tag_thread" ? (
                        <Hash className="size-3.5" />
                      ) : n.type === "duel" ? (
                        <Swords className="size-3.5" />
                      ) : n.type === "debate_request" ? (
                        <MessageSquarePlus className="size-3.5" />
                      ) : n.type === "ai_result" ? (
                        <Bot className="size-3.5" />
                      ) : n.type === "deadline" ? (
                        <Clock className="size-3.5" />
                      ) : (
                        <ThumbsUp className="size-3.5" />
                      )}
                    </div>

                    {/* 텍스트 */}
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-zinc-200">{n.message}</p>
                      {n.thread_title && (
                        <p className="mt-0.5 truncate text-[11px] text-zinc-500">
                          &ldquo;{n.thread_title}&rdquo;
                        </p>
                      )}
                      <p className="mt-1 text-[10px] text-zinc-600">
                        {timeAgo(n.created_at)}
                      </p>
                    </div>

                    {/* 읽지 않음 도트 */}
                    {!n.read && (
                      <span className="mt-2 size-1.5 shrink-0 rounded-full bg-fuchsia-400 shadow-[0_0_4px_rgba(236,72,153,0.8)]" />
                    )}
                  </Link>
                </div>
              ))
            )}
          </div>

          {/* 알림 설정 링크 */}
          <Link
            href="/settings/notifications"
            onClick={() => setOpen(false)}
            className="flex items-center justify-center gap-1.5 border-t border-white/10 px-4 py-2.5 text-[11px] text-zinc-400 transition hover:bg-white/5 hover:text-zinc-200"
          >
            <Settings className="size-3.5" />
            알림 설정
          </Link>
        </div>
      )}
    </div>
  )
}
