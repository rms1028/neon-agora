"use client"

import { type ReactNode, useState } from "react"
import {
  BarChart3,
  ChevronDown,
  Clock,
  Scale,
  Sparkles,
  Swords,
  TrendingUp,
  Zap,
} from "lucide-react"

const TOOL_ICONS = [
  { icon: Scale, label: "AI 판결" },
  { icon: BarChart3, label: "리포트" },
  { icon: TrendingUp, label: "트렌드" },
  { icon: Clock, label: "타임라인" },
  { icon: Swords, label: "대결" },
  { icon: Zap, label: "라이브" },
] as const

export function ToolDrawer({
  children,
  template,
}: {
  children: ReactNode
  template: string
}) {
  const [open, setOpen] = useState(false)
  const accent = template === "strict" ? "#00FFD1" : "#39FF14"

  return (
    <div className="relative shrink-0 border-b border-white/[0.06]">
      {/* ── Collapsed bar ── */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 bg-black/60 px-4 py-2.5 backdrop-blur transition-colors hover:bg-white/[0.03] sm:px-6"
      >
        <Sparkles className="size-4 shrink-0" style={{ color: accent }} />
        <span className="text-[12px] font-semibold tracking-wide text-zinc-300">
          도구 &amp; 분석
        </span>

        {/* Mini tool icons */}
        <div className="ml-1 hidden items-center gap-1 sm:flex">
          {TOOL_ICONS.map(({ icon: Icon, label }) => (
            <span
              key={label}
              className="rounded-md border border-white/[0.08] bg-white/[0.03] p-1"
              title={label}
            >
              <Icon className="size-3 text-zinc-600" />
            </span>
          ))}
        </div>

        <div className="flex-1" />

        <span className="text-[10px] text-zinc-600">
          {open ? "접기" : "펼치기"}
        </span>
        <ChevronDown
          className={`size-4 text-zinc-500 transition-transform duration-300 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {/* ── Animated slide content (CSS grid trick) ── */}
      <div
        className="grid transition-[grid-template-rows] duration-300 ease-in-out"
        style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden">
          <div
            className="mx-auto max-w-7xl space-y-3 overflow-y-auto px-4 py-3 sm:px-6"
            style={{ maxHeight: "50vh" }}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}
