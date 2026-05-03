'use client'

import { useEffect, useRef, useState } from 'react'
import { Drawer } from 'vaul'
import { Camera, Mic, Square, Send, Check, ImageIcon, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useLang } from '@/lib/LangContext'
import { tapLight, tapSelection, tapSuccess, tapWarning } from '@/lib/haptics'
import { trackEvent } from '@/lib/trackEvent'

interface Props {
  open: boolean
  onClose: () => void
  portId: string
  portName: string
}

type Status = 'fluido' | 'lento' | 'atorado' | 'crossed'
type State = 'idle' | 'submitting' | 'success' | 'cooldown' | 'unauthorized' | 'error'

const STATUS_CHOICES: { value: Status; emoji: string; es: string; en: string; tone: string }[] = [
  { value: 'fluido',  emoji: '🟢', es: 'Fluído',         en: 'Flowing',   tone: 'border-emerald-300 bg-emerald-50 dark:bg-emerald-900/20 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200' },
  { value: 'lento',   emoji: '🟡', es: 'Espera media',   en: 'Moderate',  tone: 'border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800 text-amber-900 dark:text-amber-200' },
  { value: 'atorado', emoji: '🔴', es: 'Atorado',        en: 'Backed up', tone: 'border-red-300 bg-red-50 dark:bg-red-900/20 dark:border-red-800 text-red-900 dark:text-red-200' },
  { value: 'crossed', emoji: '📣', es: 'Acabo de cruzar', en: 'Just crossed', tone: 'border-blue-300 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-800 text-blue-900 dark:text-blue-200' },
]

const WAIT_BUCKETS = [5, 15, 30, 45, 60, 90]

function statusToReportType(s: Status): string {
  switch (s) {
    case 'fluido':  return 'clear'
    case 'lento':   return 'delay'
    case 'atorado': return 'delay'
    case 'crossed': return 'other'
  }
}

export function BridgeReportSheet({ open, onClose, portId, portName }: Props) {
  const { lang } = useLang()
  const es = lang === 'es'

  const [status, setStatus] = useState<Status | null>(null)
  const [waitMinutes, setWaitMinutes] = useState<number | null>(null)
  const [state, setState] = useState<State>('idle')

  // Photo
  const fileRef = useRef<HTMLInputElement>(null)
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [photoUploading, setPhotoUploading] = useState(false)

  // Voice
  const [recording, setRecording] = useState(false)
  const [voiceUrl, setVoiceUrl] = useState<string | null>(null)
  const [voiceUploading, setVoiceUploading] = useState(false)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const recordChunksRef = useRef<Blob[]>([])

  useEffect(() => {
    if (!open) {
      setStatus(null)
      setWaitMinutes(null)
      setState('idle')
      setPhotoUrl(null)
      setVoiceUrl(null)
      setRecording(false)
    }
  }, [open])

  function pickStatus(s: Status) {
    tapSelection()
    setStatus(s)
    if (s !== 'crossed') setWaitMinutes(null)
  }

  function pickWait(m: number) {
    tapSelection()
    setWaitMinutes(m)
  }

  async function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoUploading(true)
    tapLight()
    const fd = new FormData()
    fd.append('file', file)
    fd.append('kind', 'photo')
    fd.append('portId', portId)
    try {
      const res = await fetch('/api/reports/upload', { method: 'POST', body: fd })
      const data = await res.json()
      if (res.ok && data.url) {
        setPhotoUrl(data.url)
        tapSuccess()
      } else {
        toast.error(data.error || (es ? 'No se pudo subir la foto' : 'Photo upload failed'))
        tapWarning()
      }
    } catch {
      toast.error(es ? 'No se pudo subir la foto' : 'Photo upload failed')
      tapWarning()
    } finally {
      setPhotoUploading(false)
    }
  }

  async function startRecording() {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      toast.error(es ? 'Tu dispositivo no soporta grabar audio' : 'Audio recording not supported')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mime = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4'
      const recorder = new MediaRecorder(stream, { mimeType: mime })
      recordChunksRef.current = []
      recorder.ondataavailable = (e) => { if (e.data.size > 0) recordChunksRef.current.push(e.data) }
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        const blob = new Blob(recordChunksRef.current, { type: mime })
        const ext = mime === 'audio/webm' ? 'webm' : 'm4a'
        const file = new File([blob], `voice-${Date.now()}.${ext}`, { type: mime })
        setVoiceUploading(true)
        const fd = new FormData()
        fd.append('file', file)
        fd.append('kind', 'voice')
        fd.append('portId', portId)
        try {
          const res = await fetch('/api/reports/upload', { method: 'POST', body: fd })
          const data = await res.json()
          if (res.ok && data.url) {
            setVoiceUrl(data.url)
            tapSuccess()
          } else {
            toast.error(data.error || (es ? 'No se pudo subir el audio' : 'Voice upload failed'))
            tapWarning()
          }
        } catch {
          toast.error(es ? 'No se pudo subir el audio' : 'Voice upload failed')
          tapWarning()
        } finally {
          setVoiceUploading(false)
        }
      }
      recorderRef.current = recorder
      recorder.start()
      setRecording(true)
      tapLight()
      // Auto-stop at 30s ceiling
      setTimeout(() => {
        if (recorderRef.current && recorderRef.current.state === 'recording') {
          recorderRef.current.stop()
          setRecording(false)
        }
      }, 30_000)
    } catch {
      toast.error(es ? 'Permiso de micrófono denegado' : 'Microphone permission denied')
      tapWarning()
    }
  }

  function stopRecording() {
    if (recorderRef.current && recorderRef.current.state === 'recording') {
      recorderRef.current.stop()
      tapLight()
    }
    setRecording(false)
  }

  function clearAttachments() {
    setPhotoUrl(null)
    setVoiceUrl(null)
    if (fileRef.current) fileRef.current.value = ''
    tapLight()
  }

  async function submit() {
    if (!status) return
    if (status === 'crossed' && waitMinutes == null) return
    setState('submitting')
    tapLight()
    trackEvent('bridge_report_sheet_submit', { port_id: portId, status, wait_minutes: waitMinutes })

    const reportType = statusToReportType(status)
    const attachments: { kind: string; url: string }[] = []
    if (photoUrl) attachments.push({ kind: 'photo', url: photoUrl })
    if (voiceUrl) attachments.push({ kind: 'voice', url: voiceUrl })

    const body = {
      portId,
      reportType,
      condition: status === 'fluido' ? 'fast' : status === 'lento' ? 'slow' : status === 'atorado' ? 'slow' : 'normal',
      waitMinutes: status === 'crossed' ? waitMinutes : undefined,
      // attachments ride in source_meta via the existing extra_tags / meta path —
      // /api/reports already passes source_meta through.
      laneType: 'vehicle',
      extraTags: attachments.length > 0 ? ['has_attachment'] : [],
      attachments: attachments.length > 0 ? attachments : undefined,
    }

    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        setState('success')
        tapSuccess()
        const verb = status === 'crossed'
          ? (es ? `Reporte enviado · ${waitMinutes} min` : `Report sent · ${waitMinutes} min`)
          : (es ? 'Gracias · reporte enviado' : 'Thanks · report sent')
        const earned = data?.pointsEarned ? ` (+${data.pointsEarned})` : ''
        toast.success(verb + earned, {
          description: portName,
          duration: 4000,
          action: {
            label: es ? 'Compartir' : 'Share',
            onClick: () => shareReport(),
          },
        })
        trackEvent('bridge_report_sheet_success', { port_id: portId, status, wait_minutes: waitMinutes })
        setTimeout(onClose, 700)
      } else if (res.status === 401) {
        setState('unauthorized')
        tapWarning()
      } else if (res.status === 429) {
        setState('cooldown')
        tapWarning()
        toast.warning(data.error || (es ? 'Espera un poco — reporte reciente' : 'Slow down — recent report'))
      } else {
        setState('error')
        tapWarning()
        toast.error(data.error || (es ? 'No se pudo enviar' : 'Could not submit'))
      }
    } catch {
      setState('error')
      tapWarning()
    }
  }

  function shareReport() {
    tapLight()
    const url = waitMinutes != null && waitMinutes >= 0 && waitMinutes <= 240
      ? `https://cruzar.app/w/${portId}/${waitMinutes}`
      : `https://cruzar.app/cruzar/${portId}`
    const text = es
      ? `🌉 ${portName} ahorita: ${waitMinutes != null ? `${waitMinutes} min` : 'reportado'} · Cruzar`
      : `🌉 ${portName} right now: ${waitMinutes != null ? `${waitMinutes} min` : 'reported'} · Cruzar`
    if (typeof navigator !== 'undefined' && navigator.share) {
      navigator.share({ title: 'Cruzar', text, url }).catch(() => {})
    } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(`${text}\n${url}`).catch(() => {})
      toast.success(es ? 'Copiado' : 'Copied')
    }
  }

  const submitDisabled = !status
    || (status === 'crossed' && waitMinutes == null)
    || state === 'submitting'
    || photoUploading
    || voiceUploading

  return (
    <Drawer.Root
      open={open}
      onOpenChange={(o) => { if (!o) onClose() }}
      shouldScaleBackground
    >
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm" />
        <Drawer.Content
          className="fixed bottom-0 left-0 right-0 z-[61] mt-24 flex h-auto flex-col rounded-t-3xl bg-white dark:bg-gray-900 outline-none focus:outline-none"
          style={{ paddingBottom: 'calc(5.5rem + env(safe-area-inset-bottom))' }}
        >
          <Drawer.Title className="sr-only">
            {es ? `Reportar estado de ${portName}` : `Report status for ${portName}`}
          </Drawer.Title>
          <Drawer.Description className="sr-only">
            {es ? 'Elige cómo está la espera y opcionalmente sube foto o audio.' : 'Pick the status and optionally attach photo or voice.'}
          </Drawer.Description>

          <div className="mx-auto my-3 h-1.5 w-10 rounded-full bg-gray-200 dark:bg-gray-700" />

          <div className="px-5 pb-4">
            <div className="mb-4">
              <p className="text-[11px] uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">
                {es ? 'Reportar' : 'Report'}
              </p>
              <h3 className="font-bold text-gray-900 dark:text-gray-100 text-lg leading-tight font-display truncate">
                {portName}
              </h3>
            </div>

            <div className="grid grid-cols-2 gap-2 mb-4">
              {STATUS_CHOICES.map((c) => (
                <button
                  key={c.value}
                  onClick={() => pickStatus(c.value)}
                  className={`px-3 py-3 rounded-2xl border text-sm font-bold text-left flex items-center gap-2 transition-all duration-150 active:scale-[0.97] ${
                    status === c.value
                      ? `${c.tone} ring-2 ring-offset-2 ring-offset-white dark:ring-offset-gray-900 ring-current`
                      : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200'
                  }`}
                >
                  <span className="text-base">{c.emoji}</span>
                  <span className="leading-tight">{es ? c.es : c.en}</span>
                </button>
              ))}
            </div>

            {status === 'crossed' && (
              <div className="mb-4">
                <p className="text-[11px] uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400 mb-2">
                  {es ? 'Cuánto esperaste' : 'How long you waited'}
                </p>
                <div className="grid grid-cols-6 gap-1.5">
                  {WAIT_BUCKETS.map(m => (
                    <button
                      key={m}
                      onClick={() => pickWait(m)}
                      className={`py-2.5 rounded-xl text-sm font-bold border transition-all duration-150 active:scale-95 ${
                        waitMinutes === m
                          ? 'bg-blue-600 border-blue-600 text-white'
                          : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      <span className="font-mono tabular-nums">{m}</span>
                      <span className="text-[10px] opacity-70 ml-0.5">m</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Attachments rail */}
            <div className="flex items-center gap-2 mb-4">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handlePhoto}
                className="hidden"
              />
              <button
                onClick={() => { tapLight(); fileRef.current?.click() }}
                disabled={photoUploading}
                className={`flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl border text-xs font-semibold disabled:opacity-50 active:scale-[0.97] transition-transform ${
                  photoUrl
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-800 dark:bg-emerald-900/30 dark:border-emerald-700 dark:text-emerald-200'
                    : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200'
                }`}
              >
                {photoUrl ? <ImageIcon className="w-4 h-4" /> : <Camera className="w-4 h-4" />}
                {photoUploading
                  ? (es ? 'Subiendo…' : 'Uploading…')
                  : photoUrl
                    ? (es ? 'Foto lista' : 'Photo ready')
                    : (es ? 'Foto' : 'Photo')}
              </button>

              <button
                onClick={() => recording ? stopRecording() : startRecording()}
                disabled={voiceUploading}
                className={`flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl border text-xs font-semibold disabled:opacity-50 active:scale-[0.97] transition-transform ${
                  recording
                    ? 'bg-red-500 border-red-500 text-white animate-pulse'
                    : voiceUrl
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-800 dark:bg-emerald-900/30 dark:border-emerald-700 dark:text-emerald-200'
                      : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200'
                }`}
              >
                {recording ? <Square className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                {recording
                  ? (es ? 'Detener' : 'Stop')
                  : voiceUploading
                    ? (es ? 'Subiendo…' : 'Uploading…')
                    : voiceUrl
                      ? (es ? 'Audio listo' : 'Voice ready')
                      : (es ? 'Voz' : 'Voice')}
              </button>

              {(photoUrl || voiceUrl) && (
                <button
                  onClick={clearAttachments}
                  aria-label={es ? 'Quitar adjuntos' : 'Clear attachments'}
                  className="p-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-500 hover:text-red-600"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>

            {state === 'success' ? (
              <div className="w-full py-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center gap-2 text-emerald-900 dark:text-emerald-100 font-bold text-sm">
                <Check className="w-5 h-5" strokeWidth={3} />
                {es ? 'Reporte enviado' : 'Report sent'}
              </div>
            ) : state === 'unauthorized' ? (
              <a
                href={`/signup?intent=report&port=${encodeURIComponent(portId)}`}
                className="block w-full py-3.5 rounded-xl bg-blue-600 text-white font-bold text-sm text-center active:scale-[0.99] transition-transform"
              >
                {es ? 'Inicia sesión gratis pa\' reportar' : 'Sign in (free) to report'}
              </a>
            ) : (
              <button
                onClick={submit}
                disabled={submitDisabled}
                className="w-full py-3.5 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white font-black text-sm disabled:opacity-50 active:scale-[0.99] transition-transform shadow-lg shadow-blue-600/30 inline-flex items-center justify-center gap-2"
              >
                {state === 'submitting'
                  ? '…'
                  : state === 'error'
                    ? (es ? '⚠️ Reintentar' : '⚠️ Retry')
                    : state === 'cooldown'
                      ? (es ? 'Espera unos minutos' : 'Wait a few minutes')
                      : (
                          <>
                            <Send className="w-4 h-4" />
                            {es ? 'Enviar reporte' : 'Send report'}
                          </>
                        )}
              </button>
            )}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}
