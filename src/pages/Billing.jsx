import { useEffect, useState, useRef, useCallback } from 'react'
import { Search, ShoppingCart, UserPlus, Barcode, X, CameraOff, Camera, ChevronRight, AlertTriangle, Package } from 'lucide-react'
import { getProducts, getCustomers, saveBill, addCustomer } from '../services/api'
import { useToast } from '../components/ui/Toast'

// ── HARDWARE BARCODE SCANNER HOOK ────────────
// USB/Bluetooth scanners type very fast (< 100ms between chars) then send Enter
function useHardwareScanner(onScanned, enabled = true) {
  const bufRef = useRef('')
  const timRef = useRef(null)
  useEffect(() => {
    if (!enabled) return
    const handler = (e) => {
      // Ignore keypresses in input/textarea/select elements (user is typing)
      const tag = document.activeElement?.tagName?.toLowerCase()
      if (['input', 'textarea', 'select'].includes(tag)) return

      if (e.key === 'Enter') {
        if (bufRef.current.length >= 3) onScanned(bufRef.current)
        bufRef.current = ''
        if (timRef.current) clearTimeout(timRef.current)
        return
      }
      if (e.key.length === 1) {
        bufRef.current += e.key
        if (timRef.current) clearTimeout(timRef.current)
        timRef.current = setTimeout(() => { bufRef.current = '' }, 100)
      }
    }
    window.addEventListener('keydown', handler)
    return () => {
      window.removeEventListener('keydown', handler)
      if (timRef.current) clearTimeout(timRef.current)
    }
  }, [onScanned, enabled])
}

// ── ADD CUSTOMER MODAL ────────────────────────
function AddCustomerModal({ onClose, onAdded }) {
  const [form, setForm] = useState({ name: '', phone: '', email: '', address: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const toast = useToast()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!form.name.trim()) { setError('Name is required'); return }
    if (!form.phone.trim() || form.phone.trim().length < 10) { setError('Enter a valid 10-digit phone number'); return }
    setLoading(true)
    try {
      const saved = await addCustomer(form)
      toast(`✅ ${saved.name} added!`)
      onAdded(saved)
      onClose()
    } catch (err) {
      setError(err.message || 'Failed to add customer')
    } finally { setLoading(false) }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 420 }}>
        <div className="modal-header">
          <h2 className="modal-title">Quick Add Customer</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: '#aaa', lineHeight: 1 }}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && (
              <div style={{ background: 'rgba(255,59,92,0.08)', border: '1px solid rgba(255,59,92,0.2)', borderRadius: 8, padding: '10px 14px', marginBottom: 12, fontSize: '0.84rem', color: 'var(--red)' }}>
                ⚠️ {error}
              </div>
            )}
            {[['name', 'Full Name *', 'text'], ['phone', 'Phone *', 'tel'], ['email', 'Email (optional)', 'email'], ['address', 'Address (optional)', 'text']].map(([k, l, t]) => (
              <div className="form-group" key={k}>
                <label className="form-label">{l}</label>
                <input className="input" type={t} value={form[k]} onChange={e => setForm({ ...form, [k]: e.target.value })} />
              </div>
            ))}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? <span className="spinner" /> : '+ Add Customer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── CAMERA BARCODE SCANNER MODAL ──────────────
function BarcodeScannerModal({ onScanned, onClose }) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const [manualCode, setManualCode] = useState('')
  const [cameraError, setCameraError] = useState('')
  const [cameraActive, setCameraActive] = useState(false)
  const [scanning, setScanning] = useState(false)

  const stopCamera = () => {
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null }
    setCameraActive(false); setScanning(false)
  }

  const startCamera = async () => {
    setCameraError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
        setCameraActive(true)
        startDetecting()
      }
    } catch {
      setCameraError('Camera not accessible. Use manual entry below.')
    }
  }

  const startDetecting = async () => {
    if (!('BarcodeDetector' in window)) {
      setCameraError('Camera active! Point barcode at camera. (Chrome/Edge required for auto-detect)')
      return
    }
    const detector = new window.BarcodeDetector({ formats: ['ean_13', 'ean_8', 'qr_code', 'code_128', 'code_39', 'upc_a', 'upc_e'] })
    setScanning(true)
    const detect = async () => {
      if (!videoRef.current || !streamRef.current) return
      try {
        const barcodes = await detector.detect(videoRef.current)
        if (barcodes.length > 0) { stopCamera(); onScanned(barcodes[0].rawValue); return }
      } catch {}
      if (streamRef.current) requestAnimationFrame(detect)
    }
    requestAnimationFrame(detect)
  }

  useEffect(() => { startCamera(); return () => stopCamera() }, [])

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 460 }}>
        <div className="modal-header">
          <h2 className="modal-title">Barcode Scanner</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: '#aaa', lineHeight: 1 }}>×</button>
        </div>
        <div className="modal-body">
          <div style={{ background: '#000', borderRadius: 12, overflow: 'hidden', aspectRatio: '4/3', position: 'relative', marginBottom: 16 }}>
            <video ref={videoRef} style={{ width: '100%', height: '100%', objectFit: 'cover', display: cameraActive ? 'block' : 'none' }} playsInline muted />
            {cameraActive && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                <div style={{ width: '65%', height: '35%', position: 'relative' }}>
                  {[{ t: 0, l: 0, bt: 1, bl: 1 }, { t: 0, r: 0, bt: 1, br: 1 }, { b: 0, l: 0, bb: 1, bl: 1 }, { b: 0, r: 0, bb: 1, br: 1 }].map((c, i) => (
                    <div key={i} style={{
                      position: 'absolute', width: 22, height: 22,
                      top: c.t !== undefined ? c.t : 'auto',
                      bottom: c.b !== undefined ? c.b : 'auto',
                      left: c.l !== undefined ? c.l : 'auto',
                      right: c.r !== undefined ? c.r : 'auto',
                      borderTop: c.bt ? '3px solid var(--accent)' : 'none',
                      borderBottom: c.bb ? '3px solid var(--accent)' : 'none',
                      borderLeft: c.bl ? '3px solid var(--accent)' : 'none',
                      borderRight: c.br ? '3px solid var(--accent)' : 'none',
                    }} />
                  ))}
                  {scanning && <div style={{ position: 'absolute', left: 0, right: 0, height: 2, background: 'var(--accent)', animation: 'scanLine 1.5s ease-in-out infinite' }} />}
                  <style>{`@keyframes scanLine{0%,100%{top:0}50%{top:100%}}`}</style>
                </div>
              </div>
            )}
            {!cameraActive && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: 160, gap: 12 }}>
                <CameraOff size={40} style={{ color: '#555' }} />
                <p style={{ color: '#666', fontSize: '0.85rem', textAlign: 'center', padding: '0 20px' }}>{cameraError || 'Starting camera...'}</p>
                {cameraError && (
                  <button className="btn btn-ghost btn-sm" style={{ color: 'white', borderColor: '#555' }} onClick={startCamera}>
                    <Camera size={14} /> Try Again
                  </button>
                )}
              </div>
            )}
          </div>
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
            <p style={{ fontSize: '0.82rem', color: '#888', marginBottom: 10, fontWeight: 600 }}>OR ENTER BARCODE MANUALLY</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                className="input"
                value={manualCode}
                onChange={e => setManualCode(e.target.value)}
                placeholder="Type or paste barcode..."
                autoComplete="off"
                style={{ flex: 1 }}
                onKeyDown={e => { if (e.key === 'Enter' && manualCode.trim()) { onScanned(manualCode.trim()); onClose() } }}
              />
              <button className="btn btn-primary" disabled={!manualCode.trim()} onClick={() => { if (manualCode.trim()) { onScanned(manualCode.trim()); onClose() } }}>
                Search
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── MAIN BILLING PAGE ─────────────────────────
export default function Billing() {
  const [step, setStep] = useState(1)           // 1 = pick products, 2 = checkout
  const [products, setProducts] = useState([])
  const [filtered, setFiltered] = useState([])
  const [customers, setCustomers] = useState([])
  const [cart, setCart] = useState([])
  const [search, setSearch] = useState('')
  const [customerId, setCustomerId] = useState('')
  const [walkinName, setWalkinName] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [paidAmount, setPaidAmount] = useState('')
  const [discount, setDiscount] = useState('0')
  const [isPending, setIsPending] = useState(false)
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [dataLoading, setDataLoading] = useState(true)
  const [billDone, setBillDone] = useState(null)
  const [showAddCustomer, setShowAddCustomer] = useState(false)
  const [showScanner, setShowScanner] = useState(false)
  const [loadError, setLoadError] = useState('')
  const toast = useToast()

  const loadData = async () => {
    setDataLoading(true)
    setLoadError('')
    try {
      const [p, c] = await Promise.all([getProducts(), getCustomers()])
      setProducts(p || [])
      setFiltered(p || [])
      setCustomers(c || [])
    } catch (err) {
      setLoadError(err.message || 'Failed to load products and customers')
    } finally {
      setDataLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  // Hardware scanner — only active on step 1, only when user is NOT typing in an input
  const handleHardwareScan = useCallback((code) => {
    if (step !== 1) return
    const match = products.find(p => p.barcode === code)
    if (match) {
      addToCart(match)
      toast(`📦 ${match.name} added via scanner!`)
    } else {
      setSearch(code)
      setFiltered(products.filter(p => p.name.toLowerCase().includes(code.toLowerCase()) || (p.barcode && p.barcode.includes(code))))
      toast(`Barcode "${code}" — no product matched`, 'error')
    }
  }, [products, step])

  useHardwareScanner(handleHardwareScan, step === 1)

  const handleSearch = (v) => {
    setSearch(v)
    setFiltered(
      !v.trim()
        ? products
        : products.filter(p => p.name.toLowerCase().includes(v.toLowerCase()) || (p.barcode && p.barcode.includes(v)))
    )
  }

  const handleBarcodeScanned = useCallback((code) => {
    setShowScanner(false)
    const match = products.find(p => p.barcode === code || p.name.toLowerCase() === code.toLowerCase())
    if (match) {
      addToCart(match)
      toast(`📦 ${match.name} added!`)
    } else {
      handleSearch(code)
      toast(`Barcode "${code}" — no product found`, 'error')
    }
  }, [products])

  const addToCart = (product) => {
    if (Number(product.stock) <= 0) {
      toast(`❌ ${product.name} is out of stock!`, 'error')
      return
    }
    const inCart = cart.find(i => i.id === product.id)?.qty || 0
    if (inCart >= Number(product.stock)) {
      toast(`⚠️ Only ${product.stock} units of ${product.name} available`, 'error')
      return
    }
    const threshold = Number(product.low_stock_threshold) || 10
    if (Number(product.stock) <= threshold) {
      toast(`⚠️ ${product.name} is low on stock (${product.stock} left)`, 'error')
    }
    setCart(prev => {
      const idx = prev.findIndex(i => i.id === product.id)
      if (idx >= 0) return prev.map((i, ix) => ix === idx ? { ...i, qty: i.qty + 1 } : i)
      return [...prev, { ...product, qty: 1 }]
    })
  }

  const updateQty = (id, delta) => {
    if (delta > 0) {
      const product = products.find(p => p.id === id)
      const inCart = cart.find(i => i.id === id)?.qty || 0
      if (product && inCart >= Number(product.stock)) {
        toast(`Only ${product.stock} units available`, 'error')
        return
      }
    }
    setCart(prev => prev.map(i => i.id === id ? { ...i, qty: i.qty + delta } : i).filter(i => i.qty > 0))
  }

  const subtotal = cart.reduce((s, i) => s + Number(i.price) * i.qty, 0)
  const discountAmt = Math.max(0, parseFloat(discount) || 0)
  const total = Math.max(0, subtotal - discountAmt)
  const paid = paidAmount !== '' ? Math.max(0, parseFloat(paidAmount) || 0) : (isPending ? 0 : total)
  const balance = Math.max(0, total - paid)
  const selectedCustomer = customers.find(c => c.id === customerId)

  const resetBill = () => {
    setCart([])
    setCustomerId('')
    setWalkinName('')
    setPaidAmount('')
    setDiscount('0')
    setNotes('')
    setIsPending(false)
    setSearch('')
    setFiltered(products)
    setStep(1)
  }

  const handleCreateBill = async () => {
    if (!cart.length) { toast('Add items to cart first', 'error'); return }
    if (isPending && !customerId) { toast('Select a customer for pending sale', 'error'); return }
    setLoading(true)
    try {
      const bill = {
        customer_id: customerId || null,
        customer_name: selectedCustomer?.name || walkinName?.trim() || 'Walk-in Customer',
        total_amount: total,
        paid_amount: Math.min(paid, total),
        discount_amount: discountAmt,
        payment_method: paymentMethod,
        is_pending_sale: isPending,
        notes: notes?.trim() || null,
      }
      const items = cart.map(i => ({
        product_id: i.id,
        product_name: i.name,
        unit_price: Number(i.price),
        quantity: i.qty,
        total_price: Number(i.price) * i.qty,
      }))
      const saved = await saveBill(bill, items)
      setBillDone({ bill: saved, items, customer: selectedCustomer, billName: bill.customer_name })
      resetBill()
      toast(`Bill ${saved.bill_number} created!`)
    } catch (err) {
      toast(err.message || 'Failed to create bill', 'error')
    } finally {
      setLoading(false)
    }
  }

  // ── RECEIPT VIEW ──────────────────────────────
  if (billDone) return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Bill Created ✓</h1>
        <button className="btn btn-accent" onClick={() => setBillDone(null)}>+ New Bill</button>
      </div>
      <div className="page-body" style={{ maxWidth: 520 }}>
        <div className="card card-pad">
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <div style={{ fontSize: 44, marginBottom: 8 }}>🧾</div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 800 }}>{billDone.bill.bill_number}</h2>
            <p className="text-muted text-sm">{billDone.billName}</p>
          </div>
          <div className="divider" />
          {billDone.items.map((item, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: '0.9rem', borderBottom: '1px solid var(--surface-2)' }}>
              <span>{item.product_name} <span style={{ color: '#aaa' }}>× {item.quantity}</span></span>
              <strong>₹{item.total_price.toLocaleString('en-IN')}</strong>
            </div>
          ))}
          <div className="divider" />
          {discountAmt > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: '0.9rem' }}>
              <span className="text-muted">Discount</span>
              <span style={{ color: 'var(--green)' }}>−₹{discountAmt.toLocaleString('en-IN')}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span className="text-muted">Total</span>
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.3rem', color: 'var(--accent)' }}>
              ₹{Number(billDone.bill.total_amount).toLocaleString('en-IN')}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
            <span className="text-muted">Paid</span>
            <span style={{ fontWeight: 700, color: 'var(--green)' }}>₹{Number(billDone.bill.paid_amount).toLocaleString('en-IN')}</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn flex-1" style={{ background: '#25D366', color: 'white' }} onClick={() => {
              const phone = billDone.customer?.phone?.replace(/[^0-9]/g, '')
              if (!phone) { toast('No customer phone number', 'error'); return }
              const msg = `🧾 *Bill: ${billDone.bill.bill_number}*\n\n${billDone.items.map(i => `• ${i.product_name} ×${i.quantity} = ₹${i.total_price}`).join('\n')}\n\n💰 Total: ₹${billDone.bill.total_amount}\n✅ Paid: ₹${billDone.bill.paid_amount}\n\nThank you! 🙏`
              window.open(`https://wa.me/91${phone}?text=${encodeURIComponent(msg)}`, '_blank')
            }}>💬 WhatsApp</button>
            <button className="btn btn-ghost flex-1" onClick={() => window.print()}>🖨️ Print</button>
            <button className="btn btn-primary flex-1" onClick={() => setBillDone(null)}>+ New Bill</button>
          </div>
        </div>
      </div>
    </div>
  )

  // ── STEP 1: SELECT PRODUCTS ───────────────────
  if (step === 1) return (
    <div>
      <div className="page-header" style={{ flexWrap: 'wrap', gap: 10 }}>
        <h1 className="page-title">New Bill</h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button className="btn btn-ghost" onClick={() => setShowScanner(true)}>
            <Barcode size={15} /> Scan Barcode
          </button>
          {cart.length > 0 && (
            <button className="btn btn-accent" onClick={() => setStep(2)}>
              Checkout — {cart.length} item{cart.length > 1 ? 's' : ''} · ₹{total.toLocaleString('en-IN')} <ChevronRight size={16} />
            </button>
          )}
        </div>
      </div>

      <div className="page-body">
        {loadError && (
          <div style={{ background: 'rgba(255,59,92,0.08)', border: '1px solid rgba(255,59,92,0.2)', borderRadius: 10, padding: '12px 16px', marginBottom: 16, color: 'var(--red)', fontSize: '0.88rem' }}>
            ⚠️ {loadError} — <button onClick={loadData} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', textDecoration: 'underline' }}>Retry</button>
          </div>
        )}

        <div className="billing-layout">
          {/* Left: product search + grid */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0 }}>
            <div className="search-input-wrap">
              <Search size={16} />
              <input
                className="input"
                placeholder="Search products by name or barcode..."
                value={search}
                onChange={e => handleSearch(e.target.value)}
              />
              {search && (
                <button onClick={() => handleSearch('')} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#aaa' }}>
                  <X size={14} />
                </button>
              )}
            </div>

            {dataLoading ? (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1, paddingTop: 60 }}>
                <div className="spinner" style={{ width: 32, height: 32, borderColor: 'rgba(0,0,0,0.1)', borderTopColor: 'var(--accent)', display: 'inline-block' }} />
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: '#bbb' }}>
                <Package size={44} style={{ marginBottom: 12, opacity: 0.4 }} />
                <p style={{ fontSize: '0.9rem' }}>
                  {products.length === 0 ? 'No products yet — add them in the Products page' : 'No products match your search'}
                </p>
              </div>
            ) : (
              <div className="product-grid">
                {filtered.map(p => {
                  const isLow = Number(p.stock) < (Number(p.low_stock_threshold) || 10)
                  const outOfStock = Number(p.stock) <= 0
                  return (
                    <div
                      key={p.id}
                      className="product-card"
                      onClick={() => !outOfStock && addToCart(p)}
                      style={{ opacity: outOfStock ? 0.5 : 1, cursor: outOfStock ? 'not-allowed' : 'pointer', position: 'relative' }}
                    >
                      {p.image_url ? (
                        <img src={p.image_url} alt={p.name} style={{ width: '100%', height: 80, objectFit: 'cover', borderRadius: 8, marginBottom: 8 }} />
                      ) : (
                        <div style={{ fontSize: 24, marginBottom: 6 }}>📦</div>
                      )}
                      {isLow && !outOfStock && (
                        <AlertTriangle size={12} style={{ position: 'absolute', top: 6, right: 6, color: 'var(--orange)' }} />
                      )}
                      {outOfStock && (
                        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.8)', borderRadius: 'var(--radius)', fontSize: '0.72rem', fontWeight: 700, color: 'var(--red)' }}>
                          OUT OF STOCK
                        </div>
                      )}
                      <div className="product-card-name">{p.name}</div>
                      <div className="product-card-price">₹{Number(p.price).toLocaleString('en-IN')}</div>
                      <div style={{ fontSize: '0.7rem', color: outOfStock ? 'var(--red)' : isLow ? 'var(--orange)' : '#aaa' }}>
                        Stock: {p.stock}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Right: cart */}
          <div className="cart-panel">
            <div className="cart-header">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h3>
                  <ShoppingCart size={15} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }} />
                  Cart
                  {cart.length > 0 && (
                    <span style={{ background: 'var(--accent)', color: 'white', borderRadius: 99, padding: '1px 8px', fontSize: '0.72rem', fontWeight: 800, marginLeft: 6 }}>
                      {cart.length}
                    </span>
                  )}
                </h3>
                {cart.length > 0 && (
                  <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red)', borderColor: 'rgba(255,59,92,0.2)', fontSize: '0.75rem' }} onClick={() => setCart([])}>
                    Clear
                  </button>
                )}
              </div>
            </div>

            <div className="cart-items">
              {cart.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: '#ccc' }}>
                  <ShoppingCart size={38} style={{ marginBottom: 10, opacity: 0.3 }} />
                  <p style={{ fontSize: '0.85rem' }}>Click a product to add it</p>
                </div>
              ) : cart.map(item => (
                <div key={item.id} className="cart-item">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="cart-item-name">{item.name}</div>
                    <div className="cart-item-price">
                      ₹{Number(item.price).toLocaleString('en-IN')} × {item.qty} = <strong>₹{(Number(item.price) * item.qty).toLocaleString('en-IN')}</strong>
                    </div>
                  </div>
                  <div className="qty-controls">
                    <button className="qty-btn" onClick={() => updateQty(item.id, -1)}>−</button>
                    <span className="qty-num">{item.qty}</span>
                    <button className="qty-btn" onClick={() => updateQty(item.id, 1)}>+</button>
                  </div>
                </div>
              ))}
            </div>

            <div className="cart-footer">
              <div className="cart-total-row">
                <span className="cart-total-label">Total</span>
                <span className="cart-total-value" style={{ color: 'var(--accent)' }}>₹{subtotal.toLocaleString('en-IN')}</span>
              </div>
              <button
                className="btn btn-accent btn-full"
                onClick={() => setStep(2)}
                disabled={!cart.length}
                style={{ fontSize: '0.95rem', padding: 13 }}
              >
                Proceed to Checkout <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {showScanner && <BarcodeScannerModal onScanned={handleBarcodeScanned} onClose={() => setShowScanner(false)} />}
    </div>
  )

  // ── STEP 2: CHECKOUT ──────────────────────────
  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Checkout</h1>
          <p className="text-muted text-sm">{cart.length} item{cart.length > 1 ? 's' : ''} · ₹{subtotal.toLocaleString('en-IN')}</p>
        </div>
        <button className="btn btn-ghost" onClick={() => setStep(1)}>← Back to Products</button>
      </div>

      <div className="page-body">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 20, alignItems: 'start' }}>

          {/* Left: options */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Pending sale toggle */}
            <div className="card card-pad" style={{ borderColor: isPending ? 'rgba(255,149,0,0.4)' : 'var(--border)', borderWidth: isPending ? 2 : 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>Mark as Pending Sale</div>
                  <div style={{ fontSize: '0.78rem', color: '#888', marginTop: 2 }}>Customer pays later — customer details required</div>
                </div>
                <label style={{ position: 'relative', width: 44, height: 24, cursor: 'pointer', flexShrink: 0 }}>
                  <input
                    type="checkbox"
                    checked={isPending}
                    onChange={e => { setIsPending(e.target.checked); if (e.target.checked) setPaidAmount('0') }}
                    style={{ position: 'absolute', opacity: 0, width: '100%', height: '100%', cursor: 'pointer', margin: 0 }}
                  />
                  <div style={{ position: 'absolute', inset: 0, background: isPending ? 'var(--orange)' : 'var(--border)', borderRadius: 99, transition: 'background 0.2s' }} />
                  <div style={{ position: 'absolute', top: 2, left: isPending ? 22 : 2, width: 20, height: 20, background: 'white', borderRadius: 50, transition: 'left 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.2)' }} />
                </label>
              </div>
              {isPending && (
                <div style={{ marginTop: 12, background: 'rgba(255,149,0,0.08)', borderRadius: 8, padding: '10px 12px', fontSize: '0.82rem', color: 'var(--orange)' }}>
                  ⚠️ Customer name and phone are required for pending sales.
                </div>
              )}
            </div>

            {/* Customer */}
            <div className="card card-pad">
              <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: 12 }}>
                Customer
                {isPending
                  ? <span style={{ color: 'var(--red)', fontSize: '0.8rem', marginLeft: 6 }}>* required</span>
                  : <span style={{ color: '#aaa', fontSize: '0.78rem', marginLeft: 6 }}>(optional)</span>
                }
              </div>
              <select className="input" value={customerId} onChange={e => setCustomerId(e.target.value)} style={{ marginBottom: 8 }}>
                <option value="">Walk-in Customer</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name} — {c.phone}</option>)}
              </select>
              {!customerId && (
                <input
                  className="input"
                  value={walkinName}
                  onChange={e => setWalkinName(e.target.value)}
                  placeholder="Walk-in customer name (optional)"
                  style={{ marginBottom: 8 }}
                />
              )}
              <button className="btn btn-ghost btn-sm" onClick={() => setShowAddCustomer(true)}>
                <UserPlus size={13} /> Add New Customer
              </button>
            </div>

            {/* Payment */}
            <div className="card card-pad">
              <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: 12 }}>Payment</div>

              <div className="payment-chips" style={{ marginBottom: 14 }}>
                {[['cash', '💵'], ['upi', '📱'], ['card', '💳']].map(([m, emoji]) => (
                  <div key={m} className={`payment-chip ${paymentMethod === m ? 'active' : ''}`} onClick={() => setPaymentMethod(m)}>
                    {emoji} {m}
                  </div>
                ))}
              </div>

              <div className="grid-2" style={{ marginBottom: 8 }}>
                <div className="form-group">
                  <label className="form-label">Discount ₹</label>
                  <input className="input" type="number" min="0" step="0.01" value={discount} onChange={e => setDiscount(e.target.value)} placeholder="0" />
                </div>
                <div className="form-group">
                  <label className="form-label">Amount Paid ₹</label>
                  <input
                    className="input"
                    type="number"
                    min="0"
                    step="0.01"
                    value={paidAmount}
                    onChange={e => setPaidAmount(e.target.value)}
                    placeholder={isPending ? '0 (full credit)' : `₹${total.toLocaleString('en-IN')}`}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Notes (optional)</label>
                <input className="input" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any note for this transaction" />
              </div>
            </div>
          </div>

          {/* Right: order summary + create bill */}
          <div className="cart-panel" style={{ height: 'auto' }}>
            <div className="cart-header"><h3>Order Summary</h3></div>
            <div className="cart-items" style={{ maxHeight: 300 }}>
              {cart.map(item => (
                <div key={item.id} className="cart-item">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="cart-item-name">{item.name}</div>
                    <div className="cart-item-price">{item.qty} × ₹{Number(item.price).toLocaleString('en-IN')}</div>
                  </div>
                  <strong style={{ fontSize: '0.88rem' }}>₹{(Number(item.price) * item.qty).toLocaleString('en-IN')}</strong>
                </div>
              ))}
            </div>
            <div className="cart-footer">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14, fontSize: '0.88rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span className="text-muted">Subtotal</span><span>₹{subtotal.toLocaleString('en-IN')}</span>
                </div>
                {discountAmt > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span className="text-muted">Discount</span><span style={{ color: 'var(--green)' }}>−₹{discountAmt.toLocaleString('en-IN')}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <strong>Total</strong>
                  <strong style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', color: 'var(--accent)' }}>₹{total.toLocaleString('en-IN')}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span className="text-muted">Paid</span>
                  <span style={{ color: 'var(--green)', fontWeight: 600 }}>₹{paid.toLocaleString('en-IN')}</span>
                </div>
                {balance > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--orange)', fontWeight: 700 }}>
                    <span>Balance Due</span><span>₹{balance.toLocaleString('en-IN')}</span>
                  </div>
                )}
              </div>

              {isPending && !customerId && (
                <div style={{ background: 'rgba(255,59,92,0.08)', borderRadius: 8, padding: '8px 12px', marginBottom: 10, fontSize: '0.82rem', color: 'var(--red)' }}>
                  ⚠️ Select a customer for pending sale
                </div>
              )}

              <button
                className="btn btn-accent btn-full"
                onClick={handleCreateBill}
                disabled={loading || !cart.length || (isPending && !customerId)}
                style={{ fontSize: '0.95rem', padding: 13 }}
              >
                {loading ? <span className="spinner" /> : `✓ Create Bill — ₹${total.toLocaleString('en-IN')}`}
              </button>
            </div>
          </div>
        </div>
      </div>

      {showAddCustomer && (
        <AddCustomerModal
          onClose={() => setShowAddCustomer(false)}
          onAdded={c => {
            setCustomers(prev => [...prev, c].sort((a, b) => a.name.localeCompare(b.name)))
            setCustomerId(c.id)
          }}
        />
      )}
    </div>
  )
}
