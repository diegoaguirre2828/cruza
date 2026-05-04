// Verbatim language for /insights B2B sales surface (English).
// Sourced from the 2026-05-01 RGV broker pain dossier. NEVER substitute
// corporate phrasing for these strings — they are quoted from real industry
// voices (Uber Freight MX, Cargado CEO, r/FreightBrokers, ATRI 2024).
// NO "AI" / "model" / "MCP" — see feedback_ai_as_infrastructure_not_product_20260430.md

export const INSIGHTS_EN = {
  eyebrow: 'For RGV cross-border freight brokers · dispatchers · fleets',
  headline: {
    line1: 'The border has traditionally been',
    accent: 'the black hole.',
    sub: 'We pull your trucks out before it closes.',
  },
  subhead:
    "One 5am email + a push when something breaks. Watch your lanes. Read receipts that prove we called it right. That's it.",
  detentionMath: {
    title: 'Why the math works',
    body:
      '10 trucks × 1 wrong-bridge-pick/day × 30 min wasted × $85/hr = ~$10,200/mo bleeding. Insights Pro at $299/mo cuts about 30% of that. Net save: $2,800+/mo.',
    footnote:
      'Industry-wide: $3.6B/yr in direct detention losses, $11.5B/yr in lost productivity (ATRI 2024). 39% of stops detained.',
  },
  scoreboard: {
    kicker: 'Calibration receipts',
    title: 'We publish accuracy. Nobody else does.',
    sub:
      'Every prediction we make is logged, then matched against what the bridge actually did. Per-port, last 30 days, on the same chart we use internally.',
  },
  delivery: {
    kicker: 'How it shows up',
    morning: {
      title: 'Morning briefing — 5am to your inbox',
      body: 'Top-3 watched ports ranked by predicted wait. Anomalies flagged with weather/event context. Accuracy footer for trust.',
    },
    anomaly: {
      title: 'Anomaly push — SMS + email',
      body: 'When a watched port runs ≥1.5× its 90-day baseline, we fire. EONET nearby-event context attached when relevant.',
    },
    whatsapp: {
      title: 'WhatsApp reply (queued)',
      body: 'Text "wait at Pharr" and get the live read. Lights up once Meta unblocks our number.',
    },
  },
  cta: {
    primary: 'Text us — we answer RGV brokers personally',
    secondary: 'Read the methodology',
  },
  pricing: {
    starter: { tier: 'Starter', price: '$99/mo', summary: '5 ports · briefing + SMS + email' },
    pro: { tier: 'Pro', price: '$299/mo', summary: '20 ports · WhatsApp · custom thresholds' },
    fleet: { tier: 'Fleet', price: '$999/mo', summary: '50 ports · multi-recipient · demo route' },
  },
  notAffiliated: 'Built on public CBP + BTS data. Not affiliated with CBP or DHS.',
};
