"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Bookmark, BookmarkX, Home, Tag } from "lucide-react"

import { supabase } from "@/lib/supabase"
import { useAuth } from "@/components/auth-provider"
import { useToast } from "@/components/toast-provider"
import { timeAgo } from "@/lib/utils"

type BookmarkedThread = {
  id: string
  thread_id: string
  created_at: string
  thread: {
    id: string
    title: string
    tag: string
    pro_count: number
    con_count: number
    created_at: string
    is_closed: boolean
  }
}

export default function BookmarksPage() {
  const { user, loading: authLoading } = useAuth()
  const { showToast } = useToast()
  const [bookmarks, setBookmarks] = useState<BookmarkedThread[]>([])
  const [loaded, setLoaded] = useState(false)
  const [removing, setRemoving] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (authLoading || !user) return
    let cancelled = false
    ;(async () => {
      const { data } = await supabase
        .from("bookmarks")
        .select("id, thread_id, created_at, thread:threads(id, title, tag, pro_count, con_count, created_at, is_closed)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })

      if (cancelled) return
      // 쿼리 결과 정리
      const items = (data ?? [])
        .filter((d: Record<string, unknown>) => d.thread)
        .map((d: Record<string, unknown>) => {
          const t = Array.isArray(d.thread) ? d.thread[0] : d.thread
          return { ...d, thread: t } as BookmarkedThread
        })
      setBookmarks(items)
      setLoaded(true)
    })()
    return () => { cancelled = true }
  }, [user?.id, authLoading])

  async function handleRemove(bookmarkId: string) {
    // 낙관적 업데이트
    setRemoving((prev) => new Set(prev).add(bookmarkId))
    setBookmarks((prev) => prev.filter((b) => b.id !== bookmarkId))

    const { error } = await supabase.from("bookmarks").delete().eq("id", bookmarkId)
    if (error) {
      showToast("북마크 해제에 실패했습니다.", "error")
    } else {
      showToast("북마크가 해제되었습니다.", "success")
    }
    setRemoving((prev) => {
      const next = new Set(prev)
      next.delete(bookmarkId)
      return next
    })
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-black text-zinc-100">
        <div className="relative mx-auto w-full max-w-2xl px-4 py-10 sm:px-6">
          <div className="mb-8 flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl border border-cyan-400/30 bg-cyan-400/10">
              <Bookmark className="size-5 text-cyan-300" />
            </div>
            <div className="h-6 w-32 animate-pulse rounded-lg bg-white/[0.07]" />
          </div>
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-20 animate-pulse rounded-2xl bg-white/[0.04]" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-black text-zinc-100">
        <div className="mx-auto max-w-lg px-4 py-20 text-center">
          <Bookmark className="mx-auto size-8 text-zinc-600" />
          <p className="mt-4 text-sm text-zinc-400">로그인이 필요합니다.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-zinc-100">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(1200px_circle_at_50%_10%,rgba(34,211,238,0.1),transparent_55%)]" />
      </div>

      <div className="relative mx-auto w-full max-w-2xl px-4 py-10 sm:px-6">
        <nav className="mb-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-200"
          >
            <ArrowLeft className="size-4" />
            홈으로 돌아가기
          </Link>
        </nav>

        <header className="mb-8 flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-xl border border-cyan-400/30 bg-cyan-400/10 text-cyan-300">
            <Bookmark className="size-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-zinc-50">내 북마크</h1>
            <p className="text-xs text-zinc-500">저장한 토론 목록</p>
          </div>
        </header>

        {!loaded ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-xl bg-zinc-900/50" />
            ))}
          </div>
        ) : bookmarks.length === 0 ? (
          <div className="rounded-2xl border border-white/[0.06] bg-zinc-900/40 p-12 text-center">
            <BookmarkX className="mx-auto size-10 text-zinc-700" />
            <p className="mt-4 text-sm text-zinc-400">아직 북마크한 토론이 없어요.</p>
            <Link
              href="/"
              className="mt-4 inline-flex items-center gap-2 rounded-lg border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-xs font-medium text-cyan-300 transition hover:bg-cyan-400/20"
            >
              <Home className="size-3.5" />
              토론 둘러보기
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {bookmarks.map((bm) => {
              const t = bm.thread
              const total = t.pro_count + t.con_count
              const yesPct = total > 0 ? Math.round((t.pro_count / total) * 100) : 50
              const noPct = 100 - yesPct

              return (
                <div
                  key={bm.id}
                  className="group relative rounded-xl border border-white/[0.06] bg-zinc-900/40 p-4 transition hover:border-white/10 hover:bg-zinc-900/60"
                >
                  <div className="flex items-start justify-between gap-3">
                    <Link href={`/thread/${t.id}`} className="min-w-0 flex-1">
                      <div className="mb-2 flex items-center gap-2">
                        {t.tag && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2 py-0.5 text-[10px] font-medium text-cyan-300">
                            <Tag className="size-2.5" />
                            {t.tag}
                          </span>
                        )}
                        {t.is_closed && (
                          <span className="rounded-full border border-zinc-600/30 bg-zinc-800/50 px-2 py-0.5 text-[10px] text-zinc-500">
                            마감
                          </span>
                        )}
                      </div>
                      <h3 className="text-sm font-medium text-zinc-100 group-hover:text-white">
                        {t.title}
                      </h3>
                      <div className="mt-2 flex items-center gap-3 text-[11px] text-zinc-500">
                        <span>찬성 {t.pro_count} · 반대 {t.con_count}</span>
                        <span>{timeAgo(t.created_at)}</span>
                      </div>

                      {/* 게이지 바 */}
                      {total > 0 && (
                        <div className="mt-2 flex h-1.5 overflow-hidden rounded-full bg-zinc-800">
                          <div
                            className="bg-gradient-to-r from-cyan-400 to-cyan-300 transition-all"
                            style={{ width: `${yesPct}%` }}
                          />
                          <div
                            className="bg-gradient-to-r from-fuchsia-400 to-fuchsia-300 transition-all"
                            style={{ width: `${noPct}%` }}
                          />
                        </div>
                      )}
                    </Link>

                    {/* 북마크 해제 */}
                    <button
                      onClick={() => handleRemove(bm.id)}
                      disabled={removing.has(bm.id)}
                      className="mt-1 shrink-0 rounded-lg border border-white/10 bg-white/5 p-2 text-zinc-500 transition hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50"
                      title="북마크 해제"
                    >
                      <BookmarkX className="size-4" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
