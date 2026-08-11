import { motion } from 'framer-motion'
import { LogoMark } from './Logo.jsx'

const LINES = ['Booting secure bridge', 'Restoring session', 'Almost there']

export default function Splash({ phase = 0 }) {
  return (
    <motion.div
      className="fixed inset-0 z-[80] grid place-items-center overflow-hidden bg-ink-950"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, filter: 'blur(14px)', scale: 1.06 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* animated mesh backdrop */}
      <div className="pointer-events-none absolute inset-0 bg-mesh" />
      <motion.div
        className="pointer-events-none absolute left-1/2 top-1/2 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          background:
            'radial-gradient(circle, rgba(31,233,200,.18) 0%, rgba(139,92,246,.10) 42%, transparent 68%)',
        }}
        animate={{ scale: [1, 1.14, 1], opacity: [0.65, 1, 0.65] }}
        transition={{ duration: 4.4, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* grid floor */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 opacity-[0.13]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(31,233,200,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(31,233,200,.5) 1px, transparent 1px)',
          backgroundSize: '46px 46px',
          maskImage: 'linear-gradient(to top, black, transparent)',
          WebkitMaskImage: 'linear-gradient(to top, black, transparent)',
          transform: 'perspective(340px) rotateX(62deg)',
          transformOrigin: 'bottom',
        }}
      />

      <div className="relative flex flex-col items-center gap-7 px-6">
        <motion.div
          initial={{ scale: 0.55, opacity: 0, rotate: -25 }}
          animate={{ scale: 1, opacity: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 180, damping: 15 }}
          className="relative"
        >
          <span className="absolute inset-0 -z-10 rounded-full bg-kyy-400/25 blur-2xl" />
          <LogoMark size={112} />
        </motion.div>

        <div className="text-center">
          <motion.h1
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18, duration: 0.5 }}
            className="text-4xl font-black tracking-tight sm:text-5xl"
          >
            <span className="gradient-text">Kyy</span>
            <span className="text-slate-100">WA</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.32 }}
            className="mt-2 text-[11px] font-bold uppercase tracking-[0.42em] text-slate-500"
          >
            by KyyDevv
          </motion.p>
        </div>

        {/* progress */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="w-60"
        >
          <div className="h-[3px] w-full overflow-hidden rounded-full bg-white/[0.07]">
            <motion.div
              className="h-full rounded-full bg-kyy-gradient"
              initial={{ width: '4%' }}
              animate={{ width: ['4%', '46%', '78%', '100%'] }}
              transition={{ duration: 2.1, ease: [0.22, 1, 0.36, 1], times: [0, 0.35, 0.7, 1] }}
            />
          </div>
          <div className="mt-3 h-4 text-center">
            <motion.span
              key={phase}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-[11px] font-medium tracking-wide text-slate-500"
            >
              {LINES[Math.min(phase, LINES.length - 1)]}…
            </motion.span>
          </div>
        </motion.div>
      </div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.9 }}
        className="absolute bottom-7 text-[10px] tracking-wide text-slate-600"
      >
        Unofficial WhatsApp client · use at your own risk
      </motion.p>
    </motion.div>
  )
}
