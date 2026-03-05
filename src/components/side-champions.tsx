"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Crown, ThumbsDown, ThumbsUp } from "lucide-react"

import { supabase } from "@/lib/supabase"
import { getDisplayName } from "@/lib/utils"

type Champion = {
  userId: string
  displayName: string
  likeCount: number
  commentCount: number
}

export function SideChampions({
  threadId,
  comments,
}: {
  threadId: string
  comments: {
    id: string
    userId: string
    displayName: string
    side: "pro" | "con" | null
    likeCount: number
  }[]
}) {
  const [proChamp, setProChamp] = useState<Champion | null>(null)
  const [conChamp, setConChamp] = useState<Champion | null>(null)

  useEffect(() => {
    // 찬성/반대 각각의 유저별 추천 합산
    const proMap = new Map<string, { total: number; count: number; name: string }>()
    const conMap = new Map<string, { total: number; count: number; name: string }>()

    for (const c of comments) {
      if (c.side === "pro") {
        const prev = proMap.get(c.userId) ?? { total: 0, count: 0, name: c.displayName }
        proMap.set(c.userId, { total: prev.total + c.likeCount, count: prev.count + 1, name: c.displayName })
      } else if (c.side === "con") {
        const prev = conMap.get(c.userId) ?? { total: 0, count: 0, name: c.displayName }
        conMap.set(c.userId, { total: prev.total + c.likeCount, count: prev.count + 1, name: c.displayName })
      }
    }

    // 최다 추천 유저 선정
    let bestPro: Champion | null = null
    for (const [userId, data] of proMap) {
      if (!bestPro || data.total > bestPro.likeCount) {
        bestPro = { userId, displayName: data.name, likeCount: data.total, commentCount: data.count }
      }
    }

    let bestCon: Champion | null = null
    for (const [userId, data] of conMap) {
      if (!bestCon || data.total > bestCon.likeCount) {
        bestCon = { userId, displayName: data.name, likeCount: data.total, commentCount: data.count }
      }
    }

    setProChamp(bestPro)
    setConChamp(bestCon)
  }, [comments])

  // 양쪽 다 없으면 표시 안 함
  if (!proChamp && !conChamp) return null

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-black/30 p-3 backdrop-blur">
      <div className="mb-2.5 flex items-center gap-2">
        <Crown className="size-3.5 text-amber-400" />
        <span className="text-[10px] font-bold tracking-wider text-zinc-400">SIDE CHAMPIONS</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* 찬성 대표 */}
        <div className={`rounded-xl border p-3 ${
          proChamp
            ? "border-[#00FFD1]/20 bg-[#00FFD1]/5"
            : "border-white/[0.06] bg-white/[0.02]"
        }`}>
          <div className="mb-1 flex items-center gap-1 text-[9px] font-bold text-[#00FFD1]">
            <ThumbsUp className="size-2.5" />
            찬성 MVP
          </div>
          {proChamp ? (
            <>
              <Link
                href={`/profile/${proChamp.userId}`}
                className="block truncate text-xs font-semibold text-zinc-100 transition hover:text-[#00FFD1]"
              >
                {proChamp.displayName}
              </Link>
              <div className="mt-1 flex items-center gap-2 text-[10px] text-zinc-500">
                <span>추천 {proChamp.likeCount}</span>
                <span>댓글 {proChamp.commentCount}</span>
              </div>
            </>
          ) : (
            <div className="text-[10px] text-zinc-600">아직 없음</div>
          )}
        </div>

        {/* 반대 대표 */}
        <div className={`rounded-xl border p-3 ${
          conChamp
            ? "border-[#FF00FF]/20 bg-[#FF00FF]/5"
            : "border-white/[0.06] bg-white/[0.02]"
        }`}>
          <div className="mb-1 flex items-center gap-1 text-[9px] font-bold text-[#FF00FF]">
            <ThumbsDown className="size-2.5" />
            반대 MVP
          </div>
          {conChamp ? (
            <>
              <Link
                href={`/profile/${conChamp.userId}`}
                className="block truncate text-xs font-semibold text-zinc-100 transition hover:text-[#FF00FF]"
              >
                {conChamp.displayName}
              </Link>
              <div className="mt-1 flex items-center gap-2 text-[10px] text-zinc-500">
                <span>추천 {conChamp.likeCount}</span>
                <span>댓글 {conChamp.commentCount}</span>
              </div>
            </>
          ) : (
            <div className="text-[10px] text-zinc-600">아직 없음</div>
          )}
        </div>
      </div>
    </div>
  )
}
