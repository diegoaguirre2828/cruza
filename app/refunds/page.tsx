import Link from 'next/link';
import { B2BNav } from '@/components/B2BNav';
import { PricingStrip } from '@/components/PricingStrip';
import { REFUNDS_EN } from '@/lib/copy/refunds-en';
import { REFUNDS_ES } from '@/lib/copy/refunds-es';

export const metadata = {
  title: 'IEEPA Refunds — Cruzar',
  description:
    'Recover IEEPA tariff refunds. Free eligibility scan. Platform fee: 8% of refund processed, $99 floor. No fee on rejected or expired filings.',
  alternates: { canonical: 'https://www.cruzar.app/refunds' },
};

export default async function RefundsLandingPage({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  const params = await searchParams;
  const lang: 'en' | 'es' = params?.lang === 'es' ? 'es' : 'en';
  const c = lang === 'es' ? REFUNDS_ES : REFUNDS_EN;
  const langSuffix = lang === 'es' ? '?lang=es' : '';

  return (
    <div className="dark min-h-screen bg-background text-foreground">
      <B2BNav current="refunds" lang={lang} />

      {/* IEEPA URGENCY BANNER */}
      <div className="border-b border-amber-400/30 bg-amber-400/[0.06]">
        <div className="mx-auto max-w-[1180px] px-5 sm:px-8 py-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse shrink-0" />
            <p className="text-[13px] text-amber-200/90 leading-snug">
              {lang === 'es'
                ? 'CAPE activo 20 Abr 2026: la vía rápida Phase 1 de CBP está abierta. Los reembolsos no son automáticos — ventana de 80 días por entrada desde su fecha de protesta. Las entradas dentro de su ventana pueden presentar ahora.'
                : 'CAPE live Apr 20, 2026: CBP\'s Phase 1 fast-lane is open. Refunds are not automatic — 80-day rolling window per entry from its protest date. Entries still inside their window can file now.'}
            </p>
          </div>
          <Link
            href={`/refunds/scan${langSuffix}`}
            className="shrink-0 font-mono text-[11px] uppercase tracking-[0.14em] text-amber-400 hover:text-amber-300 transition"
          >
            {lang === 'es' ? 'Escanea tu ACE →' : 'Scan your ACE →'}
          </Link>
        </div>
      </div>

      <section className="border-b border-border">
        <div className="mx-auto max-w-[1180px] px-5 sm:px-8 py-20">
          <div className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-muted-foreground">
            {c.landing.eyebrow}
          </div>
          <h1 className="font-serif text-[clamp(2.2rem,4.6vw,3.8rem)] font-medium text-foreground mt-3 leading-tight">
            {c.landing.title}
          </h1>
          <p className="mt-5 max-w-3xl text-[17px] text-muted-foreground">{c.landing.sub}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href={`/refunds/scan${langSuffix}`}
              className="bg-foreground px-5 py-3 text-sm font-medium text-background hover:bg-foreground/85 transition"
            >
              {c.landing.primary_cta}
            </Link>
            <a
              href="#how"
              className="border border-border px-5 py-3 text-sm font-medium text-foreground hover:border-foreground transition"
            >
              {c.landing.secondary_cta}
            </a>
          </div>
          <div className="mt-6"><PricingStrip pitch={c.landing.pricing_strip} lang={lang} /></div>
        </div>
      </section>

      <section className="border-b border-border bg-card">
        <div className="mx-auto max-w-[1180px] px-5 sm:px-8 py-16">
          <div className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-muted-foreground">
            {c.landing.border_layer_eyebrow}
          </div>
          <h2 className="font-serif text-[clamp(1.6rem,3vw,2.4rem)] text-foreground mt-3 max-w-3xl">
            {c.landing.border_layer_title}
          </h2>
          <p className="mt-5 max-w-3xl text-[15.5px] leading-[1.7] text-muted-foreground">
            {c.landing.border_layer_body}
          </p>
        </div>
      </section>

      <section id="how" className="border-b border-border">
        <div className="mx-auto max-w-[1180px] px-5 sm:px-8 py-16">
          <div className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-muted-foreground">
            {c.landing.how.eyebrow}
          </div>
          <div className="mt-8 grid gap-6 md:grid-cols-2">
            {[
              { title: c.landing.how.step1_title, body: c.landing.how.step1_body },
              { title: c.landing.how.step2_title, body: c.landing.how.step2_body },
              { title: c.landing.how.step3_title, body: c.landing.how.step3_body },
              { title: c.landing.how.step4_title, body: c.landing.how.step4_body },
            ].map((s, i) => (
              <div
                key={i}
                className="rounded-xl border border-border bg-card p-6"
              >
                <div className="font-serif text-[18px] text-foreground">{s.title}</div>
                <p className="mt-2 text-[14.5px] leading-[1.65] text-muted-foreground">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-border">
        <div className="mx-auto max-w-[1180px] px-5 sm:px-8 py-16">
          <div className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-muted-foreground">
            {c.landing.pricing.eyebrow}
          </div>
          <ul className="mt-6 max-w-2xl space-y-2 text-[15px] text-foreground/75">
            <li>· {c.landing.pricing.rate}</li>
            <li>· {c.landing.pricing.floor}</li>
            <li>· {c.landing.pricing.no_fee}</li>
            <li className="pt-2 text-accent">· {c.landing.pricing.no_retainer}</li>
          </ul>
          <div className="mt-8">
            <Link
              href={`/refunds/scan${langSuffix}`}
              className="bg-foreground px-5 py-3 text-sm font-medium text-background hover:bg-foreground/85 transition"
            >
              {c.landing.primary_cta}
            </Link>
          </div>
        </div>
      </section>

      <footer className="bg-card">
        <div className="mx-auto max-w-[1180px] px-5 sm:px-8 py-8 space-y-4">
          <p className="max-w-3xl text-[11.5px] leading-[1.6] text-foreground/45">
            {c.shared.legal_disclaimer}
          </p>
          <div className="text-[11.5px] font-mono uppercase tracking-[0.18em] text-foreground/40">
            {c.shared.powered_by}
          </div>
        </div>
      </footer>
    </div>
  );
}
