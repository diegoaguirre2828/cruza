'use client'

import { useEffect, useState } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { useLang } from '@/lib/LangContext'

// Sticky prompt that surfaces on /port/[id] when the user lands there
// from a wait-drop alert push. iOS Web Push silently drops action
// buttons (Apple's limitation, not ours), so we can't deliver
// "Ya crucé" as an inline notification action for iOS PWAs. Instead,
// the cron-composed push URL carries `?just_crossed=<alert_id>`. When
// the user taps the push, the page opens with that param, this
// component detects it, and shows a one-tap card to confirm + snooze.
//
// On confirmation: POST /api/alerts/[id]/snooze (same endpoint the
// notification action used) → sets snoozed_until ~16h forward + writes
// a closure block to the Cruzar Crossing. The page strips the param
// after the user acts so it doesn't re-show on refresh.
//
// Distinct from the existing JustCrossedPrompt component (which is the
// post-crossing report-submission flow). This one is the alert snooze
// confirmation only.

export function AlertSnoozePrompt() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const { lang } = useLang()
  const es = lang === 'es'

  const alertId = searchParams.get('just_crossed')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState<'snoozed' | 'kept' | null>(null)
  const [error, setError] = useState<string | null>(null)

  function clearParam() {
    const params = new URLSearchParams(searchParams.toString())
    params.delete('just_crossed')
    const next = params.toString() ? `${pathname}?${params}` : pathname
    router.replace(next, { scroll: false })
  }

  async function handleSnooze() {
    if (!alertId) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/alerts/${alertId}/snooze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'user_button_ya_cruce' }),
        credentials: 'include',
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || `HTTP ${res.status}`)
      }
      setDone('snoozed')
      setTimeout(clearParam, 2500)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSubmitting(false)
    }
  }

  function handleKeep() {
    setDone('kept')
    setTimeout(clearParam, 1200)
  }

  useEffect(() => {
    if (!alertId) setDone(null)
  }, [alertId])

  if (!alertId) return null

  // Success / dismissed states — no backdrop, just a tight toast that
  // auto-fades via the timeout in the handlers above. Slide-up entrance
  // for parity with the prompt card.
  if (done === 'snoozed') {
    return (
      <div
        className="cruzar-prompt-card fixed left-3 right-3 z-50 rounded-2xl bg-emerald-600 text-white px-4 py-3 shadow-2xl"
        style={{ bottom: 'calc(5rem + env(safe-area-inset-bottom))' }}
      >
        <p className="text-sm font-bold">
          {es ? '✅ Listo — alerta apagada hasta mañana' : '✅ Done — alert off until tomorrow'}
        </p>
        <p className="text-[11px] text-emerald-100 mt-0.5 leading-snug">
          {es ? 'Si quieres reactivarla antes, ve a Mi panel.' : 'To turn it back on sooner, head to Dashboard.'}
        </p>
      </div>
    )
  }

  if (done === 'kept') {
    return (
      <div
        className="cruzar-prompt-card fixed left-3 right-3 z-50 rounded-2xl bg-gray-900 text-white px-4 py-3 shadow-2xl"
        style={{ bottom: 'calc(5rem + env(safe-area-inset-bottom))' }}
      >
        <p className="text-sm font-bold">
          {es ? 'Sigue avisándote — perfecto' : 'Still alerting — got it'}
        </p>
      </div>
    )
  }

  // Active prompt — full-screen backdrop blur + centered card with
  // entrance animation + pulsing glow on the primary CTA. Diego
  // 2026-05-04: "make the popup more noticeable…blur the background…
  // pulsing…feel alive."
  //
  // Tap-on-backdrop is intentionally a no-op: this is a confirmation
  // prompt that needs an explicit yes/no, not a dismiss-by-tapping-
  // outside (which would silently keep the alert ringing all day).
  return (
    <div
      className="cruzar-prompt-enter fixed inset-0 z-[55] flex items-end md:items-center justify-center bg-black/55 px-4 pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-0"
      style={{ backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="cruzar-prompt-card w-full max-w-sm rounded-3xl bg-gradient-to-br from-blue-600 via-indigo-700 to-purple-800 text-white shadow-2xl overflow-hidden border border-white/15"
      >
        <div className="p-5">
          <div className="flex items-start gap-3">
            <span className="cruzar-soft-bob text-3xl leading-none flex-shrink-0">🌉</span>
            <div className="flex-1 min-w-0">
              <p className="text-lg font-black leading-tight">
                {es ? '¿Ya cruzaste?' : 'Already crossed?'}
              </p>
              <p className="text-[13px] text-blue-100 mt-1 leading-snug">
                {es
                  ? 'Apaga la alerta hasta mañana en la mañana — o sigue avisándote si todavía no cruzas.'
                  : "Mute the alert until tomorrow morning — or keep it on if you haven't crossed yet."}
              </p>
            </div>
          </div>

          {error && (
            <p className="mt-3 text-[11px] text-red-100 bg-red-900/40 rounded-lg px-3 py-2 border border-red-400/30">
              {error}
            </p>
          )}

          <div className="mt-5 flex flex-col gap-2">
            <button
              type="button"
              onClick={handleSnooze}
              disabled={submitting}
              className="cruzar-glow-pulse w-full bg-white text-indigo-700 text-base font-black py-3.5 rounded-2xl active:scale-[0.97] disabled:opacity-60 disabled:animate-none transition-transform"
            >
              {submitting
                ? (es ? 'Apagando…' : 'Muting…')
                : (es ? 'Sí, apaga la alerta' : 'Yes, mute the alert')}
            </button>
            <button
              type="button"
              onClick={handleKeep}
              disabled={submitting}
              className="w-full bg-white/10 hover:bg-white/20 text-white text-sm font-bold py-3 rounded-2xl border border-white/20 active:scale-[0.97] disabled:opacity-50 transition-all"
            >
              {es ? 'Aún no — sigan avisándome' : "Not yet — keep alerting me"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
