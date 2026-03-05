"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { BarChart3, Send } from "lucide-react"

import { Button } from "@/components/ui/button"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/components/auth-provider"
import { useToast } from "@/components/toast-provider"
import { useProfile } from "@/components/profile-provider"
import { containsProfanity } from "@/lib/profanity"

type Side = "pro" | "con"

type MentionUser = {
  id: string
  displayName: string
}

export function CommentComposer({
  threadId,
  fixedSide,
  parentId,
  onSubmitted,
  template,
}: {
  threadId: string
  fixedSide?: Side
  parentId?: string
  onSubmitted?: () => void
  template?: string
}) {
  const router = useRouter()
  const { user, loading } = useAuth()
  const { showToast } = useToast()
  const { awardXp, trackActivity, isBanned, profile } = useProfile()

  const [side, setSide] = useState<Side | null>(fixedSide ?? null)
  const [content, setContent] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [pollEnabled, setPollEnabled] = useState(false)
  const [pollQuestion, setPollQuestion] = useState("")

  // 멘션 자동완성
  const [mentionQuery, setMentionQuery] = useState<string | null>(null)
  const [mentionResults, setMentionResults] = useState<MentionUser[]>([])
  const [mentionIndex, setMentionIndex] = useState(0)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const draftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSubmitRef = useRef<number>(0)
  const COOLDOWN_MS = 10_000
  const draftKey = `neon_comment_draft_${threadId}`

  // 초안 복구
  useEffect(() => {
    try {
      const saved = localStorage.getItem(draftKey)
      if (saved) setContent(saved)
    } catch { /* ignore */ }
  }, [draftKey])

  const canWrite = Boolean(user) && !loading
  const disabled = submitting || !canWrite

  // 멘션 검색
  const searchMentionUsers = useCallback(async (query: string) => {
    if (query.length === 0) {
      // @ 만 입력하면 이 스레드의 최근 댓글 유저 표시
      const { data } = await supabase
        .from("comments")
        .select("user_id")
        .eq("thread_id", threadId)
        .order("created_at", { ascending: false })
        .limit(20)

      const seen = new Set<string>()
      const results: MentionUser[] = []
      for (const row of data ?? []) {
        const uid = String((row as Record<string, unknown>).user_id ?? "")
        if (!uid || uid === user?.id || seen.has(uid)) continue
        seen.add(uid)
        const short = uid.replace(/-/g, "").slice(0, 5)
        results.push({ id: uid, displayName: `유저 ${short}` })
        if (results.length >= 5) break
      }
      setMentionResults(results)
      setMentionIndex(0)
      return
    }

    const { data } = await supabase
      .from("comments")
      .select("user_id")
      .eq("thread_id", threadId)
      .order("created_at", { ascending: false })
      .limit(50)

    const seen = new Set<string>()
    const results: MentionUser[] = []
    for (const row of data ?? []) {
      const uid = String((row as Record<string, unknown>).user_id ?? "")
      if (!uid || uid === user?.id || seen.has(uid)) continue
      seen.add(uid)
      const short = uid.replace(/-/g, "").slice(0, 5)
      const name = `유저 ${short}`
      if (name.includes(query) || short.includes(query)) {
        results.push({ id: uid, displayName: name })
      }
      if (results.length >= 5) break
    }
    setMentionResults(results)
    setMentionIndex(0)
  }, [threadId, user?.id])

  // textarea onChange에서 멘션 감지
  const handleContentChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value
    setContent(value)

    // 초안 저장 (디바운스)
    if (draftTimerRef.current) clearTimeout(draftTimerRef.current)
    draftTimerRef.current = setTimeout(() => {
      try {
        if (value.trim()) localStorage.setItem(draftKey, value)
        else localStorage.removeItem(draftKey)
      } catch { /* ignore */ }
    }, 500)

    const cursorPos = e.target.selectionStart
    const textBefore = value.slice(0, cursorPos)

    // 커서 앞에서 @검색어 감지
    const mentionMatch = textBefore.match(/@(\S*)$/)
    if (mentionMatch) {
      const query = mentionMatch[1]
      setMentionQuery(query)

      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        searchMentionUsers(query)
      }, 200)
    } else {
      setMentionQuery(null)
      setMentionResults([])
    }
  }, [draftKey, searchMentionUsers])

  // 멘션 선택
  function selectMention(mentionUser: MentionUser) {
    const textarea = textareaRef.current
    if (!textarea) return

    const cursorPos = textarea.selectionStart
    const textBefore = content.slice(0, cursorPos)
    const textAfter = content.slice(cursorPos)

    // @검색어 를 @[이름](uuid) 로 치환
    const mentionText = `@[${mentionUser.displayName}](${mentionUser.id}) `
    const newBefore = textBefore.replace(/@\S*$/, mentionText)

    setContent(newBefore + textAfter)
    setMentionQuery(null)
    setMentionResults([])

    // 커서 위치 복원
    requestAnimationFrame(() => {
      textarea.focus()
      const newPos = newBefore.length
      textarea.setSelectionRange(newPos, newPos)
    })
  }

  // 키보드 네비게이션
  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (mentionQuery === null || mentionResults.length === 0) return

    if (e.key === "ArrowDown") {
      e.preventDefault()
      setMentionIndex((i) => (i + 1) % mentionResults.length)
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setMentionIndex((i) => (i - 1 + mentionResults.length) % mentionResults.length)
    } else if (e.key === "Enter" && mentionResults.length > 0) {
      e.preventDefault()
      selectMention(mentionResults[mentionIndex])
    } else if (e.key === "Escape") {
      setMentionQuery(null)
      setMentionResults([])
    }
  }

  // 언마운트 시 디바운스 정리
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      if (draftTimerRef.current) clearTimeout(draftTimerRef.current)
    }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!user) {
      showToast("VIP 로그인 유저만 댓글을 등록할 수 있어요.", "info")
      return
    }

    if (isBanned) {
      const until = profile?.bannedUntil ? new Date(profile.bannedUntil).toLocaleDateString("ko-KR") : ""
      showToast(`계정이 정지되었습니다. 해제: ${until}`, "error")
      return
    }

    if (!side && template !== "free") {
      showToast("입장을 선택해주세요. (찬성/반대)", "info")
      return
    }

    const text = content.trim()
    if (!text) return

    if (containsProfanity(text)) {
      showToast("부적절한 표현이 포함되어 있습니다. 수정 후 다시 시도해주세요.", "error")
      return
    }

    const elapsed = Date.now() - lastSubmitRef.current
    if (elapsed < COOLDOWN_MS) {
      const remain = Math.ceil((COOLDOWN_MS - elapsed) / 1000)
      showToast(`댓글 도배 방지: ${remain}초 후에 다시 작성할 수 있습니다.`, "info")
      return
    }

    setSubmitting(true)
    const { data: insertedComment, error } = await supabase
      .from("comments")
      .insert({
        thread_id: threadId,
        user_id: user.id,
        content: text,
        side: template === "free" ? null : side,
        parent_id: parentId ?? null,
      })
      .select("id")
      .single()
    setSubmitting(false)

    if (error) {
      showToast("댓글 등록에 실패했습니다. 다시 시도해주세요.", "error")
      return
    }

    // 투표 첨부가 있으면 comment_polls에 insert
    if (pollEnabled && pollQuestion.trim() && insertedComment?.id) {
      await supabase.from("comment_polls").insert({
        comment_id: insertedComment.id,
        question: pollQuestion.trim().slice(0, 100),
      })
    }

    lastSubmitRef.current = Date.now()
    if (!fixedSide) setSide(null)
    setContent("")
    try { localStorage.removeItem(draftKey) } catch { /* ignore */ }
    setPollEnabled(false)
    setPollQuestion("")
    router.refresh()
    awardXp("comment")
    trackActivity("comment") // 데일리 퀘스트 추적
    onSubmitted?.()
  }

  const isFree = template === "free"

  return (
    <form onSubmit={handleSubmit} className={isFree ? "" : "space-y-3"}>
      {!fixedSide && !isFree && (
        /* 입장 선택 */
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSide("pro")}
            disabled={!canWrite || submitting}
            aria-pressed={side === "pro"}
            className={[
              "inline-flex flex-1 items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition",
              "disabled:cursor-not-allowed disabled:opacity-60",
              side === "pro"
                ? "border-cyan-400/50 bg-cyan-400/15 text-cyan-100 shadow-[0_0_18px_rgba(34,211,238,0.18)]"
                : "border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10",
            ].join(" ")}
          >
            <span className="inline-flex size-2 rounded-full bg-cyan-300 shadow-[0_0_10px_rgba(34,211,238,0.55)]" />
            찬성
          </button>
          <button
            type="button"
            onClick={() => setSide("con")}
            disabled={!canWrite || submitting}
            aria-pressed={side === "con"}
            className={[
              "inline-flex flex-1 items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition",
              "disabled:cursor-not-allowed disabled:opacity-60",
              side === "con"
                ? "border-fuchsia-400/50 bg-fuchsia-400/15 text-fuchsia-100 shadow-[0_0_18px_rgba(236,72,153,0.18)]"
                : "border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10",
            ].join(" ")}
          >
            <span className="inline-flex size-2 rounded-full bg-fuchsia-300 shadow-[0_0_10px_rgba(236,72,153,0.55)]" />
            반대
          </button>
        </div>
      )}

      <div className={`relative border backdrop-blur ${
        isFree
          ? "rounded-xl border-white/[0.08] bg-zinc-900/80"
          : "rounded-2xl border-white/10 bg-black/40"
      }`}>
        <textarea
          ref={textareaRef}
          value={content}
          onChange={handleContentChange}
          onKeyDown={handleKeyDown}
          placeholder={
            canWrite
              ? isFree
                ? "메시지를 입력하세요… (@로 멘션)"
                : side
                  ? `${side === "pro" ? "찬성" : "반대"} 댓글을 입력하세요… (@로 멘션)`
                  : "먼저 입장을 선택해주세요. (찬성/반대)"
              : "VIP 로그인 후 댓글을 등록할 수 있어요."
          }
          rows={isFree ? 1 : 3}
          maxLength={500}
          disabled={!canWrite || submitting}
          className={`w-full resize-none bg-transparent text-sm text-zinc-100 placeholder:text-zinc-600 outline-none disabled:cursor-not-allowed disabled:opacity-60 ${
            isFree ? "px-4 py-2.5" : "px-4 py-3"
          }`}
          style={isFree ? { maxHeight: "120px", overflow: "auto" } : undefined}
          onInput={isFree ? (e) => {
            const el = e.currentTarget
            el.style.height = "auto"
            el.style.height = Math.min(el.scrollHeight, 120) + "px"
          } : undefined}
        />

        {/* 멘션 드롭다운 */}
        {mentionQuery !== null && mentionResults.length > 0 && (
          <div className={`absolute bottom-full left-2 right-2 z-50 mb-1 rounded-xl border bg-zinc-950/95 p-1 shadow-xl backdrop-blur ${
            isFree ? "border-emerald-400/30" : "border-cyan-400/30"
          }`}>
            {mentionResults.map((mu, idx) => (
              <button
                key={mu.id}
                type="button"
                onClick={() => selectMention(mu)}
                className={[
                  "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs transition",
                  idx === mentionIndex
                    ? isFree
                      ? "bg-emerald-400/15 text-emerald-100"
                      : "bg-cyan-400/15 text-cyan-100"
                    : "text-zinc-300 hover:bg-white/5",
                ].join(" ")}
              >
                <span className="grid size-6 place-items-center rounded-full bg-gradient-to-br from-cyan-300 to-emerald-300 text-[9px] font-semibold text-black">
                  {mu.displayName.slice(0, 2)}
                </span>
                {mu.displayName}
              </button>
            ))}
          </div>
        )}

        {/* 투표 첨부 */}
        {pollEnabled && (
          <div className="border-t border-white/10 px-4 py-2">
            <div className="flex items-center gap-2">
              <BarChart3 className="size-3.5 shrink-0 text-amber-300" />
              <input
                type="text"
                value={pollQuestion}
                onChange={(e) => setPollQuestion(e.target.value.slice(0, 100))}
                placeholder="투표 질문을 입력하세요 (최대 100자)"
                className="flex-1 bg-transparent text-xs text-zinc-100 placeholder:text-zinc-600 outline-none"
              />
              <span className="text-[10px] text-zinc-600">{pollQuestion.length}/100</span>
            </div>
          </div>
        )}

        <div className={`flex items-center justify-between border-t border-white/10 ${
          isFree ? "px-3 py-1.5" : "px-4 py-2"
        }`}>
          <div className="flex items-center gap-3">
            <span className={`text-zinc-600 ${isFree ? "text-[10px]" : "text-[11px] text-zinc-500"}`}>{content.length}/500</span>
            <button
              type="button"
              onClick={() => setPollEnabled((v) => !v)}
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] transition ${
                pollEnabled
                  ? "border-amber-400/40 bg-amber-400/15 text-amber-200"
                  : "border-white/10 bg-white/5 text-zinc-500 hover:text-zinc-300"
              }`}
              title="투표 첨부"
            >
              <BarChart3 className="size-2.5" />
              투표
            </button>
            <span className="hidden text-[10px] text-zinc-600 sm:inline">
              **굵게** *기울임* `코드` ~~취소선~~ @멘션
            </span>
          </div>
          <Button
            type="submit"
            disabled={disabled || (!isFree && !side) || content.trim().length === 0}
            className={`text-xs font-semibold text-black disabled:opacity-60 ${
              isFree
                ? "h-7 rounded-lg bg-gradient-to-r from-emerald-400 to-teal-400 px-3 hover:from-emerald-300 hover:to-teal-300"
                : "h-8 bg-gradient-to-r from-cyan-300 via-sky-200 to-fuchsia-300 hover:from-cyan-200 hover:via-sky-100 hover:to-fuchsia-200"
            }`}
          >
            <Send className="size-3" />
            {submitting ? "…" : isFree ? "" : "등록"}
          </Button>
        </div>
      </div>
    </form>
  )
}
