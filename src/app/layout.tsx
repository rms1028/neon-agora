import type { Metadata, Viewport } from "next"
import Link from "next/link"
import { Geist, Geist_Mono } from "next/font/google"
import "./globals.css"
import { Providers } from "@/components/providers"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  width: "device-width",
  initialScale: 1,
}

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://neon-agora.vercel.app"

export const metadata: Metadata = {
  title: "네온 아고라: 토론 광장",
  description: "사이버펑크 테마의 실시간 찬반 토론 플랫폼",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "네온 아고라",
  },
  icons: {
    icon: "/favicon.svg",
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    title: "네온 아고라: 토론 광장",
    description: "사이버펑크 테마의 실시간 찬반 토론 플랫폼. 찬성 vs 반대, 당신의 입장은?",
    siteName: "네온 아고라",
    type: "website",
    locale: "ko_KR",
    url: SITE_URL,
    images: [
      {
        url: `${SITE_URL}/og-default.png`,
        width: 1200,
        height: 630,
        alt: "네온 아고라 — 사이버펑크 토론 광장",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "네온 아고라: 토론 광장",
    description: "사이버펑크 테마의 실시간 찬반 토론 플랫폼. 찬성 vs 반대, 당신의 입장은?",
    images: [`${SITE_URL}/og-default.png`],
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ko">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased pb-16 md:pb-0`}
      >
        <Providers>{children}</Providers>
        <footer className="relative border-t border-white/[0.06] bg-black/60 px-4 py-6 text-center text-[11px] text-zinc-600 md:pb-6">
          <div className="mx-auto flex max-w-md flex-wrap items-center justify-center gap-x-4 gap-y-1">
            <span>&copy; {new Date().getFullYear()} 네온 아고라</span>
            <Link href="/terms" className="transition hover:text-zinc-300">이용약관</Link>
            <Link href="/privacy" className="transition hover:text-zinc-300">개인정보처리방침</Link>
          </div>
        </footer>
      </body>
    </html>
  )
}
