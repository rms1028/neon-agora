"use client"

import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { useRouter } from "next/navigation"
import { Clock, MessageSquareText, PenLine, Sparkles, Swords, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/components/auth-provider"
import { useToast } from "@/components/toast-provider"
import { useProfile } from "@/components/profile-provider"
import { containsProfanity } from "@/lib/profanity"

const DRAFT_KEY = "neon_thread_draft"
const DRAFT_MAX_AGE = 7 * 24 * 60 * 60 * 1000 // 7일

const CATEGORIES = [
  "AI", "정치", "경제", "사회", "기술", "문화", "교육", "환경", "기타",
]

export function NewThreadModal() {
  const router = useRouter()
  const { user } = useAuth()
  const { showToast } = useToast()
  const { awardXp, trackActivity, isBanned, profile } = useProfile()
  const [mounted, setMounted] = useState(false)
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")
  const [tag, setTag] = useState("")
  const [template, setTemplate] = useState<string>("free")
  const [durationMinutes, setDurationMinutes] = useState(1440)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const draftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  // 초안 복구 (모달 열릴 때)
  useEffect(() => {
    if (!open) return
    try {
      const raw = localStorage.getItem(DRAFT_KEY)
      if (!raw) return
      const draft = JSON.parse(raw)
      if (Date.now() - (draft.savedAt ?? 0) > DRAFT_MAX_AGE) {
        localStorage.removeItem(DRAFT_KEY)
        return
      }
      if (draft.title || draft.content) {
        setTitle(draft.title ?? "")
        setContent(draft.content ?? "")
        setTag(draft.tag ?? "")
        setTemplate(draft.template ?? "free")
        setDurationMinutes(draft.durationMinutes ?? 1440)
        showToast("초안을 불러왔어요", "info")
      }
    } catch { /* ignore */ }
  }, [open])

  // 초안 저장 (디바운스)
  function saveDraft(t: string, c: string, tg: string, tp: string, dur: number) {
    if (draftTimerRef.current) clearTimeout(draftTimerRef.current)
    draftTimerRef.current = setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({
          title: t, content: c, tag: tg, template: tp, durationMinutes: dur, savedAt: Date.now(),
        }))
      } catch { /* ignore */ }
    }, 500)
  }

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") handleClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open])

  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow
      document.body.style.overflow = "hidden"
      return () => {
        document.body.style.overflow = prev
      }
    }
  }, [open])

  function handleClose() {
    if (draftTimerRef.current) clearTimeout(draftTimerRef.current)
    // 내용이 있으면 초안 유지 (이미 디바운스로 저장됨), 비어있으면 정리
    if (!title.trim() && !content.trim()) {
      localStorage.removeItem(DRAFT_KEY)
    }
    setOpen(false)
    setTitle("")
    setContent("")
    setTag("")
    setTemplate("free")
    setDurationMinutes(1440)
    setError("")
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user) {
      showToast("로그인이 필요한 기능입니다.", "info")
      return
    }
    if (isBanned) {
      const until = profile?.bannedUntil ? new Date(profile.bannedUntil).toLocaleDateString("ko-KR") : ""
      showToast(`계정이 정지되었습니다. 해제: ${until}`, "error")
      return
    }
    if (!title.trim() || !content.trim()) {
      setError("제목과 내용을 모두 입력해주세요.")
      return
    }
    if (containsProfanity(title.trim()) || containsProfanity(content.trim())) {
      setError("부적절한 표현이 포함되어 있습니다. 수정 후 다시 시도해주세요.")
      return
    }
    setLoading(true)
    setError("")

    const { error: dbError } = await supabase
      .from("threads")
      .insert({
        title: title.trim(),
        content: content.trim(),
        ...(tag ? { tag } : {}),
        template,
        created_by: user.id,
        expires_at: new Date(Date.now() + durationMinutes * 60_000).toISOString(),
      })

    setLoading(false)

    if (dbError) {
      console.error("[NewThread Error]", dbError.code, dbError.message)
      setError(`저장 실패: ${dbError.message}`)
      return
    }

    localStorage.removeItem(DRAFT_KEY)
    handleClose()
    router.refresh()
    awardXp("thread")
    trackActivity("thread") // 데일리 퀘스트 추적
  }

  const isFree = template === "free"
  const isClash = template === "strict"

  const modal =
    mounted && open
      ? createPortal(
          <div
            className="fixed inset-0 z-[999] flex items-center justify-center bg-black/80 backdrop-blur-sm"
            onClick={handleClose}
          >
            <div
              className="relative w-full max-w-xl rounded-2xl border border-gray-800 bg-gray-950 p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* 닫기 버튼 */}
              <button
                type="button"
                onClick={handleClose}
                className="absolute right-4 top-4 inline-flex size-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-zinc-400 transition hover:bg-white/10 hover:text-zinc-100"
                aria-label="모달 닫기"
              >
                <X className="size-4" />
              </button>

              {/* 헤더 */}
              <div className="mb-5 flex items-center gap-3">
                <div className="grid size-9 place-items-center rounded-xl border border-[#00FFD1]/30 bg-[#00FFD1]/10 text-[#00FFD1]">
                  <PenLine className="size-4" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-zinc-50">
                    새 토론 열기
                  </h2>
                  <p className="text-xs text-zinc-500">
                    주제를 던지고 광장에 불을 켜봐.
                  </p>
                </div>
              </div>

              {/* 폼 */}
              <form onSubmit={handleSubmit} className="space-y-5">
                {/* ── 토론 형식 (2단 Epic UI) ── */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-zinc-400">
                    토론 형식
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {/* 자유 토론 */}
                    <button
                      type="button"
                      onClick={() => { setTemplate("free"); saveDraft(title, content, tag, "free", durationMinutes) }}
                      className={[
                        "group relative overflow-hidden rounded-xl border p-4 text-left transition-all duration-300",
                        isFree
                          ? "border-[#39FF14]/50 bg-[#39FF14]/10 shadow-[0_0_24px_rgba(57,255,20,0.15),inset_0_0_24px_rgba(57,255,20,0.05)]"
                          : "border-white/10 bg-white/[0.02] hover:border-[#39FF14]/25 hover:bg-[#39FF14]/[0.03]",
                      ].join(" ")}
                    >
                      {/* 글로우 오버레이 */}
                      {isFree && (
                        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#39FF14]/10 via-transparent to-[#39FF14]/5" />
                      )}
                      <div className="relative">
                        <div className={`grid size-10 place-items-center rounded-lg ${
                          isFree ? "bg-[#39FF14]/20 text-[#39FF14]" : "bg-white/5 text-zinc-500"
                        } transition-colors`}>
                          <MessageSquareText className="size-5" />
                        </div>
                        <div className={`mt-3 text-sm font-bold ${
                          isFree ? "text-[#39FF14]" : "text-zinc-300"
                        } transition-colors`}>
                          자유 토론
                        </div>
                        <div className="mt-1 text-[11px] leading-relaxed text-zinc-500">
                          자유롭게 의견을 나누는
                          <br />오픈 디스커션
                        </div>
                        {isFree && (
                          <div className="mt-2 inline-flex items-center rounded-full border border-[#39FF14]/30 bg-[#39FF14]/10 px-2 py-0.5 text-[9px] font-bold tracking-wider text-[#39FF14]">
                            SELECTED
                          </div>
                        )}
                      </div>
                    </button>

                    {/* 찬반 격돌 */}
                    <button
                      type="button"
                      onClick={() => { setTemplate("strict"); saveDraft(title, content, tag, "strict", durationMinutes) }}
                      className={[
                        "group relative overflow-hidden rounded-xl border p-4 text-left transition-all duration-300",
                        isClash
                          ? "border-[#00FFD1]/40 bg-gradient-to-br from-[#00FFD1]/10 via-transparent to-[#FF00FF]/10 shadow-[0_0_24px_rgba(0,255,209,0.12),0_0_24px_rgba(255,0,255,0.08)]"
                          : "border-white/10 bg-white/[0.02] hover:border-[#00FFD1]/20 hover:bg-white/[0.04]",
                      ].join(" ")}
                    >
                      {/* VS 이펙트 */}
                      {isClash && (
                        <div className="pointer-events-none absolute inset-0">
                          <div className="absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-[#00FFD1]/8 to-transparent" />
                          <div className="absolute inset-y-0 right-0 w-1/2 bg-gradient-to-l from-[#FF00FF]/8 to-transparent" />
                        </div>
                      )}
                      <div className="relative">
                        <div className={`grid size-10 place-items-center rounded-lg ${
                          isClash
                            ? "bg-gradient-to-br from-[#00FFD1]/20 to-[#FF00FF]/20 text-white"
                            : "bg-white/5 text-zinc-500"
                        } transition-colors`}>
                          <Swords className="size-5" />
                        </div>
                        <div className="mt-3 flex items-center gap-1.5">
                          <span className={`text-sm font-bold ${
                            isClash ? "text-[#00FFD1]" : "text-zinc-300"
                          } transition-colors`}>
                            찬반
                          </span>
                          {isClash && (
                            <span className="text-[10px] font-black text-white/40">VS</span>
                          )}
                          <span className={`text-sm font-bold ${
                            isClash ? "text-[#FF00FF]" : "text-zinc-300"
                          } transition-colors`}>
                            격돌
                          </span>
                        </div>
                        <div className="mt-1 text-[11px] leading-relaxed text-zinc-500">
                          찬성/반대 진영 대결
                          <br />AI 리포트 + 진영 랭킹
                        </div>
                        {isClash && (
                          <div className="mt-2 inline-flex items-center rounded-full border border-[#FF00FF]/30 bg-[#FF00FF]/10 px-2 py-0.5 text-[9px] font-bold tracking-wider text-[#FF00FF]">
                            CLASH MODE
                          </div>
                        )}
                      </div>
                    </button>
                  </div>
                </div>

                {/* 제목 */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-zinc-400">
                    토론 제목
                  </label>
                  <input
                    value={title}
                    onChange={(e) => { setTitle(e.target.value); saveDraft(e.target.value, content, tag, template, durationMinutes) }}
                    placeholder="예: AI가 인간의 일자리를 빼앗을까?"
                    maxLength={100}
                    autoFocus
                    className={`w-full rounded-xl border bg-white/5 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none transition ${
                      isFree
                        ? "border-[#39FF14]/20 focus:border-[#39FF14]/50 focus:ring-1 focus:ring-[#39FF14]/30"
                        : "border-[#00FFD1]/20 focus:border-[#00FFD1]/50 focus:ring-1 focus:ring-[#00FFD1]/30"
                    }`}
                  />
                  <div className="text-right text-[11px] text-zinc-600">
                    {title.length} / 100
                  </div>
                </div>

                {/* 내용 */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-zinc-400">
                    토론 내용
                  </label>
                  <textarea
                    value={content}
                    onChange={(e) => { setContent(e.target.value); saveDraft(title, e.target.value, tag, template, durationMinutes) }}
                    placeholder="토론의 배경, 쟁점, 핵심 질문을 간략하게 설명해주세요."
                    rows={4}
                    maxLength={500}
                    className={`w-full resize-none rounded-xl border bg-white/5 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none transition ${
                      isFree
                        ? "border-[#39FF14]/20 focus:border-[#39FF14]/50 focus:ring-1 focus:ring-[#39FF14]/30"
                        : "border-[#00FFD1]/20 focus:border-[#00FFD1]/50 focus:ring-1 focus:ring-[#00FFD1]/30"
                    }`}
                  />
                  <div className="text-right text-[11px] text-zinc-600">
                    {content.length} / 500
                  </div>
                </div>

                {/* 토론 기간 선택 */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-zinc-400">
                    토론 기간
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {([
                      { label: "1시간", value: 60 },
                      { label: "3시간", value: 180 },
                      { label: "24시간", value: 1440 },
                      { label: "3일", value: 4320 },
                    ] as const).map((opt) => {
                      const active = durationMinutes === opt.value
                      const accent = isFree ? "#39FF14" : "#00FFD1"
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => { setDurationMinutes(opt.value); saveDraft(title, content, tag, template, opt.value) }}
                          className={[
                            "flex items-center justify-center gap-1 rounded-lg border px-2 py-2 text-xs font-medium transition",
                            active
                              ? "border-white/20 bg-white/10 text-white"
                              : "border-white/10 bg-white/5 text-zinc-400 hover:border-white/20 hover:text-zinc-200",
                          ].join(" ")}
                          style={active ? {
                            borderColor: `${accent}80`,
                            backgroundColor: `${accent}1a`,
                            color: accent,
                            boxShadow: `0 0 10px ${accent}20`,
                          } : undefined}
                        >
                          <Clock className="size-3" />
                          {opt.label}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* 카테고리 선택 */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-zinc-400">
                    카테고리 <span className="text-zinc-600">(선택)</span>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {CATEGORIES.map((cat) => {
                      const active = tag === cat
                      const accent = isFree ? "#39FF14" : "#00FFD1"
                      return (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => { const newTag = tag === cat ? "" : cat; setTag(newTag); saveDraft(title, content, newTag, template, durationMinutes) }}
                          className={[
                            "rounded-full border px-3 py-1 text-xs font-medium transition",
                            active
                              ? `border-[${accent}]/50 bg-[${accent}]/15 text-white shadow-[0_0_12px_${accent}33]`
                              : "border-white/10 bg-white/5 text-zinc-400 hover:border-white/20 hover:text-zinc-200",
                          ].join(" ")}
                          style={active ? {
                            borderColor: `${accent}80`,
                            backgroundColor: `${accent}26`,
                            boxShadow: `0 0 12px ${accent}33`,
                          } : undefined}
                        >
                          {cat}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* 안내 문구 */}
                <p className="text-xs text-zinc-600">
                  {isFree
                    ? "자유 토론은 누구나 자유롭게 의견을 나눌 수 있어요."
                    : "찬반 격돌은 찬성/반대 진영으로 나뉘어 배틀합니다. AI가 여론 리포트를 생성해요."}
                </p>

                {/* 에러 */}
                {error && (
                  <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
                    {error}
                  </p>
                )}

                {/* 버튼 */}
                <div className="mt-2 flex gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleClose}
                    className="flex-1 border-white/15 bg-white/5 text-zinc-300 hover:bg-white/10"
                  >
                    취소
                  </Button>
                  <Button
                    type="submit"
                    disabled={loading}
                    className={`flex-1 text-sm font-semibold text-black disabled:opacity-60 ${
                      isFree
                        ? "bg-gradient-to-r from-[#39FF14] via-[#39FF14]/80 to-[#39FF14] shadow-[0_0_24px_rgba(57,255,20,0.4)] hover:shadow-[0_0_32px_rgba(57,255,20,0.6)]"
                        : "bg-gradient-to-r from-[#00FFD1] via-white to-[#FF00FF] shadow-[0_0_24px_rgba(0,255,209,0.3)] hover:shadow-[0_0_32px_rgba(255,0,255,0.4)]"
                    }`}
                  >
                    <Sparkles className="mr-1.5 size-4" />
                    {loading ? "저장 중…" : isFree ? "토론 열기" : "격돌 시작"}
                  </Button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )
      : null

  return (
    <>
      <Button
        onClick={() => {
          if (!user) {
            showToast("로그인이 필요한 기능입니다.", "info")
            return
          }
          setOpen(true)
        }}
        className="bg-white text-black hover:bg-white/90"
      >
        <Sparkles className="size-4" />
        새 토론 열기
      </Button>

      {modal}
    </>
  )
}
