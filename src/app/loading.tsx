export default function Loading() {
  return (
    <div className="min-h-screen bg-black">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(1200px_circle_at_30%_10%,rgba(34,211,238,0.08),transparent_55%)]" />
      </div>

      <div className="relative mx-auto max-w-6xl px-4 py-10">
        {/* header skeleton */}
        <div className="mb-8 flex items-center justify-between">
          <div className="h-8 w-40 animate-pulse rounded-lg bg-white/5" />
          <div className="flex gap-2">
            <div className="size-8 animate-pulse rounded-lg bg-white/5" />
            <div className="h-8 w-24 animate-pulse rounded-full bg-white/5" />
          </div>
        </div>

        {/* card skeletons */}
        <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl border border-white/[0.06] bg-black/30 p-4"
            >
              <div className="mb-3 flex gap-2">
                <div className="h-5 w-12 animate-pulse rounded-full bg-white/5" />
                <div className="h-5 w-10 animate-pulse rounded-full bg-white/5" />
              </div>
              <div className="mb-4 space-y-2">
                <div className="h-4 w-full animate-pulse rounded bg-white/5" />
                <div className="h-4 w-2/3 animate-pulse rounded bg-white/5" />
              </div>
              <div className="mb-3 flex justify-between">
                <div className="h-8 w-16 animate-pulse rounded bg-white/5" />
                <div className="h-8 w-16 animate-pulse rounded bg-white/5" />
              </div>
              <div className="h-2 w-full animate-pulse rounded-full bg-white/5" />
              <div className="mt-4 flex gap-2">
                <div className="h-8 flex-1 animate-pulse rounded-lg bg-white/5" />
                <div className="h-8 flex-1 animate-pulse rounded-lg bg-white/5" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
