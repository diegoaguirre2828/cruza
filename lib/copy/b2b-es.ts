// B2B portal copy (Spanish). NO "IA" / "modelo" / "MCP" en superficies de cliente.

export const B2B_ES = {
  hero: {
    eyebrow: 'Para brokers de carga transfronteriza US-MX · despachadores · flotillas',
    title: '¿Esta carga cruza limpio y llega a tiempo a su cita?',
    sub: 'Una respuesta. Cada embarque. Inteligencia de cruce, revisión de documentos, probabilidad de cita y rastreo para el receptor — todo en un solo registro firmado.',
    cta: 'Empieza gratis — 2 minutos',
    ctaSub: 'Ver precisión en vivo →',
  },
  accuracy: {
    kicker: 'Resultados en vivo · 30 días',
    title: 'Publicamos cada falla.',
    sub: 'Cada predicción registrada, luego calificada contra lo que hizo el puente. Por puerto. La misma tabla que usamos internamente.',
  },
  layers: {
    kicker: 'Cómo funciona',
    title: 'Cuatro capas. Una decisión de cruce.',
    sub: 'Cada módulo corre en segundo plano. Tú recibes una respuesta.',
    items: [
      {
        n: '01',
        label: 'Inteligencia de Cruce',
        title: 'Qué puente. A qué hora. Si llegan a tiempo.',
        body: 'Brief de las 5am + push de anomalía + ETA de carga con probabilidad de cita. Sabe antes de que tu chofer haga fila.',
      },
      {
        n: '02',
        label: 'Cumplimiento',
        title: 'Si esta carga cruza sin problemas.',
        body: 'Verificación USMCA, validación aduanal, escaneo de documentos, HOS del chofer. Detectamos los errores que niegan tu certificado USMCA en CBP — señala banderas antes del puente, no en él.',
      },
      {
        n: '03',
        label: 'Recuperación',
        title: 'Dinero que ya te deben.',
        body: 'Reembolsos IEEPA, drawback, recuperación de aranceles. La Suprema Corte anuló los aranceles — los reembolsos no son automáticos. Nosotros lo tramitamos.',
      },
      {
        n: '04',
        label: 'Rastreo para el Receptor',
        title: 'Tu receptor ve el cruce en tiempo real.',
        body: 'Comparte un link. El almacén, el taller, el distribuidor recibe confirmación de cruce sin necesidad de cuenta.',
      },
    ],
  },
  detentionMath: {
    title: 'La matemática es simple.',
    body: '10 tráilers × 1 mala elección de puente/día × 30 min perdidos × $85/hr = ~$10,200/mes de pérdida. Suma los aranceles IEEPA que pagaste de más — la mayoría de los operadores tienen $15K–$80K sin reclamar en ACE del CBP. Cruzar recupera ambos.',
    footnote:
      'A nivel industria: $3.6B/año en pérdidas por detención (ATRI 2024). Aranceles IEEPA anulados el 24 Feb 2026 — los reembolsos requieren trámite activo en ACE.',
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
