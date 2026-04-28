// POST /api/admin/calibration/observe
//
// Admin-only mark-observed endpoint. Updates a calibration_log row with
// the observed real-world outcome + a scalar loss for fast querying.
// Closes the predicted→observed loop so the moat compounds.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getServiceClient } from "@/lib/supabase";

const ADMIN_EMAIL = "cruzabusiness@gmail.com";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Schema = z.object({
  id: z.number().int().positive(),
  observed: z.record(z.string(), z.unknown()),
  loss: z.number().optional(),
});

export async function POST(req: NextRequest) {
  // Admin gate via cookies-backed user client.
  const cookieStore = await cookies();
  const userClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {},
      },
    },
  );
  const {
    data: { user },
  } = await userClient.auth.getUser();
  if (!user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_input", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const sb = getServiceClient();
  const { data, error } = await sb
    .from("calibration_log")
    .update({
      observed: parsed.data.observed,
      observed_at: new Date().toISOString(),
      loss: parsed.data.loss ?? null,
    })
    .eq("id", parsed.data.id)
    .select("id, observed, observed_at, loss")
    .single();

  if (error) {
    return NextResponse.json({ error: "update_failed", detail: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, row: data });
}
