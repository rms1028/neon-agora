"use client"

import { useCallback, useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { Search, Swords, X } from "lucide-react"

import { supabase } from "@/lib/supabase"
import { useAuth } from "@/components/auth-provider"
import { useToast } from "@/components/toast-provider"

type ThreadOption = {
  id: string
  title: string
  pro_count: number
  con_count: number
}

export function CreateTournamentModal({
  isOpen,
  onClose,
  onCreated,
}: {
  isOpen: boolean
  onClose: () => void
  onCreated?: () => void
}) {
  const { user } = useAuth()
  const { showToast } = useToast()

  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [bracketSize, setBracketSize] = useState<4 | 8>(4)
  const [roundDuration, setRoundDuration] = useState<24 | 48>(24)
  const [threads, setThreads] = useState<ThreadOption[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState("")
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    let cancelled = false
    ;(async () => {
      const { data } = await supabase
        .from("threads")
        .select("id, title, pro_count, con_count")
        .eq("is_closed", false)
        .order("created_at", { ascending: false })
        .limit(100)
      if (!cancelled) {
        setThreads((data ?? []) as ThreadOption[])
      }
    })()
    return () => { cancelled = true }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) {
      setTitle("")
      setDescription("")
      setSelected(new Set())
      setSearch("")
    }
  }, [isOpen])

  const filtered = threads.filter((t) =>
    t.title.toLowerCase().includes(search.toLowerCase())
  )

  const toggleThread = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const handleCreate = useCallback(async () => {
    if (!user) return
    if (!title.trim()) {
      showToast("토너먼트 제목을 입력해주세요.", "info")
      return
    }
    if (selected.size !== bracketSize) {
      showToast(`${bracketSize}개의 토론을 선택해주세요. (현재 ${selected.size}개)`, "info")
      return
    }

    setCreating(true)

    // 토너먼트 생성
    const { data: tournament, error: tournamentErr } = await supabase
      .from("tournaments")
      .insert({
        title: title.trim(),
        description: description.trim(),
        created_by: user.id,
        bracket_size: bracketSize,
        round_duration: roundDuration,
        current_round: 1,
        status: "active",
        started_at: new Date().toISOString(),
      })
      .select("id")
      .single()

    if (tournamentErr || !tournament) {
      showToast("토너먼트 생성에 실패했습니다.", "error")
      setCreating(false)
      return
    }

    const tournamentId = tournament.id
    const selectedArr = [...selected]

    // 시드 배정 (랜덤 셔플)
    const shuffled = [...selectedArr].sort(() => Math.random() - 0.5)

    // entries 삽입
    const entries = shuffled.map((threadId, i) => ({
      tournament_id: tournamentId,
      thread_id: threadId,
      seed: i + 1,
    }))

    const { error: entryErr } = await supabase
      .from("tournament_entries")
      .insert(entries)

    if (entryErr) {
      showToast("토론 등록에 실패했습니다.", "error")
      setCreating(false)
      return
    }

    // 1라운드 매치 생성
    const matches = []
    for (let i = 0; i < shuffled.length; i += 2) {
      matches.push({
        tournament_id: tournamentId,
        round: 1,
        match_index: Math.floor(i / 2),
        thread_a: shuffled[i],
        thread_b: shuffled[i + 1] ?? null,
        starts_at: new Date().toISOString(),
        ends_at: new Date(Date.now() + roundDuration * 60 * 60 * 1000).toISOString(),
      })
    }

    await supabase.from("tournament_matches").insert(matches)

    showToast("토너먼트가 생성되었습니다!", "success")
    setCreating(false)
    onCreated?.()
    onClose()
  }, [user, title, description, bracketSize, roundDuration, selected, showToast, onCreated, onClose])

  if (!isOpen) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="relative max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-white/10 bg-black/90 p-6 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 rounded-full p-1 text-zinc-500 transition hover:bg-white/10 hover:text-zinc-300"
        >
          <X className="size-4" />
        </button>

        <div className="mb-4 flex items-center gap-2 text-base font-semibold text-zinc-100">
          <Swords className="size-5 text-cyan-300" />
          토너먼트 생성
        </div>

        <div className="space-y-4">
          {/* 제목 */}
          <div>
            <label className="mb-1 block text-xs text-zinc-400">토너먼트 제목</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={100}
              placeholder="예: 2026 봄 토론 챔피언십"
              className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-cyan-400/40"
            />
          </div>

          {/* 설명 */}
          <div>
            <label className="mb-1 block text-xs text-zinc-400">설명 (선택)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={300}
              rows={2}
              className="w-full resize-none rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-cyan-400/40"
            />
          </div>

          {/* 대진 크기 */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="mb-1 block text-xs text-zinc-400">대진 크기</label>
              <div className="flex gap-2">
                {([4, 8] as const).map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => {
                      setBracketSize(n)
                      setSelected(new Set())
                    }}
                    className={`flex-1 rounded-xl border px-3 py-2 text-sm font-medium transition ${
                      bracketSize === n
                        ? "border-cyan-400/40 bg-cyan-400/10 text-cyan-200"
                        : "border-white/10 bg-white/5 text-zinc-400 hover:bg-white/10"
                    }`}
                  >
                    {n}강
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-1">
              <label className="mb-1 block text-xs text-zinc-400">라운드 기간</label>
              <div className="flex gap-2">
                {([24, 48] as const).map((h) => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => setRoundDuration(h)}
                    className={`flex-1 rounded-xl border px-3 py-2 text-sm font-medium transition ${
                      roundDuration === h
                        ? "border-cyan-400/40 bg-cyan-400/10 text-cyan-200"
                        : "border-white/10 bg-white/5 text-zinc-400 hover:bg-white/10"
                    }`}
                  >
                    {h}h
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 토론 선택 */}
          <div>
            <label className="mb-1 flex items-center justify-between text-xs text-zinc-400">
              <span>토론 선택 ({selected.size}/{bracketSize})</span>
            </label>
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-zinc-500" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="토론 검색..."
                className="w-full rounded-xl border border-white/10 bg-black/40 py-2 pl-9 pr-3 text-sm text-zinc-100 outline-none focus:border-cyan-400/40"
              />
            </div>
            <div className="max-h-48 space-y-1 overflow-y-auto rounded-xl border border-white/10 bg-black/30 p-2">
              {filtered.length === 0 && (
                <div className="p-3 text-center text-xs text-zinc-500">토론을 찾을 수 없습니다</div>
              )}
              {filtered.map((t) => {
                const isSelected = selected.has(t.id)
                const isDisabled = !isSelected && selected.size >= bracketSize
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => !isDisabled && toggleThread(t.id)}
                    disabled={isDisabled}
                    className={`flex w-full items-center gap-2 rounded-lg p-2 text-left text-sm transition ${
                      isSelected
                        ? "border border-cyan-400/30 bg-cyan-400/10 text-cyan-100"
                        : isDisabled
                          ? "opacity-40 cursor-not-allowed text-zinc-500"
                          : "text-zinc-300 hover:bg-white/5"
                    }`}
                  >
                    <div className={`size-4 shrink-0 rounded border ${
                      isSelected ? "border-cyan-400 bg-cyan-400" : "border-white/20 bg-transparent"
                    }`}>
                      {isSelected && <span className="block text-center text-[10px] leading-4 text-black">✓</span>}
                    </div>
                    <span className="min-w-0 flex-1 truncate">{t.title}</span>
                    <span className="shrink-0 text-[10px] text-zinc-500">
                      {(t.pro_count ?? 0) + (t.con_count ?? 0)}표
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* 생성 버튼 */}
          <button
            type="button"
            onClick={handleCreate}
            disabled={creating || selected.size !== bracketSize || !title.trim()}
            className="w-full rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-2.5 text-sm font-semibold text-cyan-200 transition hover:bg-cyan-400/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {creating ? "생성 중…" : `토너먼트 생성 (${bracketSize}강)`}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
