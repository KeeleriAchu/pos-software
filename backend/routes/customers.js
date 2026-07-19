import { Router } from 'express'
import { supabaseAdmin, sanitize, isValidUUID } from '../utils/supabaseAdmin.js'
import { requireAuth } from '../middleware/auth.js'
import { validateCustomer, validateUUID, validate } from '../middleware/validate.js'
import { logger } from '../utils/logger.js'

const router = Router()
router.use(requireAuth) // All customer routes require auth

// GET /api/customers
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin.from('customers').select('*').order('name')
    if (error) throw error
    res.json({ data })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// GET /api/customers/:id
router.get('/:id', validateUUID, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin.from('customers').select('*').eq('id', req.params.id).single()
    if (error) return res.status(404).json({ error: 'Customer not found' })
    // Get full history
    const [bills, pending, visits] = await Promise.all([
      supabaseAdmin.from('bills').select('*').eq('customer_id', req.params.id).order('created_at', { ascending: false }),
      supabaseAdmin.from('pending_payments').select('*').eq('customer_id', req.params.id),
      supabaseAdmin.from('customer_visits').select('*').eq('customer_id', req.params.id).order('created_at', { ascending: false }).limit(30),
    ])
    res.json({ data: { ...data, bills: bills.data||[], pending: pending.data||[], visits: visits.data||[] } })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// POST /api/customers
router.post('/', validateCustomer, async (req, res) => {
  try {
    const payload = {
      name: sanitize(req.body.name),
      phone: sanitize(req.body.phone),
      email: req.body.email ? sanitize(req.body.email) : null,
      address: req.body.address ? sanitize(req.body.address) : null,
    }
    const { data, error } = await supabaseAdmin.from('customers').insert(payload).select().single()
    if (error) {
      if (error.code === '23505') return res.status(409).json({ error: 'Phone number already registered' })
      throw error
    }
    logger.audit('INSERT', 'customers', req.userId, { customerId: data.id })
    res.status(201).json({ data })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// PUT /api/customers/:id
router.put('/:id', validateUUID, validateCustomer, async (req, res) => {
  try {
    const payload = {
      name: sanitize(req.body.name),
      phone: sanitize(req.body.phone),
      email: req.body.email ? sanitize(req.body.email) : null,
      address: req.body.address ? sanitize(req.body.address) : null,
    }
    const { data, error } = await supabaseAdmin.from('customers').update(payload).eq('id', req.params.id).select().single()
    if (error) throw error
    logger.audit('UPDATE', 'customers', req.userId, { customerId: req.params.id })
    res.json({ data })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// DELETE /api/customers/:id
router.delete('/:id', validateUUID, async (req, res) => {
  try {
    const { error } = await supabaseAdmin.from('customers').delete().eq('id', req.params.id)
    if (error) throw error
    logger.audit('DELETE', 'customers', req.userId, { customerId: req.params.id })
    res.json({ success: true })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

export default router
