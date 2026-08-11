import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

import { LogoWordmark } from './Logo.jsx'
import { useToast } from './Toast.jsx'
import { api } from '../lib/api.js'
import { cx } from '../lib/utils.js'
import {
  IconQr,
  IconKeypad,
  IconRefresh,
  IconWarning,
  IconLink,
  IconCheck,
  IconLogout,
  IconSun,
  IconMoon,
} from './Icons.jsx'

const STEPS = [
  'Open WhatsApp on your phone',
  'Tap Menu · Settings → Linked devices',
  'Tap “Link a device”',
]

const STATE_META = {
  idle: { label: 'Idle', tone: 'slate', pulse: false },
  connecting: { label: 'Connecting', tone: 'amber', pulse: true },
  waiting_qr: { label: 'Waiting for scan', tone: 'sky', pulse: true },
  waiting_pairing: { label: 'Waiting for pairing', tone: 'sky', pulse: true },
  connected: { label: 'Connected', tone: 'kyy', pulse: false },
  disconnected: { label: 'Disconnected', tone: 'rose', pulse: false },
  logged_out: { label: 'Logged out', tone: 'rose', pulse: false },
  error: { label: 'Error', tone: 'rose', pulse: false },
}

const TONE_CLASS = {
  slate: 'text-slate-400 bg-slate-400/10 border-slate-400/20',
  amber: 'text-amber-300 bg-amber-400/10 border-amber-400/25',
  sky: 'text-sky-300 bg-sky-400/10 border-sky-400/25',
  kyy: 'text-kyy-300 bg-kyy-400/10 border-kyy-400/25',
  rose: 'text-rose-300 bg-rose-400/10 border-rose-400/25',
}

export function StatusPill({ state }) {
  const meta = STATE_META[state] || STATE_META.idle
  return (
    <span
      className={cx(
        'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider',
        TONE_CLASS[meta.tone],
      )}
    >
      <span className="relative flex h-2 w-2">
        {meta.pulse && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-70" />
        )}
        <span className="relative inline-flex h-2 w-2 rounded-full bg-current" />
      </span>
      {meta.label}
    </span>
  )
}

/** Circular countdown around the QR while it is valid. */
function QrTimer({ expiresAt }) {
  const [left, setLeft] = useState(60)
  useEffect(() => {
    if (!expiresAt) return undefined
    const tick = () => setLeft(Math.max(0, Math.round((expiresAt - Date.now()) / 1000)))
    tick()
    const id = setInterval(tick, 500)
    return () => clearInterval(id)
  }, [expiresAt])

  if (!expiresAt) return null
  return (
    <div className="mt-4 flex items-center justify-center gap-2 text-[11px] font-medium text-slate-500">
      <span className={cx('h-1.5 w-1.5 rounded-full', left > 10 ? 'bg-kyy-400' : 'bg-amber-400')} />
      {left > 0 ? `QR refreshes in ${left}s` : 'Refreshing QR…'}
    </div>
  )
}

export default function ConnectScreen({ session, onConnected, theme = 'dark', onToggleTheme }) {
  const toast = useToast()
  const [method, setMethod] = useState('qr')
  const [phone, setPhone] = useState('')
  const [busy, setBusy] = useState(false)
  const lastState = useRef(session?.state)

  const state = session?.state || 'idle'
  const isWaiting = state === 'waiting_qr' || state === 'waiting_pairing'
  const isBusy = busy || state === 'connecting'

  useEffect(() => {
    if (lastState.current !== 'connected' && state === 'connected') onConnected?.()
    lastState.current = state
  }, [state, onConnected])

  useEffect(() => {
    if (session?.pairingNumber && !phone) setPhone(session.pairingNumber)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.pairingNumber])

  const start = async (nextMethod = method) => {
    setBusy(true)
    try {
      if (nextMethod === 'pairing') {
        const clean = phone.replace(/\D/g, '')
        if (clean.length < 8) throw new Error('Enter your number with the country code, e.g. 6281234567890')
        if (clean.startsWith('0')) throw new Error('Remove the leading 0 and use the country code (62…)')
      }
      await api.connect({ method: nextMethod, phoneNumber: phone.replace(/\D/g, '') })
      toast.info(
        nextMethod === 'qr' ? 'Generating QR code…' : 'Requesting pairing code…',
        { title: 'Linking device' },
      )
    } catch (err) {
      toast.error(err.message, { title: 'Could not start' })
    } finally {
      setBusy(false)
    }
  }

  const reset = async () => {
    setBusy(true)
    try {
      await api.logout()
      toast.success('Local session cleared')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  const pairingDigits = useMemo(
    () => (session?.pairingCode || '').replace(/-/g, '').split(''),
    [session?.pairingCode],
  )

  return (
    <div className="relative min-h-[100dvh] overflow-y-auto bg-ink-950">
      <div className="pointer-events-none fixed inset-0 bg-mesh" />
      <motion.div
        className="pointer-events-none fixed -left-40 top-10 h-96 w-96 rounded-full bg-kyy-400/10 blur-[110px]"
        animate={{ y: [0, 26, 0] }}
        transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="pointer-events-none fixed -right-32 bottom-0 h-96 w-96 rounded-full bg-violetx-500/10 blur-[110px]"
        animate={{ y: [0, -30, 0] }}
        transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
      />

      <div className="relative mx-auto flex min-h-[100dvh] w-full max-w-6xl flex-col px-5 py-6 sm:px-8">
        <header className="flex items-center justify-between gap-3">
          <LogoWordmark size={44} />
          <div className="flex items-center gap-2">
            <StatusPill state={state} />
            {onToggleTheme && (
              <button
                onClick={onToggleTheme}
                title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                className="grid h-9 w-9 place-items-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-slate-400 transition hover:text-kyy-300"
              >
                {theme === 'dark' ? <IconSun className="h-4 w-4" /> : <IconMoon className="h-4 w-4" />}
              </button>
            )}
          </div>
        </header>

        <main className="grid flex-1 items-center gap-8 py-10 lg:grid-cols-[1.05fr_1fr] lg:gap-14">
          {/* ------------------------------ copy ------------------------------ */}
          <motion.section
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          >
            <span className="chip mb-5 border-kyy-400/25 bg-kyy-400/10 text-kyy-300">
              <IconLink className="h-3.5 w-3.5" />
              Linked Devices bridge
            </span>
            <h1 className="text-balance text-4xl font-black leading-[1.05] tracking-tight text-slate-50 sm:text-5xl">
              Control your WhatsApp
              <br />
              from a <span className="gradient-text">far better</span> web app.
            </h1>
            <p className="mt-5 max-w-md text-[15px] leading-relaxed text-slate-400">
              Link your own number through <strong className="text-slate-200">Linked Devices</strong>{' '}
              using a QR code or an 8-digit pairing code. Your session is stored on your own server
              and survives restarts.
            </p>

            <ol className="mt-8 space-y-3">
              {STEPS.map((step, index) => (
                <motion.li
                  key={step}
                  initial={{ opacity: 0, x: -14 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.15 + index * 0.09 }}
                  className="flex items-center gap-3 text-sm text-slate-300"
                >
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/[0.05] text-[11px] font-bold text-kyy-300">
                    {index + 1}
                  </span>
                  {step}
                </motion.li>
              ))}
              <motion.li
                initial={{ opacity: 0, x: -14 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.42 }}
                className="flex items-center gap-3 text-sm text-slate-300"
              >
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-kyy-400/30 bg-kyy-400/10 text-kyy-300">
                  <IconCheck className="h-4 w-4" />
                </span>
                {method === 'qr' ? 'Scan the QR on the right' : 'Choose “Link with phone number instead”'}
              </motion.li>
            </ol>

            <div className="mt-8 flex items-start gap-3 rounded-2xl border border-amber-400/20 bg-amber-400/[0.06] p-4">
              <IconWarning className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
              <p className="text-[12.5px] leading-relaxed text-amber-200/90">
                <strong>Unofficial WhatsApp client.</strong> Gunakan dengan risiko sendiri — for your
                own account only.
              </p>
            </div>
          </motion.section>

          {/* ----------------------------- panel ----------------------------- */}
          <motion.section
            initial={{ opacity: 0, y: 26, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="panel relative overflow-hidden p-6 sm:p-7"
          >
            <div className="pointer-events-none absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-kyy-400/60 to-transparent" />

            {/* method switch */}
            <div className="relative mb-6 grid grid-cols-2 gap-1 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-1">
              {[
                { id: 'qr', label: 'QR Code', Icon: IconQr },
                { id: 'pairing', label: 'Pairing Code', Icon: IconKeypad },
              ].map(({ id, label, Icon }) => (
                <button
                  key={id}
                  onClick={() => setMethod(id)}
                  className={cx(
                    'relative z-10 flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-[13px] font-semibold transition-colors',
                    method === id ? 'text-onaccent' : 'text-slate-400 hover:text-slate-200',
                  )}
                >
                  {method === id && (
                    <motion.span
                      layoutId="method-pill"
                      className="absolute inset-0 -z-10 rounded-xl bg-kyy-gradient"
                      transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                    />
                  )}
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              ))}
            </div>

            <AnimatePresence mode="wait">
              {/* ---------------------------- QR ---------------------------- */}
              {method === 'qr' && (
                <motion.div
                  key="qr"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.25 }}
                  className="flex flex-col items-center"
                >
                  <div className="relative grid aspect-square w-full max-w-[288px] place-items-center overflow-hidden rounded-3xl border border-white/[0.08] bg-white/[0.03] p-4">
                    <AnimatePresence mode="wait">
                      {session?.qr ? (
                        <motion.div
                          key={session.qr.slice(-24)}
                          initial={{ opacity: 0, scale: 0.9, filter: 'blur(6px)' }}
                          animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                          exit={{ opacity: 0, scale: 1.04 }}
                          transition={{ duration: 0.35 }}
                          className="relative h-full w-full"
                        >
                          <img
                            src={session.qr}
                            alt="WhatsApp QR code"
                            className="h-full w-full rounded-2xl bg-pure object-contain p-2"
                          />
                          {/* scanning laser */}
                          <motion.div
                            className="pointer-events-none absolute inset-x-2 h-16 rounded-full"
                            style={{
                              background:
                                'linear-gradient(to bottom, transparent, rgba(31,233,200,.35), transparent)',
                            }}
                            animate={{ top: ['2%', '86%', '2%'] }}
                            transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
                          />
                        </motion.div>
                      ) : (
                        <motion.div
                          key="placeholder"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="flex flex-col items-center gap-4 text-center"
                        >
                          {isBusy ? (
                            <>
                              <span className="h-10 w-10 animate-spin rounded-full border-2 border-white/10 border-t-kyy-400" />
                              <p className="text-xs text-slate-500">Generating secure QR…</p>
                            </>
                          ) : (
                            <>
                              <IconQr className="h-12 w-12 text-slate-700" />
                              <p className="max-w-[190px] text-xs leading-relaxed text-slate-500">
                                Press connect to generate a fresh QR code
                              </p>
                            </>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* corner brackets */}
                    {['left-3 top-3 border-l-2 border-t-2 rounded-tl-xl',
                      'right-3 top-3 border-r-2 border-t-2 rounded-tr-xl',
                      'left-3 bottom-3 border-l-2 border-b-2 rounded-bl-xl',
                      'right-3 bottom-3 border-r-2 border-b-2 rounded-br-xl',
                    ].map((cls) => (
                      <span key={cls} className={cx('pointer-events-none absolute h-7 w-7 border-kyy-400/70', cls)} />
                    ))}
                  </div>

                  <QrTimer expiresAt={session?.qrExpiresAt} />
                </motion.div>
              )}

              {/* -------------------------- pairing -------------------------- */}
              {method === 'pairing' && (
                <motion.div
                  key="pairing"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.25 }}
                  className="flex flex-col"
                >
                  <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    WhatsApp number (with country code)
                  </label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-500">
                      +
                    </span>
                    <input
                      value={phone}
                      onChange={(event) => setPhone(event.target.value.replace(/[^\d]/g, ''))}
                      onKeyDown={(event) => event.key === 'Enter' && start('pairing')}
                      placeholder="6281234567890"
                      inputMode="numeric"
                      className="input pl-8 font-mono tracking-wider"
                    />
                  </div>
                  <p className="mt-2 text-[11px] text-slate-500">
                    Indonesia example: 0812… becomes <span className="text-slate-300">62812…</span>
                  </p>

                  <div className="mt-6 rounded-3xl border border-white/[0.08] bg-white/[0.03] p-5">
                    <p className="mb-4 text-center text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                      Your pairing code
                    </p>
                    <div className="flex items-center justify-center gap-1.5 sm:gap-2">
                      {(pairingDigits.length ? pairingDigits : Array(8).fill(null)).map(
                        (digit, index) => (
                          <div key={index} className="flex items-center">
                            <motion.div
                              initial={{ opacity: 0, y: 10, scale: 0.85 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              transition={{ delay: index * 0.05, type: 'spring', stiffness: 380, damping: 22 }}
                              className={cx(
                                'grid h-12 w-8 place-items-center rounded-xl border font-mono text-lg font-bold sm:h-14 sm:w-10 sm:text-xl',
                                digit
                                  ? 'border-kyy-400/40 bg-kyy-400/10 text-kyy-200 shadow-glow'
                                  : 'border-white/[0.08] bg-white/[0.02] text-slate-700',
                              )}
                            >
                              {digit || '•'}
                            </motion.div>
                            {index === 3 && <span className="mx-1 text-slate-600">–</span>}
                          </div>
                        ),
                      )}
                    </div>
                    {session?.pairingCode && (
                      <button
                        onClick={() => {
                          navigator.clipboard?.writeText(session.pairingCode.replace('-', ''))
                          toast.success('Pairing code copied')
                        }}
                        className="mx-auto mt-4 block text-[11px] font-medium text-kyy-300 hover:text-kyy-200"
                      >
                        Copy code
                      </button>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* error */}
            <AnimatePresence>
              {session?.lastError && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <p className="mt-5 rounded-xl border border-rose-500/20 bg-rose-500/[0.07] px-3.5 py-2.5 text-[12px] leading-relaxed text-rose-300">
                    {session.lastError}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* actions */}
            <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
              <button
                onClick={() => start(method)}
                disabled={isBusy}
                className="btn-primary flex-1"
              >
                {isBusy ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-onaccent/30 border-t-onaccent" />
                    Connecting…
                  </>
                ) : isWaiting ? (
                  <>
                    <IconRefresh className="h-4 w-4" />
                    Regenerate
                  </>
                ) : (
                  <>
                    <IconLink className="h-4 w-4" />
                    Connect WhatsApp
                  </>
                )}
              </button>
              {(session?.hasSession || isWaiting) && (
                <button onClick={reset} disabled={isBusy} className="btn-danger sm:w-auto">
                  <IconLogout className="h-4 w-4" />
                  Reset session
                </button>
              )}
            </div>

            <p className="mt-5 text-center text-[10.5px] leading-relaxed text-slate-600">
              KyyWA never sends your credentials anywhere — the Baileys session lives only on your
              own server volume.
            </p>
          </motion.section>
        </main>

        <footer className="flex flex-col items-center justify-between gap-2 border-t border-white/[0.06] py-5 text-[11px] text-slate-600 sm:flex-row">
          <span>
            © {new Date().getFullYear()} <span className="font-semibold text-slate-400">KyyDevv</span> · KyyWA v1.0
          </span>
          <span>Built with Baileys · React · Socket.io</span>
        </footer>
      </div>
    </div>
  )
}
