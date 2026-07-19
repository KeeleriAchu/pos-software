import { body, param, query, validationResult } from 'express-validator'

// Returns 400 with field errors if validation fails
export const validate = (req, res, next) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array().map(e => ({ field: e.path, message: e.msg }))
    })
  }
  next()
}

// ── Validation Rules ──────────────────────────────────────────

export const validateCustomer = [
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 100 }).escape(),
  body('phone').trim().notEmpty().withMessage('Phone is required').matches(/^[0-9]{10,15}$/).withMessage('Invalid phone number'),
  body('email').optional().isEmail().normalizeEmail().withMessage('Invalid email'),
  body('address').optional().trim().isLength({ max: 300 }).escape(),
  validate
]

export const validateProduct = [
  body('name').trim().notEmpty().withMessage('Product name is required').isLength({ max: 150 }).escape(),
  body('price').isFloat({ min: 0 }).withMessage('Price must be a positive number'),
  body('cost_price').optional().isFloat({ min: 0 }),
  body('stock').optional().isInt({ min: 0 }),
  body('low_stock_threshold').optional().isInt({ min: 1, max: 10000 }),
  body('unit').optional().trim().isLength({ max: 20 }).escape(),
  body('category').optional().trim().isLength({ max: 50 }).escape(),
  body('barcode').optional().trim().isLength({ max: 100 }).matches(/^[A-Za-z0-9\-_. ]*$/).withMessage('Invalid barcode characters'),
  validate
]

export const validateBill = [
  body('total_amount').isFloat({ min: 0.01 }).withMessage('Total amount must be positive'),
  body('paid_amount').isFloat({ min: 0 }).withMessage('Paid amount must be non-negative'),
  body('payment_method').isIn(['cash', 'upi', 'card']).withMessage('Invalid payment method'),
  body('items').isArray({ min: 1 }).withMessage('At least one item required'),
  body('items.*.product_name').trim().notEmpty().isLength({ max: 150 }).escape(),
  body('items.*.quantity').isInt({ min: 1 }),
  body('items.*.unit_price').isFloat({ min: 0 }),
  body('items.*.total_price').isFloat({ min: 0 }),
  validate
]

export const validatePayment = [
  body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be positive'),
  validate
]

export const validateUUID = [
  param('id').isUUID().withMessage('Invalid ID format'),
  validate
]
