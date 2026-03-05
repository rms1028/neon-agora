"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"

import { supabase } from "@/lib/supabase"
import { xpToBadge, getTier, type Badge, type TierConfig } from "@/lib/xp"
import { getLevel } from "@/lib/gamification"
import { XP_WEIGHTS, DAILY_XP_LIMIT } from "@/lib/gamification"
import { useAuth } from "@/components/auth-provider"
import { useToast } from "@/components/toast-provider"
import { getAchievement } from "@/lib/achievements"

type Profile = {
  xp: number
  badge: Badge
  customTitle: string | null
  streakDays: number
  lastActiveDate: string | null
  displayName: string | null
  avatarUrl: string | null
  bio: string | null
  level: number
  dailyXpEarned: number
  dailyXpDate: string | null
  bannedUntil: string | null
}

export type LevelUpInfo = {
  oldBadge: Badge
  newBadge: Badge
  oldTier: TierConfig
  newTier: TierConfig
}

export type DailyStats = {
  date: string
  threads: number
  comments: number
  questThreadDone: boolean
  questCommentDone: boolean
  streakDays: number
  lastActiveDate: string
}

export type NumericLevelUpInfo = {
  newLevel: number
}

type ProfileContextValue = {
  profile: Profile | null
  isBanned: boolean
  addXp: (amount: number) => Promise<void>
  awardXp: (action: string) => Promise<void>
  dailyStats: DailyStats
  trackActivity: (type: "thread" | "comment") => Promise<void>
  achievements: string[]
  checkAchievements: () => Promise<void>
  levelUp: LevelUpInfo | null
  dismissLevelUp: () => void
  numericLevelUp: NumericLevelUpInfo | null
  dismissNumericLevelUp: () => void
  setCustomTitle: (key: string | null) => void
  refreshDisplayName: (name: string | null) => void
}

// ── localStorage 헬퍼 ──────────────────────────────────────────────
function todayStr() {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000)
  return kst.toISOString().split("T")[0]
}

const EMPTY: DailyStats = {
  date: "",
  threads: 0,
  comments: 0,
  questThreadDone: false,
  questCommentDone: false,
  streakDays: 0,
  lastActiveDate: "",
}

function loadDailyStats(): DailyStats {
  if (typeof window === "undefined") return { ...EMPTY, date: todayStr() }
  try {
    const raw = localStorage.getItem("neon_daily_stats")
    if (!raw) return { ...EMPTY, date: todayStr() }
    const parsed = JSON.parse(raw) as DailyStats
    if (parsed.date !== todayStr()) {
      // 날짜 바뀌면 스트릭 계산
      const kstNow = new Date(Date.now() + 9 * 60 * 60 * 1000)
      kstNow.setDate(kstNow.getDate() - 1)
      const yStr = kstNow.toISOString().split("T")[0]
      const streakDays =
        parsed.lastActiveDate === yStr ? (parsed.streakDays ?? 0) : 0
      return {
        ...EMPTY,
        date: todayStr(),
        streakDays,
        lastActiveDate: parsed.lastActiveDate ?? "",
      }
    }
    return parsed
  } catch {
    return { ...EMPTY, date: todayStr() }
  }
}

function saveDailyStats(stats: DailyStats) {
  if (typeof window !== "undefined") {
    localStorage.setItem("neon_daily_stats", JSON.stringify(stats))
  }
}

// ── Context ───────────────────────────────────────────────────────
const ProfileContext = createContext<ProfileContextValue>({
  profile: null,
  isBanned: false,
  addXp: async () => {},
  awardXp: async () => {},
  dailyStats: { ...EMPTY, date: "" },
  trackActivity: async () => {},
  achievements: [],
  checkAchievements: async () => {},
  levelUp: null,
  dismissLevelUp: () => {},
  numericLevelUp: null,
  dismissNumericLevelUp: () => {},
  setCustomTitle: () => {},
  refreshDisplayName: () => {},
})

export function useProfile() {
  return useContext(ProfileContext)
}

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const { showToast } = useToast()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [dailyStats, setDailyStats] = useState<DailyStats>({
    ...EMPTY,
    date: todayStr(),
  })
  const [achievements, setAchievements] = useState<string[]>([])
  const [levelUp, setLevelUp] = useState<LevelUpInfo | null>(null)
  const [numericLevelUp, setNumericLevelUp] = useState<NumericLevelUpInfo | null>(null)
  const xpRef = useRef(0)
  const questLockRef = useRef(false)
  const achievementsRef = useRef<string[]>([])

  // achievementsRef를 state와 동기화
  useEffect(() => {
    achievementsRef.current = achievements
  }, [achievements])

  const dismissLevelUp = useCallback(() => setLevelUp(null), [])
  const dismissNumericLevelUp = useCallback(() => setNumericLevelUp(null), [])

  const isBanned = useMemo(() => {
    if (!profile?.bannedUntil) return false
    return new Date(profile.bannedUntil).getTime() > Date.now()
  }, [profile?.bannedUntil])

  const setCustomTitle = useCallback((key: string | null) => {
    setProfile((prev) => prev ? { ...prev, customTitle: key } : prev)
  }, [])

  const refreshDisplayName = useCallback((name: string | null) => {
    setProfile((prev) => prev ? { ...prev, displayName: name } : prev)
  }, [])

  // 마운트 시 localStorage에서 최신 daily stats 로드
  useEffect(() => {
    setDailyStats(loadDailyStats())
  }, [])

  useEffect(() => {
    if (loading) return
    if (!user) {
      setProfile(null)
      xpRef.current = 0
      setAchievements([])
      return
    }

    ;(async () => {
      const { data } = await supabase
        .from("profiles")
        .select("xp, badge, custom_title, streak_days, last_active_date, display_name, avatar_url, bio, daily_xp_earned, daily_xp_date, level, banned_until")
        .eq("id", user.id)
        .maybeSingle()

      if (data) {
        const xp = Math.max(0, Number(data.xp) || 0)
        const badge = xpToBadge(xp)
        const customTitle = typeof data.custom_title === "string" ? data.custom_title : null
        const streakDays = Number(data.streak_days) || 0
        const lastActiveDate = typeof data.last_active_date === "string" ? data.last_active_date : null
        const displayName = typeof data.display_name === "string" ? data.display_name : null
        const avatarUrl = typeof data.avatar_url === "string" ? data.avatar_url : null
        const bio = typeof data.bio === "string" ? data.bio : null
        const level = Number(data.level) || getLevel(xp)
        const dailyXpEarned = Number(data.daily_xp_earned) || 0
        const dailyXpDate = typeof data.daily_xp_date === "string" ? data.daily_xp_date : null
        const bannedUntil = typeof data.banned_until === "string" ? data.banned_until : null
        xpRef.current = xp
        setProfile({ xp, badge, customTitle, streakDays, lastActiveDate, displayName, avatarUrl, bio, level, dailyXpEarned, dailyXpDate, bannedUntil })
      } else {
        const meta = user.user_metadata ?? {}
        const oauthName = meta.full_name || meta.name || null
        const oauthAvatar = meta.avatar_url || meta.picture || null
        await supabase
          .from("profiles")
          .insert({
            id: user.id,
            xp: 0,
            badge: "네온 뉴비",
            ...(oauthName ? { display_name: oauthName } : {}),
            ...(oauthAvatar ? { avatar_url: oauthAvatar } : {}),
          })
        xpRef.current = 0
        setProfile({ xp: 0, badge: "네온 뉴비", customTitle: null, streakDays: 0, lastActiveDate: null, displayName: oauthName, avatarUrl: oauthAvatar, bio: null, level: 1, dailyXpEarned: 0, dailyXpDate: null, bannedUntil: null })
      }

      // 업적 로드
      const { data: achRows } = await supabase
        .from("user_achievements")
        .select("achievement_key")
        .eq("user_id", user.id)
      if (achRows) {
        setAchievements(
          achRows.map((r: { achievement_key: string }) => r.achievement_key)
        )
      }

      // DB 기반 데일리 퀘스트 초기 상태 동기화
      const kstToday = todayStr()
      const todayStartUTC = new Date(kstToday + "T00:00:00+09:00").toISOString()
      const todayEndUTC = new Date(kstToday + "T23:59:59.999+09:00").toISOString()

      const [{ count: tc }, { count: cc }] = await Promise.all([
        supabase.from("threads").select("id", { count: "exact", head: true })
          .eq("created_by", user.id).gte("created_at", todayStartUTC).lte("created_at", todayEndUTC),
        supabase.from("comments").select("id", { count: "exact", head: true })
          .eq("user_id", user.id).gte("created_at", todayStartUTC).lte("created_at", todayEndUTC),
      ])

      const dbThreads = tc ?? 0
      const dbComments = cc ?? 0
      const prev = loadDailyStats()
      const synced: DailyStats = {
        date: kstToday,
        threads: dbThreads,
        comments: dbComments,
        questThreadDone: dbThreads >= 1,
        questCommentDone: dbComments >= 3,
        streakDays: prev.streakDays,
        lastActiveDate: prev.lastActiveDate,
      }
      saveDailyStats(synced)
      setDailyStats(synced)
    })()
  }, [user?.id, loading])

  const checkAchievements = useCallback(async () => {
    if (!user) return

    try {
      const { data, error } = await supabase.rpc("check_achievements", {
        p_user_id: user.id,
      })

      if (error) return

      const result = data as {
        newly_unlocked?: string[]
        stats?: Record<string, number>
      } | null

      if (result?.newly_unlocked && result.newly_unlocked.length > 0) {
        setAchievements((prev) => [...prev, ...result.newly_unlocked!])

        for (const key of result.newly_unlocked) {
          const def = getAchievement(key)
          if (def) {
            showToast(`업적 달성: ${def.name}! 🏆`, "success")
          }
        }
      }
    } catch {
      // RPC 없으면 무시
    }

    // 스트릭 업적 (클라이언트 체크) — ref 사용으로 stale closure 방지
    const stats = loadDailyStats()
    const streak = stats.streakDays + 1 // 오늘 포함
    const currentAch = achievementsRef.current

    const streakChecks = [
      { days: 3, key: "streak_3", label: "3일 연속" },
      { days: 7, key: "streak_7", label: "7일 연속" },
      { days: 14, key: "streak_14", label: "2주 연속" },
      { days: 30, key: "streak_30", label: "한 달 연속" },
    ]

    for (const { days, key, label } of streakChecks) {
      if (streak >= days && !currentAch.includes(key)) {
        const { error } = await supabase
          .from("user_achievements")
          .insert({ user_id: user.id, achievement_key: key })
        if (!error) {
          achievementsRef.current = [...achievementsRef.current, key]
          setAchievements((prev) => [...prev, key])
          showToast(`업적 달성: ${label}! 🏆`, "success")
        }
      }
    }
  }, [user, showToast])

  const addXp = useCallback(
    async (amount: number) => {
      if (!user) return

      // 클라이언트 사이드 데일리 캡 체크 (fallback 시에도 200 XP 제한)
      const today = todayStr()
      const earned = profile?.dailyXpDate === today ? (profile?.dailyXpEarned ?? 0) : 0
      const cappedAmount = Math.min(amount, Math.max(0, DAILY_XP_LIMIT - earned))
      if (cappedAmount <= 0) return

      const oldXp = xpRef.current
      const oldBadge = xpToBadge(oldXp)
      const newXp = oldXp + cappedAmount
      const newBadge = xpToBadge(newXp)
      xpRef.current = newXp

      setProfile((prev) => ({ xp: newXp, badge: newBadge, customTitle: prev?.customTitle ?? null, streakDays: prev?.streakDays ?? 0, lastActiveDate: prev?.lastActiveDate ?? null, displayName: prev?.displayName ?? null, avatarUrl: prev?.avatarUrl ?? null, bio: prev?.bio ?? null, level: getLevel(newXp), dailyXpEarned: prev?.dailyXpEarned ?? 0, dailyXpDate: prev?.dailyXpDate ?? null, bannedUntil: prev?.bannedUntil ?? null }))

      // 배지(티어) 변경 감지 → 레벨업 오버레이
      if (oldBadge !== newBadge) {
        setLevelUp({
          oldBadge,
          newBadge,
          oldTier: getTier(oldXp),
          newTier: getTier(newXp),
        })
      }

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ xp: newXp, badge: newBadge })
        .eq("id", user.id)

      if (updateError) {
        // DB 업데이트 실패 → XP 롤백
        console.warn("[addXp] DB update failed, rolling back:", updateError.message)
        xpRef.current = oldXp
        setProfile((prev) => prev ? { ...prev, xp: oldXp, badge: oldBadge } : prev)
        return
      }

      // 시즌 XP 추가
      supabase.rpc("add_season_xp", { p_user_id: user.id, p_amount: cappedAmount }).then(() => {})
    },
    [user, profile?.dailyXpDate, profile?.dailyXpEarned]
  )

  const awardXp = useCallback(
    async (action: string) => {
      if (!user) return

      const amount = XP_WEIGHTS[action] ?? 5
      const oldLevel = xpRef.current > 0 ? getLevel(xpRef.current) : (profile?.level ?? 1)

      try {
        const { data, error } = await supabase.rpc("award_xp_with_limit", {
          p_user_id: user.id,
          p_amount: amount,
        })

        if (error) {
          // RPC 없으면 기존 addXp fallback
          await addXp(amount)
          return
        }

        const result = data as {
          awarded: number
          capped: boolean
          new_xp: number
          new_level: number
          new_badge: string
          daily_xp_earned: number
        }

        if (result.awarded === 0 && result.capped) {
          showToast("오늘의 XP 상한(200)에 도달했습니다!", "info")
          return
        }

        const newXp = result.new_xp
        const newBadge = result.new_badge
        const newLevel = result.new_level
        xpRef.current = newXp

        setProfile((prev) => ({
          xp: newXp,
          badge: newBadge as Badge,
          customTitle: prev?.customTitle ?? null,
          streakDays: prev?.streakDays ?? 0,
          lastActiveDate: prev?.lastActiveDate ?? null,
          displayName: prev?.displayName ?? null,
          avatarUrl: prev?.avatarUrl ?? null,
          bio: prev?.bio ?? null,
          level: newLevel,
          dailyXpEarned: result.daily_xp_earned,
          dailyXpDate: todayStr(),
          bannedUntil: prev?.bannedUntil ?? null,
        }))

        // 티어(배지) 변경 → 기존 레벨업 오버레이
        const oldBadge = xpToBadge(newXp - result.awarded)
        if (oldBadge !== newBadge) {
          setLevelUp({
            oldBadge,
            newBadge: newBadge as Badge,
            oldTier: getTier(newXp - result.awarded),
            newTier: getTier(newXp),
          })
        }

        // 숫자 레벨 변경 → 네온 파티클 폭발
        if (newLevel > oldLevel) {
          setNumericLevelUp({ newLevel })
        }

        if (result.capped) {
          showToast("오늘의 성장이 완료되었습니다! (200 XP)", "info")
        }
      } catch (err) {
        // RPC 호출 실패 → fallback
        console.warn("[awardXp] RPC failed, falling back to addXp:", err)
        await addXp(amount)
      }
    },
    [user, profile?.level, addXp, showToast]
  )

  const trackActivity = useCallback(
    async (type: "thread" | "comment") => {
      if (!user) return

      const stats = loadDailyStats()

      // DB 기반 스트릭 업데이트
      try {
        const { data: streakResult } = await supabase.rpc("update_streak", { p_user_id: user.id })
        if (streakResult && typeof streakResult === "object") {
          const sr = streakResult as { streak?: number; bonus?: number; already_today?: boolean }
          const newStreak = sr.streak ?? 0
          const bonus = sr.bonus ?? 0

          stats.streakDays = newStreak
          stats.lastActiveDate = todayStr()

          setProfile((prev) => prev ? { ...prev, streakDays: newStreak, lastActiveDate: todayStr() } : prev)

          if (bonus > 0) {
            showToast(`스트릭 ${newStreak}일 보너스! +${bonus} XP`, "success")
          }
        }
      } catch {
        // RPC 없으면 클라이언트 로직 fallback
        const today = todayStr()
        if (stats.lastActiveDate !== today) {
          const kstNow = new Date(Date.now() + 9 * 60 * 60 * 1000)
          kstNow.setDate(kstNow.getDate() - 1)
          const yStr = kstNow.toISOString().split("T")[0]

          if (stats.lastActiveDate === yStr) {
            stats.streakDays = (stats.streakDays ?? 0) + 1
          } else {
            stats.streakDays = 1
          }
          stats.lastActiveDate = today
        }
      }

      if (type === "thread") {
        stats.threads += 1
        if (!stats.questThreadDone && stats.threads >= 1 && !questLockRef.current) {
          questLockRef.current = true
          stats.questThreadDone = true
          saveDailyStats(stats)
          setDailyStats({ ...stats })
          try {
            await awardXp("quest_thread") // 퀘스트 완료 보너스 XP
          } finally {
            questLockRef.current = false
          }
        } else {
          saveDailyStats(stats)
          setDailyStats({ ...stats })
        }
      } else {
        stats.comments += 1
        if (!stats.questCommentDone && stats.comments >= 3 && !questLockRef.current) {
          questLockRef.current = true
          stats.questCommentDone = true
          saveDailyStats(stats)
          setDailyStats({ ...stats })
          try {
            await awardXp("quest_comment") // 퀘스트 완료 보너스 XP
          } finally {
            questLockRef.current = false
          }
        } else {
          saveDailyStats(stats)
          setDailyStats({ ...stats })
        }
      }

      // 활동 후 업적 체크
      await checkAchievements()
    },
    [user, awardXp, checkAchievements]
  )

  return (
    <ProfileContext.Provider
      value={{ profile, isBanned, addXp, awardXp, dailyStats, trackActivity, achievements, checkAchievements, levelUp, dismissLevelUp, numericLevelUp, dismissNumericLevelUp, setCustomTitle, refreshDisplayName }}
    >
      {children}
    </ProfileContext.Provider>
  )
}
