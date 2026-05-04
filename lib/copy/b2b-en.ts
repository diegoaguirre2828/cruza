// B2B portal copy (English). NO "AI" / "model" / "MCP" on customer surfaces.
// Per feedback_ai_as_infrastructure_not_product_20260430.md.

export const B2B_EN = {
  hero: {
    eyebrow: 'For RGV cross-border freight brokers · dispatchers · fleets',
    title: 'The border intelligence layer for your freight operation.',
    sub: "One 5am briefing. A push when something breaks. Calibration receipts that prove we called it right. The operators who know go first.",
    cta: 'Start free — 2 minutes',
    ctaSub: 'See live accuracy →',
  },
  accuracy: {
    kicker: 'Live results · 30 days',
    title: 'We publish every miss.',
    sub: 'Every forecast logged, then scored against what the bridge actually did. Per port. Same chart we use internally.',
  },
  howItWorks: {
    kicker: 'How it shows up',
    title: 'Three signals. One decision.',
    steps: [
      {
        n: '01',
        title: '5am brief',
        body: 'Port-by-port wait forecast arrives before your team briefs. Plan the day before the border opens.',
      },
      {
        n: '02',
        title: 'Anomaly push',
        body: 'When a port spikes 1.5× its baseline, you know before your drivers queue.',
      },
      {
        n: '03',
        title: 'Calibration receipt',
        body: 'Every call logged. Accuracy published. No black box — read the math yourself.',
      },
    ],
  },
  detentionMath: {
    title: 'Why the math works',
    body: '10 trucks × 1 wrong-bridge-pick/day × 30 min wasted × $85/hr = ~$10,200/mo bleeding. Insights Pro at $299/mo cuts about 30% of that. Net save: $2,800+/mo.',
    footnote:
      'Industry-wide: $3.6B/yr in direct detention losses, $11.5B/yr in lost productivity (ATRI 2024). 39% of stops detained.',
  },
  pricing: {
    kicker: 'Pricing',
    title: 'Simple tiers. Cancel any time.',
    starter: {
      tier: 'Starter',
      price: '$99 / mo',
      summary: '1 port · morning brief · anomaly push · email delivery',
    },
    pro: {
      tier: 'Pro',
      price: '$299 / mo',
      summary: 'Up to 5 ports · all channels · calibration dashboard',
    },
    fleet: {
      tier: 'Fleet',
      price: '$999 / mo',
      summary: 'Unlimited ports · API access · team seats · SLA',
    },
  },
  wizard: {
    step1: {
      title: 'What are you moving?',
      sub: 'We tune your briefing around your commodity profile.',
      options: [
        { value: 'perishables',   label: 'Perishables / produce' },
        { value: 'dry_goods',     label: 'Dry goods / general freight' },
        { value: 'hazmat',        label: 'Hazmat / regulated cargo' },
        { value: 'automotive',    label: 'Automotive / parts' },
        { value: 'retail',        label: 'Retail / consumer goods' },
        { value: 'mixed',         label: 'Mixed / full truckload' },
      ],
    },
    step2: {
      title: 'Which ports do you watch?',
      sub: 'Select the crossings your lanes run through. You can change this later.',
    },
    step3: {
      title: 'Create your free account.',
      sub: 'No credit card. Start reading the 5am brief tomorrow morning.',
      emailLabel: 'Work email',
      passwordLabel: 'Password',
      cta: 'Create account →',
      orDivider: 'or',
      googleCta: 'Continue with Google',
      alreadyHave: 'Already have an account?',
      signIn: 'Sign in →',
    },
    back: '← Back',
    next: 'Next →',
    progressOf: 'of',
  },
  notAffiliated:
    'Not affiliated with CBP, GSA, or any government agency. Wait-time data sourced from the CBP Border Wait Times API (public domain).',
  poweredBy: 'CRUZAR · RGV-MX CORRIDOR · 26.18°N · 98.18°W',
};
