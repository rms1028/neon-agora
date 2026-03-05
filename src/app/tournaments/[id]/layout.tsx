import type { Metadata } from "next"
import { supabase } from "@/lib/supabase"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const { data: t } = await supabase
    .from("tournaments")
    .select("title, description, status, bracket_size")
    .eq("id", id)
    .maybeSingle()

  if (!t) {
    return { title: "토너먼트를 찾을 수 없습니다 | 네온 아고라" }
  }

  const row = t as Record<string, unknown>
  const title = String(row.title ?? "토너먼트")
  const status = row.status === "completed" ? "완료" : row.status === "active" ? "진행중" : "모집중"
  const size = Number(row.bracket_size) || 4
  const desc = `[${status}] ${size}강 토너먼트 — ${String(row.description ?? "").slice(0, 120)}`
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://neon-agora.vercel.app"

  return {
    title: `${title} | 네온 아고라`,
    description: desc,
    openGraph: {
      title,
      description: desc,
      url: `${siteUrl}/tournaments/${id}`,
      images: [{ url: `${siteUrl}/og-default.png`, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: desc,
      images: [`${siteUrl}/og-default.png`],
    },
  }
}

export default function TournamentDetailLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
