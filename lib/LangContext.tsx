'use client'

import { createContext, useContext, useState, useEffect } from 'react'
import { translations, type Lang, type T } from './lang'

interface LangCtx { lang: Lang; t: T; toggle: () => void }

const Ctx = createContext<LangCtx>({ lang: 'en', t: translations.en, toggle: () => {} })

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<Lang>('en')

  useEffect(() => {
    const saved = localStorage.getItem('cruzar_lang') as Lang | null
    if (saved === 'es' || saved === 'en') {
      setLang(saved)
    } else {
      // Auto-detect: default to Spanish if browser language is Spanish
      const browserLang = navigator.language || (navigator.languages?.[0] ?? 'en')
      if (browserLang.toLowerCase().startsWith('es')) {
        setLang('es')
      }
    }
  }, [])

  function toggle() {
    const next: Lang = lang === 'en' ? 'es' : 'en'
    setLang(next)
    localStorage.setItem('cruzar_lang', next)
  }

  return <Ctx.Provider value={{ lang, t: translations[lang], toggle }}>{children}</Ctx.Provider>
}

export function useLang() {
  return useContext(Ctx)
}
