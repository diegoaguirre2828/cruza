// components/ui/Eyebrow.tsx
// The small uppercase tracker text above section titles. Cruzar standardizes
// this so we stop redefining font-mono uppercase tracking-[0.2em] on every page.

interface EyebrowProps {
  children: React.ReactNode;
  /** 'amber' (default — primary brand), 'cobalt' (cartography), 'clay' (RGV/operational), 'parchment' (stamp/Ticket) */
  tone?: 'amber' | 'cobalt' | 'clay' | 'parchment' | 'soft';
  className?: string;
}

const toneClass: Record<NonNullable<EyebrowProps['tone']>, string> = {
  amber: 'text-amber-300',
  cobalt: 'text-[#5b8fc3]',     // brighter cartography cobalt for dark bg
  clay: 'text-[#d97757]',       // brighter clay for dark bg
  parchment: 'text-[#e6dcc1]',
  soft: 'text-white/55',
};

export function Eyebrow({ children, tone = 'amber', className = '' }: EyebrowProps) {
  return (
    <div
      className={`font-mono text-[10.5px] uppercase tracking-[0.2em] ${toneClass[tone]} ${className}`}
    >
      {children}
    </div>
  );
}
