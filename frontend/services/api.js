// Front‑end API service – uses fetch to call our own back‑end instead of Supabase client
// ---------------------------------------------------------------
// Environment: Vite loads variables from .env files. Ensure VITE_API_BASE_URL is set.
const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

let authToken = localStorage.getItem('pos_token') || null; // JWT token obtained after signIn / signUp

const authHeaders = () => (authToken ? { Authorization: `Bearer ${authToken}` } : {});

/** Helper for JSON requests */
async function request(path, { method = 'GET', body = null, query = null } = {}) {
  const url = new URL(`${API_BASE}${path}`);
  if (query) {
    Object.entries(query).forEach(([k, v]) => url.searchParams.append(k, v));
  }
  const opts = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
    },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

// ── AUTH ──────────────────────────────────────
export const signIn = async (email, password) => {
  const data = await request('/api/auth/login', { method: 'POST', body: { email, password } });
  authToken = data.token;
  localStorage.setItem('pos_token', data.token);
  localStorage.setItem('pos_user', JSON.stringify(data.user));
  window.dispatchEvent(new Event('authChange'));
  return data;
};

export const signUp = async (email, password) => {
  const data = await request('/api/auth/register', { method: 'POST', body: { email, password } });
  authToken = data.token;
  localStorage.setItem('pos_token', data.token);
  localStorage.setItem('pos_user', JSON.stringify(data.user));
  window.dispatchEvent(new Event('authChange'));
  return data;
};

export const signOut = async () => {
  authToken = null;
  localStorage.removeItem('pos_token');
  localStorage.removeItem('pos_user');
  window.dispatchEvent(new Event('authChange'));
};

export const changePassword = async (currentPassword, newPassword) => {
  return request('/api/auth/change-password', { method: 'POST', body: { currentPassword, newPassword } });
};

// ── CUSTOMERS ─────────────────────────────────
export const getCustomers = async () => {
  const { data } = await request('/api/customers');
  return data || [];
};

export const addCustomer = async (customer) => {
  const payload = {
    name: customer.name?.trim(),
    phone: customer.phone?.trim(),
    ...(customer.email?.trim() && { email: customer.email.trim() }),
    ...(customer.address?.trim() && { address: customer.address.trim() }),
  };
  const { data } = await request('/api/customers', { method: 'POST', body: payload });
  return data;
};

export const updateCustomer = async (id, customer) => {
  const payload = {
    name: customer.name?.trim(),
    phone: customer.phone?.trim(),
    email: customer.email?.trim() || null,
    address: customer.address?.trim() || null,
  };
  const { data } = await request(`/api/customers/${id}`, { method: 'PUT', body: payload });
  return data;
};

export const deleteCustomer = async (id) => {
  await request(`/api/customers/${id}`, { method: 'DELETE' });
};

export const getCustomerPendingAmounts = async () => {
  const { data } = await request('/api/bills/pending/all');
  const map = {};
  for (const r of data || []) {
    const bal = (Number(r.amount_due) || 0) - (Number(r.amount_paid) || 0);
    map[r.customer_id] = (map[r.customer_id] || 0) + bal;
  }
  return map;
};

export const getCustomerHistory = async (customerId) => {
  const { data } = await request(`/api/customers/${customerId}`);
  return {
    bills: data.bills || [],
    pending: data.pending || [],
    visits: data.visits || [],
  };
};

// ── PRODUCTS ──────────────────────────────────
export const getProducts = async () => {
  const { data } = await request('/api/products');
  return data || [];
};

export const getLowStockProducts = async () => {
  const all = await getProducts();
  return all.filter(p => p.stock < (p.low_stock_threshold ?? 10));
};

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
  };
  const { data } = await request('/api/products', { method: 'POST', body: payload });
  return data;
};

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
  };
  const { data } = await request(`/api/products/${id}`, { method: 'PUT', body: payload });
  return data;
};

export const restockProduct = async (id, addQty) => {
  const { data } = await request(`/api/products/${id}/restock`, { method: 'PATCH', body: { addQty } });
  return data;
};

export const deleteProduct = async (id) => {
  await request(`/api/products/${id}`, { method: 'DELETE' });
};

// ── BILLS ─────────────────────────────────────
export const saveBill = async (bill, items) => {
  const payload = {
    ...bill,
    total_amount: Number(bill.total_amount),
    paid_amount: Number(bill.paid_amount),
    discount_amount: Number(bill.discount_amount) || 0,
    is_pending_sale: !!bill.is_pending_sale,
  };
  const { data: savedBill } = await request('/api/bills', { method: 'POST', body: { ...payload, items } });
  return savedBill;
};

export const getRecentBills = async (limit = 10) => {
  const { data } = await request('/api/bills', { query: { _limit: limit, _sort: 'created_at:DESC' } });
  return data || [];
};

export const getBillItems = async (billId) => {
  const { data } = await request(`/api/bills/${billId}/items`);
  return data || [];
};

// ── PENDING PAYMENTS ──────────────────────────
export const getPendingPayments = async () => {
  const { data } = await request('/api/bills/pending/all');
  return data || [];
};

export const collectPayment = async (id, newPaid, totalDue) => {
  // Calculate the amount being collected right now
  const { data: currentPending } = await request('/api/bills/pending/all').catch(() => ({ data: [] }));
  const pp = currentPending.find(p => p.id === id);
  const currentPaid = pp ? Number(pp.amount_paid || 0) : 0;
  const amountToCollect = newPaid - currentPaid;
  await request(`/api/bills/pending/${id}/collect`, { method: 'PATCH', body: { amount: amountToCollect, payment_method: 'cash' } });
};

export const markReminderSent = async (pendingId) => {
  // Not implemented on backend yet, ignore for now
};

// ── DASHBOARD ─────────────────────────────────
export const getDashboardStats = async () => {
  const { data } = await request('/api/dashboard/stats');
  return data;
};

export const getTopPendingCustomers = async (limit = 5) => {
  const pending = await getPendingPayments();
  const map = {};
  for (const p of pending) {
    const bal = (Number(p.amount_due) || 0) - (Number(p.amount_paid) || 0);
    if (map[p.customer_id]) {
      map[p.customer_id].balance += bal;
    } else {
      map[p.customer_id] = { name: p.customers?.name || 'Unknown', phone: p.customers?.phone || '', balance: bal };
    }
  }
  return Object.values(map).sort((a, b) => b.balance - a.balance).slice(0, limit);
};

// ── ANALYTICS ─────────────────────────────────
export const getProfitData = async (period = 'week') => {
  const { data } = await request('/api/dashboard/profit', { query: { period } });
  return data;
};

export const getCustomerVisitData = async (days = 7) => {
  const { data } = await request('/api/dashboard/visits', { query: { days } });
  return data;
};

// ── REPORTS ───────────────────────────────────
export const getWeeklySales = () => getProfitData('week');
export const getMonthlySales = () => getProfitData('month');

export const getTopProducts = async () => {
  const { data } = await request('/api/reports/top_products');
  return data;
};

export const getReportSummary = async () => {
  const { data } = await request('/api/reports/summary');
  return data;
};

export const getRecentReminderLogs = async (limit = 20) => {
  const { data } = await request('/api/reports/reminder_logs', { query: { _limit: limit } });
  return data;
};

// ── BACKUP / EXPORT ───────────────────────────
export const exportReport = async () => {
  const { data } = await request('/api/backup/export/report');
  return data;
};
