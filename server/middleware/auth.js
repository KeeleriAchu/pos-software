import jwt from 'jsonwebtoken'
import { supabaseAdmin } from '../utils/supabaseAdmin.js'
import { logger } from '../utils/logger.js'

// Verify JWT from Authorization header
export const requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' })
    }

    const token = authHeader.split(' ')[1]

    // Verify with Supabase (handles expiry, revocation)
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
    if (error || !user) {
      logger.security('Invalid token attempt', { ip: req.ip, path: req.path })
      return res.status(401).json({ error: 'Invalid or expired token' })
    }

    req.user = user
    req.userId = user.id
    next()
  } catch (err) {
    logger.error('Auth middleware error', { error: err.message })
    res.status(500).json({ error: 'Authentication failed' })
  }
}

// Optional auth — attach user if token present, but don't block
export const optionalAuth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1]
    if (token) {
      const { data: { user } } = await supabaseAdmin.auth.getUser(token)
      if (user) { req.user = user; req.userId = user.id }
    }
  } catch {}
  next()
}
