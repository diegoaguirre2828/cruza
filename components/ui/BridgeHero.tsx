// components/ui/BridgeHero.tsx
// Massive inline bridge silhouette (the Cruzar brand) — used as a hero
// visual element, not just a corner logo. The bridge IS the brand: it's
// the literal connection between two sides. Show it big.

interface BridgeHeroProps {
  className?: string;
  /** Stroke width multiplier — bigger = bolder */
  weight?: number;
}

export function BridgeHero({ className = '', weight = 1 }: BridgeHeroProps) {
  return (
    <svg
      viewBox="0 0 280 100"
      xmlns="http://www.w3.org/2000/svg"
      className={`text-foreground ${className}`}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
    >
      {/* Stretched horizontal deck */}
      <rect x="20" y="68" width="240" height={3 * weight} fill="currentColor" />

      {/* End piers */}
      <rect x="22" y="71" width={2 * weight} height="14" fill="currentColor" />
      <rect x="256" y="71" width={2 * weight} height="14" fill="currentColor" />

      {/* Arch — stretched parabolic */}
      <path
        d="M 22 68 Q 140 -40 258 68"
        stroke="currentColor"
        strokeWidth={2.4 * weight}
        fill="none"
        strokeLinecap="round"
      />

      {/* Vertical suspension cables — staggered heights following the arch */}
      {[
        { x: 35, top: 56 },
        { x: 50, top: 42 },
        { x: 70, top: 30 },
        { x: 95, top: 22 },
        { x: 122, top: 18 },
        { x: 140, top: 16 },
        { x: 158, top: 18 },
        { x: 185, top: 22 },
        { x: 210, top: 30 },
        { x: 230, top: 42 },
        { x: 245, top: 56 },
      ].map((pillar) => (
        <line
          key={pillar.x}
          x1={pillar.x}
          y1={pillar.top}
          x2={pillar.x}
          y2={68}
          stroke="currentColor"
          strokeWidth={1.5 * weight}
          strokeLinecap="round"
        />
      ))}
    </svg>
  );
}
