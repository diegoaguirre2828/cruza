// Pending-intent queue for moments-of-want signup flows.
//
// Pattern:
//   1. Guest clicks "🔔 alert me when Pharr drops" or "save Pharr"
//   2. SignupIntentModal sends them to /signup?intent=alert&port=230502&threshold=30
//   3. /signup queues the intent in localStorage on mount + shows personalized banner
//   4. After successful auth (any method — password, OAuth, magic link, phone),
//      the next authenticated landing (/welcome) reads the queue, executes the
//      intent against the existing /api/alerts or /api/saved endpoints, then
//      forwards the user to the original destination.
//
// LocalStorage survives the OAuth round-trip — works for Google/Apple sign-in
// where the user leaves the site momentarily.

const QUEUE_KEY = "cruzar.signup_intent.v1";

export type SignupIntentKind = "alert" | "favorite" | "notify";

export interface PendingIntent {
  kind: SignupIntentKind;
  port_id: string;
  threshold_min?: number;
  next?: string;
  queued_at: string; // ISO
}

export function readPendingIntent(): PendingIntent | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingIntent;
    // Expire after 30 minutes — stale intents probably mean abandoned signup
    if (Date.now() - new Date(parsed.queued_at).getTime() > 30 * 60 * 1000) {
      localStorage.removeItem(QUEUE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function queueIntent(input: Omit<PendingIntent, "queued_at">): void {
  if (typeof window === "undefined") return;
  try {
    const entry: PendingIntent = { ...input, queued_at: new Date().toISOString() };
    localStorage.setItem(QUEUE_KEY, JSON.stringify(entry));
  } catch {
    /* SSR or quota — silent */
  }
}

export function clearPendingIntent(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(QUEUE_KEY);
  } catch {
    /* ignore */
  }
}

/** Parse intent params off the current URL into the queue shape. Returns
 *  null if no intent present. */
export function parseIntentFromUrl(url: string): Omit<PendingIntent, "queued_at"> | null {
  try {
    const u = new URL(url, "https://www.cruzar.app");
    const kind = u.searchParams.get("intent");
    const port = u.searchParams.get("port");
    if (!kind || !port) return null;
    if (kind !== "alert" && kind !== "favorite" && kind !== "notify") return null;
    const threshold = u.searchParams.get("threshold");
    const next = u.searchParams.get("next") ?? undefined;
    const out: Omit<PendingIntent, "queued_at"> = { kind, port_id: port, next };
    if (threshold) {
      const t = Number(threshold);
      if (Number.isFinite(t) && t > 0 && t < 600) out.threshold_min = t;
    }
    return out;
  } catch {
    return null;
  }
}

/** Execute the queued intent against existing APIs. Caller must be
 *  authenticated (cookies must carry a valid Supabase session). */
export async function executeIntent(intent: PendingIntent): Promise<{ ok: boolean; error?: string }> {
  try {
    if (intent.kind === "favorite") {
      const res = await fetch("/api/saved", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ portId: intent.port_id }),
      });
      if (!res.ok) return { ok: false, error: `saved ${res.status}` };
      return { ok: true };
    }
    if (intent.kind === "alert") {
      const threshold = intent.threshold_min ?? 30;
      const res = await fetch("/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          port_id: intent.port_id,
          lane_type: "vehicle",
          threshold_minutes: threshold,
          active: true,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return { ok: false, error: (err && err.error) || `alerts ${res.status}` };
      }
      return { ok: true };
    }
    if (intent.kind === "notify") {
      // Push notification subscription requires a service-worker round-trip;
      // we can't do it from the queue handler. Stash it as a flag the user's
      // next port-detail visit picks up via the existing useNudge system.
      try {
        localStorage.setItem(
          `cruzar.notify_armed.${intent.port_id}`,
          new Date().toISOString(),
        );
      } catch {
        /* ignore */
      }
      return { ok: true };
    }
    return { ok: false, error: "unknown_intent" };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "execute_threw" };
  }
}
