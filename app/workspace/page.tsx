import { B2BNav } from '@/components/B2BNav';
import { WORKSPACE_EN } from '@/lib/copy/workspace-en';
import { WORKSPACE_ES } from '@/lib/copy/workspace-es';
import { WorkspaceClient } from './WorkspaceClient';
import { BorderSpine } from '@/components/ui/BorderSpine';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { DualLockup } from '@/components/ui/DualLockup';
import { Stamp } from '@/components/ui/Stamp';

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

  // Stamp shows current date + RGV-MX as the issuance "location" — like a
  // customs document header.
  const today = new Date();
  const stampDate = today.toISOString().slice(0, 10).replace(/-/g, '·');

  return (
    <div className="dark min-h-screen bg-background text-foreground">
      <B2BNav lang={lang} />

      <section className="relative border-b border-border overflow-hidden">
        {/* Cartographic spine — topographic contours + US-MX border line */}
        <BorderSpine intensity="med" variant="both" />

        <div className="relative mx-auto max-w-[1180px] px-5 sm:px-8 py-12 sm:py-16">
          <div className="flex items-start justify-between gap-6 flex-wrap">
            <div className="flex-1 min-w-0">
              <Eyebrow>{c.hero.eyebrow}</Eyebrow>
              <div className="mt-4">
                <DualLockup
                  en={lang === 'en' ? c.hero.title : WORKSPACE_EN.hero.title}
                  es={lang === 'es' ? c.hero.title : WORKSPACE_ES.hero.title}
                  primary={lang}
                  size="lg"
                />
              </div>
              <p className="mt-5 max-w-2xl text-[15px] leading-[1.65] text-muted-foreground">
                {c.hero.sub}
              </p>
            </div>

            {/* Customs-stamp accent — issuance marker */}
            <div className="shrink-0 pt-2">
              <Stamp
                label={lang === 'es' ? 'EMITIDO' : 'ISSUED'}
                detail={`${stampDate} · RGV-MX`}
                tone="cream"
                tilt="left"
              />
            </div>
          </div>
        </div>
      </section>

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
