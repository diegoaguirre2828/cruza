// components/ui/StatBlock.tsx
// Replaces the generic "label-on-left value-on-right" stat divs with a stronger
// hierarchy. The big number is the hero. Label sits above as a tiny eyebrow.
// Optional coordinate-style sub-line for the cartography tone.

interface StatBlockProps {
  label: string;
  value: string | number;
  /** Optional secondary line below the value — like a coordinate or change-indicator */
  detail?: string;
  /** 'amber' (default), 'clay' (operational), 'cobalt' (geographic), 'ok'/'warn'/'bad' (status) */
  tone?: 'amber' | 'clay' | 'cobalt' | 'ok' | 'warn' | 'bad' | 'neutral';
  /** 'lg' for hero stats, 'md' for cards, 'sm' for inline rows */
  size?: 'lg' | 'md' | 'sm';
  className?: string;
}

const toneClass: Record<NonNullable<StatBlockProps['tone']>, string> = {
  amber: 'text-amber-200',
  clay: 'text-[#d97757]',
  cobalt: 'text-[#7eaad8]',
  ok: 'text-emerald-300',
  warn: 'text-amber-300',
  bad: 'text-red-300',
  neutral: 'text-white/85',
};

const sizeClass: Record<NonNullable<StatBlockProps['size']>, string> = {
  lg: 'text-[44px] leading-none',
  md: 'text-[22px] leading-tight',
  sm: 'text-[15px] leading-tight',
};

export function StatBlock({ label, value, detail, tone = 'amber', size = 'md', className = '' }: StatBlockProps) {
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/50">{label}</span>
      <span className={`font-mono font-medium tabular-nums ${sizeClass[size]} ${toneClass[tone]}`}>
        {value}
      </span>
      {detail && (
        <span className="font-mono text-[10.5px] tabular-nums tracking-[0.04em] text-white/45">
          {detail}
        </span>
      )}
    </div>
  );
}
