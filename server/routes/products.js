import { Router } from 'express'
import { supabaseAdmin, sanitize, isValidUUID } from '../utils/supabaseAdmin.js'
import { requireAuth } from '../middleware/auth.js'
import { validateProduct, validateUUID } from '../middleware/validate.js'
import { body } from 'express-validator'
import { logger } from '../utils/logger.js'

const router = Router()
router.use(requireAuth)

// GET /api/products
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin.from('products').select('*').order('name')
    if (error) throw error
    // Flag low stock items server-side
    const enriched = (data||[]).map(p => ({
      ...p,
      is_low_stock: Number(p.stock) < (Number(p.low_stock_threshold) || 10)
    }))
    res.json({ data: enriched })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// GET /api/products/low-stock
router.get('/low-stock', async (req, res) => {
  try {
    const { data } = await supabaseAdmin.from('products').select('*')
    const low = (data||[]).filter(p => Number(p.stock) < (Number(p.low_stock_threshold)||10))
    res.json({ data: low, count: low.length })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// GET /api/products/barcode/:code
router.get('/barcode/:code', async (req, res) => {
  try {
    const code = sanitize(req.params.code)
    const { data } = await supabaseAdmin.from('products').select('*').eq('barcode', code).single()
    if (!data) return res.status(404).json({ error: 'Product not found for barcode' })
    res.json({ data })
  } catch (err) { res.status(404).json({ error: 'Not found' }) }
})

// POST /api/products
router.post('/', validateProduct, async (req, res) => {
  try {
    const payload = {
      name: sanitize(req.body.name),
      price: parseFloat(req.body.price),
      cost_price: parseFloat(req.body.cost_price) || 0,
      stock: parseInt(req.body.stock) || 0,
      low_stock_threshold: parseInt(req.body.low_stock_threshold) || 10,
      unit: req.body.unit ? sanitize(req.body.unit) : null,
      category: req.body.category ? sanitize(req.body.category) : null,
      barcode: req.body.barcode ? sanitize(req.body.barcode) : null,
      image_url: req.body.image_url || null,
    }
    const { data, error } = await supabaseAdmin.from('products').insert(payload).select().single()
    if (error) {
      if (error.code === '23505') return res.status(409).json({ error: 'Barcode already exists' })
      throw error
    }
    logger.audit('INSERT', 'products', req.userId, { productId: data.id, name: data.name })
    res.status(201).json({ data })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// PUT /api/products/:id
router.put('/:id', validateUUID, validateProduct, async (req, res) => {
  try {
    const payload = {
      name: sanitize(req.body.name),
      price: parseFloat(req.body.price),
      cost_price: parseFloat(req.body.cost_price) || 0,
      stock: parseInt(req.body.stock) || 0,
      low_stock_threshold: parseInt(req.body.low_stock_threshold) || 10,
      unit: req.body.unit ? sanitize(req.body.unit) : null,
      category: req.body.category ? sanitize(req.body.category) : null,
      barcode: req.body.barcode ? sanitize(req.body.barcode) : null,
      image_url: req.body.image_url !== undefined ? req.body.image_url : null,
    }
    const { data, error } = await supabaseAdmin.from('products').update(payload).eq('id', req.params.id).select().single()
    if (error) throw error
    logger.audit('UPDATE', 'products', req.userId, { productId: req.params.id })
    res.json({ data })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// PATCH /api/products/:id/restock
router.patch('/:id/restock', validateUUID, [
  body('quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
], async (req, res) => {
  try {
    const { data: current } = await supabaseAdmin.from('products').select('stock, name').eq('id', req.params.id).single()
    if (!current) return res.status(404).json({ error: 'Product not found' })
    const newStock = (Number(current.stock)||0) + Number(req.body.quantity)
    const { data, error } = await supabaseAdmin.from('products').update({ stock: newStock }).eq('id', req.params.id).select().single()
    if (error) throw error
    logger.audit('RESTOCK', 'products', req.userId, { productId: req.params.id, added: req.body.quantity, newStock })
    res.json({ data, message: `Stock updated to ${newStock}` })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// DELETE /api/products/:id
router.delete('/:id', validateUUID, async (req, res) => {
  try {
    const { error } = await supabaseAdmin.from('products').delete().eq('id', req.params.id)
    if (error) throw error
    logger.audit('DELETE', 'products', req.userId, { productId: req.params.id })
    res.json({ success: true })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

export default router
