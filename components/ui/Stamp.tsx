// components/ui/Stamp.tsx
// Customs-stamp style element. Looks like a slightly skewed, ink-pressed stamp
// you'd find on an actual customs document. Use sparingly for "VERIFIED",
// "FIRMADO", "AUDIT-READY", etc. — moments that benefit from the customs
// authority frame.

interface StampProps {
  /** Big block text — shown in caps */
  label: string;
  /** Optional sub-line (date, location, ID, etc.) */
  detail?: string;
  /** 'blue' = customs authority (default), 'red' = warning/alert (sparing!), 'cream' = inverted on dark */
  tone?: 'blue' | 'red' | 'cream' | 'amber';
  /** Slight rotation to feel hand-pressed */
  tilt?: 'left' | 'right' | 'none';
  className?: string;
}

const toneStyles: Record<NonNullable<StampProps['tone']>, string> = {
  blue: 'text-foreground border-foreground/60 bg-foreground/[0.04]',
  red: 'text-destructive border-destructive/60 bg-destructive/[0.04]',
  cream: 'text-accent border-accent/60 bg-accent/[0.06]',
  amber: 'text-accent border-accent/60 bg-accent/[0.06]',
};

const tiltClass: Record<NonNullable<StampProps['tilt']>, string> = {
  left: '-rotate-2',
  right: 'rotate-1',
  none: '',
};

export function Stamp({ label, detail, tone = 'blue', tilt = 'left', className = '' }: StampProps) {
  return (
    <div
      className={`inline-flex flex-col items-start gap-0.5 border-2 px-3 py-1.5 rounded-[2px] ${toneStyles[tone]} ${tiltClass[tilt]} ${className}`}
      style={{ filter: 'contrast(1.05)' }}
    >
      <span className="font-mono text-[11px] font-bold uppercase tracking-[0.22em] leading-none">
        {label}
      </span>
      {detail && (
        <span className="font-mono text-[9px] uppercase tracking-[0.18em] opacity-80 leading-tight">
          {detail}
        </span>
      )}
    </div>
  );
}
