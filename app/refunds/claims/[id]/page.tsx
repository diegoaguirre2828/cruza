import { B2BNav } from '@/components/B2BNav';
import { REFUNDS_EN } from '@/lib/copy/refunds-en';
import { REFUNDS_ES } from '@/lib/copy/refunds-es';
import { ClaimDetailClient } from './ClaimDetailClient';

export const metadata = {
  title: 'Refund Claim — Cruzar',
};

export default async function RefundsClaimDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ lang?: string }>;
}) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const lang: 'en' | 'es' = sp?.lang === 'es' ? 'es' : 'en';
  const c = lang === 'es' ? REFUNDS_ES : REFUNDS_EN;

  return (
    <div className="min-h-screen bg-[#0a1020] text-slate-100">
      <B2BNav current="refunds" lang={lang} />
      <section className="border-b border-white/[0.07]">
        <div className="mx-auto max-w-[1180px] px-5 sm:px-8 py-12">
          <ClaimDetailClient
            claimId={Number(id)}
            lang={lang}
            detailCopy={c.detail}
            claimsCopy={c.claims}
          />
        </div>
      </section>
      <footer className="bg-[#070b18]">
        <div className="mx-auto max-w-[1180px] px-5 sm:px-8 py-8 space-y-4">
          <p className="max-w-3xl text-[11.5px] leading-[1.6] text-white/45">
            {c.shared.legal_disclaimer}
          </p>
          <div className="text-[11.5px] font-mono uppercase tracking-[0.18em] text-white/40">
            {c.shared.powered_by}
          </div>
        </div>
      </footer>
    </div>
  );
}
