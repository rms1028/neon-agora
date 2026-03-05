"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Search, X } from "lucide-react"

import { supabase } from "@/lib/supabase"
import { getTier } from "@/lib/xp"
import { getDisplayName } from "@/lib/utils"

type SearchResult = {
  id: string
  displayName: string
  xp: number
  badge: string
}

export function UserSearchBar() {
  const router = useRouter()
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchResult[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const search = useCallback(async (q: string) => {
    if (q.trim().length === 0) {
      setResults([])
      setOpen(false)
      return
    }
    setLoading(true)
    const { data } = await supabase
      .from("profiles")
      .select("id, display_name, xp, badge")
      .ilike("display_name", `%${q.trim()}%`)
      .order("xp", { ascending: false })
      .limit(10)

    const items: SearchResult[] = (data ?? []).map((row) => ({
      id: String(row.id),
      displayName: getDisplayName(row as { id?: string; display_name?: string | null }),
      xp: Number(row.xp) || 0,
      badge: String(row.badge ?? ""),
    }))
    setResults(items)
    setOpen(items.length > 0)
    setLoading(false)
  }, [])

  function handleChange(value: string) {
    setQuery(value)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => search(value), 300)
  }

  function handleSelect(id: string) {
    setOpen(false)
    setQuery("")
    setResults([])
    router.push(`/profile/${id}`)
  }

  // 외부 클릭 닫기
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", onClick)
    return () => document.removeEventListener("mousedown", onClick)
  }, [])

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  return (
    <div ref={containerRef} className="relative w-full max-w-md">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500" />
        <input
          type="text"
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => { if (results.length > 0) setOpen(true) }}
          placeholder="유저 검색 (닉네임)"
          className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pl-10 pr-9 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none transition focus:border-amber-400/40 focus:ring-1 focus:ring-amber-400/20"
        />
        {query && (
          <button
            onClick={() => { setQuery(""); setResults([]); setOpen(false) }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-xl border border-amber-400/20 bg-zinc-950/95 p-1 shadow-xl backdrop-blur">
          {loading ? (
            <div className="px-3 py-4 text-center text-xs text-zinc-500">검색 중…</div>
          ) : results.length === 0 ? (
            <div className="px-3 py-4 text-center text-xs text-zinc-500">결과 없음</div>
          ) : (
            results.map((r) => {
              const tier = getTier(r.xp)
              return (
                <button
                  key={r.id}
                  onClick={() => handleSelect(r.id)}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition hover:bg-white/5"
                >
                  <div className={`grid size-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br ${tier.avatarGradient} text-xs font-bold text-black`}>
                    {r.displayName.slice(0, 2)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-zinc-200">{r.displayName}</div>
                    <div className={`text-[10px] ${tier.textClass}`}>{tier.badgeName}</div>
                  </div>
                  <div className={`shrink-0 text-[11px] font-semibold tabular-nums ${tier.textClass}`}>
                    {r.xp} XP
                  </div>
                </button>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
