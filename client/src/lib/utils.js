export const cx = (...parts) => parts.filter(Boolean).join(' ')

export function formatTime(ts) {
  if (!ts) return ''
  return new Date(ts * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export function formatChatTime(ts) {
  if (!ts) return ''
  const date = new Date(ts * 1000)
  const now = new Date()
  const sameDay = date.toDateString() === now.toDateString()
  if (sameDay) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday'

  const diffDays = (now - date) / 86400000
  if (diffDays < 7) return date.toLocaleDateString([], { weekday: 'short' })
  return date.toLocaleDateString([], { day: '2-digit', month: '2-digit', year: '2-digit' })
}

export function dayLabel(ts) {
  const date = new Date(ts * 1000)
  const now = new Date()
  if (date.toDateString() === now.toDateString()) return 'Today'
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return date.toLocaleDateString([], { day: 'numeric', month: 'long', year: 'numeric' })
}

export function formatBytes(bytes) {
  if (!bytes) return ''
  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let index = 0
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024
    index += 1
  }
  return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`
}

export function formatDuration(seconds) {
  if (!seconds) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

export const jidToNumber = (jid = '') => jid.split('@')[0].split(':')[0]

export const isGroupJid = (jid = '') => jid.endsWith('@g.us')

/** Deterministic gradient avatar colours derived from the jid. */
const PALETTES = [
  ['#1fe9c8', '#0ea5e9'],
  ['#a98bff', '#6366f1'],
  ['#f472b6', '#a855f7'],
  ['#fbbf24', '#f97316'],
  ['#34d399', '#059669'],
  ['#60a5fa', '#7c3aed'],
  ['#f87171', '#db2777'],
  ['#2dd4bf', '#4f46e5'],
]

export function avatarGradient(jid = '') {
  let hash = 0
  for (let i = 0; i < jid.length; i += 1) hash = (hash * 31 + jid.charCodeAt(i)) >>> 0
  const [from, to] = PALETTES[hash % PALETTES.length]
  return `linear-gradient(135deg, ${from}, ${to})`
}

export function initials(name = '') {
  const clean = name.replace(/[^\p{L}\p{N}\s]/gu, '').trim()
  if (!clean) return '#'
  const words = clean.split(/\s+/).slice(0, 2)
  return words.map((w) => w[0]?.toUpperCase() || '').join('') || '#'
}

/** Split text into plain / url / mention segments for rich rendering. */
/**
 * Split message text into renderable tokens: links, @mentions and WhatsApp's
 * inline markup (*bold*, _italic_, ~strike~, ```mono```).
 * Returns `{ type, value, styles }` where `styles` is the set of inline marks.
 */
export function tokenize(text = '') {
  const pattern =
    /(https?:\/\/[^\s]+|www\.[^\s]+|@\d{5,}|```([^`]+)```|`([^`\n]+)`|\*(\S(?:[^*\n]*\S)?)\*|_(\S(?:[^_\n]*\S)?)_|~(\S(?:[^~\n]*\S)?)~)/g

  const out = []
  let last = 0
  let match

  while ((match = pattern.exec(text))) {
    if (match.index > last) out.push({ type: 'text', value: text.slice(last, match.index) })
    const raw = match[0]

    if (raw.startsWith('http') || raw.startsWith('www.')) {
      out.push({ type: 'link', value: raw, href: raw.startsWith('www.') ? `https://${raw}` : raw })
    } else if (raw.startsWith('@')) {
      out.push({ type: 'mention', value: raw })
    } else if (match[2] !== undefined || match[3] !== undefined) {
      out.push({ type: 'text', value: match[2] ?? match[3], styles: ['mono'] })
    } else if (match[4] !== undefined) {
      out.push({ type: 'text', value: match[4], styles: ['bold'] })
    } else if (match[5] !== undefined) {
      out.push({ type: 'text', value: match[5], styles: ['italic'] })
    } else if (match[6] !== undefined) {
      out.push({ type: 'text', value: match[6], styles: ['strike'] })
    } else {
      out.push({ type: 'text', value: raw })
    }
    last = match.index + raw.length
  }

  if (last < text.length) out.push({ type: 'text', value: text.slice(last) })
  return out
}

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

export function groupByDay(messages = []) {
  const groups = []
  let current = null
  for (const message of messages) {
    const label = dayLabel(message.timestamp)
    if (!current || current.label !== label) {
      current = { label, items: [] }
      groups.push(current)
    }
    current.items.push(message)
  }
  return groups
}
