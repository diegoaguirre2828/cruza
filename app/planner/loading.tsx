export default function PlannerLoading() {
  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-lg mx-auto px-4 pb-24 pt-6">
        <div className="h-6 w-48 bg-gray-200 dark:bg-gray-800 rounded mb-2 animate-pulse" />
        <div className="h-3 w-64 bg-gray-200 dark:bg-gray-800 rounded mb-5 animate-pulse" />
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 mb-3 animate-pulse">
          <div className="h-10 w-full bg-gray-200 dark:bg-gray-700 rounded-lg mb-3" />
          <div className="h-10 w-full bg-gray-200 dark:bg-gray-700 rounded-lg mb-3" />
          <div className="h-10 w-full bg-blue-200 dark:bg-blue-800 rounded-lg" />
        </div>
        {[0, 1, 2].map((i) => (
          <div key={i} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 mb-3 animate-pulse">
            <div className="h-4 w-36 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
            <div className="h-3 w-full bg-gray-200 dark:bg-gray-700 rounded" />
          </div>
        ))}
      </div>
    </main>
  )
}
