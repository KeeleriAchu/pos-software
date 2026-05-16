import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ShoppingBag } from 'lucide-react'
import { supabase } from '../services/supabase'
import ThemeToggle from '../components/ui/ThemeToggle'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(''); setSuccess(''); setLoading(true)

    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        if (data?.user?.identities?.length === 0) {
          setError('An account with this email already exists. Please sign in.')
        } else {
          setSuccess('Account created! Check your email to confirm, or sign in directly.')
          setIsSignUp(false)
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        if (data?.session) {
          navigate('/', { replace: true })
        }
      }
    } catch (err) {
      setError(err.message || 'Authentication failed. Check your email and password.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <ThemeToggle compact className="login-theme-toggle" />
      <div className="login-card">
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div className="login-logo"><ShoppingBag size={28} /></div>
          <h1 style={{
            fontFamily: 'var(--font-display)', fontSize: '1.6rem', fontWeight: 800,
            color: 'var(--login-title)', marginBottom: 6
          }}>POS Manager</h1>
          <p style={{ color: 'var(--login-muted)', fontSize: '0.88rem' }}>
            {isSignUp ? 'Create your store account' : 'Sign in to your store'}
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          {error && (
            <div className="error-box" style={{ marginBottom: 16 }}>
              ⚠️ {error}
            </div>
          )}
          {success && (
            <div style={{
              background: 'rgba(0,194,124,0.12)', border: '1px solid rgba(0,194,124,0.25)',
              borderRadius: 8, padding: '10px 14px', fontSize: '0.85rem',
              color: 'var(--green)', marginBottom: 16
            }}>
              ✅ {success}
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Email address</label>
            <input
              className="input"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              className="input"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
              autoComplete={isSignUp ? 'new-password' : 'current-password'}
            />
          </div>

          <button
            className="btn btn-accent btn-full btn-lg"
            type="submit"
            disabled={loading}
            style={{ marginTop: 8 }}
          >
            {loading
              ? <span className="spinner" />
              : (isSignUp ? 'Create Account' : 'Sign In')
            }
          </button>
        </form>

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0' }}>
          <div style={{ flex: 1, height: 1, background: 'var(--login-divider)' }} />
          <span style={{ color: 'var(--login-faint)', fontSize: '0.75rem' }}>OR</span>
          <div style={{ flex: 1, height: 1, background: 'var(--login-divider)' }} />
        </div>

        <p style={{ textAlign: 'center', color: 'var(--login-muted)', fontSize: '0.85rem' }}>
          {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
          <button
            onClick={() => { setIsSignUp(!isSignUp); setError(''); setSuccess('') }}
            style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontWeight: 700, fontSize: 'inherit' }}
          >
            {isSignUp ? 'Sign In' : 'Create one'}
          </button>
        </p>

        {/* Help text */}
        {!isSignUp && (
          <p style={{ textAlign: 'center', marginTop: 16, color: 'var(--login-faint)', fontSize: '0.75rem' }}>
            First time? Create an account above, then sign in.
          </p>
        )}
      </div>
    </div>
  )
}
