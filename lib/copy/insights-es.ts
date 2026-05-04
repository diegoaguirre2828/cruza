// Spanish verbatim copy. Per feedback_bilingual_is_standard.md — bilingual
// is not a feature, it's table stakes for RGV/MX audience.

export const INSIGHTS_ES = {
  eyebrow: 'Para brokers · dispatchers · flotas RGV de carga transfronteriza',
  headline: {
    line1: 'La frontera siempre fue',
    accent: 'el hoyo negro.',
    sub: 'Sacamos tus camiones antes de que se cierre.',
  },
  subhead:
    'Un correo a las 5am + un aviso cuando algo se rompe. Monitorea tus carriles. Recibos que comprueban que le atinamos. Nada más.',
  detentionMath: {
    title: 'Por qué los números cuadran',
    body:
      '10 camiones × 1 puente equivocado/día × 30 min perdidos × $85/hr = ~$10,200/mes desangrando. Insights Pro a $299/mo corta ~30%. Neto: $2,800+/mes ahorrado.',
    footnote:
      'En toda la industria: $3.6B/año en pérdidas directas por detención, $11.5B/año en productividad perdida (ATRI 2024). 39% de las paradas detenidas.',
  },
  scoreboard: {
    kicker: 'Recibos de calibración',
    title: 'Publicamos precisión. Nadie más lo hace.',
    sub:
      'Cada predicción se registra y se compara con lo que realmente pasó en el puente. Por puerto, últimos 30 días, la misma gráfica que usamos internamente.',
  },
  delivery: {
    kicker: 'Cómo te llega',
    morning: {
      title: 'Briefing matutino — 5am a tu correo',
      body: 'Top-3 puertos vigilados ordenados por espera predicha. Anomalías marcadas con contexto de clima/eventos. Pie de precisión para confianza.',
    },
    anomaly: {
      title: 'Aviso de anomalía — SMS + correo',
      body: 'Cuando un puerto vigilado va ≥1.5× su baseline de 90 días, disparamos. Contexto de eventos cercanos (EONET) adjunto cuando aplica.',
    },
    whatsapp: {
      title: 'Respuesta por WhatsApp (en cola)',
      body: 'Escribe "espera en Pharr" y recibe la lectura viva. Activo en cuanto Meta libere nuestro número.',
    },
  },
  cta: {
    primary: 'Escríbenos — atendemos brokers del RGV personalmente',
    secondary: 'Lee la metodología',
  },
  pricing: {
    starter: { tier: 'Starter', price: '$99/mes', summary: '5 puertos · briefing + SMS + correo' },
    pro: { tier: 'Pro', price: '$299/mes', summary: '20 puertos · WhatsApp · umbrales personalizados' },
    fleet: { tier: 'Fleet', price: '$999/mes', summary: '50 puertos · multi-destinatario · demo' },
  },
  notAffiliated: 'Construido sobre datos públicos de CBP + BTS. Sin afiliación con CBP ni DHS.',
};
