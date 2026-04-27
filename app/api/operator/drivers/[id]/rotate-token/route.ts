// Rotate the checkin_token on an operator-owned driver.
//
// Driver checkin tokens live in URL query strings (/api/operator/checkin?token=…
// + /driver-app/<token>) by design — drivers don't have accounts and click a
// share link from whatever channel the dispatcher uses. That puts the token in
// access logs, browser history, and any chat where the link was pasted.
//
// Permanent tokens are the wrong default for that surface. Auto-rotation
// breaks driver flow (link in their phone suddenly stops working). The middle
// path: operator-triggered rotation on demand. Operator clicks "Rotate" when
// they think a token has been over-shared, gets a fresh hex token back, and
// re-shares the new link with the driver.

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const cookieStore = await cookies();
  const sb = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } },
  );
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const newToken = randomBytes(16).toString("hex");

  const { data, error } = await sb
    .from("operator_drivers")
    .update({ checkin_token: newToken })
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id, checkin_token")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ ok: true, driver: data });
}
