// Client-side Sentry init — Next.js 15.3+ pattern. This file used to
// be sentry.client.config.ts and lived at the repo root; the new
// convention is instrumentation-client.ts so Next.js can hook it
// into the same instrumentation lifecycle as the server/edge
// register() function.
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Ignore benign / third-party noise that buries real bugs:
  //  - "Lock broken/stolen" fires from Supabase auth's Web-Locks API
  //    whenever a user has two tabs open; it's how Supabase hands off
  //    the auth lock between tabs. Not actionable.
  //  - "Load failed" on iOS Safari is a fetch network hiccup, not a
  //    code bug. The app already retries where it matters.
  ignoreErrors: [
    /Lock broken by another request with the 'steal' option/,
    /Lock was stolen by another request/,
    /^TypeError: Load failed$/,
    // Facebook / Instagram in-app-browser injects these. Not from our
    // code, pure platform noise. ~3-5 false alerts/day until filtered.
    /window\.webkit\.messageHandlers/,
    /enableButtonsClickedMetaDataLogging/,
    /enableDidUserTypeOnKeyboardLogging/,
    /Java object is gone/,
    /Non-Error promise rejection captured with value: undefined/,
    // 2026-04-29 — Sentry quota burn triage: these patterns produced
    // 1300+ events / 7 days with zero actionable signal. Real bugs
    // would surface through user reports or perf metrics regardless.
    //  - "Hydration Error" — RSC vs client mismatch from third-party
    //    extensions (Honey, Grammarly, translate). 950 events / week
    //    on / and bleeds onto every page nav. Sentry's React 19 SDK
    //    doesn't have a clean hydration filter yet.
    //  - "Failed to fetch" — TypeError from offline / aborted requests.
    //    SWR / fetch already retries; logging it hides real network bugs.
    //  - "Permissions API illegal invocation" — Safari iOS quirk on
    //    geolocation feature-detect. Pure browser bug.
    //  - "sessionStorage / localStorage access denied" — Safari Private
    //    Browsing blocks storage. We already feature-detect; the throw
    //    is from third-party scripts.
    //  - "removeChild on Node not a child" — React reconciler race when
    //    extensions inject DOM nodes between renders. Not our code.
    //  - "Rendered more hooks" — was on /port/:portId, last seen 04-21.
    //    If it returns we'll see it via the user complaint, not Sentry.
    /Hydration Error|Hydration failed/i,
    /^TypeError: Failed to fetch$/,
    /Failed to execute 'query' on 'Permissions': Illegal invocation/,
    /Failed to read the 'sessionStorage' property/,
    /Failed to read the 'localStorage' property/,
    /Failed to execute 'removeChild' on 'Node'/,
    /Rendered more hooks than during the previous render/,
    /N\+1 API Call/, // perf alert noise — real perf via Vercel Analytics
  ],

  // Performance monitoring — dropped from 10% to 1% on 2026-04-29 because
  // we hit 80% of monthly quota mid-cycle. 1% is enough to surface trend
  // changes; specific incidents come from Vercel Analytics.
  tracesSampleRate: 0.01,

  // Session replay on errors ONLY — 100% of error sessions get a
  // replay so we can see exactly what the user clicked before the
  // crash. Regular sessions aren't recorded to stay under the free
  // tier's replay quota.
  replaysOnErrorSampleRate: 1.0,
  replaysSessionSampleRate: 0.0,

  integrations: [
    Sentry.replayIntegration({
      maskAllText: false,
      blockAllMedia: false,
    }),
  ],

  // Silence the SDK's internal logs in production so we don't pollute
  // users' devtools consoles. Leave on in dev so Diego can tell when
  // something is firing.
  debug: false,
})

// Re-export the router transition hook so Next.js can connect page
// navigations to Sentry traces. Required for Next.js 15+ app router.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
