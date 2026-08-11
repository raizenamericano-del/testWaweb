import { memo, useState } from 'react'
import { motion } from 'framer-motion'

import { mediaUrl } from '../lib/api.js'
import {
  cx,
  formatTime,
  formatBytes,
  formatDuration,
  tokenize,
  jidToNumber,
} from '../lib/utils.js'
import {
  IconCheck,
  IconCheckDouble,
  IconClock,
  IconDoc,
  IconDownload,
  IconReply,
  IconTrash,
  IconPlay,
  IconSmile,
} from './Icons.jsx'

const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏']

function Ack({ ack }) {
  if (ack === null || ack === undefined) return null
  if (ack <= 0) return <IconClock className="h-3.5 w-3.5 opacity-60" />
  if (ack === 1) return <IconCheck className="h-3.5 w-3.5 opacity-70" />
  if (ack >= 4) return <IconCheckDouble className="h-3.5 w-3.5 text-sky-300" />
  return <IconCheckDouble className="h-3.5 w-3.5 opacity-70" />
}

function RichText({ text }) {
  return (
    <>
      {tokenize(text).map((token, index) => {
        if (token.type === 'link') {
          return (
            <a
              key={index}
              href={token.href || token.value}
              target="_blank"
              rel="noreferrer noopener"
              className="break-all font-medium text-kyy-300 underline decoration-kyy-400/40 underline-offset-2 hover:text-kyy-200"
            >
              {token.value}
            </a>
          )
        }
        if (token.type === 'mention') {
          return (
            <span key={index} className="font-semibold text-kyy-300">
              {token.value}
            </span>
          )
        }
        return (
          <span
            key={index}
            className={cx(
              token.styles?.includes('bold') && 'font-bold',
              token.styles?.includes('italic') && 'italic',
              token.styles?.includes('strike') && 'line-through opacity-70',
              token.styles?.includes('mono') &&
                'rounded bg-carbon/25 px-1 py-0.5 font-mono text-[12.5px]',
            )}
          >
            {token.value}
          </span>
        )
      })}
    </>
  )
}

function MediaBlock({ message }) {
  const [broken, setBroken] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const { kind, media, chatId, id } = message
  const url = mediaUrl(chatId, id)

  if (!media) return null

  if (kind === 'image' || kind === 'sticker') {
    const isSticker = kind === 'sticker'
    return (
      <div
        className={cx(
          'relative overflow-hidden',
          isSticker ? 'max-w-[168px]' : 'max-w-[300px] rounded-2xl',
        )}
      >
        {!loaded && !broken && media.thumbnail && (
          <img
            src={media.thumbnail}
            alt=""
            className={cx('w-full scale-105 blur-md', isSticker ? '' : 'rounded-2xl')}
          />
        )}
        {broken ? (
          <div className="flex items-center gap-2 rounded-xl bg-carbon/25 px-3 py-6 text-[11px] text-slate-400">
            Media unavailable
          </div>
        ) : (
          <a href={url} target="_blank" rel="noreferrer noopener">
            <img
              src={url}
              alt={message.text || kind}
              onLoad={() => setLoaded(true)}
              onError={() => setBroken(true)}
              className={cx(
                'w-full cursor-zoom-in transition-opacity duration-300',
                isSticker ? 'drop-shadow-lg' : 'rounded-2xl',
                loaded ? 'opacity-100' : 'absolute inset-0 opacity-0',
              )}
            />
          </a>
        )}
      </div>
    )
  }

  if (kind === 'video') {
    return (
      <div className="relative max-w-[320px] overflow-hidden rounded-2xl bg-carbon/40">
        <video
          src={url}
          poster={media.thumbnail || undefined}
          controls
          playsInline
          className="max-h-[380px] w-full rounded-2xl"
        />
        {media.seconds ? (
          <span className="pointer-events-none absolute left-2 top-2 rounded-md bg-carbon/60 px-1.5 py-0.5 text-[10px] font-medium text-pure/90">
            <IconPlay className="mr-1 inline h-2.5 w-2.5" />
            {formatDuration(media.seconds)}
          </span>
        ) : null}
      </div>
    )
  }

  if (kind === 'audio') {
    return (
      <div className="flex min-w-[220px] items-center gap-3 rounded-xl bg-carbon/15 px-3 py-2.5">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-kyy-400/15 text-kyy-300">
          <IconPlay className="h-4 w-4" />
        </span>
        <audio src={url} controls className="h-8 max-w-[210px] flex-1" preload="none" />
      </div>
    )
  }

  return (
    <a
      href={mediaUrl(chatId, id, true)}
      target="_blank"
      rel="noreferrer noopener"
      className="flex min-w-[230px] max-w-[300px] items-center gap-3 rounded-xl bg-carbon/15 px-3 py-2.5 transition hover:bg-carbon/25"
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-kyy-400/15 text-kyy-300">
        <IconDoc className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12.5px] font-medium text-slate-100">
          {media.fileName || 'Document'}
        </span>
        <span className="block text-[10.5px] text-slate-400">
          {[media.pages ? `${media.pages} pages` : null, formatBytes(media.fileLength)]
            .filter(Boolean)
            .join(' · ')}
        </span>
      </span>
      <IconDownload className="h-4 w-4 shrink-0 text-slate-400" />
    </a>
  )
}

export const MessageBubble = memo(function MessageBubble({
  message,
  showAvatarName,
  onReply,
  onDelete,
  onReact,
  isGroup,
}) {
  const [menu, setMenu] = useState(false)
  const out = message.fromMe
  const reactions = Object.values(message.reactions || {})

  if (message.deleted) {
    return (
      <div className={cx('flex w-full', out ? 'justify-end' : 'justify-start')}>
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-2 text-[12.5px] italic text-slate-500">
          🚫 This message was deleted
        </div>
      </div>
    )
  }

  return (
    <motion.div
      layout="position"
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
      className={cx('group flex w-full gap-2', out ? 'justify-end' : 'justify-start')}
      onMouseLeave={() => setMenu(false)}
    >
      {/* hover actions */}
      <div
        className={cx(
          'flex items-center gap-0.5 self-center opacity-0 transition-opacity group-hover:opacity-100',
          out ? 'order-1' : 'order-2',
        )}
      >
        <button
          onClick={() => onReply?.(message)}
          title="Reply"
          className="grid h-7 w-7 place-items-center rounded-lg text-slate-500 hover:bg-white/[0.07] hover:text-slate-200"
        >
          <IconReply className="h-3.5 w-3.5" />
        </button>
        <div className="relative">
          <button
            onClick={() => setMenu((v) => !v)}
            title="React"
            className="grid h-7 w-7 place-items-center rounded-lg text-slate-500 hover:bg-white/[0.07] hover:text-slate-200"
          >
            <IconSmile className="h-3.5 w-3.5" />
          </button>
          {menu && (
            <motion.div
              initial={{ opacity: 0, y: 6, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className={cx(
                'absolute bottom-9 z-20 flex gap-0.5 rounded-2xl border border-white/10 bg-ink-800/95 p-1.5 shadow-glass backdrop-blur-xl',
                out ? 'right-0' : 'left-0',
              )}
            >
              {QUICK_REACTIONS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => {
                    onReact?.(message, emoji)
                    setMenu(false)
                  }}
                  className="grid h-8 w-8 place-items-center rounded-xl text-lg transition hover:scale-125 hover:bg-white/[0.08]"
                >
                  {emoji}
                </button>
              ))}
            </motion.div>
          )}
        </div>
        {out && (
          <button
            onClick={() => onDelete?.(message)}
            title="Delete for everyone"
            className="grid h-7 w-7 place-items-center rounded-lg text-slate-500 hover:bg-rose-500/12 hover:text-rose-300"
          >
            <IconTrash className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <div className={cx('relative max-w-[min(78%,540px)]', out ? 'order-2' : 'order-1')}>
        <div
          className={cx(
            'relative rounded-2xl px-3 py-2 shadow-soft',
            out ? 'bubble-out rounded-br-md' : 'bubble-in rounded-bl-md',
            message.kind === 'sticker' && 'bg-transparent p-0 shadow-none border-none',
          )}
        >
          {showAvatarName && !out && isGroup && (
            <p className="mb-1 text-[11.5px] font-semibold text-kyy-300">
              {message.senderName || jidToNumber(message.sender || '')}
            </p>
          )}

          {message.quoted && (
            <div
              className={cx(
                'mb-1.5 overflow-hidden rounded-lg border-l-[3px] px-2.5 py-1.5',
                out ? 'border-kyy-300 bg-carbon/15' : 'border-violetx-400 bg-carbon/15',
              )}
            >
              <p className="truncate text-[11px] font-semibold text-kyy-300">
                {message.quoted.participant
                  ? jidToNumber(message.quoted.participant)
                  : 'Replied message'}
              </p>
              <p className="line-clamp-2 text-[11.5px] text-slate-400">
                {message.quoted.text || `[${message.quoted.kind}]`}
              </p>
            </div>
          )}

          {message.media && (
            <div className={cx(message.text ? 'mb-1.5' : '')}>
              <MediaBlock message={message} />
            </div>
          )}

          {message.text && (
            <p className="whitespace-pre-wrap break-words text-[14px] leading-[1.45] text-slate-100">
              <RichText text={message.text} />
            </p>
          )}

          <div
            className={cx(
              'mt-0.5 flex items-center justify-end gap-1',
              message.kind === 'sticker' && 'px-1',
            )}
          >
            <span className="text-[10px] tabular-nums text-slate-400/80">
              {formatTime(message.timestamp)}
            </span>
            {out && <Ack ack={message.ack} />}
          </div>

          {reactions.length > 0 && (
            <motion.div
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className={cx(
                'absolute -bottom-2.5 flex items-center gap-0.5 rounded-full border border-white/10 bg-ink-800 px-1.5 py-0.5 text-[11px] shadow-soft',
                out ? 'right-2' : 'left-2',
              )}
            >
              {reactions.slice(0, 3).map((emoji, index) => (
                <span key={index}>{emoji}</span>
              ))}
              {reactions.length > 3 && (
                <span className="text-[9px] text-slate-400">+{reactions.length - 3}</span>
              )}
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  )
})

export default MessageBubble
