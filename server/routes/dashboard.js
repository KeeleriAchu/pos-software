import { Router } from 'express'
import { supabaseAdmin } from '../utils/supabaseAdmin.js'
import { requireAuth } from '../middleware/auth.js'
import { format, subDays } from 'date-fns'

const router = Router()
router.use(requireAuth)

// GET /api/dashboard/stats
router.get('/stats', async (req, res) => {
  try {
    const todayStart = new Date(); todayStart.setHours(0,0,0,0)
    const [todayBills, pendingData, custCount, billCount, products] = await Promise.all([
      supabaseAdmin.from('bills').select('total_amount, paid_amount').gte('created_at', todayStart.toISOString()),
      supabaseAdmin.from('pending_payments').select('amount_due, amount_paid').neq('status', 'paid'),
      supabaseAdmin.from('customers').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('bills').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('products').select('*'),
    ])

    let todaySales = 0, todayCollected = 0
    for (const b of todayBills.data||[]) { todaySales += Number(b.total_amount)||0; todayCollected += Number(b.paid_amount)||0 }
    let totalPending = 0
    for (const p of pendingData.data||[]) totalPending += (Number(p.amount_due)||0) - (Number(p.amount_paid)||0)

    const prods = products.data || []
    const lowStockProducts = prods.filter(p => Number(p.stock) < (Number(p.low_stock_threshold)||10))
    const totalStock = prods.reduce((s, p) => s + (Number(p.stock)||0), 0)

    res.json({ data: { todaySales, todayCollected, totalPending, custCount: custCount.count||0, billCount: billCount.count||0, lowStockProducts, totalStock } })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// GET /api/dashboard/profit?period=week|month|year
router.get('/profit', async (req, res) => {
  try {
    const period = req.query.period || 'week'
    let days, labelFn
    if (period === 'week') { days = Array.from({length:7}, (_,i) => subDays(new Date(), 6-i)); labelFn = d => format(d,'EEE') }
    else if (period === 'month') { days = Array.from({length:30}, (_,i) => subDays(new Date(), 29-i)); labelFn = d => format(d,'d/M') }
    else { days = Array.from({length:12}, (_,i) => { const d = new Date(); d.setMonth(d.getMonth()-11+i); return d }); labelFn = d => format(d,'MMM') }

    const from = new Date(days[0]); from.setHours(0,0,0,0)
    const [bills, items, prods] = await Promise.all([
      supabaseAdmin.from('bills').select('paid_amount, created_at').gte('created_at', from.toISOString()),
      supabaseAdmin.from('bill_items').select('product_name, quantity, bills(created_at)'),
      supabaseAdmin.from('products').select('name, cost_price'),
    ])

    const costMap = {}
    for (const p of prods.data||[]) costMap[p.name] = Number(p.cost_price)||0

    const keyFn = period === 'year' ? d => format(d,'yyyy-MM') : d => format(d,'yyyy-MM-dd')
    const grouped = {}
    for (const d of days) {
      const key = keyFn(d)
      grouped[key] = { label: labelFn(d), revenue: 0, cost: 0, profit: 0, count: 0 }
    }
    for (const b of bills.data||[]) {
      const key = keyFn(new Date(b.created_at))
      if (grouped[key]) { grouped[key].revenue += Number(b.paid_amount)||0; grouped[key].count++ }
    }
    for (const item of items.data||[]) {
      if (!item.bills?.created_at) continue
      const key = keyFn(new Date(item.bills.created_at))
      if (grouped[key]) grouped[key].cost += (costMap[item.product_name]||0) * (Number(item.quantity)||0)
    }

    const result = Object.values(grouped).map(g => ({ ...g, profit: g.revenue - g.cost }))
    res.json({ data: result })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// GET /api/dashboard/visits?days=7
router.get('/visits', async (req, res) => {
  try {
    const numDays = Math.min(parseInt(req.query.days)||7, 90)
    const from = subDays(new Date(), numDays-1); from.setHours(0,0,0,0)
    const { data } = await supabaseAdmin.from('bills').select('customer_id, created_at').gte('created_at', from.toISOString())

    const dayList = Array.from({length:numDays}, (_,i) => subDays(new Date(), numDays-1-i))
    const grouped = {}
    for (const d of dayList) {
      const key = format(d, 'yyyy-MM-dd')
      grouped[key] = { label: format(d,'EEE d'), date: key, visits: 0, uniqueCustomers: 0, _unique: new Set() }
    }
    for (const b of data||[]) {
      const key = format(new Date(b.created_at), 'yyyy-MM-dd')
      if (grouped[key]) { grouped[key].visits++; if (b.customer_id) grouped[key]._unique.add(b.customer_id) }
    }
    const result = Object.values(grouped).map(({ _unique, ...g }) => ({ ...g, uniqueCustomers: _unique.size }))
    res.json({ data: result })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

export default router
