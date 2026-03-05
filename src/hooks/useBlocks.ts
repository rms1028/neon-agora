"use client"

import { useCallback, useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/components/auth-provider"
import { useSupabaseFetch } from "@/hooks/useSupabaseFetch"

export function useBlocks() {
  const { user } = useAuth()
  const [blockedIds, setBlockedIds] = useState<Set<string>>(new Set())

  const { data } = useSupabaseFetch<{ blocked_id: string }[]>(
    () =>
      supabase
        .from("blocks")
        .select("blocked_id")
        .eq("blocker_id", user!.id) as any,
    [user?.id],
    { enabled: !!user }
  )

  useEffect(() => {
    if (data) {
      setBlockedIds(new Set(data.map((r) => r.blocked_id)))
    } else if (!user) {
      setBlockedIds(new Set())
    }
  }, [data, user])

  const blockUser = useCallback(async (targetId: string) => {
    if (!user) return false
    setBlockedIds((prev) => new Set([...prev, targetId]))
    const { error } = await supabase
      .from("blocks")
      .insert({ blocker_id: user.id, blocked_id: targetId })
    if (error) {
      setBlockedIds((prev) => {
        const next = new Set(prev)
        next.delete(targetId)
        return next
      })
      return false
    }
    return true
  }, [user])

  const unblockUser = useCallback(async (targetId: string) => {
    if (!user) return false
    setBlockedIds((prev) => {
      const next = new Set(prev)
      next.delete(targetId)
      return next
    })
    const { error } = await supabase
      .from("blocks")
      .delete()
      .eq("blocker_id", user.id)
      .eq("blocked_id", targetId)
    if (error) {
      setBlockedIds((prev) => new Set([...prev, targetId]))
      return false
    }
    return true
  }, [user])

  return { blockedIds, blockUser, unblockUser }
}
