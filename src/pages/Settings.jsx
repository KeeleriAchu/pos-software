import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Store, Key, User, LogOut, Save, Shield, ExternalLink } from 'lucide-react'
import { signOut } from '../services/api'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../components/ui/Toast'

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <p style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#aaa', marginBottom: 10 }}>{title}</p>
      <div className="card" style={{ overflow: 'hidden' }}>{children}</div>
    </div>
  )
}

function SettingRow({ icon: Icon, label, sublabel, children, danger }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 16,
      padding: '16px 20px',
      borderBottom: '1px solid var(--border)',
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 10, flexShrink: 0,
        background: danger ? 'rgba(255,59,92,0.08)' : 'var(--surface)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: danger ? 'var(--red)' : 'var(--ink-3)',
      }}>
        <Icon size={17} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: '0.9rem', color: danger ? 'var(--red)' : 'inherit' }}>{label}</div>
        {sublabel && <div style={{ fontSize: '0.78rem', color: '#aaa', marginTop: 1 }}>{sublabel}</div>}
      </div>
      {children && <div style={{ flexShrink: 0 }}>{children}</div>}
    </div>
  )
}

export default function Settings() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const [shopName, setShopName] = useState('My POS Store')
  const [smsKey, setSmsKey] = useState('')
  const [shopPhone, setShopPhone] = useState('')
  const [saved, setSaved] = useState(false)

  const handleLogout = async () => {
    if (!confirm('Sign out?')) return
    await signOut()
    navigate('/login')
  }

  const handleSave = () => {
    setSaved(true)
    toast('Settings saved!')
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Settings</h1>
        <button className="btn btn-primary" onClick={handleSave}>
          {saved ? '✓ Saved!' : <><Save size={15} /> Save Changes</>}
        </button>
      </div>

      <div className="page-body" style={{ maxWidth: 640 }}>
        {/* Account card */}
        <div style={{
          background: 'var(--hero-panel-bg)',
          borderRadius: 'var(--radius-lg)',
          padding: '24px 28px',
          marginBottom: 28,
          display: 'flex', alignItems: 'center', gap: 18,
        }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14,
            background: 'var(--accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.4rem',
            color: 'white', flexShrink: 0,
            boxShadow: '0 4px 14px rgba(255,92,40,0.4)',
          }}>
            {user?.email?.[0]?.toUpperCase() || '?'}
          </div>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 800, color: 'white' }}>
              Store Owner
            </div>
            <div style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>
              {user?.email || 'Not logged in'}
            </div>
          </div>
          <div style={{ marginLeft: 'auto' }}>
            <span className="badge" style={{ background: 'rgba(0,194,124,0.2)', color: 'var(--green)' }}>Active</span>
          </div>
        </div>

        <Section title="Store Info">
          <SettingRow icon={Store} label="Shop Name" sublabel="Shown on bills and WhatsApp messages">
            <input
              className="input"
              value={shopName}
              onChange={e => setShopName(e.target.value)}
              style={{ width: 200, textAlign: 'right' }}
            />
          </SettingRow>
          <SettingRow icon={User} label="Shop Phone" sublabel="Contact number for customers">
            <input
              className="input"
              value={shopPhone}
              onChange={e => setShopPhone(e.target.value)}
              placeholder="+91 XXXXX XXXXX"
              style={{ width: 200, textAlign: 'right' }}
            />
          </SettingRow>
          <div style={{ borderBottom: 'none' }}>
            <SettingRow icon={Key} label="Fast2SMS API Key" sublabel="For SMS reminders (fast2sms.com)">
              <input
                className="input"
                value={smsKey}
                onChange={e => setSmsKey(e.target.value)}
                placeholder="Paste your key"
                type="password"
                style={{ width: 200, textAlign: 'right' }}
              />
            </SettingRow>
          </div>
        </Section>

        <Section title="Database">
          <SettingRow icon={Shield} label="Supabase Project" sublabel="urlqmabfldpakiyjndsr.supabase.co">
            <a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm">
              Open <ExternalLink size={12} />
            </a>
          </SettingRow>
          <div style={{ borderBottom: 'none' }}>
            <SettingRow icon={Shield} label="Connection Status" sublabel="Real-time sync enabled">
              <span className="badge badge-green">Connected</span>
            </SettingRow>
          </div>
        </Section>

        <Section title="Account">
          <div style={{ borderBottom: 'none' }}>
            <SettingRow icon={LogOut} label="Sign Out" sublabel="You will be returned to the login screen" danger>
              <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red)', borderColor: 'rgba(255,59,92,0.25)' }} onClick={handleLogout}>
                Sign Out
              </button>
            </SettingRow>
          </div>
        </Section>

        <p style={{ textAlign: 'center', color: '#ccc', fontSize: '0.75rem', marginTop: 20 }}>
          POS Manager v1.0 · Built with React + Supabase
        </p>
      </div>
    </div>
  )
}
