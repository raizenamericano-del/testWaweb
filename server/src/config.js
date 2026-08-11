import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'

dotenv.config()

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** repo root (…/kyywa) */
export const ROOT = path.resolve(__dirname, '..', '..')

const resolveDir = (value, fallback) => {
  const target = value && value.trim() ? value.trim() : fallback
  return path.isAbsolute(target) ? target : path.resolve(ROOT, target)
}

export const config = {
  port: Number(process.env.PORT) || 8080,
  host: process.env.HOST || '0.0.0.0',
  nodeEnv: process.env.NODE_ENV || 'development',
  isProd: (process.env.NODE_ENV || 'development') === 'production',

  /** Railway volume mount goes here, e.g. /data */
  dataDir: resolveDir(process.env.DATA_DIR, './data'),

  /** Public browser origin allowed to talk to the API ("*" = any) */
  corsOrigin: process.env.CORS_ORIGIN || '*',

  /** Optional shared secret. When set, the UI asks for it before connecting. */
  accessToken: process.env.ACCESS_TOKEN || '',

  /** Baileys behaviour */
  browserName: process.env.BROWSER_NAME || 'KyyWA',
  markOnlineOnConnect: process.env.MARK_ONLINE === 'true',
  syncFullHistory: process.env.SYNC_FULL_HISTORY === 'true',

  /** Uploads */
  maxUploadMb: Number(process.env.MAX_UPLOAD_MB) || 64,

  /** How many messages we keep in memory per chat */
  messageCacheSize: Number(process.env.MESSAGE_CACHE_SIZE) || 250,

  logLevel: process.env.LOG_LEVEL || 'info',
}

export const paths = {
  auth: path.join(config.dataDir, 'auth'),
  store: path.join(config.dataDir, 'store'),
  media: path.join(config.dataDir, 'media'),
  tmp: path.join(config.dataDir, 'tmp'),
  clientDist: path.resolve(ROOT, 'client', 'dist'),
}

export function ensureDirs() {
  for (const dir of [config.dataDir, paths.auth, paths.store, paths.media, paths.tmp]) {
    fs.mkdirSync(dir, { recursive: true })
  }
}
