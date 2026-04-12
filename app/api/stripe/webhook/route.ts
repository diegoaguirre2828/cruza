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
    const session = event.data.object as { metadata?: { userId?: string; tier?: string }; subscription?: string; customer?: string }
    const userId = session.metadata?.userId
    const tier = session.metadata?.tier
    if (!userId || !tier) return NextResponse.json({ ok: true })

    // Update user tier
    await supabase.from('profiles').update({ tier }).eq('id', userId)

    // Record subscription
    await supabase.from('subscriptions').upsert({
      user_id: userId,
      stripe_customer_id: session.customer as string,
      stripe_subscription_id: session.subscription as string,
      tier,
      status: 'active',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })
  }

  if (event.type === 'customer.subscription.deleted') {
    const sub = event.data.object as { metadata?: { userId?: string } }
    const userId = sub.metadata?.userId
    if (userId) {
      await supabase.from('profiles').update({ tier: 'free' }).eq('id', userId)
      await supabase.from('subscriptions').update({ status: 'cancelled' }).eq('user_id', userId)
    }
  }

  if (event.type === 'invoice.payment_failed') {
    const invoice = event.data.object as { subscription_details?: { metadata?: { userId?: string } } }
    const userId = invoice.subscription_details?.metadata?.userId
    if (userId) {
      await supabase.from('subscriptions').update({ status: 'past_due' }).eq('user_id', userId)
    }
  }

  return NextResponse.json({ ok: true })
}
