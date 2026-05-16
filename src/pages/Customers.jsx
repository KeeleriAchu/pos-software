import { useEffect, useState } from 'react'
import { Search, Plus, Edit2, Trash2, Phone, MessageCircle, Eye, X } from 'lucide-react'
import { getCustomers, addCustomer, updateCustomer, deleteCustomer, getCustomerPendingAmounts, getCustomerHistory } from '../services/api'
import { useToast } from '../components/ui/Toast'
import { format } from 'date-fns'

function CustomerModal({ customer, onClose, onSave }) {
  const [form, setForm] = useState({ name:'', phone:'', email:'', address:'', ...customer })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const toast = useToast()

  const handleSubmit = async (e) => {
    e.preventDefault(); setError('')
    if (!form.name.trim()) { setError('Name is required'); return }
    if (!form.phone.trim() || form.phone.trim().length < 10) { setError('Valid phone required'); return }
    setLoading(true)
    try {
      if (customer?.id) await updateCustomer(customer.id, form)
      else await addCustomer(form)
      onSave(); onClose()
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target===e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h2 className="modal-title">{customer?.id ? 'Edit Customer' : 'Add Customer'}</h2>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', fontSize:22, color:'#aaa' }}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div style={{ background:'rgba(255,59,92,0.08)', border:'1px solid rgba(255,59,92,0.2)', borderRadius:8, padding:'10px 14px', marginBottom:14, fontSize:'0.85rem', color:'var(--red)' }}>⚠️ {error}</div>}
            {[['name','Full Name *'],['phone','Phone *'],['email','Email (optional)'],['address','Address (optional)']].map(([k,l]) => (
              <div className="form-group" key={k}>
                <label className="form-label">{l}</label>
                <input className="input" value={form[k]||''} onChange={e => setForm({...form,[k]:e.target.value})} autoFocus={k==='name'}/>
              </div>
            ))}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? <span className="spinner"/> : (customer?.id ? 'Update' : 'Save Customer')}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function CustomerHistoryModal({ customer, onClose }) {
  const [history, setHistory] = useState(null)
  const [loading, setLoading] = useState(true)
  const fmt = n => `₹${(Number(n)||0).toLocaleString('en-IN', { maximumFractionDigits:0 })}`

  useEffect(() => {
    getCustomerHistory(customer.id).then(h => { setHistory(h); setLoading(false) })
  }, [customer.id])

  const totalSpent = (history?.bills||[]).reduce((s,b) => s + (Number(b.paid_amount)||0), 0)
  const pendingBalance = (history?.pending||[]).filter(p => p.status !== 'paid').reduce((s,p) => s + (Number(p.amount_due)||0) - (Number(p.amount_paid)||0), 0)

  return (
    <div className="modal-overlay" onClick={e => e.target===e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth:560 }}>
        <div className="modal-header">
          <h2 className="modal-title">{customer.name}</h2>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', fontSize:22, color:'#aaa' }}>×</button>
        </div>
        <div className="modal-body" style={{ maxHeight:'70vh', overflowY:'auto' }}>
          {loading ? <div style={{ textAlign:'center', padding:40 }}><div className="spinner" style={{ width:28, height:28, borderColor:'rgba(0,0,0,0.1)', borderTopColor:'var(--accent)', display:'inline-block' }}/></div> : (
            <>
              {/* Summary */}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:20 }}>
                {[
                  { label:'Total Bills', value:(history.bills.length), color:'var(--blue)' },
                  { label:'Total Spent', value:fmt(totalSpent), color:'var(--green)' },
                  { label:'Pending', value:fmt(pendingBalance), color: pendingBalance > 0 ? 'var(--orange)' : 'var(--green)' },
                ].map(s => (
                  <div key={s.label} style={{ background:'var(--surface)', borderRadius:10, padding:'12px 14px', textAlign:'center' }}>
                    <div style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:'1.2rem', color:s.color }}>{s.value}</div>
                    <div style={{ fontSize:'0.72rem', color:'#888', marginTop:2 }}>{s.label}</div>
                  </div>
                ))}
              </div>

              <p style={{ fontSize:'0.72rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em', color:'#aaa', marginBottom:8 }}>Purchase History</p>
              {history.bills.length === 0 ? <p className="text-muted text-sm">No purchases yet</p> : (
                <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:20 }}>
                  {history.bills.map(b => (
                    <div key={b.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 14px', background:'var(--surface)', borderRadius:10 }}>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontFamily:'var(--font-display)', fontWeight:700, fontSize:'0.88rem' }}>{b.bill_number}</div>
                        <div style={{ fontSize:'0.75rem', color:'#aaa' }}>{b.created_at ? format(new Date(b.created_at),'dd MMM yyyy, h:mm a') : ''}</div>
                      </div>
                      <strong style={{ fontSize:'0.95rem' }}>₹{(Number(b.total_amount)||0).toLocaleString('en-IN')}</strong>
                      <span className={`badge ${b.payment_status==='paid'?'badge-green':b.payment_status==='partial'?'badge-orange':'badge-red'}`}>{b.payment_status}</span>
                    </div>
                  ))}
                </div>
              )}

              {(history.pending||[]).filter(p => p.status !== 'paid').length > 0 && (
                <>
                  <p style={{ fontSize:'0.72rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em', color:'#aaa', marginBottom:8 }}>Pending Dues</p>
                  {history.pending.filter(p => p.status !== 'paid').map(p => (
                    <div key={p.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 14px', background:'rgba(255,149,0,0.06)', border:'1px solid rgba(255,149,0,0.2)', borderRadius:10, marginBottom:8 }}>
                      <div style={{ flex:1 }}>
                        <div style={{ fontWeight:600, fontSize:'0.88rem' }}>Bill #{p.bill_id?.slice(0,8)}</div>
                        <div style={{ fontSize:'0.75rem', color:'#aaa' }}>Due: ₹{(Number(p.amount_due)||0).toLocaleString('en-IN')} · Paid: ₹{(Number(p.amount_paid)||0).toLocaleString('en-IN')}</div>
                      </div>
                      <span style={{ fontFamily:'var(--font-display)', fontWeight:800, color:'var(--orange)' }}>₹{((Number(p.amount_due)||0)-(Number(p.amount_paid)||0)).toLocaleString('en-IN')}</span>
                    </div>
                  ))}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default function Customers() {
  const [customers, setCustomers] = useState([])
  const [pendingMap, setPendingMap] = useState({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(null)
  const [historyModal, setHistoryModal] = useState(null)
  const toast = useToast()
  const fmt = n => `₹${(Number(n)||0).toLocaleString('en-IN', { maximumFractionDigits:0 })}`

  const load = async () => {
    setLoading(true)
    const [c, p] = await Promise.all([getCustomers(), getCustomerPendingAmounts()])
    setCustomers(c); setPendingMap(p); setLoading(false)
  }

  useEffect(() => { load() }, [])

  const filtered = customers.filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || c.phone.includes(search))

  const handleDelete = async (id, name) => {
    if (!confirm(`Delete ${name}?`)) return
    try { await deleteCustomer(id); toast('Customer deleted'); load() }
    catch (err) { toast(err.message, 'error') }
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Customers</h1>
        <div className="flex gap-3 items-center">
          <div className="search-input-wrap">
            <Search size={16}/>
            <input className="input" placeholder="Search by name or phone..." value={search} onChange={e => setSearch(e.target.value)} style={{ width:240 }}/>
          </div>
          <button className="btn btn-primary" onClick={() => setModal({})}><Plus size={16}/> Add Customer</button>
        </div>
      </div>

      <div className="page-body">
        <div className="flex gap-4 mb-6">
          <div style={{ background:'rgba(59,127,255,0.08)', border:'1px solid rgba(59,127,255,0.15)', borderRadius:10, padding:'10px 20px' }}>
            <span style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:'1.3rem', color:'var(--blue)' }}>{customers.length}</span>
            <span style={{ fontSize:'0.78rem', color:'#888', marginLeft:8 }}>Total Customers</span>
          </div>
          <div style={{ background:'rgba(255,149,0,0.08)', border:'1px solid rgba(255,149,0,0.15)', borderRadius:10, padding:'10px 20px' }}>
            <span style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:'1.3rem', color:'var(--orange)' }}>{customers.filter(c => (pendingMap[c.id]||0) > 0).length}</span>
            <span style={{ fontSize:'0.78rem', color:'#888', marginLeft:8 }}>Have Pending</span>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign:'center', padding:60 }}><div className="spinner" style={{ width:32, height:32, borderColor:'rgba(0,0,0,0.1)', borderTopColor:'var(--accent)', display:'inline-block' }}/></div>
        ) : (
          <div className="card">
            <div className="table-wrap" style={{ border:'none' }}>
              <table>
                <thead><tr><th>Customer</th><th>Phone</th><th>Email</th><th>Pending</th><th>Actions</th></tr></thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan={5}><div className="empty-state"><h3>No customers found</h3><p>{search ? 'Try different search' : 'Add your first customer'}</p></div></td></tr>
                  ) : filtered.map(c => (
                    <tr key={c.id}>
                      <td>
                        <div className="flex items-center gap-2">
                          <div style={{ width:34, height:34, borderRadius:10, background:'var(--surface-2)', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'var(--font-display)', fontWeight:800, fontSize:'0.9rem', flexShrink:0 }}>
                            {c.name[0].toUpperCase()}
                          </div>
                          <span style={{ fontWeight:600 }}>{c.name}</span>
                        </div>
                      </td>
                      <td>{c.phone}</td>
                      <td className="text-muted">{c.email||'—'}</td>
                      <td>{(pendingMap[c.id]||0) > 0 ? <span className="badge badge-orange">{fmt(pendingMap[c.id])}</span> : <span className="badge badge-green">Clear</span>}</td>
                      <td>
                        <div className="flex gap-2">
                          <button className="btn btn-ghost btn-sm" title="View History" onClick={() => setHistoryModal(c)}><Eye size={14}/></button>
                          <button className="btn btn-ghost btn-sm" title="Call" onClick={() => window.open(`tel:${c.phone}`)}><Phone size={14}/></button>
                          <button className="btn btn-ghost btn-sm" style={{ color:'#25D366' }} title="WhatsApp"
                            onClick={() => window.open(`https://wa.me/91${c.phone.replace(/[^0-9]/g,'')}?text=${encodeURIComponent(`Hello ${c.name}!`)}`, '_blank')}>
                            <MessageCircle size={14}/>
                          </button>
                          <button className="btn btn-ghost btn-sm" onClick={() => setModal(c)}><Edit2 size={14}/></button>
                          <button className="btn btn-ghost btn-sm" style={{ color:'var(--red)' }} onClick={() => handleDelete(c.id, c.name)}><Trash2 size={14}/></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {modal !== null && <CustomerModal customer={modal} onClose={() => setModal(null)} onSave={load}/>}
      {historyModal && <CustomerHistoryModal customer={historyModal} onClose={() => setHistoryModal(null)}/>}
    </div>
  )
}
