import { useEffect, useState } from 'react'
import { Clock, MessageCircle, DollarSign } from 'lucide-react'
import { getPendingPayments, collectPayment } from '../services/api'
import { useToast } from '../components/ui/Toast'
import { format } from 'date-fns'

function CollectModal({ payment, onClose, onSave }) {
  const [amount, setAmount] = useState(payment.amount_due - payment.amount_paid)
  const [loading, setLoading] = useState(false)
  const toast = useToast()

  const handleSubmit = async (e) => {
    e.preventDefault(); setLoading(true)
    try {
      const newPaid = payment.amount_paid + parseFloat(amount)
      await collectPayment(payment.id, Math.min(newPaid, payment.amount_due), payment.amount_due)
      toast('Payment collected!'); onSave(); onClose()
    } catch (e) { toast(e.message, 'error') }
    finally { setLoading(false) }
  }

  const balance = payment.amount_due - payment.amount_paid

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h2 className="modal-title">Collect Payment</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#888' }}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div style={{ background: 'rgba(255,149,0,0.08)', border: '1px solid rgba(255,149,0,0.15)', borderRadius: 12, padding: 16, marginBottom: 20 }}>
              <div style={{ fontSize: '0.82rem', color: '#888', marginBottom: 4 }}>Balance Due from {payment.customers?.name}</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem', fontWeight: 800, color: 'var(--orange)' }}>
                ₹{balance.toLocaleString('en-IN')}
              </div>
              <div style={{ fontSize: '0.78rem', color: '#aaa', marginTop: 4 }}>{payment.bills?.bill_number} · Total ₹{payment.amount_due.toLocaleString('en-IN')}</div>
            </div>
            <div className="form-group">
              <label className="form-label">Amount Collecting ₹</label>
              <input className="input" type="number" step="0.01" max={balance} value={amount} onChange={e => setAmount(e.target.value)} required min="0.01" />
            </div>
            {parseFloat(amount) < balance && (
              <p style={{ color: 'var(--orange)', fontSize: '0.82rem' }}>
                ℹ️ Remaining after this: ₹{(balance - parseFloat(amount || 0)).toLocaleString('en-IN')}
              </p>
            )}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-green" disabled={loading}>
              {loading ? <span className="spinner" /> : <><DollarSign size={15} /> Collect</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function Pending() {
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('all')
  const [collectModal, setCollectModal] = useState(null)
  const toast = useToast()

  const load = async () => { setLoading(true); const p = await getPendingPayments(); setPayments(p); setLoading(false) }
  useEffect(() => { load() }, [])

  const filtered = tab === 'all' ? payments : payments.filter(p => p.status === tab)
  const totalPending = payments.reduce((s, p) => s + p.amount_due - p.amount_paid, 0)

  const sendWhatsApp = (p) => {
    const phone = p.customers?.phone?.replace(/[^0-9]/g, '')
    if (!phone) { toast('No phone number', 'error'); return }
    const balance = p.amount_due - p.amount_paid
    const msg = `⚠️ Payment Reminder\n\nHello ${p.customers?.name}!\n\nBill: ${p.bills?.bill_number}\nBalance Due: ₹${balance.toLocaleString('en-IN')}\n\nKindly clear at the earliest. Thank you! 🙏`
    window.open(`https://wa.me/91${phone}?text=${encodeURIComponent(msg)}`, '_blank')
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Pending Payments</h1>
        <div style={{ background: 'rgba(255,149,0,0.1)', border: '1px solid rgba(255,149,0,0.2)', borderRadius: 10, padding: '10px 20px' }}>
          <span style={{ fontSize: '0.78rem', color: '#888', marginRight: 8 }}>Total Outstanding</span>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.2rem', color: 'var(--orange)' }}>
            ₹{totalPending.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </span>
        </div>
      </div>

      <div className="page-body">
        <div className="tabs mb-6" style={{ maxWidth: 300 }}>
          {['all', 'unpaid', 'partial'].map(t => (
            <button key={t} className={`tab-btn ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 60 }}><div className="spinner" style={{ width: 32, height: 32, borderColor: 'rgba(0,0,0,0.1)', borderTopColor: 'var(--accent)', display: 'inline-block' }} /></div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div style={{ fontSize: 48, marginBottom: 12 }}>🎉</div>
            <h3>No pending payments!</h3>
            <p>All dues are cleared.</p>
          </div>
        ) : (
          <div style={{ maxWidth: 720 }}>
            {filtered.map(p => {
              const balance = p.amount_due - p.amount_paid
              const paidPct = (p.amount_paid / p.amount_due) * 100
              return (
                <div key={p.id} className="pending-card">
                  <div className="flex items-center justify-between mb-4" style={{ gap: 12 }}>
                    <div className="flex items-center gap-3">
                      <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(255,149,0,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', fontWeight: 800, color: 'var(--orange)', flexShrink: 0 }}>
                        {(p.customers?.name || 'C')[0]}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700 }}>{p.customers?.name || 'Unknown'}</div>
                        <div className="text-muted text-xs">{p.customers?.phone} · {p.bills?.bill_number}</div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.2rem', color: 'var(--orange)' }}>₹{balance.toLocaleString('en-IN')}</div>
                      <span className={`badge ${p.status === 'partial' ? 'badge-blue' : 'badge-orange'}`}>{p.status}</span>
                    </div>
                  </div>

                  <div className="flex justify-between" style={{ fontSize: '0.78rem', color: '#aaa', marginBottom: 6 }}>
                    <span>Paid ₹{p.amount_paid.toLocaleString('en-IN')} / ₹{p.amount_due.toLocaleString('en-IN')}</span>
                    <span>{paidPct.toFixed(0)}%</span>
                  </div>
                  <div className="amount-bar">
                    <div className="amount-bar-fill" style={{ width: `${paidPct}%` }} />
                  </div>

                  <div className="flex gap-2 mt-4">
                    <button className="btn btn-ghost btn-sm" onClick={() => sendWhatsApp(p)}>
                      <MessageCircle size={14} style={{ color: '#25D366' }} /> Remind
                    </button>
                    <button className="btn btn-primary btn-sm" onClick={() => setCollectModal(p)}>
                      <DollarSign size={14} /> Collect
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {collectModal && <CollectModal payment={collectModal} onClose={() => setCollectModal(null)} onSave={load} />}
    </div>
  )
}
