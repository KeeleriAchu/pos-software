import { supabase } from './supabase'
import { format, subDays, startOfDay, startOfWeek, startOfMonth, startOfYear } from 'date-fns'

// ── AUTH ──────────────────────────────────────
export const signIn = (email, password) =>
  supabase.auth.signInWithPassword({ email, password })
export const signUp = (email, password) =>
  supabase.auth.signUp({ email, password })
export const signOut = () => supabase.auth.signOut()

// ── CUSTOMERS ─────────────────────────────────
export const getCustomers = async () => {
  const { data, error } = await supabase.from('customers').select('*').order('name')
  if (error) throw error
  return data || []
}

export const addCustomer = async (customer) => {
  const payload = {
    name: customer.name?.trim(),
    phone: customer.phone?.trim(),
    ...(customer.email?.trim() && { email: customer.email.trim() }),
    ...(customer.address?.trim() && { address: customer.address.trim() }),
  }
  const { data, error } = await supabase.from('customers').insert(payload).select().single()
  if (error) throw new Error(error.message)
  return data
}

export const updateCustomer = async (id, customer) => {
  const payload = {
    name: customer.name?.trim(),
    phone: customer.phone?.trim(),
    email: customer.email?.trim() || null,
    address: customer.address?.trim() || null,
  }
  const { data, error } = await supabase.from('customers').update(payload).eq('id', id).select().single()
  if (error) throw new Error(error.message)
  return data
}

export const deleteCustomer = async (id) => {
  const { error } = await supabase.from('customers').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export const getCustomerPendingAmounts = async () => {
  const { data } = await supabase.from('pending_payments')
    .select('customer_id, amount_due, amount_paid').neq('status', 'paid')
  const map = {}
  for (const r of data || []) {
    const bal = (Number(r.amount_due) || 0) - (Number(r.amount_paid) || 0)
    map[r.customer_id] = (map[r.customer_id] || 0) + bal
  }
  return map
}

export const getCustomerHistory = async (customerId) => {
  const { data: bills } = await supabase.from('bills')
    .select('*').eq('customer_id', customerId).order('created_at', { ascending: false })
  const { data: pending } = await supabase.from('pending_payments')
    .select('*').eq('customer_id', customerId)
  const { data: visits } = await supabase.from('customer_visits')
    .select('*').eq('customer_id', customerId).order('created_at', { ascending: false })
  return { bills: bills || [], pending: pending || [], visits: visits || [] }
}

// ── PRODUCTS ──────────────────────────────────
export const getProducts = async () => {
  const { data, error } = await supabase.from('products').select('*').order('name')
  if (error) throw error
  return data || []
}

export const getLowStockProducts = async () => {
  const { data } = await supabase.from('products').select('*').gt('stock', 0)
  return (data || []).filter(p => p.stock < (p.low_stock_threshold || 10))
}

export const addProduct = async (product) => {
  const payload = {
    name: product.name?.trim(),
    price: parseFloat(product.price) || 0,
    cost_price: parseFloat(product.cost_price) || 0,
    stock: parseInt(product.stock) || 0,
    low_stock_threshold: parseInt(product.low_stock_threshold) || 10,
    unit: product.unit?.trim() || null,
    category: product.category?.trim() || null,
    barcode: product.barcode?.trim() || null,
    image_url: product.image_url || null,
  }
  const { data, error } = await supabase.from('products').insert(payload).select().single()
  if (error) throw new Error(error.message)
  return data
}

export const updateProduct = async (id, product) => {
  const payload = {
    name: product.name?.trim(),
    price: parseFloat(product.price) || 0,
    cost_price: parseFloat(product.cost_price) || 0,
    stock: parseInt(product.stock) || 0,
    low_stock_threshold: parseInt(product.low_stock_threshold) || 10,
    unit: product.unit?.trim() || null,
    category: product.category?.trim() || null,
    barcode: product.barcode?.trim() || null,
    image_url: product.image_url !== undefined ? product.image_url : null,
  }
  const { data, error } = await supabase.from('products').update(payload).eq('id', id).select().single()
  if (error) throw new Error(error.message)
  return data
}

export const restockProduct = async (id, addQty) => {
  const { data: current } = await supabase.from('products').select('stock').eq('id', id).single()
  const newStock = (Number(current?.stock) || 0) + Number(addQty)
  const { data, error } = await supabase.from('products').update({ stock: newStock }).eq('id', id).select().single()
  if (error) throw new Error(error.message)
  return data
}

export const deleteProduct = async (id) => {
  const { error } = await supabase.from('products').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

// ── BILLS ─────────────────────────────────────
export const saveBill = async (bill, items) => {
  const pendingAmt = Math.max(0, (Number(bill.total_amount) || 0) - (Number(bill.paid_amount) || 0))
  let paymentStatus = 'pending'
  if (Number(bill.paid_amount) >= Number(bill.total_amount)) paymentStatus = 'paid'
  else if (Number(bill.paid_amount) > 0) paymentStatus = 'partial'

  const billPayload = {
    customer_id: bill.customer_id || null,
    customer_name: bill.customer_name || 'Walk-in Customer',
    total_amount: Number(bill.total_amount),
    paid_amount: Number(bill.paid_amount),
    pending_amount: pendingAmt,
    payment_status: paymentStatus,
    payment_method: bill.payment_method || 'cash',
    discount_amount: Number(bill.discount_amount) || 0,
    is_pending_sale: bill.is_pending_sale || false,
    notes: bill.notes || null,
  }

  const { data: savedBill, error } = await supabase.from('bills').insert(billPayload).select().single()
  if (error) throw new Error(`Bill save failed: ${error.message}`)

  const billId = savedBill.id
  const customerId = bill.customer_id || null

  // Insert bill items + deduct stock
  for (const item of items) {
    await supabase.from('bill_items').insert({
      bill_id: billId,
      product_name: item.product_name,
      quantity: item.quantity,
      unit_price: item.unit_price,
      total_price: item.total_price,
    })
    // Deduct stock if product_id provided
    if (item.product_id) {
      const { data: prod } = await supabase.from('products').select('stock').eq('id', item.product_id).single()
      if (prod) {
        const newStock = Math.max(0, (Number(prod.stock) || 0) - item.quantity)
        await supabase.from('products').update({ stock: newStock }).eq('id', item.product_id)
      }
    }
  }

  // Create pending payment record if needed
  if (pendingAmt > 0 && customerId) {
    await supabase.from('pending_payments').insert({
      customer_id: customerId,
      bill_id: billId,
      amount_due: Number(bill.total_amount),
      amount_paid: Number(bill.paid_amount),
      status: paymentStatus === 'partial' ? 'partial' : 'unpaid',
    })
  }

  // Log customer visit (non-critical — skip if table doesn't exist yet)
  if (customerId) {
    try {
      await supabase.from('customer_visits').insert({
        customer_id: customerId,
        customer_name: bill.customer_name,
        bill_id: billId,
        visit_date: format(new Date(), 'yyyy-MM-dd'),
      })
    } catch {} // table may not exist yet — run NEW_TABLES.sql to create it
  }

  return savedBill
}

export const getRecentBills = async (limit = 10) => {
  const { data, error } = await supabase.from('bills')
    .select('*, customers(name)')
    .order('created_at', { ascending: false }).limit(limit)
  if (error) { console.error('getRecentBills:', error.message); return [] }
  return (data || []).map(b => ({ ...b, customer_name: b.customer_name || b.customers?.name || 'Walk-in' }))
}

export const getBillItems = async (billId) => {
  const { data, error } = await supabase.from('bill_items').select('*').eq('bill_id', billId)
  if (error) throw error
  return data || []
}

// ── PENDING PAYMENTS ──────────────────────────
export const getPendingPayments = async () => {
  const { data, error } = await supabase.from('pending_payments')
    .select('*, customers(name, phone), bills(bill_number)')
    .neq('status', 'paid').order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export const collectPayment = async (id, newPaid, totalDue) => {
  const status = newPaid >= totalDue ? 'paid' : 'partial'
  const { error } = await supabase.from('pending_payments')
    .update({ amount_paid: newPaid, status }).eq('id', id)
  if (error) throw new Error(error.message)
  const { data: pp } = await supabase.from('pending_payments')
    .select('customer_id, bill_id').eq('id', id).single()
  if (pp) {
    await supabase.from('payment_history').insert({
      customer_id: pp.customer_id, bill_id: pp.bill_id,
      amount: newPaid, payment_method: 'cash',
    })
  }
}

export const markReminderSent = async (pendingId) => {
  await supabase.from('pending_payments')
    .update({ last_reminder_at: new Date().toISOString(), reminder_sent: true })
    .eq('id', pendingId)
}

// ── DASHBOARD ─────────────────────────────────
export const getDashboardStats = async () => {
  const todayStart = new Date(); todayStart.setHours(0,0,0,0)
  const todayISO = todayStart.toISOString()

  const [{ data: todayBills }, { data: pendingData }, { count: custCount }, { count: billCount }, products] =
    await Promise.all([
      supabase.from('bills').select('total_amount, paid_amount').gte('created_at', todayISO),
      supabase.from('pending_payments').select('amount_due, amount_paid').neq('status', 'paid'),
      supabase.from('customers').select('id', { count: 'exact', head: true }),
      supabase.from('bills').select('id', { count: 'exact', head: true }),
      getProducts(),
    ])

  let todaySales = 0, todayCollected = 0
  for (const b of todayBills || []) { todaySales += Number(b.total_amount)||0; todayCollected += Number(b.paid_amount)||0 }

  let totalPending = 0
  for (const p of pendingData || []) totalPending += (Number(p.amount_due)||0) - (Number(p.amount_paid)||0)

  const lowStockProducts = products.filter(p => Number(p.stock) < (Number(p.low_stock_threshold) || 10))
  const totalStock = products.reduce((s, p) => s + (Number(p.stock) || 0), 0)

  return { todaySales, todayCollected, totalPending, custCount: custCount||0, billCount: billCount||0, lowStockProducts, totalStock }
}

export const getTopPendingCustomers = async (limit = 5) => {
  const { data } = await supabase.from('pending_payments')
    .select('customer_id, amount_due, amount_paid, customers(name, phone)').neq('status', 'paid')
  const map = {}
  for (const r of data || []) {
    const bal = (Number(r.amount_due)||0) - (Number(r.amount_paid)||0)
    if (map[r.customer_id]) map[r.customer_id].balance += bal
    else map[r.customer_id] = { name: r.customers?.name||'Unknown', phone: r.customers?.phone||'', balance: bal }
  }
  return Object.values(map).sort((a,b) => b.balance - a.balance).slice(0, limit)
}

// ── ANALYTICS ─────────────────────────────────
// Returns sales + profit grouped by day for given date range
const getBillsInRange = async (fromISO) => {
  const { data } = await supabase.from('bills').select('total_amount, paid_amount, created_at').gte('created_at', fromISO)
  return data || []
}

const getBillItemsInRange = async (fromISO) => {
  const { data } = await supabase.from('bill_items')
    .select('product_name, quantity, unit_price, total_price, bill_id, bills(created_at)')
    .gte('bills.created_at', fromISO)
  return data || []
}

export const getProfitData = async (period = 'week') => {
  let days, labelFn
  if (period === 'week') { days = Array.from({length:7}, (_,i) => subDays(new Date(), 6-i)); labelFn = d => format(d,'EEE') }
  else if (period === 'month') { days = Array.from({length:30}, (_,i) => subDays(new Date(), 29-i)); labelFn = d => format(d,'d/M') }
  else if (period === 'year') { days = Array.from({length:12}, (_,i) => { const d = new Date(); d.setMonth(d.getMonth()-11+i); return d }); labelFn = d => format(d,'MMM') }

  const from = new Date(days[0]); from.setHours(0,0,0,0)
  const bills = await getBillsInRange(from.toISOString())

  // Get cost data from bill_items joined with products
  const { data: items } = await supabase.from('bill_items')
    .select('quantity, total_price, bills(created_at)')
  const { data: prods } = await supabase.from('products').select('name, cost_price, price')
  const costMap = {}
  for (const p of prods || []) costMap[p.name] = Number(p.cost_price) || 0

  if (period === 'year') {
    const grouped = {}
    for (const d of days) {
      const key = format(d, 'yyyy-MM')
      grouped[key] = { label: labelFn(d), revenue: 0, cost: 0, profit: 0, count: 0 }
    }
    for (const b of bills) {
      const key = format(new Date(b.created_at), 'yyyy-MM')
      if (grouped[key]) { grouped[key].revenue += Number(b.paid_amount)||0; grouped[key].count++ }
    }
    for (const item of items || []) {
      if (!item.bills?.created_at) continue
      const key = format(new Date(item.bills.created_at), 'yyyy-MM')
      if (grouped[key]) {
        const c = (costMap[item.product_name] || 0) * (Number(item.quantity)||0)
        grouped[key].cost += c
      }
    }
    return Object.values(grouped).map(g => ({ ...g, profit: g.revenue - g.cost }))
  } else {
    const grouped = {}
    for (const d of days) {
      const key = format(d, 'yyyy-MM-dd')
      grouped[key] = { label: labelFn(d), revenue: 0, cost: 0, profit: 0, count: 0 }
    }
    for (const b of bills) {
      const key = format(new Date(b.created_at), 'yyyy-MM-dd')
      if (grouped[key]) { grouped[key].revenue += Number(b.paid_amount)||0; grouped[key].count++ }
    }
    for (const item of items || []) {
      if (!item.bills?.created_at) continue
      const key = format(new Date(item.bills.created_at), 'yyyy-MM-dd')
      if (grouped[key]) {
        const c = (costMap[item.product_name] || 0) * (Number(item.quantity)||0)
        grouped[key].cost += c
      }
    }
    return Object.values(grouped).map(g => ({ ...g, profit: g.revenue - g.cost }))
  }
}

export const getCustomerVisitData = async (days = 7) => {
  const from = subDays(new Date(), days - 1)
  from.setHours(0,0,0,0)
  const { data } = await supabase.from('bills')
    .select('customer_id, created_at').gte('created_at', from.toISOString())
  const dayList = Array.from({length: days}, (_, i) => subDays(new Date(), days-1-i))
  const grouped = {}
  for (const d of dayList) {
    const key = format(d, 'yyyy-MM-dd')
    grouped[key] = { label: format(d, 'EEE d'), date: key, visits: 0, unique: new Set() }
  }
  for (const b of data || []) {
    const key = format(new Date(b.created_at), 'yyyy-MM-dd')
    if (grouped[key]) {
      grouped[key].visits++
      if (b.customer_id) grouped[key].unique.add(b.customer_id)
    }
  }
  return Object.values(grouped).map(g => ({ ...g, uniqueCustomers: g.unique.size, unique: undefined }))
}

// ── REPORTS ───────────────────────────────────
export const getWeeklySales = () => getProfitData('week')
export const getMonthlySales = () => getProfitData('month')

export const getTopProducts = async () => {
  const { data } = await supabase.from('bill_items').select('product_name, quantity, total_price')
  const grouped = {}
  for (const item of data || []) {
    if (grouped[item.product_name]) { grouped[item.product_name].qty += item.quantity; grouped[item.product_name].revenue += Number(item.total_price)||0 }
    else grouped[item.product_name] = { name: item.product_name, qty: item.quantity, revenue: Number(item.total_price)||0 }
  }
  return Object.values(grouped).sort((a,b) => b.qty - a.qty).slice(0, 8)
}

export const getReportSummary = async () => {
  const { data: allBills } = await supabase.from('bills').select('total_amount, paid_amount, payment_method, created_at')
  const weekAgo = subDays(new Date(), 7)
  let allSales=0, allCollected=0, weekSales=0, weekCollected=0
  const methods = { cash:0, upi:0, card:0 }
  for (const b of allBills||[]) {
    allSales += Number(b.total_amount)||0; allCollected += Number(b.paid_amount)||0
    if (new Date(b.created_at) > weekAgo) { weekSales += Number(b.total_amount)||0; weekCollected += Number(b.paid_amount)||0 }
    if (b.payment_method && methods[b.payment_method] !== undefined) methods[b.payment_method] += Number(b.paid_amount)||0
  }
  const { count: custCount } = await supabase.from('customers').select('id', { count:'exact', head:true })
  const { data: items } = await supabase.from('bill_items').select('quantity')
  const productsSold = (items||[]).reduce((s,i) => s + (Number(i.quantity)||0), 0)
  return { allSales, allCollected, allPending: allSales-allCollected, totalBills:(allBills||[]).length, custCount:custCount||0, productsSold, weekSales, weekCollected, avgDaily:weekSales/7, methods }
}

export const getRecentReminderLogs = async (limit = 20) => {
  const { data } = await supabase.from('reminders_log')
    .select('*, customers(name, phone)').order('sent_at', { ascending: false }).limit(limit)
  return data || []
}
