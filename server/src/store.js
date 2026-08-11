import fs from 'node:fs'
import path from 'node:path'
import { config, paths } from './config.js'
import logger from './logger.js'

/**
 * Tiny persistent store for chats / contacts / messages.
 *
 * Baileys 6.7 dropped `makeInMemoryStore`, so KyyWA keeps its own lightweight
 * snapshot on disk (inside the Railway volume) and hydrates it on boot. Writes
 * are debounced so a busy account does not hammer the volume.
 */
class KyyStore {
  constructor() {
    this.file = path.join(paths.store, 'store.json')
    this.chats = new Map() // jid -> chat
    this.contacts = new Map() // jid -> contact
    this.messages = new Map() // jid -> array (oldest → newest)
    this.presences = new Map() // jid -> presence
    this.statuses = new Map() // statusKey -> status item
    this._dirty = false
    this._timer = null
    this._maxMessages = config.messageCacheSize
  }

  load() {
    try {
      if (!fs.existsSync(this.file)) return
      const raw = JSON.parse(fs.readFileSync(this.file, 'utf8'))
      for (const chat of raw.chats || []) this.chats.set(chat.id, chat)
      for (const contact of raw.contacts || []) this.contacts.set(contact.id, contact)
      for (const [jid, list] of Object.entries(raw.messages || {})) {
        this.messages.set(jid, list.slice(-this._maxMessages))
      }
      for (const status of raw.statuses || []) this.statuses.set(status.id, status)
      logger.info(
        { chats: this.chats.size, contacts: this.contacts.size },
        'store hydrated from disk',
      )
    } catch (err) {
      logger.warn({ err: err.message }, 'could not hydrate store, starting fresh')
    }
  }

  markDirty() {
    this._dirty = true
    if (this._timer) return
    this._timer = setTimeout(() => {
      this._timer = null
      this.flush()
    }, 1500)
    this._timer.unref?.()
  }

  flush() {
    if (!this._dirty) return
    this._dirty = false
    try {
      const payload = {
        savedAt: Date.now(),
        chats: [...this.chats.values()],
        contacts: [...this.contacts.values()],
        statuses: [...this.statuses.values()].slice(-200),
        messages: Object.fromEntries(
          [...this.messages.entries()].map(([jid, list]) => [jid, list.slice(-this._maxMessages)]),
        ),
      }
      const tmp = `${this.file}.tmp`
      fs.writeFileSync(tmp, JSON.stringify(payload))
      fs.renameSync(tmp, this.file)
    } catch (err) {
      logger.warn({ err: err.message }, 'store flush failed')
    }
  }

  reset() {
    this.chats.clear()
    this.contacts.clear()
    this.messages.clear()
    this.presences.clear()
    this.statuses.clear()
    this._dirty = true
    this.flush()
    try {
      fs.rmSync(this.file, { force: true })
    } catch {
      /* noop */
    }
  }

  /* ------------------------------- chats -------------------------------- */

  upsertChat(chat) {
    if (!chat?.id) return null
    const prev = this.chats.get(chat.id) || {}
    const next = { ...prev, ...chat }
    this.chats.set(chat.id, next)
    this.markDirty()
    return next
  }

  removeChat(jid) {
    this.chats.delete(jid)
    this.messages.delete(jid)
    this.markDirty()
  }

  getChats() {
    return [...this.chats.values()].sort(
      (a, b) => (b.conversationTimestamp || 0) - (a.conversationTimestamp || 0),
    )
  }

  /* ------------------------------ contacts ------------------------------ */

  upsertContact(contact) {
    if (!contact?.id) return null
    const prev = this.contacts.get(contact.id) || {}
    const next = { ...prev, ...contact }
    this.contacts.set(contact.id, next)
    this.markDirty()
    return next
  }

  getContact(jid) {
    return this.contacts.get(jid) || null
  }

  /* ------------------------------ messages ------------------------------ */

  list(jid) {
    return this.messages.get(jid) || []
  }

  upsertMessage(jid, message, mode = 'append') {
    if (!jid || !message?.id) return message
    const list = this.messages.get(jid) || []
    const index = list.findIndex((item) => item.id === message.id)
    if (index >= 0) {
      list[index] = { ...list[index], ...message }
    } else if (mode === 'prepend') {
      list.unshift(message)
    } else {
      list.push(message)
      list.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))
    }
    if (list.length > this._maxMessages) list.splice(0, list.length - this._maxMessages)
    this.messages.set(jid, list)
    this.markDirty()
    return index >= 0 ? list[index] : message
  }

  updateMessage(jid, id, patch) {
    const list = this.messages.get(jid)
    if (!list) return null
    const index = list.findIndex((item) => item.id === id)
    if (index < 0) return null
    list[index] = { ...list[index], ...patch }
    this.markDirty()
    return list[index]
  }

  removeMessage(jid, id) {
    const list = this.messages.get(jid)
    if (!list) return
    const next = list.filter((item) => item.id !== id)
    this.messages.set(jid, next)
    this.markDirty()
  }

  findMessage(id) {
    for (const [jid, list] of this.messages) {
      const found = list.find((item) => item.id === id)
      if (found) return { jid, message: found }
    }
    return null
  }

  /* ------------------------------ statuses ------------------------------ */

  upsertStatus(status) {
    if (!status?.id) return null
    this.statuses.set(status.id, { ...(this.statuses.get(status.id) || {}), ...status })
    this.markDirty()
    return this.statuses.get(status.id)
  }

  getStatuses() {
    const cutoff = Date.now() / 1000 - 60 * 60 * 24 // statuses live 24h
    return [...this.statuses.values()]
      .filter((item) => (item.timestamp || 0) > cutoff)
      .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
  }
}

export const store = new KyyStore()
export default store
