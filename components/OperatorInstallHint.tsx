'use client';

import { useEffect, useState } from 'react';

const SESSION_KEY = 'cruzar_operator_install_hint_session';
const DISMISS_KEY = 'cruzar_operator_install_hint_dismissed_at';
const DISMISS_DAYS = 14;

/**
 * Operator-specific PWA install hint. Shown on B2B routes (/workspace, /dispatch)
 * when the page is NOT running as an installed PWA. Different copy from the
 * consumer install nudge (which is blocked from B2B): operators install
 * Cruzar as a phone home-screen app to glance at live wait + alerts during
 * 24/7 trucking operations.
 *
 * Once-per-session, 14-day dismiss cooldown. Renders nothing on desktop.
 */
export function OperatorInstallHint({ lang = 'en' }: { lang?: 'en' | 'es' }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    // Only fire on touch devices — desktop doesn't need the install pitch
    const isTouch = window.matchMedia('(pointer: coarse)').matches;
    if (!isTouch) return;

    // Skip if already running as standalone PWA
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (isStandalone) return;

    try {
      if (sessionStorage.getItem(SESSION_KEY) === '1') return;
      const dismissed = localStorage.getItem(DISMISS_KEY);
      if (dismissed) {
        const ms = Date.now() - parseInt(dismissed, 10);
        if (!Number.isNaN(ms) && ms < DISMISS_DAYS * 24 * 3600 * 1000) return;
      }
    } catch {
      // storage unavailable — fall through and show once
    }

    setShow(true);
    try { sessionStorage.setItem(SESSION_KEY, '1'); } catch { /* noop */ }
  }, []);

  function dismiss() {
    setShow(false);
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* noop */ }
  }

  if (!show) return null;

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-30 border-t border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/85 px-4 py-3">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent">
            Operator install
          </div>
          <p className="mt-1 text-[13px] leading-[1.4] text-foreground">
            {lang === 'es'
              ? 'Instala Cruzar en tu pantalla de inicio. Espera en vivo + alertas a un toque, 24/7.'
              : 'Add Cruzar to your home screen. Live wait + alerts in one tap, 24/7.'}
          </p>
          <a
            href={`/ios-install${lang === 'es' ? '?lang=es' : ''}`}
            className="mt-2 inline-block font-mono text-[11px] uppercase tracking-[0.16em] text-foreground hover:text-accent"
          >
            {lang === 'es' ? 'Cómo instalar →' : 'How to install →'}
          </a>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label={lang === 'es' ? 'Cerrar' : 'Dismiss'}
          className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground"
        >
          ×
        </button>
      </div>
    </div>
  );
}
