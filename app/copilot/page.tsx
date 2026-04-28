'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useLang } from '@/lib/LangContext'
import { Mic, MicOff, Volume2, ArrowLeft, RadioTower, Check, Play, Square, Smartphone, MessageCircle } from 'lucide-react'

interface NearbyPort {
  port_id: string
  name: string
  city: string
  region: string
  distKm: number
  driveMin: number
  waitMin: number | null
  totalMin: number
}

interface Circle {
  id: string
  name: string
}

export default function CopilotPage() {
  const { lang } = useLang()
  const [listening, setListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [nearby, setNearby] = useState<NearbyPort[]>([])
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [circles, setCircles] = useState<Circle[]>([])
  const [autoTextCircleId, setAutoTextCircleId] = useState('')
  const [voiceOptIn, setVoiceOptIn] = useState(false)
  const [liveActivityOptIn, setLiveActivityOptIn] = useState(false)
  const [whatsappOptIn, setWhatsappOptIn] = useState(false)
  const [whatsappPhone, setWhatsappPhone] = useState('')
  const [whatsappLang, setWhatsappLang] = useState<'es' | 'en'>('es')
  const [crossed, setCrossed] = useState(false)
  const [busy, setBusy] = useState(false)
  const recogRef = useRef<unknown>(null)
  // Trip mode — when active, /copilot watches geolocation and auto-fires
  // ETA pings + cross-detection without the user tapping anything.
  const [tripActive, setTripActive] = useState(false)
  const [tripTargetPort, setTripTargetPort] = useState<NearbyPort | null>(null)
  const [tripPingId, setTripPingId] = useState<string | null>(null)
  const [tripStartedAt, setTripStartedAt] = useState<number | null>(null)
  const [liveDistKm, setLiveDistKm] = useState<number | null>(null)
  const [autoCrossed, setAutoCrossed] = useState(false)
  const watchIdRef = useRef<number | null>(null)
  const hasFiredCrossRef = useRef(false)

  const t = {
    title: lang === 'es' ? '🎙️ Co-Pilot' : '🎙️ Co-Pilot',
    subtitle: lang === 'es' ? 'Manos libres para tu cruce.' : 'Hands-free for your crossing.',
    listen: lang === 'es' ? 'Escuchar' : 'Listen',
    stop: lang === 'es' ? 'Detener' : 'Stop',
    speak: lang === 'es' ? 'Decir espera' : 'Speak wait',
    crossed: lang === 'es' ? 'Ya crucé' : 'I crossed',
    crossedSent: lang === 'es' ? 'Aviso enviado a tu familia ✓' : 'Family notified ✓',
    voiceLabel: lang === 'es' ? 'Activar voz' : 'Enable voice',
    liveActivityLabel: lang === 'es' ? 'iOS Live Activity (próximamente)' : 'iOS Live Activity (coming soon)',
    liveActivityHint: lang === 'es'
      ? 'Widget de pantalla bloqueada con espera + ETA en vivo. Aterriza con la próxima build de iOS.'
      : 'Lock-screen widget with live wait + ETA. Lands with the next iOS build.',
    autoText: lang === 'es' ? 'Avisar a este círculo cuando cruce' : 'Notify this circle when I cross',
    sayPrompt: lang === 'es' ? 'Di "espera" o "puente más cercano"' : 'Say "wait" or "nearest bridge"',
    back: lang === 'es' ? 'Inicio' : 'Home',
    none: lang === 'es' ? 'Sin círculo' : 'No circle',
    startTrip: lang === 'es' ? 'Iniciar viaje' : 'Start trip',
    endTrip: lang === 'es' ? 'Terminar viaje' : 'End trip',
    needCircleForTrip: lang === 'es'
      ? 'Elige un círculo abajo para iniciar el viaje.'
      : 'Pick a circle below to start the trip.',
    tripActive: lang === 'es' ? 'Viaje activo' : 'Trip active',
    tripTo: lang === 'es' ? 'Hacia' : 'To',
    tripFamilyNotified: lang === 'es' ? 'Familia avisada con ETA' : 'Family notified with ETA',
    autoCrossDetected: lang === 'es' ? 'Cruce detectado automáticamente ✓' : 'Crossing auto-detected ✓',
    saveSettings: lang === 'es' ? 'Guardar' : 'Save',
  }

  useEffect(() => {
    navigator.geolocation?.getCurrentPosition((p) => {
      setCoords({ lat: p.coords.latitude, lng: p.coords.longitude })
    }, () => {}, { maximumAge: 60000, timeout: 10000 })

    fetch('/api/circles').then((r) => r.json()).then((j) => {
      setCircles((j.circles ?? []).map((c: { id: string; name: string }) => ({ id: c.id, name: c.name })))
    }).catch(() => {})

    fetch('/api/profile').then((r) => r.json()).then((j) => {
      const p = j?.profile ?? {}
      if (typeof p.copilot_voice_opt_in === 'boolean') setVoiceOptIn(p.copilot_voice_opt_in)
      if (typeof p.copilot_live_activity_opt_in === 'boolean') setLiveActivityOptIn(p.copilot_live_activity_opt_in)
      if (p.copilot_auto_text_circle_id) setAutoTextCircleId(p.copilot_auto_text_circle_id)
      if (typeof p.whatsapp_optin === 'boolean') setWhatsappOptIn(p.whatsapp_optin)
      if (typeof p.whatsapp_phone_e164 === 'string') setWhatsappPhone(p.whatsapp_phone_e164)
      if (p.whatsapp_template_lang === 'es' || p.whatsapp_template_lang === 'en') setWhatsappLang(p.whatsapp_template_lang)
    }).catch(() => {})
  }, [])

  // Geolocation watch — only runs while a trip is active. Detects crossing
  // by watching for a sustained position past the bridge (≥0.8km north of
  // the target port). Fires /api/copilot/cross-detected exactly once per
  // trip (hasFiredCrossRef guards against geofence flapping).
  useEffect(() => {
    if (!tripActive || !tripTargetPort) return
    if (typeof navigator === 'undefined' || !navigator.geolocation) return

    const targetLat = (tripTargetPort as NearbyPort & { lat?: number }).lat
    // We don't get port lat in the smart-route response shape directly —
    // use port_id meta lookup is server-side only. Fall back to recording
    // the start coord and triggering on north-displacement instead.
    const startCoord = coords ? { ...coords } : null

    const id = navigator.geolocation.watchPosition(
      (p) => {
        const pos = { lat: p.coords.latitude, lng: p.coords.longitude }
        setCoords(pos)
        // Distance to nearest port re-derives via /api/smart-route refresh
        // every few minutes, but for the live card we eyeball it from the
        // start coord delta (Haversine-lite on small distances).
        if (startCoord) {
          const dLat = pos.lat - startCoord.lat
          const dLng = pos.lng - startCoord.lng
          const km = Math.sqrt(dLat * dLat + dLng * dLng) * 111
          setLiveDistKm(Math.round(km * 10) / 10)
          // Auto-cross trigger: user is now ≥0.8km north of where they
          // started AND has been moving for ≥3 min. Crude but works for
          // northbound crossings (the dominant case for Cruzar users).
          // South-bound MX-side crossings need a different rule; v0.1 work.
          const elapsedMin = tripStartedAt ? (Date.now() - tripStartedAt) / 60000 : 0
          if (
            !hasFiredCrossRef.current &&
            dLat > 0.0072 && // ~0.8km north in lat-degrees
            elapsedMin >= 3 &&
            km >= 0.8 &&
            targetLat !== undefined ? pos.lat > targetLat : true
          ) {
            hasFiredCrossRef.current = true
            setAutoCrossed(true)
            fetch('/api/copilot/cross-detected', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({
                lat: pos.lat,
                lng: pos.lng,
                port_id: tripTargetPort.port_id,
                circle_id: autoTextCircleId || null,
              }),
            }).catch(() => {})
            speak(lang === 'es' ? 'Cruce detectado. Avisé a tu círculo.' : 'Crossing detected. I notified your circle.')
          }
        }
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 30000, timeout: 30000 },
    )
    watchIdRef.current = id

    return () => {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripActive, tripTargetPort, tripStartedAt])

  useEffect(() => {
    if (!coords) return
    fetch(`/api/smart-route?lat=${coords.lat}&lng=${coords.lng}&limit=3`)
      .then((r) => r.json())
      .then((j) => setNearby(j.routes ?? []))
      .catch(() => {})
  }, [coords])

  function speak(text: string) {
    if (typeof window === 'undefined') return
    const synth = window.speechSynthesis
    if (!synth) return
    const u = new SpeechSynthesisUtterance(text)
    u.lang = lang === 'es' ? 'es-MX' : 'en-US'
    u.rate = 1
    synth.cancel()
    synth.speak(u)
  }

  function toggleListening() {
    if (typeof window === 'undefined') return
    type RecogConstructor = new () => {
      lang: string
      continuous: boolean
      interimResults: boolean
      onresult: (e: { results: { isFinal: boolean; 0: { transcript: string } }[] }) => void
      onend: () => void
      start: () => void
      stop: () => void
    }
    const SR = (window as unknown as { SpeechRecognition?: RecogConstructor; webkitSpeechRecognition?: RecogConstructor }).SpeechRecognition
      || (window as unknown as { webkitSpeechRecognition?: RecogConstructor }).webkitSpeechRecognition
    if (!SR) {
      speak(lang === 'es' ? 'Voz no disponible en este navegador.' : 'Voice not available in this browser.')
      return
    }
    if (listening) {
      const r = recogRef.current as { stop: () => void } | null
      r?.stop()
      setListening(false)
      return
    }
    const recog = new SR()
    recog.lang = lang === 'es' ? 'es-MX' : 'en-US'
    recog.continuous = false
    recog.interimResults = true
    recog.onresult = (e) => {
      let final = ''
      for (let i = 0; i < e.results.length; i++) {
        if (e.results[i].isFinal) final += e.results[i][0].transcript
      }
      if (final) {
        setTranscript(final.trim())
        handleVoiceCommand(final.toLowerCase())
      }
    }
    recog.onend = () => setListening(false)
    recogRef.current = recog
    recog.start()
    setListening(true)
  }

  function handleVoiceCommand(cmd: string) {
    if (cmd.includes('espera') || cmd.includes('wait')) {
      speakWait()
    } else if (cmd.includes('puente') || cmd.includes('bridge') || cmd.includes('nearest')) {
      speakNearest()
    } else if (cmd.includes('crucé') || cmd.includes('crossed')) {
      markCrossed()
    } else if (cmd.includes('hora') || cmd.includes('eta') || cmd.includes('time')) {
      speakNearest()
    }
  }

  function speakWait() {
    const r = nearby[0]
    if (!r) return
    const msg = lang === 'es'
      ? `La espera en ${r.name} es ${r.waitMin ?? 'desconocida'} minutos. Total con tráfico ${r.totalMin} minutos.`
      : `Wait at ${r.name} is ${r.waitMin ?? 'unknown'} minutes. Total with traffic ${r.totalMin} minutes.`
    speak(msg)
  }

  function speakNearest() {
    const r = nearby[0]
    if (!r) return
    const msg = lang === 'es'
      ? `El puente más cercano es ${r.name}, a ${r.distKm} kilómetros, con ${r.driveMin} minutos de manejo y espera de ${r.waitMin ?? 'desconocida'} minutos.`
      : `Nearest bridge is ${r.name}, ${r.distKm} kilometers away, ${r.driveMin} drive minutes, wait ${r.waitMin ?? 'unknown'}.`
    speak(msg)
  }

  async function markCrossed() {
    if (busy) return
    setBusy(true)
    try {
      await fetch('/api/copilot/cross-detected', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          lat: coords?.lat,
          lng: coords?.lng,
          port_id: nearby[0]?.port_id,
          circle_id: autoTextCircleId || null,
        }),
      })
      setCrossed(true)
      speak(lang === 'es' ? 'Listo, avisé a tu familia.' : 'Done — family notified.')
    } finally {
      setBusy(false)
    }
  }

  async function saveSettings() {
    // E.164 client-side guard — server enforces too via /api/profile validation.
    const trimmedPhone = whatsappPhone.trim()
    if (whatsappOptIn && !/^\+[1-9][0-9]{6,14}$/.test(trimmedPhone)) {
      speak(lang === 'es'
        ? 'El teléfono debe estar en formato E.164, por ejemplo +5218990001234.'
        : 'Phone must be E.164 format, e.g. +5218990001234.')
      return
    }
    await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        copilot_voice_opt_in: voiceOptIn,
        copilot_live_activity_opt_in: liveActivityOptIn,
        copilot_auto_text_circle_id: autoTextCircleId || null,
        whatsapp_optin: whatsappOptIn,
        whatsapp_phone_e164: whatsappOptIn ? trimmedPhone : null,
        whatsapp_template_lang: whatsappLang,
      }),
    })
  }

  async function startTrip() {
    if (busy || tripActive) return
    if (!autoTextCircleId) {
      speak(t.needCircleForTrip)
      return
    }
    const target = nearby[0]
    if (!target || !coords) return
    setBusy(true)
    try {
      // Predicted arrival = now + drive minutes + wait minutes (best
      // estimate at trip start; family/eta endpoint reuses it for the
      // initial broadcast).
      const totalMin = (target.driveMin ?? 0) + (target.waitMin ?? 0)
      const predicted = new Date(Date.now() + totalMin * 60 * 1000).toISOString()
      const res = await fetch('/api/family/eta', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          circle_id: autoTextCircleId,
          port_id: target.port_id,
          predicted_arrival_at: predicted,
          origin_lat: coords.lat,
          origin_lng: coords.lng,
          dest_label: target.name,
          message_es: `En camino a ${target.name}. ETA ${totalMin} min.`,
          message_en: `Heading to ${target.name}. ETA ${totalMin} min.`,
        }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) {
        speak(lang === 'es' ? 'Error al iniciar el viaje.' : 'Could not start trip.')
        return
      }
      const pingId = j?.ping?.id ?? null
      setTripPingId(pingId)
      setTripTargetPort(target)
      setTripStartedAt(Date.now())
      setTripActive(true)
      hasFiredCrossRef.current = false
      setAutoCrossed(false)
      // Stamp the active-trip pointer on the user's profile so the cross-
      // detected auto-fire can dedupe across page reloads.
      if (pingId) {
        fetch('/api/profile', {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ copilot_active_trip_id: pingId }),
        }).catch(() => {})
      }
      speak(
        lang === 'es'
          ? `Viaje a ${target.name}, ETA ${totalMin} minutos. Avisé a tu círculo.`
          : `Trip to ${target.name}, ETA ${totalMin} minutes. Circle notified.`,
      )
    } finally {
      setBusy(false)
    }
  }

  async function endTrip() {
    if (watchIdRef.current !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
    setTripActive(false)
    setTripTargetPort(null)
    setTripPingId(null)
    setTripStartedAt(null)
    setLiveDistKm(null)
    fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ copilot_active_trip_id: null }),
    }).catch(() => {})
  }

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-lg mx-auto px-4 pb-16 pt-6">
        <Link href="/" className="flex items-center gap-1 text-xs text-gray-400 mb-3"><ArrowLeft className="w-3 h-3" /> {t.back}</Link>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t.title}</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 mb-5">{t.subtitle}</p>

        <section className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 shadow-sm mb-4">
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={toggleListening}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold ${listening ? 'bg-red-500 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
            >
              {listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              {listening ? t.stop : t.listen}
            </button>
            <button onClick={speakWait} className="ml-2 flex items-center gap-1 px-3 py-3 rounded-xl bg-gray-100 dark:bg-gray-800 text-sm font-medium">
              <Volume2 className="w-4 h-4" /> {t.speak}
            </button>
          </div>
          <p className="text-xs text-gray-400 italic">{t.sayPrompt}</p>
          {transcript && <p className="text-xs text-gray-600 dark:text-gray-300 mt-2">"{transcript}"</p>}
        </section>

        {nearby.length > 0 && (
          <section className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 shadow-sm mb-4">
            <h2 className="text-sm font-semibold mb-3">{lang === 'es' ? 'Puentes cercanos' : 'Nearest bridges'}</h2>
            <ul className="space-y-2">
              {nearby.slice(0, 3).map((r) => (
                <li key={r.port_id} className="flex items-center justify-between text-sm">
                  <span>{r.name}</span>
                  <span className="text-xs text-gray-500">{r.waitMin ?? '?'}min wait · {r.driveMin}min drive</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {tripActive && tripTargetPort && (
          <section className="bg-blue-50 dark:bg-blue-950/30 rounded-2xl border-2 border-blue-400 dark:border-blue-700 p-5 shadow-sm mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                {t.tripActive}
              </span>
              <span className="text-[11px] text-blue-700/70 dark:text-blue-300/70">
                {tripStartedAt ? `${Math.round((Date.now() - tripStartedAt) / 60000)} min` : ''}
              </span>
            </div>
            <p className="text-sm text-blue-900 dark:text-blue-100 mb-1">
              <span className="text-xs text-blue-700/70 dark:text-blue-300/70">{t.tripTo}: </span>
              <span className="font-semibold">{tripTargetPort.name}</span>
            </p>
            <p className="text-xs text-blue-700/80 dark:text-blue-300/80 mb-3">
              {t.tripFamilyNotified}{liveDistKm !== null ? ` · ${liveDistKm} km` : ''}
            </p>
            {autoCrossed && (
              <p className="text-xs font-semibold text-green-700 dark:text-green-300 mb-3 inline-flex items-center gap-1">
                <Check className="w-3 h-3" /> {t.autoCrossDetected}
              </p>
            )}
            <button
              onClick={endTrip}
              className="w-full py-2.5 rounded-xl bg-white dark:bg-gray-900 text-blue-700 dark:text-blue-300 text-sm font-semibold border border-blue-300 dark:border-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900/40 inline-flex items-center justify-center gap-2"
            >
              <Square className="w-3.5 h-3.5" /> {t.endTrip}
            </button>
          </section>
        )}

        <section className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 shadow-sm mb-4">
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2"><RadioTower className="w-4 h-4" /> {t.autoText}</h2>
          <select value={autoTextCircleId} onChange={(e) => setAutoTextCircleId(e.target.value)} className="w-full text-sm rounded-lg bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-3 py-2">
            <option value="">{t.none}</option>
            {circles.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <label className="flex items-center gap-2 mt-3 text-xs text-gray-600 dark:text-gray-300">
            <input type="checkbox" checked={voiceOptIn} onChange={(e) => setVoiceOptIn(e.target.checked)} />
            {t.voiceLabel}
          </label>
          <label className="flex items-start gap-2 mt-3 text-xs text-gray-600 dark:text-gray-300">
            <input
              type="checkbox"
              checked={liveActivityOptIn}
              onChange={(e) => setLiveActivityOptIn(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              <span className="inline-flex items-center gap-1">
                <Smartphone className="w-3 h-3" /> {t.liveActivityLabel}
              </span>
              <span className="block text-[10.5px] text-gray-400 dark:text-gray-500 mt-0.5 italic">
                {t.liveActivityHint}
              </span>
            </span>
          </label>

          {/* WhatsApp opt-in — paired phone + consent. The DB constraint
              profiles_whatsapp_consent_pair enforces this on the server side
              too. Sends are no-ops until WHATSAPP_ACCESS_TOKEN env lands. */}
          <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
            <label className="flex items-start gap-2 text-xs text-gray-600 dark:text-gray-300">
              <input
                type="checkbox"
                checked={whatsappOptIn}
                onChange={(e) => setWhatsappOptIn(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                <span className="inline-flex items-center gap-1">
                  <MessageCircle className="w-3 h-3" />
                  {lang === 'es' ? 'Avisar por WhatsApp cuando cruce' : 'Notify me via WhatsApp when I cross'}
                </span>
                <span className="block text-[10.5px] text-gray-400 dark:text-gray-500 mt-0.5 italic">
                  {lang === 'es'
                    ? 'Mensaje al teléfono que pongas (no a tu círculo). Activo cuando habilitemos WhatsApp.'
                    : 'Message to the phone you enter (not your circle). Activates once WhatsApp is approved.'}
                </span>
              </span>
            </label>
            {whatsappOptIn && (
              <div className="mt-2 ml-5 space-y-2">
                <input
                  type="tel"
                  value={whatsappPhone}
                  onChange={(e) => setWhatsappPhone(e.target.value)}
                  placeholder="+5218990001234"
                  inputMode="tel"
                  autoComplete="tel"
                  className="w-full text-xs rounded-lg bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-2 py-1.5 font-mono"
                />
                <div className="flex items-center gap-2 text-[10.5px] text-gray-500">
                  <span>{lang === 'es' ? 'Idioma:' : 'Language:'}</span>
                  {(['es', 'en'] as const).map((l) => (
                    <button
                      key={l}
                      type="button"
                      onClick={() => setWhatsappLang(l)}
                      className={`rounded-md px-2 py-0.5 font-mono ${
                        whatsappLang === l ? 'bg-green-600 text-white' : 'bg-gray-200 dark:bg-gray-700'
                      }`}
                    >
                      {l.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <button onClick={saveSettings} className="mt-3 w-full text-xs font-medium text-blue-600 hover:underline">{t.saveSettings}</button>
        </section>

        {!tripActive ? (
          <button
            onClick={startTrip}
            disabled={busy || !autoTextCircleId || nearby.length === 0}
            className="w-full py-3 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
          >
            <Play className="w-4 h-4" /> {t.startTrip}
            {!autoTextCircleId && nearby.length > 0 && (
              <span className="ml-1 text-[10.5px] font-normal text-blue-200">· {t.needCircleForTrip}</span>
            )}
          </button>
        ) : (
          <button
            onClick={markCrossed}
            disabled={busy || crossed || autoCrossed}
            className={`w-full py-3 rounded-xl text-sm font-semibold ${crossed || autoCrossed ? 'bg-green-500 text-white' : 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 hover:opacity-90'} disabled:opacity-60`}
          >
            {crossed || autoCrossed ? <span className="inline-flex items-center gap-1"><Check className="w-4 h-4" /> {t.crossedSent}</span> : t.crossed}
          </button>
        )}
      </div>
    </main>
  )
}
