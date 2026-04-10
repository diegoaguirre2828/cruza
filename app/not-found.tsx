import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="text-center max-w-sm">
        <p className="text-6xl mb-4">🌉</p>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Page not found</h1>
        <p className="text-gray-500 text-sm mb-6">
          Looks like this bridge doesn't exist. Let's get you back on the road.
        </p>
        <Link
          href="/"
          className="inline-block bg-gray-900 text-white font-medium px-6 py-2.5 rounded-xl hover:bg-gray-700 transition-colors text-sm"
        >
          Back to Cruzar
        </Link>
      </div>
    </main>
  )
}
