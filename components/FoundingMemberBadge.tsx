'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/useAuth'
import { useLang } from '@/lib/LangContext'

// Pill shown to any user whose promo_first_1000_until is in the far
// future (> now + 10 years). That cutoff distinguishes the new
// "forever" grant from the legacy 90-day grant — only true founding
// members see the badge. Renders nothing for guests, non-founders,
// and legacy 90-day claimants.
const TEN_YEARS_MS = 10 * 365 * 24 * 60 * 60 * 1000

export function FoundingMemberBadge() {
  const { user, loading: authLoading } = useAuth()
  const { lang } = useLang()
  const es = lang === 'es'
  const [isFounder, setIsFounder] = useState(false)

  useEffect(() => {
    if (authLoading || !user) { setIsFounder(false); return }
    let cancelled = false
    fetch('/api/profile', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (cancelled) return
        const until = data?.profile?.promo_first_1000_until
        if (!until) { setIsFounder(false); return }
        const untilMs = new Date(until).getTime()
        if (Number.isNaN(untilMs)) { setIsFounder(false); return }
        setIsFounder(untilMs > Date.now() + TEN_YEARS_MS)
      })
      .catch(() => { if (!cancelled) setIsFounder(false) })
    return () => { cancelled = true }
  }, [user, authLoading])

  if (!user || !isFounder) return null

  return (
    <span
      className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-gradient-to-r from-amber-400/20 to-orange-500/20 border border-amber-300 dark:border-amber-600/40 text-[11px] font-black text-amber-700 dark:text-amber-300 uppercase tracking-wide"
      title={es ? 'Uno de los primeros 1000 — Pro para siempre' : 'One of the first 1000 — Pro forever'}
    >
      🏆 {es ? 'Miembro Fundador' : 'Founding Member'}
    </span>
  )
}

export default FoundingMemberBadge
