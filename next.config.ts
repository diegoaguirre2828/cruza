import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  /* config options here */
};

export default withSentryConfig(nextConfig, {
  // Suppresses source map uploading logs during build
  silent: !process.env.CI,

  org: "cruzar",
  project: "javascript-nextjs",

  // Upload source maps for readable stack traces. Requires
  // SENTRY_AUTH_TOKEN on Vercel — set in Vercel → Settings →
  // Environment Variables. Diego can grab the token from the
  // Sentry dashboard at Settings → Account → Auth Tokens.
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Route browser requests to Sentry through a Next.js rewrite to
  // bypass ad-blockers that would otherwise silently drop error
  // events. Critical for a border-commuter audience where ad blockers
  // are common on mobile PWA installs.
  tunnelRoute: "/monitoring",
});
