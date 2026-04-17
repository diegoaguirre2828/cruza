// /port/[portId] loading skeleton. Users land here from FB shares —
// blank white during server-render felt broken. This renders the
// card chrome so the page looks alive within 100ms.

export default function PortLoading() {
  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-lg mx-auto px-4 pb-24">
        <div className="pt-6">
          {/* Back link placeholder */}
          <div className="h-3 w-20 bg-gray-200 dark:bg-gray-800 rounded mb-4 animate-pulse" />

          {/* Hero card skeleton — mimics the live-wait hero */}
          <div className="bg-gradient-to-br from-blue-600 via-indigo-700 to-purple-800 rounded-3xl p-5 shadow-xl text-white animate-pulse">
            <div className="h-4 w-24 bg-white/25 rounded-full" />
            <div className="h-8 w-56 bg-white/25 rounded-lg mt-4" />
            <div className="flex items-baseline gap-2 mt-3">
              <div className="h-14 w-24 bg-white/30 rounded-lg" />
              <div className="h-4 w-8 bg-white/20 rounded" />
            </div>
            <div className="h-10 w-full bg-white/15 rounded-2xl mt-4" />
          </div>

          {/* Lane breakdown skeleton */}
          <div className="mt-4 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 animate-pulse">
            <div className="h-3 w-24 bg-gray-200 dark:bg-gray-700 rounded mb-3" />
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center justify-between py-2 border-t first:border-t-0 border-gray-100 dark:border-gray-700">
                <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded" />
                <div className="h-4 w-12 bg-gray-200 dark:bg-gray-700 rounded" />
              </div>
            ))}
          </div>

          {/* Historical chart skeleton */}
          <div className="mt-4 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 animate-pulse">
            <div className="h-3 w-40 bg-gray-200 dark:bg-gray-700 rounded mb-4" />
            <div className="flex items-end gap-1 h-32">
              {Array.from({ length: 24 }).map((_, i) => (
                <div
                  key={i}
                  className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-t"
                  style={{ height: `${30 + Math.random() * 70}%` }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
