import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger.js';

// Verify JWT from Authorization header
export const requireAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    // Attach user info for downstream handlers
    req.userId = payload.id;
    req.user = { id: payload.id, email: payload.email };
    next();
  } catch (err) {
    logger.error('Auth middleware error', { error: err.message });
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

// Optional auth – attach user if token present, but don't block
export const optionalAuth = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (token) {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      req.user = { id: payload.id, email: payload.email };
      req.userId = payload.id;
    }
  } catch {}
  next();
};
