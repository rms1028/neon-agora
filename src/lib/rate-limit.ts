// Persistent rate limiter using Supabase RPC (REST)
// Serverless-safe: state is stored in DB, not in-memory

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for")
  if (forwarded) return forwarded.split(",")[0].trim()
  const realIp = req.headers.get("x-real-ip")
  if (realIp) return realIp.trim()
  return "unknown"
}

/**
 * 레이트 리밋 체크. 초과 시 429 Response 반환, 아니면 null.
 * Supabase RPC 기반 — Serverless 환경에서도 영속적으로 동작.
 * RPC 실패 시 fail-open (DB 장애가 API를 차단하지 않도록).
 */
export async function rateLimitResponse(
  req: Request,
  limit: number,
  windowMs: number,
  failClosed = false
): Promise<Response | null> {
  if (!supabaseUrl || !serviceKey) {
    return failClosed
      ? Response.json({ error: "서비스를 일시적으로 사용할 수 없습니다." }, { status: 503 })
      : null
  }

  const ip = getClientIp(req)
  const url = new URL(req.url)
  const key = `${ip}:${url.pathname}`

  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/rpc/check_rate_limit`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        p_key: key,
        p_limit: limit,
        p_window_ms: windowMs,
      }),
    })

    if (!res.ok) {
      console.error("[rate-limit] RPC error:", res.status)
      return failClosed
        ? Response.json({ error: "서비스를 일시적으로 사용할 수 없습니다." }, { status: 503 })
        : null
    }

    const data = await res.json()

    // 확률적 cleanup (1% 확률)
    if (Math.random() < 0.01) {
      fetch(`${supabaseUrl}/rest/v1/rpc/cleanup_rate_limits`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
        },
      }).catch(() => {})
    }

    if (data && !data.allowed) {
      const retryAfter = data.retry_after ?? 60
      return Response.json(
        { error: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요." },
        {
          status: 429,
          headers: { "Retry-After": String(retryAfter) },
        }
      )
    }

    return null
  } catch (err) {
    console.error("[rate-limit] unexpected error:", err)
    return failClosed
      ? Response.json({ error: "서비스를 일시적으로 사용할 수 없습니다." }, { status: 503 })
      : null
  }
}
