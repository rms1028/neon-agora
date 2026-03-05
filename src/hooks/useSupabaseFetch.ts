"use client"

import { useCallback, useEffect, useRef, useState } from "react"

export function useSupabaseFetch<T>(
  queryFn: () => PromiseLike<{ data: T | null; error: any }>,
  deps: unknown[],
  options?: { enabled?: boolean; silentCodes?: string[] }
): { data: T | null; loading: boolean; error: any; refetch: () => void } {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<any>(null)
  const mountedRef = useRef(true)

  const enabled = options?.enabled ?? true
  const silentCodes = options?.silentCodes ?? ["42P01", "PGRST205"]

  const execute = useCallback(async () => {
    if (!enabled) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)

    const { data: result, error: err } = await queryFn()
    if (!mountedRef.current) return

    if (err) {
      if (!silentCodes.includes(err.code)) {
        setError(err)
      }
      setLoading(false)
      return
    }
    setData(result)
    setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  useEffect(() => {
    mountedRef.current = true
    execute()
    return () => {
      mountedRef.current = false
    }
  }, [execute])

  const refetch = useCallback(() => {
    execute()
  }, [execute])

  return { data, loading, error, refetch }
}
