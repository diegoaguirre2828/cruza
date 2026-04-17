export default function ChatLoading() {
  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col">
      <div className="flex-1 max-w-lg w-full mx-auto px-4 pt-6 pb-4">
        <div className="h-6 w-32 bg-gray-200 dark:bg-gray-800 rounded mb-6 animate-pulse" />
        {[0, 1, 2].map((i) => (
          <div key={i} className={`mb-3 flex ${i % 2 === 0 ? 'justify-start' : 'justify-end'}`}>
            <div className={`max-w-[80%] h-12 rounded-2xl animate-pulse ${i % 2 === 0 ? 'bg-gray-200 dark:bg-gray-800' : 'bg-blue-200 dark:bg-blue-900'}`} style={{ width: `${40 + Math.random() * 40}%` }} />
          </div>
        ))}
      </div>
      <div className="max-w-lg w-full mx-auto px-4 pb-6">
        <div className="h-12 w-full bg-gray-200 dark:bg-gray-800 rounded-2xl animate-pulse" />
      </div>
    </main>
  )
}
