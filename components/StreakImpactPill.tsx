'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Flame } from 'lucide-react'
import { useLang } from '@/lib/LangContext'
import { fetchWithTimeout } from '@/lib/fetchWithTimeout'

interface Stats {
  streak: number
  helped: number
  this_week: number
}

// Top-of-home pill that surfaces the user's reporting streak + impact.
// Pulls reporting from "civic duty" toward "habit + reciprocity" — the
// AI-as-infrastructure thesis applied consumer-side per
// project_cruzar_consumer_engagement_strategy_20260502.

export function StreakImpactPill() {
  const { lang } = useLang()
  const es = lang === 'es'
  const [stats, setStats] = useState<Stats | null>(null)
  const [signedIn, setSignedIn] = useState<boolean | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchWithTimeout('/api/reports/me/stats', { cache: 'no-store' }, 4000)
      .then(r => r.ok ? r.json() : { ok: false })
      .then(d => {
        if (cancelled) return
        if (d?.signedIn) {
          setSignedIn(true)
          setStats({ streak: d.streak ?? 0, helped: d.helped ?? 0, this_week: d.this_week ?? 0 })
        } else {
          setSignedIn(false)
        }
      })
      .catch(() => { if (!cancelled) setSignedIn(false) })
    return () => { cancelled = true }
  }, [])

  if (signedIn !== true || !stats) return null
  if (stats.helped === 0 && stats.streak === 0) return null

  const streakLabel = stats.streak > 0
    ? `${stats.streak} ${es ? (stats.streak === 1 ? 'día' : 'días') : (stats.streak === 1 ? 'day' : 'days')}`
    : null

  const helpedLabel = stats.helped > 0
    ? `${stats.helped} ${es ? (stats.helped === 1 ? 'ayudado' : 'ayudados') : (stats.helped === 1 ? 'helped' : 'helped')}`
    : null

  return (
    <Link
      href="/leaderboard"
      className="group inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-orange-500/10 via-amber-500/10 to-orange-500/10 border border-orange-300/50 dark:border-orange-700/50 hover:border-orange-400 dark:hover:border-orange-500 transition-colors"
      aria-label={es ? 'Ver tu impacto' : 'See your impact'}
    >
      {streakLabel && (
        <span className="inline-flex items-center gap-1">
          <Flame className="w-3.5 h-3.5 text-orange-500 fill-orange-500" />
          <span className="text-[11px] font-black text-orange-700 dark:text-orange-300 tabular-nums">
            {streakLabel}
          </span>
        </span>
      )}
      {streakLabel && helpedLabel && (
        <span className="text-orange-400/50 dark:text-orange-600/50 text-[11px]">·</span>
      )}
      {helpedLabel && (
        <span className="text-[11px] font-bold text-orange-700/90 dark:text-orange-300/90 tabular-nums">
          {helpedLabel}
        </span>
      )}
    </Link>
  )
}
