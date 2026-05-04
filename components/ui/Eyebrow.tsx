// components/ui/Eyebrow.tsx
// Small uppercase tracker text above section titles. Uses theme tokens —
// navy+white+bone monochrome. Single tone (no per-page variants).

interface EyebrowProps {
  children: React.ReactNode;
  /** 'default' (muted), 'primary' (white/foreground), 'accent' (bone — stamp moments) */
  tone?: 'default' | 'primary' | 'accent';
  className?: string;
}

const toneClass: Record<NonNullable<EyebrowProps['tone']>, string> = {
  default: 'text-muted-foreground',
  primary: 'text-foreground',
  accent: 'text-accent',
};

export function Eyebrow({ children, tone = 'default', className = '' }: EyebrowProps) {
  return (
    <div
      className={`font-mono text-[10.5px] uppercase tracking-[0.2em] ${toneClass[tone]} ${className}`}
    >
      {children}
    </div>
  );
}
