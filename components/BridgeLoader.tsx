'use client'

import { motion } from 'framer-motion'
import { useLang } from '@/lib/LangContext'

// "Transit-board precision" loader. Animated bridge truss SVG that
// fills left→right while the home screen is hydrating + the user's
// home region is being resolved. Replaces the 6-skeleton-card pulse
// that read as "hydrating website" instead of "app booting."
//
// No external Lottie dependency — inline SVG + framer-motion keeps it
// in the same render pass + matches the rest of the app's aesthetic.

export function BridgeLoader() {
  const { lang } = useLang()
  const es = lang === 'es'

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-6 px-6 text-center">
      <motion.svg
        viewBox="0 0 240 80"
        className="w-56 h-auto"
        initial="hidden"
        animate="visible"
      >
        {/* Roadbed */}
        <motion.line
          x1="0" y1="56" x2="240" y2="56"
          stroke="currentColor"
          strokeWidth="2"
          className="text-blue-500/30 dark:text-blue-400/40"
          variants={{
            hidden: { pathLength: 0, opacity: 0 },
            visible: { pathLength: 1, opacity: 1, transition: { duration: 0.8, ease: 'easeOut' } },
          }}
        />
        {/* Suspension cable arc */}
        <motion.path
          d="M 12 56 Q 120 12 228 56"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          className="text-blue-500 dark:text-blue-400"
          variants={{
            hidden: { pathLength: 0, opacity: 0 },
            visible: { pathLength: 1, opacity: 1, transition: { duration: 1.1, ease: 'easeOut', delay: 0.15 } },
          }}
        />
        {/* Towers */}
        {[28, 212].map((x, i) => (
          <motion.rect
            key={x}
            x={x - 2.5} y={20} width={5} height={36} rx={1.5}
            className="fill-blue-600 dark:fill-blue-400"
            variants={{
              hidden: { opacity: 0, y: -8 },
              visible: { opacity: 1, y: 0, transition: { duration: 0.4, delay: 0.4 + i * 0.08 } },
            }}
          />
        ))}
        {/* Suspension lines */}
        {[60, 96, 144, 180].map((x, i) => (
          <motion.line
            key={x}
            x1={x} y1={56}
            x2={x}
            y2={20 + 32 * (1 - Math.sin(((x - 12) / 216) * Math.PI))}
            stroke="currentColor"
            strokeWidth="1"
            className="text-blue-500/60 dark:text-blue-400/70"
            variants={{
              hidden: { opacity: 0 },
              visible: { opacity: 1, transition: { duration: 0.3, delay: 0.7 + i * 0.06 } },
            }}
          />
        ))}
        {/* Travelling pulse — a tiny dot crossing the bridge, looping */}
        <motion.circle
          r={3}
          cy={56}
          className="fill-emerald-400 dark:fill-emerald-300"
          initial={{ cx: 12 }}
          animate={{ cx: [12, 228, 12] }}
          transition={{
            duration: 2.4,
            ease: 'easeInOut',
            repeat: Infinity,
            delay: 1.2,
          }}
        />
      </motion.svg>

      <div>
        <p className="text-sm font-bold text-gray-900 dark:text-gray-100 tracking-tight">
          {es ? 'Cargando puentes cerca de ti' : 'Loading bridges near you'}
        </p>
        <p className="text-[11px] uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400 mt-1.5">
          {es ? 'CBP · en vivo' : 'CBP · live'}
        </p>
      </div>
    </div>
  )
}
