import http from 'node:http'
import fs from 'node:fs'
import express from 'express'
import cors from 'cors'
import compression from 'compression'

import { config, paths, ensureDirs } from './config.js'
import logger from './logger.js'
import { store } from './store.js'
import { whatsapp } from './whatsapp.js'
import { createRouter, errorHandler } from './routes.js'
import { attachRealtime } from './realtime.js'

ensureDirs()
store.load()

const app = express()
app.disable('x-powered-by')
app.set('trust proxy', 1)

app.use(compression())
app.use(cors({ origin: config.corsOrigin, credentials: false }))
app.use(express.json({ limit: '2mb' }))
app.use(express.urlencoded({ extended: true }))

/** Optional shared-secret gate for the whole API. */
if (config.accessToken) {
  app.use('/api', (req, res, next) => {
    if (req.path === '/health') return next()
    const token =
      req.headers['x-access-token'] || req.query.token || req.headers.authorization?.split(' ')[1]
    if (token === config.accessToken) return next()
    res.status(401).json({ ok: false, error: 'Unauthorized — invalid access token' })
  })
}

app.use('/api', createRouter())

/* --------------------------- static frontend ---------------------------- */
if (fs.existsSync(paths.clientDist)) {
  app.use(
    express.static(paths.clientDist, {
      index: false,
      maxAge: '1h',
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache')
      },
    }),
  )
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) return next()
    res.sendFile(`${paths.clientDist}/index.html`)
  })
} else {
  app.get('/', (_req, res) => {
    res
      .status(200)
      .type('text/plain')
      .send('KyyWA API is running. Build the client (npm run build) to serve the UI from here.')
  })
}

app.use(errorHandler)

const server = http.createServer(app)
attachRealtime(server)

server.listen(config.port, config.host, async () => {
  logger.info(
    { port: config.port, host: config.host, data: config.dataDir, env: config.nodeEnv },
    'KyyWA server listening',
  )
  // Auto-restore an existing session on boot (Railway volume persistence).
  if (whatsapp.hasSession()) {
    logger.info('existing session found — restoring connection')
    whatsapp.start({ method: 'qr' }).catch((err) => logger.error({ err: err.message }, 'auto-start failed'))
  }
})

/* ------------------------------ shutdown -------------------------------- */
const shutdown = async (signal) => {
  logger.info({ signal }, 'shutting down')
  store.flush()
  server.close()
  setTimeout(() => process.exit(0), 1500).unref()
}
process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
process.on('unhandledRejection', (reason) => logger.error({ reason: String(reason) }, 'unhandled rejection'))
process.on('uncaughtException', (err) => logger.error({ err: err.stack }, 'uncaught exception'))
