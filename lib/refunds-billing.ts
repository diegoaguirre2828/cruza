// lib/refunds-billing.ts
// Bills Cruzar fee on confirmed refund recovery.
// Uses Stripe Invoice API (not off-session PaymentIntent) so first-time payers
// get a hosted payment link instead of a silent failure.

import { getStripe } from './stripe';
import { calculateCruzarFee } from './chassis/refunds/fee-calculator';
import { getServiceClient } from './supabase';

export interface BillingResult {
  invoice_id: string | null;
  hosted_invoice_url: string | null;
  fee_usd: number;
  status: 'free_no_recovery' | 'invoice_sent' | 'invoice_paid_immediate' | 'no_email_skipped' | 'stripe_disabled';
}

async function findOrCreateCustomer(email: string, userId: string): Promise<string> {
  const stripe = getStripe();
  const search = await stripe.customers.search({
    query: `email:'${email.replace(/'/g, '')}' AND metadata['source']:'cruzar_refunds'`,
    limit: 1,
  });
  if (search.data.length > 0) return search.data[0].id;
  const customer = await stripe.customers.create({
    email,
    metadata: { user_id: userId, source: 'cruzar_refunds' },
  });
  return customer.id;
}

export async function chargeForRefund(
  userId: string,
  claimId: number,
  refundReceivedUsd: number,
): Promise<BillingResult> {
  const feeUsd = calculateCruzarFee(refundReceivedUsd);
  if (feeUsd === 0) {
    return { invoice_id: null, hosted_invoice_url: null, fee_usd: 0, status: 'free_no_recovery' };
  }
  if (!process.env.STRIPE_SECRET_KEY) {
    return { invoice_id: null, hosted_invoice_url: null, fee_usd: feeUsd, status: 'stripe_disabled' };
  }

  const sb = getServiceClient();
  const { data: profile } = await sb.auth.admin.getUserById(userId);
  const email = profile?.user?.email;
  if (!email) {
    return { invoice_id: null, hosted_invoice_url: null, fee_usd: feeUsd, status: 'no_email_skipped' };
  }

  const stripe = getStripe();
  const customerId = await findOrCreateCustomer(email, userId);

  await stripe.invoiceItems.create({
    customer: customerId,
    amount: Math.round(feeUsd * 100),
    currency: 'usd',
    description: `Cruzar IEEPA refund composer fee (claim #${claimId}) — sliding-scale on $${refundReceivedUsd.toFixed(2)} confirmed recovery`,
    metadata: { claim_id: String(claimId), user_id: userId, recovery_usd: String(refundReceivedUsd) },
  });

  const invoice = await stripe.invoices.create({
    customer: customerId,
    collection_method: 'send_invoice',
    days_until_due: 14,
    auto_advance: true,
    metadata: { claim_id: String(claimId), user_id: userId, source: 'cruzar_refunds' },
  });

  if (!invoice.id) {
    return { invoice_id: null, hosted_invoice_url: null, fee_usd: feeUsd, status: 'stripe_disabled' };
  }

  const finalized = await stripe.invoices.finalizeInvoice(invoice.id);
  try {
    if (finalized.id) await stripe.invoices.sendInvoice(finalized.id);
  } catch {
    // sendInvoice can throw if the invoice was already auto-sent by auto_advance — fine.
  }

  return {
    invoice_id: finalized.id ?? null,
    hosted_invoice_url: finalized.hosted_invoice_url ?? null,
    fee_usd: feeUsd,
    status: finalized.status === 'paid' ? 'invoice_paid_immediate' : 'invoice_sent',
  };
}
