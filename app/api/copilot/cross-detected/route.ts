// Co-Pilot cross detection — circles broadcast killed 2026-05-02 per
// Diego: "kill the circle feature completely." Family ETA pings table
// dropped in v74. WhatsApp self-receipt path retained so the user
// still gets the "you crossed" confirmation if they opted in.

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getServiceClient } from "@/lib/supabase";
import { z } from "zod";
import { sendTemplate } from "@/lib/whatsapp";
import { getPortMeta } from "@/lib/portMeta";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Schema = z.object({
  lat: z.number().optional(),
  lng: z.number().optional(),
  port_id: z.string().optional(),
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

  const portMeta = parsed.data.port_id ? getPortMeta(parsed.data.port_id) : null;
  const portLabel = portMeta?.localName || portMeta?.city || (parsed.data.port_id ?? "el puente");

  const { data: senderProfile } = await db
    .from("profiles")
    .select("display_name, full_name, whatsapp_optin, whatsapp_phone_e164, whatsapp_template_lang")
    .eq("id", user.id)
    .maybeSingle();
  const senderName = (senderProfile?.display_name as string | null)
    || (senderProfile?.full_name as string | null)
    || "Tú";

  let whatsapp_self_sent = false;
  const phone = (senderProfile?.whatsapp_phone_e164 as string | null) ?? null;
  if (senderProfile?.whatsapp_optin && phone) {
    const lang = (senderProfile.whatsapp_template_lang as "es" | "en" | null) ?? "es";
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

  return NextResponse.json({ ok: true, whatsapp_self_sent });
}
