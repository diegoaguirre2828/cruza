'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, CheckSquare, Square, RotateCcw, Share2, Check } from 'lucide-react'
import { useLang } from '@/lib/LangContext'

type Direction = 'us' | 'mx'

interface ChecklistItem {
  id: string
  text: { en: string; es: string }
  note?: { en: string; es: string }
  required: boolean
}

const CHECKLIST_US: ChecklistItem[] = [
  {
    id: 'passport',
    text: { en: 'Passport or passport card', es: 'Pasaporte o tarjeta de pasaporte' },
    note: { en: 'Required for all US citizens. Children need their own.', es: 'Obligatorio para todos los ciudadanos de EE.UU. Los menores necesitan el suyo.' },
    required: true,
  },
  {
    id: 'nexus_sentri',
    text: { en: 'SENTRI / NEXUS card (if enrolled)', es: 'Tarjeta SENTRI / NEXUS (si estás inscrito)' },
    note: { en: 'Use dedicated lanes to save significant wait time.', es: 'Usa los carriles exclusivos para ahorrar tiempo de espera.' },
    required: false,
  },
  {
    id: 'vehicle_docs',
    text: { en: 'Vehicle registration & proof of insurance', es: 'Tarjeta de circulación y comprobante de seguro del vehículo' },
    note: { en: 'CBP officers may ask for these at the primary inspection.', es: 'Los agentes de aduana pueden solicitarlos en la inspección primaria.' },
    required: true,
  },
  {
    id: 'declaration',
    text: { en: 'Know your duty-free limit: $800 per person', es: 'Conoce tu límite libre de impuestos: $800 por persona' },
    note: { en: 'Items above this value must be declared. $1,600 for alcohol (limited to 1L duty-free).', es: 'Los artículos que superen este valor deben declararse. Límite de 1L de alcohol libre de impuestos.' },
    required: true,
  },
  {
    id: 'food',
    text: { en: 'Check food items — most fresh fruits, meats & plants are prohibited', es: 'Revisa los alimentos — la mayoría de frutas frescas, carnes y plantas están prohibidas' },
    note: { en: 'Packaged/commercially sealed foods are generally OK. Ask CBP if unsure.', es: 'Los alimentos envasados comercialmente generalmente están permitidos. Pregunta a la aduana si tienes dudas.' },
    required: true,
  },
  {
    id: 'cash',
    text: { en: 'Declare cash over $10,000 USD (or equivalent)', es: 'Declara efectivo superior a $10,000 USD (o equivalente)' },
    note: { en: 'This is a legal requirement, not a tax. Failing to declare can result in seizure.', es: 'Es un requisito legal, no un impuesto. No declararlo puede resultar en confiscación.' },
    required: true,
  },
  {
    id: 'alcohol_tobacco',
    text: { en: 'Alcohol: 1 liter duty-free. Tobacco: 200 cigarettes duty-free', es: 'Alcohol: 1 litro libre de impuestos. Tabaco: 200 cigarrillos libres de impuestos' },
    note: { en: 'Must be 21+ for alcohol. Additional quantities are taxed.', es: 'Debes ser mayor de 21 años para el alcohol. Las cantidades adicionales tienen impuestos.' },
    required: false,
  },
  {
    id: 'receipts',
    text: { en: 'Keep receipts for expensive purchases made in Mexico', es: 'Guarda los recibos de compras costosas realizadas en México' },
    note: { en: 'CBP can ask for proof of value on items you\'re bringing back.', es: 'La aduana puede pedir comprobante del valor de los artículos que traes.' },
    required: false,
  },
  {
    id: 'prohibited_us',
    text: { en: 'No firearms or ammunition without proper permits', es: 'No armas de fuego ni municiones sin los permisos correspondientes' },
    note: { en: 'Carrying firearms into Mexico without permits is a serious federal crime.', es: 'Introducir armas a México sin permisos es un delito federal grave.' },
    required: true,
  },
]

const CHECKLIST_MX: ChecklistItem[] = [
  {
    id: 'mx_passport',
    text: { en: 'Valid ID — passport, passport card, or enhanced driver\'s license', es: 'Identificación válida — pasaporte, tarjeta de pasaporte o licencia mejorada' },
    note: { en: 'Mexican nationals: your Mexican ID or passport.', es: 'Ciudadanos mexicanos: tu credencial del INE o pasaporte.' },
    required: true,
  },
  {
    id: 'mx_insurance',
    text: { en: 'Mexico auto insurance (required by law)', es: 'Seguro de auto para México (obligatorio por ley)' },
    note: { en: 'Your US policy is NOT valid in Mexico. Get covered before you cross.', es: 'Tu seguro de EE.UU. NO es válido en México. Asegúrate antes de cruzar.' },
    required: true,
  },
  {
    id: 'fmm',
    text: { en: 'Tourist card (FMM) if traveling beyond the border zone', es: 'Forma Migratoria Múltiple (FMM) si viajas más allá de la zona fronteriza' },
    note: { en: 'Not required for stays within ~20km of the border. Required for interior travel.', es: 'No se requiere para estancias dentro de ~20km de la frontera. Obligatoria para viajes al interior.' },
    required: false,
  },
  {
    id: 'vehicle_permit',
    text: { en: 'Temporary vehicle import permit if going past the border zone', es: 'Permiso temporal de importación de vehículo si vas más allá de la zona fronteriza' },
    note: { en: 'Required for travel into Mexico\'s interior. Get it at the border crossing or online at banjercito.com.mx', es: 'Requerido para viajar al interior de México. Obtenlo en el cruce o en línea en banjercito.com.mx' },
    required: false,
  },
  {
    id: 'mx_cash',
    text: { en: 'Pesos or USD cash — many Mexico businesses don\'t accept US cards', es: 'Pesos o dólares en efectivo — muchos negocios en México no aceptan tarjetas de EE.UU.' },
    note: { en: 'ATMs are available near crossings but foreign transaction fees apply.', es: 'Hay cajeros automáticos cerca de los cruces, pero pueden aplicar cargos por transacciones extranjeras.' },
    required: false,
  },
  {
    id: 'mx_customs_limit',
    text: { en: 'Duty-free limit into Mexico: $500 USD of goods', es: 'Límite libre de impuestos al entrar a México: $500 USD en mercancía' },
    note: { en: 'Electronics, clothing, and personal items within this limit won\'t be taxed.', es: 'Electrónicos, ropa y artículos personales dentro de este límite no pagan impuestos.' },
    required: true,
  },
  {
    id: 'mx_prohibited',
    text: { en: 'No firearms, ammunition, or weapons without permits', es: 'No armas de fuego, municiones ni armas sin permisos' },
    note: { en: 'Mexico has extremely strict gun laws. This is a serious federal crime.', es: 'México tiene leyes de armas extremadamente estrictas. Es un delito federal grave.' },
    required: true,
  },
  {
    id: 'mx_food',
    text: { en: 'Bringing food? Processed/packaged goods are generally OK', es: '¿Llevas comida? Los productos procesados/empacados generalmente están permitidos' },
    note: { en: 'Fresh produce and meats may be inspected or restricted.', es: 'Las frutas y carnes frescas pueden ser inspeccionadas o restringidas.' },
    required: false,
  },
]

const TIPS = {
  us: {
    en: [
      '🚗 Pull up to the booth calmly. Have your documents ready before you reach the agent.',
      '📱 Do not use your phone at the inspection booth.',
      '🐾 Pets need health certificates from a licensed vet issued within 10 days.',
      '⏰ Mid-morning on weekdays (9am–11am) typically has shorter waits.',
      '🟢 SENTRI lane is almost always open and dramatically faster — worth enrolling if you cross regularly.',
    ],
    es: [
      '🚗 Acércate al puesto con calma. Ten tus documentos listos antes de llegar al agente.',
      '📱 No uses el teléfono en el puesto de inspección.',
      '🐾 Las mascotas necesitan certificado de salud de un veterinario licenciado expedido en los últimos 10 días.',
      '⏰ Entre semana por la mañana (9am–11am) generalmente tiene menos espera.',
      '🟢 El carril SENTRI casi siempre está abierto y es mucho más rápido — vale la pena inscribirse si cruzas frecuentemente.',
    ],
  },
  mx: {
    en: [
      '🟢 Most crossings into Mexico have minimal inspection — expect 1–5 minutes.',
      '🎲 Mexican customs uses a random "traffic light" system — green means go, red means inspection.',
      '📋 The random inspection is standard and not cause for concern if you have nothing to declare.',
      '⏽ Tourist card (FMM) required if staying more than 72 hours or traveling beyond the border zone.',
      '🛡️ Always buy Mexico insurance — even a minor fender bender can result in vehicle impoundment without it.',
    ],
    es: [
      '🟢 La mayoría de los cruces a México tienen inspección mínima — espera de 1 a 5 minutos.',
      '🎲 La aduana mexicana usa un sistema de "semáforo" aleatorio — verde significa pasar, rojo significa inspección.',
      '📋 La inspección aleatoria es normal y no hay motivo de preocupación si no tienes nada que declarar.',
      '⏽ La FMM es necesaria si te quedas más de 72 horas o viajas más allá de la zona fronteriza.',
      '🛡️ Siempre compra seguro para México — hasta un pequeño accidente puede resultar en la retención del vehículo sin él.',
    ],
  },
}

export default function CustomsPage() {
  const { lang } = useLang()
  const [direction, setDirection] = useState<Direction>('us')
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [shared, setShared] = useState(false)

  const checklist = direction === 'us' ? CHECKLIST_US : CHECKLIST_MX
  const tips = TIPS[direction][lang]
  const completed = checklist.filter(i => checked.has(i.id)).length
  const total = checklist.length

  function toggle(id: string) {
    setChecked(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function reset() {
    setChecked(new Set())
  }

  function share() {
    const title = lang === 'es'
      ? `Lista de verificación para cruzar a ${direction === 'us' ? 'EE.UU.' : 'México'} — Cruza`
      : `${direction === 'us' ? 'Entering the US' : 'Entering Mexico'} crossing checklist — Cruza`
    if (navigator.share) {
      navigator.share({ title, url: window.location.href }).catch(() => {})
    } else {
      navigator.clipboard.writeText(window.location.href).catch(() => {})
    }
    setShared(true)
    setTimeout(() => setShared(false), 2000)
  }

  const t = {
    title: lang === 'es' ? '✅ Guía de Cruce' : '✅ Crossing Guide',
    subtitle: lang === 'es' ? 'Lista de verificación interactiva para cruzar sin problemas.' : 'Interactive checklist for a smooth crossing.',
    enterUS: lang === 'es' ? '🇺🇸 Entrando a EE.UU.' : '🇺🇸 Entering the US',
    enterMX: lang === 'es' ? '🇲🇽 Entrando a México' : '🇲🇽 Entering Mexico',
    progress: lang === 'es' ? `${completed} de ${total} revisados` : `${completed} of ${total} checked`,
    ready: lang === 'es' ? '¡Listo para cruzar! 🎉' : 'Ready to cross! 🎉',
    required: lang === 'es' ? 'Obligatorio' : 'Required',
    reset: lang === 'es' ? 'Reiniciar' : 'Reset',
    tips: lang === 'es' ? '💡 Consejos rápidos' : '💡 Quick tips',
    insurance: lang === 'es' ? '¿Necesitas seguro para México?' : 'Need Mexico auto insurance?',
    insuranceLink: lang === 'es' ? 'Ver proveedores →' : 'See providers →',
    back: lang === 'es' ? 'Guía fronteriza' : 'Border Guide',
  }

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-lg mx-auto px-4 pb-16">

        {/* Header */}
        <div className="pt-6 pb-2">
          <Link href="/guide" className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 mb-3 transition-colors">
            <ArrowLeft className="w-3 h-3" /> {t.back}
          </Link>
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t.title}</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t.subtitle}</p>
            </div>
            <button
              onClick={share}
              className="p-2 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex-shrink-0 ml-3"
            >
              {shared ? <Check className="w-4 h-4 text-green-500" /> : <Share2 className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Direction toggle */}
        <div className="flex bg-gray-100 dark:bg-gray-800 rounded-xl p-1 mt-4 mb-5">
          <button
            onClick={() => { setDirection('us'); setChecked(new Set()) }}
            className={`flex-1 py-2.5 text-xs font-semibold rounded-lg transition-colors ${
              direction === 'us' ? 'bg-white dark:bg-gray-700 shadow text-gray-900 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400'
            }`}
          >
            {t.enterUS}
          </button>
          <button
            onClick={() => { setDirection('mx'); setChecked(new Set()) }}
            className={`flex-1 py-2.5 text-xs font-semibold rounded-lg transition-colors ${
              direction === 'mx' ? 'bg-white dark:bg-gray-700 shadow text-gray-900 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400'
            }`}
          >
            {t.enterMX}
          </button>
        </div>

        {/* Progress bar */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 px-4 py-3 mb-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">
              {completed === total ? t.ready : t.progress}
            </p>
            <button onClick={reset} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
              <RotateCcw className="w-3 h-3" /> {t.reset}
            </button>
          </div>
          <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all duration-300 ${completed === total ? 'bg-green-500' : 'bg-blue-500'}`}
              style={{ width: `${total > 0 ? (completed / total) * 100 : 0}%` }}
            />
          </div>
        </div>

        {/* Mexico insurance reminder (for MX direction) */}
        {direction === 'mx' && (
          <Link href="/insurance" className="flex items-center justify-between bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-2xl px-4 py-3 mb-4 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-colors">
            <p className="text-xs font-semibold text-indigo-800 dark:text-indigo-300">🛡️ {t.insurance}</p>
            <span className="text-xs font-medium text-indigo-600 dark:text-indigo-400">{t.insuranceLink}</span>
          </Link>
        )}

        {/* Checklist */}
        <div className="space-y-2 mb-6">
          {checklist.map(item => {
            const isChecked = checked.has(item.id)
            return (
              <button
                key={item.id}
                onClick={() => toggle(item.id)}
                className={`w-full text-left rounded-2xl border p-4 transition-all ${
                  isChecked
                    ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                    : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                } shadow-sm`}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 mt-0.5">
                    {isChecked
                      ? <CheckSquare className="w-5 h-5 text-green-500" />
                      : <Square className="w-5 h-5 text-gray-300 dark:text-gray-600" />
                    }
                  </div>
                  <div className="flex-1">
                    <div className="flex items-start gap-2">
                      <p className={`text-sm font-medium leading-snug ${isChecked ? 'text-green-800 dark:text-green-300 line-through decoration-green-400' : 'text-gray-900 dark:text-gray-100'}`}>
                        {lang === 'es' ? item.text.es : item.text.en}
                      </p>
                      {item.required && !isChecked && (
                        <span className="flex-shrink-0 text-xs font-bold text-red-500 bg-red-50 dark:bg-red-900/30 dark:text-red-400 px-1.5 py-0.5 rounded-full">
                          {t.required}
                        </span>
                      )}
                    </div>
                    {item.note && (
                      <p className={`text-xs mt-1 leading-relaxed ${isChecked ? 'text-green-600 dark:text-green-500' : 'text-gray-500 dark:text-gray-400'}`}>
                        {lang === 'es' ? item.note.es : item.note.en}
                      </p>
                    )}
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        {/* Tips */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">{t.tips}</h2>
          <ul className="space-y-2.5">
            {tips.map((tip, i) => (
              <li key={i} className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">{tip}</li>
            ))}
          </ul>
        </div>
      </div>
    </main>
  )
}
