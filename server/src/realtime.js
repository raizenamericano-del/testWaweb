import { Server } from 'socket.io'
import { config } from './config.js'
import logger from './logger.js'
import { store } from './store.js'
import { whatsapp } from './whatsapp.js'

/**
 * Socket.io bridge: pushes connection state, chats, messages, presence and
 * status updates to every connected browser tab.
 */
export function attachRealtime(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: config.corsOrigin, methods: ['GET', 'POST'], credentials: false },
    path: '/socket.io',
    maxHttpBufferSize: 1e6,
    pingTimeout: 30_000,
  })

  if (config.accessToken) {
    io.use((socket, next) => {
      const token = socket.handshake.auth?.token || socket.handshake.headers['x-access-token']
      if (token === config.accessToken) return next()
      next(new Error('unauthorized'))
    })
  }

  io.on('connection', (socket) => {
    logger.info({ id: socket.id }, 'client connected')

    socket.emit('bootstrap', {
      session: whatsapp.snapshot(),
      chats: whatsapp.listChats({ limit: 300 }),
      statuses: store.getStatuses(),
      contacts: [...store.contacts.values()].length,
      serverTime: Date.now(),
    })

    socket.on('chat:open', async (jid, cb) => {
      try {
        if (!jid) return cb?.({ ok: false, error: 'jid required' })
        const messages = whatsapp.listMessages(jid, { limit: 80 })
        await whatsapp.subscribePresence(jid)
        cb?.({ ok: true, messages })
      } catch (err) {
        cb?.({ ok: false, error: err.message })
      }
    })

    socket.on('chat:typing', ({ jid, typing }) => {
      whatsapp.setTyping(jid, typing).catch(() => {})
    })

    socket.on('session:state', (cb) => cb?.(whatsapp.snapshot()))

    socket.on('disconnect', (reason) => logger.info({ id: socket.id, reason }, 'client left'))
  })

  /* ------------------------ service → clients ------------------------- */
  const forward = (event, mapper = (payload) => payload) => {
    whatsapp.on(event, (payload) => io.emit(event, mapper(payload)))
  }

  whatsapp.on('state', (snapshot) => io.emit('session', snapshot))
  forward('chats.upsert')
  forward('chats.update')
  forward('chats.delete')
  forward('contacts.update')
  forward('message')
  forward('message.update')
  forward('message.reaction')
  forward('message.revoke')
  forward('messages.clear')
  forward('presence')
  forward('status.upsert')
  forward('history')
  whatsapp.on('cleared', () => io.emit('cleared'))

  return io
}

export default attachRealtime
