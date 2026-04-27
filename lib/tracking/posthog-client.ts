// Browser PostHog client. Initialized lazily on first call so SSR/RSC
// pages don't pull the SDK into the server bundle.
//
// Reads NEXT_PUBLIC_POSTHOG_KEY at runtime. When the key isn't set
// (preview deploys, local dev without analytics) every method becomes
// a no-op — the rest of the tracking module keeps compiling and running.

import type { PostHog } from 'posthog-js';

let _ph: PostHog | null = null;
let _initAttempted = false;
let _internalUserOptedOut = false;

export function getClientPostHog(): PostHog | null {
  if (typeof window === 'undefined') return null;
  if (_ph) return _ph;
  if (_initAttempted) return null;       // tried once and bailed — don't retry per call
  _initAttempted = true;

  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return null;

  // Dynamic import to keep posthog-js out of the SSR bundle and only
  // ship it to the browser on demand.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const posthog = (require('posthog-js') as typeof import('posthog-js')).default;

  posthog.init(key, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
    defaults: '2026-01-30',
    autocapture: false,                  // 53 manual events already; no autocapture noise
    capture_pageview: true,
    capture_pageleave: true,
    disable_session_recording: true,     // free-tier preservation
    persistence: 'localStorage+cookie',
    loaded: (ph) => {
      // Dev — opt out so we never pollute the prod project from localhost.
      if (process.env.NODE_ENV !== 'production') ph.opt_out_capturing();
    },
  });

  _ph = posthog;
  return _ph;
}

// Internal-user exclusion. Called from identifyUser() once we know the
// signed-in email. After this, every capture is short-circuited.
export function optOutInternalUser(): void {
  if (_internalUserOptedOut) return;
  _internalUserOptedOut = true;
  const ph = getClientPostHog();
  ph?.opt_out_capturing();
}

export function isInternalUser(): boolean {
  return _internalUserOptedOut;
}
