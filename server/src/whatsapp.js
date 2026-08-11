import fs from 'node:fs'
import path from 'node:path'
import { EventEmitter } from 'node:events'
import { Boom } from '@hapi/boom'
import QRCode from 'qrcode'
import * as baileys from '@whiskeysockets/baileys'

import { config, paths } from './config.js'
import logger, { waLogger } from './logger.js'
import { store } from './store.js'
import { serializeMessage, chatPreview, displayName, STATUS_JID } from './serialize.js'

// Baileys 6.7 ships named exports on the module namespace; the socket factory
// is the default export. Destructuring the namespace keeps both worlds happy.
const {
  default: makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  DisconnectReason,
  Browsers,
  jidNormalizedUser,
  downloadMediaMessage,
  delay,
  getAggregateVotesInPollMessage,
} = baileys

/** Connection lifecycle states surfaced to the UI. */
export const STATES = {
  IDLE: 'idle',
  CONNECTING: 'connecting',
  WAITING_QR: 'waiting_qr',
  WAITING_PAIRING: 'waiting_pairing',
  CONNECTED: 'connected',
  DISCONNECTED: 'disconnected',
  LOGGED_OUT: 'logged_out',
  ERROR: 'error',
}

const RECONNECT_BASE_MS = 2000
const RECONNECT_MAX_MS = 30000

export class WhatsAppService extends EventEmitter {
  constructor() {
    super()
    this.sock = null
    this.state = STATES.IDLE
    this.qr = null // data-url
    this.qrExpiresAt = null
    this.pairingCode = null
    this.pairingNumber = null
    this.me = null
    this.lastError = null
    this.startedAt = null
    this.reconnectAttempts = 0
    this._reconnectTimer = null
    this._starting = false
    this._intentionalStop = false
    this._method = 'qr'
    this._saveCreds = null
    this._sendQueue = Promise.resolve()
    /** id -> raw proto message, needed to decrypt media later (memory only) */
    this._rawCache = new Map()
    this._rawCacheLimit = 600
  }

  _cacheRaw(id, raw) {
    if (!id || !raw) return
    if (this._rawCache.has(id)) this._rawCache.delete(id)
    this._rawCache.set(id, raw)
    if (this._rawCache.size > this._rawCacheLimit) {
      const oldest = this._rawCache.keys().next().value
      this._rawCache.delete(oldest)
    }
  }

  /* ============================ public API ============================== */

  hasSession() {
    try {
      return fs.existsSync(path.join(paths.auth, 'creds.json'))
    } catch {
      return false
    }
  }

  snapshot() {
    return {
      state: this.state,
      method: this._method,
      qr: this.qr,
      qrExpiresAt: this.qrExpiresAt,
      pairingCode: this.pairingCode,
      pairingNumber: this.pairingNumber,
      me: this.me,
      hasSession: this.hasSession(),
      lastError: this.lastError,
      startedAt: this.startedAt,
      reconnectAttempts: this.reconnectAttempts,
      uptime: this.startedAt ? Date.now() - this.startedAt : 0,
    }
  }

  setState(state, extra = {}) {
    this.state = state
    this.emit('state', { ...this.snapshot(), ...extra })
  }

  /**
   * Boot (or reboot) the Baileys socket.
   * @param {{ method?: 'qr'|'pairing', phoneNumber?: string }} options
   */
  async start(options = {}) {
    if (this._starting) return this.snapshot()
    this._starting = true
    this._intentionalStop = false
    clearTimeout(this._reconnectTimer)

    const method = options.method || this._method || 'qr'
    this._method = method
    if (options.phoneNumber) this.pairingNumber = sanitizeNumber(options.phoneNumber)

    try {
      await this._closeSocket()
      this.lastError = null
      this.setState(STATES.CONNECTING)

      const { state: authState, saveCreds } = await useMultiFileAuthState(paths.auth)
      this._saveCreds = saveCreds

      const { version, isLatest } = await fetchLatestBaileysVersion().catch((err) => {
        logger.warn({ err: err.message }, 'version lookup failed, using bundled default')
        return { version: undefined, isLatest: false }
      })
      if (version) logger.info({ version: version.join('.'), isLatest }, 'WA web version')

      const usePairing = method === 'pairing' && !authState.creds.registered

      const sock = makeWASocket({
        version,
        logger: waLogger,
        auth: {
          creds: authState.creds,
          keys: makeCacheableSignalKeyStore(authState.keys, waLogger),
        },
        // With pairing-code flow we must NOT print/emit a QR.
        printQRInTerminal: false,
        browser: usePairing
          ? Browsers.ubuntu('Chrome')
          : [config.browserName, 'Chrome', '121.0.0'],
        markOnlineOnConnect: config.markOnlineOnConnect,
        syncFullHistory: config.syncFullHistory,
        generateHighQualityLinkPreview: true,
        defaultQueryTimeoutMs: 60_000,
        keepAliveIntervalMs: 25_000,
        retryRequestDelayMs: 500,
        emitOwnEvents: true,
        getMessage: async (key) => {
          const found = store.findMessage(key.id)
          return found ? { conversation: found.message.text || '' } : undefined
        },
      })

      this.sock = sock
      this._bind(sock, saveCreds)

      if (usePairing) {
        if (!this.pairingNumber) throw new Error('Phone number is required for pairing code login')
        this.setState(STATES.WAITING_PAIRING)
        // WhatsApp needs a beat after the socket opens before accepting the request
        await delay(3000)
        try {
          const code = await sock.requestPairingCode(this.pairingNumber)
          this.pairingCode = formatPairingCode(code)
          logger.info({ number: this.pairingNumber }, 'pairing code issued')
          this.setState(STATES.WAITING_PAIRING)
        } catch (err) {
          logger.error({ err: err.message }, 'requestPairingCode failed')
          this.lastError = `Failed to request pairing code: ${err.message}`
          this.setState(STATES.ERROR)
        }
      }

      return this.snapshot()
    } catch (err) {
      logger.error({ err: err.message }, 'failed to start socket')
      this.lastError = err.message
      this.setState(STATES.ERROR)
      this._scheduleReconnect()
      return this.snapshot()
    } finally {
      this._starting = false
    }
  }

  /** Close the socket without wiping credentials. */
  async disconnect() {
    this._intentionalStop = true
    clearTimeout(this._reconnectTimer)
    await this._closeSocket()
    this.qr = null
    this.pairingCode = null
    this.setState(STATES.DISCONNECTED)
    return this.snapshot()
  }

  /** Log out from WhatsApp and delete the local session. */
  async logout() {
    this._intentionalStop = true
    clearTimeout(this._reconnectTimer)
    try {
      await this.sock?.logout()
    } catch (err) {
      logger.warn({ err: err.message }, 'logout call failed (session cleared anyway)')
    }
    await this._closeSocket()
    this.clearSession()
    this.me = null
    this.qr = null
    this.pairingCode = null
    this.pairingNumber = null
    this.setState(STATES.LOGGED_OUT)
    this.emit('cleared')
    return this.snapshot()
  }

  clearSession() {
    try {
      fs.rmSync(paths.auth, { recursive: true, force: true })
      fs.mkdirSync(paths.auth, { recursive: true })
    } catch (err) {
      logger.warn({ err: err.message }, 'could not clear auth folder')
    }
    store.reset()
  }

  assertReady() {
    if (this.state !== STATES.CONNECTED || !this.sock) {
      throw new Boom('WhatsApp is not connected', { statusCode: 409 })
    }
  }

  /* ============================== internals ============================= */

  async _closeSocket() {
    const sock = this.sock
    this.sock = null
    if (!sock) return
    try {
      sock.ev.removeAllListeners()
      sock.ws?.close()
      sock.end?.(undefined)
    } catch {
      /* noop */
    }
  }

  _scheduleReconnect() {
    if (this._intentionalStop) return
    this.reconnectAttempts += 1
    const wait = Math.min(RECONNECT_BASE_MS * 2 ** (this.reconnectAttempts - 1), RECONNECT_MAX_MS)
    logger.info({ attempt: this.reconnectAttempts, wait }, 'scheduling reconnect')
    clearTimeout(this._reconnectTimer)
    this._reconnectTimer = setTimeout(() => {
      this.start({ method: this._method }).catch((err) =>
        logger.error({ err: err.message }, 'reconnect failed'),
      )
    }, wait)
    this._reconnectTimer.unref?.()
  }

  _bind(sock, saveCreds) {
    sock.ev.on('creds.update', saveCreds)

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr, isNewLogin, receivedPendingNotifications } = update

      if (qr) {
        try {
          this.qr = await QRCode.toDataURL(qr, {
            margin: 1,
            width: 512,
            errorCorrectionLevel: 'M',
            color: { dark: '#04211d', light: '#ffffff' },
          })
          this.qrExpiresAt = Date.now() + 58_000 // Baileys re-emits roughly every minute
          this.reconnectAttempts = 0
          this.setState(STATES.WAITING_QR)
        } catch (err) {
          logger.error({ err: err.message }, 'QR render failed')
        }
      }

      if (isNewLogin) logger.info('new login detected')
      if (receivedPendingNotifications) this.emit('sync', { pending: false })

      if (connection === 'open') {
        this.qr = null
        this.qrExpiresAt = null
        this.pairingCode = null
        this.reconnectAttempts = 0
        this.startedAt = Date.now()
        this.lastError = null
        const user = sock.user || {}
        this.me = {
          id: user.id ? jidNormalizedUser(user.id) : null,
          lid: user.lid || null,
          name: user.name || user.verifiedName || user.notify || null,
          phone: user.id ? user.id.split(':')[0].split('@')[0] : null,
          imageUrl: null,
        }
        this.setState(STATES.CONNECTED)
        logger.info({ me: this.me?.phone }, 'connected to WhatsApp')
        this._hydrateProfile().catch(() => {})
      }

      if (connection === 'close') {
        const boom = lastDisconnect?.error
        const statusCode = boom?.output?.statusCode || boom?.output?.payload?.statusCode
        const reason = reasonName(statusCode)
        logger.warn({ statusCode, reason }, 'connection closed')

        if (statusCode === DisconnectReason.loggedOut || statusCode === DisconnectReason.forbidden) {
          this.clearSession()
          this.me = null
          this.qr = null
          this.lastError = 'Session logged out from the phone. Please link again.'
          this.setState(STATES.LOGGED_OUT)
          this.emit('cleared')
          return
        }

        if (statusCode === DisconnectReason.connectionReplaced) {
          this.lastError = 'Connection replaced — another session opened for this number.'
          this.setState(STATES.DISCONNECTED)
          return
        }

        if (statusCode === DisconnectReason.badSession) {
          this.clearSession()
          this.lastError = 'Corrupted session was reset. Please link again.'
          this.setState(STATES.LOGGED_OUT)
          return
        }

        this.lastError = boom?.message || `Connection closed (${reason})`
        this.setState(STATES.DISCONNECTED)
        this._scheduleReconnect()
      }
    })

    /* ------------------------------ chats ------------------------------- */
    sock.ev.on('chats.upsert', (chats) => {
      const mapped = chats.map((chat) => this._mapChat(chat)).filter(Boolean)
      if (mapped.length) this.emit('chats.upsert', mapped)
    })

    sock.ev.on('chats.update', (updates) => {
      const mapped = []
      for (const update of updates) {
        if (!update.id) continue
        const merged = store.upsertChat({
          id: update.id,
          ...(update.name !== undefined ? { name: update.name } : {}),
          ...(update.unreadCount !== undefined
            ? { unreadCount: Math.max(0, Number(update.unreadCount) || 0) }
            : {}),
          ...(update.conversationTimestamp
            ? { conversationTimestamp: Number(update.conversationTimestamp) }
            : {}),
          ...(update.archived !== undefined ? { archived: update.archived } : {}),
          ...(update.pinned !== undefined ? { pinned: Boolean(update.pinned) } : {}),
          ...(update.muteEndTime !== undefined ? { muteEndTime: update.muteEndTime } : {}),
        })
        if (merged) mapped.push(this._decorateChat(merged))
      }
      if (mapped.length) this.emit('chats.update', mapped)
    })

    sock.ev.on('chats.delete', (ids) => {
      for (const id of ids) store.removeChat(id)
      this.emit('chats.delete', ids)
    })

    /* ---------------------------- contacts ------------------------------ */
    const handleContacts = (contacts) => {
      const mapped = []
      for (const contact of contacts) {
        if (!contact?.id) continue
        const saved = store.upsertContact({
          id: jidNormalizedUser(contact.id),
          name: contact.name || contact.verifiedName || undefined,
          notify: contact.notify || undefined,
          imgUrl: contact.imgUrl === 'changed' ? undefined : contact.imgUrl,
        })
        if (saved) mapped.push(saved)
      }
      if (mapped.length) this.emit('contacts.update', mapped)
    }
    sock.ev.on('contacts.upsert', handleContacts)
    sock.ev.on('contacts.update', handleContacts)

    /* --------------------------- history sync --------------------------- */
    sock.ev.on('messaging-history.set', ({ chats, contacts, messages, isLatest }) => {
      logger.info(
        { chats: chats?.length, contacts: contacts?.length, messages: messages?.length, isLatest },
        'history sync chunk',
      )
      if (contacts?.length) handleContacts(contacts)
      const mappedChats = (chats || []).map((chat) => this._mapChat(chat)).filter(Boolean)
      for (const raw of messages || []) {
        const message = serializeMessage(raw, { selfJid: this.me?.id })
        if (!message) continue
        if (message.media) this._cacheRaw(message.id, raw)
        if (message.chatId === STATUS_JID) {
          store.upsertStatus(this._mapStatus(message))
          continue
        }
        store.upsertMessage(message.chatId, message)
      }
      if (mappedChats.length) this.emit('chats.upsert', mappedChats)
      this.emit('history', { isLatest: Boolean(isLatest), chats: store.getChats().length })
    })

    /* ---------------------------- messages ------------------------------ */
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      for (const raw of messages) {
        const message = serializeMessage(raw, { selfJid: this.me?.id })
        if (!message) continue
        if (message.media) this._cacheRaw(message.id, raw)

        // Deleted-for-everyone marker
        const protocol = raw.message?.protocolMessage
        if (protocol?.type === 0 && protocol.key?.id) {
          const target = protocol.key.remoteJid || message.chatId
          store.updateMessage(target, protocol.key.id, {
            deleted: true,
            text: '',
            media: null,
            kind: 'text',
          })
          this.emit('message.revoke', { chatId: target, id: protocol.key.id })
          continue
        }

        if (message.type === 'protocolMessage' || message.type === 'senderKeyDistributionMessage') {
          continue
        }

        if (message.chatId === STATUS_JID) {
          const status = this._mapStatus(message)
          store.upsertStatus(status)
          this.emit('status.upsert', status)
          continue
        }

        if (message.kind === 'reaction') {
          const targetId = message.reaction?.targetId
          if (targetId) {
            const existing = store.list(message.chatId).find((m) => m.id === targetId)
            const reactions = { ...(existing?.reactions || {}) }
            if (message.reaction.emoji) reactions[message.sender || 'me'] = message.reaction.emoji
            else delete reactions[message.sender || 'me']
            store.updateMessage(message.chatId, targetId, { reactions })
            this.emit('message.reaction', { chatId: message.chatId, id: targetId, reactions })
          }
          continue
        }

        store.upsertMessage(message.chatId, message, type === 'append' ? 'append' : 'append')

        const chat = store.upsertChat({
          id: message.chatId,
          conversationTimestamp: message.timestamp,
          name: store.chats.get(message.chatId)?.name || message.senderName || undefined,
          unreadCount: message.fromMe
            ? 0
            : (store.chats.get(message.chatId)?.unreadCount || 0) + (type === 'notify' ? 1 : 0),
        })

        this.emit('message', {
          message: this._decorateMessage(message),
          chat: this._decorateChat(chat),
          notify: type === 'notify' && !message.fromMe,
        })
      }
    })

    sock.ev.on('messages.update', (updates) => {
      for (const { key, update } of updates) {
        if (!key?.remoteJid || !key.id) continue
        const patch = {}
        if (update.status !== undefined) {
          patch.status = update.status
          patch.ack = update.status
        }
        if (update.starred !== undefined) patch.starred = update.starred
        if (update.message === null) patch.deleted = true
        if (update.pollUpdates) {
          try {
            const found = store.list(key.remoteJid).find((m) => m.id === key.id)
            patch.pollVotes = getAggregateVotesInPollMessage?.({
              message: found?.raw,
              pollUpdates: update.pollUpdates,
            })
          } catch {
            /* noop */
          }
        }
        if (!Object.keys(patch).length) continue
        const updated = store.updateMessage(key.remoteJid, key.id, patch)
        if (updated) this.emit('message.update', { chatId: key.remoteJid, id: key.id, patch })
      }
    })

    sock.ev.on('messages.delete', (item) => {
      if ('all' in item) {
        store.messages.set(item.jid, [])
        this.emit('messages.clear', { chatId: item.jid })
        return
      }
      for (const key of item.keys || []) {
        if (!key.remoteJid || !key.id) continue
        store.removeMessage(key.remoteJid, key.id)
        this.emit('message.revoke', { chatId: key.remoteJid, id: key.id })
      }
    })

    sock.ev.on('message-receipt.update', (updates) => {
      for (const { key, receipt } of updates) {
        if (!key?.remoteJid || !key.id) continue
        const patch = {}
        if (receipt?.readTimestamp) patch.ack = 4
        else if (receipt?.receiptTimestamp) patch.ack = 3
        if (!Object.keys(patch).length) continue
        store.updateMessage(key.remoteJid, key.id, patch)
        this.emit('message.update', { chatId: key.remoteJid, id: key.id, patch })
      }
    })

    /* ---------------------------- presence ------------------------------ */
    sock.ev.on('presence.update', ({ id, presences }) => {
      if (!id || !presences) return
      const entries = Object.entries(presences)
      if (!entries.length) return
      const [participant, data] = entries[0]
      const presence = {
        chatId: id,
        participant,
        state: data?.lastKnownPresence || 'unavailable',
        lastSeen: data?.lastSeen || null,
      }
      store.presences.set(id, presence)
      this.emit('presence', presence)
    })

    sock.ev.on('groups.update', (updates) => {
      for (const update of updates) {
        if (!update.id) continue
        const chat = store.upsertChat({
          id: update.id,
          name: update.subject || store.chats.get(update.id)?.name,
          isGroup: true,
        })
        if (chat) this.emit('chats.update', [this._decorateChat(chat)])
      }
    })
  }

  async _hydrateProfile() {
    if (!this.me?.id) return
    try {
      const url = await this.sock.profilePictureUrl(this.me.id, 'image').catch(() => null)
      if (url) {
        this.me.imageUrl = url
        this.setState(this.state)
      }
    } catch {
      /* noop */
    }
  }

  _mapChat(raw) {
    if (!raw?.id) return null
    const isGroup = raw.id.endsWith('@g.us')
    const chat = store.upsertChat({
      id: raw.id,
      name: raw.name || raw.subject || undefined,
      isGroup,
      unreadCount: Math.max(0, Number(raw.unreadCount) || 0),
      conversationTimestamp: Number(raw.conversationTimestamp?.low ?? raw.conversationTimestamp ?? 0),
      archived: Boolean(raw.archived),
      pinned: Boolean(raw.pinned),
      muteEndTime: raw.muteEndTime ? Number(raw.muteEndTime) : null,
      readOnly: Boolean(raw.readOnly),
    })
    return this._decorateChat(chat)
  }

  _mapStatus(message) {
    return {
      id: message.id,
      sender: message.sender,
      name: displayName(message.sender, message.senderName),
      timestamp: message.timestamp,
      kind: message.kind,
      text: message.text,
      media: message.media,
      fromMe: message.fromMe,
    }
  }

  /** Attach display metadata (name, avatar, last message) for the UI. */
  _decorateChat(chat) {
    if (!chat) return null
    const messages = store.list(chat.id)
    const last = messages[messages.length - 1] || null
    return {
      ...chat,
      name: displayName(chat.id, chat.name),
      isGroup: chat.isGroup ?? chat.id.endsWith('@g.us'),
      lastMessage: last
        ? {
            id: last.id,
            text: chatPreview(last),
            fromMe: last.fromMe,
            timestamp: last.timestamp,
            ack: last.ack,
            kind: last.kind,
          }
        : null,
      conversationTimestamp: chat.conversationTimestamp || last?.timestamp || 0,
    }
  }

  _decorateMessage(message) {
    return {
      ...message,
      senderName: displayName(message.sender, message.senderName),
    }
  }

  /* ============================== actions =============================== */

  /** Serialise outbound sends so bursts do not trip WhatsApp rate limits. */
  _enqueue(task) {
    const run = this._sendQueue.then(task, task)
    this._sendQueue = run.catch(() => {})
    return run
  }

  listChats({ search = '', limit = 200 } = {}) {
    const query = search.trim().toLowerCase()
    return store
      .getChats()
      .map((chat) => this._decorateChat(chat))
      .filter((chat) => {
        if (!query) return true
        return (
          chat.name?.toLowerCase().includes(query) ||
          chat.id.toLowerCase().includes(query) ||
          chat.lastMessage?.text?.toLowerCase().includes(query)
        )
      })
      .slice(0, limit)
  }

  listMessages(jid, { limit = 80, before } = {}) {
    let list = store.list(jid)
    if (before) {
      const index = list.findIndex((m) => m.id === before)
      if (index > 0) list = list.slice(0, index)
    }
    return list.slice(-limit).map((m) => this._decorateMessage(m))
  }

  async sendMessage(jid, content, options = {}) {
    this.assertReady()
    return this._enqueue(async () => {
      const target = normalizeJid(jid)
      await this.sock.presenceSubscribe(target).catch(() => {})
      const sent = await this.sock.sendMessage(target, content, options)
      const message = serializeMessage(sent, { selfJid: this.me?.id })
      if (message) {
        if (message.media) this._cacheRaw(message.id, sent)
        store.upsertMessage(message.chatId, message)
        store.upsertChat({ id: message.chatId, conversationTimestamp: message.timestamp })
      }
      return message
    })
  }

  async sendText(jid, text, { quotedId } = {}) {
    const quoted = quotedId ? this._findQuoted(jid, quotedId) : undefined
    return this.sendMessage(jid, { text }, quoted ? { quoted } : {})
  }

  async sendMedia(jid, { kind, buffer, mimetype, fileName, caption, ptt, quotedId }) {
    const quoted = quotedId ? this._findQuoted(jid, quotedId) : undefined
    let content
    switch (kind) {
      case 'image':
        content = { image: buffer, caption: caption || undefined, mimetype: mimetype || 'image/jpeg' }
        break
      case 'video':
        content = {
          video: buffer,
          caption: caption || undefined,
          mimetype: mimetype || 'video/mp4',
          gifPlayback: /gif/i.test(mimetype || ''),
        }
        break
      case 'audio':
        content = {
          audio: buffer,
          mimetype: ptt ? 'audio/ogg; codecs=opus' : mimetype || 'audio/mpeg',
          ptt: Boolean(ptt),
        }
        break
      case 'sticker':
        content = { sticker: buffer }
        break
      default:
        content = {
          document: buffer,
          mimetype: mimetype || 'application/octet-stream',
          fileName: fileName || 'file',
          caption: caption || undefined,
        }
    }
    return this.sendMessage(jid, content, quoted ? { quoted } : {})
  }

  _findQuoted(jid, quotedId) {
    const message = store.list(jid).find((m) => m.id === quotedId)
    if (!message) return undefined
    return {
      key: {
        remoteJid: jid,
        id: message.id,
        fromMe: message.fromMe,
        participant: message.isGroup ? message.sender : undefined,
      },
      message: { conversation: message.text || chatPreview(message) },
    }
  }

  async sendStatus({ kind, text, buffer, mimetype, caption, backgroundColor, font }) {
    this.assertReady()
    const content =
      kind === 'text'
        ? { text, backgroundColor: backgroundColor || '#0f766e', font: font ?? 0 }
        : kind === 'video'
          ? { video: buffer, caption }
          : { image: buffer, caption }

    const contacts = [...store.contacts.keys()].filter((jid) => jid.endsWith('@s.whatsapp.net'))
    const sent = await this.sock.sendMessage(STATUS_JID, content, {
      backgroundColor: backgroundColor || undefined,
      font: font ?? undefined,
      statusJidList: contacts.slice(0, 500),
      broadcast: true,
    })
    const message = serializeMessage(sent, { selfJid: this.me?.id })
    if (message) {
      const status = this._mapStatus(message)
      store.upsertStatus(status)
      this.emit('status.upsert', status)
      return status
    }
    return null
  }

  async react(jid, messageId, emoji) {
    this.assertReady()
    const message = store.list(jid).find((m) => m.id === messageId)
    if (!message) throw new Boom('Message not found', { statusCode: 404 })
    return this.sock.sendMessage(normalizeJid(jid), {
      react: {
        text: emoji,
        key: {
          remoteJid: jid,
          id: messageId,
          fromMe: message.fromMe,
          participant: message.isGroup ? message.sender : undefined,
        },
      },
    })
  }

  async deleteMessage(jid, messageId) {
    this.assertReady()
    const message = store.list(jid).find((m) => m.id === messageId)
    if (!message) throw new Boom('Message not found', { statusCode: 404 })
    await this.sock.sendMessage(normalizeJid(jid), {
      delete: {
        remoteJid: jid,
        id: messageId,
        fromMe: message.fromMe,
        participant: message.isGroup ? message.sender : undefined,
      },
    })
    store.updateMessage(jid, messageId, { deleted: true, text: '', media: null })
    this.emit('message.revoke', { chatId: jid, id: messageId })
  }

  async markRead(jid) {
    this.assertReady()
    const list = store.list(jid).filter((m) => !m.fromMe).slice(-20)
    if (list.length) {
      await this.sock
        .readMessages(
          list.map((m) => ({
            remoteJid: jid,
            id: m.id,
            participant: m.isGroup ? m.sender : undefined,
          })),
        )
        .catch(() => {})
    }
    const chat = store.upsertChat({ id: jid, unreadCount: 0 })
    this.emit('chats.update', [this._decorateChat(chat)])
  }

  async setTyping(jid, isTyping) {
    if (this.state !== STATES.CONNECTED) return
    const target = normalizeJid(jid)
    await this.sock
      .sendPresenceUpdate(isTyping ? 'composing' : 'paused', target)
      .catch(() => {})
  }

  async subscribePresence(jid) {
    if (this.state !== STATES.CONNECTED) return
    await this.sock.presenceSubscribe(normalizeJid(jid)).catch(() => {})
  }

  async profilePicture(jid) {
    this.assertReady()
    return this.sock.profilePictureUrl(normalizeJid(jid), 'image').catch(() => null)
  }

  /** Download media for a stored message and cache it inside the volume. */
  async downloadMedia(jid, messageId) {
    this.assertReady()
    const message = store.list(jid).find((m) => m.id === messageId)
    if (!message || !message.media) throw new Boom('Media not found', { statusCode: 404 })

    const ext = extensionFor(message.media.mimetype, message.kind)
    const cacheName = `${messageId.replace(/[^a-z0-9]/gi, '')}${ext}`
    const cachePath = path.join(paths.media, cacheName)
    if (fs.existsSync(cachePath)) {
      return { path: cachePath, mimetype: message.media.mimetype, fileName: message.media.fileName }
    }

    const raw = await this._reconstructRaw(jid, message)
    const buffer = await downloadMediaMessage(
      raw,
      'buffer',
      {},
      { logger: waLogger, reuploadRequest: this.sock.updateMediaMessage },
    )
    fs.writeFileSync(cachePath, buffer)
    return { path: cachePath, mimetype: message.media.mimetype, fileName: message.media.fileName }
  }

  async _reconstructRaw(jid, message) {
    // Baileys needs the original proto to decrypt media; we keep it in an LRU.
    const cached = this._rawCache.get(message.id)
    if (cached) return cached
    const loaded = await this.sock?.loadMessage?.(jid, message.id).catch(() => null)
    if (loaded) return loaded
    throw new Boom(
      'Media payload is no longer cached (server restarted). Reopen the chat on your phone to resync.',
      { statusCode: 410 },
    )
  }
}

/* ------------------------------- helpers -------------------------------- */

function reasonName(code) {
  const entry = Object.entries(DisconnectReason).find(([, value]) => value === code)
  return entry?.[0] || 'unknown'
}

export function sanitizeNumber(input) {
  return String(input || '').replace(/\D/g, '')
}

function formatPairingCode(code) {
  const clean = String(code || '').replace(/-/g, '')
  return clean.length === 8 ? `${clean.slice(0, 4)}-${clean.slice(4)}` : clean
}

export function normalizeJid(jid) {
  if (!jid) return jid
  if (jid.includes('@')) return jid
  return `${sanitizeNumber(jid)}@s.whatsapp.net`
}

function extensionFor(mimetype = '', kind = '') {
  const map = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif',
    'video/mp4': '.mp4',
    'video/webm': '.webm',
    'audio/mpeg': '.mp3',
    'audio/mp4': '.m4a',
    'audio/ogg': '.ogg',
    'application/pdf': '.pdf',
  }
  const base = mimetype.split(';')[0].trim()
  if (map[base]) return map[base]
  if (kind === 'sticker') return '.webp'
  if (kind === 'image') return '.jpg'
  if (kind === 'video') return '.mp4'
  if (kind === 'audio') return '.ogg'
  return '.bin'
}

export const whatsapp = new WhatsAppService()
export default whatsapp
