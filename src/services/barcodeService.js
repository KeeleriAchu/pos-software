// Barcode generation utilities using JsBarcode (loaded via CDN in index.html)
// Generates CODE128 barcodes for products

// Generate a unique barcode for a product if it doesn't have one
export const generateProductBarcode = (productId) => {
  // Use last 10 chars of UUID + timestamp suffix for uniqueness
  const id = productId?.replace(/-/g, '').slice(0, 8).toUpperCase() || ''
  const ts = Date.now().toString().slice(-4)
  return `POS${id}${ts}`
}

// Render barcode to a canvas element
export const renderBarcodeToCanvas = (canvas, value, options = {}) => {
  if (!window.JsBarcode) throw new Error('JsBarcode not loaded')
  window.JsBarcode(canvas, value, {
    format: 'CODE128',
    width: options.width || 2,
    height: options.height || 60,
    displayValue: options.displayValue !== false,
    fontSize: options.fontSize || 12,
    fontOptions: '',
    font: 'monospace',
    textAlign: 'center',
    textPosition: 'bottom',
    textMargin: 4,
    background: '#ffffff',
    lineColor: '#000000',
    margin: 8,
    ...options,
  })
}

// Generate barcode as a PNG data URL
export const barcodeToPng = (value, options = {}) => {
  const canvas = document.createElement('canvas')
  renderBarcodeToCanvas(canvas, value, options)
  return canvas.toDataURL('image/png')
}

// Print barcode labels for a list of products
export const printBarcodeLabels = (products, labelsPerRow = 3) => {
  const labelHtml = products.map(p => {
    const barcodeId = `bc_${p.id?.replace(/-/g,'').slice(0,8) || Math.random().toString(36).slice(2)}`
    return `
      <div class="label">
        <div class="product-name">${p.name}</div>
        <div class="product-price">₹${Number(p.price).toLocaleString('en-IN')}</div>
        <svg id="${barcodeId}"></svg>
        <div class="barcode-text">${p.barcode}</div>
      </div>
    `
  }).join('')

  const win = window.open('', '_blank')
  win.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Product Barcode Labels</title>
      <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"><\/script>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: monospace; background: white; }
        .page { padding: 10mm; }
        .grid { display: grid; grid-template-columns: repeat(${labelsPerRow}, 1fr); gap: 4mm; }
        .label {
          border: 1px dashed #ccc;
          border-radius: 4px;
          padding: 4mm 3mm;
          text-align: center;
          page-break-inside: avoid;
          break-inside: avoid;
        }
        .product-name { font-size: 10px; font-weight: bold; margin-bottom: 2mm; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-family: sans-serif; }
        .product-price { font-size: 13px; font-weight: bold; margin-bottom: 2mm; font-family: sans-serif; color: #333; }
        .barcode-text { font-size: 8px; color: #666; margin-top: 1mm; letter-spacing: 1px; }
        svg { width: 100%; height: auto; max-height: 14mm; }
        @media print {
          body { margin: 0; }
          .no-print { display: none; }
          @page { margin: 5mm; size: A4; }
        }
      </style>
    </head>
    <body>
      <div class="no-print" style="padding:10px;background:#f5f5f5;margin-bottom:10px;font-family:sans-serif;font-size:13px">
        <button onclick="window.print()" style="padding:8px 20px;background:#ff5c28;color:white;border:none;border-radius:6px;cursor:pointer;font-size:14px;font-weight:600">🖨️ Print Labels</button>
        <span style="margin-left:12px;color:#888">${products.length} label(s) · ${labelsPerRow} per row</span>
      </div>
      <div class="page">
        <div class="grid">${labelHtml}</div>
      </div>
      <script>
        window.onload = function() {
          ${products.map(p => `
            try {
              const barcodeId = 'bc_${p.id?.replace(/-/g,'').slice(0,8) || ''}';
              JsBarcode('#' + barcodeId, '${p.barcode}', {
                format: 'CODE128', width: 1.5, height: 40, displayValue: false,
                background: '#ffffff', lineColor: '#000000', margin: 2
              });
            } catch(e) { console.error(e); }
          `).join('')}
        }
      <\/script>
    </body>
    </html>
  `)
  win.document.close()
}
