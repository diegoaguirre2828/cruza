// Fetch with AbortController timeout. Default 6s — covers slow border
// cell without stalling the UI indefinitely. Use for any client-side
// call where a hung network shouldn't block state progression.
//
// Throws a named DOMException 'AbortError' on timeout so callers can
// distinguish from a plain network failure if they care to.

export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = 6000,
): Promise<Response> {
  const controller = new AbortController()
  const signals: AbortSignal[] = [controller.signal]
  if (init.signal) signals.push(init.signal)
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(input, {
      ...init,
      signal: signals.length > 1 && 'any' in AbortSignal
        ? (AbortSignal as unknown as { any: (s: AbortSignal[]) => AbortSignal }).any(signals)
        : controller.signal,
    })
  } finally {
    clearTimeout(timer)
  }
}
