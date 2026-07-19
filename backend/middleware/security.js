import rateLimit from 'express-rate-limit'
import helmet from 'helmet'
import { logger } from '../utils/logger.js'

// ── Rate Limiters ─────────────────────────────────────────────

// General API rate limit: 100 req / 15 min per IP
export const generalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.security('Rate limit exceeded', { ip: req.ip, path: req.path })
    res.status(429).json({ error: 'Too many requests. Please slow down.' })
  }
})

// Auth rate limit: only 10 attempts / 15 min (prevents brute force)
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.AUTH_RATE_LIMIT_MAX) || 10,
  skipSuccessfulRequests: true,
  handler: (req, res) => {
    logger.security('Auth rate limit exceeded — possible brute force', { ip: req.ip, email: req.body?.email })
    res.status(429).json({ error: 'Too many login attempts. Try again in 15 minutes.' })
  }
})

// Billing rate limit: 60 bills / 15 min (prevents spam billing)
export const billingLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  handler: (req, res) => {
    logger.security('Billing rate limit exceeded', { ip: req.ip, userId: req.userId })
    res.status(429).json({ error: 'Too many billing requests.' })
  }
})

// ── Helmet Security Headers ───────────────────────────────────
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https://*.supabase.co'],
      connectSrc: ["'self'", 'https://*.supabase.co'],
    }
  },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  noSniff: true,
  xssFilter: true,
  referrerPolicy: { policy: 'same-origin' }
})

// ── Input Sanitizer ───────────────────────────────────────────
export const sanitizeBody = (req, res, next) => {
  const sanitizeValue = (val) => {
    if (typeof val === 'string') {
      // Remove potential SQL injection patterns
      val = val.replace(/['";\\]/g, '')
      // Remove XSS patterns
      val = val.replace(/<[^>]*>/g, '')
      val = val.replace(/javascript:/gi, '')
      val = val.replace(/on\w+\s*=/gi, '')
      return val.trim()
    }
    if (typeof val === 'object' && val !== null) {
      for (const key of Object.keys(val)) val[key] = sanitizeValue(val[key])
    }
    return val
  }
  if (req.body) req.body = sanitizeValue(req.body)
  next()
}

// ── Request Logger ────────────────────────────────────────────
export const requestLogger = (req, res, next) => {
  const start = Date.now()
  res.on('finish', () => {
    const duration = Date.now() - start
    const level = res.statusCode >= 400 ? 'warn' : 'info'
    logger[level](`${req.method} ${req.path} ${res.statusCode} ${duration}ms`, {
      ip: req.ip, userId: req.userId, userAgent: req.headers['user-agent']?.slice(0, 80)
    })
  })
  next()
}
