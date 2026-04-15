'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, Video, Star, Users } from 'lucide-react'
import { useLang } from '@/lib/LangContext'
import { useAuth } from '@/lib/useAuth'

// First-launch welcome overlay. Diego 2026-04-15: mobile PWA walkthrough
// revealed guests can install the PWA and then open it with zero
// indication that signing up exists — the existing GuestSignupBanner
// sits below the hero and is invisible on a cold launch. Users either
// think the app is broken or bounce.
//
// This overlay fires exactly once per installation / per browser, for
// guests only, blocking the home screen until they pick a path:
//   1. Crear cuenta → /signup
//   2. Iniciar sesión → /login
//   3. Solo ver puentes → dismiss, set flag, fall through to home
//
// Not dismissable by tapping the backdrop — we want a deliberate choice
// so the signup rate climbs instead of everyone swiping past a toast.
//
// Storage key is namespaced so we can reset it in Diego's test flows
// without nuking unrelated keys.

const FLAG_KEY = 'cruzar_first_launch_welcomed_v1'

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  if (window.matchMedia?.('(display-mode: standalone)').matches) return true
  // Safari PWA fallback
  return (window.navigator as Navigator & { standalone?: boolean }).standalone === true
}

export function PwaFirstLaunchWelcome() {
  const { lang } = useLang()
  const es = lang === 'es'
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [show, show_] = useState(false)

  useEffect(() => {
    if (authLoading) return
    if (user) return // signed in — nothing to do
    if (typeof window === 'undefined') return
    try {
      if (localStorage.getItem(FLAG_KEY) === '1') return
    } catch {
      // localStorage unavailable — show once per session anyway
    }
    // Defer by a beat so the home page renders first and the overlay
    // animates in on top. Keeps the first paint snappy.
    const id = setTimeout(() => show_(true), 350)
    return () => clearTimeout(id)
  }, [authLoading, user])

  function dismiss(reason: 'signup' | 'signin' | 'guest') {
    try { localStorage.setItem(FLAG_KEY, '1') } catch { /* ignore */ }
    show_(false)
    if (reason === 'signup') router.push('/signup?next=/')
    else if (reason === 'signin') router.push('/login?next=/')
    // guest: stay on home
  }

  if (!show) return null

  const standalone = isStandalone()

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pwa-welcome-title"
    >
      <div
        className="w-full sm:max-w-md bg-white dark:bg-gray-900 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {/* Header */}
        <div className="bg-gradient-to-br from-blue-600 via-indigo-700 to-purple-800 px-6 pt-6 pb-5 text-white relative overflow-hidden">
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-12 -left-12 w-40 h-40 bg-white/10 rounded-full blur-3xl pointer-events-none" />
          <p className="text-[10px] font-black uppercase tracking-widest text-blue-200 relative">
            {standalone
              ? (es ? 'Bienvenido a Cruzar' : 'Welcome to Cruzar')
              : (es ? 'Empezar con Cruzar' : 'Get started with Cruzar')}
          </p>
          <h2 id="pwa-welcome-title" className="text-2xl font-black leading-tight mt-1 relative">
            {es
              ? 'Tiempos de puente en vivo, en tu bolsillo.'
              : 'Live bridge wait times, in your pocket.'}
          </h2>
          <p className="text-xs text-blue-100/90 mt-2 relative">
            {es
              ? 'Crea tu cuenta gratis pa\' desbloquear todo — o solo ver los tiempos por ahorita.'
              : 'Create a free account to unlock everything — or just peek at the wait times for now.'}
          </p>
        </div>

        {/* Feature strip — 4 compact rows showing what signup unlocks */}
        <ul className="px-6 py-4 space-y-2.5">
          {[
            { Icon: Bell, es: 'Alertas cuando baje la fila', en: 'Alerts when the line drops' },
            { Icon: Video, es: 'Cámaras en vivo del puente', en: 'Live bridge cameras' },
            { Icon: Star, es: 'Guardar tus puentes favoritos', en: 'Save your favorite bridges' },
            { Icon: Users, es: 'Reportes de la raza que cruza', en: 'Reports from people crossing' },
          ].map(({ Icon, es: esLabel, en }) => (
            <li key={en} className="flex items-center gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
                <Icon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              </div>
              <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                {es ? esLabel : en}
              </span>
            </li>
          ))}
        </ul>

        {/* Actions */}
        <div className="px-6 pb-6 space-y-2">
          <button
            type="button"
            onClick={() => dismiss('signup')}
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-black py-3.5 rounded-2xl active:scale-[0.98] transition-transform shadow-sm"
          >
            {es ? 'Crear cuenta gratis' : 'Create free account'}
          </button>
          <button
            type="button"
            onClick={() => dismiss('signin')}
            className="w-full bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm font-bold py-3 rounded-2xl active:scale-[0.98] transition-transform"
          >
            {es ? 'Ya tengo cuenta · iniciar sesión' : 'I already have an account · sign in'}
          </button>
          <button
            type="button"
            onClick={() => dismiss('guest')}
            className="w-full text-gray-500 dark:text-gray-400 text-xs font-semibold py-2 active:scale-[0.98] transition-transform"
          >
            {es ? 'Solo ver los tiempos por ahorita' : 'Just peek at the wait times'}
          </button>
        </div>
      </div>
    </div>
  )
}
