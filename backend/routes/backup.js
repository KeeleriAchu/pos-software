import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { runBackup, getBackupList } from '../services/backup.js'
import { supabaseAdmin } from '../utils/supabaseAdmin.js'
import { logger } from '../utils/logger.js'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

const router = Router()
router.use(requireAuth)

// GET /api/backup/list
router.get('/list', async (req, res) => {
  try {
    const backups = await getBackupList()
    res.json({ data: backups })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// POST /api/backup/run — Trigger manual backup
router.post('/run', async (req, res) => {
  try {
    logger.info('Manual backup triggered', { userId: req.userId })
    const summary = await runBackup()
    res.json({ success: true, summary })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// GET /api/backup/download/:name — Download backup JSON
router.get('/download/:name', async (req, res) => {
  try {
    const BACKUP_DIR = process.env.BACKUP_DIR || './backups'
    const safeDir = req.params.name.replace(/[^a-zA-Z0-9_\-]/g, '')
    const filePath = join(BACKUP_DIR, safeDir, 'backup.json')
    if (!existsSync(filePath)) return res.status(404).json({ error: 'Backup not found' })
    const data = readFileSync(filePath, 'utf-8')
    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Content-Disposition', `attachment; filename=pos_backup_${safeDir}.json`)
    res.send(data)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// GET /api/backup/export/csv — Export all data as CSV bundle
router.get('/export/csv', async (req, res) => {
  try {
    const tables = ['customers', 'products', 'bills', 'bill_items', 'pending_payments']
    const csvBundle = {}
    for (const table of tables) {
      const { data } = await supabaseAdmin.from(table).select('*').order('created_at', { ascending: true })
      if (!data?.length) { csvBundle[table] = ''; continue }
      const headers = Object.keys(data[0]).join(',')
      const rows = data.map(row =>
        Object.values(row).map(v =>
          v === null ? '' : typeof v === 'string' && v.includes(',') ? `"${v.replace(/"/g,'""')}"` : String(v)
        ).join(',')
      )
      csvBundle[table] = [headers, ...rows].join('\n')
    }
    res.json({ data: csvBundle, timestamp: new Date().toISOString() })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// GET /api/backup/export/report — Generates an aggregated business report
router.get('/export/report', async (req, res) => {
  try {
    const [productsRes, billsRes, itemsRes, pendingRes] = await Promise.all([
      supabaseAdmin.from('products').select('*').order('name', { ascending: true }),
      supabaseAdmin.from('bills').select('id, bill_number, customer_name, total_amount, paid_amount, payment_status, created_at').order('created_at', { ascending: false }),
      supabaseAdmin.from('bill_items').select('*'),
      supabaseAdmin.from('pending_payments').select('*, customers(name, phone)').neq('status', 'paid')
    ])

    const prods = productsRes.data || []
    const bills = billsRes.data || []
    const items = itemsRes.data || []
    const pending = pendingRes.data || []

    // Calculate product sales & profit
    const productStats = {}
    for (const p of prods) {
      productStats[p.id] = { name: p.name, category: p.category||'General', stock: p.stock, cost: Number(p.cost_price)||0, price: Number(p.selling_price)||0, soldQty: 0, revenue: 0, profit: 0 }
    }
    for (const item of items) {
      const pId = item.product_id
      if (pId && productStats[pId]) {
        const qty = Number(item.quantity)||0
        const revenue = Number(item.total_price)||0
        const cost = qty * productStats[pId].cost
        productStats[pId].soldQty += qty
        productStats[pId].revenue += revenue
        productStats[pId].profit += (revenue - cost)
      }
    }

    // Format pending payments
    const pendingList = pending.map(p => ({
      customer_name: p.customers?.name || 'Unknown',
      phone: p.customers?.phone || '',
      bill_id: p.bill_id,
      amount_due: Number(p.amount_due)||0,
      amount_paid: Number(p.amount_paid)||0,
      balance: (Number(p.amount_due)||0) - (Number(p.amount_paid)||0)
    }))

    res.json({ data: { products: Object.values(productStats), bills, pending: pendingList }, timestamp: new Date().toISOString() })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

export default router
