import pino from 'pino'
import { config } from './config.js'

export const logger = pino({
  level: config.logLevel,
  base: undefined,
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level: (label) => ({ level: label }),
  },
})

/** Quiet child logger handed to Baileys — its debug output is extremely noisy. */
export const waLogger = pino({ level: process.env.BAILEYS_LOG_LEVEL || 'silent' })

export default logger
