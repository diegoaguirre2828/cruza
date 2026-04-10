'use client'

import { useState, useEffect } from 'react'
import { translations, type Lang, type T } from './lang'

export function useLang(): { lang: Lang; t: T; toggle: () => void } {
  const [lang, setLang] = useState<Lang>('en')

  useEffect(() => {
    const saved = localStorage.getItem('cruzar_lang') as Lang | null
    if (saved === 'es' || saved === 'en') setLang(saved)
  }, [])

  function toggle() {
    const next: Lang = lang === 'en' ? 'es' : 'en'
    setLang(next)
    localStorage.setItem('cruzar_lang', next)
  }

  return { lang, t: translations[lang], toggle }
}
