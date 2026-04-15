'use client'

import Link from 'next/link'
import { useLang } from '@/lib/LangContext'
import { Bell, Video, History, Users } from 'lucide-react'

// Persistent guest-only signup banner that sits between the hero and
// the port list. Diego's 2026-04-14 insight: "they need more incentive
// to log in other than us hoping they want to click something."
//
// Previous state had a single signup nudge BELOW the port list and
// another that only fired after 3 home visits — guests saw everything
// they came for (live wait times) without any immediate call to action.
// 205 peak visitors + broken funnel = near-zero conversions.
//
// Strategy: acknowledge what they already have (the live number) and
// sell the FOUR things signup unlocks that they CANNOT get from just
// looking at the page: alerts, cameras, history, community reports.
// Styled as a light card so it doesn't compete with the dark hero above.
export function GuestSignupBanner() {
  const { lang } = useLang()
  const es = lang === 'es'

  const features = [
    {
      icon: Bell,
      es: 'Alertas cuando baje la fila',
      en: 'Alerts when the line drops',
    },
    {
      icon: Video,
      es: 'Cámaras en vivo de los puentes',
      en: 'Live bridge cameras',
    },
    {
      icon: History,
      es: 'Historial por hora del día',
      en: 'Hourly historical patterns',
    },
    {
      icon: Users,
      es: 'Reportes de la raza que cruza',
      en: 'Reports from people crossing',
    },
  ]

  return (
    <section className="mt-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-5 shadow-sm">
      <div className="flex items-start gap-3 mb-4">
        <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
          <Bell className="w-5 h-5 text-white" />
        </div>
        <div className="min-w-0">
          <h2 className="text-base font-black text-gray-900 dark:text-white leading-tight">
            {es
              ? 'Ya viste los tiempos. Ahora que Cruzar te los traiga a ti.'
              : 'You saw the wait times. Now let Cruzar bring them to you.'}
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-snug">
            {es
              ? 'Gratis · 10 segundos · sin tarjeta'
              : 'Free · 10 seconds · no card'}
          </p>
        </div>
      </div>

      <ul className="grid grid-cols-2 gap-2 mb-4">
        {features.map((f) => {
          const Icon = f.icon
          return (
            <li
              key={f.en}
              className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300 font-medium"
            >
              <Icon className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
              <span className="leading-tight">{es ? f.es : f.en}</span>
            </li>
          )
        })}
      </ul>

      <Link
        href="/signup"
        className="block w-full text-center bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-bold py-3 rounded-xl active:scale-[0.98] transition-transform shadow-sm"
      >
        {es ? 'Crear cuenta gratis →' : 'Create free account →'}
      </Link>
    </section>
  )
}
