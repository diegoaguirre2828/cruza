// lib/design/tokens.ts
// Cruzar design tokens — single source of truth for the visual language.
// Hybrid: cartography spine (border / RGV / substrate) + customs-stamp accents
// (Ticket / signed / audit-grade). Layered ON TOP of existing amber+navy brand,
// not replacing it.

export const colors = {
  // Operator-grade dark surface (existing brand — preserved)
  bg: {
    primary: '#0a1020',          // page bg
    secondary: '#070b18',        // footers, deep panels
    elevated: '#0f1729',          // hover/elevated surfaces
    card: 'rgba(255,255,255,0.02)',
    cardHover: 'rgba(255,255,255,0.04)',
  },
  border: {
    subtle: 'rgba(255,255,255,0.07)',
    medium: 'rgba(255,255,255,0.15)',
    strong: 'rgba(255,255,255,0.25)',
  },
  text: {
    primary: '#ffffff',
    body: 'rgba(255,255,255,0.85)',
    muted: 'rgba(255,255,255,0.65)',
    soft: 'rgba(255,255,255,0.45)',
    faint: 'rgba(255,255,255,0.25)',
  },

  // Existing brand accent (preserved)
  amber: {
    50: '#fef9eb',
    200: '#fde68a',
    300: '#fbbf24',  // primary CTA
    400: '#f59e0b',
  },

  // NEW — customs / authority palette (the "stamp" side of the hybrid)
  // Used for: Ticket viewer, signed surfaces, audit-shield elements,
  // verified badges, official-document treatments
  customs: {
    ink: '#0c0c0e',           // stamp ink
    blue: '#0d2148',          // CBP-authority deep blue
    blueLight: '#1a3568',     // hover state
    parchment: '#f3ecd8',     // cream document surface
    parchmentDark: '#e6dcc1', // shadowed parchment
    sealRed: '#8a0e21',       // wax-seal accent (sparingly)
  },

  // NEW — cartography palette (the "border" spine of the hybrid)
  // Used for: BorderSpine background motif, MapCallout cards,
  // port markers, geographic context, operational data
  cartography: {
    clay: '#9b3924',          // RGV desert soil — primary cartography accent
    clayLight: '#b95135',     // hover state
    cobalt: '#1d3557',        // deep map blue (different from customs blue)
    cobaltLight: '#2a4a78',
    sage: '#8b9a7e',          // map vegetation neutral
    cream: '#f3ecd8',          // shared with customs
    contourLine: 'rgba(155, 57, 36, 0.08)', // very faint topo lines on dark bg
  },

  // Status colors (operational signals)
  status: {
    ok: '#22c55e',
    warn: '#f59e0b',
    bad: '#ef4444',
    neutral: 'rgba(255,255,255,0.45)',
  },
} as const;

// Typography scale — keeps existing serif (Bricolage Grotesque) + Geist mono,
// adds explicit roles so we stop reinventing per page.
export const type = {
  display: 'font-serif font-medium leading-[1.05] tracking-[-0.01em]',  // hero titles
  title: 'font-serif font-medium leading-[1.15]',                         // section titles
  body: 'leading-[1.55]',                                                  // paragraphs
  eyebrow: 'font-mono text-[10.5px] uppercase tracking-[0.2em]',         // section eyebrows
  stamp: 'font-mono text-[10px] uppercase tracking-[0.22em] font-medium',// stamp text — tighter, weighted
  data: 'font-mono tabular-nums',                                         // numeric/data
  coord: 'font-mono text-[11px] tabular-nums tracking-[0.04em]',         // lat/long coordinates
  caption: 'text-[12px] leading-[1.5]',                                   // small labels
} as const;

// Spacing rhythm — page-section padding scale
export const space = {
  page: 'py-12 sm:py-16',
  section: 'py-10',
  card: 'p-5',
  cardLarge: 'p-6 sm:p-8',
} as const;

// Reusable corner shapes
export const shape = {
  card: 'rounded-xl',
  pill: 'rounded-full',
  stamp: 'rounded-[2px]',  // sharp-edged like a real stamp
  document: 'rounded-md',
} as const;
