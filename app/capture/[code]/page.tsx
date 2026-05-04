// app/capture/[code]/page.tsx
// Mobile capture surface. Operator opens this on their phone via QR scan
// or by typing the code. Camera input + upload + confirmation animation.
// Pure mobile-first — no nav chrome, no marketing, just the camera + button.

import { CaptureClient } from './CaptureClient';

export const metadata = {
  title: 'Cruzar capture',
  description: 'Capture a document for the desktop session that requested it.',
};

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ lang?: string }>;
}

export default async function CapturePage({ params, searchParams }: Props) {
  const { code } = await params;
  const sp = await searchParams;
  const lang: 'en' | 'es' = sp?.lang === 'es' ? 'es' : 'en';

  return (
    <div className="dark min-h-screen bg-background text-foreground flex flex-col">
      <header className="border-b border-border px-5 py-4">
        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          Cruzar · {lang === 'es' ? 'Captura' : 'Capture'}
        </div>
        <div className="mt-1 font-mono text-[18px] tracking-[0.18em] text-foreground">{code}</div>
      </header>
      <main className="flex-1 px-5 py-6">
        <CaptureClient code={code} lang={lang} />
      </main>
      <footer className="px-5 py-4 text-[10.5px] font-mono uppercase tracking-[0.18em] text-muted-foreground/60">
        {lang === 'es' ? 'Captura segura · Cruzar Ticket v1' : 'Secure capture · Cruzar Ticket v1'}
      </footer>
    </div>
  );
}
