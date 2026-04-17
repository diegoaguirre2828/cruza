export default function NegociosLoading() {
  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-lg mx-auto px-4 pb-24 pt-6">
        <div className="h-6 w-40 bg-gray-200 dark:bg-gray-800 rounded mb-2 animate-pulse" />
        <div className="h-3 w-64 bg-gray-200 dark:bg-gray-800 rounded mb-5 animate-pulse" />
        <div className="h-10 w-full bg-gray-200 dark:bg-gray-800 rounded-xl mb-4 animate-pulse" />
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 mb-3 animate-pulse">
            <div className="flex gap-3">
              <div className="w-14 h-14 bg-gray-200 dark:bg-gray-700 rounded-xl flex-shrink-0" />
              <div className="flex-1">
                <div className="h-4 w-3/4 bg-gray-200 dark:bg-gray-700 rounded mb-1" />
                <div className="h-3 w-full bg-gray-200 dark:bg-gray-700 rounded mb-1" />
                <div className="h-3 w-1/2 bg-gray-200 dark:bg-gray-700 rounded" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </main>
  )
}
