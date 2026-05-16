import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://urlqmabfldpakiyjndsr.supabase.co'
const supabaseAnonKey = 'sb_publishable_Lf6ZZH2jcJ7WyEGYU87xcQ_uBvfBcr-'

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storageKey: 'pos-auth-token',
  },
  global: {
    // Automatically attach the auth token to every request
    headers: {}
  }
})

// Helper: get the current session token and verify it's valid
export const getValidSession = async () => {
  const { data: { session }, error } = await supabase.auth.getSession()
  if (error || !session) return null
  // If token expires in less than 60 seconds, refresh it
  const expiresAt = session.expires_at * 1000
  if (Date.now() > expiresAt - 60000) {
    const { data: { session: refreshed } } = await supabase.auth.refreshSession()
    return refreshed
  }
  return session
}
