'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Download, Copy, CheckCircle2 } from 'lucide-react'
import { useAuth } from '@/lib/useAuth'

// /admin/ads-preview — admin-only page listing every rendered video
// from the /api/video/latest manifest with:
//   - video player preview (right inline)
//   - download button
//   - pre-formatted caption copy
//   - UTM-tagged landing URL (ready for Meta Ads Manager)
//   - aspect ratio badge for choosing the right creative per placement
//
// Diego uses this as the staging area between "render workflow finished"
// and "ad uploaded into Meta Ads Manager or Make.com automation."

const ADMIN_EMAIL = 'cruzabusiness@gmail.com'

interface VideoEntry {
  compositionId: string
  aspect: string
  url: string
  outputName: string
}

interface Manifest {
  videos: VideoEntry[]
  generatedAt: string | null
  caption?: string | null
  storedAt?: string
}

const COMPOSITION_LABELS: Record<string, { es: string; en: string; archetype: string }> = {
  WaitTimes: {
    es: 'Tiempos en vivo (diario)',
    en: 'Live wait times (daily)',
    archetype: 'Organic',
  },
  HookFbGroup: {
    es: 'Hook — "Nunca más preguntes en el grupo"',
    en: 'Hook — "Never ask the group again"',
    archetype: 'Ad · Problem/Solution',
  },
  AlertDemo: {
    es: 'Demo — Alertas Pro',
    en: 'Demo — Pro Alerts',
    archetype: 'Ad · Feature Demo',
  },
  SocialProof153: {
    es: 'Prueba social — 153/1000',
    en: 'Social proof — 153/1000',
    archetype: 'Ad · Social Proof',
  },
}

function buildUtmUrl(compositionId: string, aspect: string): string {
  const params = new URLSearchParams({
    utm_source: 'meta',
    utm_medium: 'paid_video',
    utm_campaign: compositionId.toLowerCase(),
    utm_content: aspect,
  })
  return `https://cruzar.app/?${params}`
}

export default function AdsPreviewPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [manifest, setManifest] = useState<Manifest | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  useEffect(() => {
    if (loading) return
    if (!user || user.email !== ADMIN_EMAIL) {
      router.replace('/')
      return
    }
    fetch('/api/video/latest', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => setManifest(d))
      .catch(() => setManifest({ videos: [], generatedAt: null }))
  }, [user, loading, router])

  function copy(value: string, key: string) {
    navigator.clipboard.writeText(value).catch(() => {})
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  if (loading || !manifest) {
    return <div className="p-8 text-sm text-gray-500">Loading…</div>
  }

  // Group videos by composition so ads are side-by-side
  const byComposition: Record<string, VideoEntry[]> = {}
  for (const v of manifest.videos) {
    if (!byComposition[v.compositionId]) byComposition[v.compositionId] = []
    byComposition[v.compositionId].push(v)
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="sticky top-0 z-10 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/admin" className="p-2 -ml-2 rounded-xl text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-lg font-black text-gray-900 dark:text-gray-100">Ads Preview</h1>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">
              {manifest.generatedAt
                ? `Latest render: ${new Date(manifest.generatedAt).toLocaleString()}`
                : 'No renders yet — trigger the GitHub Actions workflow'}
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 pb-24">
        {manifest.videos.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-8 text-center">
            <p className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-2">
              No videos in the manifest yet
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
              Trigger a render workflow on GitHub, or run locally with{' '}
              <code className="bg-gray-100 dark:bg-gray-900 px-1.5 py-0.5 rounded text-[11px]">
                node video-generator/render.mjs all 9x16 1x1 4x5
              </code>
            </p>
            <a
              href="https://github.com/diegoaguirre2828/cruzar/actions/workflows/render-videos.yml"
              target="_blank"
              rel="noopener"
              className="inline-block text-xs font-bold text-white bg-blue-600 px-4 py-2 rounded-xl hover:bg-blue-700"
            >
              Open render workflow →
            </a>
          </div>
        ) : (
          <div className="space-y-8">
            {Object.entries(byComposition).map(([compId, videos]) => {
              const label = COMPOSITION_LABELS[compId] || { es: compId, en: compId, archetype: 'Unknown' }
              const primary = videos[0]
              const utmUrl = buildUtmUrl(compId, primary.aspect)
              return (
                <section
                  key={compId}
                  className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden"
                >
                  <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400">
                        {label.archetype}
                      </p>
                      <h2 className="text-base font-black text-gray-900 dark:text-gray-100 mt-0.5">
                        {label.es}
                      </h2>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">{label.en}</p>
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                      {videos.length} aspect{videos.length > 1 ? 's' : ''}
                    </span>
                  </div>

                  <div className="p-5">
                    <div className="grid gap-4 md:grid-cols-2">
                      {videos.map((v) => (
                        <div key={v.url} className="space-y-2">
                          <div className="relative bg-black rounded-xl overflow-hidden aspect-[9/16] max-h-[500px]">
                            <video
                              src={v.url}
                              controls
                              playsInline
                              className="w-full h-full object-contain"
                            />
                            <span className="absolute top-2 right-2 text-[10px] font-black text-white bg-black/80 px-2 py-0.5 rounded">
                              {v.aspect}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <a
                              href={v.url}
                              download={v.outputName}
                              className="flex-1 flex items-center justify-center gap-1.5 text-xs font-bold text-white bg-gray-900 dark:bg-gray-100 dark:text-gray-900 py-2 rounded-lg hover:opacity-90"
                            >
                              <Download className="w-3.5 h-3.5" />
                              Download
                            </a>
                            <button
                              type="button"
                              onClick={() => copy(v.url, `url-${v.url}`)}
                              className="flex items-center gap-1 text-xs font-semibold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 px-2.5 py-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
                            >
                              {copied === `url-${v.url}` ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                              URL
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                      <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-3 border border-gray-200 dark:border-gray-700">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">
                            Landing URL · UTM tagged
                          </p>
                          <button
                            type="button"
                            onClick={() => copy(utmUrl, `utm-${compId}`)}
                            className="text-[10px] font-semibold text-blue-600 dark:text-blue-400"
                          >
                            {copied === `utm-${compId}` ? '✓ Copiado' : 'Copiar'}
                          </button>
                        </div>
                        <code className="text-[10px] text-gray-700 dark:text-gray-300 break-all block font-mono">
                          {utmUrl}
                        </code>
                      </div>

                      {manifest.caption && compId === 'WaitTimes' && (
                        <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-3 border border-gray-200 dark:border-gray-700">
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">
                              Caption (ready to paste)
                            </p>
                            <button
                              type="button"
                              onClick={() => copy(manifest.caption || '', `cap-${compId}`)}
                              className="text-[10px] font-semibold text-blue-600 dark:text-blue-400"
                            >
                              {copied === `cap-${compId}` ? '✓ Copiado' : 'Copiar'}
                            </button>
                          </div>
                          <pre className="text-[11px] text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-snug font-sans">
                            {manifest.caption}
                          </pre>
                        </div>
                      )}
                    </div>
                  </div>
                </section>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
