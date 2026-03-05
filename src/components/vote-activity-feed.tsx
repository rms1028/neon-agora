"use client"

import { useEffect, useRef, useState } from "react"
import { ArrowRightLeft, ThumbsDown, ThumbsUp, X as XIcon } from "lucide-react"

import { supabase } from "@/lib/supabase"
import { timeAgo, getDisplayName } from "@/lib/utils"

type VoteLog = {
  id: string
  user_id: string
  action: string
  created_at: string
}

const relativeTime = timeAgo

function actionLabel(action: string) {
  switch (action) {
    case "new_pro":
      return "찬성 투표"
    case "new_con":
      return "반대 투표"
    case "switch_to_pro":
      return "반대→찬성 변경"
    case "switch_to_con":
      return "찬성→반대 변경"
    case "remove_pro":
      return "찬성 철회"
    case "remove_con":
      return "반대 철회"
    default:
      return action
  }
}

function ActionIcon({ action }: { action: string }) {
  if (action === "new_pro")
    return <ThumbsUp className="size-3.5" />
  if (action === "new_con")
    return <ThumbsDown className="size-3.5" />
  if (action.startsWith("switch_to_"))
    return <ArrowRightLeft className="size-3.5" />
  return <XIcon className="size-3.5" />
}

function actionColor(action: string) {
  if (action === "new_pro" || action === "switch_to_pro")
    return "bg-cyan-400/15 text-cyan-300"
  if (action === "new_con" || action === "switch_to_con")
    return "bg-fuchsia-400/15 text-fuchsia-300"
  return "bg-zinc-400/15 text-zinc-400"
}

export function VoteActivityFeed({ threadId }: { threadId: string }) {
  const [logs, setLogs] = useState<VoteLog[]>([])
  const [loading, setLoading] = useState(true)
  const newIdsRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    let cancelled = false

    async function load() {
      const { data, error } = await supabase.rpc("get_vote_activity", {
        p_thread_id: threadId,
        p_limit: 20,
      })

      if (cancelled) return

      if (error) {
        // RPC가 없으면 graceful
        if (error.code !== "PGRST202") {
          console.error("[VoteActivity]", error.code)
        }
        setLoading(false)
        return
      }

      setLogs((data as VoteLog[]) ?? [])
      setLoading(false)
    }

    load()

    // Realtime subscribe
    const channel = supabase
      .channel(`vote-logs-${threadId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "vote_logs",
          filter: `thread_id=eq.${threadId}`,
        },
        (payload) => {
          const newLog = payload.new as VoteLog
          newIdsRef.current.add(newLog.id)
          setLogs((prev) => [newLog, ...prev].slice(0, 30))
        }
      )
      .subscribe()

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [threadId])

  if (loading) return null

  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 p-4 backdrop-blur">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-100">
        <ArrowRightLeft className="size-4 text-violet-300" />
        투표 활동
      </h3>

      {logs.length === 0 ? (
        <p className="py-4 text-center text-xs text-zinc-500">
          아직 투표 활동이 없습니다.
        </p>
      ) : (
        <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
          {logs.map((log) => (
            <div
              key={log.id}
              className={`flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 ${
                newIdsRef.current.has(log.id) ? "activity-slide-in" : ""
              }`}
            >
              {/* 아이콘 */}
              <div
                className={`grid size-7 shrink-0 place-items-center rounded-full ${actionColor(
                  log.action
                )}`}
              >
                <ActionIcon action={log.action} />
              </div>

              {/* 텍스트 */}
              <div className="min-w-0 flex-1">
                <p className="text-xs text-zinc-200">
                  <span className="font-medium text-zinc-300">
                    {getDisplayName(log.user_id)}
                  </span>{" "}
                  {actionLabel(log.action)}
                </p>
              </div>

              {/* 시간 */}
              <span className="shrink-0 text-[10px] text-zinc-600">
                {relativeTime(log.created_at)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
