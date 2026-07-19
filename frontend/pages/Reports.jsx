import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { getWeeklySales, getMonthlySales, getTopProducts, getReportSummary } from '../services/api'

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload?.length) return (
    <div style={{ background: 'var(--tooltip-bg)', color: 'var(--tooltip-text)', padding: '10px 14px', borderRadius: 10, fontSize: '0.82rem' }}>
      <div style={{ fontWeight: 700, marginBottom: 4 }}>{label}</div>
      {payload.map((p, i) => <div key={i} style={{ color: p.color }}>₹{(p.value || 0).toLocaleString('en-IN')}</div>)}
    </div>
  )
  return null
}

export default function Reports() {
  const [period, setPeriod] = useState('week')
  const [weekData, setWeekData] = useState([])
  const [monthData, setMonthData] = useState([])
  const [products, setProducts] = useState([])
  const [summary, setSummary] = useState({})
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('sales')

  useEffect(() => {
    Promise.all([getWeeklySales(), getMonthlySales(), getTopProducts(), getReportSummary()])
      .then(([w, m, p, s]) => { setWeekData(w); setMonthData(m); setProducts(p); setSummary(s) })
      .finally(() => setLoading(false))
  }, [])

  const chartData = period === 'week' ? weekData : monthData
  const fmt = n => `₹${(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
  const rate = summary.allSales > 0 ? (summary.allCollected / summary.allSales * 100).toFixed(1) : 0

  if (loading) return (
    <div>
      <div className="page-header"><h1 className="page-title">Reports</h1></div>
      <div className="page-body" style={{ display: 'flex', justifyContent: 'center', paddingTop: 80 }}>
        <div className="spinner" style={{ width: 32, height: 32, borderColor: 'rgba(0,0,0,0.1)', borderTopColor: 'var(--accent)', display: 'inline-block' }} />
      </div>
    </div>
  )

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Reports & Analytics</h1>
      </div>

      <div className="page-body">
        <div className="tabs mb-6" style={{ maxWidth: 360 }}>
          {['sales', 'products', 'summary'].map(t => (
            <button key={t} className={`tab-btn ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {tab === 'sales' && (
          <div>
            <div className="flex gap-3 mb-6">
              {[['week', '7 Days'], ['month', '30 Days']].map(([v, l]) => (
                <button key={v} className="btn" style={{ background: period === v ? 'var(--control-active-bg)' : 'var(--white)', color: period === v ? 'var(--control-active-text)' : 'var(--ink)', border: '1.5px solid var(--border)' }} onClick={() => setPeriod(v)}>{l}</button>
              ))}
            </div>

            <div className="stat-grid mb-6">
              {[
                { label: 'Week Sales', value: fmt(summary.weekSales), color: 'var(--accent)', bg: 'rgba(255,92,40,0.08)' },
                { label: 'Week Collected', value: fmt(summary.weekCollected), color: 'var(--green)', bg: 'rgba(0,194,124,0.08)' },
                { label: 'Avg Per Day', value: fmt(summary.avgDaily), color: 'var(--blue)', bg: 'rgba(59,127,255,0.08)' },
              ].map(s => (
                <div key={s.label} className="stat-card" style={{ '--accent-color': s.color, '--accent-bg': s.bg }}>
                  <div className="stat-value">{s.value}</div>
                  <div className="stat-label">{s.label}</div>
                </div>
              ))}
            </div>

            <div className="card card-pad">
              <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, marginBottom: 20 }}>
                {period === 'week' ? '7-Day' : '30-Day'} Sales
              </h3>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#aaa' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#aaa' }} axisLine={false} tickLine={false} tickFormatter={v => `₹${v >= 1000 ? (v/1000).toFixed(0)+'k' : v}`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="total" radius={[6, 6, 0, 0]} maxBarSize={period === 'week' ? 48 : 20}>
                    {chartData.map((_, i) => <Cell key={i} fill={_.total > 0 ? 'var(--accent)' : 'var(--surface-2)'} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {tab === 'products' && (
          <div className="card card-pad" style={{ maxWidth: 640 }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, marginBottom: 20 }}>🏆 Top Selling Products</h3>
            {products.length === 0 ? <p className="text-muted">No data yet</p> : (
              products.map((p, i) => {
                const max = products[0].qty
                const colors = ['var(--accent)', 'var(--blue)', 'var(--green)', 'var(--orange)', '#8b5cf6']
                return (
                  <div key={i} style={{ marginBottom: 16 }}>
                    <div className="flex justify-between items-center" style={{ marginBottom: 6 }}>
                      <div className="flex items-center gap-3">
                        <div style={{ width: 24, height: 24, borderRadius: 6, background: `${colors[i % 5]}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 800, color: colors[i % 5] }}>{i + 1}</div>
                        <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{p.name}</span>
                      </div>
                      <div className="flex gap-4" style={{ fontSize: '0.82rem' }}>
                        <span style={{ color: '#888' }}>{p.qty} units</span>
                        <span style={{ fontWeight: 700, color: colors[i % 5] }}>₹{p.revenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                      </div>
                    </div>
                    <div className="amount-bar">
                      <div className="amount-bar-fill" style={{ width: `${(p.qty / max) * 100}%`, background: `linear-gradient(90deg, ${colors[i % 5]}, ${colors[i % 5]}88)` }} />
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )}

        {tab === 'summary' && (
          <div>
            <div style={{ background: 'var(--hero-panel-bg)', borderRadius: 'var(--radius-lg)', padding: 28, marginBottom: 20, maxWidth: 500 }}>
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem', marginBottom: 8 }}>All-Time Collection Rate</p>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '3.5rem', fontWeight: 800, color: 'white', lineHeight: 1 }}>{rate}%</div>
              <div style={{ marginTop: 16, height: 8, background: 'rgba(255,255,255,0.1)', borderRadius: 99 }}>
                <div style={{ height: '100%', width: `${rate}%`, background: 'linear-gradient(90deg, var(--green), #00e890)', borderRadius: 99, transition: 'width 0.8s ease' }} />
              </div>
            </div>

            <div className="stat-grid">
              {[
                { l: '💰 All-Time Sales', v: fmt(summary.allSales), c: 'var(--accent)', bg: 'rgba(255,92,40,0.08)' },
                { l: '✅ Total Collected', v: fmt(summary.allCollected), c: 'var(--green)', bg: 'rgba(0,194,124,0.08)' },
                { l: '⚠️ Total Pending', v: fmt(summary.allPending), c: 'var(--orange)', bg: 'rgba(255,149,0,0.08)' },
                { l: '🧾 Total Bills', v: summary.totalBills || 0, c: 'var(--ink)', bg: 'var(--surface-2)' },
                { l: '👥 Customers', v: summary.custCount || 0, c: 'var(--blue)', bg: 'rgba(59,127,255,0.08)' },
                { l: '📦 Products Sold', v: summary.productsSold || 0, c: '#8b5cf6', bg: 'rgba(139,92,246,0.08)' },
              ].map(s => (
                <div key={s.l} className="stat-card" style={{ '--accent-color': s.c, '--accent-bg': s.bg }}>
                  <div className="stat-label" style={{ marginBottom: 8 }}>{s.l}</div>
                  <div className="stat-value">{s.v}</div>
                </div>
              ))}
            </div>

            {summary.methods && (
              <div className="card card-pad mt-4" style={{ maxWidth: 400 }}>
                <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, marginBottom: 16 }}>Payment Methods</h3>
                {Object.entries(summary.methods).filter(([, v]) => v > 0).map(([k, v]) => (
                  <div key={k} className="flex justify-between" style={{ marginBottom: 10 }}>
                    <span className="badge badge-gray" style={{ textTransform: 'capitalize' }}>{k}</span>
                    <strong>{fmt(v)}</strong>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
