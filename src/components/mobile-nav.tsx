"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Bell, Home, Shield, Sparkles, Trophy, User } from "lucide-react"

import { useNotifications } from "@/components/notification-provider"
import { useAuth } from "@/components/auth-provider"
import { supabase } from "@/lib/supabase"

type Tab = {
  href: string
  icon: typeof Home
  label: string
  badge?: boolean
  adminOnly?: boolean
}

const TABS: Tab[] = [
  { href: "/", icon: Home, label: "홈" },
  { href: "/seasons", icon: Sparkles, label: "시즌" },
  { href: "/rankings", icon: Trophy, label: "랭킹" },
  { href: "/notifications", icon: Bell, label: "알림", badge: true },
  { href: "/profile", icon: User, label: "프로필" },
  { href: "/admin", icon: Shield, label: "관리", adminOnly: true },
]

export function MobileNav() {
  const pathname = usePathname()
  const { unreadCount } = useNotifications()
  const { user } = useAuth()
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    if (!user) { setIsAdmin(false); return }
    let cancelled = false
    ;(async () => {
      const { data } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", user.id)
        .maybeSingle()
      if (!cancelled && data?.is_admin) setIsAdmin(true)
    })()
    return () => { cancelled = true }
  }, [user])

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-zinc-950/90 backdrop-blur-lg md:hidden">
      <div className="flex items-center justify-around">
        {TABS.filter((tab) => !tab.adminOnly || isAdmin).map((tab) => {
          const active =
            tab.href === "/"
              ? pathname === "/"
              : pathname.startsWith(tab.href)
          const Icon = tab.icon

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`relative flex min-w-[44px] flex-col items-center gap-0.5 px-3 py-2.5 text-[10px] transition ${
                active
                  ? tab.adminOnly ? "text-amber-300" : "text-cyan-300"
                  : "text-zinc-500 active:text-zinc-300"
              }`}
            >
              <Icon className="size-5" />
              <span>{tab.label}</span>
              {tab.badge && unreadCount > 0 && (
                <span className="absolute right-1 top-1.5 grid min-w-[16px] place-items-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
              {active && (
                <span className={`absolute -top-px left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-full ${
                  tab.adminOnly ? "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]" : "bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.6)]"
                }`} />
              )}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
