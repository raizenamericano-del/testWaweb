import fs from 'node:fs'
import path from 'node:path'
import express from 'express'
import multer from 'multer'
import { Boom } from '@hapi/boom'

import { config, paths } from './config.js'
import logger from './logger.js'
import { store } from './store.js'
import { whatsapp, STATES, sanitizeNumber, normalizeJid } from './whatsapp.js'

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.maxUploadMb * 1024 * 1024 },
})

/** Wrap async handlers so rejections reach the error middleware. */
const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)

export function createRouter() {
  const router = express.Router()

  /* ------------------------------- health ------------------------------- */
  router.get(
    '/health',
    ah(async (_req, res) => {
      res.json({
        ok: true,
        service: 'KyyWA',
        by: 'KyyDevv',
        state: whatsapp.state,
        uptime: process.uptime(),
        node: process.version,
        version: '1.0.0',
      })
    }),
  )

  /* ------------------------------ session ------------------------------- */
  router.get('/session', (_req, res) => {
    res.json({ ok: true, session: whatsapp.snapshot(), requiresToken: Boolean(config.accessToken) })
  })

  router.post(
    '/session/connect',
    ah(async (req, res) => {
      const method = req.body?.method === 'pairing' ? 'pairing' : 'qr'
      const phoneNumber = sanitizeNumber(req.body?.phoneNumber)

      if (method === 'pairing') {
        if (!phoneNumber || phoneNumber.length < 8) {
          throw new Boom('Enter a valid phone number with country code (e.g. 6281234567890)', {
            statusCode: 400,
          })
        }
        if (phoneNumber.startsWith('0')) {
          throw new Boom('Use the international format without a leading 0 (e.g. 62… for Indonesia)', {
            statusCode: 400,
          })
        }
      }

      const snapshot = await whatsapp.start({ method, phoneNumber })
      res.json({ ok: true, session: snapshot })
    }),
  )

  router.post(
    '/session/disconnect',
    ah(async (_req, res) => {
      const snapshot = await whatsapp.disconnect()
      res.json({ ok: true, session: snapshot })
    }),
  )

  router.post(
    '/session/logout',
    ah(async (_req, res) => {
      const snapshot = await whatsapp.logout()
      res.json({ ok: true, session: snapshot })
    }),
  )

  router.post(
    '/session/restart',
    ah(async (_req, res) => {
      const snapshot = await whatsapp.start({ method: 'qr' })
      res.json({ ok: true, session: snapshot })
    }),
  )

  /* -------------------------------- chats ------------------------------- */
  router.get('/chats', (req, res) => {
    const chats = whatsapp.listChats({
      search: String(req.query.search || ''),
      limit: Number(req.query.limit) || 300,
    })
    res.json({ ok: true, chats })
  })

  router.get('/chats/:jid/messages', (req, res) => {
    const jid = decodeURIComponent(req.params.jid)
    const messages = whatsapp.listMessages(jid, {
      limit: Number(req.query.limit) || 80,
      before: req.query.before,
    })
    res.json({ ok: true, messages })
  })

  router.post(
    '/chats/:jid/read',
    ah(async (req, res) => {
      await whatsapp.markRead(decodeURIComponent(req.params.jid))
      res.json({ ok: true })
    }),
  )

  router.post(
    '/chats/:jid/typing',
    ah(async (req, res) => {
      await whatsapp.setTyping(decodeURIComponent(req.params.jid), Boolean(req.body?.typing))
      res.json({ ok: true })
    }),
  )

  router.get(
    '/chats/:jid/avatar',
    ah(async (req, res) => {
      const url = await whatsapp.profilePicture(decodeURIComponent(req.params.jid))
      res.json({ ok: true, url })
    }),
  )

  /* ------------------------------ messages ------------------------------ */
  router.post(
    '/messages/text',
    ah(async (req, res) => {
      const { jid, text, quotedId } = req.body || {}
      if (!jid) throw new Boom('jid is required', { statusCode: 400 })
      if (!text || !String(text).trim()) throw new Boom('text is required', { statusCode: 400 })
      const message = await whatsapp.sendText(jid, String(text), { quotedId })
      res.json({ ok: true, message })
    }),
  )

  router.post(
    '/messages/media',
    upload.single('file'),
    ah(async (req, res) => {
      const { jid, kind, caption, quotedId, ptt } = req.body || {}
      if (!jid) throw new Boom('jid is required', { statusCode: 400 })
      if (!req.file) throw new Boom('file is required', { statusCode: 400 })

      const resolvedKind = kind || guessKind(req.file.mimetype)
      const message = await whatsapp.sendMedia(jid, {
        kind: resolvedKind,
        buffer: req.file.buffer,
        mimetype: req.file.mimetype,
        fileName: req.file.originalname,
        caption,
        ptt: ptt === 'true' || ptt === true,
        quotedId,
      })
      res.json({ ok: true, message })
    }),
  )

  router.post(
    '/messages/react',
    ah(async (req, res) => {
      const { jid, messageId, emoji } = req.body || {}
      if (!jid || !messageId) throw new Boom('jid and messageId are required', { statusCode: 400 })
      await whatsapp.react(jid, messageId, emoji ?? '')
      res.json({ ok: true })
    }),
  )

  router.delete(
    '/messages/:jid/:id',
    ah(async (req, res) => {
      await whatsapp.deleteMessage(decodeURIComponent(req.params.jid), req.params.id)
      res.json({ ok: true })
    }),
  )

  /* ------------------------------- status ------------------------------- */
  router.get('/status', (_req, res) => {
    res.json({ ok: true, statuses: store.getStatuses() })
  })

  router.post(
    '/status',
    upload.single('file'),
    ah(async (req, res) => {
      const { kind, text, caption, backgroundColor, font } = req.body || {}
      const resolvedKind = kind || (req.file ? guessKind(req.file.mimetype) : 'text')
      if (resolvedKind === 'text' && !String(text || '').trim()) {
        throw new Boom('Status text is required', { statusCode: 400 })
      }
      const status = await whatsapp.sendStatus({
        kind: resolvedKind,
        text,
        caption,
        backgroundColor,
        font: font !== undefined ? Number(font) : undefined,
        buffer: req.file?.buffer,
        mimetype: req.file?.mimetype,
      })
      res.json({ ok: true, status })
    }),
  )

  /* -------------------------------- media ------------------------------- */
  router.get(
    '/media/:jid/:id',
    ah(async (req, res) => {
      const jid = decodeURIComponent(req.params.jid)
      const { path: filePath, mimetype, fileName } = await whatsapp.downloadMedia(jid, req.params.id)
      res.setHeader('Content-Type', mimetype || 'application/octet-stream')
      res.setHeader('Cache-Control', 'private, max-age=86400')
      if (req.query.download === '1' && fileName) {
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`)
      }
      fs.createReadStream(filePath).pipe(res)
    }),
  )

  /* ------------------------------ contacts ------------------------------ */
  router.get('/contacts', (_req, res) => {
    res.json({
      ok: true,
      contacts: [...store.contacts.values()]
        .filter((c) => c.id?.endsWith('@s.whatsapp.net'))
        .sort((a, b) => (a.name || a.notify || '').localeCompare(b.name || b.notify || '')),
    })
  })

  router.post(
    '/contacts/check',
    ah(async (req, res) => {
      whatsapp.assertReady()
      const number = sanitizeNumber(req.body?.number)
      if (!number) throw new Boom('number is required', { statusCode: 400 })
      const [result] = await whatsapp.sock.onWhatsApp(number)
      res.json({ ok: true, exists: Boolean(result?.exists), jid: result?.jid || normalizeJid(number) })
    }),
  )

  return router
}

function guessKind(mimetype = '') {
  if (mimetype.startsWith('image/')) return mimetype.includes('webp') ? 'sticker' : 'image'
  if (mimetype.startsWith('video/')) return 'video'
  if (mimetype.startsWith('audio/')) return 'audio'
  return 'document'
}

/** Central error handler — always answers JSON. */
export function errorHandler(err, _req, res, _next) {
  const status = err?.output?.statusCode || err?.statusCode || (err?.code === 'LIMIT_FILE_SIZE' ? 413 : 500)
  const message =
    err?.code === 'LIMIT_FILE_SIZE'
      ? `File too large. Maximum is ${config.maxUploadMb} MB.`
      : err?.message || 'Unexpected server error'
  if (status >= 500) logger.error({ err: err?.stack || message }, 'request failed')
  else logger.warn({ status, message }, 'request rejected')
  res.status(status).json({ ok: false, error: message, state: whatsapp.state })
}

export { STATES, paths, path }
