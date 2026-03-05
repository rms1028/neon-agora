"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { TrendingUp } from "lucide-react"

import { supabase } from "@/lib/supabase"

// ── 타입 ──────────────────────────────────────────────────────────────────────

type TrendPoint = {
  bucket: string
  cumulative_pro: number
  cumulative_con: number
}

// ── 유틸 ──────────────────────────────────────────────────────────────────────

function formatBucket(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  const m = d.getMonth() + 1
  const day = d.getDate()
  const h = d.getHours()
  return `${m}/${day} ${String(h).padStart(2, "0")}시`
}

// ── SVG 영역 차트 ─────────────────────────────────────────────────────────────

const CHART_W = 560
const CHART_H = 200
const PAD_L = 40
const PAD_R = 16
const PAD_T = 16
const PAD_B = 28

export function VoteTrendChart({ threadId }: { threadId: string }) {
  const [data, setData] = useState<TrendPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [tooltip, setTooltip] = useState<{
    x: number
    y: number
    point: TrendPoint
  } | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  // ── 데이터 로드 ──
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data: rows, error } = await supabase.rpc("get_vote_trend", {
        p_thread_id: threadId,
      })
      if (!cancelled) {
        if (!error && Array.isArray(rows)) {
          setData(
            rows.map((r: Record<string, unknown>) => ({
              bucket: String(r.bucket ?? ""),
              cumulative_pro: Number(r.cumulative_pro ?? 0),
              cumulative_con: Number(r.cumulative_con ?? 0),
            }))
          )
        }
        setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [threadId])

  // ── 좌표 계산 ──
  const { proPoints, conPoints, proArea, conArea, yTicks, xLabels } =
    useMemo(() => {
      if (data.length < 2)
        return {
          proPoints: "",
          conPoints: "",
          proArea: "",
          conArea: "",
          yTicks: [] as { y: number; label: string }[],
          xLabels: [] as { x: number; label: string }[],
        }

      const maxVal = Math.max(
        ...data.map((d) => Math.max(d.cumulative_pro, d.cumulative_con)),
        1
      )
      const yMax = Math.ceil(maxVal * 1.15) || 1

      const plotW = CHART_W - PAD_L - PAD_R
      const plotH = CHART_H - PAD_T - PAD_B

      const toX = (i: number) =>
        PAD_L + (i / (data.length - 1)) * plotW
      const toY = (v: number) =>
        PAD_T + plotH - (v / yMax) * plotH

      const proPts = data.map((d, i) => `${toX(i)},${toY(d.cumulative_pro)}`)
      const conPts = data.map((d, i) => `${toX(i)},${toY(d.cumulative_con)}`)

      const baseline = `${toX(data.length - 1)},${toY(0)} ${toX(0)},${toY(0)}`

      // Y축 눈금 (최대 4개)
      const step = Math.max(1, Math.ceil(yMax / 4))
      const ticks: { y: number; label: string }[] = []
      for (let v = 0; v <= yMax; v += step) {
        ticks.push({ y: toY(v), label: String(v) })
      }

      // X축 라벨 (최대 5개)
      const xLbls: { x: number; label: string }[] = []
      const maxLabels = Math.min(data.length, 5)
      for (let i = 0; i < maxLabels; i++) {
        const idx =
          maxLabels <= 1
            ? 0
            : Math.round((i / (maxLabels - 1)) * (data.length - 1))
        xLbls.push({ x: toX(idx), label: formatBucket(data[idx].bucket) })
      }

      return {
        proPoints: proPts.join(" "),
        conPoints: conPts.join(" "),
        proArea: proPts.join(" ") + " " + baseline,
        conArea: conPts.join(" ") + " " + baseline,
        yTicks: ticks,
        xLabels: xLbls,
      }
    }, [data])

  // ── 마우스 호버 ──
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (data.length < 2 || !svgRef.current) return
    const rect = svgRef.current.getBoundingClientRect()
    const mouseX = ((e.clientX - rect.left) / rect.width) * CHART_W
    const plotW = CHART_W - PAD_L - PAD_R

    const ratio = Math.max(0, Math.min(1, (mouseX - PAD_L) / plotW))
    const idx = Math.round(ratio * (data.length - 1))
    const point = data[idx]
    if (!point) return

    const x = PAD_L + (idx / (data.length - 1)) * plotW
    setTooltip({ x, y: PAD_T, point })
  }

  const handleMouseLeave = () => setTooltip(null)

  // ── 데이터 부족 or 로딩 ──
  if (loading) {
    return (
      <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-5 backdrop-blur">
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <TrendingUp className="size-4" />
          투표 트렌드 로딩 중...
        </div>
      </div>
    )
  }

  if (data.length < 3) {
    return (
      <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-5 backdrop-blur">
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <TrendingUp className="size-4" />
          투표 데이터가 부족하여 트렌드 차트를 표시할 수 없습니다.
        </div>
      </div>
    )
  }

  // ── 라인 길이 (stroke-dasharray) ──
  const estimatedLen = data.length * 80

  return (
    <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-5 backdrop-blur">
      {/* 헤더 */}
      <div className="mb-3 flex items-center gap-2">
        <TrendingUp className="size-4 text-emerald-300" />
        <span className="text-[10px] font-bold tracking-widest text-zinc-400">
          VOTE TREND
        </span>
        <span className="text-[10px] text-zinc-600">
          {data.length}개 구간 · 6시간 단위
        </span>
      </div>

      {/* SVG 차트 */}
      <svg
        ref={svgRef}
        viewBox={`0 0 ${CHART_W} ${CHART_H}`}
        className="w-full"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <defs>
          <linearGradient id="proGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgb(34,211,238)" stopOpacity="0.25" />
            <stop offset="100%" stopColor="rgb(34,211,238)" stopOpacity="0.02" />
          </linearGradient>
          <linearGradient id="conGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgb(232,121,249)" stopOpacity="0.25" />
            <stop offset="100%" stopColor="rgb(232,121,249)" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* Y축 눈금선 */}
        {yTicks.map((t) => (
          <g key={t.label}>
            <line
              x1={PAD_L}
              y1={t.y}
              x2={CHART_W - PAD_R}
              y2={t.y}
              stroke="rgba(255,255,255,0.06)"
              strokeDasharray="4 4"
            />
            <text
              x={PAD_L - 6}
              y={t.y + 3}
              textAnchor="end"
              className="fill-zinc-600 text-[9px]"
            >
              {t.label}
            </text>
          </g>
        ))}

        {/* X축 라벨 */}
        {xLabels.map((l, i) => (
          <text
            key={i}
            x={l.x}
            y={CHART_H - 4}
            textAnchor="middle"
            className="fill-zinc-600 text-[8px]"
          >
            {l.label}
          </text>
        ))}

        {/* 찬성 영역 */}
        <polygon points={proArea} fill="url(#proGrad)" />
        <polyline
          points={proPoints}
          fill="none"
          stroke="rgb(34,211,238)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="trend-line-animate"
          style={{ "--line-length": estimatedLen } as React.CSSProperties}
        />

        {/* 반대 영역 */}
        <polygon points={conArea} fill="url(#conGrad)" />
        <polyline
          points={conPoints}
          fill="none"
          stroke="rgb(232,121,249)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="trend-line-animate"
          style={
            {
              "--line-length": estimatedLen,
              animationDelay: "0.3s",
            } as React.CSSProperties
          }
        />

        {/* 데이터 포인트 dot */}
        {data.map((d, i) => {
          const plotW = CHART_W - PAD_L - PAD_R
          const plotH = CHART_H - PAD_T - PAD_B
          const maxVal = Math.max(
            ...data.map((p) => Math.max(p.cumulative_pro, p.cumulative_con)),
            1
          )
          const yMax = Math.ceil(maxVal * 1.15) || 1
          const x = PAD_L + (i / (data.length - 1)) * plotW
          const yPro = PAD_T + plotH - (d.cumulative_pro / yMax) * plotH
          const yCon = PAD_T + plotH - (d.cumulative_con / yMax) * plotH
          return (
            <g key={i}>
              <circle cx={x} cy={yPro} r="3" fill="rgb(34,211,238)" opacity="0.7" />
              <circle cx={x} cy={yCon} r="3" fill="rgb(232,121,249)" opacity="0.7" />
            </g>
          )
        })}

        {/* 툴팁 수직선 + 박스 */}
        {tooltip && (
          <g>
            <line
              x1={tooltip.x}
              y1={PAD_T}
              x2={tooltip.x}
              y2={CHART_H - PAD_B}
              stroke="rgba(255,255,255,0.15)"
              strokeDasharray="3 3"
            />
            <rect
              x={Math.min(tooltip.x + 8, CHART_W - 120)}
              y={tooltip.y}
              width="110"
              height="44"
              rx="6"
              fill="rgba(0,0,0,0.85)"
              stroke="rgba(255,255,255,0.12)"
            />
            <text
              x={Math.min(tooltip.x + 16, CHART_W - 112)}
              y={tooltip.y + 16}
              className="fill-cyan-300 text-[10px]"
            >
              찬성: {tooltip.point.cumulative_pro}표
            </text>
            <text
              x={Math.min(tooltip.x + 16, CHART_W - 112)}
              y={tooltip.y + 32}
              className="fill-fuchsia-300 text-[10px]"
            >
              반대: {tooltip.point.cumulative_con}표
            </text>
          </g>
        )}
      </svg>

      {/* 범례 */}
      <div className="mt-2 flex items-center justify-center gap-5 text-[10px] text-zinc-500">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block size-2 rounded-full bg-cyan-400" />
          찬성 누적
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block size-2 rounded-full bg-fuchsia-400" />
          반대 누적
        </span>
      </div>
    </div>
  )
}
