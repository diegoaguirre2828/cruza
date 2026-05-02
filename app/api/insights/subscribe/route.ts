import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getStripe } from '@/lib/stripe';
import { TIER_LIMITS, getStripePriceIdForTier, type InsightsTier } from '@/lib/insights/stripe-tiers';

export const runtime = 'nodejs';

interface SubscribeBody {
  tier: InsightsTier;
  watched_port_ids: string[];
  briefing_local_hour: number;
  briefing_tz: string;
  language: 'en' | 'es';
  channel_email: boolean;
  channel_sms: boolean;
  channel_whatsapp: boolean;
  recipient_emails: string[];
  recipient_phones: string[];
}

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const body = (await req.json()) as SubscribeBody;
  const limits = TIER_LIMITS[body.tier];
  if (!limits) return NextResponse.json({ error: 'invalid_tier' }, { status: 400 });

  if (body.watched_port_ids.length > limits.maxWatchedPorts) {
    return NextResponse.json({ error: `tier_${body.tier}_max_${limits.maxWatchedPorts}_ports` }, { status: 400 });
  }

  if (body.tier === 'free') {
    const { data, error } = await supabase
      .from('insights_subscribers')
      .upsert({
        user_id: user.id,
        tier: 'free',
        status: 'active',
        watched_port_ids: body.watched_port_ids.slice(0, 1),
        briefing_local_hour: body.briefing_local_hour,
        briefing_tz: body.briefing_tz,
        language: body.language,
        channel_email: true,
        channel_sms: false,
        channel_whatsapp: false,
        recipient_emails: body.recipient_emails.slice(0, 1),
        recipient_phones: [],
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })
      .select('id')
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ subscriber_id: data.id, checkout_url: null });
  }

  const priceId = getStripePriceIdForTier(body.tier);
  if (!priceId) {
    return NextResponse.json({ error: 'price_id_not_configured' }, { status: 500 });
  }

  const { data: subRow, error: subErr } = await supabase
    .from('insights_subscribers')
    .upsert({
      user_id: user.id,
      tier: body.tier,
      status: 'trialing',
      watched_port_ids: body.watched_port_ids,
      briefing_local_hour: body.briefing_local_hour,
      briefing_tz: body.briefing_tz,
      language: body.language,
      channel_email: body.channel_email,
      channel_sms: body.channel_sms,
      channel_whatsapp: body.channel_whatsapp,
      recipient_emails: body.recipient_emails,
      recipient_phones: body.recipient_phones,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })
    .select('id')
    .single();
  if (subErr) return NextResponse.json({ error: subErr.message }, { status: 500 });

  const stripe = getStripe();
  const origin = req.headers.get('origin') ?? 'https://cruzar.app';

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${origin}/dispatch?subscribed=1`,
    cancel_url: `${origin}/insights?cancelled=1`,
    customer_email: user.email ?? undefined,
    metadata: {
      userId: user.id,
      tier: `insights_${body.tier}`,
      insights_subscriber_id: String(subRow.id),
    },
    subscription_data: {
      metadata: {
        userId: user.id,
        tier: `insights_${body.tier}`,
        insights_subscriber_id: String(subRow.id),
      },
    },
  });

  return NextResponse.json({ subscriber_id: subRow.id, checkout_url: session.url });
}
