'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/useAuth';

interface Props {
  /** Cold-pitch line shown to anonymous visitors. Authed users don't see this. */
  pitch: string;
  /** When set, authed users see this single line instead of the pitch.
   *  Defaults to "Logged in · See your plan" — minimal, non-salesy. */
  authed_label?: string;
  lang?: 'en' | 'es';
}

/**
 * Auth-gated pricing strip used on per-module landings (refunds, drawback,
 * pedimento, cbam, uflpa, driver-pass).
 *
 * Anonymous visitors see the cold-pitch line ("8% / $99 floor / no fee on
 * rejected") — that's the trust signal that earns the first scan.
 *
 * Authed users see a quiet "your plan" link to /pricing/business — they
 * already paid; slamming pricing in their face on every landing page is wrong
 * (per Diego's 2026-05-04 critique).
 */
export function PricingStrip({ pitch, authed_label, lang = 'en' }: Props) {
  const { user, loading } = useAuth();
  if (loading) return null;
  const langSuffix = lang === 'es' ? '?lang=es' : '';

  if (user) {
    return (
      <div className="text-[12px] font-mono text-muted-foreground/70">
        <Link
          href={`/pricing/business${langSuffix}`}
          className="hover:text-foreground transition"
        >
          {authed_label ?? (lang === 'es' ? 'Conectado · Ver tu plan →' : 'Logged in · See your plan →')}
        </Link>
      </div>
    );
  }

  return (
    <div className="text-[12px] font-mono text-foreground/75">{pitch}</div>
  );
}
