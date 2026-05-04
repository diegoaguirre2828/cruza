'use client';

import Link from 'next/link';

export interface CrossModuleHint {
  module: string;
  reason_en: string;
  reason_es: string;
  what_to_provide_en: string;
  what_to_provide_es: string;
  augmentation_hint: string;
}

interface Props {
  hints?: CrossModuleHint[];
  lang: 'en' | 'es';
  /** Optional URL override — defaults to /scan */
  universal_scan_url?: string;
}

/**
 * Cross-module hints renderer. Used by every per-module scan result page
 * (refunds, drawback, uflpa, cbam, pedimento, driver-pass). Single source
 * of truth for the "your same data fires these other modules" panel.
 */
export function CrossModuleHintsPanel({ hints, lang, universal_scan_url = '/scan' }: Props) {
  if (!hints || hints.length === 0) return null;
  const langSuffix = lang === 'es' ? '?lang=es' : '';

  return (
    <div className="mt-6 rounded-xl border border-border bg-card p-6">
      <div className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-muted-foreground">
        {lang === 'es' ? 'También aplica' : 'Also fires on these inputs'}
      </div>
      <p className="mt-2 text-[13px] text-muted-foreground/80">
        {lang === 'es'
          ? 'Tus mismos datos activan otros módulos en el substrato Cruzar Ticket. Provee los datos faltantes y corre el escaneo universal para componer un solo Ticket firmado.'
          : 'Your same inputs trigger other modules on the Cruzar Ticket substrate. Provide the missing data and run the universal scan to compose one signed Ticket.'}
      </p>
      <div className="mt-4 space-y-3">
        {hints.map((h, i) => (
          <div key={i} className="rounded-lg border border-border bg-background p-4">
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-foreground">
                {h.module}
              </span>
              <span className="font-serif text-[14.5px] text-foreground">
                {lang === 'es' ? h.reason_es : h.reason_en}
              </span>
            </div>
            <div className="mt-2 text-[12.5px] text-muted-foreground">
              <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground/60 mr-2">
                {lang === 'es' ? 'Provee' : 'Provide'}
              </span>
              {lang === 'es' ? h.what_to_provide_es : h.what_to_provide_en}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Link
          href={`${universal_scan_url}${langSuffix}`}
          className="rounded-lg border border-foreground/60 bg-foreground/[0.04] px-5 py-2.5 text-sm font-medium text-foreground hover:bg-foreground/[0.10] transition"
        >
          {lang === 'es' ? 'Corre el escaneo universal →' : 'Run the universal scan →'}
        </Link>
        <span className="text-[11.5px] text-muted-foreground/70">
          {lang === 'es'
            ? 'Un bundle, todos los módulos, un Cruzar Ticket firmado.'
            : 'One bundle, every module, one signed Cruzar Ticket.'}
        </span>
      </div>
    </div>
  );
}
