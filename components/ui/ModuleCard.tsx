// components/ui/ModuleCard.tsx
// The signature card pattern for /workspace and any other module-grid surface.
// Border-cartography flavor: cards have a faint corner-bracket marker (like a
// map callout's anchor point) and a left-edge accent stripe.
//
// Replaces the generic rounded-xl border bg-white/[0.02] divs that read as
// "Tailwind tutorial card."

import Link from 'next/link';

export interface ModuleCardStat {
  label: string;
  value: string | number;
  emphasis?: boolean;
}

interface ModuleCardProps {
  /** 'amber' | 'clay' | 'cobalt' | 'sage' | 'rose' — accent color for left stripe + emphasis */
  accent: 'amber' | 'clay' | 'cobalt' | 'sage' | 'rose' | 'violet';
  /** Tiny code shown in the top corner — like a port code or HS chapter */
  code?: string;
  title: string;
  /** One-line description of the module */
  sub: string;
  stats: ModuleCardStat[];
  link?: { href: string; label: string };
  className?: string;
}

const accentTokens = {
  amber:  { stripe: 'bg-amber-300/70',  emphasis: 'text-amber-200',  link: 'text-amber-300 hover:text-amber-200',  brackets: 'border-amber-300/30',  code: 'text-amber-300/80'  },
  clay:   { stripe: 'bg-[#9b3924]',      emphasis: 'text-[#d97757]',  link: 'text-[#d97757] hover:text-[#e88a6a]',   brackets: 'border-[#9b3924]/30',  code: 'text-[#d97757]/80'   },
  cobalt: { stripe: 'bg-[#1d3557]',      emphasis: 'text-[#7eaad8]',  link: 'text-[#7eaad8] hover:text-[#9bc0e2]',   brackets: 'border-[#1d3557]/40',  code: 'text-[#7eaad8]/80'   },
  sage:   { stripe: 'bg-[#8b9a7e]',      emphasis: 'text-[#b6c4a8]',  link: 'text-[#b6c4a8] hover:text-[#c8d4be]',   brackets: 'border-[#8b9a7e]/30',  code: 'text-[#b6c4a8]/80'   },
  rose:   { stripe: 'bg-rose-400/70',    emphasis: 'text-rose-200',   link: 'text-rose-300 hover:text-rose-200',     brackets: 'border-rose-400/30',   code: 'text-rose-300/80'    },
  violet: { stripe: 'bg-violet-400/70',  emphasis: 'text-violet-200', link: 'text-violet-300 hover:text-violet-200', brackets: 'border-violet-400/30', code: 'text-violet-300/80'  },
} as const;

export function ModuleCard({ accent, code, title, sub, stats, link, className = '' }: ModuleCardProps) {
  const t = accentTokens[accent];
  return (
    <div className={`group relative overflow-hidden rounded-md border border-white/[0.07] bg-white/[0.015] hover:bg-white/[0.025] transition ${className}`}>
      {/* Left-edge accent stripe — the cartographic "callout anchor" */}
      <div className={`absolute left-0 top-0 bottom-0 w-[3px] ${t.stripe}`} />

      {/* Top-right corner brackets — map-callout marker */}
      <div className="absolute top-2 right-2 flex gap-0.5 pointer-events-none">
        <div className={`h-2 w-2 border-t border-r ${t.brackets}`} />
      </div>
      <div className="absolute bottom-2 left-2 flex gap-0.5 pointer-events-none">
        <div className={`h-2 w-2 border-b border-l ${t.brackets}`} />
      </div>

      <div className="px-5 pl-6 py-5">
        <div className="flex items-baseline justify-between gap-3">
          {code && (
            <span className={`font-mono text-[9.5px] uppercase tracking-[0.22em] ${t.code}`}>
              {code}
            </span>
          )}
        </div>
        <div className="mt-1 font-serif text-[17px] font-medium text-white leading-tight">
          {title}
        </div>
        <p className="mt-1.5 text-[12.5px] leading-[1.55] text-white/55">{sub}</p>

        {stats.length > 0 && (
          <div className="mt-5 grid gap-1.5">
            {stats.map((s, i) => (
              <div key={i} className="flex items-baseline justify-between gap-3 border-t border-white/[0.05] pt-1.5 first:border-t-0 first:pt-0">
                <span className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-white/45">
                  {s.label}
                </span>
                <span
                  className={
                    s.emphasis
                      ? `font-mono tabular-nums text-[19px] font-medium ${t.emphasis}`
                      : 'font-mono tabular-nums text-[13px] text-white/85'
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
            className={`mt-5 inline-flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.18em] ${t.link}`}
          >
            {link.label} <span aria-hidden="true">→</span>
          </Link>
        )}
      </div>
    </div>
  );
}
