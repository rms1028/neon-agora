export type TitleDef = {
  key: string
  name: string
  description: string
  colorClass: string
  bgClass: string
  glowShadow: string
  requiredAchievements: string[]
  minAchievements: number
}

export const TITLES: TitleDef[] = [
  {
    key: "debate_lord",
    name: "논쟁왕",
    description: "토론왕 + 첫 토론 업적 보유",
    colorClass: "text-yellow-200",
    bgClass: "bg-yellow-400/15 border-yellow-400/30",
    glowShadow: "0 0 8px rgba(250,204,21,0.3)",
    requiredAchievements: ["debate_king", "first_thread"],
    minAchievements: 2,
  },
  {
    key: "comment_bomber",
    name: "댓글 폭격기",
    description: "댓글왕 + 첫 댓글 업적 보유",
    colorClass: "text-fuchsia-200",
    bgClass: "bg-fuchsia-400/15 border-fuchsia-400/30",
    glowShadow: "0 0 8px rgba(236,72,153,0.3)",
    requiredAchievements: ["comment_king", "first_comment"],
    minAchievements: 2,
  },
  {
    key: "popular_star",
    name: "인기스타",
    description: "인기스타 업적 보유",
    colorClass: "text-amber-200",
    bgClass: "bg-amber-400/15 border-amber-400/30",
    glowShadow: "0 0 8px rgba(245,158,11,0.3)",
    requiredAchievements: ["popular_star"],
    minAchievements: 1,
  },
  {
    key: "steady_warrior",
    name: "꾸준한 전사",
    description: "7일 연속 활동 업적 보유",
    colorClass: "text-orange-200",
    bgClass: "bg-orange-400/15 border-orange-400/30",
    glowShadow: "0 0 8px rgba(249,115,22,0.3)",
    requiredAchievements: ["streak_7"],
    minAchievements: 1,
  },
  {
    key: "pioneer",
    name: "선구자",
    description: "첫 투표 + 첫 댓글 + 첫 토론 모두 달성",
    colorClass: "text-cyan-200",
    bgClass: "bg-cyan-400/15 border-cyan-400/30",
    glowShadow: "0 0 8px rgba(34,211,238,0.3)",
    requiredAchievements: ["first_vote", "first_comment", "first_thread"],
    minAchievements: 3,
  },
  {
    key: "all_rounder",
    name: "올라운더",
    description: "업적 6개 이상 달성",
    colorClass: "text-violet-200",
    bgClass: "bg-violet-400/15 border-violet-400/30",
    glowShadow: "0 0 8px rgba(139,92,246,0.3)",
    requiredAchievements: [],
    minAchievements: 6,
  },
  {
    key: "streak_legend",
    name: "스트릭 전설",
    description: "30일 연속 활동 업적 보유",
    colorClass: "text-red-200",
    bgClass: "bg-red-400/15 border-red-400/30",
    glowShadow: "0 0 8px rgba(239,68,68,0.3)",
    requiredAchievements: ["streak_30"],
    minAchievements: 1,
  },
  {
    key: "debate_god",
    name: "토론의 신",
    description: "투표 마스터 + 토론 마라톤 + 코칭 마스터",
    colorClass: "text-amber-200",
    bgClass: "bg-amber-400/15 border-amber-400/30",
    glowShadow: "0 0 10px rgba(245,158,11,0.4)",
    requiredAchievements: ["vote_100", "debate_marathon", "coach_master"],
    minAchievements: 3,
  },
]

export function getAvailableTitles(achievements: string[]): TitleDef[] {
  return TITLES.filter((t) => {
    // 올라운더: 업적 총 개수 기준
    if (t.requiredAchievements.length === 0) {
      return achievements.length >= t.minAchievements
    }
    // 나머지: 필요 업적 모두 보유
    const has = t.requiredAchievements.every((a) => achievements.includes(a))
    return has
  })
}

export function getTitle(key: string): TitleDef | undefined {
  return TITLES.find((t) => t.key === key)
}
