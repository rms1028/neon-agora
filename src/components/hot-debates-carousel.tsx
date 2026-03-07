"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { AnimatePresence, motion } from "framer-motion"
import {
  ChevronLeft,
  ChevronRight,
  Flame,
  MessageSquareText,
  Sparkles,
  Swords,
  ThumbsDown,
  ThumbsUp,
  Users,
  Zap,
} from "lucide-react"

import type { Debate } from "@/components/debate-list"

const slideVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? "20%" : "-20%", opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? "-20%" : "20%", opacity: 0 }),
}

const INTERVAL_MS = 5000

export function HotDebatesCarousel({
  hotDebates,
}: {
  hotDebates: Debate[]
}) {
  const [[page, direction], setPage] = useState([0, 0])
  const [isPaused, setIsPaused] = useState(false)
  const [progress, setProgress] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const count = hotDebates.length
  const activeIndex = ((page % count) + count) % count

  const paginate = useCallback(
    (newDir: number) => {
      setPage(([p]) => [p + newDir, newDir])
      setProgress(0)
    },
    []
  )

  useEffect(() => {
    if (count <= 1 || isPaused) {
      if (timerRef.current) clearInterval(timerRef.current)
      if (progressRef.current) clearInterval(progressRef.current)
      return
    }
    setProgress(0)
    const tick = 50
    progressRef.current = setInterval(() => {
      setProgress((prev) => Math.min(prev + (tick / INTERVAL_MS) * 100, 100))
    }, tick)
    timerRef.current = setInterval(() => paginate(1), INTERVAL_MS)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      if (progressRef.current) clearInterval(progressRef.current)
    }
  }, [count, isPaused, page, paginate])

  const goTo = useCallback(
    (idx: number) => {
      const diff = idx - activeIndex
      setPage(([p]) => [p + diff, diff >= 0 ? 1 : -1])
      setProgress(0)
    },
    [activeIndex]
  )

  if (count === 0) return null

  const debate = hotDebates[activeIndex]
  const isFree = !debate.template || debate.template === "free"
  const total = debate.proCount + debate.conCount
  const proPct = total > 0 ? Math.round((debate.proCount / total) * 100) : 50
  const conPct = 100 - proPct

  return (
    <div
      className="hero-neon-lines group relative overflow-hidden rounded-xl border border-white/[0.08] bg-black/30 backdrop-blur"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div className="pointer-events-none absolute inset-0 opacity-30 judge-grid-bg" />

      {/* 슬라이드 — 히어로 */}
      <div className="relative min-h-[200px] sm:min-h-[220px]">
        {/* 좌우 화살표 — 모바일에서 하단 배치 */}
        {count > 1 && (
          <>
            <button
              type="button"
              onClick={() => paginate(-1)}
              className="absolute left-2 z-20 hidden size-10 -translate-y-1/2 place-items-center rounded-full border border-white/10 bg-black/60 text-zinc-400 backdrop-blur transition hover:border-cyan-400/40 hover:bg-black/80 hover:text-cyan-300 sm:left-3 sm:top-1/2 sm:grid"
              aria-label="이전 배틀"
            >
              <ChevronLeft className="size-5" />
            </button>
            <button
              type="button"
              onClick={() => paginate(1)}
              className="absolute right-2 z-20 hidden size-10 -translate-y-1/2 place-items-center rounded-full border border-white/10 bg-black/60 text-zinc-400 backdrop-blur transition hover:border-cyan-400/40 hover:bg-black/80 hover:text-cyan-300 sm:right-3 sm:top-1/2 sm:grid"
              aria-label="다음 배틀"
            >
              <ChevronRight className="size-5" />
            </button>
          </>
        )}

        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={page}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.25 }}
            className="absolute inset-0 flex flex-col justify-center gap-3 px-4 py-5 sm:flex-row sm:items-center sm:gap-8 sm:px-16"
          >
            {/* 좌: 라벨 + 제목 + 게이지 */}
            <div className="min-w-0 flex-1 space-y-3 sm:space-y-4">
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2.5">
                <span className="inline-flex items-center gap-1 rounded-md border border-cyan-400/30 bg-cyan-400/10 px-2 py-0.5 text-[9px] font-bold tracking-[0.15em] text-cyan-300 sm:gap-1.5 sm:px-2.5 sm:py-1 sm:text-[10px]">
                  <Swords className="size-3" />
                  MAIN AGORA
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-orange-400/30 bg-orange-500/15 px-1.5 py-0.5 text-[9px] font-bold text-orange-300 sm:px-2 sm:text-[10px]">
                  <Flame className="size-2.5" />
                  HOT
                </span>
                <span className="text-[10px] tabular-nums text-zinc-500 sm:text-[11px]">
                  {activeIndex + 1}/{count}
                </span>
                {debate.tag && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-1.5 py-0.5 text-[9px] text-zinc-400 sm:px-2 sm:text-[10px]">
                    <Zap className="size-2.5 text-cyan-300" />
                    {debate.tag}
                  </span>
                )}
              </div>
              <h2 className="line-clamp-2 text-base font-extrabold leading-tight text-white sm:text-2xl lg:text-3xl">
                {debate.title}
              </h2>
              {isFree ? (
                /* 자유토론: 참여 현황 바 */
                <div className="flex items-center gap-3 text-[12px] text-zinc-400">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-[#39FF14]/20 bg-[#39FF14]/10 px-2.5 py-1 text-[11px] font-medium text-[#39FF14]/80">
                    FREE
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Users className="size-3" />
                    {total > 0 ? `${total.toLocaleString()}명 참여` : "참여자 대기 중"}
                  </span>
                  {(debate.commentCount ?? 0) > 0 && (
                    <span className="inline-flex items-center gap-1">
                      <MessageSquareText className="size-3" />
                      댓글 {debate.commentCount}
                    </span>
                  )}
                </div>
              ) : (
                /* 찬반토론: 게이지 바 */
                <div className="relative h-3 w-full max-w-md overflow-hidden rounded-full bg-white/[0.08]">
                  <div
                    className="absolute inset-y-0 left-0 rounded-l-full bg-gradient-to-r from-cyan-400 to-sky-400 shadow-[0_0_10px_rgba(34,211,238,0.3)]"
                    style={{ width: `${proPct}%` }}
                  />
                  <div
                    className="absolute inset-y-0 right-0 rounded-r-full bg-gradient-to-l from-fuchsia-400 to-pink-400 shadow-[0_0_10px_rgba(236,72,153,0.3)]"
                    style={{ width: `${conPct}%` }}
                  />
                </div>
              )}
            </div>

            {/* 우: 퍼센트 + CTA */}
            <div className="flex shrink-0 items-center gap-6">
              {!isFree && (
                <div className="hidden items-center gap-5 sm:flex">
                  <div className="text-center">
                    <div className="text-[10px] text-zinc-500">찬성</div>
                    <div className="text-3xl font-extrabold tabular-nums leading-none text-cyan-300">
                      {proPct}<span className="text-sm font-bold">%</span>
                    </div>
                    <div className="mt-1 flex items-center justify-center gap-0.5 text-[11px] text-zinc-500">
                      <ThumbsUp className="size-3" />
                      {debate.proCount.toLocaleString()}
                    </div>
                  </div>
                  <div className="h-12 w-px bg-white/10" />
                  <div className="text-center">
                    <div className="text-[10px] text-zinc-500">반대</div>
                    <div className="text-3xl font-extrabold tabular-nums leading-none text-fuchsia-300">
                      {conPct}<span className="text-sm font-bold">%</span>
                    </div>
                    <div className="mt-1 flex items-center justify-center gap-0.5 text-[11px] text-zinc-500">
                      <ThumbsDown className="size-3" />
                      {debate.conCount.toLocaleString()}
                    </div>
                  </div>
                </div>
              )}
              <Link
                href={`/thread/${debate.id}`}
                className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-xs font-semibold transition ${
                  isFree
                    ? "border-[#39FF14]/30 bg-[#39FF14]/10 text-[#39FF14] hover:bg-[#39FF14]/20 hover:shadow-[0_0_16px_rgba(57,255,20,0.2)]"
                    : "border-cyan-400/30 bg-cyan-400/10 text-cyan-100 hover:bg-cyan-400/20 hover:shadow-[0_0_16px_rgba(34,211,238,0.2)]"
                }`}
              >
                <Sparkles className="size-3.5" />
                {isFree ? "의견 남기기" : "토론 참여"}
              </Link>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* 인디케이터 + 모바일 화살표 */}
      {count > 1 && (
        <div className="relative z-10 flex items-center gap-1.5 px-4 pb-3 sm:px-8">
          {/* 모바일 좌 화살표 */}
          <button
            type="button"
            onClick={() => paginate(-1)}
            className="grid size-7 shrink-0 place-items-center rounded-full border border-white/10 bg-black/40 text-zinc-400 sm:hidden"
            aria-label="이전"
          >
            <ChevronLeft className="size-4" />
          </button>
          {hotDebates.map((_, i) => {
            const isActive = i === activeIndex
            const isPast = i < activeIndex
            return (
              <button
                key={i}
                onClick={() => goTo(i)}
                className="group/bar relative h-1 flex-1 overflow-hidden rounded-full"
                aria-label={`배틀 ${i + 1}`}
              >
                <div className={`absolute inset-0 rounded-full transition-colors duration-300 ${
                  isPast ? "bg-cyan-400/30" : "bg-white/10"
                }`} />
                {isActive && (
                  <div
                    className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-cyan-400 to-cyan-300"
                    style={{ width: `${progress}%`, boxShadow: "0 0 6px rgba(34,211,238,0.5)" }}
                  />
                )}
                {isPast && <div className="absolute inset-0 rounded-full bg-cyan-400/50" />}
              </button>
            )
          })}
          {/* 모바일 우 화살표 */}
          <button
            type="button"
            onClick={() => paginate(1)}
            className="grid size-7 shrink-0 place-items-center rounded-full border border-white/10 bg-black/40 text-zinc-400 sm:hidden"
            aria-label="다음"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      )}
    </div>
  )
}
