"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Radio, Timer } from "lucide-react"

import { supabase } from "@/lib/supabase"

export interface LiveSession {
  id: string
  thread_id: string
  thread_title: string
  thread_tag: string | null
  duration_minutes: number
  created_at: string
  is_active: boolean
}

function useCountdown(createdAt: string, durationMinutes: number) {
  const [remaining, setRemaining] = useState(() => {
    const end = new Date(createdAt).getTime() + durationMinutes * 60_000
    return Math.max(0, Math.floor((end - Date.now()) / 1000))
  })

  useEffect(() => {
    if (remaining <= 0) return
    const id = setInterval(() => {
      const end = new Date(createdAt).getTime() + durationMinutes * 60_000
      const left = Math.max(0, Math.floor((end - Date.now()) / 1000))
      setRemaining(left)
      if (left <= 0) clearInterval(id)
    }, 1000)
    return () => clearInterval(id)
  }, [createdAt, durationMinutes, remaining])

  const m = Math.floor(remaining / 60)
  const s = remaining % 60
  return `${m}:${s.toString().padStart(2, "0")}`
}

function LiveSessionCard({ session }: { session: LiveSession }) {
  const countdown = useCountdown(session.created_at, session.duration_minutes)

  return (
    <Link
      href={`/thread/${session.thread_id}`}
      className="group flex items-center gap-2 rounded-lg border border-red-400/15 bg-red-400/5 px-2.5 py-1.5 transition hover:border-red-400/30 hover:bg-red-400/10"
    >
      <span className="relative flex size-1.5 shrink-0">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-red-400 opacity-75" />
        <span className="relative inline-flex size-1.5 rounded-full bg-red-400" />
      </span>
      <p className="min-w-0 flex-1 truncate text-[11px] font-medium text-zinc-300 group-hover:text-white">
        {session.thread_title}
      </p>
      <span className="inline-flex shrink-0 items-center gap-0.5 text-[10px] font-semibold tabular-nums text-red-300">
        <Timer className="size-2.5" />
        {countdown}
      </span>
    </Link>
  )
}

export function LiveSessionsSidebar({
  initialSessions,
}: {
  initialSessions: LiveSession[]
}) {
  const [sessions, setSessions] = useState(initialSessions)

  useEffect(() => {
    const channel = supabase
      .channel("live_sessions_sidebar")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "live_sessions" },
        async () => {
          const { data } = await supabase
            .from("live_sessions")
            .select("id, thread_id, duration_minutes, created_at, is_active, threads(title, tag)")
            .eq("is_active", true)
            .order("created_at", { ascending: false })
            .limit(8)

          if (data) {
            const mapped: LiveSession[] = data.map((s: Record<string, unknown>) => {
              const thread = s.threads as Record<string, unknown> | null
              return {
                id: String(s.id),
                thread_id: String(s.thread_id),
                thread_title: thread ? String(thread.title ?? "") : "",
                thread_tag: thread ? (thread.tag as string | null) : null,
                duration_minutes: Number(s.duration_minutes),
                created_at: String(s.created_at),
                is_active: true,
              }
            })
            setSessions(mapped)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  return (
    <div className="rounded-xl border border-white/[0.08] bg-black/30 p-3 backdrop-blur">
      <div className="mb-2 flex items-center gap-2">
        <Radio className="size-3.5 text-red-400" />
        <span className="text-[10px] font-semibold tracking-widest text-zinc-500">
          LIVE NOW
        </span>
        {sessions.length > 0 && (
          <span className="rounded-full bg-red-400/20 px-1.5 py-0.5 text-[10px] font-bold text-red-300">
            {sessions.length}
          </span>
        )}
      </div>

      {sessions.length === 0 ? (
        <p className="rounded-lg border border-white/5 bg-white/[0.02] px-3 py-3 text-center text-[11px] text-zinc-500">
          진행 중인 라이브 없음
        </p>
      ) : (
        <div className="space-y-1">
          {sessions.slice(0, 8).map((s) => (
            <LiveSessionCard key={s.id} session={s} />
          ))}
        </div>
      )}
    </div>
  )
}
