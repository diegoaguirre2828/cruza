import { INSIGHTS_EN } from '@/lib/copy/insights-en';
import { INSIGHTS_ES } from '@/lib/copy/insights-es';

export function DetentionMathCard({ lang = 'en' }: { lang?: 'en' | 'es' }) {
  const c = lang === 'es' ? INSIGHTS_ES.detentionMath : INSIGHTS_EN.detentionMath;
  return (
    <div className="border border-border bg-card/30 p-6 sm:p-7">
      <div className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-accent mb-3">
        {c.title}
      </div>
      <p className="text-[15px] leading-[1.55] text-foreground/85">{c.body}</p>
      <p className="mt-3 text-[12px] leading-[1.55] text-muted-foreground/60">{c.footnote}</p>
    </div>
  );
}
