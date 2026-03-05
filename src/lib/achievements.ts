export type AchievementDef = {
  key: string
  name: string
  description: string
  icon: string // lucide icon name
  color: string // tailwind text color class
  glowColor: string // glow shadow color rgba
}

export const ACHIEVEMENTS: AchievementDef[] = [
  {
    key: "first_vote",
    name: "첫 투표",
    description: "첫 번째 투표 완료",
    icon: "ThumbsUp",
    color: "text-cyan-300",
    glowColor: "rgba(34,211,238,0.4)",
  },
  {
    key: "first_comment",
    name: "첫 댓글",
    description: "첫 번째 댓글 작성",
    icon: "MessageSquare",
    color: "text-emerald-300",
    glowColor: "rgba(52,211,153,0.4)",
  },
  {
    key: "first_thread",
    name: "첫 토론",
    description: "첫 번째 토론 개설",
    icon: "Sparkles",
    color: "text-violet-300",
    glowColor: "rgba(139,92,246,0.4)",
  },
  {
    key: "debate_king",
    name: "토론왕",
    description: "토론 10개 이상 개설",
    icon: "Crown",
    color: "text-yellow-300",
    glowColor: "rgba(250,204,21,0.4)",
  },
  {
    key: "comment_king",
    name: "댓글왕",
    description: "댓글 50개 이상 작성",
    icon: "Zap",
    color: "text-fuchsia-300",
    glowColor: "rgba(236,72,153,0.4)",
  },
  {
    key: "popular_star",
    name: "인기스타",
    description: "좋아요 100개 이상 획득",
    icon: "Star",
    color: "text-amber-300",
    glowColor: "rgba(245,158,11,0.4)",
  },
  {
    key: "streak_3",
    name: "3일 연속",
    description: "3일 연속 활동",
    icon: "Flame",
    color: "text-orange-300",
    glowColor: "rgba(249,115,22,0.4)",
  },
  {
    key: "streak_7",
    name: "7일 연속",
    description: "7일 연속 활동",
    icon: "Trophy",
    color: "text-red-300",
    glowColor: "rgba(239,68,68,0.4)",
  },
  {
    key: "streak_14",
    name: "2주 연속",
    description: "14일 연속 활동",
    icon: "Flame",
    color: "text-orange-400",
    glowColor: "rgba(249,115,22,0.5)",
  },
  {
    key: "streak_30",
    name: "한 달 연속",
    description: "30일 연속 활동",
    icon: "Flame",
    color: "text-red-400",
    glowColor: "rgba(239,68,68,0.5)",
  },
  {
    key: "vote_100",
    name: "투표 마스터",
    description: "투표 100회 이상",
    icon: "ThumbsUp",
    color: "text-blue-300",
    glowColor: "rgba(59,130,246,0.4)",
  },
  {
    key: "debate_marathon",
    name: "토론 마라톤",
    description: "댓글 100개 이상 작성",
    icon: "MessageSquare",
    color: "text-emerald-400",
    glowColor: "rgba(52,211,153,0.5)",
  },
  {
    key: "unanimous_winner",
    name: "압도적 승리",
    description: "내 토론 80%+ 찬성 (최소 10표)",
    icon: "Crown",
    color: "text-yellow-400",
    glowColor: "rgba(250,204,21,0.5)",
  },
  {
    key: "night_owl",
    name: "야행성 토론가",
    description: "자정~새벽 4시 댓글 10개+",
    icon: "Moon",
    color: "text-indigo-300",
    glowColor: "rgba(99,102,241,0.4)",
  },
  {
    key: "coach_master",
    name: "코칭 마스터",
    description: "AI 코칭 10회 이상 사용",
    icon: "GraduationCap",
    color: "text-teal-300",
    glowColor: "rgba(20,184,166,0.4)",
  },
  {
    key: "season_champion",
    name: "시즌 챔피언",
    description: "시즌 랭킹 1위 달성",
    icon: "Trophy",
    color: "text-amber-400",
    glowColor: "rgba(245,158,11,0.5)",
  },
  {
    key: "logic_king",
    name: "논리왕",
    description: "AI 코칭 평균 90점+ 3회 달성",
    icon: "Brain",
    color: "text-cyan-300",
    glowColor: "rgba(34,211,238,0.5)",
  },
  {
    key: "agora_star",
    name: "아고라의 별",
    description: "좋아요 50개 이상 획득",
    icon: "Star",
    color: "text-yellow-300",
    glowColor: "rgba(234,179,8,0.5)",
  },
]

export function getAchievement(key: string): AchievementDef | undefined {
  return ACHIEVEMENTS.find((a) => a.key === key)
}
