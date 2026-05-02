import { NextRequest, NextResponse } from 'next/server'
import { getStripe } from '@/lib/stripe'
import { getServiceClient } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim()
  if (!webhookSecret) {
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 })
  }

  const body = await req.text()
  const sig = req.headers.get('stripe-signature')
  if (!sig) return NextResponse.json({ error: 'Missing signature' }, { status: 400 })

  const stripe = getStripe()

  let event
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret)
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const supabase = getServiceClient()

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as { id?: string; metadata?: { userId?: string; tier?: string; insights_subscriber_id?: string }; subscription?: string; customer?: string }
    const userId = session.metadata?.userId
    const tier = session.metadata?.tier
    if (!userId || !tier) {
      console.error('stripe webhook: checkout.session.completed missing metadata', {
        sessionId: session.id,
        hasUserId: !!userId,
        hasTier: !!tier,
      })
      return NextResponse.json({ error: 'missing metadata' }, { status: 400 })
    }

    // Insights B2B subscribers — separate table, not the consumer profile.
    if (tier.startsWith('insights_')) {
      const insightsTier = tier.replace('insights_', '') as 'starter' | 'pro' | 'fleet';
      const subscriberId = session.metadata?.insights_subscriber_id;
      if (!subscriberId) {
        console.error('insights checkout.session.completed missing insights_subscriber_id', { sessionId: session.id });
        return NextResponse.json({ error: 'missing insights_subscriber_id' }, { status: 400 });
      }
      await supabase
        .from('insights_subscribers')
        .update({
          stripe_customer_id: session.customer as string,
          stripe_subscription_id: session.subscription as string,
          tier: insightsTier,
          status: 'active',
          updated_at: new Date().toISOString(),
        })
        .eq('id', Number(subscriberId));
    } else if (tier === 'express_cert') {
      // Express Cert is a one-time payment, not a tier upgrade — flip
      // the application to 'paid' so the dashboard can let the user
      // generate the PDF.
      await supabase
        .from('express_cert_applications')
        .update({ status: 'paid', paid_at: new Date().toISOString(), stripe_session_id: session.id ?? null })
        .eq('user_id', userId)
        .eq('status', 'draft')
    } else {
      // Recurring tiers (pro / business / operator / intelligence) bump the profile tier
      await supabase.from('profiles').update({ tier }).eq('id', userId)
      await supabase.from('subscriptions').upsert({
        user_id: userId,
        stripe_customer_id: session.customer as string,
        stripe_subscription_id: session.subscription as string,
        tier,
        status: 'active',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })

      // Intelligence tier also creates an intel_subscriber row so the
      // brief-send + alerts crons know where to deliver. Enterprise
      // gets the 'enterprise' tier for SLA + analyst access logic.
      if (tier === 'intelligence' || tier === 'intelligence_enterprise') {
        const { data: u } = await supabase.auth.admin.getUserById(userId)
        if (u?.user?.email) {
          await supabase.from('intel_subscribers').upsert({
            email: u.user.email,
            user_id: userId,
            tier: tier === 'intelligence_enterprise' ? 'enterprise' : 'pro',
            stripe_subscription_id: session.subscription as string,
            active: true,
          }, { onConflict: 'email' })
        }
      }
    }
  }

  if (event.type === 'customer.subscription.deleted') {
    const sub = event.data.object as { id?: string; metadata?: { userId?: string; tier?: string } }
    const userId = sub.metadata?.userId
    const tierMeta = sub.metadata?.tier
    if (tierMeta?.startsWith('insights_') && sub.id) {
      await supabase.from('insights_subscribers').update({
        status: 'canceled',
        updated_at: new Date().toISOString(),
      }).eq('stripe_subscription_id', sub.id)
    } else if (userId) {
      await supabase.from('profiles').update({ tier: 'free' }).eq('id', userId)
      await supabase.from('subscriptions').update({ status: 'cancelled' }).eq('user_id', userId)
    }
  }

  if (event.type === 'invoice.payment_failed') {
    const invoice = event.data.object as { subscription?: string; subscription_details?: { metadata?: { userId?: string; tier?: string } } }
    const userId = invoice.subscription_details?.metadata?.userId
    const tierMeta = invoice.subscription_details?.metadata?.tier
    if (tierMeta?.startsWith('insights_') && invoice.subscription) {
      await supabase.from('insights_subscribers').update({
        status: 'past_due',
        updated_at: new Date().toISOString(),
      }).eq('stripe_subscription_id', invoice.subscription)
    } else if (userId) {
      await supabase.from('subscriptions').update({ status: 'past_due' }).eq('user_id', userId)
    }
  }

  return NextResponse.json({ ok: true })
}
