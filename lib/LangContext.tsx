'use client'

import { createContext, useContext, useState, useEffect } from 'react'
import { translations, type Lang, type T } from './lang'

interface LangCtx { lang: Lang; t: T; toggle: () => void }

const Ctx = createContext<LangCtx>({ lang: 'en', t: translations.en, toggle: () => {} })

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<Lang>('es')

  useEffect(() => {
    const saved = localStorage.getItem('cruzar_lang') as Lang | null
    if (saved === 'es' || saved === 'en') {
      setLang(saved)
    } else {
      // Default to Spanish — primary audience is border crossers who speak Spanish
      // Only switch to English if browser is explicitly set to English (not Spanish or anything else)
      const browserLang = navigator.language || (navigator.languages?.[0] ?? 'es')
      if (browserLang.toLowerCase().startsWith('en')) {
        setLang('en')
      } else {
        setLang('es')
      }
    }
  }, [])

  function toggle() {
    const next: Lang = lang === 'en' ? 'es' : 'en'
    setLang(next)
    localStorage.setItem('cruzar_lang', next)
    // Persist to server so server-composed notifications (push / SMS /
    // email via send-alerts cron) match what the user sees in the app.
    // Migration v84 added profiles.language. Fire-and-forget — failure
    // here must not break the toggle UX. Endpoint requires auth, so
    // unauth toggles silently 401 (and that's fine — we still have the
    // localStorage copy for client copy).
    fetch('/api/profile/language', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ language: next }),
      credentials: 'include',
      keepalive: true,
    }).catch(() => { /* telemetry must not throw */ })
  }

  return <Ctx.Provider value={{ lang, t: translations[lang], toggle }}>{children}</Ctx.Provider>
}

export function useLang() {
  return useContext(Ctx)
}
