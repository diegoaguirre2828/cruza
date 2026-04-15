// Intentional server-side error for Sentry verification. Tap the
// "Trigger server-side error" button at /sentry-example-page and
// the resulting 500 should land in Sentry's Issues dashboard
// within a few seconds.
export async function GET() {
  throw new Error('Sentry Example API Route Error')
}
