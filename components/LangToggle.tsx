'use client'

import { useLang } from '@/lib/LangContext'

// Lightweight EN/ES toggle for pages that don't render the full
// NavBar (Operator dashboard, Express Cert, Intelligence, brief
// detail). The full NavBar carries auth + theme + tier chips —
// overkill for these focused product pages, but the language
// toggle is non-negotiable since every customer-facing surface
// needs to flip without leaving the page.

export function LangToggle() {
  const { lang, toggle } = useLang()
  return (
    <button
      type="button"
      onClick={toggle}
      className="text-xs font-bold text-gray-600 bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:bg-gray-800 dark:hover:text-gray-100 px-2.5 py-1.5 rounded-lg transition-colors"
      aria-label={lang === 'en' ? 'Cambiar a español' : 'Switch to English'}
    >
      {lang === 'en' ? 'ES' : 'EN'}
    </button>
  )
}
