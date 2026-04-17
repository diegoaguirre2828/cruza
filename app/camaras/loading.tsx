export default function CamarasLoading() {
  return (
    <main className="min-h-screen bg-gray-950">
      <div className="max-w-6xl mx-auto px-4 pb-24">
        <div className="pt-8 pb-4">
          <div className="h-5 w-28 rounded-full bg-red-500/15 border border-red-500/30 animate-pulse mb-3" />
          <div className="h-10 w-80 rounded-lg bg-white/5 animate-pulse mb-2" />
          <div className="h-10 w-96 rounded-lg bg-white/5 animate-pulse" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-8">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="aspect-video rounded-2xl bg-white/5 animate-pulse" />
          ))}
        </div>
      </div>
    </main>
  )
}
