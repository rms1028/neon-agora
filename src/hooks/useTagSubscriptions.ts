"use client"

import { useCallback, useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/components/auth-provider"
import { useSupabaseFetch } from "@/hooks/useSupabaseFetch"

export function useTagSubscriptions() {
  const auth = useAuth()
  const user = auth?.user ?? null
  const loading = auth?.loading ?? true
  const [subscribed, setSubscribed] = useState<Set<string>>(new Set())

  const userId = user?.id ?? null
  const { data } = useSupabaseFetch<{ tag: string }[]>(
    () => {
      if (!userId) return Promise.resolve({ data: null, error: null })
      return supabase
        .from("tag_subscriptions")
        .select("tag")
        .eq("user_id", userId) as any
    },
    [userId, loading],
    { enabled: !loading && !!userId }
  )

  useEffect(() => {
    if (data) {
      setSubscribed(new Set(data.map((r) => r.tag)))
    } else if (!user || loading) {
      setSubscribed(new Set())
    }
  }, [data, user, loading])

  const toggleSubscription = useCallback(
    async (tag: string) => {
      if (!user) return

      const wasSub = subscribed.has(tag)

      // 낙관적 업데이트
      setSubscribed((prev) => {
        const next = new Set(prev)
        if (wasSub) next.delete(tag)
        else next.add(tag)
        return next
      })

      if (wasSub) {
        const { error } = await supabase
          .from("tag_subscriptions")
          .delete()
          .eq("user_id", user.id)
          .eq("tag", tag)

        if (error && error.code !== "42P01" && error.code !== "PGRST205") {
          // 롤백
          setSubscribed((prev) => new Set([...prev, tag]))
        }
      } else {
        const { error } = await supabase
          .from("tag_subscriptions")
          .insert({ user_id: user.id, tag })

        if (error && error.code !== "42P01" && error.code !== "PGRST205") {
          // 롤백
          setSubscribed((prev) => {
            const next = new Set(prev)
            next.delete(tag)
            return next
          })
        }
      }
    },
    [user, subscribed]
  )

  return { subscribed, toggleSubscription }
}
