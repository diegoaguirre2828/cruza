import { B2BNav } from '@/components/B2BNav';
import { CalibrationScoreboard } from '@/components/CalibrationScoreboard';
import { B2B_EN } from '@/lib/copy/b2b-en';
import { B2B_ES } from '@/lib/copy/b2b-es';

export const metadata = {
  title: 'Cruzar — Will this load cross clean and make the appointment?',
  description:
    'Crossing intelligence, compliance, IEEPA refund recovery, and receiver tracking for US-MX freight brokers, dispatchers, and fleets. One answer per shipment.',
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
  const c = lang === 'es' ? B2B_ES : B2B_EN;
  const es = lang === 'es';

  return (
    <div className="dark min-h-screen bg-background text-foreground">
      <B2BNav lang={lang} />

      {/* HERO */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-[1180px] px-5 sm:px-8 py-20 sm:py-28">
          <div className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-accent ws-d0">
            {c.hero.eyebrow}
          </div>
          <h1 className="ws-d1 mt-5 font-serif text-[clamp(2.6rem,5vw,4.2rem)] font-medium leading-[1.02] text-foreground tracking-[-0.02em] max-w-3xl">
            {c.hero.title}
          </h1>
          <p className="ws-d2 mt-7 max-w-xl text-[15px] leading-[1.7] text-muted-foreground">
            {c.hero.sub}
          </p>
          <div className="ws-d3 mt-9 flex flex-wrap items-center gap-4">
            <a
              href={`/b2b/start${es ? '?lang=es' : ''}`}
              className="inline-flex items-center gap-3 bg-foreground px-6 py-3.5 text-[14px] font-semibold text-background hover:bg-foreground/90 transition"
            >
              <span>{c.hero.cta}</span>
              <span aria-hidden>→</span>
            </a>
            <a
              href="/insights/accuracy"
              className="text-[14px] text-muted-foreground hover:text-foreground transition"
            >
              {c.hero.ctaSub}
            </a>
          </div>
        </div>
      </section>

      {/* LIVE ACCURACY — real calibration_log data */}
      <section className="border-b border-border bg-card/20">
        <div className="mx-auto max-w-[1180px] px-5 sm:px-8 py-14">
          <div className="mb-8">
            <div className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-accent">
              {c.accuracy.kicker}
            </div>
            <h2 className="font-serif text-[clamp(1.85rem,3.4vw,2.85rem)] font-medium text-foreground mt-2">
              {c.accuracy.title}
            </h2>
            <p className="mt-3 max-w-2xl text-[15px] text-muted-foreground">{c.accuracy.sub}</p>
          </div>
          <CalibrationScoreboard lang={lang} />
          <div className="mt-4 text-[13px]">
            <a
              href="/insights/accuracy"
              className="text-accent hover:text-accent/80 underline decoration-accent/40 transition"
            >
              {es ? 'Ver backtest completo →' : 'See full backtest →'}
            </a>
          </div>
        </div>
      </section>

      {/* FOUR LAYERS */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-[1180px] px-5 sm:px-8 py-14">
          <div className="mb-10">
            <div className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-accent">
              {c.layers.kicker}
            </div>
            <h2 className="font-serif text-[clamp(1.85rem,3.4vw,2.85rem)] font-medium text-foreground mt-2">
              {c.layers.title}
            </h2>
            <p className="mt-3 text-[14px] text-muted-foreground">{c.layers.sub}</p>
          </div>
          <div className="grid gap-px overflow-hidden border border-border bg-border sm:grid-cols-2">
            {c.layers.items.map((s) => (
              <div key={s.n} className="bg-background p-7">
                <div className="flex items-center gap-3 mb-4">
                  <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-accent">{s.n}</span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground/60 border border-border/60 px-2 py-0.5">{s.label}</span>
                </div>
                <h3 className="font-serif text-[1.3rem] font-medium leading-[1.2] text-foreground">
                  {s.title}
                </h3>
                <p className="mt-3 text-[13.5px] leading-[1.6] text-muted-foreground">{s.body}</p>
              </div>
            ))}
          </div>
          <div className="mt-6 border border-border/60 bg-card/20 px-6 py-4">
            <div className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-accent mb-1">Cruzar Ticket</div>
            <p className="text-[13.5px] text-muted-foreground leading-[1.6]">
              {es
                ? 'Cada módulo escribe en un registro firmado y público. El broker lo comparte con el receptor. El receptor lo comparte con su cliente. Un URL. Toda la cadena.'
                : 'Every module writes into one signed, public record. The broker shares it with the receiver. The receiver shares it with their customer. One URL. The whole chain.'}
            </p>
          </div>
        </div>
      </section>

      {/* DETENTION MATH */}
      <section className="border-b border-border bg-card/20">
        <div className="mx-auto max-w-[1180px] px-5 sm:px-8 py-14">
          <div className="border border-border bg-card/30 p-7 sm:p-9">
            <h3 className="font-serif text-[1.6rem] font-medium text-foreground">
              {c.detentionMath.title}
            </h3>
            <p className="mt-4 text-[15px] leading-[1.7] text-foreground/90 max-w-3xl">
              {c.detentionMath.body}
            </p>
            <p className="mt-4 text-[12px] text-muted-foreground/60 leading-snug max-w-2xl">
              {c.detentionMath.footnote}
            </p>
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-[1180px] px-5 sm:px-8 py-14">
          <div className="mb-10">
            <div className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-accent">
              {c.pricing.kicker}
            </div>
            <h2 className="font-serif text-[clamp(1.85rem,3.4vw,2.85rem)] font-medium text-foreground mt-2">
              {c.pricing.title}
            </h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {[c.pricing.starter, c.pricing.pro, c.pricing.fleet].map((p) => (
              <div key={p.tier} className="border border-border bg-card/30 p-6">
                <div className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-accent">
                  {p.tier}
                </div>
                <div className="font-serif text-[28px] text-foreground mt-2">{p.price}</div>
                <p className="mt-2 text-[13px] text-muted-foreground">{p.summary}</p>
              </div>
            ))}
          </div>
          <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3">
            <a
              href={`/b2b/start${es ? '?lang=es' : ''}`}
              className="inline-flex items-center gap-3 bg-foreground px-6 py-3.5 text-[14px] font-semibold text-background hover:bg-foreground/90 transition"
            >
              <span>{c.hero.cta}</span>
              <span aria-hidden>→</span>
            </a>
            <a
              href="mailto:diegonaguirre@icloud.com?subject=Cruzar%20Insights%20trial"
              className="text-[14px] text-muted-foreground hover:text-foreground transition"
            >
              {es ? 'Hablar con ventas →' : 'Talk to sales →'}
            </a>
          </div>
        </div>
      </section>

      <footer className="bg-card border-t border-border">
        <div className="mx-auto max-w-[1180px] px-5 sm:px-8 py-10 text-[12px] text-muted-foreground/50">
          {c.notAffiliated} ·{' '}
          <a href="?lang=en" className="hover:text-foreground transition">EN</a>{' '}
          ·{' '}
          <a href="?lang=es" className="hover:text-foreground transition">ES</a>
        </div>
      </footer>
    </div>
  );
}
