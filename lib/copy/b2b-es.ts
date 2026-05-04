// B2B portal copy (Spanish). NO "IA" / "modelo" / "MCP" en superficies de cliente.

export const B2B_ES = {
  hero: {
    eyebrow: 'Para brokers de carga transfronteriza US-MX · despachadores · flotillas',
    title: 'Inteligencia fronteriza completa. Cada cruce. Un sustrato.',
    sub: "Un briefing a las 5am. Un push cuando algo se rompe. Recibos de calibración que prueban que lo predijimos bien. Los operadores que saben van primero.",
    cta: 'Empieza gratis — 2 minutos',
    ctaSub: 'Ver precisión en vivo →',
  },
  accuracy: {
    kicker: 'Resultados en vivo · 30 días',
    title: 'Publicamos cada falla.',
    sub: 'Cada predicción registrada, luego calificada contra lo que hizo el puente. Por puerto. La misma tabla que usamos internamente.',
  },
  howItWorks: {
    kicker: 'Cómo aparece',
    title: 'Tres señales. Una decisión.',
    steps: [
      {
        n: '01',
        title: 'Brief de 5am',
        body: 'El pronóstico por puerto llega antes de que tu equipo se briefee. Planea el día antes de que abra la frontera.',
      },
      {
        n: '02',
        title: 'Push de anomalía',
        body: 'Cuando un puerto sube 1.5× su línea base, tú sabes antes de que tus choferes hagan fila.',
      },
      {
        n: '03',
        title: 'Recibo de calibración',
        body: 'Cada predicción registrada. Precisión publicada. Sin caja negra — lee los números tú mismo.',
      },
    ],
  },
  detentionMath: {
    title: 'Por qué funciona la matemática',
    body: '10 tráilers × 1 mala elección de puente/día × 30 min perdidos × $85/hr = ~$10,200/mes de pérdida. Insights Pro a $299/mes corta ~30% de eso. Ahorro neto: $2,800+/mes.',
    footnote:
      'A nivel industria: $3.6B/año en pérdidas directas por detención, $11.5B/año en productividad perdida (ATRI 2024). 39% de las paradas detenidas.',
  },
  pricing: {
    kicker: 'Precios',
    title: 'Niveles simples. Cancela en cualquier momento.',
    starter: {
      tier: 'Starter',
      price: '$99 / mes',
      summary: '1 puerto · brief matutino · push de anomalía · entrega por email',
    },
    pro: {
      tier: 'Pro',
      price: '$299 / mes',
      summary: 'Hasta 5 puertos · todos los canales · dashboard de calibración',
    },
    fleet: {
      tier: 'Fleet',
      price: '$999 / mes',
      summary: 'Puertos ilimitados · acceso API · asientos para equipo · SLA',
    },
  },
  wizard: {
    step1: {
      title: '¿Qué estás moviendo?',
      sub: 'Afinamos tu briefing según tu perfil de carga.',
      options: [
        { value: 'perishables',   label: 'Perecederos / produce' },
        { value: 'dry_goods',     label: 'Carga seca / general' },
        { value: 'hazmat',        label: 'Hazmat / carga regulada' },
        { value: 'automotive',    label: 'Automotriz / partes' },
        { value: 'retail',        label: 'Retail / bienes de consumo' },
        { value: 'mixed',         label: 'Mixto / carga completa' },
      ],
    },
    step2: {
      title: '¿Cuáles puertos vigilas?',
      sub: 'Selecciona los cruces por donde corren tus rutas. Puedes cambiarlos después.',
    },
    step3: {
      title: 'Crea tu cuenta gratis.',
      sub: 'Sin tarjeta. Empieza a leer el brief de 5am mañana en la mañana.',
      emailLabel: 'Correo de trabajo',
      passwordLabel: 'Contraseña',
      cta: 'Crear cuenta →',
      orDivider: 'o',
      googleCta: 'Continuar con Google',
      alreadyHave: '¿Ya tienes cuenta?',
      signIn: 'Entrar →',
    },
    back: '← Atrás',
    next: 'Siguiente →',
    progressOf: 'de',
  },
  notAffiliated:
    'No afiliados con CBP, GSA, ni ninguna agencia gubernamental. Datos de tiempo de espera provenientes de la API pública de CBP Border Wait Times.',
  poweredBy: 'CRUZAR · CORREDOR RGV-MX · 26.18°N · 98.18°W',
};
