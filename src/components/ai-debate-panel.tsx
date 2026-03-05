"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Bot, Send } from "lucide-react"

import { Button } from "@/components/ui/button"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/components/auth-provider"
import { useToast } from "@/components/toast-provider"
import { useProfile } from "@/components/profile-provider"

type Message = {
  role: "user" | "ai"
  content: string
  turn: number
}

type State = "idle" | "chatting"

const MAX_TURNS = 5

export function AIDebatePanel({
  threadId,
  threadTitle,
}: {
  threadId: string
  threadTitle: string
}) {
  const { user } = useAuth()
  const { showToast } = useToast()
  const { profile } = useProfile()

  const [state, setState] = useState<State>("idle")
  const [side, setSide] = useState<"pro" | "con" | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [sending, setSending] = useState(false)
  const [turn, setTurn] = useState(1)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const xp = profile?.xp ?? 0
  const canStart = Boolean(user) && xp >= 30

  // 기존 대화 로드
  useEffect(() => {
    if (!user) return
    let cancelled = false
    ;(async () => {
      const { data } = await supabase
        .from("ai_debate_messages")
        .select("user_side, user_message, ai_message, turn_number")
        .eq("thread_id", threadId)
        .eq("user_id", user.id)
        .order("turn_number", { ascending: true })

      if (cancelled || !data || data.length === 0) return

      const msgs: Message[] = []
      let lastTurn = 0
      let lastSide: "pro" | "con" = "pro"
      for (const row of data) {
        const r = row as Record<string, unknown>
        const tn = Number(r.turn_number) || 0
        lastSide = r.user_side === "con" ? "con" : "pro"
        msgs.push({ role: "user", content: String(r.user_message ?? ""), turn: tn })
        msgs.push({ role: "ai", content: String(r.ai_message ?? ""), turn: tn })
        lastTurn = tn
      }

      setMessages(msgs)
      setSide(lastSide)
      setTurn(lastTurn + 1)
      setState("chatting")
    })()
    return () => { cancelled = true }
  }, [threadId, user?.id])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const handleSend = useCallback(async () => {
    if (!user || !side || !input.trim() || sending || turn > MAX_TURNS) return

    const userMsg = input.trim().slice(0, 500)
    setSending(true)
    setInput("")

    // 낙관적 사용자 메시지 추가
    setMessages((prev) => [...prev, { role: "user", content: userMsg, turn }])

    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) {
      showToast("로그인 세션이 만료되었습니다.", "error")
      setSending(false)
      return
    }

    const res = await fetch("/api/ai-debate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        threadId,
        userMessage: userMsg,
        userSide: side,
        turnNumber: turn,
      }),
    })

    if (!res.ok) {
      const json = await res.json().catch(() => ({})) as { error?: string }
      showToast(json.error ?? "AI 응답에 실패했습니다.", "error")
      // 실패 시 낙관적 유저 메시지 롤백
      setMessages((prev) => prev.filter((_, i) => i !== prev.length - 1))
      setSending(false)
      return
    }

    const data = await res.json() as Record<string, unknown>
    const aiMsg = typeof data.aiMessage === "string" ? data.aiMessage : ""
    if (!aiMsg) {
      showToast("AI 응답이 비어 있습니다.", "error")
      setSending(false)
      return
    }

    setMessages((prev) => [...prev, { role: "ai", content: aiMsg, turn }])
    setTurn((t) => t + 1)
    setSending(false)
  }, [user, side, input, sending, turn, threadId, showToast])

  // idle — 사이드 선택
  if (state === "idle") {
    return (
      <div className="rounded-2xl border border-white/[0.08] bg-black/30 p-5 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-xl border border-violet-400/30 bg-violet-400/10 text-violet-300">
            <Bot className="size-5" />
          </div>
          <div className="flex-1">
            <div className="text-sm font-semibold text-zinc-100">AI 토론 상대</div>
            <div className="mt-0.5 text-xs text-zinc-500">
              {!user
                ? "로그인 후 이용할 수 있습니다."
                : !canStart
                  ? `30 XP 이상부터 이용 가능 (현재 ${xp} XP)`
                  : "AI와 5턴 토론을 해보세요. 입장을 선택하면 AI가 반대편이 됩니다."}
            </div>
          </div>
        </div>

        {canStart && (
          <div className="mt-4 flex items-center gap-2">
            <button
              type="button"
              onClick={() => { setSide("pro"); setState("chatting") }}
              className="flex-1 rounded-xl border border-cyan-400/30 bg-cyan-400/10 py-3 text-sm font-semibold text-cyan-200 transition hover:bg-cyan-400/20"
            >
              찬성으로 시작
            </button>
            <button
              type="button"
              onClick={() => { setSide("con"); setState("chatting") }}
              className="flex-1 rounded-xl border border-fuchsia-400/30 bg-fuchsia-400/10 py-3 text-sm font-semibold text-fuchsia-200 transition hover:bg-fuchsia-400/20"
            >
              반대로 시작
            </button>
          </div>
        )}
      </div>
    )
  }

  // chatting
  const aiSide = side === "pro" ? "반대" : "찬성"
  const userSide = side === "pro" ? "찬성" : "반대"
  const finished = turn > MAX_TURNS

  return (
    <div className="rounded-2xl border border-violet-400/20 bg-black/30 p-5 backdrop-blur">
      {/* 헤더 */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="grid size-8 place-items-center rounded-lg border border-violet-400/30 bg-violet-400/10 text-violet-300">
            <Bot className="size-4" />
          </div>
          <div>
            <div className="text-sm font-semibold text-zinc-100">AI 토론 상대</div>
            <div className="text-[10px] text-zinc-500">
              {userSide} vs AI({aiSide}) · 턴 {Math.min(turn, MAX_TURNS)}/{MAX_TURNS}
            </div>
          </div>
        </div>

        {/* 턴 인디케이터 */}
        <div className="flex items-center gap-1">
          {Array.from({ length: MAX_TURNS }).map((_, i) => (
            <div
              key={i}
              className={`size-2 rounded-full transition ${
                i < turn - 1
                  ? "bg-violet-400"
                  : i === turn - 1
                    ? "bg-violet-400/50"
                    : "bg-white/10"
              }`}
            />
          ))}
        </div>
      </div>

      {/* 메시지 영역 */}
      <div className="max-h-80 space-y-2 overflow-y-auto rounded-xl border border-white/[0.06] bg-black/40 p-3">
        {messages.length === 0 ? (
          <div className="py-6 text-center text-xs text-zinc-600">
            {userSide} 입장에서 첫 의견을 보내보세요!
          </div>
        ) : (
          messages.map((msg, i) => (
            <div
              key={i}
              className={`ai-debate-message-enter rounded-xl border px-3 py-2 ${
                msg.role === "user"
                  ? side === "pro"
                    ? "border-cyan-400/20 bg-cyan-400/5 ml-8"
                    : "border-fuchsia-400/20 bg-fuchsia-400/5 ml-8"
                  : "border-violet-400/20 bg-violet-400/5 mr-8"
              }`}
            >
              <div className="flex items-center gap-1.5 text-[10px]">
                {msg.role === "ai" && <Bot className="size-3 text-violet-300" />}
                <span className={msg.role === "user" ? (side === "pro" ? "text-cyan-300" : "text-fuchsia-300") : "text-violet-300"}>
                  {msg.role === "user" ? userSide : `AI (${aiSide})`}
                </span>
                <span className="text-zinc-600">턴 {msg.turn}</span>
              </div>
              <div className="mt-1 text-sm text-zinc-200">{msg.content}</div>
            </div>
          ))
        )}

        {/* 타이핑 인디케이터 */}
        {sending && (
          <div className="flex items-center gap-1.5 rounded-xl border border-violet-400/20 bg-violet-400/5 px-3 py-2 mr-8">
            <Bot className="size-3 text-violet-300" />
            <div className="flex items-center gap-1">
              <span className="ai-typing-dot inline-block size-1.5 rounded-full bg-violet-400" style={{ animationDelay: "0s" }} />
              <span className="ai-typing-dot inline-block size-1.5 rounded-full bg-violet-400" style={{ animationDelay: "0.2s" }} />
              <span className="ai-typing-dot inline-block size-1.5 rounded-full bg-violet-400" style={{ animationDelay: "0.4s" }} />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 입력 */}
      {finished ? (
        <div className="mt-3 rounded-xl border border-violet-400/20 bg-violet-400/5 p-3 text-center text-xs text-violet-200">
          5턴 토론이 완료되었습니다!
        </div>
      ) : (
        <div className="mt-3 flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value.slice(0, 500))}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                handleSend()
              }
            }}
            placeholder={`${userSide} 의견을 입력하세요… (턴 ${turn}/${MAX_TURNS})`}
            disabled={sending}
            className="flex-1 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none disabled:opacity-60"
          />
          <Button
            onClick={handleSend}
            disabled={sending || !input.trim()}
            size="icon-sm"
            className="bg-gradient-to-r from-violet-400 to-fuchsia-400 text-black"
          >
            <Send className="size-4" />
          </Button>
        </div>
      )}
    </div>
  )
}
