'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Star } from 'lucide-react'
import { PortCard } from '@/components/PortCard'
import { useAuth } from '@/lib/useAuth'
import { useFavorites } from '@/lib/useFavorites'
import { useLang } from '@/lib/LangContext'
import type { PortWaitTime } from '@/types'

// Dedicated Favorites page. Shows the user's starred crossings with
// live wait times, pulled from the same /api/ports feed the home list
// uses. Gated behind auth — guests get bounced to signup with ?next=
// so they return here after signing in.

export default function FavoritesPage() {
  const { lang } = useLang()
  const { user, loading: authLoading } = useAuth()
  const { favorites, loading: favLoading, signedIn } = useFavorites()
  const router = useRouter()
  const [ports, setPorts] = useState<PortWaitTime[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      router.replace(`/signup?next=${encodeURIComponent('/favorites')}`)
      return
    }
    fetch('/api/ports', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { ports: [] }))
      .then((d) => {
        setPorts(d.ports || [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [authLoading, user, router])

  const favPorts = ports.filter((p) => favorites.has(p.portId))
  const isReady = !authLoading && !favLoading && !loading

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="sticky top-0 z-10 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link
            href="/"
            className="p-2 -ml-2 rounded-xl text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
            aria-label={lang === 'es' ? 'Volver' : 'Back'}
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-lg font-black text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Star className="w-5 h-5 text-yellow-500 fill-current" />
            {lang === 'es' ? 'Favoritos' : 'Favorites'}
          </h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-4 pb-24">
        {!isReady ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-white dark:bg-gray-800 rounded-2xl h-28 animate-pulse" />
            ))}
          </div>
        ) : !signedIn ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center mt-10">
            {lang === 'es' ? 'Inicia sesión para ver tus favoritos.' : 'Sign in to see your favorites.'}
          </p>
        ) : favPorts.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 text-center">
            <Star className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-1">
              {lang === 'es' ? 'Todavía no tienes favoritos' : 'No favorites yet'}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
              {lang === 'es'
                ? 'Guarda tus puentes más usados para verlos aquí rapidito.'
                : 'Save the bridges you cross most so they show up here instantly.'}
            </p>
            <Link
              href="/"
              className="inline-block text-xs font-bold text-white bg-yellow-500 hover:bg-yellow-600 px-4 py-2 rounded-xl"
            >
              {lang === 'es' ? 'Ver puentes →' : 'Browse bridges →'}
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {favPorts.map((port) => (
              <PortCard key={port.portId} port={port} />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
