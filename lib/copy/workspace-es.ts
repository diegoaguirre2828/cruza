// lib/copy/workspace-es.ts
export const WORKSPACE_ES = {
  hero: {
    eyebrow: 'Workspace',
    title: 'Tu substrato de frontera, en un solo lugar.',
    sub: 'Cada módulo al que tienes acceso. Conteos en vivo. Actividad reciente entre todos. Abre una herramienta, todas siguen ligadas por el Cruzar Ticket.',
  },
  quick_actions: {
    eyebrow: 'Acciones rápidas',
    new_refund_scan: 'Escaneo de reembolso gratis',
    new_eudamed_scan: 'Verificación EUDAMED',
    new_ticket: 'Componer Cruzar Ticket',
    open_dispatch: 'Abrir dispatch (monitor en vivo)',
  },
  modules: {
    eyebrow: 'Módulos',
    refunds: {
      title: 'Reembolsos IEEPA',
      sub: 'CAPE Fase 1 + paquetes de protesta Form 19. Presentado por tu agente.',
      stat_open_claims: 'reclamos abiertos',
      stat_pending: 'pendiente recuperable',
      stat_received: 'reembolsos recibidos',
      open_link: 'Abrir reembolsos',
    },
    eudamed: {
      title: 'EU MDR / EUDAMED',
      sub: 'Feed de actor + UDI/dispositivo para medtech Reynosa. Obligatorio 28 mayo 2026.',
      stat_actors: 'actores registrados',
      stat_udi: 'registros UDI listos',
      open_link: 'Abrir EU MDR',
    },
    paperwork: {
      title: 'Escáner de papelería',
      sub: 'Clasificación de documentos, validación de certificados sanitarios MX, extracción multi-página.',
      stat_extractions: 'extracciones (30d)',
      stat_blocking: 'problemas bloqueantes',
      open_link: 'Abrir papelería',
    },
    drivers: {
      title: 'Cumplimiento de operadores',
      sub: 'USMCA Anexo 31-A · IMSS · HOS doble régimen · DOT 49 CFR Parte 40 · drayage Borello.',
      stat_runs: 'corridas (30d)',
      stat_flagged: 'marcados',
      open_link: 'Abrir cumplimiento operadores',
    },
    customs: {
      title: 'Validación aduanal',
      sub: 'Clasificación HS + origen USMCA + VCR + bandera LIGIE — compone Cruzar Ticket.',
      stat_validations: 'validaciones (30d)',
      open_link: 'Correr declaración aduanal',
    },
    regulatory: {
      title: 'Notificación pre-arribo',
      sub: 'FDA Prior Notice · USDA APHIS · ISF 10+2 · CBP 7501 · PDF multi-página para agente.',
      stat_submissions: 'presentaciones (30d)',
      open_link: 'Abrir regulatorio',
    },
    insights: {
      title: 'Insights y dispatch',
      sub: 'Monitor de espera en vivo + alertas de anomalía + briefing matutino.',
      stat_tier: 'tier',
      stat_watched: 'puertos vigilados',
      stat_no_subscription: 'Sin suscripción activa',
      open_link: 'Abrir dispatch',
      sales_link: 'Ver precios',
    },
    tickets: {
      title: 'Cruzar Tickets',
      sub: 'El substrato firmado en el que cada módulo compone. Escudo de auditoría + cadena Ed25519.',
      stat_total: 'tickets totales',
      stat_recent: 'en últimos 30d',
      open_link: 'Ver tickets',
    },
  },
  activity: {
    eyebrow: 'Actividad reciente',
    empty: 'Aún nada — tu actividad entre todos los módulos aparece aquí.',
  },
  shared: {
    powered_by: 'Cruzar Ticket · Un substrato · Construido en la frontera, para la frontera',
    legal_disclaimer: 'Cruzar es software para preparar documentación aduanal y regulatoria transfronteriza. Cruzar no realiza trámites ante CBP o VUCEM y no es agente aduanal licenciado. Las presentaciones deben ser revisadas y enviadas por el agente aduanal licenciado de récord o la parte regulada responsable. Los reembolsos los paga CBP directamente al ACH del importador; Cruzar nunca custodia el dinero del reembolso.',
  },
};
