import { B2BNav } from '@/components/B2BNav';
import { WORKSPACE_EN } from '@/lib/copy/workspace-en';
import { WORKSPACE_ES } from '@/lib/copy/workspace-es';
import { WorkspaceClient } from './WorkspaceClient';

export const metadata = {
  title: 'Workspace — Cruzar',
  description:
    'Cruzar B2B workspace — every module, live counts, recent activity. One substrate.',
};

export default async function WorkspacePage({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  const params = await searchParams;
  const lang: 'en' | 'es' = params?.lang === 'es' ? 'es' : 'en';
  const c = lang === 'es' ? WORKSPACE_ES : WORKSPACE_EN;

  return (
    <div className="min-h-screen bg-[#0a1020] text-slate-100">
      <B2BNav lang={lang} />
      <section className="border-b border-white/[0.07]">
        <div className="mx-auto max-w-[1180px] px-5 sm:px-8 py-12">
          <div className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-amber-300">
            {c.hero.eyebrow}
          </div>
          <h1 className="font-serif text-[clamp(1.9rem,3.6vw,2.8rem)] text-white mt-3">
            {c.hero.title}
          </h1>
          <p className="mt-3 max-w-3xl text-[15.5px] text-white/65">{c.hero.sub}</p>
        </div>
      </section>

      <WorkspaceClient lang={lang} copy={c} />

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
