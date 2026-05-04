import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export const runtime = 'nodejs';

const ALLOWED_PRODUCTS = ['borvo', 'fletcher', 'stack', 'ledger', 'laboral_mx'] as const;
type AllowedProduct = typeof ALLOWED_PRODUCTS[number];

async function authedClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  );
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const supabase = await authedClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const body = await req.json() as { product?: string; context?: Record<string, unknown> };
  const { product, context } = body;

  if (!product || !ALLOWED_PRODUCTS.includes(product as AllowedProduct)) {
    return NextResponse.json(
      { error: 'invalid_product', allowed: ALLOWED_PRODUCTS },
      { status: 400 }
    );
  }
  if (!context || typeof context !== 'object') {
    return NextResponse.json({ error: 'context must be an object' }, { status: 400 });
  }

  const svc = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: existing, error: fetchErr } = await svc
    .from('tickets')
    .select('linked_products')
    .eq('ticket_id', id)
    .maybeSingle();

  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  if (!existing) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const merged = {
    ...(existing.linked_products as Record<string, unknown> ?? {}),
    [product]: { ...context, linked_at: new Date().toISOString(), linked_by: user.id },
  };

  const { error: updateErr } = await svc
    .from('tickets')
    .update({ linked_products: merged })
    .eq('ticket_id', id);

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, linked_products: merged });
}
