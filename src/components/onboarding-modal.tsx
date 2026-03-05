"use client"

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { ChevronLeft, ChevronRight, Flame, Sparkles, Swords, Trophy, Zap } from "lucide-react"

import { useAuth } from "@/components/auth-provider"

const STEPS = [
  {
    icon: Sparkles,
    color: "#00FFD1",
    title: "네온 아고라에 오신 걸 환영합니다!",
    description: "사이버펑크 시대의 토론 광장에서\n당신의 목소리를 들려주세요.",
    detail: "자유 토론부터 찬반 격돌까지,\n다양한 형식으로 의견을 나눠보세요.",
  },
  {
    icon: Swords,
    color: "#FF00FF",
    title: "투표로 판세를 뒤집어라",
    description: "찬성 또는 반대에 투표하면\n실시간으로 여론 게이지가 변합니다.",
    detail: "토론당 1표만 행사할 수 있어요.\n신중하게 결정하세요!",
  },
  {
    icon: Zap,
    color: "#FFD700",
    title: "XP를 모아 티어를 올려라",
    description: "댓글, 투표, 토론 생성 등\n모든 활동이 XP로 보상됩니다.",
    detail: "데일리 퀘스트를 완료하면\n보너스 XP를 받을 수 있어요!",
  },
  {
    icon: Trophy,
    color: "#39FF14",
    title: "업적을 달성하고 랭킹에 올라라",
    description: "숨겨진 업적을 해금하고\n리더보드 정상을 노려보세요.",
    detail: "칭호를 커스텀하고\n나만의 프로필을 꾸며보세요!",
  },
]

export function OnboardingModal() {
  const { user, loading } = useAuth()
  const [mounted, setMounted] = useState(false)
  const [show, setShow] = useState(false)
  const [step, setStep] = useState(0)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (loading || !user) return
    if (typeof window === "undefined") return
    const done = localStorage.getItem("neon_onboarding_done")
    if (!done) setShow(true)
  }, [user, loading])

  function handleFinish() {
    localStorage.setItem("neon_onboarding_done", "1")
    setShow(false)
  }

  if (!mounted || !show) return null

  const current = STEPS[step]
  const Icon = current.icon
  const isLast = step === STEPS.length - 1

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 backdrop-blur-sm">
      <div className="relative w-full max-w-sm rounded-2xl border border-white/10 bg-gray-950 p-8 shadow-2xl">
        {/* 아이콘 */}
        <div className="mb-6 flex justify-center">
          <div
            className="grid size-16 place-items-center rounded-2xl"
            style={{
              backgroundColor: `${current.color}15`,
              border: `1px solid ${current.color}40`,
              boxShadow: `0 0 30px ${current.color}20`,
            }}
          >
            <Icon className="size-8" style={{ color: current.color }} />
          </div>
        </div>

        {/* 텍스트 */}
        <h2
          className="mb-3 text-center text-lg font-bold"
          style={{ color: current.color }}
        >
          {current.title}
        </h2>
        <p className="mb-2 whitespace-pre-line text-center text-sm text-zinc-300">
          {current.description}
        </p>
        <p className="mb-8 whitespace-pre-line text-center text-xs text-zinc-500">
          {current.detail}
        </p>

        {/* 도트 인디케이터 */}
        <div className="mb-6 flex justify-center gap-2">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className="size-2 rounded-full transition-all"
              style={{
                backgroundColor: i === step ? current.color : "rgba(255,255,255,0.15)",
                boxShadow: i === step ? `0 0 8px ${current.color}60` : "none",
              }}
            />
          ))}
        </div>

        {/* 버튼 */}
        <div className="flex gap-3">
          {step > 0 && (
            <button
              onClick={() => setStep((s) => s - 1)}
              className="flex flex-1 items-center justify-center gap-1 rounded-xl border border-white/10 bg-white/5 py-3 text-sm font-medium text-zinc-400 transition hover:bg-white/10"
            >
              <ChevronLeft className="size-4" />
              이전
            </button>
          )}
          {isLast ? (
            <button
              onClick={handleFinish}
              className="flex flex-1 items-center justify-center gap-1 rounded-xl py-3 text-sm font-bold text-black transition"
              style={{
                background: `linear-gradient(135deg, ${current.color}, ${current.color}CC)`,
                boxShadow: `0 0 24px ${current.color}40`,
              }}
            >
              <Flame className="size-4" />
              시작하기!
            </button>
          ) : (
            <button
              onClick={() => setStep((s) => s + 1)}
              className="flex flex-1 items-center justify-center gap-1 rounded-xl py-3 text-sm font-bold text-black transition"
              style={{
                background: `linear-gradient(135deg, ${current.color}, ${current.color}CC)`,
                boxShadow: `0 0 24px ${current.color}40`,
              }}
            >
              다음
              <ChevronRight className="size-4" />
            </button>
          )}
        </div>

        {/* 건너뛰기 */}
        {!isLast && (
          <button
            onClick={handleFinish}
            className="mt-3 w-full text-center text-xs text-zinc-600 hover:text-zinc-400"
          >
            건너뛰기
          </button>
        )}
      </div>
    </div>,
    document.body
  )
}
