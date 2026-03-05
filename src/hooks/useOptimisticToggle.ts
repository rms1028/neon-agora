"use client"

import { useCallback, useState } from "react"
import { supabase } from "@/lib/supabase"

export function useOptimisticToggle(options: {
  table: string
  matchColumns: Record<string, unknown>
  userId: string | undefined
  onError?: (msg: string) => void
}): {
  items: Set<string>
  toggle: (key: string) => Promise<void>
  setItems: (s: Set<string>) => void
} {
  const { table, matchColumns, userId, onError } = options
  const [items, setItems] = useState<Set<string>>(new Set())

  const toggle = useCallback(
    async (key: string) => {
      if (!userId) return

      const wasActive = items.has(key)

      // 낙관적 업데이트
      setItems((prev) => {
        const next = new Set(prev)
        if (wasActive) next.delete(key)
        else next.add(key)
        return next
      })

      if (wasActive) {
        const { error } = await supabase
          .from(table)
          .delete()
          .match({ ...matchColumns, [Object.keys(matchColumns)[0]]: userId })
          .eq(Object.keys(matchColumns)[1] ?? "id", key)

        if (error && error.code !== "42P01" && error.code !== "PGRST205") {
          // 롤백
          setItems((prev) => new Set([...prev, key]))
          onError?.("삭제에 실패했습니다.")
        }
      } else {
        const insertData: Record<string, unknown> = { ...matchColumns }
        // 첫 번째 컬럼 = userId, 두 번째 컬럼 = key
        const cols = Object.keys(matchColumns)
        insertData[cols[0]] = userId
        insertData[cols[1]] = key

        const { error } = await supabase.from(table).insert(insertData)

        if (error && error.code !== "42P01" && error.code !== "PGRST205") {
          // 롤백
          setItems((prev) => {
            const next = new Set(prev)
            next.delete(key)
            return next
          })
          onError?.("추가에 실패했습니다.")
        }
      }
    },
    [userId, items, table, matchColumns, onError]
  )

  return { items, toggle, setItems }
}
