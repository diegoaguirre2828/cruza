'use client'

import { useEffect, useState } from 'react'
import { ContextualNudge } from './ContextualNudge'

// Picks ONE armed nudge from a priority-ordered list and renders only
// that one. Previously the home page stacked four concurrent nudges
// vertically — discover-features + set-alert + invite-circle + see-
// leaderboard + pro-insights — which buried the port list users
// actually came for. Same nudges, one slot, priority order.
//
// Re-checks on every armNudge() / dismiss() / markTaken() so the slot
// advances to the next armed nudge automatically when the current one
// is resolved.

const NUDGE_KEY_PREFIX = 'cruzar_nudge_'

type Tone = 'blue' | 'green' | 'amber' | 'purple'

export interface NudgeSpec {
  nudgeKey: string
  emoji: string
  titleEs: string
  titleEn: string
  subEs: string
  subEn: string
  ctaEs: string
  ctaEn: string
  href: string
  tone?: Tone
}

interface Props {
  lang: 'es' | 'en'
  nudges: NudgeSpec[]
}

function readNudgeState(key: string): string | null {
  if (typeof window === 'undefined') return null
  try {
    return localStorage.getItem(NUDGE_KEY_PREFIX + key)
  } catch {
    return null
  }
}

export function PriorityNudge({ lang, nudges }: Props) {
  const [activeKey, setActiveKey] = useState<string | null>(null)

  useEffect(() => {
    const pick = () => {
      for (const n of nudges) {
        const s = readNudgeState(n.nudgeKey)
        if (s === 'pending' || s === 'seen') {
          setActiveKey(n.nudgeKey)
          return
        }
      }
      setActiveKey(null)
    }
    pick()
    const onStorage = (e: StorageEvent) => {
      if (!e.key || !e.key.startsWith(NUDGE_KEY_PREFIX)) return
      pick()
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [nudges])

  if (!activeKey) return null
  const active = nudges.find(n => n.nudgeKey === activeKey)
  if (!active) return null
  return <ContextualNudge {...active} lang={lang} />
}
