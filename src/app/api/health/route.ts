import { createClient } from "@supabase/supabase-js"

export async function GET() {
  const start = Date.now()

  let dbOk = false
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (url && key) {
    try {
      const supabase = createClient(url, key)
      const { error } = await supabase.from("profiles").select("id").limit(1)
      dbOk = !error
    } catch {
      // DB connection failed
    }
  }

  const latency = Date.now() - start
  const status = dbOk ? "healthy" : "degraded"

  return Response.json(
    { status, timestamp: new Date().toISOString(), latency_ms: latency },
    {
      status: dbOk ? 200 : 503,
      headers: { "Cache-Control": "no-cache, no-store, must-revalidate" },
    }
  )
}
