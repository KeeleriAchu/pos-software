import { supabase } from './supabase'

const BUCKET = 'product-images'

// Upload image file to Supabase Storage, return public URL
export const uploadProductImage = async (file, productId) => {
  const ext = file.name.split('.').pop() || 'jpg'
  const path = `products/${productId || Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: true,
    contentType: file.type,
  })
  if (error) throw new Error(`Upload failed: ${error.message}`)

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return data.publicUrl
}

// Delete old image when replacing
export const deleteProductImage = async (url) => {
  if (!url) return
  const path = url.split('/product-images/')[1]
  if (!path) return
  await supabase.storage.from(BUCKET).remove([path])
}

// Compress + resize image before upload (keeps file small)
export const compressImage = (file, maxWidth = 600) =>
  new Promise((resolve) => {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const ratio = Math.min(maxWidth / img.width, maxWidth / img.height, 1)
      canvas.width = img.width * ratio
      canvas.height = img.height * ratio
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      canvas.toBlob(blob => resolve(new File([blob], file.name, { type: 'image/jpeg' })), 'image/jpeg', 0.82)
    }
    img.src = url
  })

// Capture photo from camera stream into a File
export const captureFromVideo = (videoEl) =>
  new Promise((resolve) => {
    const canvas = document.createElement('canvas')
    canvas.width = videoEl.videoWidth
    canvas.height = videoEl.videoHeight
    canvas.getContext('2d').drawImage(videoEl, 0, 0)
    canvas.toBlob(blob => resolve(new File([blob], `photo_${Date.now()}.jpg`, { type: 'image/jpeg' })), 'image/jpeg', 0.9)
  })
