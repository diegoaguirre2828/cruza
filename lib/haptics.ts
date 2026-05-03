// Capacitor Haptics wrapper with web fallback. Single tap point so every
// surface that wants the "real app" buzz (button taps, toggles, success
// confirmations) calls one helper instead of branching per platform.
//
// Native: routes to @capacitor/haptics (iOS / Android).
// Web (PWA in browser): uses Vibration API where supported.
// SSR: no-op.

let nativeHaptics: typeof import('@capacitor/haptics') | null = null

async function getNative(): Promise<typeof import('@capacitor/haptics') | null> {
  if (typeof window === 'undefined') return null
  if (nativeHaptics) return nativeHaptics
  try {
    const cap = await import('@capacitor/core').catch(() => null)
    if (!cap?.Capacitor?.isNativePlatform?.()) return null
    nativeHaptics = await import('@capacitor/haptics')
    return nativeHaptics
  } catch {
    return null
  }
}

function webVibrate(pattern: number | number[]) {
  if (typeof navigator === 'undefined') return
  if (typeof navigator.vibrate === 'function') {
    try { navigator.vibrate(pattern) } catch { /* ignore */ }
  }
}

export async function tapLight() {
  const n = await getNative()
  if (n) {
    try { await n.Haptics.impact({ style: n.ImpactStyle.Light }) } catch { /* ignore */ }
    return
  }
  webVibrate(8)
}

export async function tapMedium() {
  const n = await getNative()
  if (n) {
    try { await n.Haptics.impact({ style: n.ImpactStyle.Medium }) } catch { /* ignore */ }
    return
  }
  webVibrate(15)
}

export async function tapSuccess() {
  const n = await getNative()
  if (n) {
    try { await n.Haptics.notification({ type: n.NotificationType.Success }) } catch { /* ignore */ }
    return
  }
  webVibrate(20)
}

export async function tapWarning() {
  const n = await getNative()
  if (n) {
    try { await n.Haptics.notification({ type: n.NotificationType.Warning }) } catch { /* ignore */ }
    return
  }
  webVibrate([10, 50, 10])
}

export async function tapSelection() {
  const n = await getNative()
  if (n) {
    try { await n.Haptics.selectionChanged() } catch { /* ignore */ }
    return
  }
  webVibrate(5)
}
