import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { cx } from '../lib/utils.js'

const ToastContext = createContext(null)

const TONES = {
  success: {
    ring: 'border-kyy-400/30',
    bar: 'bg-kyy-400',
    icon: (
      <path d="M20 6 9 17l-5-5" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    ),
    color: 'text-kyy-300',
  },
  error: {
    ring: 'border-rose-500/30',
    bar: 'bg-rose-500',
    icon: (
      <>
        <path d="M18 6 6 18M6 6l12 12" strokeWidth="2.4" strokeLinecap="round" />
      </>
    ),
    color: 'text-rose-300',
  },
  info: {
    ring: 'border-sky-400/30',
    bar: 'bg-sky-400',
    icon: (
      <>
        <circle cx="12" cy="12" r="9" strokeWidth="2" />
        <path d="M12 11v5M12 7.6v.6" strokeWidth="2.2" strokeLinecap="round" />
      </>
    ),
    color: 'text-sky-300',
  },
  warning: {
    ring: 'border-amber-400/30',
    bar: 'bg-amber-400',
    icon: (
      <>
        <path d="M12 4 2.6 20h18.8z" strokeWidth="2" strokeLinejoin="round" />
        <path d="M12 10v4M12 17.2v.4" strokeWidth="2.2" strokeLinecap="round" />
      </>
    ),
    color: 'text-amber-300',
  },
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const timers = useRef(new Map())

  const dismiss = useCallback((id) => {
    setToasts((list) => list.filter((toast) => toast.id !== id))
    const timer = timers.current.get(id)
    if (timer) clearTimeout(timer)
    timers.current.delete(id)
  }, [])

  const push = useCallback(
    (message, { tone = 'info', title, duration = 4000 } = {}) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
      setToasts((list) => [...list.slice(-3), { id, message, tone, title }])
      const timer = setTimeout(() => dismiss(id), duration)
      timers.current.set(id, timer)
      return id
    },
    [dismiss],
  )

  const value = useMemo(
    () => ({
      push,
      dismiss,
      success: (message, options) => push(message, { ...options, tone: 'success' }),
      error: (message, options) => push(message, { ...options, tone: 'error', duration: 5200 }),
      info: (message, options) => push(message, { ...options, tone: 'info' }),
      warning: (message, options) => push(message, { ...options, tone: 'warning' }),
    }),
    [push, dismiss],
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-3 z-[70] flex flex-col items-center gap-2 px-3 sm:right-4 sm:left-auto sm:top-4 sm:items-end">
        <AnimatePresence initial={false}>
          {toasts.map((toast) => {
            const tone = TONES[toast.tone] || TONES.info
            return (
              <motion.div
                key={toast.id}
                layout
                initial={{ opacity: 0, y: -18, scale: 0.94 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, x: 32, scale: 0.94 }}
                transition={{ type: 'spring', stiffness: 420, damping: 30 }}
                onClick={() => dismiss(toast.id)}
                className={cx(
                  'pointer-events-auto relative w-full max-w-sm cursor-pointer overflow-hidden rounded-2xl border',
                  'glass-strong px-4 py-3 shadow-glass',
                  tone.ring,
                )}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={cx(
                      'mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white/5',
                      tone.color,
                    )}
                  >
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor">
                      {tone.icon}
                    </svg>
                  </span>
                  <div className="min-w-0 flex-1">
                    {toast.title && (
                      <p className="text-[13px] font-semibold text-slate-100">{toast.title}</p>
                    )}
                    <p className="break-words text-[13px] leading-snug text-slate-300">
                      {toast.message}
                    </p>
                  </div>
                </div>
                <motion.span
                  className={cx('absolute bottom-0 left-0 h-[2px]', tone.bar)}
                  initial={{ width: '100%' }}
                  animate={{ width: '0%' }}
                  transition={{ duration: 4.2, ease: 'linear' }}
                />
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx
}

export default ToastProvider
