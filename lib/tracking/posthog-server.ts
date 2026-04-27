// Server PostHog client. Used by:
//   - Stripe webhooks (subscription events)
//   - RevenueCat webhooks (iOS IAP)
//   - /api/cron/send-alerts (alert.delivered)
//   - /api/driver/checkin (driver.checked_in)
//   - /api/data-deletion (user.account_deleted)
//   - /api/cron/posthog-traits-snapshot (daily trait/group sync)
//
// Vercel serverless quirks:
//   - Functions freeze immediately after the response is written.
//   - posthog-node batches by default; un-flushed batches are lost on freeze.
//   - We set flushAt:1 + flushInterval:0 so each capture call sends
//     immediately, and we still call shutdown() at the end of the request
//     to drain any in-flight batch.

import { PostHog } from 'posthog-node';

let _client: PostHog | null = null;

export function getServerPostHog(): PostHog | null {
  if (!process.env.POSTHOG_KEY) return null;     // env not configured -> graceful no-op
  if (!_client) {
    _client = new PostHog(process.env.POSTHOG_KEY, {
      host: process.env.POSTHOG_HOST || 'https://us.i.posthog.com',
      flushAt: 1,
      flushInterval: 0,
    });
  }
  return _client;
}

export async function flushServerPostHog(): Promise<void> {
  if (_client) {
    try {
      await _client.shutdown();
    } catch {
      /* never throw from telemetry */
    }
    _client = null;
  }
}

// Lightweight server-side wrapper. Always fire-and-forget at the call site.
// Pass `businessAccountId` when the event belongs to a Business-tier
// dispatcher so PostHog can roll it up under the business_account group.
export async function trackServer(
  distinctId: string,
  event: string,
  properties: Record<string, unknown> = {},
  opts: { businessAccountId?: string } = {},
): Promise<void> {
  const ph = getServerPostHog();
  if (!ph) return;
  try {
    ph.capture({
      distinctId,
      event,
      properties,
      groups: opts.businessAccountId
        ? { business_account: opts.businessAccountId }
        : undefined,
    });
    await ph.shutdown();
    _client = null;
  } catch {
    /* never throw from telemetry */
  }
}

export async function identifyServer(
  distinctId: string,
  traits: Record<string, unknown>,
): Promise<void> {
  const ph = getServerPostHog();
  if (!ph) return;
  try {
    ph.identify({ distinctId, properties: traits });
    await ph.shutdown();
    _client = null;
  } catch { /* never throw from telemetry */ }
}

export async function groupIdentifyServer(
  groupKey: string,
  traits: Record<string, unknown>,
): Promise<void> {
  const ph = getServerPostHog();
  if (!ph) return;
  try {
    ph.groupIdentify({
      groupType: 'business_account',
      groupKey,
      properties: traits,
    });
    await ph.shutdown();
    _client = null;
  } catch { /* never throw from telemetry */ }
}
