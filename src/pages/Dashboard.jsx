import { useEffect, useState } from 'react'
import { TrendingUp, Users, Clock, Package, AlertTriangle, RefreshCw, Receipt, BarChart2 } from 'lucide-react'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { getDashboardStats, getRecentBills, getTopPendingCustomers, getProfitData, getCustomerVisitData } from '../services/api'
import { format } from 'date-fns'

const fmt = (n) => `₹${(Number(n)||0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`

const ChartTip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: 'var(--tooltip-bg)', color: 'var(--tooltip-text)', padding: '10px 14px', borderRadius: 10, fontSize: '0.82rem' }}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{label}</div>
      {payload.map((p, i) => <div key={i} style={{ color: p.color }}>₹{(p.value||0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>)}
    </div>
  )
}

export default function Dashboard() {
  const [stats, setStats] = useState({})
  const [bills, setBills] = useState([])
  const [topPending, setTopPending] = useState([])
  const [profitData, setProfitData] = useState([])
  const [visitData, setVisitData] = useState([])
  const [profitPeriod, setProfitPeriod] = useState('week')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true); setError('')
    try {
      const [s, b, p, pr, v] = await Promise.all([
        getDashboardStats(), getRecentBills(6), getTopPendingCustomers(5),
        getProfitData('week'), getCustomerVisitData(7),
      ])
      setStats(s||{}); setBills(b||[]); setTopPending(p||[])
      setProfitData(pr||[]); setVisitData(v||[])
    } catch (err) { setError(err?.message || 'Failed to load dashboard') }
    finally { setLoading(false) }
  }

  const loadProfit = async (period) => {
    setProfitPeriod(period)
    const pr = await getProfitData(period)
    setProfitData(pr || [])
  }

  useEffect(() => { load() }, [])

  if (loading) return (
    <div>
      <div className="page-header"><h1 className="page-title">Dashboard</h1></div>
      <div className="page-body" style={{ display:'flex', justifyContent:'center', paddingTop:80 }}>
        <div className="spinner" style={{ width:36, height:36, borderColor:'rgba(0,0,0,0.1)', borderTopColor:'var(--accent)', display:'inline-block' }}/>
      </div>
    </div>
  )

  if (error) return (
    <div>
      <div className="page-header"><h1 className="page-title">Dashboard</h1>
        <button className="btn btn-ghost btn-sm" onClick={load}><RefreshCw size={14}/> Retry</button>
      </div>
      <div className="page-body">
        <div style={{ background:'rgba(255,59,92,0.08)', border:'1px solid rgba(255,59,92,0.2)', borderRadius:12, padding:'20px 24px', maxWidth:500, color:'var(--red)' }}>
          ⚠️ {error} <button onClick={load} style={{ background:'none', border:'none', color:'var(--accent)', cursor:'pointer', textDecoration:'underline', marginLeft:8 }}>Retry</button>
        </div>
      </div>
    </div>
  )

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="text-muted text-sm">{format(new Date(), 'EEEE, d MMMM yyyy')}</p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={load}><RefreshCw size={14}/> Refresh</button>
      </div>

      <div className="page-body">

        {/* ── Low Stock Alert Banner ── */}
        {(stats.lowStockProducts || []).length > 0 && (
          <div style={{ background:'rgba(255,149,0,0.08)', border:'1.5px solid rgba(255,149,0,0.3)', borderRadius:12, padding:'14px 18px', marginBottom:20, display:'flex', alignItems:'flex-start', gap:12 }}>
            <AlertTriangle size={20} style={{ color:'var(--orange)', flexShrink:0, marginTop:1 }}/>
            <div>
              <div style={{ fontWeight:700, color:'var(--orange)', marginBottom:6 }}>
                ⚠️ {stats.lowStockProducts.length} product{stats.lowStockProducts.length > 1 ? 's' : ''} low on stock
              </div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                {stats.lowStockProducts.map(p => (
                  <span key={p.id} style={{ background:'rgba(255,149,0,0.1)', border:'1px solid rgba(255,149,0,0.25)', borderRadius:99, padding:'3px 10px', fontSize:'0.8rem', color:'var(--orange)' }}>
                    {p.name} — {p.stock} left
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Stat Cards ── */}
        <div className="stat-grid mb-6">
          {[
            { label:"Today's Sales",   value:fmt(stats.todaySales),    icon:TrendingUp,   color:'var(--accent)', bg:'rgba(255,92,40,0.08)' },
            { label:'Collected Today', value:fmt(stats.todayCollected), icon:Receipt,      color:'var(--green)',  bg:'rgba(0,194,124,0.08)' },
            { label:'Total Pending',   value:fmt(stats.totalPending),   icon:Clock,        color:'var(--orange)', bg:'rgba(255,149,0,0.08)' },
            { label:'Total Customers', value:stats.custCount||0,        icon:Users,        color:'var(--blue)',   bg:'rgba(59,127,255,0.08)' },
            { label:'Total Stock',     value:stats.totalStock||0,       icon:Package,      color:'#8b5cf6',       bg:'rgba(139,92,246,0.08)' },
            { label:'Low Stock Items', value:(stats.lowStockProducts||[]).length, icon:AlertTriangle, color:'var(--orange)', bg:'rgba(255,149,0,0.08)' },
          ].map(({ label, value, icon:Icon, color, bg }) => (
            <div className="stat-card" key={label} style={{ '--accent-color':color, '--accent-bg':bg }}>
              <div className="stat-icon"><Icon size={20}/></div>
              <div className="stat-value">{value}</div>
              <div className="stat-label">{label}</div>
            </div>
          ))}
        </div>

        {/* ── Profit Chart ── */}
        <div className="card card-pad mb-6">
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16, flexWrap:'wrap', gap:10 }}>
            <h2 style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:'1rem', display:'flex', alignItems:'center', gap:8 }}>
              <BarChart2 size={16} style={{ color:'var(--accent)' }}/> Profit & Revenue
            </h2>
            <div style={{ display:'flex', gap:6 }}>
              {['week','month','year'].map(p => (
                <button key={p} onClick={() => loadProfit(p)}
                  style={{ padding:'5px 12px', borderRadius:8, border:'1.5px solid var(--border)', background:profitPeriod===p?'var(--control-active-bg)':'var(--white)', color:profitPeriod===p?'var(--control-active-text)':'var(--muted)', fontSize:'0.78rem', cursor:'pointer', fontWeight:600 }}>
                  {p === 'week' ? '7D' : p === 'month' ? '30D' : '12M'}
                </button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={profitData} margin={{ top:4, right:4, left:0, bottom:0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false}/>
              <XAxis dataKey="label" tick={{ fontSize:11, fill:'#aaa' }} axisLine={false} tickLine={false}/>
              <YAxis tick={{ fontSize:11, fill:'#aaa' }} axisLine={false} tickLine={false}
                tickFormatter={v => v>=1000 ? `₹${(v/1000).toFixed(0)}k` : `₹${v}`}/>
              <Tooltip content={<ChartTip/>}/>
              <Legend wrapperStyle={{ fontSize:'0.78rem', paddingTop:8 }}/>
              <Bar dataKey="revenue" name="Revenue" fill="rgba(255,92,40,0.7)" radius={[4,4,0,0]} maxBarSize={40}/>
              <Bar dataKey="profit" name="Profit" fill="rgba(0,194,124,0.8)" radius={[4,4,0,0]} maxBarSize={40}/>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* ── Customer Visits Chart ── */}
        <div className="card card-pad mb-6">
          <h2 style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:'1rem', marginBottom:16, display:'flex', alignItems:'center', gap:8 }}>
            <Users size={16} style={{ color:'var(--blue)' }}/> Daily Customer Visits (Last 7 Days)
          </h2>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={visitData} margin={{ top:4, right:4, left:0, bottom:0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false}/>
              <XAxis dataKey="label" tick={{ fontSize:11, fill:'#aaa' }} axisLine={false} tickLine={false}/>
              <YAxis tick={{ fontSize:11, fill:'#aaa' }} axisLine={false} tickLine={false} allowDecimals={false}/>
              <Tooltip/>
              <Legend wrapperStyle={{ fontSize:'0.78rem', paddingTop:8 }}/>
              <Line type="monotone" dataKey="visits" name="Total Transactions" stroke="var(--accent)" strokeWidth={2} dot={{ r:4 }}/>
              <Line type="monotone" dataKey="uniqueCustomers" name="Unique Customers" stroke="var(--blue)" strokeWidth={2} dot={{ r:4 }} strokeDasharray="5 5"/>
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 300px', gap:20 }}>
          {/* Recent Bills */}
          <div className="card">
            <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:8 }}>
              <Receipt size={16} style={{ color:'var(--accent)' }}/>
              <h2 style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:'1rem' }}>Recent Bills</h2>
            </div>
            {bills.length === 0 ? (
              <div className="empty-state"><Receipt size={40} style={{ color:'#ddd', marginBottom:12 }}/><h3>No bills yet</h3></div>
            ) : (
              <div className="table-wrap" style={{ border:'none', borderRadius:0 }}>
                <table>
                  <thead><tr><th>Bill #</th><th>Customer</th><th>Amount</th><th>Status</th></tr></thead>
                  <tbody>
                    {bills.map(b => (
                      <tr key={b.id}>
                        <td><span style={{ fontFamily:'var(--font-display)', fontWeight:700, fontSize:'0.85rem' }}>{b.bill_number}</span></td>
                        <td style={{ maxWidth:140, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{b.customer_name||'Walk-in'}</td>
                        <td><strong>{fmt(b.total_amount)}</strong></td>
                        <td>
                          <span className={`badge ${b.payment_status==='paid'?'badge-green':b.payment_status==='partial'?'badge-orange':'badge-red'}`}>
                            {b.payment_status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Top Pending */}
          <div className="card card-pad">
            <h2 style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:'1rem', marginBottom:16 }}>Top Pending</h2>
            {topPending.length === 0 ? (
              <div style={{ textAlign:'center', padding:'24px 0' }}>
                <div style={{ fontSize:32, marginBottom:8 }}>🎉</div>
                <p className="text-muted text-sm">No pending dues!</p>
              </div>
            ) : topPending.map((c,i) => (
              <div key={i} style={{ display:'flex', alignItems:'center', gap:12, marginBottom:14 }}>
                <div style={{ width:36, height:36, borderRadius:10, background:'rgba(255,149,0,0.1)', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'var(--font-display)', fontWeight:800, color:'var(--orange)', flexShrink:0 }}>
                  {(c.name||'?')[0].toUpperCase()}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontWeight:600, fontSize:'0.88rem', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{c.name}</div>
                  <div className="text-muted text-xs">{c.phone}</div>
                </div>
                <div style={{ fontFamily:'var(--font-display)', fontWeight:800, color:'var(--orange)', fontSize:'0.9rem' }}>{fmt(c.balance)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
