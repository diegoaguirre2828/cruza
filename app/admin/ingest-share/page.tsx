'use client'

import { Suspense, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

// PWA Share Target endpoint.
//
// On mobile, when Cruzar is installed as a PWA and the user shares a
// Facebook post (from the FB app, browser, or any share sheet), the OS
// launches this page with the shared content as query params. We grab
// them, stash in sessionStorage, and bounce to /admin where the Ingest
// tab picks them up and pre-fills the textarea.
function IngestShareInner() {
  const router = useRouter()
  const params = useSearchParams()

  useEffect(() => {
    const title = params?.get('title') || ''
    const text = params?.get('text') || ''
    const url = params?.get('url') || ''

    const combined = [title, text, url].filter(Boolean).join('\n').trim()

    if (combined) {
      try {
        sessionStorage.setItem('cruzar_pending_ingest', combined)
      } catch { /* ignore */ }
    }

    router.replace('/admin?tab=ingest')
  }, [params, router])

  return <p className="text-gray-400 text-sm">Sending to Cruzar…</p>
}

export default function IngestSharePage() {
  return (
    <main className="min-h-screen bg-gray-950 flex items-center justify-center">
      <Suspense fallback={<p className="text-gray-400 text-sm">Loading…</p>}>
        <IngestShareInner />
      </Suspense>
    </main>
  )
}
