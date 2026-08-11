import { memo, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

import Avatar from './Avatar.jsx'
import { LogoWordmark } from './Logo.jsx'
import { StatusPill } from './ConnectScreen.jsx'
import {
  IconSearch,
  IconClose,
  IconMoon,
  IconSun,
  IconLogout,
  IconChats,
  IconStatus,
  IconCheck,
  IconCheckDouble,
  IconClock,
  IconWarning,
} from './Icons.jsx'
import { cx, formatChatTime, jidToNumber } from '../lib/utils.js'

const Ack = ({ ack }) => {
  if (ack === undefined || ack === null) return null
  if (ack <= 0) return <IconClock className="h-3.5 w-3.5 text-slate-500" />
  if (ack === 1) return <IconCheck className="h-3.5 w-3.5 text-slate-500" />
  if (ack >= 4) return <IconCheckDouble className="h-3.5 w-3.5 text-sky-400" />
  return <IconCheckDouble className="h-3.5 w-3.5 text-slate-500" />
}

const ChatRow = memo(function ChatRow({ chat, active, onSelect, typing }) {
  return (
    <motion.button
      layout="position"
      onClick={() => onSelect(chat.id)}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
      className={cx(
        'group relative flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors',
        active ? 'bg-white/[0.07]' : 'hover:bg-white/[0.04]',
      )}
    >
      {active && (
        <motion.span
          layoutId="chat-active"
          className="absolute inset-y-2 left-0 w-[3px] rounded-full bg-kyy-gradient"
          transition={{ type: 'spring', stiffness: 420, damping: 32 }}
        />
      )}
      <Avatar jid={chat.id} name={chat.name} size={46} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span
            className={cx(
              'truncate text-[14px] font-semibold',
              active ? 'text-slate-50' : 'text-slate-200',
            )}
          >
            {chat.name || jidToNumber(chat.id)}
          </span>
          <span
            className={cx(
              'shrink-0 text-[10.5px] font-medium tabular-nums',
              chat.unreadCount > 0 ? 'text-kyy-300' : 'text-slate-500',
            )}
          >
            {formatChatTime(chat.conversationTimestamp)}
          </span>
        </div>
        <div className="mt-0.5 flex items-center gap-1.5">
          {typing ? (
            <span className="flex items-center gap-1 text-[12.5px] font-medium text-kyy-300">
              typing
              <span className="flex gap-0.5">
                {[0, 1, 2].map((i) => (
                  <motion.span
                    key={i}
                    className="h-1 w-1 rounded-full bg-kyy-300"
                    animate={{ y: [0, -3, 0] }}
                    transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }}
                  />
                ))}
              </span>
            </span>
          ) : (
            <>
              {chat.lastMessage?.fromMe && <Ack ack={chat.lastMessage.ack} />}
              <span className="truncate text-[12.5px] text-slate-500">
                {chat.lastMessage?.text || 'No messages yet'}
              </span>
            </>
          )}
          {chat.unreadCount > 0 && (
            <motion.span
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="ml-auto grid h-[19px] min-w-[19px] shrink-0 place-items-center rounded-full bg-kyy-gradient px-1.5 text-[10.5px] font-bold text-onaccent"
            >
              {chat.unreadCount > 99 ? '99+' : chat.unreadCount}
            </motion.span>
          )}
        </div>
      </div>
    </motion.button>
  )
})

export default function Sidebar({
  chats,
  activeJid,
  onSelect,
  session,
  theme,
  onToggleTheme,
  onLogout,
  tab,
  onTabChange,
  statusCount,
  presences,
  connectionLost,
}) {
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return chats
    return chats.filter(
      (chat) =>
        chat.name?.toLowerCase().includes(q) ||
        chat.id.toLowerCase().includes(q) ||
        chat.lastMessage?.text?.toLowerCase().includes(q),
    )
  }, [chats, query])

  const me = session?.me

  return (
    <aside className="flex h-full min-h-0 w-full flex-col border-r border-white/[0.06] bg-ink-900/60 backdrop-blur-2xl">
      {/* header */}
      <div className="flex items-center justify-between gap-2 px-4 pb-3 pt-4">
        <LogoWordmark size={38} subtitle={false} />
        <div className="flex items-center gap-1">
          <button
            onClick={onToggleTheme}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            className="grid h-9 w-9 place-items-center rounded-xl text-slate-400 transition hover:bg-white/[0.06] hover:text-slate-100"
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={theme}
                initial={{ rotate: -90, opacity: 0, scale: 0.6 }}
                animate={{ rotate: 0, opacity: 1, scale: 1 }}
                exit={{ rotate: 90, opacity: 0, scale: 0.6 }}
                transition={{ duration: 0.2 }}
              >
                {theme === 'dark' ? <IconMoon className="h-[18px] w-[18px]" /> : <IconSun className="h-[18px] w-[18px]" />}
              </motion.span>
            </AnimatePresence>
          </button>
          <button
            onClick={onLogout}
            title="Logout / disconnect"
            className="grid h-9 w-9 place-items-center rounded-xl text-slate-400 transition hover:bg-rose-500/12 hover:text-rose-300"
          >
            <IconLogout className="h-[18px] w-[18px]" />
          </button>
        </div>
      </div>

      {/* profile card */}
      {me && (
        <div className="mx-3 mb-3 flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.03] px-3 py-2.5">
          <Avatar jid={me.id} name={me.name || 'Me'} src={me.imageUrl} size={38} online />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold text-slate-100">
              {me.name || 'My account'}
            </p>
            <p className="truncate font-mono text-[11px] text-slate-500">+{me.phone}</p>
          </div>
          <StatusPill state={connectionLost ? 'disconnected' : session?.state} />
        </div>
      )}

      {/* tabs */}
      <div className="mx-3 mb-3 grid grid-cols-2 gap-1 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-1">
        {[
          { id: 'chats', label: 'Chats', Icon: IconChats, badge: null },
          { id: 'status', label: 'Status', Icon: IconStatus, badge: statusCount },
        ].map(({ id, label, Icon, badge }) => (
          <button
            key={id}
            onClick={() => onTabChange(id)}
            className={cx(
              'relative z-10 flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-[12.5px] font-semibold transition-colors',
              tab === id ? 'text-onaccent' : 'text-slate-400 hover:text-slate-200',
            )}
          >
            {tab === id && (
              <motion.span
                layoutId="tab-pill"
                className="absolute inset-0 -z-10 rounded-xl bg-kyy-gradient"
                transition={{ type: 'spring', stiffness: 420, damping: 34 }}
              />
            )}
            <Icon className="h-4 w-4" />
            {label}
            {badge > 0 && (
              <span
                className={cx(
                  'rounded-full px-1.5 text-[10px] font-bold',
                  tab === id ? 'bg-onaccent/20 text-onaccent' : 'bg-kyy-400/15 text-kyy-300',
                )}
              >
                {badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* search */}
      {tab === 'chats' && (
        <div className="relative mx-3 mb-2">
          <IconSearch className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search chats…"
            className="input py-2.5 pl-10 pr-9 text-[13px]"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
            >
              <IconClose className="h-4 w-4" />
            </button>
          )}
        </div>
      )}

      {/* list */}
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {tab === 'chats' ? (
          filtered.length ? (
            <motion.div layout className="space-y-0.5">
              <AnimatePresence initial={false}>
                {filtered.map((chat) => (
                  <ChatRow
                    key={chat.id}
                    chat={chat}
                    active={chat.id === activeJid}
                    onSelect={onSelect}
                    typing={presences?.[chat.id]?.state === 'composing'}
                  />
                ))}
              </AnimatePresence>
            </motion.div>
          ) : (
            <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
              <span className="grid h-14 w-14 place-items-center rounded-2xl border border-white/[0.07] bg-white/[0.03]">
                <IconChats className="h-6 w-6 text-slate-600" />
              </span>
              <p className="text-[13px] font-medium text-slate-400">
                {query ? 'No chats match your search' : 'Waiting for chats to sync'}
              </p>
              {!query && (
                <p className="max-w-[210px] text-[11.5px] leading-relaxed text-slate-600">
                  Send or receive a message on your phone and it will appear here instantly.
                </p>
              )}
            </div>
          )
        ) : null}
      </div>

      {/* footer */}
      <div className="border-t border-white/[0.06] px-4 py-3">
        <div className="mb-2 flex items-start gap-2 rounded-xl border border-amber-400/15 bg-amber-400/[0.05] px-2.5 py-2">
          <IconWarning className="mt-px h-3.5 w-3.5 shrink-0 text-amber-400/80" />
          <p className="text-[10px] leading-snug text-amber-200/70">
            Unofficial WhatsApp client. Gunakan dengan risiko sendiri.
          </p>
        </div>
        <p className="text-center text-[10px] text-slate-600">
          KyyWA v1.0 · crafted by <span className="font-semibold text-slate-500">KyyDevv</span>
        </p>
      </div>
    </aside>
  )
}
