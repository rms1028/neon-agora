// ─── Tier 시스템 ────────────────────────────────────────────────────────────
// XP 임계값: 0-100 / 101-300 / 301-600 / 601+

export type Badge = string

export type TierConfig = {
  badgeName: string
  minXp: number
  maxXp: number
  // inline style (box-shadow) — complex values, unsafe as Tailwind arbitrary
  glowShadow: string
  avatarShadow: string
  // Tailwind class strings — appear as literals here so Tailwind v4 scans them
  cardGradient: string      // from-/via-/to- classes for bg-gradient-to-r wrapper
  avatarGradient: string    // from-/via-/to- classes for bg-gradient-to-br avatar
  pillClasses: string       // border + bg + text for badge/XP pills
  textClass: string         // text-X color only (accent text)
  progressIndicator: string // [&_[data-slot=progress-indicator]]:... color class
}

export const TIERS: TierConfig[] = [
  {
    // ── Tier 1: 네온 뉴비 ── cyan ────────────────────────────────────────────
    badgeName: "네온 뉴비",
    minXp: 0,
    maxXp: 100,
    glowShadow:
      "0 0 40px rgba(34,211,238,0.18), 0 0 80px rgba(34,211,238,0.08)",
    avatarShadow: "0 0 28px rgba(34,211,238,0.45)",
    cardGradient: "from-cyan-500/25 via-sky-500/10 to-cyan-400/10",
    avatarGradient: "from-cyan-300 via-sky-300 to-cyan-400",
    pillClasses: "border-cyan-400/30 bg-cyan-400/10 text-cyan-200",
    textClass: "text-cyan-200",
    progressIndicator: "[&_[data-slot=progress-indicator]]:bg-cyan-400",
  },
  {
    // ── Tier 2: 사이버 용병 ── violet/purple ─────────────────────────────────
    badgeName: "사이버 용병",
    minXp: 101,
    maxXp: 300,
    glowShadow:
      "0 0 50px rgba(139,92,246,0.22), 0 0 100px rgba(139,92,246,0.12)",
    avatarShadow: "0 0 36px rgba(139,92,246,0.55)",
    cardGradient: "from-violet-500/25 via-purple-500/12 to-indigo-400/12",
    avatarGradient: "from-violet-300 via-purple-300 to-indigo-300",
    pillClasses: "border-violet-400/35 bg-violet-400/10 text-violet-200",
    textClass: "text-violet-200",
    progressIndicator: "[&_[data-slot=progress-indicator]]:bg-violet-400",
  },
  {
    // ── Tier 3: 엘리트 해커 ── fuchsia/pink ──────────────────────────────────
    badgeName: "엘리트 해커",
    minXp: 301,
    maxXp: 600,
    glowShadow:
      "0 0 60px rgba(236,72,153,0.28), 0 0 120px rgba(236,72,153,0.14), 0 0 200px rgba(236,72,153,0.06)",
    avatarShadow:
      "0 0 40px rgba(236,72,153,0.55), 0 0 16px rgba(236,72,153,0.70)",
    cardGradient: "from-fuchsia-500/30 via-pink-500/15 to-rose-400/15",
    avatarGradient: "from-fuchsia-300 via-pink-300 to-rose-300",
    pillClasses: "border-fuchsia-400/35 bg-fuchsia-400/10 text-fuchsia-200",
    textClass: "text-fuchsia-200",
    progressIndicator: "[&_[data-slot=progress-indicator]]:bg-fuchsia-400",
  },
  {
    // ── Tier 4: 아고라 지배자 ── gold/amber ───────────────────────────────────
    badgeName: "아고라 지배자",
    minXp: 601,
    maxXp: Infinity,
    glowShadow:
      "0 0 80px rgba(234,179,8,0.35), 0 0 160px rgba(234,179,8,0.18), 0 0 280px rgba(234,179,8,0.08)",
    avatarShadow:
      "0 0 50px rgba(234,179,8,0.60), 0 0 20px rgba(251,191,36,0.75)",
    cardGradient: "from-yellow-500/30 via-amber-500/18 to-orange-400/18",
    avatarGradient: "from-yellow-300 via-amber-300 to-orange-300",
    pillClasses: "border-yellow-400/40 bg-yellow-400/10 text-yellow-200",
    textClass: "text-yellow-200",
    progressIndicator: "[&_[data-slot=progress-indicator]]:bg-yellow-400",
  },
]

// ─── 유틸리티 함수 ──────────────────────────────────────────────────────────

export function getTier(xp: number): TierConfig {
  const safeXp = Math.max(0, xp)
  for (let i = TIERS.length - 1; i >= 0; i--) {
    if (safeXp >= TIERS[i].minXp) return TIERS[i]
  }
  return TIERS[0]
}

export function xpToBadge(xp: number): Badge {
  return getTier(xp).badgeName
}

// ─── Re-export gamification v2 유틸리티 ──────────────────────────────────
export { getLevel, getLevelProgress } from "@/lib/gamification"

export function xpProgress(xp: number): {
  pct: number
  current: number
  total: number
  next: string | null
} {
  const safeXp = Math.max(0, xp)
  const tierIdx = TIERS.findIndex((t) => safeXp <= t.maxXp)
  const tier = TIERS[tierIdx] ?? TIERS[TIERS.length - 1]

  if (tier.maxXp === Infinity) {
    return { pct: 100, current: safeXp, total: safeXp, next: null }
  }

  const nextTier = TIERS[tierIdx + 1]
  const rangeStart = tier.minXp
  // nextTier.minXp is the XP needed to reach it
  const rangeEnd = nextTier.minXp
  const current = safeXp - rangeStart
  const total = rangeEnd - rangeStart

  return {
    pct: Math.min(100, Math.round((current / total) * 100)),
    current,
    total,
    next: nextTier.badgeName,
  }
}
