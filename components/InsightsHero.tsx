import { INSIGHTS_EN } from '@/lib/copy/insights-en';
import { INSIGHTS_ES } from '@/lib/copy/insights-es';

export function InsightsHero({
  lang = 'en',
  decisionGradeCount,
  medianLift,
}: {
  lang?: 'en' | 'es';
  decisionGradeCount: number;
  medianLift: number;
}) {
  const c = lang === 'es' ? INSIGHTS_ES : INSIGHTS_EN;
  return (
    <header className="border-b border-border">
      <div className="mx-auto max-w-[1180px] px-5 sm:px-8 py-12 sm:py-20">
        <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground/70 mb-6">
          {c.eyebrow}
        </div>
        <h1 className="font-serif text-[clamp(2.2rem,5.6vw,4.4rem)] font-medium leading-[1.02] tracking-[-0.02em] text-foreground">
          {c.headline.line1} <span className="text-accent">{c.headline.accent}</span>
          <br />
          <span className="text-foreground/85">{c.headline.sub}</span>
        </h1>
        <p className="mt-7 max-w-2xl text-[16px] leading-[1.55] text-muted-foreground">{c.subhead}</p>
        <dl className="mt-12 grid grid-cols-2 gap-x-6 gap-y-8 border-y border-border py-7 sm:grid-cols-3">
          <div>
            <dt className="text-[10.5px] uppercase tracking-[0.2em] text-muted-foreground/70">
              {lang === 'es' ? 'Puertos decision-grade' : 'Decision-grade ports'}
            </dt>
            <dd className="mt-2 font-mono text-[2.2rem] leading-none tracking-tight text-accent">
              {decisionGradeCount}
            </dd>
          </div>
          <div>
            <dt className="text-[10.5px] uppercase tracking-[0.2em] text-muted-foreground/70">
              {lang === 'es' ? 'Mediana de mejora vs CBP' : 'Median lift vs CBP'}
            </dt>
            <dd className="mt-2 font-mono text-[2.2rem] leading-none tracking-tight text-foreground">
              +{medianLift.toFixed(1)}%
            </dd>
          </div>
          <div>
            <dt className="text-[10.5px] uppercase tracking-[0.2em] text-muted-foreground/70">
              {lang === 'es' ? 'Entrega' : 'Delivery'}
            </dt>
            <dd className="mt-2 font-mono text-[2.2rem] leading-none tracking-tight text-foreground">
              {lang === 'es' ? 'Correo · SMS' : 'Email · SMS'}
            </dd>
            <dd className="mt-1.5 text-[12px] text-muted-foreground/60">
              {lang === 'es' ? '+ WhatsApp en cuanto Meta libere' : '+ WhatsApp once Meta unblocks'}
            </dd>
          </div>
        </dl>
        <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3">
          <a
            href="mailto:diegonaguirre@icloud.com?subject=Cruzar%20Insights%20trial"
            className="inline-flex items-center gap-3 bg-foreground px-6 py-3.5 text-[14px] font-semibold text-background transition hover:bg-foreground/90"
          >
            <span>{c.cta.primary}</span>
            <span aria-hidden>→</span>
          </a>
          <a
            href="#scoreboard"
            className="text-[14px] font-medium text-muted-foreground underline decoration-border underline-offset-[5px] hover:text-foreground transition"
          >
            {c.cta.secondary}
          </a>
        </div>
      </div>
    </header>
  );
}
