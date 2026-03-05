"use client"

import { createContext, useContext, useEffect, useState } from "react"
import type { User } from "@supabase/supabase-js"
import { supabase } from "@/lib/supabase"

type AuthContextValue = {
  user: User | null
  loading: boolean
}

const AuthContext = createContext<AuthContextValue>({ user: null, loading: true })

export function useAuth() {
  return useContext(AuthContext)
}

function syncCookie(loggedIn: boolean, uid?: string) {
  if (typeof document === "undefined") return
  if (loggedIn) {
    document.cookie = "neon_auth=1; path=/; max-age=604800; SameSite=Lax"
    if (uid) {
      document.cookie = `neon_admin_uid=${uid}; path=/; max-age=604800; SameSite=Lax`
    }
  } else {
    document.cookie = "neon_auth=; path=/; max-age=0"
    document.cookie = "neon_admin_uid=; path=/; max-age=0"
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // 초기 세션 로드
    supabase.auth.getSession().then(({ data }) => {
      const u = data.session?.user ?? null
      setUser(u)
      syncCookie(!!u, u?.id)
      setLoading(false)
    })

    // 로그인/로그아웃 이벤트 실시간 구독
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_, session) => {
      const u = session?.user ?? null
      setUser(u)
      syncCookie(!!u, u?.id)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  )
}
