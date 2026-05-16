import { createClient } from '@supabase/supabase-js'

// Admin client uses SERVICE_ROLE key — bypasses RLS for server operations
// NEVER expose this key to the client/browser
export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  {
    auth: { autoRefreshToken: false, persistSession: false }
  }
)

// Helper: sanitize input — strip dangerous chars
export const sanitize = (value) => {
  if (typeof value !== 'string') return value
  return value
    .replace(/[<>]/g, '')           // strip HTML tags
    .replace(/javascript:/gi, '')   // strip JS protocol
    .replace(/on\w+\s*=/gi, '')     // strip event handlers
    .trim()
}

// Helper: validate UUID format
export const isValidUUID = (str) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str)
