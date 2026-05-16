-- ============================================
-- Run this in Supabase SQL Editor
-- Sets up product image storage + image_url column
-- ============================================

-- 1. Add image_url column to products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url TEXT;

-- 2. Create storage bucket for product images
-- Go to Supabase Dashboard → Storage → New Bucket
-- Name: product-images
-- Public: YES (toggle on)
-- Then run the policies below:

INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Storage policies - allow all operations
CREATE POLICY "Public read product images"
ON storage.objects FOR SELECT
USING (bucket_id = 'product-images');

CREATE POLICY "Authenticated upload product images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'product-images');

CREATE POLICY "Authenticated update product images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'product-images');

CREATE POLICY "Authenticated delete product images"
ON storage.objects FOR DELETE
USING (bucket_id = 'product-images');

-- ============================================
-- DONE! Product images are ready.
-- ============================================
