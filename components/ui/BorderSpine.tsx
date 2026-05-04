// components/ui/BorderSpine.tsx
// SVG topographic-contour pattern + US-MX border line as a background motif.
// The "border-cartography spine" of the Cruzar visual identity. Renders very
// faintly — should NEVER overpower content, just whisper "this is the border."
//
// Usage: place inside hero sections as an absolute-positioned background.

interface BorderSpineProps {
  /** 'low' = barely visible (default), 'med' = visible, 'high' = prominent (sparingly) */
  intensity?: 'low' | 'med' | 'high';
  /** 'contour' = topographic lines only, 'border' = US-MX border line only, 'both' = both */
  variant?: 'contour' | 'border' | 'both';
  className?: string;
}

const intensityOpacity: Record<NonNullable<BorderSpineProps['intensity']>, number> = {
  low: 0.04,
  med: 0.08,
  high: 0.14,
};

export function BorderSpine({ intensity = 'low', variant = 'both', className = '' }: BorderSpineProps) {
  const opacity = intensityOpacity[intensity];

  return (
    <div
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
      aria-hidden="true"
      style={{ opacity }}
    >
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 1180 600"
        preserveAspectRatio="xMidYMid slice"
        className="h-full w-full"
      >
        {variant === 'contour' || variant === 'both' ? (
          <g stroke="currentColor" strokeWidth="1" fill="none" style={{ color: 'oklch(0.9842 0.0034 247.8575)' }}>
            {/* Topographic-style horizontal contours, irregular */}
            <path d="M -20 80 Q 200 60 400 90 Q 700 120 1000 95 Q 1100 85 1200 100" />
            <path d="M -20 140 Q 200 120 380 145 Q 690 170 990 150 Q 1100 145 1200 158" />
            <path d="M -20 200 Q 220 175 420 200 Q 720 230 1010 210 Q 1100 205 1200 220" />
            <path d="M -20 270 Q 240 245 440 270 Q 740 300 1020 280 Q 1100 275 1200 290" />
            <path d="M -20 340 Q 260 315 460 340 Q 760 370 1030 350 Q 1100 345 1200 360" />
            <path d="M -20 410 Q 280 385 480 410 Q 780 440 1040 420 Q 1100 415 1200 430" />
            <path d="M -20 480 Q 300 455 500 480 Q 800 510 1050 490 Q 1100 485 1200 500" />
            <path d="M -20 550 Q 320 525 520 550 Q 820 580 1060 560 Q 1100 555 1200 570" />
          </g>
        ) : null}

        {variant === 'border' || variant === 'both' ? (
          <g style={{ color: 'oklch(0.9842 0.0034 247.8575)' }}>
            {/* Schematic US-MX border line */}
            <path
              d="M 50 320 L 200 300 L 250 295 L 320 280 L 380 275 L 450 290 L 520 285 L 580 275 L 640 295 L 720 305 L 790 295 L 850 285 L 920 295 L 980 305 L 1040 295 L 1130 285"
              stroke="currentColor"
              strokeWidth="1.5"
              fill="none"
              strokeDasharray="4 6"
              opacity="0.55"
            />
            {/* RGV port markers */}
            {[
              { x: 380, label: 'BRO' },   // Brownsville
              { x: 450, label: 'HID' },   // Hidalgo / McAllen
              { x: 520, label: 'PHA' },   // Pharr-Reynosa
              { x: 640, label: 'LAR' },   // Laredo
              { x: 790, label: 'EAG' },   // Eagle Pass
              { x: 920, label: 'EPS' },   // El Paso
              { x: 1040, label: 'NOG' },  // Nogales
            ].map((p) => (
              <g key={p.label}>
                <circle cx={p.x} cy={320} r="3" fill="currentColor" opacity="0.85" />
                <text
                  x={p.x}
                  y={342}
                  textAnchor="middle"
                  fill="currentColor"
                  fontSize="8"
                  fontFamily="monospace"
                  letterSpacing="0.1em"
                  opacity="0.6"
                >
                  {p.label}
                </text>
              </g>
            ))}
          </g>
        ) : null}
      </svg>
    </div>
  );
}
