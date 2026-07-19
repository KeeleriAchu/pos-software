-- ============================================
-- RUN THIS IN SUPABASE SQL EDITOR
-- New columns + tables for enhanced POS
-- ============================================

-- Add cost_price to products (for profit calculation)
ALTER TABLE products ADD COLUMN IF NOT EXISTS cost_price DECIMAL(10,2) DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS low_stock_threshold INT DEFAULT 10;
ALTER TABLE products ADD COLUMN IF NOT EXISTS unit TEXT;

-- Add customer_name to bills (for walk-in display)
ALTER TABLE bills ADD COLUMN IF NOT EXISTS customer_name TEXT;
ALTER TABLE bills ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE bills ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(10,2) DEFAULT 0;
ALTER TABLE bills ADD COLUMN IF NOT EXISTS is_pending_sale BOOLEAN DEFAULT FALSE;

-- Customer visits table (track daily visits)
CREATE TABLE IF NOT EXISTS customer_visits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID REFERENCES customers(id),
  customer_name TEXT,
  visit_date DATE DEFAULT CURRENT_DATE,
  bill_id UUID REFERENCES bills(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Audit log table
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  action TEXT NOT NULL,
  table_name TEXT,
  record_id TEXT,
  old_value JSONB,
  new_value JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- RLS for new tables
ALTER TABLE customer_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON customer_visits FOR ALL USING (true);
CREATE POLICY "Allow all" ON audit_log FOR ALL USING (true);

-- Auto-log visits when a bill is created
-- (handled in application code)

-- Update reminders_log to track sent_at properly
ALTER TABLE reminders_log ALTER COLUMN sent_at SET DEFAULT NOW();
