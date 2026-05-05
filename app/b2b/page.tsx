import { B2BPortalClient } from '@/components/B2BPortalClient';

export const metadata = {
  title: 'Cruzar — Will this load cross clean and make the appointment?',
  description:
    'Crossing intelligence, compliance, IEEPA refund recovery, and receiver tracking for US-MX freight brokers, dispatchers, and fleets.',
  alternates: { canonical: 'https://www.cruzar.app/b2b' },
};

export const dynamic = 'force-dynamic';

export default async function B2BPortalPage({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  const params = await searchParams;
  const lang: 'en' | 'es' = params?.lang === 'es' ? 'es' : 'en';
  return <B2BPortalClient lang={lang} />;
}
