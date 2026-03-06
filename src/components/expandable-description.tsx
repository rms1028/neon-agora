"use client"

import { useRef, useState, useEffect } from "react"

export function ExpandableDescription({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false)
  const [clamped, setClamped] = useState(false)
  const ref = useRef<HTMLParagraphElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    setClamped(el.scrollHeight > el.clientHeight + 1)
  }, [text])

  return (
    <div style={{ marginTop: 6 }}>
      <p
        ref={ref}
        style={{
          fontSize: 13,
          color: "#888",
          lineHeight: 1.6,
          margin: 0,
          wordBreak: "keep-all",
          overflowWrap: "break-word",
          ...(!expanded
            ? {
                display: "-webkit-box",
                WebkitLineClamp: 3,
                WebkitBoxOrient: "vertical" as const,
                overflow: "hidden",
              }
            : {}),
        }}
      >
        {text}
      </p>
      {clamped && (
        <button
          type="button"
          onClick={() => setExpanded(v => !v)}
          style={{
            marginTop: 4,
            padding: 0,
            border: "none",
            background: "none",
            color: "#66b3ff",
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          {expanded ? "접기" : "더보기…"}
        </button>
      )}
    </div>
  )
}
