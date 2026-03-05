"use client"

import { useCallback, useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/components/auth-provider"
import { useSupabaseFetch } from "@/hooks/useSupabaseFetch"

export function useThreadMute(threadId: string) {
  const { user } = useAuth()
  const [muted, setMuted] = useState(false)

  const { loading, data } = useSupabaseFetch<{ id: string } | null>(
    () =>
      supabase
        .from("thread_mutes")
        .select("id")
        .eq("user_id", user!.id)
        .eq("thread_id", threadId)
        .maybeSingle() as any,
    [user?.id, threadId],
    { enabled: !!user }
  )

  useEffect(() => {
    if (data !== undefined) {
      setMuted(!!data)
    }
    if (!user) {
      setMuted(false)
    }
  }, [data, user])

  const toggleMute = useCallback(async () => {
    if (!user) return
    const prev = muted
    setMuted(!prev)

    if (prev) {
      // unmute
      const { error } = await supabase
        .from("thread_mutes")
        .delete()
        .eq("user_id", user.id)
        .eq("thread_id", threadId)
      if (error) setMuted(prev)
    } else {
      // mute
      const { error } = await supabase
        .from("thread_mutes")
        .insert({ user_id: user.id, thread_id: threadId })
      if (error) setMuted(prev)
    }
  }, [user, muted, threadId])

  return { muted, loading, toggleMute }
}
