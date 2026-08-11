import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

import Avatar from './Avatar.jsx'
import { useToast } from './Toast.jsx'
import { api, mediaUrl, uploadWithProgress } from '../lib/api.js'
import { cx, formatChatTime, jidToNumber } from '../lib/utils.js'
import {
  IconPlus,
  IconClose,
  IconImage,
  IconStatus,
  IconSend,
  IconEye,
} from './Icons.jsx'

const STATUS_JID = 'status@broadcast'

const BACKGROUNDS = [
  '#0f766e',
  '#7c3aed',
  '#db2777',
  '#ea580c',
  '#0369a1',
  '#4d7c0f',
  '#b91c1c',
  '#1f2937',
]

/* ------------------------------ story viewer ----------------------------- */

function StoryViewer({ group, onClose }) {
  const [index, setIndex] = useState(0)
  const item = group.items[index]
  const timerRef = useRef(null)

  useEffect(() => {
    clearTimeout(timerRef.current)
    const duration = item?.kind === 'video' ? 15000 : 6000
    timerRef.current = setTimeout(() => {
      if (index < group.items.length - 1) setIndex((i) => i + 1)
      else onClose()
    }, duration)
    return () => clearTimeout(timerRef.current)
  }, [index, item, group.items.length, onClose])

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') onClose()
      if (event.key === 'ArrowRight') setIndex((i) => Math.min(i + 1, group.items.length - 1))
      if (event.key === 'ArrowLeft') setIndex((i) => Math.max(i - 1, 0))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [group.items.length, onClose])

  if (!item) return null

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 grid place-items-center bg-ink-950/92 backdrop-blur-xl"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.94, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.94, y: 20 }}
        onClick={(event) => event.stopPropagation()}
        className="relative flex h-full max-h-[88vh] w-full max-w-[420px] flex-col overflow-hidden rounded-3xl border border-white/10 bg-ink-900 shadow-glass"
      >
        {/* progress bars */}
        <div className="absolute inset-x-3 top-3 z-20 flex gap-1">
          {group.items.map((_, i) => (
            <div key={i} className="h-[3px] flex-1 overflow-hidden rounded-full bg-pure/20">
              <motion.div
                className="h-full bg-pure"
                initial={{ width: i < index ? '100%' : 0 }}
                animate={{ width: i < index ? '100%' : i === index ? '100%' : 0 }}
                transition={{
                  duration: i === index ? (item.kind === 'video' ? 15 : 6) : 0,
                  ease: 'linear',
                }}
              />
            </div>
          ))}
        </div>

        <div className="absolute inset-x-0 top-7 z-20 flex items-center gap-3 px-3 py-2">
          <Avatar jid={group.sender} name={group.name} size={36} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold text-pure">{group.name}</p>
            <p className="text-[11px] text-pure/60">{formatChatTime(item.timestamp)}</p>
          </div>
          <button
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-full bg-carbon/40 text-pure/80 hover:text-pure"
          >
            <IconClose className="h-4 w-4" />
          </button>
        </div>

        {/* content */}
        <div className="relative flex flex-1 items-center justify-center overflow-hidden">
          {item.kind === 'image' && (
            <img src={mediaUrl(STATUS_JID, item.id)} alt="" className="max-h-full w-full object-contain" />
          )}
          {item.kind === 'video' && (
            <video
              src={mediaUrl(STATUS_JID, item.id)}
              autoPlay
              controls
              className="max-h-full w-full object-contain"
            />
          )}
          {item.kind !== 'image' && item.kind !== 'video' && (
            <div
              className="grid h-full w-full place-items-center px-8 text-center"
              style={{ background: item.backgroundColor || '#0f766e' }}
            >
              <p className="text-balance text-xl font-semibold leading-relaxed text-pure">
                {item.text}
              </p>
            </div>
          )}

          {/* tap zones */}
          <button
            className="absolute inset-y-0 left-0 w-1/3"
            onClick={() => setIndex((i) => Math.max(i - 1, 0))}
            aria-label="Previous"
          />
          <button
            className="absolute inset-y-0 right-0 w-1/3"
            onClick={() =>
              index < group.items.length - 1 ? setIndex((i) => i + 1) : onClose()
            }
            aria-label="Next"
          />
        </div>

        {(item.kind === 'image' || item.kind === 'video') && item.text && (
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-carbon/80 to-transparent px-4 pb-5 pt-10">
            <p className="text-[13.5px] text-pure">{item.text}</p>
          </div>
        )}
      </motion.div>
    </motion.div>
  )
}

/* ----------------------------- status composer ---------------------------- */

function StatusComposer({ onClose, onPosted }) {
  const toast = useToast()
  const [mode, setMode] = useState('text')
  const [text, setText] = useState('')
  const [bg, setBg] = useState(BACKGROUNDS[0])
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [progress, setProgress] = useState(null)
  const [busy, setBusy] = useState(false)
  const fileRef = useRef(null)

  const choose = (event) => {
    const picked = event.target.files?.[0]
    if (!picked) return
    setFile(picked)
    setPreview(URL.createObjectURL(picked))
    setMode('media')
  }

  const submit = async () => {
    try {
      if (mode === 'text') {
        if (!text.trim()) return
        setBusy(true)
        await api.sendStatus({ kind: 'text', text: text.trim(), backgroundColor: bg })
      } else {
        if (!file) return
        const form = new FormData()
        form.append('file', file)
        form.append('kind', file.type.startsWith('video') ? 'video' : 'image')
        if (text.trim()) form.append('caption', text.trim())
        setProgress(0)
        const { promise } = uploadWithProgress('/status', form, setProgress)
        await promise
      }
      toast.success('Your status is live for 24 hours', { title: 'Status posted' })
      onPosted?.()
      onClose()
    } catch (err) {
      toast.error(err.message, { title: 'Could not post status' })
    } finally {
      setBusy(false)
      setProgress(null)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 grid place-items-center bg-ink-950/85 p-4 backdrop-blur-xl"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.94, y: 24 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.94, y: 24 }}
        transition={{ type: 'spring', stiffness: 320, damping: 28 }}
        onClick={(event) => event.stopPropagation()}
        className="glass-strong w-full max-w-md overflow-hidden rounded-3xl p-5"
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-[15px] font-bold text-slate-100">New status</h3>
          <button
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-xl text-slate-400 hover:bg-white/[0.07] hover:text-slate-100"
          >
            <IconClose className="h-4 w-4" />
          </button>
        </div>

        <div className="mb-4 flex gap-1 rounded-xl bg-white/[0.04] p-1">
          {[
            { id: 'text', label: 'Text' },
            { id: 'media', label: 'Photo / Video' },
          ].map((option) => (
            <button
              key={option.id}
              onClick={() => setMode(option.id)}
              className={cx(
                'relative flex-1 rounded-lg px-3 py-1.5 text-[12.5px] font-semibold transition',
                mode === option.id ? 'text-onaccent' : 'text-slate-400 hover:text-slate-200',
              )}
            >
              {mode === option.id && (
                <motion.span
                  layoutId="status-mode"
                  className="absolute inset-0 rounded-lg bg-kyy-gradient"
                  transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                />
              )}
              <span className="relative">{option.label}</span>
            </button>
          ))}
        </div>

        {mode === 'text' ? (
          <>
            <div
              className="mb-3 grid min-h-[168px] place-items-center rounded-2xl px-5 py-6 transition-colors"
              style={{ background: bg }}
            >
              <textarea
                value={text}
                onChange={(event) => setText(event.target.value)}
                maxLength={700}
                placeholder="Type a status…"
                rows={3}
                className="w-full resize-none bg-transparent text-center text-lg font-semibold text-pure placeholder:text-pure/50 focus:outline-none"
              />
            </div>
            <div className="mb-4 flex flex-wrap gap-2">
              {BACKGROUNDS.map((color) => (
                <button
                  key={color}
                  onClick={() => setBg(color)}
                  style={{ background: color }}
                  className={cx(
                    'h-7 w-7 rounded-full transition',
                    bg === color ? 'ring-2 ring-pure/80 ring-offset-2 ring-offset-ink-900' : 'opacity-70 hover:opacity-100',
                  )}
                />
              ))}
            </div>
          </>
        ) : (
          <>
            <input ref={fileRef} type="file" accept="image/*,video/*" hidden onChange={choose} />
            <button
              onClick={() => fileRef.current?.click()}
              className="mb-3 grid min-h-[168px] w-full place-items-center overflow-hidden rounded-2xl border border-dashed border-white/15 bg-white/[0.03] transition hover:border-kyy-400/40"
            >
              {preview ? (
                file?.type.startsWith('video') ? (
                  <video src={preview} className="max-h-[220px] w-full object-cover" />
                ) : (
                  <img src={preview} alt="" className="max-h-[220px] w-full object-cover" />
                )
              ) : (
                <span className="flex flex-col items-center gap-2 text-slate-500">
                  <IconImage className="h-7 w-7" />
                  <span className="text-[12.5px]">Choose a photo or video</span>
                </span>
              )}
            </button>
            <input
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="Add a caption…"
              className="input mb-4 py-2 text-[13px]"
            />
          </>
        )}

        {progress !== null && (
          <div className="mb-3">
            <div className="mb-1 flex justify-between text-[10.5px] text-slate-400">
              <span>Uploading…</span>
              <span className="tabular-nums text-kyy-300">{progress}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
              <motion.div
                className="h-full rounded-full bg-kyy-gradient"
                animate={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <button onClick={onClose} className="btn btn-ghost flex-1">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={busy || progress !== null || (mode === 'text' ? !text.trim() : !file)}
            className="btn btn-primary flex-1"
          >
            <IconSend className="h-4 w-4" />
            Post status
          </button>
        </div>

        <p className="mt-3 text-center text-[10.5px] text-slate-500">
          Shared with your saved contacts · disappears after 24 hours
        </p>
      </motion.div>
    </motion.div>
  )
}

/* -------------------------------- panel ---------------------------------- */

export default function StatusView({ statuses = [], onRefresh, connected }) {
  const [viewing, setViewing] = useState(null)
  const [composing, setComposing] = useState(false)

  const groups = useMemo(() => {
    const map = new Map()
    for (const status of statuses) {
      const key = status.sender || 'me'
      if (!map.has(key)) {
        map.set(key, {
          sender: key,
          name: status.name || jidToNumber(key),
          fromMe: status.fromMe,
          items: [],
          latest: 0,
        })
      }
      const group = map.get(key)
      group.items.push(status)
      group.latest = Math.max(group.latest, status.timestamp || 0)
    }
    const list = [...map.values()]
    list.forEach((group) => group.items.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0)))
    return list.sort((a, b) => Number(b.fromMe) - Number(a.fromMe) || b.latest - a.latest)
  }, [statuses])

  return (
    <div className="chat-canvas relative h-full overflow-y-auto">
      <div className="pointer-events-none absolute inset-0 bg-mesh opacity-50" />
      <div className="relative mx-auto max-w-2xl px-4 py-6 sm:px-8 sm:py-10">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-100">Status</h2>
            <p className="mt-1 text-[13px] text-slate-500">
              Updates from your contacts, gone after 24 hours.
            </p>
          </div>
          <button
            onClick={() => setComposing(true)}
            disabled={!connected}
            className="btn btn-primary shrink-0"
          >
            <IconPlus className="h-4 w-4" />
            New
          </button>
        </div>

        {groups.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="panel flex flex-col items-center gap-3 px-6 py-14 text-center"
          >
            <span className="grid h-14 w-14 place-items-center rounded-2xl bg-kyy-400/10 text-kyy-300">
              <IconStatus className="h-6 w-6" />
            </span>
            <p className="text-[14px] font-semibold text-slate-200">No status updates yet</p>
            <p className="max-w-xs text-[12.5px] leading-relaxed text-slate-500">
              New updates from your contacts will land here automatically. You can post your own with
              the button above.
            </p>
          </motion.div>
        ) : (
          <div className="grid gap-2.5 sm:grid-cols-2">
            {groups.map((group, index) => (
              <motion.button
                key={group.sender}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(index * 0.04, 0.3) }}
                onClick={() => setViewing(group)}
                className="panel group flex items-center gap-3 p-3 text-left transition hover:border-kyy-400/25 hover:bg-white/[0.05]"
              >
                <span className="relative shrink-0">
                  <span className="absolute -inset-[3px] rounded-full bg-kyy-gradient opacity-80 transition group-hover:opacity-100" />
                  <span className="relative block rounded-full border-2 border-ink-900">
                    <Avatar jid={group.sender} name={group.name} size={44} />
                  </span>
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-semibold text-slate-100">
                    {group.fromMe ? 'My status' : group.name}
                  </p>
                  <p className="text-[11.5px] text-slate-500">
                    {group.items.length} update{group.items.length === 1 ? '' : 's'} ·{' '}
                    {formatChatTime(group.latest)}
                  </p>
                </div>
                <IconEye className="h-4 w-4 shrink-0 text-slate-600 transition group-hover:text-kyy-300" />
              </motion.button>
            ))}
          </div>
        )}
      </div>

      <AnimatePresence>
        {viewing && <StoryViewer group={viewing} onClose={() => setViewing(null)} />}
        {composing && (
          <StatusComposer onClose={() => setComposing(false)} onPosted={onRefresh} />
        )}
      </AnimatePresence>
    </div>
  )
}
