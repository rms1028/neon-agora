"use client"

import { Award, CheckCircle2, Circle, Flame, Shield, Swords, Target, Zap } from "lucide-react"

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { useAuth } from "@/components/auth-provider"
import { useProfile } from "@/components/profile-provider"
import { getTier, xpProgress, TIERS } from "@/lib/xp"
import { getLevelProgress, DAILY_XP_LIMIT } from "@/lib/gamification"

// 티어별 XP 글로우 색상
const TIER_GLOW_COLOR: Record<string, string> = {
  "네온 뉴비":    "rgba(34,211,238,0.6)",
  "사이버 용병":  "rgba(139,92,246,0.6)",
  "엘리트 해커":  "rgba(236,72,153,0.6)",
  "아고라 지배자": "rgba(234,179,8,0.6)",
}

const TIER_PROGRESS_COLOR: Record<string, string> = {
  "네온 뉴비":    "rgba(34,211,238,0.85)",
  "사이버 용병":  "rgba(139,92,246,0.85)",
  "엘리트 해커":  "rgba(236,72,153,0.85)",
  "아고라 지배자": "rgba(234,179,8,0.85)",
}

export function MissionCard() {
  const { user } = useAuth()
  const { profile, dailyStats } = useProfile()
  const streakDays = profile?.streakDays ?? dailyStats.streakDays ?? 0

  const xp = profile?.xp ?? 0
  const tier = getTier(xp)
  const badge = profile?.badge ?? (user ? "로딩 중..." : "로그인이 필요해요")
  const { pct, current, total, next } = xpProgress(xp)
  const levelInfo = getLevelProgress(xp)
  const dailyXpEarned = profile?.dailyXpEarned ?? 0
  const dailyXpCapped = dailyXpEarned >= DAILY_XP_LIMIT

  const quest1Done = dailyStats.questThreadDone
  const quest2Done = dailyStats.questCommentDone
  const commentProgress = Math.min(3, dailyStats.comments)
  const progressColor = TIER_PROGRESS_COLOR[tier.badgeName] ?? "rgba(34,211,238,0.85)"
  const glowColor = TIER_GLOW_COLOR[tier.badgeName] ?? "rgba(34,211,238,0.6)"

  return (
    <Card className="hud-card border-white/10 bg-black/30 backdrop-blur">
      <CardHeader className="gap-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className="grid size-7 place-items-center rounded-lg border border-cyan-400/30 bg-cyan-400/10 text-cyan-300"
              style={{ boxShadow: "0 0 12px rgba(34,211,238,0.2)" }}
            >
              <Target className="size-3.5" />
            </div>
            <div>
              <CardTitle className="text-sm text-zinc-100">HUD</CardTitle>
              <p className="text-[9px] tracking-[0.2em] text-zinc-500">MISSION CONTROL</p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-0.5 text-[9px] font-semibold text-emerald-400">
            <span className="size-1.5 rounded-full bg-emerald-400 shadow-[0_0_4px_rgba(52,211,153,0.8)]" />
            ONLINE
          </span>
        </div>
      </CardHeader>
      <CardContent className="relative z-10 space-y-4">
        {/* ── XP / 배지 HUD ── */}
        <div className="rounded-xl border border-white/10 bg-gradient-to-br from-white/[0.04] to-white/[0.01] p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="text-[10px] tracking-widest text-zinc-500">CURRENT RANK</div>
              <div className="flex items-center gap-2">
                <div className={`text-sm font-bold ${tier.textClass}`}>
                  {badge}
                </div>
                {user && (
                  <span className="level-number-glow inline-flex items-center rounded-md border border-cyan-400/30 bg-cyan-400/10 px-1.5 py-0.5 text-[10px] font-bold text-cyan-300">
                    Lv.{levelInfo.level}
                  </span>
                )}
              </div>
            </div>
            <span
              className={`xp-bar-glow inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-bold ${tier.pillClasses}`}
              style={{ "--xp-glow-color": glowColor } as React.CSSProperties}
            >
              <Zap className="size-3.5" />
              {xp} XP
            </span>
          </div>

          {/* XP 프로그레스 바 + 파티클 */}
          <div className="relative mt-3">
            <div className="relative">
              <Progress
                value={pct}
                className={`h-3 bg-white/10 ${tier.progressIndicator} [&_[data-slot=progress-indicator]]:transition-all [&_[data-slot=progress-indicator]]:duration-500`}
              />
              {/* 네온 파티클 — 프로그레스 바 끝부분에서 부유 */}
              {pct > 0 && pct < 100 && user && (
                <div
                  className="absolute top-0"
                  style={{ left: `${Math.min(pct, 95)}%` }}
                >
                  <span
                    className="xp-particle absolute size-1.5 rounded-full"
                    style={{ backgroundColor: progressColor }}
                  />
                  <span
                    className="xp-particle xp-particle-delay-1 absolute left-1 size-1 rounded-full"
                    style={{ backgroundColor: progressColor }}
                  />
                  <span
                    className="xp-particle xp-particle-delay-2 absolute -left-0.5 size-1 rounded-full opacity-60"
                    style={{ backgroundColor: progressColor }}
                  />
                </div>
              )}
            </div>
            <div className="mt-2 text-xs text-zinc-400">
              {!user
                ? "로그인하면 XP를 모을 수 있어요."
                : next
                  ? `다음 배지: ${next} (${current} / ${total} XP)`
                  : "최고 등급 달성!"}
            </div>

            {/* 레벨 진행도 바 */}
            {user && (
              <div className="mt-3">
                <div className="mb-1 flex items-center justify-between text-[10px] text-zinc-500">
                  <span>Lv.{levelInfo.level} → Lv.{levelInfo.level + 1}</span>
                  <span>{levelInfo.currentXp} / {levelInfo.nextLevelXp} XP</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-fuchsia-400 transition-all duration-700"
                    style={{ width: `${levelInfo.pct}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── 배지 컬렉션: 빛나는 슬롯 ── */}
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
          <div className="mb-3 text-[10px] font-semibold tracking-[0.2em] text-zinc-500">
            BADGE COLLECTION
          </div>
          <div className="grid grid-cols-4 gap-2">
            {TIERS.map((t) => {
              const isUnlocked = xp >= t.minXp
              const isCurrent = tier.badgeName === t.badgeName
              return (
                <div
                  key={t.badgeName}
                  className={`relative flex flex-col items-center gap-1.5 rounded-lg border p-2.5 transition-all ${
                    isCurrent
                      ? `badge-slot-active border-white/20 bg-gradient-to-br ${t.cardGradient}`
                      : isUnlocked
                        ? "border-white/10 bg-white/5"
                        : "border-white/[0.04] bg-white/[0.01] opacity-40"
                  }`}
                >
                  <div
                    className={`grid size-8 place-items-center rounded-lg bg-gradient-to-br ${
                      isUnlocked ? t.avatarGradient : "from-zinc-600 to-zinc-700"
                    } ${isCurrent ? "animate-pulse" : ""}`}
                    style={isCurrent ? { boxShadow: t.avatarShadow } : undefined}
                  >
                    {isUnlocked ? (
                      <Award className="size-4 text-black" />
                    ) : (
                      <Shield className="size-4 text-zinc-500" />
                    )}
                  </div>
                  <span className={`text-center text-[9px] font-medium leading-tight ${
                    isCurrent ? t.textClass : isUnlocked ? "text-zinc-300" : "text-zinc-600"
                  }`}>
                    {t.badgeName}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── 연속 활동 스트릭 ── */}
        {user && streakDays > 0 && (
          <div className="rounded-xl border border-orange-400/20 bg-orange-400/5 p-4">
            <div className="mb-2 text-[10px] font-semibold tracking-[0.2em] text-zinc-500">
              STREAK
            </div>
            <div className="flex items-center gap-3">
              <div className="streak-flame grid size-10 place-items-center rounded-lg border border-orange-400/30 bg-orange-400/10">
                <Flame className="size-5 text-orange-400" />
              </div>
              <div>
                <div className="streak-glow text-lg font-bold text-orange-300">
                  {streakDays}일 연속
                </div>
                <div className="text-[10px] text-zinc-500">
                  {streakDays >= 30 ? "전설의 스트릭!" :
                   streakDays >= 14 ? "대단해요! 목표: 30일" :
                   streakDays >= 7 ? "좋은 습관! 목표: 14일" :
                   streakDays >= 3 ? "꾸준해요! 목표: 7일" :
                   "목표: 3일"}
                </div>
              </div>
            </div>
            {/* 마일스톤 바 */}
            <div className="mt-3 flex gap-1">
              {[3, 7, 14, 30].map((milestone) => (
                <div key={milestone} className="flex-1">
                  <div
                    className={`h-1.5 rounded-full transition-all ${
                      streakDays >= milestone
                        ? "bg-orange-400 shadow-[0_0_6px_rgba(249,115,22,0.4)]"
                        : "bg-white/10"
                    }`}
                  />
                  <div className={`mt-1 text-center text-[8px] ${
                    streakDays >= milestone ? "text-orange-300" : "text-zinc-600"
                  }`}>
                    {milestone}d
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── 데일리 퀘스트 ── */}
        {user && (
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-[10px] font-semibold tracking-[0.2em] text-zinc-500">
                DAILY QUEST
              </div>
              <span className="text-[10px] font-bold tabular-nums text-zinc-400">
                {dailyXpEarned} / {DAILY_XP_LIMIT} XP
              </span>
            </div>

            {/* 일일 XP 게이지 */}
            <div className="relative h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  dailyXpCapped
                    ? "bg-gradient-to-r from-emerald-400 to-emerald-300"
                    : "bg-gradient-to-r from-cyan-400 to-violet-400"
                }`}
                style={{ width: `${Math.min(100, (dailyXpEarned / DAILY_XP_LIMIT) * 100)}%` }}
              />
            </div>
            {dailyXpCapped && (
              <div className="text-center text-[10px] font-medium text-emerald-400">
                오늘의 성장이 완료되었습니다
              </div>
            )}

            {/* 퀘스트 1: 새 토론 1개 열기 */}
            <div
              className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 transition-all ${
                quest1Done
                  ? "border-emerald-400/20 bg-emerald-400/5 opacity-70"
                  : "border-white/[0.06] bg-white/[0.02]"
              }`}
            >
              <div className="flex items-center gap-2">
                {quest1Done ? (
                  <CheckCircle2 className="size-4 shrink-0 text-emerald-400" />
                ) : (
                  <Circle className="size-4 shrink-0 text-zinc-600" />
                )}
                <span className="text-xs text-zinc-300">
                  새 토론 1개 열기
                  {quest1Done && (
                    <span className="ml-1.5 text-[10px] font-semibold text-emerald-400">
                      CLEAR!
                    </span>
                  )}
                </span>
              </div>
              <span
                className={`text-xs font-bold ${quest1Done ? "text-emerald-400" : "text-zinc-500"}`}
              >
                +100 XP
              </span>
            </div>

            {/* 퀘스트 2: 댓글 3개 달기 */}
            <div className={`space-y-2 rounded-lg border px-3 py-2 transition-all ${
              quest2Done
                ? "border-emerald-400/20 bg-emerald-400/5 opacity-70"
                : "border-white/[0.06] bg-white/[0.02]"
            }`}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {quest2Done ? (
                    <CheckCircle2 className="size-4 shrink-0 text-emerald-400" />
                  ) : (
                    <Circle className="size-4 shrink-0 text-zinc-600" />
                  )}
                  <span className="text-xs text-zinc-300">
                    댓글 3개 달기 ({commentProgress}/3)
                    {quest2Done && (
                      <span className="ml-1.5 text-[10px] font-semibold text-emerald-400">
                        CLEAR!
                      </span>
                    )}
                  </span>
                </div>
                <span
                  className={`text-xs font-bold ${quest2Done ? "text-emerald-400" : "text-zinc-500"}`}
                >
                  +50 XP
                </span>
              </div>
              {!quest2Done && (
                <div className="ml-6 h-2 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="xp-bar-glow h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${(commentProgress / 3) * 100}%`,
                      backgroundColor: progressColor,
                      "--xp-glow-color": glowColor,
                    } as React.CSSProperties}
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
