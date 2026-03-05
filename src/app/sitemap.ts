import type { MetadataRoute } from "next"
import { createClient } from "@supabase/supabase-js"

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://neon-agora.vercel.app"

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  // 정적 페이지
  const staticPages: MetadataRoute.Sitemap = [
    { url: SITE_URL, lastModified: new Date(), changeFrequency: "hourly", priority: 1.0 },
    { url: `${SITE_URL}/arena`, lastModified: new Date(), changeFrequency: "hourly", priority: 0.8 },
    { url: `${SITE_URL}/rankings`, lastModified: new Date(), changeFrequency: "daily", priority: 0.7 },
    { url: `${SITE_URL}/stats`, lastModified: new Date(), changeFrequency: "daily", priority: 0.6 },
    { url: `${SITE_URL}/seasons`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.5 },
    { url: `${SITE_URL}/tournaments`, lastModified: new Date(), changeFrequency: "daily", priority: 0.6 },
    { url: `${SITE_URL}/weekly-report`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.5 },
  ]

  // 동적 토론 페이지 (최근 500개)
  const { data: threads } = await supabase
    .from("threads")
    .select("id, created_at, updated_at")
    .order("created_at", { ascending: false })
    .limit(500)

  const threadPages: MetadataRoute.Sitemap = (threads ?? []).map((t) => ({
    url: `${SITE_URL}/thread/${t.id}`,
    lastModified: new Date(t.updated_at || t.created_at),
    changeFrequency: "daily" as const,
    priority: 0.8,
  }))

  // 토너먼트 상세
  const { data: tournaments } = await supabase
    .from("tournaments")
    .select("id, created_at")
    .order("created_at", { ascending: false })
    .limit(50)

  const tournamentPages: MetadataRoute.Sitemap = (tournaments ?? []).map((t) => ({
    url: `${SITE_URL}/tournaments/${t.id}`,
    lastModified: new Date(t.created_at),
    changeFrequency: "daily" as const,
    priority: 0.6,
  }))

  return [...staticPages, ...threadPages, ...tournamentPages]
}
