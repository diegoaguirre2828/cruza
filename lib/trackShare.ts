// Fire-and-forget share-event tracker.
//
// Called from every share button (WhatsApp, Copy for FB, native share)
// before the share URL opens. Increments the user's share_count on the
// server. Anonymous shares are accepted silently so the caller can stay
// ignorant of auth state. Failures don't block the share action.

export function trackShare(channel: string, context: string): void {
  if (typeof window === 'undefined') return
  // No await — completely fire-and-forget. A failed track should NEVER
  // block the user from actually sharing.
  fetch('/api/user/share-event', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ channel, context }),
    keepalive: true, // allow the request to survive page navigation
  }).catch(() => { /* ignore */ })
}
