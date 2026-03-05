"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Pause, Play, RotateCcw } from "lucide-react"

import { Button } from "@/components/ui/button"
import { supabase } from "@/lib/supabase"

type ReplayEvent = {
  type: "vote" | "comment"
  side: "pro" | "con"
  time: string
  content?: string
}

export function DebateReplay({ threadId }: { threadId: string }) {
  const [events, setEvents] = useState<ReplayEvent[]>([])
  const [loaded, setLoaded] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [currentIdx, setCurrentIdx] = useState(-1)
  const [speed, setSpeed] = useState(1)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const speedRef = useRef(speed)
  const eventsRef = useRef(events)
  speedRef.current = speed
  eventsRef.current = events

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const allEvents: ReplayEvent[] = []

      // 투표 이벤트
      const { data: votes } = await supabase
        .from("thread_votes")
        .select("vote_type, created_at")
        .eq("thread_id", threadId)
        .order("created_at", { ascending: true })

      for (const v of votes ?? []) {
        const row = v as Record<string, unknown>
        allEvents.push({
          type: "vote",
          side: row.vote_type === "pro" ? "pro" : "con",
          time: String(row.created_at ?? ""),
        })
      }

      // 댓글 이벤트
      const { data: comments } = await supabase
        .from("comments")
        .select("side, content, created_at")
        .eq("thread_id", threadId)
        .eq("is_deleted", false)
        .order("created_at", { ascending: true })

      for (const c of comments ?? []) {
        const row = c as Record<string, unknown>
        allEvents.push({
          type: "comment",
          side: row.side === "pro" ? "pro" : "con",
          time: String(row.created_at ?? ""),
          content: String(row.content ?? "").slice(0, 80),
        })
      }

      // 시간순 정렬
      allEvents.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime())

      if (!cancelled) {
        setEvents(allEvents)
        setLoaded(true)
      }
    })()
    return () => { cancelled = true }
  }, [threadId])

  const stop = useCallback(() => {
    setPlaying(false)
    if (timerRef.current) clearTimeout(timerRef.current)
  }, [])

  const playNext = useCallback((idx: number) => {
    if (idx >= eventsRef.current.length) {
      setPlaying(false)
      return
    }
    setCurrentIdx(idx)

    const delay = 600 / speedRef.current
    timerRef.current = setTimeout(() => playNext(idx + 1), delay)
  }, [])

  const handlePlayPause = useCallback(() => {
    if (playing) {
      stop()
    } else {
      setPlaying(true)
      const startIdx = currentIdx >= eventsRef.current.length - 1 ? 0 : currentIdx + 1
      playNext(startIdx)
    }
  }, [playing, stop, currentIdx, playNext])

  const handleReset = useCallback(() => {
    stop()
    setCurrentIdx(-1)
  }, [stop])

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  if (!loaded || events.length < 5) return null

  const proVotes = events.slice(0, currentIdx + 1).filter((e) => e.type === "vote" && e.side === "pro").length
  const conVotes = events.slice(0, currentIdx + 1).filter((e) => e.type === "vote" && e.side === "con").length
  const totalVotes = proVotes + conVotes
  const proPct = totalVotes > 0 ? Math.round((proVotes / totalVotes) * 100) : 50
  const progress = events.length > 0 ? Math.round(((currentIdx + 1) / events.length) * 100) : 0

  // 최근 표시할 이벤트 (최대 6개)
  const visibleEvents = events.slice(Math.max(0, currentIdx - 5), currentIdx + 1).reverse()

  return (
    <div className="rounded-2xl border border-cyan-400/20 bg-black/30 p-5 backdrop-blur">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="grid size-8 place-items-center rounded-lg border border-cyan-400/30 bg-cyan-400/10 text-cyan-300">
            <Play className="size-4" />
          </div>
          <div>
            <div className="text-sm font-semibold text-zinc-100">토론 리플레이</div>
            <div className="text-[10px] text-zinc-500">
              {events.length}개 이벤트 · {currentIdx + 1} / {events.length}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* 속도 */}
          <div className="flex items-center gap-0.5 rounded-lg border border-white/10 bg-black/40 p-0.5">
            {[1, 2, 4].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSpeed(s)}
                className={`rounded-md px-2 py-0.5 text-[10px] font-medium transition ${
                  speed === s
                    ? "bg-cyan-400/20 text-cyan-200"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {s}x
              </button>
            ))}
          </div>

          <Button
            size="icon-sm"
            variant="outline"
            onClick={handleReset}
            className="border-white/10 bg-white/5"
          >
            <RotateCcw className="size-3.5" />
          </Button>
          <Button
            size="icon-sm"
            onClick={handlePlayPause}
            className="bg-gradient-to-r from-cyan-400 to-sky-400 text-black"
          >
            {playing ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
          </Button>
        </div>
      </div>

      {/* 프로그레스 바 */}
      <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className={`h-full rounded-full bg-gradient-to-r from-cyan-400 to-sky-400 transition-all duration-300 ${
            playing ? "replay-progress-glow" : ""
          }`}
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* 미니 게이지 */}
      <div className="mb-4 space-y-1">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-cyan-300">찬성 {proVotes}</span>
          <span className="text-fuchsia-300">반대 {conVotes}</span>
        </div>
        <div className="relative h-2 overflow-hidden rounded-full bg-white/[0.06]">
          <div
            className="absolute inset-y-0 left-0 rounded-l-full bg-cyan-400 transition-all duration-300"
            style={{ width: `${proPct}%` }}
          />
          <div
            className="absolute inset-y-0 right-0 rounded-r-full bg-fuchsia-400 transition-all duration-300"
            style={{ width: `${100 - proPct}%` }}
          />
        </div>
      </div>

      {/* 이벤트 피드 */}
      <div className="max-h-48 space-y-1.5 overflow-y-auto">
        {visibleEvents.length === 0 ? (
          <div className="py-4 text-center text-xs text-zinc-600">
            재생 버튼을 눌러 리플레이를 시작하세요
          </div>
        ) : (
          visibleEvents.map((ev, i) => {
            const isPro = ev.side === "pro"
            return (
              <div
                key={`${ev.time}-${i}`}
                className={`replay-event-enter rounded-lg border px-3 py-2 ${
                  isPro
                    ? "border-cyan-400/15 bg-cyan-400/5"
                    : "border-fuchsia-400/15 bg-fuchsia-400/5"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-semibold ${isPro ? "text-cyan-300" : "text-fuchsia-300"}`}>
                    {isPro ? "찬성" : "반대"}
                  </span>
                  <span className="text-[10px] text-zinc-500">
                    {ev.type === "vote" ? "투표" : "댓글"}
                  </span>
                </div>
                {ev.content && (
                  <div className="mt-0.5 truncate text-xs text-zinc-300">{ev.content}</div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
