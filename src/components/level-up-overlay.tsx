"use client"

import { useEffect, useMemo } from "react"
import { createPortal } from "react-dom"
import { ArrowRight, X } from "lucide-react"

import { useProfile } from "@/components/profile-provider"

// ─── 20개 파티클의 방사 각도 미리 계산 ────────────────────────
const PARTICLE_COUNT = 20
const PARTICLE_COLORS = [
  "rgba(34,211,238,0.8)",   // cyan
  "rgba(236,72,153,0.8)",   // fuchsia
  "rgba(52,211,153,0.8)",   // emerald
  "rgba(139,92,246,0.8)",   // violet
]

export function NumericLevelUpOverlay() {
  const { numericLevelUp, dismissNumericLevelUp } = useProfile()

  const particles = useMemo(() =>
    Array.from({ length: PARTICLE_COUNT }, (_, i) => {
      const angle = (360 / PARTICLE_COUNT) * i
      const color = PARTICLE_COLORS[i % PARTICLE_COLORS.length]
      return { angle, color, delay: (i * 0.05).toFixed(2) }
    }), []
  )

  useEffect(() => {
    if (!numericLevelUp) return
    const timer = setTimeout(dismissNumericLevelUp, 2500)
    return () => clearTimeout(timer)
  }, [numericLevelUp, dismissNumericLevelUp])

  if (!numericLevelUp || typeof document === "undefined") return null

  return createPortal(
    <div
      className="numeric-level-card fixed inset-0 z-[9998] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={dismissNumericLevelUp}
    >
      <div className="relative flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
        {/* 파티클 폭발 */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          {particles.map((p, i) => (
            <div
              key={i}
              className="level-particle-explode absolute size-2 rounded-full"
              style={{
                backgroundColor: p.color,
                "--particle-angle": `${p.angle}deg`,
                animationDelay: `${p.delay}s`,
              } as React.CSSProperties}
            />
          ))}
        </div>

        {/* 레벨 텍스트 */}
        <div className="level-number-glow text-center">
          <div className="text-sm font-semibold tracking-[0.3em] text-cyan-400/80">
            LEVEL UP
          </div>
          <div className="mt-1 text-6xl font-black text-transparent bg-clip-text bg-gradient-to-b from-cyan-300 via-fuchsia-300 to-violet-400"
            style={{ textShadow: "0 0 40px rgba(34,211,238,0.5), 0 0 80px rgba(236,72,153,0.3)" }}
          >
            Lv.{numericLevelUp.newLevel}
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}

export function LevelUpOverlay() {
  const { levelUp, dismissLevelUp } = useProfile()

  // 4.5초 후 자동 닫기
  useEffect(() => {
    if (!levelUp) return
    const timer = setTimeout(dismissLevelUp, 4500)
    return () => clearTimeout(timer)
  }, [levelUp, dismissLevelUp])

  if (!levelUp || typeof document === "undefined") return null

  const { oldBadge, newBadge, oldTier, newTier } = levelUp

  // 네온 버스트 색상 — 신 티어의 주 색상
  const burstColorMap: Record<string, string> = {
    "네온 뉴비": "rgba(34,211,238,0.6)",
    "사이버 용병": "rgba(139,92,246,0.6)",
    "엘리트 해커": "rgba(236,72,153,0.6)",
    "아고라 지배자": "rgba(234,179,8,0.6)",
  }
  const burstColor = burstColorMap[newBadge] ?? "rgba(139,92,246,0.6)"

  return createPortal(
    <div
      className="level-up-backdrop fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={dismissLevelUp}
    >
      <div
        className="level-up-card-enter relative mx-4 w-full max-w-sm rounded-3xl border border-white/15 bg-zinc-950/95 p-8 text-center shadow-2xl backdrop-blur"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 닫기 버튼 */}
        <button
          type="button"
          onClick={dismissLevelUp}
          className="absolute right-4 top-4 grid size-7 place-items-center rounded-lg border border-white/10 bg-white/5 text-zinc-400 transition hover:bg-white/10 hover:text-zinc-100"
          aria-label="닫기"
        >
          <X className="size-4" />
        </button>

        {/* 타이틀 */}
        <div className="level-up-title mb-6">
          <h2 className="cyber-glitch-text text-2xl font-black tracking-[0.3em] text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-fuchsia-300 to-cyan-300">
            LEVEL UP
          </h2>
        </div>

        {/* 배지 전환 */}
        <div className="relative flex items-center justify-center gap-4 py-4">
          {/* 네온 버스트 링 */}
          <div
            className="level-up-neon-burst pointer-events-none absolute inset-0 mx-auto my-auto size-20 rounded-full"
            style={{ "--burst-color": burstColor } as React.CSSProperties}
          />

          {/* 구 배지 */}
          <div className="flex flex-col items-center gap-2">
            <div
              className="level-up-old-badge grid size-16 place-items-center rounded-2xl border border-white/10"
              style={{ background: `linear-gradient(135deg, ${oldTier.cardGradient.includes("cyan") ? "rgba(34,211,238,0.2)" : oldTier.cardGradient.includes("violet") ? "rgba(139,92,246,0.2)" : oldTier.cardGradient.includes("fuchsia") ? "rgba(236,72,153,0.2)" : "rgba(234,179,8,0.2)"}, transparent)` }}
            >
              <span className="text-2xl">
                {oldBadge === "네온 뉴비" ? "🌱" : oldBadge === "사이버 용병" ? "⚔️" : oldBadge === "엘리트 해커" ? "💎" : "👑"}
              </span>
            </div>
            <span className="text-[10px] text-zinc-500">{oldBadge}</span>
          </div>

          {/* 화살표 */}
          <ArrowRight className="size-6 text-zinc-500" />

          {/* 신 배지 */}
          <div className="flex flex-col items-center gap-2">
            <div
              className="level-up-new-badge grid size-16 place-items-center rounded-2xl border border-white/10"
              style={{
                background: `linear-gradient(135deg, ${newTier.cardGradient.includes("cyan") ? "rgba(34,211,238,0.3)" : newTier.cardGradient.includes("violet") ? "rgba(139,92,246,0.3)" : newTier.cardGradient.includes("fuchsia") ? "rgba(236,72,153,0.3)" : "rgba(234,179,8,0.3)"}, transparent)`,
                boxShadow: newTier.glowShadow,
              }}
            >
              <span className="text-3xl">
                {newBadge === "네온 뉴비" ? "🌱" : newBadge === "사이버 용병" ? "⚔️" : newBadge === "엘리트 해커" ? "💎" : "👑"}
              </span>
            </div>
            <span className={`text-xs font-semibold ${newTier.textClass}`}>{newBadge}</span>
          </div>
        </div>

        {/* 파티클 */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-3xl">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className={`xp-particle absolute size-1.5 rounded-full ${i % 2 === 0 ? "bg-cyan-400/60" : "bg-fuchsia-400/60"} ${i < 2 ? "" : i < 4 ? "xp-particle-delay-1" : "xp-particle-delay-2"}`}
              style={{
                left: `${15 + i * 14}%`,
                top: `${60 + (i % 3) * 10}%`,
              }}
            />
          ))}
        </div>

        {/* 메시지 */}
        <p className="mt-6 text-sm text-zinc-300">
          축하합니다! 새로운 등급을 획득했습니다
        </p>

        {/* 확인 버튼 */}
        <button
          type="button"
          onClick={dismissLevelUp}
          className={`mt-5 inline-flex items-center gap-2 rounded-xl border px-6 py-2.5 text-sm font-semibold transition ${newTier.pillClasses} hover:brightness-110`}
        >
          확인
        </button>
      </div>
    </div>,
    document.body
  )
}
