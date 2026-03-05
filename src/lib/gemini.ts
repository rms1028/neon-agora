const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent"

export async function callGemini(opts: {
  systemPrompt: string
  userPrompt: string
  temperature?: number
  maxOutputTokens?: number
}): Promise<{ text: string } | { error: string; status: number }> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return { error: "AI 서비스 키가 설정되지 않았습니다.", status: 500 }
  }

  const res = await fetch(GEMINI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: opts.systemPrompt }] },
      contents: [{ role: "user", parts: [{ text: opts.userPrompt }] }],
      generationConfig: {
        temperature: opts.temperature ?? 0.5,
        maxOutputTokens: opts.maxOutputTokens ?? 2048,
        thinkingConfig: { thinkingBudget: 0 },
      },
    }),
  })

  if (!res.ok) {
    const errText = await res.text()
    console.error("[callGemini] API error:", res.status, errText)
    if (res.status === 429) {
      return { error: "AI 요청이 많아 잠시 후 다시 시도해주세요.", status: 429 }
    }
    return { error: `AI 분석에 실패했습니다. (${res.status})`, status: 502 }
  }

  const data = await res.json()
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? ""

  if (!text) {
    return { error: "AI 응답이 비어 있습니다.", status: 500 }
  }

  return { text }
}

/** Extract first JSON object from raw AI text */
export function extractJson<T = Record<string, unknown>>(
  raw: string,
): T | null {
  const first = raw.indexOf("{")
  const last = raw.lastIndexOf("}")
  if (first === -1 || last === -1 || last <= first) return null
  try {
    return JSON.parse(raw.slice(first, last + 1)) as T
  } catch {
    return null
  }
}

/** Extract first JSON array from raw AI text */
export function extractJsonArray<T = unknown>(raw: string): T[] | null {
  const first = raw.indexOf("[")
  const last = raw.lastIndexOf("]")
  if (first === -1 || last === -1 || last <= first) return null
  try {
    const arr = JSON.parse(raw.slice(first, last + 1))
    return Array.isArray(arr) ? (arr as T[]) : null
  } catch {
    return null
  }
}
