"use client"

import { CheckCircle2, Lightbulb } from "lucide-react"

export type CoachingResult = {
  scores: { logic: number; persuasion: number; evidence: number; overall: number }
  strengths: string[]
  improvements: string[]
}

const SCORE_COLORS: Record<string, { bar: string; text: string }> = {
  logic: { bar: "bg-cyan-400", text: "text-cyan-300" },
  persuasion: { bar: "bg-fuchsia-400", text: "text-fuchsia-300" },
  evidence: { bar: "bg-emerald-400", text: "text-emerald-300" },
  overall: { bar: "bg-amber-400", text: "text-amber-300" },
}

const SCORE_LABELS: Record<string, string> = {
  logic: "논리",
  persuasion: "설득",
  evidence: "증거",
  overall: "종합",
}

function RadarChart({
  logic,
  persuasion,
  evidence,
}: {
  logic: number
  persuasion: number
  evidence: number
}) {
  const cx = 60
  const cy = 60
  const r = 45

  // 3축: 위(논리), 왼쪽아래(설득), 오른쪽아래(증거)
  const angles = [-Math.PI / 2, -Math.PI / 2 + (2 * Math.PI) / 3, -Math.PI / 2 + (4 * Math.PI) / 3]
  const values = [logic / 100, persuasion / 100, evidence / 100]

  const fullPoints = angles.map((a) => `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`).join(" ")
  const valuePoints = angles
    .map((a, i) => `${cx + r * values[i] * Math.cos(a)},${cy + r * values[i] * Math.sin(a)}`)
    .join(" ")

  const labels = [
    { x: cx, y: cy - r - 8, text: `논리 ${logic}` },
    { x: cx - r - 6, y: cy + r / 2 + 12, text: `설득 ${persuasion}` },
    { x: cx + r + 6, y: cy + r / 2 + 12, text: `증거 ${evidence}` },
  ]

  return (
    <svg viewBox="0 0 120 130" className="size-full max-w-[140px]">
      {/* Grid */}
      {[0.33, 0.66, 1].map((s) => (
        <polygon
          key={s}
          points={angles.map((a) => `${cx + r * s * Math.cos(a)},${cy + r * s * Math.sin(a)}`).join(" ")}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="0.5"
        />
      ))}
      {/* Axes */}
      {angles.map((a, i) => (
        <line
          key={i}
          x1={cx}
          y1={cy}
          x2={cx + r * Math.cos(a)}
          y2={cy + r * Math.sin(a)}
          stroke="rgba(255,255,255,0.1)"
          strokeWidth="0.5"
        />
      ))}
      {/* Full outline */}
      <polygon points={fullPoints} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />
      {/* Value polygon */}
      <polygon
        points={valuePoints}
        fill="rgba(34,211,238,0.15)"
        stroke="rgba(34,211,238,0.7)"
        strokeWidth="1.5"
        className="coach-radar-polygon"
        style={{ "--radar-length": 600 } as React.CSSProperties}
      />
      {/* Labels */}
      {labels.map((l, i) => (
        <text
          key={i}
          x={l.x}
          y={l.y}
          textAnchor="middle"
          className="fill-zinc-400 text-[7px]"
        >
          {l.text}
        </text>
      ))}
    </svg>
  )
}

export function CoachingPanel({ result }: { result: CoachingResult }) {
  return (
    <div className="mt-3 space-y-3 rounded-xl border border-cyan-400/20 bg-gradient-to-br from-cyan-400/5 to-transparent p-4">
      <div className="flex items-center gap-2 text-[10px] font-semibold tracking-widest text-cyan-400/70">
        AI COACHING REPORT
      </div>

      <div className="flex items-start gap-4">
        {/* Radar chart */}
        <div className="shrink-0">
          <RadarChart
            logic={result.scores.logic}
            persuasion={result.scores.persuasion}
            evidence={result.scores.evidence}
          />
        </div>

        {/* Score bars */}
        <div className="flex-1 space-y-2">
          {(["logic", "persuasion", "evidence", "overall"] as const).map((key, idx) => {
            const score = result.scores[key]
            const colors = SCORE_COLORS[key]
            return (
              <div key={key}>
                <div className="mb-0.5 flex items-center justify-between text-[11px]">
                  <span className="text-zinc-400">{SCORE_LABELS[key]}</span>
                  <span className={`font-bold ${colors.text}`}>{score}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white/10">
                  <div
                    className={`score-bar-fill h-full rounded-full ${colors.bar}`}
                    style={{
                      width: `${score}%`,
                      animationDelay: `${idx * 0.1}s`,
                    }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Strengths */}
      {result.strengths.length > 0 && (
        <div>
          <div className="mb-1.5 flex items-center gap-1 text-[10px] font-semibold text-emerald-300">
            <CheckCircle2 className="size-3" /> 강점
          </div>
          <ul className="space-y-1">
            {result.strengths.map((s, i) => (
              <li key={i} className="text-[11px] text-zinc-300">• {s}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Improvements */}
      {result.improvements.length > 0 && (
        <div>
          <div className="mb-1.5 flex items-center gap-1 text-[10px] font-semibold text-amber-300">
            <Lightbulb className="size-3" /> 개선점
          </div>
          <ul className="space-y-1">
            {result.improvements.map((s, i) => (
              <li key={i} className="text-[11px] text-zinc-400">• {s}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
