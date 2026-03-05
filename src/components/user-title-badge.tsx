import { getTitle } from "@/lib/titles"

export function UserTitleBadge({ titleKey }: { titleKey: string | null }) {
  if (!titleKey) return null

  const title = getTitle(titleKey)
  if (!title) return null

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${title.colorClass} ${title.bgClass}`}
      style={{ boxShadow: title.glowShadow }}
    >
      {title.name}
    </span>
  )
}
