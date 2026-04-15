'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Camera, Lock } from 'lucide-react'
import { useTier } from '@/lib/useTier'
import { useLang } from '@/lib/LangContext'
import { getBridgeCameras, type CameraFeed } from '@/lib/bridgeCameras'

// HLS video player sub-component. Dynamically imports hls.js ONLY when
// a video element mounts with an hls-kind feed, so guest/free/non-hls
// users never download the library. Safari natively supports HLS via
// the video element's src attribute, so we short-circuit for that case
// and skip loading hls.js entirely. Fired from state 2 (Pro unlocked).
function HlsVideo({ src, title }: { src: string; title: string }) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src
      return
    }

    let hls: { destroy: () => void } | null = null
    let cancelled = false
    import('hls.js').then((mod) => {
      if (cancelled || !videoRef.current) return
      const Hls = mod.default
      if (Hls.isSupported()) {
        const instance = new Hls({ enableWorker: true })
        instance.loadSource(src)
        instance.attachMedia(videoRef.current)
        hls = instance
      }
    }).catch(() => { /* hls.js failed to load — silent fallback */ })

    return () => {
      cancelled = true
      hls?.destroy()
    }
  }, [src])

  return (
    <video
      ref={videoRef}
      className="w-full h-full object-cover"
      autoPlay
      muted
      playsInline
      controls
      title={title}
    />
  )
}

// Renders a single feed inside the camera card. Used for both Pro
// state (full clarity) and — indirectly — for the blurred teaser
// when the feed happens to be kind:'image'.
function FeedPlayer({ feed, portName }: { feed: CameraFeed; portName: string }) {
  if (feed.kind === 'iframe') {
    return (
      <iframe
        src={feed.src}
        className="w-full h-full"
        allow="autoplay; fullscreen"
        loading="lazy"
        title={`${portName} live camera`}
      />
    )
  }
  if (feed.kind === 'youtube') {
    return (
      <iframe
        src={`https://www.youtube.com/embed/${feed.src}?autoplay=1&mute=1&rel=0`}
        className="w-full h-full"
        allow="autoplay; encrypted-media"
        loading="lazy"
        title={`${portName} live camera`}
      />
    )
  }
  if (feed.kind === 'image') {
    return (
      <img
        src={feed.src}
        alt={`${portName} live camera`}
        className="w-full h-full object-cover"
      />
    )
  }
  if (feed.kind === 'hls') {
    return <HlsVideo src={feed.src} title={`${portName} live camera`} />
  }
  return null
}

interface Props {
  portId: string
  portName: string
}

// Port detail camera section. Shows one of three states:
//   1. No feeds registered for this port → "próximamente" card
//   2. Feeds + user is Pro/Business      → live embed with tab picker if multi
//   3. Feeds + user is guest/free        → blurred teaser + Pro unlock CTA
//
// Free users NEVER see a broken/blurred state for ports with no feed —
// that would lie about what Pro unlocks. The "próximamente" card is
// the same for everyone.
export function BridgeCameras({ portId, portName }: Props) {
  const { tier } = useTier()
  const { lang } = useLang()
  const es = lang === 'es'
  const feeds = getBridgeCameras(portId)
  const isPro = tier === 'pro' || tier === 'business'
  const [activeIdx, setActiveIdx] = useState(0)

  // State 1 — no feeds registered
  if (feeds.length === 0) {
    return (
      <div className="bg-gradient-to-br from-gray-900 to-gray-800 dark:from-gray-900 dark:to-black rounded-2xl border border-gray-700 p-5 shadow-sm overflow-hidden relative">
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative">
          <div className="flex items-center gap-2 mb-2">
            <Camera className="w-4 h-4 text-blue-400" />
            <h2 className="text-sm font-bold text-white">
              {es ? 'Cámara en vivo' : 'Live camera'}
            </h2>
            <span className="ml-auto text-[9px] font-black uppercase tracking-wider bg-gradient-to-br from-amber-400 to-orange-500 text-white px-2 py-0.5 rounded-full">
              Pro
            </span>
          </div>
          <div className="aspect-video bg-black/50 rounded-xl border border-gray-700 flex flex-col items-center justify-center gap-2 text-center p-4">
            <Camera className="w-8 h-8 text-gray-600" />
            <p className="text-xs font-semibold text-gray-300">
              {es ? 'Cámara próximamente' : 'Camera coming soon'}
            </p>
            <p className="text-[10px] text-gray-500 leading-snug max-w-[240px]">
              {es
                ? `Estamos trabajando en agregar la cámara en vivo de ${portName}. Las cámaras de otros cruces se desbloquean con Pro.`
                : `We're working on adding the live camera for ${portName}. Cameras for other crossings unlock with Pro.`}
            </p>
          </div>
        </div>
      </div>
    )
  }

  const safeIdx = Math.min(activeIdx, feeds.length - 1)
  const activeFeed = feeds[safeIdx]
  const hasTabs = feeds.length > 1

  // State 2 — feeds + Pro
  if (isPro) {
    return (
      <div className="bg-gray-900 dark:bg-black rounded-2xl border border-gray-700 p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <Camera className="w-4 h-4 text-green-400" />
          <h2 className="text-sm font-bold text-white">
            {es ? 'Cámara en vivo' : 'Live camera'}
          </h2>
          <span className="flex items-center gap-1 text-[10px] font-semibold text-green-400 ml-auto">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
            </span>
            {es ? 'EN VIVO' : 'LIVE'}
          </span>
        </div>

        {hasTabs && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {feeds.map((f, i) => {
              const active = i === safeIdx
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => setActiveIdx(i)}
                  className={`text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full border transition-colors ${
                    active
                      ? 'bg-white text-gray-900 border-white'
                      : 'bg-white/5 text-gray-300 border-white/15 hover:bg-white/10'
                  }`}
                >
                  {f.label || `Cam ${i + 1}`}
                </button>
              )
            })}
          </div>
        )}

        <div className="aspect-video bg-black rounded-xl overflow-hidden border border-gray-800">
          <FeedPlayer feed={activeFeed} portName={portName} />
        </div>

        {activeFeed.note && (
          <p className="text-[10px] text-gray-400 mt-1.5 leading-snug">{activeFeed.note}</p>
        )}
        <p className="text-[10px] text-gray-500 mt-1">
          {es ? 'Fuente: ' : 'Source: '}
          {activeFeed.creditUrl ? (
            <a href={activeFeed.creditUrl} target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-300">
              {activeFeed.credit}
            </a>
          ) : activeFeed.credit}
        </p>
      </div>
    )
  }

  // State 3 — feeds exist but user is free/guest
  return (
    <div className="bg-gray-900 dark:bg-black rounded-2xl border border-gray-700 p-4 shadow-sm relative overflow-hidden">
      <div className="flex items-center gap-2 mb-2">
        <Camera className="w-4 h-4 text-blue-400" />
        <h2 className="text-sm font-bold text-white">
          {es ? 'Cámara en vivo' : 'Live camera'}
        </h2>
        <span className="ml-auto text-[9px] font-black uppercase tracking-wider bg-gradient-to-br from-amber-400 to-orange-500 text-white px-2 py-0.5 rounded-full">
          Pro
        </span>
      </div>

      {hasTabs && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {feeds.map((f, i) => (
            <span
              key={i}
              className="text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full border bg-white/5 text-gray-400 border-white/10"
            >
              {f.label || `Cam ${i + 1}`}
            </span>
          ))}
        </div>
      )}

      <div className="aspect-video bg-black rounded-xl overflow-hidden border border-gray-800 relative">
        {/* Blurred teaser — first feed only, only if it's an image */}
        {activeFeed.kind === 'image' ? (
          <img
            src={activeFeed.src}
            alt=""
            className="w-full h-full object-cover blur-xl scale-110 opacity-60"
            aria-hidden="true"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-gray-800 via-gray-900 to-black" />
        )}
        {/* Lock overlay */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center p-4 bg-black/60 backdrop-blur-sm">
          <Lock className="w-8 h-8 text-amber-400" />
          <p className="text-sm font-black text-white">
            {es
              ? `Desbloquea ${feeds.length > 1 ? `${feeds.length} cámaras` : 'la cámara'} en vivo`
              : `Unlock ${feeds.length > 1 ? `${feeds.length} live cameras` : 'live camera'}`}
          </p>
          <p className="text-[11px] text-gray-300 leading-snug max-w-[260px]">
            {es
              ? 'Ve los carriles en tiempo real antes de salir. Incluido con Pro.'
              : 'See the lanes in real time before you leave. Included with Pro.'}
          </p>
          <Link
            href="/pricing"
            className="mt-1 inline-flex items-center gap-1 bg-gradient-to-br from-amber-400 to-orange-500 text-white font-black text-xs px-4 py-2 rounded-full shadow-lg active:scale-95 transition-transform"
          >
            {es ? 'Ver Pro · $2.99/mes' : 'See Pro · $2.99/mo'}
          </Link>
          <p className="text-[10px] text-amber-300 font-semibold">
            {es ? 'o gratis 3 meses al instalar la app' : 'or free 3 months when you install the app'}
          </p>
        </div>
      </div>
    </div>
  )
}
