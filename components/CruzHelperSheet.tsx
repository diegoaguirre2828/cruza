'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { X, Compass, Bell, MapPin, Zap, Camera, Trophy, Sparkles } from 'lucide-react'
import { useLang } from '@/lib/LangContext'
import { trackEvent } from '@/lib/trackEvent'

// Cruz helper sheet — the content of the floating AI button.
// Previously CruzFab navigated straight to /chat, which meant
// every tap was a full page transition and users didn't get a
// sense of what Cruzar could actually DO before committing to a
// conversation. This sheet gives them a fast index of the app's
// main surfaces + a "take a tour" option + the chat entry, all
// in one tap. Dismissible, backdrop-closable, mobile-first but
// renders correctly on desktop.
//
// Feature discovery is the point. Users who want to just ask the
// AI can tap "Ask Cruz" at the bottom. Users who want a map of
// what's available pick from the quick-action list above.

interface Props {
  open: boolean
  onClose: () => void
}

export function CruzHelperSheet({ open, onClose }: Props) {
  const { lang } = useLang()
  const es = lang === 'es'

  // Lock body scroll while open
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  function startTour() {
    trackEvent('cruz_helper_tour_started')
    onClose()
    // Dispatch the event OnboardingTour listens for
    window.dispatchEvent(new Event('cruzar:show-onboarding'))
  }

  function handleActionClick(action: string) {
    trackEvent('cruz_helper_action_tap', { action })
    onClose()
  }

  if (!open) return null

  const actions = [
    {
      key: 'features',
      icon: <Sparkles className="w-5 h-5" />,
      labelEs: 'Todo lo que hace Cruzar',
      labelEn: 'Everything Cruzar does',
      subEs: 'Índice completo · ninguna función oculta',
      subEn: 'Complete index · no hidden features',
      href: '/features',
      color: 'from-indigo-600 to-purple-700 text-white',
    },
    {
      key: 'tour',
      icon: <Compass className="w-5 h-5" />,
      labelEs: 'Dame un tour rápido',
      labelEn: 'Take a quick tour',
      subEs: '5 pantallas · lo esencial en 30 segundos',
      subEn: '5 screens · essentials in 30 seconds',
      onClick: startTour,
      href: null,
    },
    {
      key: 'alerts',
      icon: <Bell className="w-5 h-5" />,
      labelEs: 'Alertas cuando baja la espera',
      labelEn: 'Alerts when waits drop',
      subEs: 'Push + SMS + email · incluido en Pro',
      subEn: 'Push + SMS + email · included in Pro',
      href: '/dashboard',
    },
    {
      key: 'map',
      icon: <MapPin className="w-5 h-5" />,
      labelEs: 'Ver todos los puentes en mapa',
      labelEn: 'See every bridge on the map',
      subEs: '52 cruces · filtrados por tu región',
      subEn: '52 crossings · filtered by your region',
      href: '/mapa',
    },
    {
      key: 'cameras',
      icon: <Camera className="w-5 h-5" />,
      labelEs: 'Cámaras en vivo del puente',
      labelEn: 'Live bridge cameras',
      subEs: 'Incluido en Pro · gratis 3 meses al instalar',
      subEn: 'Included in Pro · free 3 months on install',
      href: '/pricing',
    },
    {
      key: 'optimizer',
      icon: <Zap className="w-5 h-5" />,
      labelEs: 'Optimizador de ruta',
      labelEn: 'Route optimizer',
      subEs: 'Cuál puente es el más rápido AHORITA',
      subEn: 'Which bridge is fastest RIGHT NOW',
      href: '/planner',
    },
    {
      key: 'guardian',
      icon: <Trophy className="w-5 h-5" />,
      labelEs: 'Ranking de guardianes',
      labelEn: 'Guardian leaderboard',
      subEs: 'Quién reporta más en tu zona',
      subEn: "Who's reporting most in your zone",
      href: '/leaderboard',
    },
  ]

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-white dark:bg-gray-900 rounded-t-3xl md:rounded-3xl shadow-2xl relative overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {/* Header */}
        <div className="relative bg-gradient-to-br from-indigo-600 via-purple-700 to-pink-700 text-white px-5 pt-5 pb-6 overflow-hidden">
          <div className="absolute -top-12 -right-12 w-36 h-36 bg-white/10 rounded-full blur-3xl pointer-events-none" />
          <button
            onClick={onClose}
            className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center text-white/70 hover:text-white rounded-full hover:bg-white/10 z-10"
            aria-label={es ? 'Cerrar' : 'Close'}
          >
            <X className="w-4 h-4" />
          </button>
          <div className="relative flex items-center gap-3">
            <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-inner overflow-hidden flex-shrink-0">
              <img src="/logo-icon.svg" alt="" width={40} height={40} className="rounded-lg" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/70 leading-none">
                {es ? 'Asistente' : 'Assistant'}
              </p>
              <h2 className="text-xl font-black mt-1 leading-none">
                {es ? '¿En qué te ayudo?' : 'How can I help?'}
              </h2>
              <p className="text-[11px] text-white/80 mt-1.5 leading-snug">
                {es
                  ? 'Escoge abajo o pregúntame lo que sea'
                  : 'Pick below or ask me anything'}
              </p>
            </div>
          </div>
        </div>

        {/* Quick actions */}
        <div className="p-3 space-y-1.5 max-h-[60vh] overflow-y-auto">
          {actions.map((action) => {
            const body = (
              <div className="flex items-center gap-3 w-full bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl p-3 active:scale-[0.98] transition-all">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  action.color ?? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                }`}>
                  {action.icon}
                </div>
                <div className="min-w-0 flex-1 text-left">
                  <p className="text-sm font-bold text-gray-900 dark:text-gray-100 leading-tight">
                    {es ? action.labelEs : action.labelEn}
                  </p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 leading-snug">
                    {es ? action.subEs : action.subEn}
                  </p>
                </div>
                <span className="text-gray-300 dark:text-gray-600 flex-shrink-0">→</span>
              </div>
            )
            if (action.onClick) {
              return (
                <button key={action.key} onClick={action.onClick} className="block w-full">
                  {body}
                </button>
              )
            }
            return (
              <Link
                key={action.key}
                href={action.href!}
                onClick={() => handleActionClick(action.key)}
                className="block"
              >
                {body}
              </Link>
            )
          })}
        </div>

      </div>
    </div>
  )
}
