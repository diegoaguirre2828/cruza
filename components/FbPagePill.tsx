'use client'

import { useState } from 'react'
import { useLang } from '@/lib/LangContext'
import { trackEvent } from '@/lib/trackEvent'

// Compact FB page follow pill for the home header row. Replaces
// the full-size FbPageFollowCard widget that used to sit below
// UrgentAlerts — the widget ate permanent vertical space for a
// secondary action, which is exactly what pills are for.
//
// Tap opens a minimal bottom sheet with the page URL, a follow
// button, and the value prop. The sheet backdrop dismisses.
// All clicks log to app_events so we can measure conversion
// vs the previous widget placement.

const FB_PAGE_URL = 'https://www.facebook.com/cruzar'

export function FbPagePill() {
  const { lang } = useLang()
  const es = lang === 'es'
  const [open, setOpen] = useState(false)

  function handleFollowClick() {
    trackEvent('fb_page_follow_click', { source: 'home_pill', variant: 'pill' })
  }

  function handlePillTap() {
    setOpen(true)
    trackEvent('fb_page_pill_tap', { source: 'home' })
  }

  return (
    <>
      <button
        onClick={handlePillTap}
        className="inline-flex items-center gap-1 bg-[#1877f2] hover:bg-[#0d5fd9] text-white rounded-full px-2.5 py-1 text-[11px] font-bold active:scale-95 transition-transform"
      >
        <span className="text-sm leading-none">📘</span>
        <span>{es ? 'Seguir FB' : 'Follow FB'}</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[70] flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-sm bg-gradient-to-br from-[#1877f2] to-[#0d5fd9] rounded-t-3xl md:rounded-3xl shadow-2xl relative overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
          >
            <div className="absolute -top-12 -right-12 w-36 h-36 bg-white/10 rounded-full blur-3xl pointer-events-none" />
            <button
              onClick={() => setOpen(false)}
              className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center text-white/70 hover:text-white rounded-full hover:bg-white/10 z-10 text-lg leading-none"
              aria-label={es ? 'Cerrar' : 'Close'}
            >
              ×
            </button>
            <div className="relative p-6 text-white">
              <p className="text-3xl leading-none mb-2">📘</p>
              <h2 className="text-lg font-black leading-tight">
                {es
                  ? 'Sigue a Cruzar en Facebook'
                  : 'Follow Cruzar on Facebook'}
              </h2>
              <p className="text-xs text-blue-100 mt-2 leading-snug">
                {es
                  ? 'Publicamos los tiempos de los puentes 4 veces al día (mañana, mediodía, tarde, noche). Si le das follow, te llega notificación directo al teléfono — ya no tienes que andar buscando en los grupos.'
                  : 'We post bridge wait times 4 times a day (morning, midday, afternoon, evening). Follow and you get a push notification straight to your phone — no more scrolling through groups.'}
              </p>

              <a
                href={FB_PAGE_URL}
                target="_blank"
                rel="noopener noreferrer"
                onClick={handleFollowClick}
                className="mt-4 flex items-center justify-center gap-2 w-full bg-white text-[#1877f2] font-black text-base rounded-2xl py-3 active:scale-[0.98] transition-transform"
              >
                {es ? '👉 Seguir en Facebook' : '👉 Follow on Facebook'}
              </a>
              <p className="text-[10px] text-blue-200 text-center mt-2">
                {es ? 'Es gratis · cancela cuando quieras' : 'Free · unfollow anytime'}
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
