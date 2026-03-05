// ─── 비속어 필터 ──────────────────────────────────────────────────────────
// 클라이언트 + 서버 공용. 경량 정규식 기반.

// 한국어 비속어/욕설 패턴 (정규식 변형 포함)
const KO_PATTERNS = [
  "시발", "씨발", "씨빨", "시빨", "ㅅㅂ", "ㅆㅂ",
  "병신", "ㅂㅅ", "븅신", "빙신",
  "지랄", "ㅈㄹ",
  "개새끼", "개세끼", "개쉐끼", "개색끼",
  "닥쳐", "닥치",
  "꺼져",
  "미친놈", "미친년", "미친새끼",
  "좆", "자지", "보지",
  "창녀", "창년",
  "니미", "느금마", "느금",
  "섹스",  "쎅스",
  "엿먹", "엿같",
  "개같", "개년",
  "씹", "ㅆ", // single char ㅆ as standalone
  "존나", "졸라", "ㅈㄴ",
  "새끼", "쉐끼", "색끼",
  "아가리",
  "쓰레기",
  "ㅗ",
]

// 영어 비속어 (이스케이프하지 않은 원문 — buildRegex가 이스케이프 처리)
const EN_PATTERNS = [
  "fuck", "f*ck", "fck", "fuk",
  "shit", "sh1t", "s*it",
  "bitch", "b1tch",
  "asshole", "a**hole",
  "bastard",
  "damn",
  "dick", "d1ck",
  "pussy",
  "nigger", "n1gger",
  "retard",
  "cunt",
  "whore",
  "stfu", "gtfo",
]

// 정규식 생성 (대소문자 무시, 한글/영어 패턴 합침)
function buildRegex(patterns: string[], flags: string): RegExp {
  const escaped = patterns.map((p) =>
    p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  )
  return new RegExp(escaped.join("|"), flags)
}

const ALL_PATTERNS = [...KO_PATTERNS, ...EN_PATTERNS]
// g 플래그 없는 regex → .test()에서 lastIndex 상태 문제 방지
const TEST_REGEX = buildRegex(ALL_PATTERNS, "i")
// g 플래그 있는 regex → .replace() / .match() 용
const MATCH_REGEX = buildRegex(ALL_PATTERNS, "gi")

/**
 * 텍스트에 비속어가 포함되어 있는지 검사
 */
export function containsProfanity(text: string): boolean {
  return TEST_REGEX.test(text)
}

/**
 * 비속어를 *** 로 마스킹
 */
export function maskProfanity(text: string): string {
  return text.replace(MATCH_REGEX, (match) => "*".repeat(match.length))
}

/**
 * 감지된 비속어 목록 반환
 */
export function detectProfanity(text: string): string[] {
  const matches = text.match(MATCH_REGEX)
  return matches ? [...new Set(matches)] : []
}
