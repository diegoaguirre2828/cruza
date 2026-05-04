import Link from 'next/link';
import { B2BNav } from '@/components/B2BNav';
import { PricingStrip } from '@/components/PricingStrip';
import { EUDAMED_EN } from '@/lib/copy/eudamed-en';
import { EUDAMED_ES } from '@/lib/copy/eudamed-es';

export const metadata = {
  title: 'EU MDR / EUDAMED actor + UDI feed — Cruzar',
  description:
    'EUDAMED is mandatory May 28, 2026. Cruzar captures actor + UDI/Device data during cross-border events for Reynosa medtech maquilas. We prepare; your OEM compliance team submits.',
  alternates: { canonical: 'https://www.cruzar.app/eudamed' },
};

export default async function EudamedLandingPage({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  const params = await searchParams;
  const lang: 'en' | 'es' = params?.lang === 'es' ? 'es' : 'en';
  const c = lang === 'es' ? EUDAMED_ES : EUDAMED_EN;
  const langSuffix = lang === 'es' ? '?lang=es' : '';

  // EUDAMED mandatory date.
  const deadline = new Date('2026-05-28T00:00:00Z');
  const today = new Date();
  const daysUntil = Math.max(0, Math.ceil((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));

  return (
    <div className="dark min-h-screen bg-background text-foreground">
      <B2BNav lang={lang} />

      <section className="border-b border-border">
        <div className="mx-auto max-w-[1180px] px-5 sm:px-8 py-20">
          <div className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-muted-foreground">
            {c.landing.eyebrow}
          </div>
          <h1 className="font-serif text-[clamp(2.2rem,4.6vw,3.8rem)] font-medium text-foreground mt-3 leading-tight">
            {c.landing.title}
          </h1>
          <p className="mt-5 max-w-3xl text-[17px] text-muted-foreground">{c.landing.sub}</p>

          <div className="mt-8 flex flex-wrap items-center gap-6">
            <div className="rounded-xl border border-accent/40 bg-card px-6 py-4">
              <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground/80">
                {c.landing.deadline_label}
              </div>
              <div className="font-mono text-[44px] font-medium text-accent leading-none mt-1">
                {daysUntil}
              </div>
            </div>
            <Link
              href={`/eudamed/scan${langSuffix}`}
              className="rounded-lg bg-foreground px-5 py-3 text-sm font-medium text-background hover:bg-foreground/85"
            >
              {c.landing.primary_cta}
            </Link>
            <a
              href="#how"
              className="rounded-lg border border-border px-5 py-3 text-sm font-medium text-foreground/85 hover:border-foreground hover:text-muted-foreground"
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
              href={`/eudamed/scan${langSuffix}`}
              className="rounded-lg bg-foreground px-5 py-3 text-sm font-medium text-background hover:bg-foreground/85"
            >
              {c.landing.primary_cta}
            </Link>
          </div>
        </div>
      </section>

      <footer className="bg-card">
        <div className="mx-auto max-w-[1180px] px-5 sm:px-8 py-8 space-y-4">
          <p className="max-w-3xl text-[11.5px] leading-[1.6] text-muted-foreground/70">
            {c.shared.legal_disclaimer}
          </p>
          <div className="text-[11.5px] font-mono uppercase tracking-[0.18em] text-muted-foreground/60">
            {c.shared.powered_by}
          </div>
        </div>
      </footer>
    </div>
  );
}
