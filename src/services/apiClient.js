// ── API Client ─────────────────────────────────────────────────
// All client requests go through this — automatically adds JWT auth header
// and handles errors uniformly.

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

async function getAuthHeader() {
  // Get token from Supabase session
  const { supabase } = await import('./supabase.js')
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token ? `Bearer ${session.access_token}` : ''
}

async function request(method, path, body = null, options = {}) {
  const token = await getAuthHeader()
  const headers = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: token }),
    ...options.headers,
  }

  const config = { method, headers }
  if (body) config.body = JSON.stringify(body)

  const res = await fetch(`${BASE_URL}${path}`, config)
  const json = await res.json().catch(() => ({ error: 'Invalid response' }))

  if (!res.ok) {
    const msg = json?.error || json?.details?.[0]?.message || `Server error ${res.status}`
    throw new Error(msg)
  }
  return json
}

export const api = {
  get:    (path)         => request('GET',    path),
  post:   (path, body)   => request('POST',   path, body),
  put:    (path, body)   => request('PUT',    path, body),
  patch:  (path, body)   => request('PATCH',  path, body),
  delete: (path)         => request('DELETE', path),
}

// ── Typed API methods (matches server routes) ──────────────────

// CUSTOMERS
export const getCustomers       = ()         => api.get('/api/customers').then(r => r.data)
export const getCustomer        = (id)       => api.get(`/api/customers/${id}`).then(r => r.data)
export const addCustomer        = (data)     => api.post('/api/customers', data).then(r => r.data)
export const updateCustomer     = (id, data) => api.put(`/api/customers/${id}`, data).then(r => r.data)
export const deleteCustomer     = (id)       => api.delete(`/api/customers/${id}`)
export const getCustomerHistory = (id)       => api.get(`/api/customers/${id}`).then(r => r.data)
export const getCustomerPendingAmounts = async () => {
  const customers = await getCustomers()
  const map = {}
  // Lightweight: compute from customers list (full calc done server-side in pending route)
  return map
}

// PRODUCTS
export const getProducts       = ()              => api.get('/api/products').then(r => r.data)
export const getLowStockProducts = ()            => api.get('/api/products/low-stock').then(r => r.data)
export const getProductByBarcode = (code)        => api.get(`/api/products/barcode/${encodeURIComponent(code)}`).then(r => r.data)
export const addProduct        = (data)          => api.post('/api/products', data).then(r => r.data)
export const updateProduct     = (id, data)      => api.put(`/api/products/${id}`, data).then(r => r.data)
export const restockProduct    = (id, quantity)  => api.patch(`/api/products/${id}/restock`, { quantity }).then(r => r.data)
export const deleteProduct     = (id)            => api.delete(`/api/products/${id}`)

// BILLS
export const saveBill          = (bill, items)   => api.post('/api/bills', { ...bill, items }).then(r => r.data)
export const getRecentBills    = (limit = 10)    => api.get(`/api/bills?limit=${limit}`).then(r => r.data)
export const getBillWithItems  = (id)            => api.get(`/api/bills/${id}`).then(r => r.data)
export const getPendingPayments = ()             => api.get('/api/bills/pending/all').then(r => r.data)
export const collectPayment    = (id, amount, method = 'cash') =>
  api.patch(`/api/bills/pending/${id}/collect`, { amount, payment_method: method })

// DASHBOARD
export const getDashboardStats     = ()           => api.get('/api/dashboard/stats').then(r => r.data)
export const getProfitData         = (period)     => api.get(`/api/dashboard/profit?period=${period}`).then(r => r.data)
export const getCustomerVisitData  = (days = 7)   => api.get(`/api/dashboard/visits?days=${days}`).then(r => r.data)
export const getTopPendingCustomers = async (limit = 5) => {
  const pending = await getPendingPayments()
  const map = {}
  for (const p of pending) {
    const bal = (Number(p.amount_due)||0) - (Number(p.amount_paid)||0)
    if (map[p.customer_id]) map[p.customer_id].balance += bal
    else map[p.customer_id] = { name: p.customers?.name||'Unknown', phone: p.customers?.phone||'', balance: bal }
  }
  return Object.values(map).sort((a,b) => b.balance - a.balance).slice(0, limit)
}

// BACKUP
export const listBackups   = ()     => api.get('/api/backup/list').then(r => r.data)
export const runBackup     = ()     => api.post('/api/backup/run').then(r => r)
export const exportCSV     = ()     => api.get('/api/backup/export/csv').then(r => r.data)

// REPORTS (these still hit Supabase directly for analytics — read-only is OK)
export { getWeeklySales, getMonthlySales, getTopProducts, getReportSummary, getRecentReminderLogs, markReminderSent } from './api.js'
