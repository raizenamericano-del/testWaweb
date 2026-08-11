import { memo, useId } from 'react'
import { motion } from 'framer-motion'

/**
 * KyyWA mark — pure SVG/CSS, no raster assets.
 * A rotating hexagonal orb with orbiting particles, a conic sweep and the
 * KyyDevv "K" cut out of the core.
 */
export const LogoMark = memo(function LogoMark({ size = 44, animated = true, className = '' }) {
  const uid = useId().replace(/:/g, '')
  const g = `g-${uid}`
  const gSoft = `gs-${uid}`
  const glow = `glow-${uid}`
  const sweep = `sweep-${uid}`

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={className}
      role="img"
      aria-label="KyyWA logo"
    >
      <defs>
        <linearGradient id={g} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#1fe9c8" />
          <stop offset="50%" stopColor="#22d3ee" />
          <stop offset="100%" stopColor="#a98bff" />
        </linearGradient>
        <linearGradient id={gSoft} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor="#1fe9c8" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#a98bff" stopOpacity="0.35" />
        </linearGradient>
        <radialGradient id={sweep}>
          <stop offset="0%" stopColor="#1fe9c8" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#1fe9c8" stopOpacity="0" />
        </radialGradient>
        <filter id={glow} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="3.2" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* outer hex ring */}
      <motion.g
        style={{ originX: '50px', originY: '50px' }}
        animate={animated ? { rotate: 360 } : undefined}
        transition={{ duration: 26, repeat: Infinity, ease: 'linear' }}
      >
        <path
          d="M50 6 88 28v44L50 94 12 72V28z"
          fill="none"
          stroke={`url(#${g})`}
          strokeWidth="2.4"
          strokeLinejoin="round"
          opacity="0.95"
        />
        <circle cx="50" cy="6" r="3.1" fill="#1fe9c8" filter={`url(#${glow})`} />
        <circle cx="88" cy="72" r="2.3" fill="#a98bff" filter={`url(#${glow})`} />
        <circle cx="12" cy="28" r="1.9" fill="#22d3ee" filter={`url(#${glow})`} />
      </motion.g>

      {/* inner counter-rotating hex */}
      <motion.path
        d="M50 18 78 34v32L50 82 22 66V34z"
        fill={`url(#${gSoft})`}
        stroke={`url(#${g})`}
        strokeWidth="1.1"
        strokeOpacity="0.5"
        style={{ originX: '50px', originY: '50px' }}
        animate={animated ? { rotate: -360 } : undefined}
        transition={{ duration: 38, repeat: Infinity, ease: 'linear' }}
      />

      {/* pulsing core glow */}
      <motion.circle
        cx="50"
        cy="50"
        r="21"
        fill={`url(#${sweep})`}
        animate={animated ? { opacity: [0.35, 0.75, 0.35], scale: [0.94, 1.06, 0.94] } : undefined}
        transition={{ duration: 3.4, repeat: Infinity, ease: 'easeInOut' }}
        style={{ originX: '50px', originY: '50px' }}
      />

      {/* the K */}
      <g filter={`url(#${glow})`}>
        <path
          d="M38 30h8.4v15.6L61 30h10.4L55.6 47.4 72 70H61.4L46.4 51.8V70H38z"
          fill={`url(#${g})`}
        />
      </g>
    </svg>
  )
})

export function LogoWordmark({ size = 40, subtitle = true, animated = true, compact = false }) {
  return (
    <div className="flex items-center gap-3">
      <motion.div
        whileHover={{ scale: 1.07, rotate: 4 }}
        transition={{ type: 'spring', stiffness: 320, damping: 16 }}
        className="relative grid place-items-center"
      >
        <LogoMark size={size} animated={animated} />
      </motion.div>
      {!compact && (
        <div className="leading-none">
          <div className="flex items-baseline gap-1">
            <span
              className="text-[19px] font-black tracking-tight gradient-text"
              style={{ letterSpacing: '-0.02em' }}
            >
              KyyWA
            </span>
            <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-kyy-400/70">
              web
            </span>
          </div>
          {subtitle && (
            <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
              by KyyDevv
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default LogoMark
