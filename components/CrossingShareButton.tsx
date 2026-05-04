'use client'

import { useState } from 'react'
import { Share2, Check } from 'lucide-react'

interface Props {
  crossing_id: string
  port_name: string
  duration_min: number | null
  lang: 'en' | 'es'
}

// Web Share API for /crossing/[id] — the family-ETA proof use case.
// Replaces the "I'm at the bridge, will text when through" texts that
// 90% of commuters send today. Native share sheet on mobile, clipboard
// fallback on desktop. Mirrors components/TicketShareButton.tsx.
export function CrossingShareButton({ crossing_id, port_name, duration_min, lang }: Props) {
  const [copied, setCopied] = useState(false)
  const url = `https://www.cruzar.app/crossing/${crossing_id}`
  const es = lang === 'es'

  const title = es ? `Mi cruce — ${port_name}` : `My crossing — ${port_name}`
  const text = duration_min != null
    ? (es
        ? `Crucé ${port_name} en ${duration_min} min. Mira el comprobante.`
        : `Crossed ${port_name} in ${duration_min} min. Here's the receipt.`)
    : (es
        ? `Mi cruce por ${port_name}.`
        : `My crossing through ${port_name}.`)

  async function share() {
    if (typeof navigator !== 'undefined' && 'share' in navigator) {
      try {
        await navigator.share({ title, text, url })
        return
      } catch {
        // User cancelled or share unavailable — fall through.
      }
    }
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Browser doesn't support clipboard either — nothing to do.
    }
  }

  return (
    <button
      type="button"
      onClick={share}
      className="inline-flex items-center gap-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 active:scale-95 transition"
    >
      {copied
        ? <><Check className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />{es ? 'Copiado' : 'Copied'}</>
        : <><Share2 className="w-3.5 h-3.5" />{es ? 'Compartir' : 'Share'}</>}
    </button>
  )
}
