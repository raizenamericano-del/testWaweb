import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

import Avatar from './Avatar.jsx'
import Composer from './Composer.jsx'
import MessageBubble from './MessageBubble.jsx'
import { LogoMark } from './Logo.jsx'
import { IconChevronLeft, IconSearch, IconClose, IconWarning } from './Icons.jsx'
import { cx, groupByDay, jidToNumber } from '../lib/utils.js'

function DayDivider({ label }) {
  return (
    <div className="sticky top-2 z-10 my-3 flex justify-center">
      <span className="rounded-full border border-white/[0.07] bg-ink-850/85 px-3 py-1 text-[10.5px] font-semibold uppercase tracking-wider text-slate-400 backdrop-blur-xl">
        {label}
      </span>
    </div>
  )
}

function TypingBubble() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      className="flex justify-start"
    >
      <div className="bubble-in flex items-center gap-1 rounded-2xl rounded-bl-md px-4 py-3">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="h-1.5 w-1.5 rounded-full bg-kyy-300"
            animate={{ y: [0, -4, 0], opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 0.95, repeat: Infinity, delay: i * 0.16 }}
          />
        ))}
      </div>
    </motion.div>
  )
}

export function EmptyState() {
  return (
    <div className="chat-canvas relative grid h-full place-items-center overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-mesh opacity-60" />
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative flex max-w-sm flex-col items-center px-8 text-center"
      >
        <motion.div animate={{ y: [0, -8, 0] }} transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}>
          <LogoMark size={92} />
        </motion.div>
        <h2 className="mt-6 text-2xl font-bold tracking-tight text-slate-100">
          Welcome to <span className="gradient-text">KyyWA</span>
        </h2>
        <p className="mt-2.5 text-[13.5px] leading-relaxed text-slate-500">
          Pick a conversation from the sidebar to start messaging. Everything syncs live with your
          phone through the Linked Devices bridge.
        </p>
        <div className="mt-6 flex items-center gap-2 rounded-xl border border-amber-400/15 bg-amber-400/[0.05] px-3 py-2">
          <IconWarning className="h-3.5 w-3.5 shrink-0 text-amber-400/80" />
          <p className="text-[10.5px] text-amber-200/70">
            Unofficial WhatsApp client. Gunakan dengan risiko sendiri.
          </p>
        </div>
      </motion.div>
    </div>
  )
}

export default function ChatWindow({
  chat,
  messages,
  presence,
  onBack,
  onSendComplete,
  onTyping,
  onReact,
  onDelete,
  connected,
}) {
  const [replyTo, setReplyTo] = useState(null)
  const [search, setSearch] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const scrollRef = useRef(null)
  const bottomRef = useRef(null)
  const [atBottom, setAtBottom] = useState(true)

  useEffect(() => {
    setReplyTo(null)
    setSearch('')
    setSearchOpen(false)
  }, [chat?.id])

  const visible = useMemo(() => {
    if (!search.trim()) return messages
    const q = search.toLowerCase()
    return messages.filter((message) => message.text?.toLowerCase().includes(q))
  }, [messages, search])

  const groups = useMemo(() => groupByDay(visible), [visible])

  // stick to bottom on new messages when already near the bottom
  useLayoutEffect(() => {
    if (atBottom) bottomRef.current?.scrollIntoView({ block: 'end' })
  }, [visible.length, atBottom])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' })
    setAtBottom(true)
  }, [chat?.id])

  const onScroll = (event) => {
    const el = event.currentTarget
    setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 120)
  }

  const typing = presence?.state === 'composing'
  const recording = presence?.state === 'recording'

  if (!chat) return <EmptyState />

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* header */}
      <header className="flex items-center gap-3 border-b border-white/[0.06] bg-ink-900/70 px-3 py-2.5 backdrop-blur-2xl sm:px-4">
        <button
          onClick={onBack}
          className="grid h-9 w-9 place-items-center rounded-xl text-slate-400 transition hover:bg-white/[0.06] hover:text-slate-100 lg:hidden"
        >
          <IconChevronLeft className="h-5 w-5" />
        </button>
        <Avatar jid={chat.id} name={chat.name} size={42} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14.5px] font-semibold text-slate-100">
            {chat.name || jidToNumber(chat.id)}
          </p>
          <p className="truncate text-[11.5px] text-slate-500">
            {typing ? (
              <span className="font-medium text-kyy-300">typing…</span>
            ) : recording ? (
              <span className="font-medium text-kyy-300">recording audio…</span>
            ) : chat.isGroup ? (
              'Group chat'
            ) : (
              `+${jidToNumber(chat.id)}`
            )}
          </p>
        </div>
        <button
          onClick={() => setSearchOpen((v) => !v)}
          className={cx(
            'grid h-9 w-9 place-items-center rounded-xl transition',
            searchOpen
              ? 'bg-kyy-400/12 text-kyy-300'
              : 'text-slate-400 hover:bg-white/[0.06] hover:text-slate-100',
          )}
        >
          {searchOpen ? <IconClose className="h-4.5 w-4.5" /> : <IconSearch className="h-[18px] w-[18px]" />}
        </button>
      </header>

      <AnimatePresence>
        {searchOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-b border-white/[0.06] bg-ink-900/50 backdrop-blur-xl"
          >
            <div className="px-3 py-2.5 sm:px-4">
              <input
                autoFocus
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search in this conversation…"
                className="input py-2 text-[13px]"
              />
              {search && (
                <p className="mt-1.5 text-[11px] text-slate-500">
                  {visible.length} message{visible.length === 1 ? '' : 's'} found
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* messages */}
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="chat-canvas min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-6"
      >
        {groups.length === 0 && (
          <div className="grid h-full place-items-center">
            <p className="text-[13px] text-slate-500">
              {search ? 'No messages match your search.' : 'No messages yet — say hello 👋'}
            </p>
          </div>
        )}
        <div className="mx-auto flex max-w-3xl flex-col gap-1.5">
          {groups.map((group) => (
            <div key={group.label} className="flex flex-col gap-1.5">
              <DayDivider label={group.label} />
              {group.items.map((message, index) => {
                const prev = group.items[index - 1]
                const showName = !prev || prev.sender !== message.sender || prev.fromMe !== message.fromMe
                return (
                  <MessageBubble
                    key={message.id}
                    message={message}
                    isGroup={chat.isGroup}
                    showAvatarName={showName}
                    onReply={setReplyTo}
                    onDelete={onDelete}
                    onReact={onReact}
                  />
                )
              })}
            </div>
          ))}
          <AnimatePresence>{typing && <TypingBubble />}</AnimatePresence>
          <div ref={bottomRef} className="h-1" />
        </div>
      </div>

      {/* jump to bottom */}
      <AnimatePresence>
        {!atBottom && (
          <motion.button
            initial={{ opacity: 0, scale: 0.7, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.7, y: 10 }}
            onClick={() => {
              bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
              setAtBottom(true)
            }}
            className="absolute bottom-24 right-6 z-20 grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-ink-800/90 text-slate-300 shadow-glass backdrop-blur-xl hover:text-kyy-300"
          >
            <IconChevronLeft className="h-5 w-5 -rotate-90" />
          </motion.button>
        )}
      </AnimatePresence>

      <Composer
        jid={chat.id}
        replyTo={replyTo}
        disabled={!connected}
        onCancelReply={() => setReplyTo(null)}
        onSent={onSendComplete}
        onTyping={(value) => onTyping?.(chat.id, value)}
      />
    </div>
  )
}
