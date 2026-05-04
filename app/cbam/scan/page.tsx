import { B2BNav } from '@/components/B2BNav';
import { CBAM_EN } from '@/lib/copy/cbam-en';
import { CBAM_ES } from '@/lib/copy/cbam-es';
import { ScanClient } from './ScanClient';

export const metadata = {
  title: 'Free CBAM scan — Cruzar',
  description:
    'Free CBAM readiness check. Enter declarant + 1 good; we classify CN, compute embedded emissions, estimate certificate cost. No signup.',
  alternates: { canonical: 'https://www.cruzar.app/cbam/scan' },
};

export default async function CbamScanPage({ searchParams }: { searchParams: Promise<{ lang?: string }> }) {
  const params = await searchParams;
  const lang: 'en' | 'es' = params?.lang === 'es' ? 'es' : 'en';
  const c = lang === 'es' ? CBAM_ES : CBAM_EN;

  return (
    <div className="dark min-h-screen bg-background text-foreground">
      <B2BNav lang={lang} />
      <section className="border-b border-border">
        <div className="mx-auto max-w-[820px] px-5 sm:px-8 py-16">
          <div className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-muted-foreground">{c.scan.eyebrow}</div>
          <h1 className="font-serif text-[clamp(1.9rem,3.6vw,2.8rem)] text-foreground mt-3">{c.scan.title}</h1>
          <p className="mt-4 text-[16px] text-muted-foreground">{c.scan.sub}</p>
          <div className="mt-10"><ScanClient lang={lang} copy={c.scan} /></div>
        </div>
      </section>
      <footer className="bg-card">
        <div className="mx-auto max-w-[1180px] px-5 sm:px-8 py-8 space-y-4">
          <p className="max-w-3xl text-[11.5px] leading-[1.6] text-muted-foreground/70">{c.shared.legal_disclaimer}</p>
          <div className="text-[11.5px] font-mono uppercase tracking-[0.18em] text-muted-foreground/60">{c.shared.powered_by}</div>
        </div>
      </footer>
    </div>
  );
}
