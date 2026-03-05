"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Plus, Swords, Trophy, Users } from "lucide-react"

import { supabase } from "@/lib/supabase"
import { useAuth } from "@/components/auth-provider"
import { CreateTournamentModal } from "@/components/create-tournament-modal"

type Tournament = {
  id: string
  title: string
  description: string
  status: "recruiting" | "active" | "completed"
  bracket_size: number
  current_round: number
  created_at: string
  winner_thread_id: string | null
}

const TABS = [
  { key: "active", label: "진행중", color: "text-cyan-200 border-cyan-400/40 bg-cyan-400/10" },
  { key: "recruiting", label: "모집중", color: "text-emerald-200 border-emerald-400/40 bg-emerald-400/10" },
  { key: "completed", label: "완료", color: "text-zinc-300 border-white/10 bg-white/5" },
] as const

function formatDate(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`
}

export default function TournamentsPage() {
  const { user } = useAuth()
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<"active" | "recruiting" | "completed">("active")
  const [modalOpen, setModalOpen] = useState(false)

  const loadTournaments = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from("tournaments")
      .select("*")
      .eq("status", tab)
      .order("created_at", { ascending: false })
      .limit(50)
    setTournaments((data ?? []) as Tournament[])
    setLoading(false)
  }, [tab])

  useEffect(() => {
    loadTournaments()
  }, [loadTournaments])

  return (
    <div className="min-h-screen bg-black text-zinc-100">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(1200px_circle_at_20%_10%,rgba(34,211,238,0.18),transparent_55%),radial-gradient(900px_circle_at_80%_20%,rgba(236,72,153,0.14),transparent_55%)]" />
      </div>

      <div className="relative mx-auto w-full max-w-4xl px-4 py-10 sm:px-6">
        <nav className="mb-6 flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-200"
          >
            <ArrowLeft className="size-4" />
            홈으로
          </Link>
          <span className="text-[11px] tracking-widest text-zinc-600">TOURNAMENTS</span>
        </nav>

        {/* 헤더 */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl border border-cyan-400/25 bg-cyan-400/10 text-cyan-300">
              <Swords className="size-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-zinc-100">토론 토너먼트</h1>
              <p className="text-xs text-zinc-500">토론들의 대결! 투표로 승자를 결정하세요</p>
            </div>
          </div>
          {user && (
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm font-medium text-cyan-200 transition hover:bg-cyan-400/20"
            >
              <Plus className="size-4" />
              토너먼트 생성
            </button>
          )}
        </div>

        {/* 탭 */}
        <div className="mb-4 flex gap-2">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                tab === t.key ? t.color : "border-white/10 bg-white/5 text-zinc-500 hover:bg-white/10"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* 리스트 */}
        <div className="space-y-3">
          {loading ? (
            [0, 1, 2].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-2xl bg-white/[0.04]" />
            ))
          ) : tournaments.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
              <Swords className="mx-auto size-8 text-zinc-600" />
              <p className="mt-3 text-sm text-zinc-500">
                {tab === "active" ? "진행 중인 토너먼트가 없습니다." :
                 tab === "recruiting" ? "모집 중인 토너먼트가 없습니다." :
                 "완료된 토너먼트가 없습니다."}
              </p>
            </div>
          ) : (
            tournaments.map((t) => (
              <Link
                key={t.id}
                href={`/tournaments/${t.id}`}
                className="group block rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition hover:border-cyan-400/30 hover:bg-cyan-400/[0.04] hover:shadow-[0_0_20px_rgba(34,211,238,0.06)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-semibold text-zinc-100 group-hover:text-cyan-100">
                        {t.title}
                      </span>
                      <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                        t.status === "active"
                          ? "border-cyan-400/30 bg-cyan-400/10 text-cyan-200"
                          : t.status === "recruiting"
                            ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
                            : "border-white/10 bg-white/5 text-zinc-400"
                      }`}>
                        {t.status === "active" ? "진행중" : t.status === "recruiting" ? "모집중" : "완료"}
                      </span>
                    </div>
                    {t.description && (
                      <p className="mt-1 line-clamp-1 text-xs text-zinc-500">{t.description}</p>
                    )}
                    <div className="mt-2 flex items-center gap-3 text-[11px] text-zinc-500">
                      <span className="inline-flex items-center gap-1">
                        <Users className="size-3" />
                        {t.bracket_size}강
                      </span>
                      <span>R{t.current_round}</span>
                      <span>{formatDate(t.created_at)}</span>
                      {t.status === "completed" && (
                        <span className="inline-flex items-center gap-1 text-yellow-300">
                          <Trophy className="size-3" />
                          완료
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>

      <CreateTournamentModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={loadTournaments}
      />
    </div>
  )
}
