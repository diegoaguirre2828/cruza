import { B2BNav } from '@/components/B2BNav';
import { REFUNDS_EN } from '@/lib/copy/refunds-en';
import { REFUNDS_ES } from '@/lib/copy/refunds-es';
import { SetupClient } from './SetupClient';

export const metadata = {
  title: 'ACE / ACH Onboarding — Cruzar Refunds',
  description:
    'Set up the ACE Portal account + ACH enrollment so CBP can pay you the IEEPA refund. 4 guided steps, status tracked.',
};

export default async function RefundsSetupPage({
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
            {c.setup.eyebrow}
          </div>
          <h1 className="font-serif text-[clamp(1.9rem,3.6vw,2.8rem)] text-white mt-3">
            {c.setup.title}
          </h1>
          <p className="mt-4 text-[16px] text-white/70">{c.setup.sub}</p>
          <div className="mt-10">
            <SetupClient lang={lang} copy={c.setup} />
          </div>
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
