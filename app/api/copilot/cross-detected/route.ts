// Pillar 2 Co-Pilot — auto-broadcast on cross detection.
// Writes a family_eta_pings row marked 'arrived' (so circle members see
// the post-cross status) and fires push to circle members who have a
// push subscription.

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getServiceClient } from "@/lib/supabase";
import webpush from "web-push";
import { z } from "zod";
import { sendTemplate } from "@/lib/whatsapp";
import { getPortMeta } from "@/lib/portMeta";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    "mailto:cruzabusiness@gmail.com",
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  );
}

const Schema = z.object({
  lat: z.number().optional(),
  lng: z.number().optional(),
  port_id: z.string().optional(),
  circle_id: z.string().uuid().nullable().optional(),
});

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const sb = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } },
  );
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = Schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "validation failed" }, { status: 400 });

  const db = getServiceClient();
  const circleId = parsed.data.circle_id ?? null;
  const now = new Date().toISOString();

  if (!circleId) {
    return NextResponse.json({ ok: true, ping: null, note: "no circle_id, no broadcast" });
  }

  const { data: ping, error } = await db
    .from("family_eta_pings")
    .insert({
      user_id: user.id,
      circle_id: circleId,
      port_id: parsed.data.port_id,
      predicted_arrival_at: now,
      actual_arrival_at: now,
      origin_lat: parsed.data.lat,
      origin_lng: parsed.data.lng,
      status: "arrived",
      message_es: `Crucé en ${parsed.data.port_id ?? "puente"}.`,
      message_en: `I crossed at ${parsed.data.port_id ?? "the bridge"}.`,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Resolve the crossing port to a human label for the message bodies. Falls
  // back gracefully when port_id is missing or unmapped.
  const portMeta = parsed.data.port_id ? getPortMeta(parsed.data.port_id) : null;
  const portLabel = portMeta?.localName || portMeta?.city || (parsed.data.port_id ?? "el puente");

  // Sender's display name — used in the WhatsApp template parameter so the
  // recipient sees who crossed. Falls back to "Tu familiar" / "Your family" if
  // the profile has no name.
  const { data: senderProfile } = await db
    .from("profiles")
    .select("display_name, full_name")
    .eq("id", user.id)
    .maybeSingle();
  const senderName = (senderProfile?.display_name as string | null)
    || (senderProfile?.full_name as string | null)
    || "Tu familiar";

  // Resolve the circle members ONCE; both push + whatsapp loops below reuse it.
  const { data: members } = await db
    .from("circle_members")
    .select("user_id")
    .eq("circle_id", circleId);
  const memberIds = (members ?? []).map((m) => m.user_id).filter((id) => id !== user.id);

  // Push to other circle members
  let delivered = 0;
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && memberIds.length > 0) {
    const { data: subs } = await db
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth, user_id")
      .in("user_id", memberIds);
    for (const sub of subs ?? []) {
      if (!sub?.endpoint) continue;
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify({
            title: "Cruzar — cruce reportado",
            body: `${senderName} cruzó en ${portLabel}.`,
            tag: `family-cross-${ping.id}`,
            url: "/circle",
          }),
          { urgency: "normal", TTL: 3600 },
        );
        delivered++;
      } catch (err) {
        const e = err as { statusCode?: number };
        if (e?.statusCode === 410) {
          await db.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
        }
      }
    }
  }

  // WhatsApp broadcast — only members who have opted in + provided a phone.
  // sendTemplate() no-ops gracefully when WHATSAPP_ACCESS_TOKEN is missing
  // (every attempt logs to whatsapp_messages with status='failed' for audit).
  // Once Meta verification + env vars land, this lights up without further code.
  let whatsapp_delivered = 0;
  if (memberIds.length > 0) {
    const { data: optInRows } = await db
      .from("profiles")
      .select("id, whatsapp_optin, whatsapp_phone_e164, whatsapp_template_lang")
      .in("id", memberIds)
      .eq("whatsapp_optin", true)
      .not("whatsapp_phone_e164", "is", null);
    for (const row of optInRows ?? []) {
      const phone = row.whatsapp_phone_e164 as string | null;
      if (!phone) continue;
      const lang = (row.whatsapp_template_lang as "es" | "en" | null) ?? "es";
      const result = await sendTemplate({
        user_id: row.id as string,
        to_phone_e164: phone,
        // Templates must be pre-approved in Meta Business Manager. Names
        // chosen here MUST match the approved templates — see
        // docs/whatsapp-business-setup.md Phase 3 for the exact body text.
        template_name: lang === "en" ? "cruzar_arrival_en" : "cruzar_arrival_es",
        template_lang: lang,
        components: [
          {
            type: "body",
            parameters: [
              { type: "text", text: senderName },
              { type: "text", text: portLabel },
            ],
          },
        ],
      });
      if (result.sent) whatsapp_delivered++;
    }
  }

  // Also notify the SENDER themselves on WhatsApp if they opted in (separate
  // from the circle path — this is the "confirm I crossed" receipt).
  let whatsapp_self_sent = false;
  {
    const { data: senderRow } = await db
      .from("profiles")
      .select("whatsapp_optin, whatsapp_phone_e164, whatsapp_template_lang")
      .eq("id", user.id)
      .maybeSingle();
    const phone = (senderRow?.whatsapp_phone_e164 as string | null) ?? null;
    if (senderRow?.whatsapp_optin && phone) {
      const lang = (senderRow.whatsapp_template_lang as "es" | "en" | null) ?? "es";
      const result = await sendTemplate({
        user_id: user.id,
        to_phone_e164: phone,
        template_name: lang === "en" ? "cruzar_arrival_en" : "cruzar_arrival_es",
        template_lang: lang,
        components: [
          {
            type: "body",
            parameters: [
              { type: "text", text: senderName },
              { type: "text", text: portLabel },
            ],
          },
        ],
      });
      whatsapp_self_sent = result.sent;
    }
  }

  return NextResponse.json({ ok: true, ping, delivered, whatsapp_delivered, whatsapp_self_sent });
}
