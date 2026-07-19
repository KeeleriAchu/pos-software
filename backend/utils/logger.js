import { createWriteStream, mkdirSync } from 'fs'
import { join } from 'path'

const LOG_DIR = process.env.LOG_DIR || './logs'
try { mkdirSync(LOG_DIR, { recursive: true }) } catch {}

const levels = { error: 0, warn: 1, info: 2, debug: 3 }
const colors = { error: '\x1b[31m', warn: '\x1b[33m', info: '\x1b[36m', debug: '\x1b[90m', reset: '\x1b[0m' }
const logStream = createWriteStream(join(LOG_DIR, `app-${new Date().toISOString().slice(0,10)}.log`), { flags: 'a' })

function log(level, message, meta = {}) {
  const ts = new Date().toISOString()
  logStream.write(JSON.stringify({ ts, level, message, ...meta }) + '\n')
  const currentLevel = levels[process.env.LOG_LEVEL || 'info']
  if (levels[level] <= currentLevel) {
    console.log(`${colors[level]||''}[${ts}] [${level.toUpperCase()}] ${message}${colors.reset}`, Object.keys(meta).length ? meta : '')
  }
}

export const logger = {
  error: (msg, meta) => log('error', msg, meta),
  warn:  (msg, meta) => log('warn',  msg, meta),
  info:  (msg, meta) => log('info',  msg, meta),
  debug: (msg, meta) => log('debug', msg, meta),
  security: (event, meta = {}) => {
    const entry = JSON.stringify({ ts: new Date().toISOString(), level: 'SECURITY', event, ...meta })
    createWriteStream(join(LOG_DIR, 'security.log'), { flags: 'a' }).end(entry + '\n')
    console.log(`\x1b[35m[SECURITY] ${event}\x1b[0m`, meta)
  },
  audit: (action, table, userId, data = {}) => {
    const entry = JSON.stringify({ ts: new Date().toISOString(), action, table, userId, ...data })
    createWriteStream(join(LOG_DIR, 'audit.log'), { flags: 'a' }).end(entry + '\n')
  }
}
