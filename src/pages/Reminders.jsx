import { useEffect, useState } from 'react'
import { Bell, MessageCircle, Send, Users, RefreshCw } from 'lucide-react'
import { getPendingPayments, getRecentReminderLogs } from '../services/api'
import { useToast } from '../components/ui/Toast'
import { formatDistanceToNow } from 'date-fns'

export default function Reminders() {
  const [pending, setPending] = useState([])
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [selected, setSelected] = useState(new Set())
  const toast = useToast()

  const load = async () => {
    setLoading(true)
    const [p, l] = await Promise.all([getPendingPayments(), getRecentReminderLogs()])
    // Deduplicate by customer
    const customerMap = {}
    for (const item of p) {
      const cid = item.customer_id
      if (customerMap[cid]) customerMap[cid].balance += item.amount_due - item.amount_paid
      else customerMap[cid] = {
        id: cid,
        pendingId: item.id,
        name: item.customers?.name || 'Unknown',
        phone: item.customers?.phone || '',
        balance: item.amount_due - item.amount_paid,
      }
    }
    setPending(Object.values(customerMap))
    setLogs(l)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const toggleSelect = (id) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const selectAll = () => {
    if (selected.size === pending.length) setSelected(new Set())
    else setSelected(new Set(pending.map(p => p.id)))
  }

  const sendBulkWhatsApp = async () => {
    const targets = pending.filter(p => selected.size === 0 || selected.has(p.id))
    if (!targets.length) { toast('No customers to remind', 'error'); return }
    setSending(true)
    let sent = 0
    for (const c of targets) {
      const phone = c.phone.replace(/[^0-9]/g, '')
      if (!phone) continue
      const msg = `⚠️ *Payment Reminder*\n\nHello ${c.name}!\n\nYou have a pending balance of *₹${c.balance.toLocaleString('en-IN', { maximumFractionDigits: 0 })}*.\n\nKindly clear your dues at the earliest. Thank you! 🙏`
      window.open(`https://wa.me/91${phone}?text=${encodeURIComponent(msg)}`, '_blank')
      sent++
      await new Promise(r => setTimeout(r, 600))
    }
    setSending(false)
    toast(`WhatsApp opened for ${sent} customer${sent > 1 ? 's' : ''}`)
    setSelected(new Set())
    load()
  }

  const totalPending = pending.reduce((s, p) => s + p.balance, 0)

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Reminders</h1>
        <div className="flex gap-2">
          <button className="btn btn-ghost btn-sm" onClick={load}>
            <RefreshCw size={14} /> Refresh
          </button>
          <button
            className="btn btn-sm"
            style={{ background: '#25D366', color: 'white' }}
            onClick={sendBulkWhatsApp}
            disabled={sending || pending.length === 0}
          >
            {sending
              ? <><span className="spinner" /> Sending...</>
              : <><MessageCircle size={14} /> {selected.size > 0 ? `Send to ${selected.size}` : 'Send All'}</>
            }
          </button>
        </div>
      </div>

      <div className="page-body">
        {/* Summary banner */}
        <div style={{
          background: 'linear-gradient(135deg, #0f1117, #1e2330)',
          borderRadius: 'var(--radius-lg)',
          padding: 24,
          marginBottom: 24,
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 16,
        }}>
          {[
            { emoji: '🔔', label: 'Customers with Dues', value: pending.length },
            { emoji: '💸', label: 'Total Outstanding', value: `₹${totalPending.toLocaleString('en-IN', { maximumFractionDigits: 0 })}` },
            { emoji: '📤', label: 'Reminders Sent', value: logs.length },
          ].map(s => (
            <div key={s.label} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 28, marginBottom: 6 }}>{s.emoji}</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', fontWeight: 800, color: 'white' }}>{s.value}</div>
              <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20 }}>
          {/* Customer list */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1rem' }}>
                Customers to Remind
              </h2>
              {pending.length > 0 && (
                <button className="btn btn-ghost btn-sm" onClick={selectAll}>
                  {selected.size === pending.length ? 'Deselect All' : 'Select All'}
                </button>
              )}
            </div>

            {loading ? (
              <div style={{ textAlign: 'center', padding: 60 }}>
                <div className="spinner" style={{ width: 32, height: 32, borderColor: 'rgba(0,0,0,0.1)', borderTopColor: 'var(--accent)', display: 'inline-block' }} />
              </div>
            ) : pending.length === 0 ? (
              <div className="empty-state">
                <div style={{ fontSize: 48, marginBottom: 12 }}>🎉</div>
                <h3>All clear!</h3>
                <p>No customers with pending dues.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {pending.map(c => {
                  const isSelected = selected.has(c.id)
                  return (
                    <div
                      key={c.id}
                      onClick={() => toggleSelect(c.id)}
                      style={{
                        background: isSelected ? 'rgba(255,92,40,0.04)' : 'var(--white)',
                        border: `1.5px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
                        borderRadius: 'var(--radius)',
                        padding: '14px 18px',
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 14,
                      }}
                    >
                      {/* Checkbox */}
                      <div style={{
                        width: 20, height: 20, borderRadius: 6,
                        background: isSelected ? 'var(--accent)' : 'transparent',
                        border: `2px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0, transition: 'all 0.15s',
                      }}>
                        {isSelected && <span style={{ color: 'white', fontSize: '0.65rem', fontWeight: 900 }}>✓</span>}
                      </div>

                      {/* Avatar */}
                      <div style={{
                        width: 40, height: 40, borderRadius: 12,
                        background: 'rgba(255,149,0,0.1)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontFamily: 'var(--font-display)', fontWeight: 800, color: 'var(--orange)',
                        flexShrink: 0,
                      }}>
                        {c.name[0]}
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, marginBottom: 2 }}>{c.name}</div>
                        <div style={{ fontSize: '0.78rem', color: '#aaa' }}>{c.phone}</div>
                      </div>

                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, color: 'var(--orange)', fontSize: '1rem' }}>
                          ₹{c.balance.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                        </div>
                        <button
                          className="btn btn-sm"
                          style={{ background: '#25D366', color: 'white', marginTop: 4, fontSize: '0.72rem', padding: '4px 10px' }}
                          onClick={(e) => {
                            e.stopPropagation()
                            const phone = c.phone.replace(/[^0-9]/g, '')
                            const msg = `⚠️ Payment Reminder\n\nHello ${c.name}!\n\nBalance: ₹${c.balance.toLocaleString('en-IN', { maximumFractionDigits: 0 })}\n\nPlease clear at the earliest. Thank you!`
                            window.open(`https://wa.me/91${phone}?text=${encodeURIComponent(msg)}`, '_blank')
                          }}
                        >
                          <MessageCircle size={11} /> Remind
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Recent logs */}
          <div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1rem', marginBottom: 16 }}>
              Recent Activity
            </h2>
            <div className="card" style={{ overflow: 'hidden' }}>
              {logs.length === 0 ? (
                <div style={{ padding: '30px 20px', textAlign: 'center', color: '#bbb' }}>
                  <Bell size={32} style={{ marginBottom: 10 }} />
                  <p style={{ fontSize: '0.85rem' }}>No reminders sent yet</p>
                </div>
              ) : (
                <div>
                  {logs.slice(0, 15).map((log, i) => (
                    <div key={i} style={{
                      padding: '12px 16px',
                      borderBottom: i < logs.length - 1 ? '1px solid var(--border)' : 'none',
                      display: 'flex', alignItems: 'center', gap: 12,
                    }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: 8,
                        background: log.type === 'whatsapp' ? 'rgba(37,211,102,0.1)' : 'rgba(59,127,255,0.1)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 16, flexShrink: 0,
                      }}>
                        {log.type === 'whatsapp' ? '💬' : log.type === 'sms' ? '📩' : '🔔'}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {log.customers?.name || 'Unknown'}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#aaa' }}>
                          {log.sent_at
                            ? formatDistanceToNow(new Date(log.sent_at), { addSuffix: true })
                            : 'Recently'}
                        </div>
                      </div>
                      <span className="badge badge-green" style={{ fontSize: '0.65rem' }}>SENT</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
