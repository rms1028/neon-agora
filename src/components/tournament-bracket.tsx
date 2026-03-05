"use client"

import { useMemo } from "react"
import Link from "next/link"
import { Trophy } from "lucide-react"

export type TournamentMatch = {
  id: string
  round: number
  match_index: number
  thread_a: string | null
  thread_b: string | null
  winner_thread: string | null
  votes_a: number
  votes_b: number
  starts_at: string | null
  ends_at: string | null
}

type ThreadInfo = {
  id: string
  title: string
}

export function TournamentBracket({
  matches,
  threads,
  totalRounds,
  currentRound,
}: {
  matches: TournamentMatch[]
  threads: Record<string, ThreadInfo>
  totalRounds: number
  currentRound: number
}) {
  // 라운드별 매치 그룹핑
  const rounds = useMemo(() => {
    const result: TournamentMatch[][] = []
    for (let r = 1; r <= totalRounds; r++) {
      result.push(
        matches
          .filter((m) => m.round === r)
          .sort((a, b) => a.match_index - b.match_index)
      )
    }
    return result
  }, [matches, totalRounds])

  return (
    <div className="overflow-x-auto">
      <div
        className="flex gap-6"
        style={{ minWidth: `${totalRounds * 280}px` }}
      >
        {rounds.map((roundMatches, rIdx) => {
          const roundNum = rIdx + 1
          const isCurrentRound = roundNum === currentRound
          const roundLabel =
            roundNum === totalRounds
              ? "결승"
              : roundNum === totalRounds - 1
                ? "준결승"
                : `${roundNum}라운드`

          return (
            <div key={roundNum} className="flex min-w-[250px] flex-col gap-4">
              {/* 라운드 헤더 */}
              <div className="flex items-center gap-2">
                <span
                  className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${
                    isCurrentRound
                      ? "border-cyan-400/40 bg-cyan-400/10 text-cyan-200"
                      : "border-white/10 bg-white/5 text-zinc-400"
                  }`}
                >
                  {roundLabel}
                </span>
                {isCurrentRound && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-[9px] font-semibold text-emerald-300">
                    <span className="size-1.5 rounded-full bg-emerald-400 shadow-[0_0_4px_rgba(52,211,153,0.8)]" />
                    LIVE
                  </span>
                )}
              </div>

              {/* 매치 카드들 */}
              <div className="flex flex-1 flex-col justify-around gap-4">
                {roundMatches.length === 0 && (
                  <div className="rounded-xl border border-dashed border-white/10 p-4 text-center text-xs text-zinc-600">
                    대기 중
                  </div>
                )}
                {roundMatches.map((match) => {
                  const threadA = match.thread_a ? threads[match.thread_a] : null
                  const threadB = match.thread_b ? threads[match.thread_b] : null
                  const isComplete = !!match.winner_thread
                  const isWinnerA = match.winner_thread === match.thread_a
                  const isWinnerB = match.winner_thread === match.thread_b

                  return (
                    <div
                      key={match.id}
                      className={`relative rounded-xl border backdrop-blur transition ${
                        isComplete
                          ? "border-white/10 bg-white/[0.03]"
                          : "border-cyan-400/20 bg-cyan-400/[0.03] bracket-neon-pulse"
                      }`}
                    >
                      {/* 커넥터 라인 */}
                      {rIdx < totalRounds - 1 && (
                        <div className="absolute -right-6 top-1/2 h-px w-6 bg-gradient-to-r from-cyan-400/30 to-transparent bracket-neon-pulse" />
                      )}

                      {/* 토론 A */}
                      <div
                        className={`flex items-center gap-2 border-b border-white/[0.06] p-3 ${
                          isWinnerA ? "tournament-winner-glow rounded-t-xl" : ""
                        }`}
                      >
                        {isWinnerA && (
                          <Trophy className="size-3.5 shrink-0 text-yellow-300" />
                        )}
                        <div className="min-w-0 flex-1">
                          {threadA ? (
                            <Link
                              href={`/thread/${threadA.id}`}
                              className="block truncate text-xs font-medium text-zinc-200 hover:text-cyan-200"
                            >
                              {threadA.title}
                            </Link>
                          ) : (
                            <span className="text-xs text-zinc-600">BYE</span>
                          )}
                        </div>
                        {isComplete && (
                          <span className={`shrink-0 text-[11px] font-bold tabular-nums ${
                            isWinnerA ? "text-yellow-200" : "text-zinc-500"
                          }`}>
                            {match.votes_a}
                          </span>
                        )}
                      </div>

                      {/* VS divider */}
                      <div className="flex items-center justify-center bg-white/[0.02] py-0.5">
                        <span className="text-[9px] font-bold tracking-widest text-zinc-600">VS</span>
                      </div>

                      {/* 토론 B */}
                      <div
                        className={`flex items-center gap-2 p-3 ${
                          isWinnerB ? "tournament-winner-glow rounded-b-xl" : ""
                        }`}
                      >
                        {isWinnerB && (
                          <Trophy className="size-3.5 shrink-0 text-yellow-300" />
                        )}
                        <div className="min-w-0 flex-1">
                          {threadB ? (
                            <Link
                              href={`/thread/${threadB.id}`}
                              className="block truncate text-xs font-medium text-zinc-200 hover:text-cyan-200"
                            >
                              {threadB.title}
                            </Link>
                          ) : (
                            <span className="text-xs text-zinc-600">BYE</span>
                          )}
                        </div>
                        {isComplete && (
                          <span className={`shrink-0 text-[11px] font-bold tabular-nums ${
                            isWinnerB ? "text-yellow-200" : "text-zinc-500"
                          }`}>
                            {match.votes_b}
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
