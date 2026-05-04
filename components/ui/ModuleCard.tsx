// components/ui/ModuleCard.tsx
// Module card — uses theme tokens (navy+white+bone monochrome). Differentiation
// between cards comes from content (MOD code, title, stats), NOT from a
// rainbow of accent colors. The architectural-bridge brand demands restraint.

import Link from 'next/link';

export interface ModuleCardStat {
  label: string;
  value: string | number;
  emphasis?: boolean;
}

interface ModuleCardProps {
  /** 'primary' (white stripe — default), 'accent' (bone stripe — for substrate / Ticket) */
  accent?: 'primary' | 'accent';
  /** Tiny code shown in the top corner — like a port code or HS chapter */
  code?: string;
  title: string;
  /** One-line description of the module */
  sub: string;
  stats: ModuleCardStat[];
  link?: { href: string; label: string };
  className?: string;
}

const stripeClass = {
  primary: 'bg-foreground/80',
  accent: 'bg-accent',
};

const emphasisClass = {
  primary: 'text-foreground',
  accent: 'text-accent',
};

const linkClass = {
  primary: 'text-foreground/85 hover:text-foreground',
  accent: 'text-accent hover:text-accent/85',
};

export function ModuleCard({ accent = 'primary', code, title, sub, stats, link, className = '' }: ModuleCardProps) {
  return (
    <div className={`group relative overflow-hidden border border-border bg-card hover:bg-card/80 transition ${className}`}>
      {/* Left-edge accent stripe — the cartographic "callout anchor" */}
      <div className={`absolute left-0 top-0 bottom-0 w-[2px] ${stripeClass[accent]}`} />

      {/* Top-right corner brackets — map-callout marker */}
      <div className="absolute top-2 right-2 pointer-events-none">
        <div className="h-2 w-2 border-t border-r border-foreground/30" />
      </div>
      <div className="absolute bottom-2 left-2 pointer-events-none">
        <div className="h-2 w-2 border-b border-l border-foreground/30" />
      </div>

      <div className="px-5 pl-6 py-5">
        {code && (
          <div className="font-mono text-[9.5px] uppercase tracking-[0.22em] text-muted-foreground">
            {code}
          </div>
        )}
        <div className="mt-1 font-serif text-[17px] font-medium text-foreground leading-tight">
          {title}
        </div>
        <p className="mt-1.5 text-[12.5px] leading-[1.55] text-muted-foreground">{sub}</p>

        {stats.length > 0 && (
          <div className="mt-5 grid gap-1.5">
            {stats.map((s, i) => (
              <div key={i} className="flex items-baseline justify-between gap-3 border-t border-border pt-1.5 first:border-t-0 first:pt-0">
                <span className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-muted-foreground">
                  {s.label}
                </span>
                <span
                  className={
                    s.emphasis
                      ? `font-mono tabular-nums text-[19px] font-medium ${emphasisClass[accent]}`
                      : 'font-mono tabular-nums text-[13px] text-foreground/85'
                  }
                >
                  {s.value}
                </span>
              </div>
            ))}
          </div>
        )}

        {link && (
          <Link
            href={link.href}
            className={`mt-5 inline-flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.18em] ${linkClass[accent]}`}
          >
            {link.label} <span aria-hidden="true">→</span>
          </Link>
        )}
      </div>
    </div>
  );
}
