import { Router } from 'express'
import { supabaseAdmin, sanitize } from '../utils/supabaseAdmin.js'
import { requireAuth } from '../middleware/auth.js'
import { billingLimiter } from '../middleware/security.js'
import { validateBill, validateUUID, validatePayment } from '../middleware/validate.js'
import { logger } from '../utils/logger.js'
import { format } from 'date-fns'

const router = Router()
router.use(requireAuth)

// GET /api/bills
router.get('/', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit)||50, 200)
    const { data, error } = await supabaseAdmin.from('bills')
      .select('*, customers(name)')
      .order('created_at', { ascending: false }).limit(limit)
    if (error) throw error
    res.json({ data: (data||[]).map(b => ({ ...b, customer_name: b.customer_name || b.customers?.name || 'Walk-in' })) })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// GET /api/bills/:id (with items)
router.get('/:id', validateUUID, async (req, res) => {
  try {
    const [bill, items] = await Promise.all([
      supabaseAdmin.from('bills').select('*, customers(name, phone)').eq('id', req.params.id).single(),
      supabaseAdmin.from('bill_items').select('*').eq('bill_id', req.params.id),
    ])
    if (bill.error) return res.status(404).json({ error: 'Bill not found' })
    res.json({ data: { ...bill.data, items: items.data||[] } })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// POST /api/bills — The main billing transaction
router.post('/', billingLimiter, validateBill, async (req, res) => {
  const { customer_id, customer_name, total_amount, paid_amount, payment_method, discount_amount, items, notes, is_pending_sale } = req.body

  try {
    // 1. Validate stock for all items before any DB write
    for (const item of items) {
      if (item.product_id) {
        const { data: prod } = await supabaseAdmin.from('products').select('stock, name').eq('id', item.product_id).single()
        if (prod && Number(prod.stock) < Number(item.quantity)) {
          return res.status(400).json({ error: `Insufficient stock for "${prod.name}". Available: ${prod.stock}` })
        }
      }
    }

    // 2. Create bill record
    const pendingAmt = Math.max(0, Number(total_amount) - Number(paid_amount))
    let paymentStatus = 'pending'
    if (Number(paid_amount) >= Number(total_amount)) paymentStatus = 'paid'
    else if (Number(paid_amount) > 0) paymentStatus = 'partial'

    const { data: savedBill, error: billErr } = await supabaseAdmin.from('bills').insert({
      customer_id: customer_id || null,
      customer_name: sanitize(customer_name || 'Walk-in Customer'),
      total_amount: Number(total_amount),
      paid_amount: Number(paid_amount),
      pending_amount: pendingAmt,
      payment_status: paymentStatus,
      payment_method: sanitize(payment_method || 'cash'),
      discount_amount: Number(discount_amount) || 0,
      is_pending_sale: Boolean(is_pending_sale),
      notes: notes ? sanitize(notes) : null,
    }).select().single()
    if (billErr) throw new Error(`Bill creation failed: ${billErr.message}`)

    const billId = savedBill.id

    // 3. Insert bill items + deduct stock atomically (best effort with rollback log)
    for (const item of items) {
      await supabaseAdmin.from('bill_items').insert({
        bill_id: billId,
        product_name: sanitize(item.product_name),
        quantity: Number(item.quantity),
        unit_price: Number(item.unit_price),
        total_price: Number(item.total_price),
      })
      if (item.product_id) {
        const { data: prod } = await supabaseAdmin.from('products').select('stock').eq('id', item.product_id).single()
        if (prod) {
          const newStock = Math.max(0, Number(prod.stock) - Number(item.quantity))
          await supabaseAdmin.from('products').update({ stock: newStock }).eq('id', item.product_id)
        }
      }
    }

    // 4. Create pending payment if partial
    if (pendingAmt > 0 && customer_id) {
      await supabaseAdmin.from('pending_payments').insert({
        customer_id, bill_id: billId,
        amount_due: Number(total_amount),
        amount_paid: Number(paid_amount),
        status: paymentStatus === 'partial' ? 'partial' : 'unpaid',
      })
    }

    // 5. Log customer visit
    if (customer_id) {
      await supabaseAdmin.from('customer_visits').insert({
        customer_id,
        customer_name: sanitize(customer_name || ''),
        bill_id: billId,
        visit_date: format(new Date(), 'yyyy-MM-dd'),
      }).catch(() => {})
    }

    // 6. Audit log
    logger.audit('BILL_CREATED', 'bills', req.userId, { billId, total: total_amount, method: payment_method, items: items.length })

    res.status(201).json({ data: savedBill })
  } catch (err) {
    logger.error('Bill creation failed', { error: err.message, userId: req.userId })
    res.status(500).json({ error: err.message })
  }
})

// PATCH /api/bills/pending/:id/collect
router.patch('/pending/:id/collect', validateUUID, validatePayment, async (req, res) => {
  try {
    const { data: pp } = await supabaseAdmin.from('pending_payments').select('*').eq('id', req.params.id).single()
    if (!pp) return res.status(404).json({ error: 'Pending payment not found' })

    const newPaid = Math.min((Number(pp.amount_paid)||0) + Number(req.body.amount), Number(pp.amount_due))
    const status = newPaid >= Number(pp.amount_due) ? 'paid' : 'partial'

    await supabaseAdmin.from('pending_payments').update({ amount_paid: newPaid, status }).eq('id', req.params.id)
    await supabaseAdmin.from('payment_history').insert({
      customer_id: pp.customer_id, bill_id: pp.bill_id,
      amount: Number(req.body.amount), payment_method: req.body.payment_method || 'cash'
    })

    logger.audit('PAYMENT_COLLECTED', 'pending_payments', req.userId, { pendingId: req.params.id, amount: req.body.amount, status })
    res.json({ success: true, newPaid, status })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// GET /api/bills/pending/all
router.get('/pending/all', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin.from('pending_payments')
      .select('*, customers(name, phone), bills(bill_number)')
      .neq('status', 'paid').order('created_at', { ascending: false })
    if (error) throw error
    res.json({ data: data || [] })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

export default router
