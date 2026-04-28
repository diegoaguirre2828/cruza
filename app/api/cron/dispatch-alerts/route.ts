// Layer 2 W2 — operator alert dispatcher.
//
// Runs every 5 minutes via cron-job.org. For each active operator_alert_rule:
//   1. Resolve the load(s) it applies to
//   2. For each load, evaluate the rule against the stored snapshot
//      (predicted_wait, p_make_appt, detention_dollars). For
//      `anomaly_at_recommended`, do an inline live-vs-baseline check.
//   3. If fired and outside cooldown:
//      - insert operator_alert_dispatches row
//      - deliver via channel (push, email, sms, mcp_log)
//      - update rule.last_fired_at
//
// Auth: ?secret=CRON_SECRET or Authorization: Bearer <CRON_SECRET>.

import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";
import { evaluateRule, renderAlertText, type AlertRule, type LoadSnapshot } from "@/lib/alertEngine";
import { forecast, isForecastError } from "@/lib/forecastClient";
import { computeLoadEta, type DriveCache } from "@/lib/loadEta";
import webpush from "web-push";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    "mailto:cruzabusiness@gmail.com",
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  );
}

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const q = req.nextUrl.searchParams.get("secret");
  if (q && q === secret) return true;
  const auth = req.headers.get("authorization") || "";
  return auth.replace(/^Bearer\s+/i, "").trim() === secret;
}

// Standard normal CDF (Abramowitz & Stegun 26.2.17). Mirrors lib/loadEta.
function normCdf(x: number): number {
  const a1 =  0.254829592, a2 = -0.284496736, a3 =  1.421413741;
  const a4 = -1.453152027, a5 =  1.061405429, p  =  0.3275911;
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x) / Math.sqrt(2);
  const t = 1.0 / (1.0 + p * ax);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-ax * ax);
  return 0.5 * (1.0 + sign * y);
}

const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

interface RefreshOutcome {
  snapshot: LoadSnapshot;          // patched with fresh values
  priorEtaMinutes: number | null;
  currentEtaResult: Awaited<ReturnType<typeof computeLoadEta>> | null;  // populated only on (c) full re-route
  persist: Record<string, unknown>;  // fields to write back to tracked_loads
}

// Layer (b) — refresh only the recommended port via a forecast API call,
// reuse stored drive_minutes. Cheap (1 forecast call, 0 HERE). Returns a
// patched snapshot + the persistence delta.
async function refreshRecommendedOnly(load: Record<string, unknown>, baseSnapshot: LoadSnapshot): Promise<RefreshOutcome | null> {
  const portId = baseSnapshot.recommended_port_id;
  if (!portId) return null;
  const drive = (load.predicted_drive_minutes as number | null) ?? 0;
  const apptStr = load.appointment_at as string | null;
  if (!apptStr) return null;
  const apptMs = new Date(apptStr).getTime();
  if (Number.isNaN(apptMs)) return null;
  const minutesUntil = (apptMs - Date.now()) / 60_000;
  const horizon = minutesUntil < 90 ? 360 : 1440;

  const fc = await forecast(portId, horizon);
  if (isForecastError(fc)) return null;

  const wait = Math.max(0, Math.round(fc.prediction_min));
  const rmse = fc.rmse_min ?? (load.rmse_minutes as number | null) ?? 20;
  const totalEta = drive + wait;
  const arrival = new Date(Date.now() + totalEta * 60_000);
  const slackMin = (apptMs - arrival.getTime()) / 60_000;
  const p = Math.max(0, Math.min(1, normCdf(slackMin / rmse)));
  const grace = (load.detention_grace_hours as number | null) ?? 2;
  const rate = (load.detention_rate_per_hour as number | null) ?? 75;
  const detentionMin = Math.max(0, -slackMin - grace * 60);
  const detentionDollars = Math.round((detentionMin / 60) * rate * 100) / 100;
  const priorEta = (load.predicted_eta_minutes as number | null) ?? null;

  const snapshot: LoadSnapshot = {
    ...baseSnapshot,
    predicted_wait_minutes: wait,
    predicted_eta_minutes: totalEta,
    predicted_arrival_at: arrival.toISOString(),
    p_make_appointment: p,
    detention_risk_dollars: detentionDollars,
    eta_refreshed_at: new Date().toISOString(),
  };
  return {
    snapshot,
    priorEtaMinutes: priorEta,
    currentEtaResult: null,
    persist: {
      predicted_wait_minutes: wait,
      predicted_eta_minutes: totalEta,
      predicted_arrival_at: arrival.toISOString(),
      p_make_appointment: p,
      detention_risk_dollars: detentionDollars,
      prior_predicted_eta_minutes: priorEta,
      eta_refreshed_at: new Date().toISOString(),
    },
  };
}

// Layer (c) — for loads with appointment_at < now+6hr, do a full re-route
// across the bridge pool. drive_cache (24hr TTL) keeps HERE quota safe.
async function refreshFullRoute(load: Record<string, unknown>, baseSnapshot: LoadSnapshot): Promise<RefreshOutcome | null> {
  const destLat = load.dest_lat as number | null;
  const destLng = load.dest_lng as number | null;
  const apptStr = load.appointment_at as string | null;
  if (!destLat || !destLng || !apptStr) return null;

  let eta;
  try {
    eta = await computeLoadEta({
      origin_lat: load.origin_lat as number,
      origin_lng: load.origin_lng as number,
      dest_lat: destLat,
      dest_lng: destLng,
      appointment_at: apptStr,
      detention_rate_per_hour: (load.detention_rate_per_hour as number | undefined),
      detention_grace_hours: (load.detention_grace_hours as number | undefined),
      preferred_port_id: (load.preferred_port_id as string | null) ?? null,
      drive_cache: ((load.drive_cache as DriveCache | null) ?? {}),
    });
  } catch {
    return null;
  }

  const r = eta.recommended;
  const priorEta = (load.predicted_eta_minutes as number | null) ?? null;
  const snapshot: LoadSnapshot = {
    ...baseSnapshot,
    recommended_port_id: r.port_id,
    predicted_wait_minutes: r.predicted_wait_min,
    predicted_eta_minutes: r.total_eta_min,
    predicted_arrival_at: r.predicted_arrival_at,
    p_make_appointment: r.p_make_appointment,
    detention_risk_dollars: r.detention_dollars,
    eta_refreshed_at: new Date().toISOString(),
  };
  return {
    snapshot,
    priorEtaMinutes: priorEta,
    currentEtaResult: eta,
    persist: {
      recommended_port_id: r.port_id,
      predicted_wait_minutes: r.predicted_wait_min,
      predicted_eta_minutes: r.total_eta_min,
      predicted_arrival_at: r.predicted_arrival_at,
      predicted_drive_minutes: r.drive_to_bridge_min + r.drive_to_dock_min,
      rmse_minutes: r.rmse_min,
      p_make_appointment: r.p_make_appointment,
      detention_risk_dollars: r.detention_dollars,
      prior_predicted_eta_minutes: priorEta,
      eta_refreshed_at: new Date().toISOString(),
      drive_cache: eta.drive_cache,
    },
  };
}

async function isAnomalyHigh(db: ReturnType<typeof getServiceClient>, portId: string): Promise<boolean> {
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { data: live } = await db
    .from("wait_time_readings")
    .select("vehicle_wait, recorded_at")
    .eq("port_id", portId)
    .gte("recorded_at", since)
    .order("recorded_at", { ascending: false })
    .limit(1);
  const liveWait = live?.[0]?.vehicle_wait;
  if (typeof liveWait !== "number") return false;

  const now = new Date();
  const dow = now.getDay();
  const hour = now.getHours();
  const ninetyDays = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const { data: hist } = await db
    .from("wait_time_readings")
    .select("vehicle_wait")
    .eq("port_id", portId)
    .eq("day_of_week", dow)
    .eq("hour_of_day", hour)
    .gte("recorded_at", ninetyDays)
    .limit(2000);
  const vals = (hist || []).map((r) => r.vehicle_wait).filter((v): v is number => typeof v === "number");
  if (vals.length < 5) return false;
  const avg = vals.reduce((s, v) => s + v, 0) / vals.length;
  if (avg <= 0) return false;
  return liveWait / avg >= 1.5;
}

async function deliverPush(
  db: ReturnType<typeof getServiceClient>,
  userId: string,
  text: { en: string; es: string },
  loadRef: string,
): Promise<{ delivered: boolean; error?: string }> {
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    return { delivered: false, error: "vapid keys not set" };
  }
  const { data: subs } = await db
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("user_id", userId);
  if (!subs?.length) return { delivered: false, error: "no push subscriptions" };
  let anyDelivered = false;
  let lastErr: string | undefined;
  for (const sub of subs) {
    if (!sub?.endpoint) continue;
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify({
          title: `Cruzar — load ${loadRef}`,
          body: text.es,
          tag: `operator-alert-${loadRef}`,
          url: "/insights/loads",
          requireInteraction: true,
        }),
        { urgency: "high", TTL: 1800 },
      );
      anyDelivered = true;
    } catch (err: unknown) {
      const e = err as { statusCode?: number; message?: string };
      if (e?.statusCode === 410) {
        await db.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
      }
      lastErr = e?.message || String(err);
    }
  }
  return { delivered: anyDelivered, error: anyDelivered ? undefined : lastErr };
}

async function deliverEmail(
  db: ReturnType<typeof getServiceClient>,
  userId: string,
  text: { en: string; es: string },
): Promise<{ delivered: boolean; error?: string }> {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) return { delivered: false, error: "RESEND_API_KEY not set" };
  const { data: u } = await db.auth.admin.getUserById(userId);
  const email = u?.user?.email;
  if (!email) return { delivered: false, error: "user has no email" };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL || "Cruzar Alerts <alerts@cruzar.app>",
        to: email,
        subject: text.en.split(":")[0] + " — Cruzar alert",
        text: `${text.en}\n\n${text.es}\n\n— Cruzar Insights\nManage alerts: https://cruzar.app/insights/loads`,
      }),
    });
    if (!res.ok) return { delivered: false, error: `resend ${res.status}` };
    return { delivered: true };
  } catch (e) {
    return { delivered: false, error: (e as Error).message };
  }
}

export async function GET(req: NextRequest) { return run(req); }
export async function POST(req: NextRequest) { return run(req); }

async function run(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const db = getServiceClient();
  const startedAt = new Date().toISOString();

  const { data: rules, error: rulesErr } = await db
    .from("operator_alert_rules")
    .select("*")
    .eq("active", true)
    .limit(1000);
  if (rulesErr) return NextResponse.json({ error: rulesErr.message }, { status: 500 });

  type Stat = { rule_id: string; load_id: string; fired: boolean; reason: string; delivered: boolean; error?: string };
  const stats: Stat[] = [];

  // Track rules that fired earlier in this same pass. For a global rule
  // (load_id=null) iterating across many loads, we must NOT re-fire the
  // same rule on every load — the local `rule.last_fired_at` is read once
  // from the initial query and never refreshed in-memory, so the cooldown
  // check inside evaluateRule wouldn't catch the just-fired state.
  const firedThisPass = new Set<string>();
  // Refresh-result memo: refresh each load at most once per cron pass, even
  // if multiple rules target it. Layer (b) for >6hr-out, (c) full re-route
  // for <6hr-out. Persisted snapshots get written back at the end.
  const refreshMemo = new Map<string, RefreshOutcome | null>();

  for (const rule of (rules || []) as AlertRule[]) {
    const { data: loads } = rule.load_id
      ? await db.from("tracked_loads").select("*").eq("id", rule.load_id).eq("user_id", rule.user_id).limit(1)
      : await db.from("tracked_loads").select("*").eq("user_id", rule.user_id).in("status", ["tracking", "crossed"]).limit(50);

    for (const ld of loads || []) {
      if (firedThisPass.has(rule.id)) {
        stats.push({ rule_id: rule.id, load_id: ld.id, fired: false, reason: "already_fired_this_pass", delivered: false });
        continue;
      }
      const baseSnapshot: LoadSnapshot = {
        id: ld.id,
        load_ref: ld.load_ref,
        recommended_port_id: ld.recommended_port_id,
        predicted_wait_minutes: ld.predicted_wait_minutes,
        predicted_eta_minutes: ld.predicted_eta_minutes,
        predicted_arrival_at: ld.predicted_arrival_at,
        p_make_appointment: ld.p_make_appointment,
        detention_risk_dollars: ld.detention_risk_dollars,
        eta_refreshed_at: ld.eta_refreshed_at,
      };

      // Refresh once per load (memoized). (c) for urgent loads, (b) otherwise.
      let refreshed: RefreshOutcome | null;
      if (refreshMemo.has(ld.id)) {
        refreshed = refreshMemo.get(ld.id) ?? null;
      } else {
        const apptMs = ld.appointment_at ? new Date(ld.appointment_at).getTime() : NaN;
        const urgent = !Number.isNaN(apptMs) && apptMs - Date.now() < SIX_HOURS_MS && apptMs > Date.now();
        refreshed = urgent
          ? await refreshFullRoute(ld, baseSnapshot)
          : await refreshRecommendedOnly(ld, baseSnapshot);
        refreshMemo.set(ld.id, refreshed);
        if (refreshed) {
          // Persist refreshed snapshot + drive_cache + prior eta back to row.
          await db.from("tracked_loads").update(refreshed.persist).eq("id", ld.id);
        }
      }

      const snapshot = refreshed?.snapshot ?? baseSnapshot;
      const priorEta = refreshed?.priorEtaMinutes ?? null;
      const anomalyHigh = rule.trigger_kind === "anomaly_at_recommended" && snapshot.recommended_port_id
        ? await isAnomalyHigh(db, snapshot.recommended_port_id)
        : false;
      const ev = evaluateRule(rule, snapshot, refreshed?.currentEtaResult ?? null, priorEta, anomalyHigh);
      if (!ev.fired) {
        stats.push({ rule_id: rule.id, load_id: ld.id, fired: false, reason: ev.reason, delivered: false });
        continue;
      }
      const text = renderAlertText(rule, snapshot, ev);
      let outcome: { delivered: boolean; error?: string } = { delivered: true };
      if (rule.channel === "push") outcome = await deliverPush(db, rule.user_id, text, snapshot.load_ref);
      else if (rule.channel === "email") outcome = await deliverEmail(db, rule.user_id, text);
      else if (rule.channel === "sms") outcome = { delivered: false, error: "sms not provisioned (Twilio 10DLC pending)" };
      // 'mcp_log' is delivery-by-presence: dispatch row IS the delivery.

      await db.from("operator_alert_dispatches").insert({
        rule_id: rule.id,
        user_id: rule.user_id,
        load_id: ld.id,
        channel: rule.channel,
        payload: { ...ev.payload, text_en: text.en, text_es: text.es },
        delivered: outcome.delivered,
        delivery_error: outcome.error ?? null,
      });
      await db.from("operator_alert_rules").update({ last_fired_at: new Date().toISOString() }).eq("id", rule.id);
      firedThisPass.add(rule.id);
      stats.push({ rule_id: rule.id, load_id: ld.id, fired: true, reason: ev.reason, delivered: outcome.delivered, error: outcome.error });
    }
  }

  return NextResponse.json({
    started_at: startedAt,
    finished_at: new Date().toISOString(),
    rules_evaluated: rules?.length ?? 0,
    fired: stats.filter((s) => s.fired).length,
    delivered: stats.filter((s) => s.delivered).length,
    stats,
  });
}
