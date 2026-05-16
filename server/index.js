import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import compression from 'compression'
import cron from 'node-cron'
import { securityHeaders, generalLimiter, requestLogger, sanitizeBody } from './middleware/security.js'
import { logger } from './utils/logger.js'
import { runBackup } from './services/backup.js'

// ── Import Routes ──────────────────────────────────────────────
import customersRouter from './routes/customers.js'
import productsRouter from './routes/products.js'
import billsRouter from './routes/bills.js'
import dashboardRouter from './routes/dashboard.js'
import backupRouter from './routes/backup.js'

const app = express()
const PORT = process.env.PORT || 3001

// ── Security Middleware ────────────────────────────────────────
app.set('trust proxy', 1)
app.use(securityHeaders)
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}))
app.use(compression())
app.use(express.json({ limit: '2mb' }))      // Limit body size
app.use(express.urlencoded({ extended: true, limit: '2mb' }))
app.use(sanitizeBody)                          // Sanitize all inputs
app.use(generalLimiter)                        // Global rate limit
app.use(requestLogger)                         // Log all requests

// ── Health Check ───────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', ts: new Date().toISOString(), env: process.env.NODE_ENV })
})

// ── API Routes ─────────────────────────────────────────────────
app.use('/api/customers',  customersRouter)
app.use('/api/products',   productsRouter)
app.use('/api/bills',      billsRouter)
app.use('/api/dashboard',  dashboardRouter)
app.use('/api/backup',     backupRouter)

// ── 404 Handler ────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` })
})

// ── Global Error Handler ───────────────────────────────────────
app.use((err, req, res, next) => {
  logger.error('Unhandled error', { error: err.message, stack: err.stack, path: req.path })
  res.status(500).json({ error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message })
})

// ── Scheduled Jobs ─────────────────────────────────────────────
// Auto backup — runs daily at 2am
const backupCron = process.env.BACKUP_CRON || '0 2 * * *'
cron.schedule(backupCron, async () => {
  logger.info('Running scheduled backup...')
  try {
    const summary = await runBackup()
    logger.info('Scheduled backup complete', summary)
  } catch (err) {
    logger.error('Scheduled backup failed', { error: err.message })
  }
})
logger.info(`Backup scheduled: ${backupCron}`)

// ── Start Server ───────────────────────────────────────────────
app.listen(PORT, () => {
  logger.info(`🚀 POS Server running on port ${PORT}`)
  logger.info(`   Environment: ${process.env.NODE_ENV || 'development'}`)
  logger.info(`   Client URL:  ${process.env.CLIENT_URL || 'http://localhost:5173'}`)
})

export default app
