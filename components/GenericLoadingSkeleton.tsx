// Generic loading skeleton for simpler routes that don't warrant a
// bespoke shape (like /port/[portId] which mimics the hero). Renders
// a header line + 3-6 card blocks that auto-pulse. Used by multiple
// route-level loading.tsx files to avoid ~30 lines of duplication
// each.

export function GenericLoadingSkeleton({
  headerWidthClass = 'w-40',
  rows = 4,
}: {
  headerWidthClass?: string
  rows?: number
}) {
  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-lg mx-auto px-4 pb-24 pt-6">
        <div className={`h-6 ${headerWidthClass} bg-gray-200 dark:bg-gray-800 rounded mb-2 animate-pulse`} />
        <div className="h-3 w-64 bg-gray-200 dark:bg-gray-800 rounded mb-5 animate-pulse" />
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 mb-3 animate-pulse"
          >
            <div className="h-4 w-3/4 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
            <div className="h-3 w-full bg-gray-200 dark:bg-gray-700 rounded mb-1" />
            <div className="h-3 w-2/3 bg-gray-200 dark:bg-gray-700 rounded" />
          </div>
        ))}
      </div>
    </main>
  )
}
