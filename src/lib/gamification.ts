// ─── Gamification v2: XP 가중치 + 레벨 공식 + 특별 뱃지 ────────────────────

// XP 가중치 — 행동별 XP 보상
export const XP_WEIGHTS: Record<string, number> = {
  comment: 5,
  vote: 2,
  respect: 15,
  thread: 10,
  quest_thread: 20,
  quest_comment: 20,
  fact_check: 8,
  coaching: 5,
  live_message: 3,
}

export const DAILY_XP_LIMIT = 200

// ─── 레벨 공식: Level = floor(sqrt(totalXp / 100)) + 1 ────────────────────

export function getLevel(totalXp: number): number {
  const safe = Math.max(0, totalXp)
  return Math.floor(Math.sqrt(safe / 100)) + 1
}

export function getLevelProgress(totalXp: number): {
  level: number
  currentXp: number
  nextLevelXp: number
  pct: number
} {
  const safe = Math.max(0, totalXp)
  const level = getLevel(safe)

  // XP needed to reach current level:  (level - 1)^2 * 100
  // XP needed to reach next level:     level^2 * 100
  const currentLevelStart = (level - 1) ** 2 * 100
  const nextLevelStart = level ** 2 * 100

  const currentXp = safe - currentLevelStart
  const nextLevelXp = nextLevelStart - currentLevelStart

  return {
    level,
    currentXp,
    nextLevelXp,
    pct: nextLevelXp > 0 ? Math.min(100, Math.round((currentXp / nextLevelXp) * 100)) : 100,
  }
}

// ─── 특별 뱃지(Featured Badge) 정의 ────────────────────────────────────────

export type FeaturedBadgeDef = {
  key: string
  name: string
  icon: string
  neonColor: string
  borderClass: string
  bgClass: string
  textClass: string
}

export const FEATURED_BADGES: FeaturedBadgeDef[] = [
  {
    key: "logic_king",
    name: "논리왕",
    icon: "🧠",
    neonColor: "rgba(34,211,238,0.6)",
    borderClass: "border-cyan-400/40",
    bgClass: "bg-cyan-400/10",
    textClass: "text-cyan-300",
  },
  {
    key: "agora_star",
    name: "아고라의 별",
    icon: "⭐",
    neonColor: "rgba(234,179,8,0.6)",
    borderClass: "border-yellow-400/40",
    bgClass: "bg-yellow-400/10",
    textClass: "text-yellow-300",
  },
]

export function getFeaturedBadge(key: string): FeaturedBadgeDef | undefined {
  return FEATURED_BADGES.find((b) => b.key === key)
}
