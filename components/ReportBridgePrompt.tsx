'use client'

import Link from 'next/link'
import { MessageCircle } from 'lucide-react'
import { useLang } from '@/lib/LangContext'
import { useAuth } from '@/lib/useAuth'
import { trackEvent } from '@/lib/trackEvent'
import { slugForPort } from '@/lib/portSlug'

// Prominent "share your wait" prompt at the top of the Cerca panel.
// Diego 2026-04-26: "the report feature doesnt really stand out, this
// feels more like just a check your wait app not a community thing."
// Each PortCard has a tiny report button but reporting felt like a
// side action, not a community contract.
//
// This card sits above the bridge list as a constant invitation. Two
// surfaces depending on user state:
//   - Has favorite → tap routes to /cruzar/<favorite> with the report
//     intent (the bridge detail page handles the form)
//   - No favorite (guest or unfavorited) → tap routes to /cruzar (port
//     picker via /favorites or first port)

interface Props {
  favoritePortId: string | null
}

export function ReportBridgePrompt({ favoritePortId }: Props) {
  const { user } = useAuth()
  const { lang } = useLang()
  const es = lang === 'es'

  const href = favoritePortId
    ? `/cruzar/${slugForPort(favoritePortId)}#report`
    : '/dashboard'

  return (
    <Link
      href={href}
      onClick={() => trackEvent('report_prompt_tapped', { source: 'home_cerca', has_favorite: !!favoritePortId })}
      className="mt-3 flex items-center gap-3 rounded-2xl bg-gradient-to-r from-amber-400 via-orange-500 to-red-500 px-4 py-3 active:scale-[0.99] transition-transform shadow-sm"
    >
      <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-white/25 flex items-center justify-center">
        <MessageCircle className="w-5 h-5 text-white" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-black text-white leading-tight">
          {es ? '🤝 Reporta tu puente — ayuda a la raza' : "🤝 Share your wait — help the community"}
        </p>
        <p className="text-[11px] text-white/90 mt-0.5 leading-snug">
          {user
            ? (es ? 'Gana puntos por cada reporte' : 'Earn points for every report')
            : (es ? 'Tu reporte ayuda a otros que cruzan ahorita' : 'Your report helps others crossing right now')}
        </p>
      </div>
      <span className="flex-shrink-0 bg-white text-orange-600 text-[11px] font-black px-3 py-1.5 rounded-full whitespace-nowrap">
        {es ? 'Reportar →' : 'Report →'}
      </span>
    </Link>
  )
}
