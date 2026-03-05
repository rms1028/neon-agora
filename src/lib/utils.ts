import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** profile 객체 또는 UUID → 표시 이름 */
export function getDisplayName(
  profileOrId:
    | { display_name?: string | null; id?: string }
    | string
    | null
    | undefined
): string {
  if (!profileOrId) return "익명"
  if (typeof profileOrId === "string") {
    return profileOrId.replace(/-/g, "").slice(0, 8).toUpperCase()
  }
  if (profileOrId.display_name) return profileOrId.display_name
  if (profileOrId.id) {
    return profileOrId.id.replace(/-/g, "").slice(0, 8).toUpperCase()
  }
  return "익명"
}

/** ISO 날짜 문자열 → 상대 시간 ("방금 전", "3분 전", "2시간 전" 등) */
export function timeAgo(date: string | Date | null | undefined): string {
  if (!date) return ""
  const now = Date.now()
  const then = new Date(date).getTime()
  const diff = Math.max(0, now - then)
  const sec = Math.floor(diff / 1000)

  if (sec < 60) return "방금 전"
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}분 전`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}시간 전`
  const day = Math.floor(hr / 24)
  if (day < 7) return `${day}일 전`
  const week = Math.floor(day / 7)
  if (week < 5) return `${week}주 전`
  const month = Math.floor(day / 30)
  if (month < 12) return `${month}달 전`
  const year = Math.floor(day / 365)
  return `${year}년 전`
}
