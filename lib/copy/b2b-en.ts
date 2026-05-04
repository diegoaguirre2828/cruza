// B2B portal copy (English). NO "AI" / "model" / "MCP" on customer surfaces.
// Per feedback_ai_as_infrastructure_not_product_20260430.md.

export const B2B_EN = {
  hero: {
    eyebrow: 'For US-MX cross-border freight brokers · dispatchers · fleets',
    title: 'Will this load cross clean and make the appointment?',
    sub: "One answer. Every shipment. Crossing intelligence, compliance check, appointment probability, and receiver tracking — composed into a single signed record.",
    cta: 'Start free — 2 minutes',
    ctaSub: 'See live accuracy →',
  },
  accuracy: {
    kicker: 'Live results · 30 days',
    title: 'We publish every miss.',
    sub: 'Every forecast logged, then scored against what the bridge actually did. Per port. Same chart we use internally.',
  },
  layers: {
    kicker: 'How it works',
    title: 'Four layers. One crossing decision.',
    sub: 'Every module runs in the background. You get one answer.',
    items: [
      {
        n: '01',
        label: 'Crossing Intelligence',
        title: 'Which port. What time. Will they make it.',
        body: '5am brief + live anomaly push + load ETA with appointment probability. Know before your driver queues.',
      },
      {
        n: '02',
        label: 'Compliance',
        title: 'Does this load cross clean.',
        body: 'USMCA cert check, customs validation, paperwork scan, driver HOS. Flags before the bridge, not at it.',
      },
      {
        n: '03',
        label: 'Recovery',
        title: 'Money you\'re already owed.',
        body: 'IEEPA refunds, drawback, duty recovery. The Supreme Court struck down the tariffs — the refunds aren\'t automatic. We file it.',
      },
      {
        n: '04',
        label: 'Receiver Tracking',
        title: 'Your receiver sees it cross.',
        body: 'Share a status link. The warehouse, the repair shop, the parts distributor gets live crossing confirmation without a login.',
      },
    ],
  },
  detentionMath: {
    title: 'The math is simple.',
    body: '10 trucks × 1 wrong-bridge-pick/day × 30 min wasted × $85/hr = ~$10,200/mo bleeding out. Add the IEEPA duties you overpaid on non-USMCA freight — most operators have $15K–$80K sitting in CBP\'s ACE system unclaimed. Cruzar gets both back.',
    footnote:
      'Industry-wide: $3.6B/yr in direct detention losses, $11.5B/yr in lost productivity (ATRI 2024). IEEPA tariffs struck down Feb 24, 2026 — refunds require active filing in ACE.',
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
