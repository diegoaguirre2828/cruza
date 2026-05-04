// components/ui/DualLockup.tsx
// Bilingual EN+ES side-by-side header treatment. The bilingual aspect is the
// most distinctively-Cruzar thing about Cruzar — and it shouldn't be hidden
// behind a query param. This component makes both languages visible at once,
// styled like a real customs-document dual header.
//
// Usage: only on the most important headers (workspace hero, ticket viewer
// title). Don't apply to every section — that gets noisy.

interface DualLockupProps {
  en: string;
  es: string;
  /** Which language is "primary" — the other is muted */
  primary?: 'en' | 'es';
  size?: 'lg' | 'md';
  className?: string;
}

export function DualLockup({ en, es, primary = 'en', size = 'lg', className = '' }: DualLockupProps) {
  const sizeClass = size === 'lg'
    ? 'text-[clamp(1.9rem,3.6vw,2.8rem)]'
    : 'text-[clamp(1.4rem,2.4vw,1.9rem)]';
  const primaryClass = 'font-serif font-medium leading-[1.1] text-foreground tracking-[-0.01em]';
  const secondaryClass = 'font-serif font-medium leading-[1.1] text-muted-foreground/70 tracking-[-0.01em] italic';

  return (
    <div className={`relative pl-4 ${className}`}>
      {/* Vertical bar like a customs-form left-margin marker */}
      <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-foreground/70" />
      <div className="space-y-1">
        <h1 className={`${sizeClass} ${primary === 'en' ? primaryClass : secondaryClass}`}>
          {en}
        </h1>
        <h2 className={`${sizeClass} ${primary === 'es' ? primaryClass : secondaryClass}`}>
          {es}
        </h2>
      </div>
    </div>
  );
}
