import { useEffect, useState, useRef, useCallback } from 'react'
import { Plus, Edit2, Trash2, Package, Barcode, AlertTriangle, RefreshCw, Camera, Image, X, Printer, Download, ZoomIn } from 'lucide-react'
import { getProducts, addProduct, updateProduct, restockProduct, deleteProduct } from '../services/api'
import { uploadProductImage, compressImage, captureFromVideo, deleteProductImage } from '../services/imageService'
import { generateProductBarcode, renderBarcodeToCanvas, printBarcodeLabels } from '../services/barcodeService'
import { useToast } from '../components/ui/Toast'

// ── IMAGE PICKER ──────────────────────────────
function ImagePicker({ currentUrl, onImageReady, onRemove }) {
  const fileRef = useRef(null)
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const [cameraOpen, setCameraOpen] = useState(false)
  const [preview, setPreview] = useState(currentUrl || null)
  const [pendingFile, setPendingFile] = useState(null)

  const stopCamera = () => {
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null }
    setCameraOpen(false)
  }

  const openCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 } } })
      streamRef.current = stream
      setCameraOpen(true)
      setTimeout(() => { if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play() } }, 100)
    } catch { alert('Camera not accessible') }
  }

  const capturePhoto = async () => {
    const file = await captureFromVideo(videoRef.current)
    stopCamera()
    const compressed = await compressImage(file)
    const url = URL.createObjectURL(compressed)
    setPreview(url); setPendingFile(compressed)
    onImageReady(compressed)
  }

  const handleFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const compressed = await compressImage(file)
    const url = URL.createObjectURL(compressed)
    setPreview(url); setPendingFile(compressed)
    onImageReady(compressed)
    e.target.value = ''
  }

  const handleRemove = () => {
    setPreview(null); setPendingFile(null)
    onRemove()
  }

  return (
    <div>
      <label className="form-label">Product Image</label>

      {/* Camera overlay */}
      {cameraOpen && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.92)', zIndex:2000, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:16 }}>
          <div style={{ position:'relative', borderRadius:12, overflow:'hidden', maxWidth:480, width:'90%' }}>
            <video ref={videoRef} style={{ width:'100%', display:'block' }} playsInline muted autoPlay/>
            {/* Crop guide */}
            <div style={{ position:'absolute', inset:0, border:'2px solid rgba(255,255,255,0.3)', borderRadius:12, pointerEvents:'none' }}>
              <div style={{ position:'absolute', top:'10%', left:'10%', width:'80%', height:'80%', border:'2px solid var(--accent)', borderRadius:8 }}/>
            </div>
          </div>
          <div style={{ display:'flex', gap:12 }}>
            <button className="btn btn-accent" onClick={capturePhoto} style={{ fontSize:'1rem', padding:'12px 28px' }}>
              📸 Capture
            </button>
            <button className="btn btn-ghost" style={{ color:'white', borderColor:'rgba(255,255,255,0.3)' }} onClick={stopCamera}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {preview ? (
        <div style={{ position:'relative', display:'inline-block' }}>
          <img src={preview} alt="Product"
            style={{ width:'100%', maxWidth:240, height:160, objectFit:'cover', borderRadius:10, border:'1.5px solid var(--border)', display:'block' }}/>
          <button onClick={handleRemove}
            style={{ position:'absolute', top:6, right:6, width:26, height:26, borderRadius:99, background:'rgba(0,0,0,0.6)', border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'white' }}>
            <X size={14}/>
          </button>
          <div style={{ display:'flex', gap:8, marginTop:8 }}>
            <button type="button" className="btn btn-ghost btn-sm" onClick={openCamera}><Camera size={13}/> Retake</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => fileRef.current?.click()}><Image size={13}/> Change</button>
          </div>
        </div>
      ) : (
        <div style={{ display:'flex', gap:10 }}>
          <button type="button" className="btn btn-ghost" onClick={openCamera} style={{ flex:1, padding:'14px', display:'flex', flexDirection:'column', alignItems:'center', gap:6, borderStyle:'dashed', borderWidth:2 }}>
            <Camera size={22} style={{ color:'var(--accent)' }}/>
            <span style={{ fontSize:'0.8rem' }}>Camera</span>
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => fileRef.current?.click()} style={{ flex:1, padding:'14px', display:'flex', flexDirection:'column', alignItems:'center', gap:6, borderStyle:'dashed', borderWidth:2 }}>
            <Image size={22} style={{ color:'var(--blue)' }}/>
            <span style={{ fontSize:'0.8rem' }}>Gallery</span>
          </button>
        </div>
      )}

      <input ref={fileRef} type="file" accept="image/*" style={{ display:'none' }} onChange={handleFile}/>
    </div>
  )
}

// ── BARCODE PREVIEW + PRINT MODAL ─────────────
function BarcodeModal({ product, onClose, onBarcodeGenerated }) {
  const canvasRef = useRef(null)
  const [barcodeValue, setBarcodeValue] = useState(product?.barcode || '')
  const [qty, setQty] = useState(1)
  const [perRow, setPerRow] = useState(3)
  const [labelSize, setLabelSize] = useState('medium')
  const [rendered, setRendered] = useState(false)
  const toast = useToast()

  const renderBarcode = useCallback(() => {
    if (!barcodeValue || !canvasRef.current) return
    try {
      const sizes = { small: { width:1.5, height:40, fontSize:10 }, medium: { width:2, height:60, fontSize:12 }, large: { width:2.5, height:80, fontSize:14 } }
      renderBarcodeToCanvas(canvasRef.current, barcodeValue, sizes[labelSize])
      setRendered(true)
    } catch (err) { toast('Invalid barcode value', 'error') }
  }, [barcodeValue, labelSize])

  useEffect(() => { renderBarcode() }, [renderBarcode])

  const handleGenerate = () => {
    const code = generateProductBarcode(product?.id)
    setBarcodeValue(code)
  }

  const handleDownload = () => {
    if (!canvasRef.current) return
    const link = document.createElement('a')
    link.download = `barcode_${product?.name || 'product'}.png`
    link.href = canvasRef.current.toDataURL('image/png')
    link.click()
  }

  const handlePrint = () => {
    const products = Array(qty).fill({ ...product, barcode: barcodeValue })
    const uniqueProducts = [{ ...product, barcode: barcodeValue }]
    // Repeat the same product label `qty` times
    const all = Array.from({ length: qty }, () => ({ ...product, barcode: barcodeValue, id: product?.id + Math.random() }))
    printBarcodeLabels(all, perRow)
    if (barcodeValue !== product?.barcode) {
      onBarcodeGenerated?.(barcodeValue)
    }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target===e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth:480 }}>
        <div className="modal-header">
          <h2 className="modal-title">Barcode — {product?.name}</h2>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', fontSize:22, color:'#aaa' }}>×</button>
        </div>
        <div className="modal-body">
          {/* Barcode value */}
          <div className="form-group">
            <label className="form-label">Barcode Value</label>
            <div style={{ display:'flex', gap:8 }}>
              <input className="input" value={barcodeValue} onChange={e => setBarcodeValue(e.target.value)}
                placeholder="Enter or generate barcode" style={{ flex:1, fontFamily:'monospace', letterSpacing:'0.05em' }}/>
              <button type="button" className="btn btn-ghost btn-sm" onClick={handleGenerate} title="Auto-generate barcode">
                ✨ Generate
              </button>
            </div>
          </div>

          {/* Preview canvas */}
          <div style={{ background:'white', border:'1.5px solid var(--border)', borderRadius:10, padding:16, textAlign:'center', marginBottom:16, minHeight:120, display:'flex', alignItems:'center', justifyContent:'center' }}>
            {barcodeValue ? (
              <canvas ref={canvasRef} style={{ maxWidth:'100%' }}/>
            ) : (
              <p style={{ color:'#ccc', fontSize:'0.85rem' }}>Enter a barcode value to preview</p>
            )}
          </div>

          {/* Print options */}
          <div style={{ background:'var(--surface)', borderRadius:10, padding:14, display:'flex', flexDirection:'column', gap:12 }}>
            <p style={{ fontSize:'0.75rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em', color:'#888' }}>Print Options</p>
            <div className="grid-2">
              <div className="form-group" style={{ marginBottom:0 }}>
                <label className="form-label">Copies</label>
                <input className="input" type="number" min="1" max="100" value={qty} onChange={e => setQty(parseInt(e.target.value)||1)}/>
              </div>
              <div className="form-group" style={{ marginBottom:0 }}>
                <label className="form-label">Per Row</label>
                <select className="input" value={perRow} onChange={e => setPerRow(parseInt(e.target.value))}>
                  <option value={2}>2 per row</option>
                  <option value={3}>3 per row</option>
                  <option value={4}>4 per row</option>
                  <option value={5}>5 per row</option>
                </select>
              </div>
            </div>
            <div className="form-group" style={{ marginBottom:0 }}>
              <label className="form-label">Label Size</label>
              <div style={{ display:'flex', gap:8 }}>
                {['small','medium','large'].map(s => (
                  <button key={s} type="button" onClick={() => setLabelSize(s)}
                    style={{ flex:1, padding:'7px', borderRadius:8, border:`1.5px solid ${labelSize===s?'var(--accent)':'var(--border)'}`, background:labelSize===s?'rgba(255,92,40,0.08)':'var(--white)', color:labelSize===s?'var(--accent)':'var(--ink)', cursor:'pointer', fontSize:'0.82rem', fontWeight:600, textTransform:'capitalize' }}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={handleDownload} disabled={!rendered}>
            <Download size={15}/> Download PNG
          </button>
          <button className="btn btn-primary" onClick={handlePrint} disabled={!barcodeValue}>
            <Printer size={15}/> Print {qty} Label{qty > 1 ? 's' : ''}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── PRODUCT MODAL ─────────────────────────────
function ProductModal({ product, onClose, onSave }) {
  const [form, setForm] = useState({
    name:'', price:'', cost_price:'', stock:'0', low_stock_threshold:'10',
    unit:'', category:'', barcode:'', image_url:'',
    ...product,
    price: product?.price ?? '',
    cost_price: product?.cost_price ?? '',
    stock: product?.stock ?? '0',
    low_stock_threshold: product?.low_stock_threshold ?? '10',
  })
  const [pendingImageFile, setPendingImageFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState('')
  const [error, setError] = useState('')
  const toast = useToast()

  const handleSubmit = async (e) => {
    e.preventDefault(); setError('')
    if (!form.name.trim()) { setError('Product name is required'); return }
    if (!form.price || parseFloat(form.price) <= 0) { setError('Enter a valid selling price'); return }
    setLoading(true)
    try {
      let imageUrl = form.image_url || null

      // Upload image if a new one was selected
      if (pendingImageFile) {
        setUploadProgress('Uploading image...')
        if (product?.image_url) await deleteProductImage(product.image_url).catch(() => {})
        imageUrl = await uploadProductImage(pendingImageFile, product?.id || `temp_${Date.now()}`)
        setUploadProgress('')
      }

      const finalForm = { ...form, image_url: imageUrl }
      if (product?.id) await updateProduct(product.id, finalForm)
      else await addProduct(finalForm)
      onSave(); onClose()
      toast(product?.id ? '✅ Product updated!' : '✅ Product added!')
    } catch (err) { setError(err.message || 'Failed to save product'); setUploadProgress('') }
    finally { setLoading(false) }
  }

  const field = (key, label, opts={}) => (
    <div className="form-group">
      <label className="form-label">{label}</label>
      <input className="input" value={form[key]??''} onChange={e => setForm({...form,[key]:e.target.value})} {...opts}/>
    </div>
  )

  return (
    <div className="modal-overlay" onClick={e => e.target===e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth:540 }}>
        <div className="modal-header">
          <h2 className="modal-title">{product?.id ? 'Edit Product' : 'Add Product'}</h2>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', fontSize:22, color:'#aaa' }}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ maxHeight:'75vh', overflowY:'auto' }}>
            {error && <div style={{ background:'rgba(255,59,92,0.08)', border:'1px solid rgba(255,59,92,0.2)', borderRadius:8, padding:'10px 14px', marginBottom:14, fontSize:'0.85rem', color:'var(--red)' }}>⚠️ {error}</div>}

            {/* Image picker at top */}
            <div className="form-group">
              <ImagePicker
                currentUrl={form.image_url}
                onImageReady={(file) => setPendingImageFile(file)}
                onRemove={() => { setPendingImageFile(null); setForm(f => ({...f, image_url: null})) }}
              />
            </div>

            {field('name','Product Name *', { required:true, placeholder:'e.g. Basmati Rice 1kg', autoFocus:true })}

            <div className="grid-2">
              {field('price','Selling Price ₹ *', { type:'number', step:'0.01', min:'0', required:true })}
              {field('cost_price','Cost Price ₹', { type:'number', step:'0.01', min:'0', placeholder:'for profit calc' })}
            </div>
            <div className="grid-2">
              {field('stock','Stock Qty', { type:'number', min:'0' })}
              {field('low_stock_threshold','Alert When Below', { type:'number', min:'1', placeholder:'10' })}
            </div>
            <div className="grid-2">
              {field('unit','Unit', { placeholder:'kg, litre, pcs...' })}
              {field('category','Category', { placeholder:'Grocery, Electronics...' })}
            </div>

            {/* Barcode field */}
            <div className="form-group">
              <label className="form-label">
                <Barcode size={13} style={{ display:'inline', marginRight:5, verticalAlign:'middle' }}/>
                Barcode / SKU
              </label>
              <div style={{ display:'flex', gap:8 }}>
                <input className="input" value={form.barcode??''} onChange={e => setForm({...form, barcode:e.target.value})}
                  placeholder="Scan, type, or auto-generate" style={{ flex:1, fontFamily:'monospace' }}/>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setForm(f => ({...f, barcode: generateProductBarcode(product?.id)}))} title="Auto-generate barcode">
                  ✨
                </button>
              </div>
            </div>

            {uploadProgress && (
              <div style={{ background:'rgba(59,127,255,0.08)', border:'1px solid rgba(59,127,255,0.2)', borderRadius:8, padding:'10px 14px', fontSize:'0.85rem', color:'var(--blue)', display:'flex', alignItems:'center', gap:8 }}>
                <span className="spinner" style={{ width:14, height:14, borderColor:'rgba(59,127,255,0.3)', borderTopColor:'var(--blue)' }}/> {uploadProgress}
              </div>
            )}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? <><span className="spinner"/> Saving...</> : (product?.id ? 'Update Product' : 'Add Product')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── RESTOCK MODAL ─────────────────────────────
function RestockModal({ product, onClose, onSave }) {
  const [qty, setQty] = useState('')
  const [loading, setLoading] = useState(false)
  const toast = useToast()

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!qty || parseInt(qty) <= 0) return
    setLoading(true)
    try {
      await restockProduct(product.id, parseInt(qty))
      toast(`✅ Added ${qty} units to ${product.name}`)
      onSave(); onClose()
    } catch (err) { toast(err.message, 'error') }
    finally { setLoading(false) }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target===e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth:360 }}>
        <div className="modal-header">
          <h2 className="modal-title">Restock — {product.name}</h2>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', fontSize:22, color:'#aaa' }}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div style={{ background:'var(--surface)', borderRadius:10, padding:'12px 16px', marginBottom:16, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span className="text-muted">Current stock</span>
              <strong style={{ fontFamily:'var(--font-display)', fontSize:'1.1rem' }}>{product.stock} units</strong>
            </div>
            <div className="form-group">
              <label className="form-label">Quantity to Add *</label>
              <input className="input" type="number" min="1" value={qty} onChange={e => setQty(e.target.value)} placeholder="e.g. 50" autoFocus required/>
            </div>
            {qty && parseInt(qty) > 0 && (
              <p style={{ color:'var(--green)', fontSize:'0.85rem', fontWeight:600 }}>
                New stock: {(Number(product.stock)||0) + parseInt(qty)} units
              </p>
            )}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-green" disabled={loading}>
              {loading ? <span className="spinner"/> : '+ Add Stock'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── IMAGE ZOOM MODAL ──────────────────────────
function ImageZoomModal({ product, onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose} style={{ alignItems:'center', justifyContent:'center' }}>
      <div style={{ maxWidth:600, width:'90%', position:'relative' }} onClick={e => e.stopPropagation()}>
        <img src={product.image_url} alt={product.name} style={{ width:'100%', borderRadius:16, display:'block', boxShadow:'0 20px 60px rgba(0,0,0,0.5)' }}/>
        <div style={{ position:'absolute', bottom:0, left:0, right:0, background:'linear-gradient(transparent, rgba(0,0,0,0.7))', borderRadius:'0 0 16px 16px', padding:'20px 16px 16px' }}>
          <div style={{ color:'white', fontWeight:700, fontSize:'1.05rem' }}>{product.name}</div>
          <div style={{ color:'rgba(255,255,255,0.7)', fontSize:'0.85rem' }}>₹{Number(product.price).toLocaleString('en-IN')}</div>
        </div>
        <button onClick={onClose} style={{ position:'absolute', top:10, right:10, width:32, height:32, borderRadius:99, background:'rgba(0,0,0,0.5)', border:'none', cursor:'pointer', color:'white', display:'flex', alignItems:'center', justifyContent:'center' }}>
          <X size={16}/>
        </button>
      </div>
    </div>
  )
}

// ── BARCODE SCANNER HOOK ──────────────────────
// Listens for hardware USB/Bluetooth barcode scanner input
function useHardwareScanner(onScanned, enabled = true) {
  const bufferRef = useRef('')
  const timerRef = useRef(null)

  useEffect(() => {
    if (!enabled) return
    const handleKeyDown = (e) => {
      // Barcode scanners send characters very rapidly then Enter
      if (e.key === 'Enter') {
        if (bufferRef.current.length >= 3) {
          onScanned(bufferRef.current)
        }
        bufferRef.current = ''
        if (timerRef.current) clearTimeout(timerRef.current)
        return
      }
      // Ignore modifier keys, function keys, etc.
      if (e.key.length === 1) {
        bufferRef.current += e.key
        // Reset buffer if user types slowly (> 100ms between chars = human typing)
        if (timerRef.current) clearTimeout(timerRef.current)
        timerRef.current = setTimeout(() => { bufferRef.current = '' }, 100)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => { window.removeEventListener('keydown', handleKeyDown); if (timerRef.current) clearTimeout(timerRef.current) }
  }, [onScanned, enabled])
}

// ── MAIN PRODUCTS PAGE ────────────────────────
export default function Products() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [restockModal, setRestockModal] = useState(null)
  const [barcodeModal, setBarcodeModal] = useState(null)
  const [zoomModal, setZoomModal] = useState(null)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [error, setError] = useState('')
  const [scannerActive, setScannerActive] = useState(true)
  const [lastScanned, setLastScanned] = useState('')
  const toast = useToast()

  const load = async () => {
    setLoading(true); setError('')
    try { setProducts(await getProducts()) }
    catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  // Hardware scanner: find product and highlight it
  const handleHardwareScan = useCallback((code) => {
    setLastScanned(code)
    setSearch(code)
    const match = products.find(p => p.barcode === code)
    if (match) {
      toast(`📦 Found: ${match.name}`, 'success')
      setSearch(match.name)
    } else {
      toast(`🔍 Scanned: ${code} — no product matched`, 'error')
    }
    setTimeout(() => setLastScanned(''), 3000)
  }, [products])

  useHardwareScanner(handleHardwareScan, scannerActive)

  const handleDelete = async (id, name) => {
    if (!confirm(`Delete "${name}"?`)) return
    const product = products.find(p => p.id === id)
    try {
      if (product?.image_url) await deleteProductImage(product.image_url).catch(() => {})
      await deleteProduct(id); toast('Product deleted'); load()
    } catch (err) { toast(err.message, 'error') }
  }

  const handleBarcodeGenerated = async (productId, newBarcode) => {
    try { await updateProduct(productId, { ...products.find(p => p.id === productId), barcode: newBarcode }); load() }
    catch (err) { toast(err.message, 'error') }
  }

  const lowStockProducts = products.filter(p => Number(p.stock) >= 0 && Number(p.stock) < (Number(p.low_stock_threshold)||10))

  const filtered = products.filter(p => {
    const s = search.toLowerCase()
    const matchSearch = p.name.toLowerCase().includes(s) || (p.category||'').toLowerCase().includes(s) || (p.barcode||'').includes(search)
    const matchFilter = filter === 'all' || (filter === 'low_stock' && Number(p.stock) < (Number(p.low_stock_threshold)||10))
    return matchSearch && matchFilter
  })

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Products</h1>
        <div className="flex gap-3 items-center">
          {/* Scanner status indicator */}
          <button onClick={() => setScannerActive(a => !a)} title={scannerActive ? 'Scanner active — click to pause' : 'Scanner paused — click to activate'}
            style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 12px', borderRadius:8, border:`1.5px solid ${scannerActive ? 'rgba(0,194,124,0.3)' : 'var(--border)'}`, background: scannerActive ? 'rgba(0,194,124,0.08)' : 'var(--white)', cursor:'pointer', fontSize:'0.78rem', fontWeight:600, color: scannerActive ? 'var(--green)' : '#888' }}>
            <div style={{ width:8, height:8, borderRadius:99, background: scannerActive ? 'var(--green)' : '#ccc', animation: scannerActive ? 'pulse 2s infinite' : 'none' }}/>
            Scanner {scannerActive ? 'Active' : 'Paused'}
          </button>
          <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}`}</style>

          <div className="search-input-wrap">
            <Barcode size={15}/>
            <input className="input" placeholder="Search or scan barcode..." value={search} onChange={e => setSearch(e.target.value)} style={{ width:240 }}/>
            {search && <button onClick={() => setSearch('')} style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'#aaa' }}><X size={13}/></button>}
          </div>
          <button className="btn btn-primary" onClick={() => setModal({})}><Plus size={16}/> Add Product</button>
        </div>
      </div>

      {/* Last scanned banner */}
      {lastScanned && (
        <div style={{ background:'rgba(0,194,124,0.1)', border:'1px solid rgba(0,194,124,0.25)', padding:'10px 32px', display:'flex', alignItems:'center', gap:10, fontSize:'0.88rem', color:'var(--green)' }}>
          <Barcode size={16}/> <strong>Scanned:</strong> {lastScanned}
        </div>
      )}

      <div className="page-body">
        {/* Stats row */}
        <div style={{ display:'flex', gap:10, marginBottom:20, flexWrap:'wrap', alignItems:'center' }}>
          <div style={{ background:'rgba(255,92,40,0.08)', border:'1px solid rgba(255,92,40,0.15)', borderRadius:10, padding:'10px 18px' }}>
            <span style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:'1.2rem', color:'var(--accent)' }}>{products.length}</span>
            <span style={{ fontSize:'0.78rem', color:'#888', marginLeft:8 }}>Products</span>
          </div>
          <div style={{ background:'rgba(59,127,255,0.08)', border:'1px solid rgba(59,127,255,0.15)', borderRadius:10, padding:'10px 18px' }}>
            <span style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:'1.2rem', color:'var(--blue)' }}>{products.filter(p => p.image_url).length}</span>
            <span style={{ fontSize:'0.78rem', color:'#888', marginLeft:8 }}>With Images</span>
          </div>
          {lowStockProducts.length > 0 && (
            <div onClick={() => setFilter(f => f==='low_stock'?'all':'low_stock')} style={{ background: filter==='low_stock' ? 'rgba(255,149,0,0.15)' : 'rgba(255,149,0,0.06)', border:`1.5px solid ${filter==='low_stock'?'var(--orange)':'rgba(255,149,0,0.2)'}`, borderRadius:10, padding:'10px 18px', cursor:'pointer' }}>
              <AlertTriangle size={13} style={{ display:'inline', marginRight:5, color:'var(--orange)', verticalAlign:'middle' }}/>
              <span style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:'1.2rem', color:'var(--orange)' }}>{lowStockProducts.length}</span>
              <span style={{ fontSize:'0.78rem', color:'var(--orange)', marginLeft:6 }}>Low Stock {filter==='low_stock'?'✓':''}</span>
            </div>
          )}
          <button className="btn btn-ghost btn-sm" style={{ marginLeft:'auto' }} onClick={load}><RefreshCw size={13}/> Refresh</button>
        </div>

        {error && <div style={{ background:'rgba(255,59,92,0.08)', border:'1px solid rgba(255,59,92,0.2)', borderRadius:10, padding:'12px 16px', marginBottom:16, color:'var(--red)' }}>⚠️ {error}</div>}

        {loading ? (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))', gap:14 }}>
            {Array(6).fill(0).map((_,i) => <div key={i} style={{ background:'var(--white)', borderRadius:'var(--radius)', border:'1px solid var(--border)', height:280, opacity:0.3 }}/>)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <Package size={52} style={{ color:'#ddd', marginBottom:12 }}/>
            <h3>No products found</h3>
            <p>{search ? 'No products match that search' : 'Click "Add Product" to get started'}</p>
          </div>
        ) : (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))', gap:14 }}>
            {filtered.map(p => {
              const isLow = Number(p.stock) < (Number(p.low_stock_threshold)||10)
              const outOfStock = Number(p.stock) <= 0
              const profit = Number(p.price) - Number(p.cost_price||0)
              return (
                <div key={p.id} className="card" style={{ borderColor: isLow ? 'rgba(255,149,0,0.35)' : 'var(--border)', borderWidth: isLow ? 2 : 1, overflow:'hidden' }}>
                  {/* Product image */}
                  <div style={{ height:150, background: p.image_url ? 'transparent' : 'var(--surface)', position:'relative', overflow:'hidden', cursor: p.image_url ? 'zoom-in' : 'default' }}
                    onClick={() => p.image_url && setZoomModal(p)}>
                    {p.image_url ? (
                      <img src={p.image_url} alt={p.name} style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
                    ) : (
                      <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:8, color:'#ccc' }}>
                        <Package size={36}/>
                        <span style={{ fontSize:'0.75rem' }}>No image</span>
                      </div>
                    )}
                    {p.image_url && <div style={{ position:'absolute', top:6, right:6, background:'rgba(0,0,0,0.4)', borderRadius:6, padding:'3px 6px' }}><ZoomIn size={13} style={{ color:'white' }}/></div>}
                    {isLow && (
                      <div style={{ position:'absolute', top:6, left:6, background: outOfStock ? 'var(--red)' : 'var(--orange)', borderRadius:6, padding:'3px 8px', fontSize:'0.68rem', fontWeight:700, color:'white' }}>
                        {outOfStock ? 'OUT OF STOCK' : '⚠️ LOW'}
                      </div>
                    )}
                  </div>

                  {/* Product info */}
                  <div style={{ padding:'12px 14px' }}>
                    <div style={{ fontWeight:700, fontSize:'0.92rem', marginBottom:4, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{p.name}</div>
                    <div style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:'1.05rem', color:'var(--accent)', marginBottom:4 }}>
                      ₹{Number(p.price).toLocaleString('en-IN')}
                      {p.unit && <span style={{ fontFamily:'var(--font-body)', fontSize:'0.72rem', color:'#aaa', fontWeight:400 }}> / {p.unit}</span>}
                    </div>
                    {Number(p.cost_price) > 0 && <div style={{ fontSize:'0.75rem', color:'var(--green)', fontWeight:600, marginBottom:4 }}>Profit: ₹{profit.toFixed(2)}</div>}
                    <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:10 }}>
                      {p.category && <span className="badge badge-gray">{p.category}</span>}
                      <span className={`badge ${outOfStock ? 'badge-red' : isLow ? 'badge-orange' : 'badge-green'}`}>
                        {outOfStock ? 'Out of stock' : `Stock: ${p.stock}`}
                      </span>
                    </div>
                    {p.barcode && (
                      <div style={{ fontSize:'0.7rem', color:'#bbb', fontFamily:'monospace', background:'var(--surface)', borderRadius:5, padding:'3px 6px', marginBottom:10, overflow:'hidden', textOverflow:'ellipsis' }}>
                        {p.barcode}
                      </div>
                    )}

                    {/* Action buttons */}
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
                      <button className="btn btn-ghost btn-sm" style={{ color:'var(--green)', borderColor:'rgba(0,194,124,0.25)' }} onClick={() => setRestockModal(p)}>+ Stock</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => setBarcodeModal(p)}><Barcode size={13}/> Barcode</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => setModal(p)}><Edit2 size={13}/> Edit</button>
                      <button className="btn btn-ghost btn-sm" style={{ color:'var(--red)' }} onClick={() => handleDelete(p.id, p.name)}><Trash2 size={13}/> Delete</button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {modal !== null && <ProductModal product={modal} onClose={() => setModal(null)} onSave={load}/>}
      {restockModal && <RestockModal product={restockModal} onClose={() => setRestockModal(null)} onSave={load}/>}
      {barcodeModal && <BarcodeModal product={barcodeModal} onClose={() => setBarcodeModal(null)} onBarcodeGenerated={(code) => handleBarcodeGenerated(barcodeModal.id, code)}/>}
      {zoomModal && <ImageZoomModal product={zoomModal} onClose={() => setZoomModal(null)}/>}
    </div>
  )
}
