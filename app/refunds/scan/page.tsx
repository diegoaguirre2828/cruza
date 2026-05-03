import { B2BNav } from '@/components/B2BNav';
import { REFUNDS_EN } from '@/lib/copy/refunds-en';
import { REFUNDS_ES } from '@/lib/copy/refunds-es';
import { ScanClient } from './ScanClient';

export const metadata = {
  title: 'Free IEEPA Refund Scan — Cruzar',
  description:
    'Drop your ACE Entry Summary CSV. Free eligibility scan. No signup required. Recovery estimate in under a minute.',
  alternates: { canonical: 'https://www.cruzar.app/refunds/scan' },
};

export default async function RefundsScanPage({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  const params = await searchParams;
  const lang: 'en' | 'es' = params?.lang === 'es' ? 'es' : 'en';
  const c = lang === 'es' ? REFUNDS_ES : REFUNDS_EN;

  return (
    <div className="min-h-screen bg-[#0a1020] text-slate-100">
      <B2BNav current="refunds" lang={lang} />
      <section className="border-b border-white/[0.07]">
        <div className="mx-auto max-w-[820px] px-5 sm:px-8 py-16">
          <div className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-amber-300">
            {c.scan.eyebrow}
          </div>
          <h1 className="font-serif text-[clamp(1.9rem,3.6vw,2.8rem)] text-white mt-3">
            {c.scan.title}
          </h1>
          <p className="mt-4 text-[16px] text-white/70">{c.scan.sub}</p>
          <div className="mt-10">
            <ScanClient lang={lang} copy={c.scan} />
          </div>
        </div>
      </section>
      <footer className="bg-[#070b18]">
        <div className="mx-auto max-w-[1180px] px-5 sm:px-8 py-8 text-[11.5px] font-mono uppercase tracking-[0.18em] text-white/40">
          {c.shared.powered_by}
        </div>
      </footer>
    </div>
  );
}
