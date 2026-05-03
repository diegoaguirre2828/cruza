import { NextRequest, NextResponse } from 'next/server';
import webpush from 'web-push';
import { runAnomalyBroadcast, type PushPayload } from '@/lib/insights/anomaly-broadcast';
import { getServiceClient } from '@/lib/supabase';

export const runtime = 'nodejs';
export const maxDuration = 60;

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    'mailto:cruzabusiness@gmail.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  );
}

function authed(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const url = new URL(req.url);
  const q = url.searchParams.get('secret');
  if (q && q === secret) return true;
  const auth = req.headers.get('authorization');
  if (auth === `Bearer ${secret}`) return true;
  return false;
}

async function sendEmail(to: string, subject: string, body: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) return false;
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL ?? 'Cruzar Alerts <alerts@cruzar.app>',
        to,
        subject,
        text: body,
      }),
    });
    return res.ok;
  } catch (err) {
    console.error('insights-anomaly email fail', err);
    return false;
  }
}

async function sendPush(userId: string, payload: PushPayload): Promise<boolean> {
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return false;
  const db = getServiceClient();
  const { data: subs } = await db
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('user_id', userId);
  if (!subs?.length) return false;
  let anyDelivered = false;
  for (const sub of subs) {
    if (!sub?.endpoint) continue;
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify({
          title: payload.title,
          body: payload.body,
          tag: payload.tag,
          url: payload.url,
          requireInteraction: true,
        }),
        { urgency: 'high', TTL: 1800 },
      );
      anyDelivered = true;
    } catch (err: unknown) {
      const e = err as { statusCode?: number; message?: string };
      if (e?.statusCode === 410) {
        await db.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
      }
      console.error('insights-anomaly push fail', { userId, err: e?.message ?? String(err) });
    }
  }
  return anyDelivered;
}

async function sendSms(to: string, body: string): Promise<boolean> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_PHONE_NUMBER;
  if (!sid || !token || !from) return false;
  try {
    const auth = Buffer.from(`${sid}:${token}`).toString('base64');
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ To: to, From: from, Body: body }).toString(),
    });
    return res.ok;
  } catch (err) {
    console.error('insights-anomaly sms fail', err);
    return false;
  }
}

export async function POST(req: NextRequest) { return GET(req); }

export async function GET(req: NextRequest) {
  if (!authed(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const dryRun = new URL(req.url).searchParams.get('dryRun') === '1';

  const result = await runAnomalyBroadcast({
    dryRun,
    sendEmail,
    sendSms,
    sendPush,
  });

  return NextResponse.json({ ...result, dryRun });
}
