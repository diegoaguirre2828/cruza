import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export const runtime = 'nodejs';

async function authedClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  );
}

interface OnboardBody {
  commodity_type?: string;
  watched_ports?: string[];
}

export async function POST(req: NextRequest) {
  const supabase = await authedClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const body = (await req.json()) as OnboardBody;
  const { commodity_type, watched_ports } = body;

  const { error } = await supabase
    .from('profiles')
    .update({
      b2b_commodity_type: commodity_type ?? null,
      b2b_watched_ports: watched_ports ?? [],
      b2b_onboarded_at: new Date().toISOString(),
    })
    .eq('id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
