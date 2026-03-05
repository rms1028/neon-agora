"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Radio, Send, Timer } from "lucide-react"

import { Button } from "@/components/ui/button"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/components/auth-provider"
import { useToast } from "@/components/toast-provider"
import { useProfile } from "@/components/profile-provider"

type LiveSession = {
  id: string
  started_at: string
  duration_minutes: number
  is_active: boolean
  ended_at: string | null
}

type LiveMessage = {
  id: string
  user_id: string
  content: string
  side: "pro" | "con"
  created_at: string
}

const DURATIONS = [5, 10, 15] as const

export function LiveDebatePanel({
  threadId,
  threadCreatedBy,
  isClosed,
}: {
  threadId: string
  threadCreatedBy: string
  isClosed?: boolean
}) {
  const { user } = useAuth()
  const { showToast } = useToast()
  const { awardXp } = useProfile()

  const [session, setSession] = useState<LiveSession | null>(null)
  const [messages, setMessages] = useState<LiveMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)
  const [sending, setSending] = useState(false)
  const [selectedDuration, setSelectedDuration] = useState<number>(5)
  const [side, setSide] = useState<"pro" | "con">("pro")
  const [content, setContent] = useState("")
  const [timeLeft, setTimeLeft] = useState<string>("")
  const [isExpired, setIsExpired] = useState(false)
  const [myMsgCount, setMyMsgCount] = useState(0)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const isCreator = user?.id === threadCreatedBy

  // 세션 로드
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data, error } = await supabase
        .from("live_sessions")
        .select("*")
        .eq("thread_id", threadId)
        .maybeSingle()
      if (cancelled) return
      if (error && error.code !== "42P01" && error.code !== "PGRST205") {
        console.error("[Live]", error.code)
      }
      if (data) {
        setSession(data as LiveSession)
        // 메시지 로드
        const { data: msgs } = await supabase
          .from("live_messages")
          .select("*")
          .eq("session_id", data.id)
          .order("created_at", { ascending: true })
        if (!cancelled) {
          setMessages((msgs ?? []) as LiveMessage[])
          if (user) {
            setMyMsgCount((msgs ?? []).filter((m: Record<string, unknown>) => m.user_id === user.id).length)
          }
        }
      }
      if (!cancelled) setLoading(false)
    })()
    return () => { cancelled = true }
  }, [threadId, user?.id])

  // 타이머
  useEffect(() => {
    if (!session || !session.is_active) return
    const endTime = new Date(session.started_at).getTime() + session.duration_minutes * 60 * 1000

    const tick = () => {
      const diff = endTime - Date.now()
      if (diff <= 0) {
        setTimeLeft("00:00")
        setIsExpired(true)
        return
      }
      const mins = Math.floor(diff / 60000)
      const secs = Math.floor((diff % 60000) / 1000)
      setTimeLeft(`${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`)
    }

    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [session])

  // 실시간 메시지 구독
  useEffect(() => {
    if (!session) return
    const channel = supabase
      .channel(`live-msgs-${session.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "live_messages",
          filter: `session_id=eq.${session.id}`,
        },
        (payload) => {
          const msg = payload.new as LiveMessage
          setMessages((prev) => {
            if (prev.some((m) => m.id === msg.id)) return prev
            return [...prev, msg]
          })
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [session?.id])

  // 실시간 세션 상태 구독
  useEffect(() => {
    const channel = supabase
      .channel(`live-session-${threadId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "live_sessions",
          filter: `thread_id=eq.${threadId}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
            setSession(payload.new as LiveSession)
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [threadId])

  // 자동 스크롤
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const handleStart = useCallback(async () => {
    if (!user) return
    setStarting(true)
    const { error } = await supabase.from("live_sessions").insert({
      thread_id: threadId,
      started_by: user.id,
      duration_minutes: selectedDuration,
    })
    setStarting(false)
    if (error) {
      if (error.code === "42P01" || error.code === "PGRST205") {
        showToast("라이브 세션 테이블이 아직 생성되지 않았습니다.", "error")
      } else if (error.code === "23505") {
        showToast("이미 라이브 세션이 존재합니다.", "info")
      } else {
        showToast("라이브 시작에 실패했습니다.", "error")
      }
    }
  }, [user, threadId, selectedDuration, showToast])

  const handleSend = useCallback(async () => {
    if (!user || !session || !content.trim()) return
    if (isExpired || !session.is_active) return
    if (myMsgCount >= 10) {
      showToast("세션당 최대 10개까지 메시지를 보낼 수 있습니다.", "info")
      return
    }

    setSending(true)
    const { error } = await supabase.from("live_messages").insert({
      session_id: session.id,
      user_id: user.id,
      content: content.trim(),
      side,
    })
    setSending(false)

    if (error) {
      showToast("메시지 전송에 실패했습니다.", "error")
      return
    }

    setContent("")
    setMyMsgCount((c) => c + 1)
    awardXp("live_message")
  }, [user, session, content, side, isExpired, myMsgCount, showToast, awardXp])

  if (isClosed) return null
  if (loading) {
    return (
      <div className="rounded-2xl border border-white/10 bg-black/30 p-6 backdrop-blur">
        <div className="flex items-center gap-2 text-sm text-zinc-500">
          <div className="size-4 animate-spin rounded-full border-2 border-zinc-600 border-t-cyan-400" />
          라이브 세션 확인 중...
        </div>
      </div>
    )
  }

  // 세션 없음 — 창작자만 시작 가능
  if (!session) {
    if (!isCreator) return null
    return (
      <div className="rounded-2xl border border-white/10 bg-black/30 p-5 backdrop-blur">
        <div className="flex items-center gap-3">
          <div
            className="grid size-10 shrink-0 place-items-center rounded-xl border border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
            style={{ boxShadow: "0 0 16px rgba(52,211,153,0.3)" }}
          >
            <Radio className="size-5" />
          </div>
          <div className="flex-1">
            <div className="text-sm font-semibold text-zinc-100">라이브 디베이트</div>
            <div className="mt-0.5 text-xs text-zinc-500">
              실시간 토론 세션을 시작하세요. 제한 시간 내 찬반 메시지를 주고받습니다.
            </div>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-black/40 p-1">
            {DURATIONS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setSelectedDuration(d)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                  selectedDuration === d
                    ? "bg-emerald-400/20 text-emerald-200 ring-1 ring-emerald-400/40"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {d}분
              </button>
            ))}
          </div>
          <Button
            onClick={handleStart}
            disabled={starting}
            className="bg-gradient-to-r from-emerald-400 to-cyan-400 font-semibold text-black shadow-[0_0_20px_rgba(52,211,153,0.4)] hover:from-emerald-300 hover:to-cyan-300"
          >
            <Radio className="size-4" />
            {starting ? "시작 중…" : "라이브 시작"}
          </Button>
        </div>
      </div>
    )
  }

  // 세션 종료 / 만료
  const sessionEnded = !session.is_active || isExpired

  return (
    <div
      className={`rounded-2xl border p-5 backdrop-blur ${
        sessionEnded
          ? "border-white/10 bg-black/30"
          : "border-emerald-400/30 bg-black/30 shadow-[0_0_40px_rgba(52,211,153,0.1)]"
      }`}
    >
      {/* 헤더 */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div
            className={`grid size-8 place-items-center rounded-lg border ${
              sessionEnded
                ? "border-zinc-600 bg-zinc-800/50 text-zinc-500"
                : "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
            }`}
          >
            <Radio className="size-4" />
          </div>
          <div>
            <div className="text-sm font-semibold text-zinc-100">
              라이브 디베이트
            </div>
            <div className="text-[10px] tracking-widest text-zinc-600">
              {sessionEnded ? "SESSION ENDED" : "LIVE NOW"}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!sessionEnded && (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
              <span className="size-1.5 animate-pulse rounded-full bg-emerald-400" />
              LIVE
            </span>
          )}
          <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-mono text-zinc-300">
            <Timer className="size-3.5" />
            {timeLeft || `${session.duration_minutes}:00`}
          </span>
        </div>
      </div>

      {sessionEnded && (
        <div className="mb-3 rounded-xl border border-zinc-600/30 bg-zinc-800/30 px-3 py-2 text-center text-xs text-zinc-500">
          라이브 세션이 종료되었습니다
        </div>
      )}

      {/* 메시지 영역 */}
      <div className="max-h-96 space-y-2 overflow-y-auto rounded-xl border border-white/[0.06] bg-black/40 p-3">
        {messages.length === 0 ? (
          <div className="py-8 text-center text-xs text-zinc-600">
            {sessionEnded ? "메시지가 없습니다" : "첫 번째 메시지를 보내보세요!"}
          </div>
        ) : (
          messages.map((msg) => {
            const isPro = msg.side === "pro"
            const short = msg.user_id.replace(/-/g, "").slice(0, 5)
            return (
              <div
                key={msg.id}
                className={`rounded-xl border px-3 py-2 ${
                  isPro
                    ? "border-cyan-400/20 bg-cyan-400/5"
                    : "border-fuchsia-400/20 bg-fuchsia-400/5"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[10px] font-semibold ${
                      isPro ? "text-cyan-300" : "text-fuchsia-300"
                    }`}
                  >
                    {isPro ? "찬성" : "반대"}
                  </span>
                  <span className="text-[10px] text-zinc-500">
                    유저 {short}
                  </span>
                </div>
                <div className="mt-1 text-sm text-zinc-200">{msg.content}</div>
              </div>
            )
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 입력 영역 */}
      {!sessionEnded && user && (
        <div className="mt-3 space-y-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSide("pro")}
              className={`flex-1 rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                side === "pro"
                  ? "border-cyan-400/50 bg-cyan-400/15 text-cyan-100"
                  : "border-white/10 bg-white/5 text-zinc-400"
              }`}
            >
              찬성
            </button>
            <button
              type="button"
              onClick={() => setSide("con")}
              className={`flex-1 rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                side === "con"
                  ? "border-fuchsia-400/50 bg-fuchsia-400/15 text-fuchsia-100"
                  : "border-white/10 bg-white/5 text-zinc-400"
              }`}
            >
              반대
            </button>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={content}
              onChange={(e) => setContent(e.target.value.slice(0, 300))}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  handleSend()
                }
              }}
              placeholder={`${side === "pro" ? "찬성" : "반대"} 의견을 입력하세요… (${myMsgCount}/10)`}
              disabled={sending}
              className="flex-1 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none disabled:opacity-60"
            />
            <Button
              onClick={handleSend}
              disabled={sending || !content.trim()}
              size="icon-sm"
              className="bg-gradient-to-r from-emerald-400 to-cyan-400 text-black"
            >
              <Send className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
