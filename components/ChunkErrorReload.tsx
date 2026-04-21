'use client'

import { useEffect } from 'react'

// Chunk-load-error recovery. Fires in two situations:
//
// 1. User has a tab open through a deploy — they navigate client-side,
//    Next.js tries to load a code-split chunk whose hash changed in the
//    new deploy, browser 404s, React throws ChunkLoadError.
// 2. A stale service-worker shell references chunk hashes that no
//    longer exist on the server. First route nav surfaces the same
//    ChunkLoadError.
//
// Either way the fix is the same: wipe SW caches so we stop serving
// stale references, unregister the SW so the updated one installs
// fresh, then hard-reload. A sessionStorage guard prevents an infinite
// reload loop if the problem somehow persists.

const RELOAD_KEY = 'cruzar_chunk_reload_at'
const LOOP_WINDOW_MS = 10_000

function looksLikeChunkError(err: unknown): boolean {
  if (!err) return false
  const msg =
    (err as { message?: string })?.message ||
    (typeof err === 'string' ? err : '') ||
    String(err)
  const name = (err as { name?: string })?.name || ''
  if (name === 'ChunkLoadError') return true
  return (
    /Loading chunk [\w-]+ failed/i.test(msg) ||
    /Loading CSS chunk/i.test(msg) ||
    /failed to fetch dynamically imported module/i.test(msg) ||
    /Importing a module script failed/i.test(msg)
  )
}

async function recoverAndReload() {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) || 0)
    if (last && Date.now() - last < LOOP_WINDOW_MS) return
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()))
  } catch {
    // sessionStorage blocked — skip the guard, still attempt recovery once
  }

  try {
    if ('caches' in window) {
      const keys = await caches.keys()
      await Promise.all(keys.map((k) => caches.delete(k)))
    }
  } catch {}

  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations()
      await Promise.all(regs.map((r) => r.unregister()))
    }
  } catch {}

  window.location.reload()
}

export function ChunkErrorReload() {
  useEffect(() => {
    function onError(ev: ErrorEvent) {
      if (looksLikeChunkError(ev.error || ev.message)) {
        recoverAndReload()
      }
    }
    function onRejection(ev: PromiseRejectionEvent) {
      if (looksLikeChunkError(ev.reason)) {
        recoverAndReload()
      }
    }
    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onRejection)
    return () => {
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onRejection)
    }
  }, [])
  return null
}
