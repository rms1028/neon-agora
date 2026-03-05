"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react"

import { supabase } from "@/lib/supabase"
import { useAuth } from "@/components/auth-provider"
import { useToast } from "@/components/toast-provider"

export type AppNotification = {
  id: string
  type: "comment" | "vote" | "mention" | "tag_thread" | "duel" | "debate_request" | "ai_result" | "deadline"
  thread_id: string | null
  thread_title: string
  message: string
  read: boolean
  created_at: string
}

type NotificationContextValue = {
  notifications: AppNotification[]
  unreadCount: number
  markRead: (id: string) => Promise<void>
  markAllRead: () => Promise<void>
}

const NotificationContext = createContext<NotificationContextValue>({
  notifications: [],
  unreadCount: 0,
  markRead: async () => {},
  markAllRead: async () => {},
})

export function useNotifications() {
  return useContext(NotificationContext)
}

export function NotificationProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, loading } = useAuth()
  const { showToast } = useToast()
  const [notifications, setNotifications] = useState<AppNotification[]>([])

  // 알림 설정 (타입→활성화 매핑)
  type NotifSettings = Record<string, boolean>
  const settingsRef = useRef<NotifSettings | null>(null)
  const mutedThreadIdsRef = useRef<Set<string>>(new Set())

  const TYPE_TO_SETTING: Record<string, string> = {
    comment: "comment_enabled",
    vote: "vote_enabled",
    mention: "mention_enabled",
    tag_thread: "tag_enabled",
    duel: "duel_enabled",
  }

  function isAllowed(n: AppNotification): boolean {
    const s = settingsRef.current
    if (!s) {
      // 설정 없으면 기본 전부 허용, 뮤트만 체크
    } else {
      const key = TYPE_TO_SETTING[n.type]
      if (key && s[key] === false) return false
    }
    // 뮤트된 스레드 알림 필터
    if (n.thread_id && mutedThreadIdsRef.current.has(n.thread_id)) return false
    return true
  }

  useEffect(() => {
    if (loading || !user) {
      setNotifications([])
      settingsRef.current = null
      return
    }

    let cancelled = false

    async function load() {
      // 알림 설정 + 알림 목록 + 뮤트 스레드 병렬 로드
      const [{ data: settingsData }, { data }, { data: mutesData }] = await Promise.all([
        supabase
          .from("notification_settings")
          .select("*")
          .eq("user_id", user!.id)
          .maybeSingle(),
        supabase
          .from("notifications")
          .select("*")
          .eq("user_id", user!.id)
          .order("created_at", { ascending: false })
          .limit(20),
        supabase
          .from("thread_mutes")
          .select("thread_id")
          .eq("user_id", user!.id),
      ])

      if (cancelled) return

      if (settingsData) {
        settingsRef.current = settingsData as unknown as NotifSettings
      }

      mutedThreadIdsRef.current = new Set(
        (mutesData ?? []).map((r) => String((r as Record<string, unknown>).thread_id ?? "")).filter(Boolean)
      )

      const all = (data ?? []) as AppNotification[]
      setNotifications(all.filter(isAllowed))
    }

    load()

    const channel = supabase
      .channel(`notifications-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const n = payload.new as AppNotification
          if (!isAllowed(n)) return
          setNotifications((prev) =>
            [n, ...prev].slice(0, 20)
          )
          // 실시간 토스트 알림
          showToast(n.message || "새 알림이 도착했습니다.", "info")
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          setNotifications((prev) =>
            prev.map((n) =>
              n.id === (payload.new as AppNotification).id
                ? (payload.new as AppNotification)
                : n
            )
          )
        }
      )
      .subscribe()

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [user?.id, loading])

  const markRead = useCallback(async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    )
    await supabase.from("notifications").update({ read: true }).eq("id", id)
  }, [])

  const markAllRead = useCallback(async () => {
    if (!user) return
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    await supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_id", user.id)
      .eq("read", false)
  }, [user])

  const unreadCount = notifications.filter((n) => !n.read).length

  return (
    <NotificationContext.Provider
      value={{ notifications, unreadCount, markRead, markAllRead }}
    >
      {children}
    </NotificationContext.Provider>
  )
}
