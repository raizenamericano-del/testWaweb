import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

import { useToast } from './Toast.jsx'
import { api, uploadWithProgress } from '../lib/api.js'
import { cx, formatBytes, jidToNumber } from '../lib/utils.js'
import {
  IconSend,
  IconPaperclip,
  IconSmile,
  IconImage,
  IconVideo,
  IconDoc,
  IconSticker,
  IconClose,
  IconPlus,
} from './Icons.jsx'

const EMOJIS = [
  '😀','😂','🥹','😊','😍','😘','😎','🤔','🙃','😴',
  '👍','👏','🙏','💪','🔥','✨','🎉','❤️','💜','💚',
  '😅','😭','😡','🥳','🤝','👌','✅','❌','⚡','🚀',
]

const ATTACH = [
  { id: 'image', label: 'Photo', accept: 'image/*', Icon: IconImage, tone: 'from-sky-400 to-blue-500' },
  { id: 'video', label: 'Video', accept: 'video/*', Icon: IconVideo, tone: 'from-violetx-400 to-fuchsia-500' },
  { id: 'document', label: 'Document', accept: '*/*', Icon: IconDoc, tone: 'from-amber-400 to-orange-500' },
  { id: 'sticker', label: 'Sticker', accept: 'image/webp,image/png,image/jpeg', Icon: IconSticker, tone: 'from-kyy-400 to-emerald-500' },
]

export default function Composer({ jid, replyTo, onCancelReply, onSent, onTyping, disabled }) {
  const toast = useToast()
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [attachOpen, setAttachOpen] = useState(false)
  const [emojiOpen, setEmojiOpen] = useState(false)
  const [pending, setPending] = useState(null) // { file, kind, previewUrl, caption }
  const [progress, setProgress] = useState(null)
  const inputRef = useRef(null)
  const fileRef = useRef(null)
  const kindRef = useRef('document')
  const typingRef = useRef(null)

  useEffect(() => {
    setText('')
    setPending(null)
    setAttachOpen(false)
    setEmojiOpen(false)
  }, [jid])

  useEffect(() => {
    if (replyTo) inputRef.current?.focus()
  }, [replyTo])

  const autoGrow = (el) => {
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 150)}px`
  }

  /** Broadcast "composing" over the socket, then "paused" once idle. */
  const signalTyping = () => {
    if (!jid || !onTyping) return
    clearTimeout(typingRef.current)
    onTyping(true)
    typingRef.current = setTimeout(() => onTyping(false), 2200)
  }

  useEffect(() => () => clearTimeout(typingRef.current), [])

  const pickFile = (kind, accept) => {
    kindRef.current = kind
    if (fileRef.current) {
      fileRef.current.accept = accept
      fileRef.current.value = ''
      fileRef.current.click()
    }
    setAttachOpen(false)
  }

  const onFileChosen = (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    const kind = kindRef.current
    const previewUrl = /^image|^video/.test(file.type) ? URL.createObjectURL(file) : null
    setPending({ file, kind, previewUrl, caption: '' })
  }

  const sendText = async () => {
    const value = text.trim()
    if (!value || !jid) return
    setSending(true)
    setText('')
    autoGrow(inputRef.current)
    try {
      await api.sendText(jid, value, replyTo?.id)
      onCancelReply?.()
      onSent?.()
    } catch (err) {
      setText(value)
      toast.error(err.message, { title: 'Message not sent' })
    } finally {
      setSending(false)
    }
  }

  const sendMedia = async () => {
    if (!pending || !jid) return
    const form = new FormData()
    form.append('file', pending.file)
    form.append('jid', jid)
    form.append('kind', pending.kind)
    if (pending.caption) form.append('caption', pending.caption)
    if (replyTo?.id) form.append('quotedId', replyTo.id)

    setProgress(0)
    const { promise } = uploadWithProgress('/messages/media', form, setProgress)
    try {
      await promise
      toast.success(`${pending.kind} sent`, { title: 'Delivered to WhatsApp' })
      if (pending.previewUrl) URL.revokeObjectURL(pending.previewUrl)
      setPending(null)
      onCancelReply?.()
      onSent?.()
    } catch (err) {
      toast.error(err.message, { title: 'Upload failed' })
    } finally {
      setTimeout(() => setProgress(null), 500)
    }
  }

  const onKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      if (pending) sendMedia()
      else sendText()
    }
  }

  const canSend = pending ? true : Boolean(text.trim())

  return (
    <div className="relative border-t border-white/[0.06] bg-ink-900/70 px-3 py-3 backdrop-blur-2xl sm:px-4 safe-b">
      <input ref={fileRef} type="file" hidden onChange={onFileChosen} />

      {/* reply preview */}
      <AnimatePresence>
        {replyTo && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mb-2 flex items-start gap-2 rounded-xl border-l-[3px] border-kyy-400 bg-white/[0.04] px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold text-kyy-300">
                  Replying to {replyTo.fromMe ? 'yourself' : replyTo.senderName || jidToNumber(replyTo.sender || '')}
                </p>
                <p className="truncate text-[12px] text-slate-400">
                  {replyTo.text || `[${replyTo.kind}]`}
                </p>
              </div>
              <button
                onClick={onCancelReply}
                className="grid h-6 w-6 place-items-center rounded-lg text-slate-500 hover:bg-white/[0.07] hover:text-slate-200"
              >
                <IconClose className="h-3.5 w-3.5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* pending media preview */}
      <AnimatePresence>
        {pending && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="mb-2 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-3"
          >
            <div className="flex items-start gap-3">
              {pending.previewUrl ? (
                pending.kind === 'video' ? (
                  <video src={pending.previewUrl} className="h-16 w-16 rounded-xl object-cover" />
                ) : (
                  <img src={pending.previewUrl} alt="" className="h-16 w-16 rounded-xl object-cover" />
                )
              ) : (
                <span className="grid h-16 w-16 shrink-0 place-items-center rounded-xl bg-kyy-400/12 text-kyy-300">
                  <IconDoc className="h-6 w-6" />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold text-slate-100">
                  {pending.file.name}
                </p>
                <p className="text-[11px] text-slate-500">
                  {pending.kind} · {formatBytes(pending.file.size)}
                </p>
                {pending.kind !== 'sticker' && (
                  <input
                    value={pending.caption}
                    onChange={(event) =>
                      setPending((prev) => ({ ...prev, caption: event.target.value }))
                    }
                    placeholder="Add a caption…"
                    className="input mt-2 py-1.5 text-[12.5px]"
                  />
                )}
              </div>
              <button
                onClick={() => {
                  if (pending.previewUrl) URL.revokeObjectURL(pending.previewUrl)
                  setPending(null)
                }}
                className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-slate-500 hover:bg-white/[0.07] hover:text-slate-200"
              >
                <IconClose className="h-4 w-4" />
              </button>
            </div>

            {progress !== null && (
              <div className="mt-3">
                <div className="mb-1 flex items-center justify-between text-[10.5px] font-medium text-slate-400">
                  <span>{progress < 100 ? 'Uploading…' : 'Processing on WhatsApp…'}</span>
                  <span className="tabular-nums text-kyy-300">{progress}%</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.07]">
                  <motion.div
                    className="h-full rounded-full bg-kyy-gradient"
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ ease: 'easeOut', duration: 0.25 }}
                  />
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* emoji tray */}
      <AnimatePresence>
        {emojiOpen && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.96 }}
            className="absolute bottom-[86px] left-3 z-30 w-[268px] rounded-2xl border border-white/10 bg-ink-850/95 p-2 shadow-glass backdrop-blur-2xl"
          >
            <div className="grid grid-cols-10 gap-0.5">
              {EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => {
                    setText((prev) => prev + emoji)
                    inputRef.current?.focus()
                  }}
                  className="grid h-7 w-7 place-items-center rounded-lg text-[15px] transition hover:scale-125 hover:bg-white/[0.08]"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* attach menu */}
      <AnimatePresence>
        {attachOpen && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.94 }}
            transition={{ type: 'spring', stiffness: 420, damping: 28 }}
            className="absolute bottom-[86px] left-3 z-30 w-56 rounded-2xl border border-white/10 bg-ink-850/95 p-1.5 shadow-glass backdrop-blur-2xl"
          >
            {ATTACH.map(({ id, label, accept, Icon, tone }, index) => (
              <motion.button
                key={id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.04 }}
                onClick={() => pickFile(id, accept)}
                className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition hover:bg-white/[0.07]"
              >
                <span className={cx('grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br text-pure', tone)}>
                  <Icon className="h-4 w-4" />
                </span>
                <span className="text-[13px] font-medium text-slate-200">{label}</span>
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* input row */}
      <div className="flex items-end gap-2">
        <button
          onClick={() => {
            setAttachOpen((v) => !v)
            setEmojiOpen(false)
          }}
          disabled={disabled}
          title="Attach"
          className={cx(
            'grid h-11 w-11 shrink-0 place-items-center rounded-2xl border transition',
            attachOpen
              ? 'border-kyy-400/40 bg-kyy-400/12 text-kyy-300'
              : 'border-white/[0.08] bg-white/[0.03] text-slate-400 hover:text-slate-100',
          )}
        >
          <motion.span animate={{ rotate: attachOpen ? 45 : 0 }} transition={{ duration: 0.2 }}>
            {attachOpen ? <IconPlus className="h-5 w-5" /> : <IconPaperclip className="h-5 w-5" />}
          </motion.span>
        </button>

        <div className="relative flex flex-1 items-end rounded-2xl border border-white/[0.08] bg-white/[0.03] transition focus-within:border-kyy-400/40">
          <button
            onClick={() => {
              setEmojiOpen((v) => !v)
              setAttachOpen(false)
            }}
            className="grid h-11 w-10 shrink-0 place-items-center rounded-2xl text-slate-500 hover:text-kyy-300"
          >
            <IconSmile className="h-5 w-5" />
          </button>
          <textarea
            ref={inputRef}
            rows={1}
            value={text}
            disabled={disabled}
            onChange={(event) => {
              setText(event.target.value)
              autoGrow(event.target)
              signalTyping()
            }}
            onKeyDown={onKeyDown}
            placeholder={pending ? 'Press enter to send the file…' : 'Type a message…'}
            className="max-h-[150px] flex-1 resize-none bg-transparent py-3 pr-3 text-[14px] text-slate-100 placeholder:text-slate-500 focus:outline-none"
          />
        </div>

        <motion.button
          onClick={() => (pending ? sendMedia() : sendText())}
          disabled={disabled || (!canSend && !pending) || sending || progress !== null}
          whileTap={{ scale: 0.92 }}
          title="Send"
          className={cx(
            'grid h-11 w-11 shrink-0 place-items-center rounded-2xl transition',
            canSend && !sending
              ? 'bg-kyy-gradient text-onaccent shadow-glow'
              : 'border border-white/[0.08] bg-white/[0.03] text-slate-600',
          )}
        >
          {sending || progress !== null ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-onaccent/30 border-t-onaccent" />
          ) : (
            <IconSend className="h-5 w-5" />
          )}
        </motion.button>
      </div>
    </div>
  )
}
