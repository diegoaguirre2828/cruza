'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/useAuth'
import { createClient } from '@/lib/auth'
import { BADGES } from '@/lib/points'
import { useLang } from '@/lib/LangContext'
import { ArrowLeft, Save, CreditCard, LogOut, User, Building2, FileText, Trophy, Navigation, Brain, Trash2 } from 'lucide-react'

export default function AccountPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const { t, lang } = useLang()

  const TIER_LABELS: Record<string, { label: string; color: string }> = {
    free:     { label: 'Free',     color: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300' },
    pro:      { label: 'Pro',      color: 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300' },
    business: { label: 'Business', color: 'bg-blue-600 text-white' },
  }

  const ROLE_LABELS: Record<string, string> = {
    driver:        '🚛 ' + t.roleDriver.replace('🚛 ', ''),
    fleet_manager: '🏢 ' + t.roleFleetMgr.replace('🏢 ', ''),
    other:         '👤 Other',
  }

  const [profile, setProfile] = useState<Record<string, unknown> | null>(null)
  const [subscription, setSubscription] = useState<Record<string, unknown> | null>(null)
  const [email, setEmail] = useState('')
  const [form, setForm] = useState({ display_name: '', full_name: '', company: '', bio: '' })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [portalLoading, setPortalLoading] = useState(false)
  const [portalError, setPortalError] = useState('')
  const [autoOptIn, setAutoOptIn] = useState(false)
  const [autoOptInSaving, setAutoOptInSaving] = useState(false)
  interface BrainRoutine {
    port_id: string
    port_name: string
    dow: number
    hour: number
    wake_up_hour_ct: number
    sample_count: number
  }
  const [brainOptIn, setBrainOptIn] = useState(false)
  const [brainSaving, setBrainSaving] = useState(false)
  const [brainRoutines, setBrainRoutines] = useState<BrainRoutine[]>([])
  const [brainWiping, setBrainWiping] = useState(false)
  const [brainLastSent, setBrainLastSent] = useState<string | null>(null)
  type DigestCadence = 'off' | 'weekly' | 'biweekly' | 'monthly'
  const [digestCadence, setDigestCadence] = useState<DigestCadence>('weekly')
  const [digestSaving, setDigestSaving] = useState(false)
  const [digestLastSentAt, setDigestLastSentAt] = useState<string | null>(null)

  useEffect(() => {
    if (!authLoading && !user) router.push('/login')
  }, [user, authLoading, router])

  useEffect(() => {
    if (!user) return
    fetch('/api/profile').then(r => r.json()).then(d => {
      setProfile(d.profile || {})
      setSubscription(d.subscription || null)
      setEmail(d.email || '')
      setForm({
        display_name: d.profile?.display_name || '',
        full_name: d.profile?.full_name || '',
        company:   d.profile?.company || '',
        bio:       d.profile?.bio || '',
      })
      setAutoOptIn(!!d.profile?.auto_geofence_opt_in)
      const cad = d.profile?.digest_cadence
      if (cad === 'off' || cad === 'weekly' || cad === 'biweekly' || cad === 'monthly') {
        setDigestCadence(cad)
      }
      setDigestLastSentAt(d.profile?.digest_last_sent_at ?? null)
    })
    fetch('/api/pattern-brain/preview').then(r => r.ok ? r.json() : null).then(d => {
      if (!d) return
      setBrainOptIn(!!d.opt_in)
      setBrainRoutines(d.routines || [])
      setBrainLastSent(d.last_sent_at ?? null)
    })
  }, [user])

  async function toggleBrainOptIn() {
    const next = !brainOptIn
    setBrainOptIn(next)
    setBrainSaving(true)
    await fetch('/api/pattern-brain/preview', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ opt_in: next }),
    })
    setBrainSaving(false)
  }

  async function wipeBrainRoutines() {
    setBrainWiping(true)
    await fetch('/api/pattern-brain/preview', { method: 'DELETE' })
    setBrainRoutines([])
    setBrainWiping(false)
  }

  async function toggleAutoOptIn() {
    const next = !autoOptIn
    setAutoOptIn(next)
    setAutoOptInSaving(true)
    await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ auto_geofence_opt_in: next }),
    })
    setAutoOptInSaving(false)
  }

  async function changeDigestCadence(next: DigestCadence) {
    setDigestCadence(next)
    setDigestSaving(true)
    await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ digest_cadence: next }),
    })
    setDigestSaving(false)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function handlePortal() {
    setPortalLoading(true)
    setPortalError('')
    const res = await fetch('/api/stripe/portal', { method: 'POST' })
    const { url, error } = await res.json()
    if (url) window.location.href = url
    else {
      setPortalError(error || (lang === 'es' ? 'No se pudo abrir el portal. Intenta de nuevo.' : 'Could not open billing portal. Try again.'))
      setPortalLoading(false)
    }
  }

  async function signOut() {
    await createClient().auth.signOut()
    router.push('/')
  }

  if (authLoading || !profile) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
      </div>
    )
  }

  const tier = String(profile?.tier || 'free')
  const tierInfo = TIER_LABELS[tier] || TIER_LABELS.free
  const isBusiness = tier === 'business'
  const isPaid = tier === 'pro' || isBusiness

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-lg mx-auto px-4 pb-16">

        {/* Header */}
        <div className="pt-6 pb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="p-2 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">{t.settingsTitle}</h1>
          </div>
          <button onClick={signOut} className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors">
            <LogOut className="w-3.5 h-3.5" /> {t.signOutBtn}
          </button>
        </div>

        {/* Business portal shortcut */}
        {isBusiness && (
          <Link
            href="/business"
            className="flex items-center justify-between bg-blue-600 dark:bg-blue-700 rounded-2xl px-4 py-3.5 mb-4 hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Building2 className="w-5 h-5 text-white" />
              <div>
                <p className="text-sm font-bold text-white">Cruzar Business Portal</p>
                <p className="text-xs text-blue-200">{t.businessPortalDesc}</p>
              </div>
            </div>
            <span className="text-white text-lg">→</span>
          </Link>
        )}

        {/* Subscription */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm mb-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">{t.subscriptionSection}</h2>
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${tierInfo.color}`}>
              {tierInfo.label}
            </span>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{email}</p>
          {subscription && (
            <p className="text-xs text-gray-400 dark:text-gray-500">
              {t.statusLabel} <span className="font-medium text-gray-600 dark:text-gray-300">{String(subscription.status ?? '')}</span>
              {!!subscription.current_period_end && (
                <> · {t.renewsLabel} {new Date(String(subscription.current_period_end)).toLocaleDateString()}</>
              )}
            </p>
          )}
          <div className="mt-4 flex gap-2">
            {isPaid ? (
              <button
                onClick={handlePortal}
                disabled={portalLoading}
                className="flex items-center gap-1.5 text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 px-4 py-2 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
              >
                <CreditCard className="w-3.5 h-3.5" />
                {portalLoading ? t.openingPortal : t.manageBilling}
              </button>
            ) : (
              <Link href="/pricing" className="flex items-center gap-1.5 text-xs font-medium bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700 transition-colors">
                {t.upgradeToPro}
              </Link>
            )}
          </div>
          {portalError && (
            <p className="text-xs text-red-500 mt-2">{portalError}</p>
          )}
        </div>

        {/* Points & badges */}
        {!!profile && (Number(profile.points) > 0 || Number(profile.reports_count) > 0) && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm mb-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">{t.communityStats}</h2>
              <Link href="/leaderboard" className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1">
                <Trophy className="w-3 h-3" /> {t.leaderboardLink}
              </Link>
            </div>
            <div className="flex gap-4 mb-3">
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{Number(profile.points) || 0}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{t.pointsLabel}</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{Number(profile.reports_count) || 0}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{t.reportsLabel}</p>
              </div>
            </div>
            {Array.isArray(profile.badges) && profile.badges.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {(profile.badges as string[]).map((b) => BADGES[b] && (
                  <div key={b} className="flex items-center gap-1 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-full px-2.5 py-1">
                    <span>{BADGES[b].emoji}</span>
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-200">
                      {lang === 'es' ? BADGES[b].labelEs : BADGES[b].labelEn}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Profile form */}
        <form onSubmit={handleSave} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm mb-4">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">{t.profileSection}</h2>
          <div className="space-y-4">
            <div>
              <label className="flex items-center gap-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                <User className="w-3.5 h-3.5" /> {t.displayNameLabel}
                <span className="text-gray-400 dark:text-gray-500 font-normal">{t.displayNameHint}</span>
              </label>
              <input
                value={form.display_name}
                onChange={e => setForm(f => ({ ...f, display_name: e.target.value.toLowerCase() }))}
                className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                placeholder="cruzante_norte_42"
                maxLength={30}
                pattern="[a-z0-9][a-z0-9_-]*[a-z0-9]"
              />
              <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">
                3-30 chars · lowercase letters, digits, underscore, hyphen · visible on the public leaderboard
              </p>
            </div>
            <div>
              <label className="flex items-center gap-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t.fullNameLabel}
              </label>
              <input
                value={form.full_name}
                onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={t.fullNameLabel}
              />
            </div>
            <div>
              <label className="flex items-center gap-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                <Building2 className="w-3.5 h-3.5" /> {t.companyLabel}
              </label>
              <input
                value={form.company}
                onChange={e => setForm(f => ({ ...f, company: e.target.value }))}
                className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. Laredo Freight Co."
              />
            </div>
            <div>
              <label className="flex items-center gap-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                <FileText className="w-3.5 h-3.5" /> {t.bioLabel}
                <span className="text-gray-400 dark:text-gray-500 font-normal">{t.bioHint}</span>
              </label>
              <textarea
                value={form.bio}
                onChange={e => setForm(f => ({ ...f, bio: e.target.value }))}
                className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                rows={2}
                maxLength={120}
                placeholder="e.g. Daily commuter crossing Hidalgo since 2018"
              />
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 text-right">{form.bio.length}/120</p>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 block">{t.roleLabel}</label>
              <p className="text-sm text-gray-600 dark:text-gray-400">{ROLE_LABELS[String(profile?.role || 'other')] || ROLE_LABELS.other}</p>
            </div>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="mt-5 w-full flex items-center justify-center gap-2 bg-gray-900 dark:bg-gray-100 dark:text-gray-900 text-white text-sm font-medium py-2.5 rounded-xl hover:bg-gray-700 dark:hover:bg-gray-200 disabled:opacity-50 transition-colors"
          >
            <Save className="w-4 h-4" />
            {saved ? t.profileSaved : saving ? t.savingProfile : t.saveProfile}
          </button>
        </form>

        {/* Auto-crossing detection (default ON; this toggle is the opt-OUT) */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm mb-4">
          <div className="flex items-start justify-between gap-3 mb-2">
            <div className="flex items-start gap-2">
              <Navigation className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
              <div>
                <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                  {lang === 'es' ? 'Rastreo automático de cruce' : 'Auto-crossing detection'}
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {lang === 'es'
                    ? 'Cuando estás cerca de un puente, aparece "Estoy en la fila". Tocar el botón empieza el rastreo. Datos anónimos — sin tu identidad ni ruta GPS. Apaga este toggle para esconder la función por completo.'
                    : 'When you\'re near a bridge, "I\'m in line now" appears. Tapping it starts tracking. Anonymous — no identity, no GPS trace stored. Turn this off to hide the feature entirely.'}
                </p>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={autoOptIn}
              onClick={toggleAutoOptIn}
              disabled={autoOptInSaving}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
                autoOptIn ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                  autoOptIn ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
          <Link
            href="/privacy#auto-crossing"
            className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
          >
            {lang === 'es' ? 'Cómo manejamos estos datos' : 'How we handle this data'}
          </Link>
        </div>

        {/* Pattern Brain — Pillar 1: wake-up + routine */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm mb-4">
          <div className="flex items-start justify-between gap-3 mb-2">
            <div className="flex items-start gap-2">
              <Brain className="w-4 h-4 text-purple-600 dark:text-purple-400 mt-0.5 flex-shrink-0" />
              <div>
                <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                  {lang === 'es' ? 'Pattern Brain — despertador del puente' : 'Pattern Brain — bridge wake-up'}
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {lang === 'es'
                    ? 'Si reportas espera en el mismo puente a la misma hora varias veces, te avisamos 1 hora antes la próxima vez. Solo tú lo ves. Apaga cuando quieras.'
                    : 'If you report waits at the same bridge and hour multiple times, we ping you 1 hour before next time. Only you see it. Turn off anytime.'}
                </p>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={brainOptIn}
              onClick={toggleBrainOptIn}
              disabled={brainSaving}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
                brainOptIn ? 'bg-purple-600' : 'bg-gray-300 dark:bg-gray-600'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                  brainOptIn ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {brainOptIn && brainRoutines.length === 0 && (
            <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-3">
              {lang === 'es'
                ? 'Aún no detectamos un patrón. Necesitamos al menos 3 reportes en el mismo puente y la misma hora.'
                : "No pattern detected yet. We need at least 3 reports at the same bridge × hour."}
            </p>
          )}

          {brainOptIn && brainRoutines.length > 0 && (
            <div className="mt-3 space-y-2">
              <p className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                {lang === 'es' ? `Rutinas detectadas (${brainRoutines.length})` : `Detected routines (${brainRoutines.length})`}
              </p>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {brainRoutines.map((r) => {
                  const dowName = (lang === 'es'
                    ? ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
                    : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'])[r.dow]
                  const hourLabel = `${String(r.hour).padStart(2, '0')}:00`
                  const wakeLabel = `${String(r.wake_up_hour_ct).padStart(2, '0')}:00`
                  return (
                    <div key={`${r.port_id}-${r.dow}-${r.hour}`} className="flex items-center justify-between text-xs bg-purple-50 dark:bg-purple-900/20 rounded-lg px-3 py-2">
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 dark:text-gray-100 truncate">{r.port_name}</p>
                        <p className="text-[10px] text-gray-500 dark:text-gray-400">
                          {dowName} {hourLabel} · {lang === 'es' ? 'aviso' : 'wake-up'} {wakeLabel} CT · n={r.sample_count}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
              {brainLastSent && (
                <p className="text-[10px] text-gray-400 dark:text-gray-500">
                  {lang === 'es' ? 'Último aviso:' : 'Last ping:'} {new Date(brainLastSent).toLocaleString(lang === 'es' ? 'es-MX' : 'en-US')}
                </p>
              )}
              <button
                onClick={wipeBrainRoutines}
                disabled={brainWiping}
                className="flex items-center gap-1.5 text-[11px] text-red-500 hover:text-red-700 dark:hover:text-red-400 transition-colors disabled:opacity-50"
              >
                <Trash2 className="w-3 h-3" />
                {brainWiping ? (lang === 'es' ? 'Borrando…' : 'Clearing…') : (lang === 'es' ? 'Borrar rutinas detectadas' : 'Clear detected routines')}
              </button>
            </div>
          )}
        </div>

        {/* Digest cadence — Cruzar Insights weekly retrospective */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm mb-4">
          <div className="flex items-start justify-between gap-3 mb-2">
            <div className="flex items-start gap-2">
              <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
              <div>
                <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                  {lang === 'es' ? 'Resumen por correo — frecuencia' : 'Email digest — frequency'}
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {lang === 'es'
                    ? 'Cada cuándo te enviamos el resumen de cargas y exposición a detention. Tú decides.'
                    : 'How often we email your loads + detention exposure summary. You decide.'}
                </p>
              </div>
            </div>
          </div>
          <select
            value={digestCadence}
            onChange={(e) => changeDigestCadence(e.target.value as DigestCadence)}
            disabled={digestSaving}
            className="w-full text-sm rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 px-3 py-2 disabled:opacity-50"
          >
            <option value="off">{lang === 'es' ? 'Apagado' : 'Off'}</option>
            <option value="weekly">{lang === 'es' ? 'Semanal (lunes)' : 'Weekly (Monday)'}</option>
            <option value="biweekly">{lang === 'es' ? 'Cada 2 semanas' : 'Every 2 weeks'}</option>
            <option value="monthly">{lang === 'es' ? 'Mensual' : 'Monthly'}</option>
          </select>
          {digestLastSentAt && (
            <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-2">
              {lang === 'es' ? 'Último envío:' : 'Last sent:'} {new Date(digestLastSentAt).toLocaleString(lang === 'es' ? 'es-MX' : 'en-US')}
            </p>
          )}
        </div>

        {/* Account actions */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">{t.accountSection}</h2>
          <div className="space-y-2">
            <Link href="/pricing" className="block text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors">
              {t.viewPricingPlans}
            </Link>
            <button onClick={signOut} className="block text-xs text-red-500 hover:text-red-700 dark:hover:text-red-400 transition-colors">
              {t.signOutCruza}
            </button>
            <div className="flex gap-3 pt-1">
              <Link href="/privacy" className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                {lang === 'es' ? 'Privacidad' : 'Privacy'}
              </Link>
              <Link href="/terms" className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                {lang === 'es' ? 'Términos' : 'Terms'}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
