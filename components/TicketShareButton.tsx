'use client';

import { useState } from 'react';

interface Props {
  ticket_id: string;
  modules_count: number;
  lang: 'en' | 'es';
}

/**
 * Web Share API button for /ticket/[id]. The operator workflow at 2am: text
 * a verified ticket link to a broker, officer, or carrier. Native share sheet
 * on mobile (iOS / Android), clipboard fallback on desktop.
 */
export function TicketShareButton({ ticket_id, modules_count, lang }: Props) {
  const [copied, setCopied] = useState(false);
  const url = `https://www.cruzar.app/ticket/${ticket_id}`;
  const title = lang === 'es'
    ? `Cruzar Ticket ${ticket_id}`
    : `Cruzar Ticket ${ticket_id}`;
  const text = lang === 'es'
    ? `Cruzar Ticket firmado · ${modules_count} módulos compuestos. Verifica la firma con la llave pública en /.well-known/cruzar-ticket-key.json.`
    : `Signed Cruzar Ticket · ${modules_count} modules composed. Verify the signature against the public key at /.well-known/cruzar-ticket-key.json.`;

  async function share() {
    if (typeof navigator !== 'undefined' && 'share' in navigator) {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch {
        // User cancelled or share unavailable — fall through to clipboard
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore — browser doesn't support clipboard either
    }
  }

  return (
    <button
      type="button"
      onClick={share}
      className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-[12px] font-mono uppercase tracking-[0.16em] text-muted-foreground hover:border-foreground hover:text-foreground transition"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-3.5 w-3.5"
      >
        <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
        <polyline points="16 6 12 2 8 6" />
        <line x1="12" y1="2" x2="12" y2="15" />
      </svg>
      {copied
        ? (lang === 'es' ? 'Copiado' : 'Copied')
        : (lang === 'es' ? 'Compartir' : 'Share')}
    </button>
  );
}
