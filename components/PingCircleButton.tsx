'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/useAuth'
import { useLang } from '@/lib/LangContext'

// Proactive "send wait time to my circle" button. Visible to logged-in
// users who have at least one circle. One tap = push notification to
// every other circle member with the current port's name + wait.

interface Props {
  portId: string
  waitMinutes: number | null
  /** Optional styling variant */
  variant?: 'inline' | 'block'
}

export function PingCircleButton({ portId, waitMinutes, variant = 'block' }: Props) {
  const { user } = useAuth()
  const { lang } = useLang()
  const es = lang === 'es'
  const [hasCircle, setHasCircle] = useState<boolean | null>(null)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState<number | null>(null)

  // Check if the user is in any circle (so we know whether to render)
  useEffect(() => {
    if (!user) { setHasCircle(false); return }
    fetch('/api/circles', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => setHasCircle((d.circles || []).length > 0))
      .catch(() => setHasCircle(false))
  }, [user])

  async function ping() {
    if (sending) return
    setSending(true)
    setSent(null)
    try {
      const res = await fetch('/api/circles/ping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ port_id: portId, wait_minutes: waitMinutes }),
      })
      const data = await res.json()
      setSent(data.sent ?? 0)
      setTimeout(() => setSent(null), 4000)
    } finally {
      setSending(false)
    }
  }

  if (!user || !hasCircle) return null

  if (variant === 'inline') {
    return (
      <button
        onClick={ping}
        disabled={sending}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50"
      >
        {sent != null
          ? (es ? `✓ Enviado a ${sent}` : `✓ Sent to ${sent}`)
          : sending
            ? (es ? 'Enviando…' : 'Sending…')
            : (es ? '📢 Avisar a mi grupo' : '📢 Tell my circle')}
      </button>
    )
  }

  return (
    <button
      onClick={ping}
      disabled={sending}
      className={`w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-bold transition-all active:scale-95 ${
        sent != null
          ? 'bg-green-600 text-white'
          : 'bg-white dark:bg-gray-800 border-2 border-blue-500 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20'
      } disabled:opacity-50`}
    >
      {sent != null
        ? (es ? `✓ Aviso enviado a ${sent} del grupo` : `✓ Sent to ${sent} in your circle`)
        : sending
          ? (es ? 'Enviando aviso…' : 'Sending heads up…')
          : (es ? '📢 Avisar a mi grupo sobre este puente' : '📢 Tell my circle about this crossing')}
    </button>
  )
}
