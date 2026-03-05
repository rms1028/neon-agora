import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

const PROTECTED_PATHS = ["/settings"]
const ADMIN_PATHS = ["/admin"]

// ── CSRF: 허용 Origin 목록 ──
function getAllowedOrigins(): string[] {
  const origins: string[] = []
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
  if (siteUrl) origins.push(new URL(siteUrl).origin)
  const vercelUrl = process.env.VERCEL_URL
  if (vercelUrl) origins.push(`https://${vercelUrl}`)
  origins.push("http://localhost:3000")
  return origins
}

function hasSupabaseSession(request: NextRequest): boolean {
  // Supabase stores auth tokens in cookies prefixed with "sb-"
  // e.g. sb-<project-ref>-auth-token or sb-<project-ref>-auth-token.0 (chunked)
  const cookies = request.cookies.getAll()
  return cookies.some(
    (c) => c.name.startsWith("sb-") && c.name.includes("-auth-token")
  )
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // ── CSRF: /api/* 변경 요청에 대한 Origin 검증 ──
  if (pathname.startsWith("/api/")) {
    const method = request.method.toUpperCase()
    if (method !== "GET" && method !== "HEAD" && method !== "OPTIONS") {
      // 시스템 호출 (cron, 내부 서비스) → 통과
      const systemKey = request.headers.get("x-system-key")
      if (!systemKey) {
        const origin = request.headers.get("origin")
        if (origin) {
          // 브라우저 요청 → Origin이 허용 목록에 있어야 함
          const allowed = getAllowedOrigins()
          if (!allowed.includes(origin)) {
            return Response.json(
              { error: "Origin not allowed" },
              { status: 403 }
            )
          }
        }
        // Origin 없음 (curl, 서버 간 호출) → Bearer 토큰이 인증 담당, 통과
      }
    }
    return NextResponse.next()
  }

  const isProtected = PROTECTED_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  )
  const isAdmin = ADMIN_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  )

  if (!isProtected && !isAdmin) return NextResponse.next()

  // ── Supabase 세션 쿠키 기반 인증 체크 ──
  if (!hasSupabaseSession(request)) {
    const url = request.nextUrl.clone()
    url.pathname = "/"
    url.searchParams.set("auth", "required")
    return NextResponse.redirect(url)
  }

  // ── /admin 추가 검증: Supabase에서 세션 + is_admin 확인 ──
  if (isAdmin) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceKey) {
      // 환경변수 없으면 안전하게 차단
      const url = request.nextUrl.clone()
      url.pathname = "/"
      return NextResponse.redirect(url)
    }

    // neon_admin_uid 쿠키에서 유저 ID 확인 (auth-provider에서 설정)
    const adminUid = request.cookies.get("neon_admin_uid")?.value
    if (!adminUid) {
      const url = request.nextUrl.clone()
      url.pathname = "/"
      url.searchParams.set("auth", "required")
      return NextResponse.redirect(url)
    }

    try {
      // service_role로 profiles 테이블 직접 조회
      const res = await fetch(
        `${supabaseUrl}/rest/v1/profiles?id=eq.${adminUid}&select=is_admin`,
        {
          headers: {
            apikey: serviceKey,
            Authorization: `Bearer ${serviceKey}`,
          },
        }
      )
      if (!res.ok) {
        const url = request.nextUrl.clone()
        url.pathname = "/"
        return NextResponse.redirect(url)
      }
      const rows = await res.json()
      if (!Array.isArray(rows) || rows.length === 0 || !rows[0].is_admin) {
        const url = request.nextUrl.clone()
        url.pathname = "/"
        return NextResponse.redirect(url)
      }
    } catch {
      // 네트워크 오류 시 안전하게 차단
      const url = request.nextUrl.clone()
      url.pathname = "/"
      return NextResponse.redirect(url)
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/settings/:path*", "/admin/:path*", "/api/:path*"],
}
