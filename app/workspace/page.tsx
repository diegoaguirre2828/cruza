import { B2BNav } from '@/components/B2BNav';
import { WORKSPACE_EN } from '@/lib/copy/workspace-en';
import { WORKSPACE_ES } from '@/lib/copy/workspace-es';
import { WorkspaceClient } from './WorkspaceClient';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { Stamp } from '@/components/ui/Stamp';
import { BridgeHero } from '@/components/ui/BridgeHero';
import { PortTicker } from '@/components/ui/PortTicker';

export const metadata = {
  title: 'Workspace — Cruzar',
  description: 'Cruzar B2B workspace — every module, live counts, recent activity. One substrate.',
};

export default async function WorkspacePage({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  const params = await searchParams;
  const lang: 'en' | 'es' = params?.lang === 'es' ? 'es' : 'en';
  const c = lang === 'es' ? WORKSPACE_ES : WORKSPACE_EN;

  const today = new Date();
  const stampDate = today.toISOString().slice(0, 10).replace(/-/g, '·');

  return (
    <div className="dark min-h-screen bg-background text-foreground">
      <B2BNav lang={lang} />

      {/* HERO — asymmetric split. Left: bilingual headline + meta. Right: massive bridge silhouette. */}
      <section className="relative border-b border-border overflow-hidden">
        <div className="mx-auto max-w-[1180px] px-5 sm:px-8 py-14 sm:py-20">
          <div className="grid gap-10 lg:grid-cols-[1fr_1fr] lg:items-center">
            {/* Left: meta + dual headline */}
            <div className="relative">
              <div className="flex items-center gap-3">
                <Eyebrow tone="primary">{c.hero.eyebrow}</Eyebrow>
                <span className="h-px flex-1 bg-border" />
                <Stamp
                  label={lang === 'es' ? 'EMITIDO' : 'ISSUED'}
                  detail={`${stampDate} · RGV-MX`}
                  tone="cream"
                  tilt="left"
                />
              </div>

              {/* Big bilingual lockup — EN top in display serif, ES below in italic-muted */}
              <h1 className="mt-6 font-serif text-[clamp(2.4rem,4.8vw,3.8rem)] font-medium leading-[1.02] text-foreground tracking-[-0.02em]">
                {lang === 'en' ? c.hero.title : WORKSPACE_EN.hero.title}
              </h1>
              <h2 className="mt-1 font-serif text-[clamp(2.4rem,4.8vw,3.8rem)] font-medium leading-[1.02] text-muted-foreground/55 tracking-[-0.02em] italic">
                {lang === 'es' ? c.hero.title : WORKSPACE_ES.hero.title}
              </h2>

              <p className="mt-7 max-w-xl text-[15px] leading-[1.65] text-muted-foreground">
                {c.hero.sub}
              </p>

              {/* Coordinate strip — under the headline, like a dossier header */}
              <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 font-mono text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground/70">
                <span>26.18°N · 98.18°W</span>
                <span className="h-3 w-px bg-border" />
                <span>RGV CORRIDOR</span>
                <span className="h-3 w-px bg-border" />
                <span>BILINGUAL EN · ES</span>
              </div>
            </div>

            {/* Right: bridge silhouette as hero visual */}
            <div className="relative flex items-center justify-center">
              <BridgeHero className="w-full max-w-[520px]" weight={1.1} />
            </div>
          </div>
        </div>

        {/* Footer hairline w/ section label */}
        <div className="absolute bottom-0 left-0 right-0 flex items-center gap-3 px-5 sm:px-8 py-2 border-t border-border bg-card/30">
          <span className="font-mono text-[9.5px] uppercase tracking-[0.22em] text-muted-foreground/60">
            CRUZAR / SUBSTRATE / WORKSPACE / 01
          </span>
          <span className="h-px flex-1 bg-border" />
          <span className="font-mono text-[9.5px] tabular-nums tracking-[0.14em] text-muted-foreground/50">
            {today.getUTCFullYear()}.{String(today.getUTCMonth() + 1).padStart(2, '0')}.{String(today.getUTCDate()).padStart(2, '0')}
          </span>
        </div>
      </section>

      {/* LIVE PORT TICKER — Bloomberg-style, the geographic spine made literal */}
      <PortTicker />

      <WorkspaceClient lang={lang} copy={c} />

      <footer className="bg-card border-t border-border">
        <div className="mx-auto max-w-[1180px] px-5 sm:px-8 py-10 space-y-4">
          <p className="max-w-3xl text-[11px] leading-[1.65] text-muted-foreground/70">
            {c.shared.legal_disclaimer}
          </p>
          <div className="flex items-center justify-between gap-4 flex-wrap pt-4 border-t border-border/60">
            <div className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-muted-foreground/60">
              {c.shared.powered_by}
            </div>
            <div className="font-mono text-[10px] tabular-nums tracking-[0.08em] text-muted-foreground/50">
              26.18°N · 98.18°W
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
