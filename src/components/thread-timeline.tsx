"use client"

import { useEffect, useState } from "react"
import { Lock, MessageSquareText, Scale, Sparkles, TrendingUp } from "lucide-react"

import { supabase } from "@/lib/supabase"

type TimelineEvent = {
  event_type: string
  event_time: string
  event_data: {
    label?: string
    milestone?: number
    verdict?: string
  }
}

const EVENT_CONFIG: Record<
  string,
  { icon: typeof Sparkles; colorClass: string; glowColor: string }
> = {
  created: {
    icon: Sparkles,
    colorClass: "text-cyan-400 border-cyan-400/40 bg-cyan-400/10",
    glowColor: "rgba(34,211,238,0.5)",
  },
  vote_milestone: {
    icon: TrendingUp,
    colorClass: "text-emerald-400 border-emerald-400/40 bg-emerald-400/10",
    glowColor: "rgba(52,211,153,0.5)",
  },
  comment_milestone: {
    icon: MessageSquareText,
    colorClass: "text-violet-400 border-violet-400/40 bg-violet-400/10",
    glowColor: "rgba(139,92,246,0.5)",
  },
  ai_verdict: {
    icon: Scale,
    colorClass: "text-amber-400 border-amber-400/40 bg-amber-400/10",
    glowColor: "rgba(234,179,8,0.5)",
  },
  closed: {
    icon: Lock,
    colorClass: "text-red-400 border-red-400/40 bg-red-400/10",
    glowColor: "rgba(239,68,68,0.5)",
  },
}

function formatRelative(dateStr: string) {
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return ""
  const now = Date.now()
  const diff = now - d.getTime()
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(mins / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) return `${days}일 전`
  if (hours > 0) return `${hours}시간 전`
  if (mins > 0) return `${mins}분 전`
  return "방금"
}

export function ThreadTimeline({ threadId }: { threadId: string }) {
  const [events, setEvents] = useState<TimelineEvent[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      const { data, error } = await supabase.rpc("get_thread_timeline", {
        p_thread_id: threadId,
      })

      if (cancelled) return

      if (error) {
        // PGRST202 = RPC 함수 없음 → 무시
        if (error.code === "PGRST202" || error.code === "42883") {
          setLoaded(true)
          return
        }
        console.error("[ThreadTimeline] RPC error:", error.message)
        setLoaded(true)
        return
      }

      const sorted = (data as TimelineEvent[])
        .sort(
          (a, b) =>
            new Date(a.event_time).getTime() - new Date(b.event_time).getTime()
        )

      setEvents(sorted)
      setLoaded(true)
    }

    load()
    return () => { cancelled = true }
  }, [threadId])

  // 이벤트가 2개 미만이면 숨김
  if (!loaded || events.length < 2) return null

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-black/30 p-5 backdrop-blur">
      <div className="mb-4 flex items-center gap-2">
        <Sparkles className="size-4 text-cyan-300" />
        <span className="text-[10px] font-bold tracking-widest text-zinc-500">
          DEBATE TIMELINE
        </span>
      </div>

      <div className="relative ml-4">
        {/* 수직 연결선 */}
        <div className="absolute left-3 top-0 bottom-0 w-px bg-gradient-to-b from-cyan-400/30 via-fuchsia-400/20 to-transparent" />

        <div className="space-y-4">
          {events.map((ev, i) => {
            const config = EVENT_CONFIG[ev.event_type] ?? EVENT_CONFIG.created
            const Icon = config.icon

            return (
              <div
                key={`${ev.event_type}-${ev.event_time}-${i}`}
                className="timeline-node-appear relative flex items-start gap-3 pl-2"
                style={{ animationDelay: `${i * 0.15}s` }}
              >
                {/* 노드 */}
                <div
                  className={`timeline-pulse relative z-10 grid size-6 shrink-0 place-items-center rounded-full border ${config.colorClass}`}
                  style={{
                    boxShadow: `0 0 8px ${config.glowColor}`,
                    color: undefined,
                  }}
                >
                  <Icon className="size-3" />
                </div>

                {/* 내용 */}
                <div className="min-w-0 pb-1">
                  <div className="text-xs font-medium text-zinc-200">
                    {ev.event_data?.label ?? ev.event_type}
                  </div>
                  <div className="mt-0.5 text-[10px] text-zinc-600">
                    {formatRelative(ev.event_time)}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
