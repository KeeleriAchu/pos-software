-- ============================================
-- POS MANAGER — SECURITY & BACKUP SQL
-- Run this in Supabase SQL Editor
-- ============================================

-- ── 1. ROW LEVEL SECURITY (RLS) ──────────────
-- Only authenticated users can access data

-- Enable RLS on all tables
ALTER TABLE customers         ENABLE ROW LEVEL SECURITY;
ALTER TABLE products          ENABLE ROW LEVEL SECURITY;
ALTER TABLE bills             ENABLE ROW LEVEL SECURITY;
ALTER TABLE bill_items        ENABLE ROW LEVEL SECURITY;
ALTER TABLE pending_payments  ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_history   ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminders_log     ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_visits   ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log         ENABLE ROW LEVEL SECURITY;

-- Drop old "allow all" policies
DROP POLICY IF EXISTS "Allow all" ON customers;
DROP POLICY IF EXISTS "Allow all" ON products;
DROP POLICY IF EXISTS "Allow all" ON bills;
DROP POLICY IF EXISTS "Allow all" ON bill_items;
DROP POLICY IF EXISTS "Allow all" ON pending_payments;
DROP POLICY IF EXISTS "Allow all" ON payment_history;
DROP POLICY IF EXISTS "Allow all" ON reminders_log;

-- Create auth-required policies (must be logged in)
CREATE POLICY "auth_read_customers"   ON customers         FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth_write_customers"  ON customers         FOR ALL    USING (auth.role() = 'authenticated');
CREATE POLICY "auth_read_products"    ON products          FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth_write_products"   ON products          FOR ALL    USING (auth.role() = 'authenticated');
CREATE POLICY "auth_read_bills"       ON bills             FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth_write_bills"      ON bills             FOR ALL    USING (auth.role() = 'authenticated');
CREATE POLICY "auth_read_items"       ON bill_items        FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth_write_items"      ON bill_items        FOR ALL    USING (auth.role() = 'authenticated');
CREATE POLICY "auth_read_pending"     ON pending_payments  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth_write_pending"    ON pending_payments  FOR ALL    USING (auth.role() = 'authenticated');
CREATE POLICY "auth_read_payments"    ON payment_history   FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth_write_payments"   ON payment_history   FOR ALL    USING (auth.role() = 'authenticated');
CREATE POLICY "auth_read_reminders"   ON reminders_log     FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth_write_reminders"  ON reminders_log     FOR ALL    USING (auth.role() = 'authenticated');
CREATE POLICY "auth_read_visits"      ON customer_visits   FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth_write_visits"     ON customer_visits   FOR ALL    USING (auth.role() = 'authenticated');
CREATE POLICY "auth_read_audit"       ON audit_log         FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth_write_audit"      ON audit_log         FOR ALL    USING (auth.role() = 'authenticated');

-- ── 2. AUDIT TRIGGER ────────────────────────
-- Auto-logs every INSERT/UPDATE/DELETE to audit_log

CREATE TABLE IF NOT EXISTS audit_log (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  table_name  TEXT NOT NULL,
  action      TEXT NOT NULL,  -- INSERT, UPDATE, DELETE
  record_id   TEXT,
  old_data    JSONB,
  new_data    JSONB,
  changed_by  UUID,           -- auth.uid() of the user
  changed_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION audit_trigger_fn()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_log (table_name, action, record_id, old_data, new_data, changed_by)
  VALUES (
    TG_TABLE_NAME,
    TG_OP,
    COALESCE(NEW.id::TEXT, OLD.id::TEXT),
    CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN row_to_json(OLD)::JSONB ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN row_to_json(NEW)::JSONB ELSE NULL END,
    auth.uid()
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach audit trigger to critical tables
DROP TRIGGER IF EXISTS audit_customers        ON customers;
DROP TRIGGER IF EXISTS audit_products         ON products;
DROP TRIGGER IF EXISTS audit_bills            ON bills;
DROP TRIGGER IF EXISTS audit_pending_payments ON pending_payments;

CREATE TRIGGER audit_customers        AFTER INSERT OR UPDATE OR DELETE ON customers        FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn();
CREATE TRIGGER audit_products         AFTER INSERT OR UPDATE OR DELETE ON products         FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn();
CREATE TRIGGER audit_bills            AFTER INSERT OR UPDATE OR DELETE ON bills            FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn();
CREATE TRIGGER audit_pending_payments AFTER INSERT OR UPDATE OR DELETE ON pending_payments FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn();

-- ── 3. INPUT VALIDATION CONSTRAINTS ─────────
-- Database-level validation (second line of defense after app validation)

ALTER TABLE customers
  ADD CONSTRAINT customer_phone_format CHECK (phone ~ '^[0-9]{10,15}$'),
  ADD CONSTRAINT customer_name_length  CHECK (length(name) BETWEEN 1 AND 100),
  ADD CONSTRAINT customer_email_format CHECK (email IS NULL OR email ~* '^[^@]+@[^@]+\.[^@]+$');

ALTER TABLE products
  ADD CONSTRAINT product_price_positive    CHECK (price >= 0),
  ADD CONSTRAINT product_cost_positive     CHECK (cost_price IS NULL OR cost_price >= 0),
  ADD CONSTRAINT product_stock_nonneg      CHECK (stock >= 0),
  ADD CONSTRAINT product_name_length       CHECK (length(name) BETWEEN 1 AND 150),
  ADD CONSTRAINT product_threshold_valid   CHECK (low_stock_threshold IS NULL OR low_stock_threshold > 0);

ALTER TABLE bills
  ADD CONSTRAINT bill_total_positive       CHECK (total_amount > 0),
  ADD CONSTRAINT bill_paid_nonneg          CHECK (paid_amount >= 0),
  ADD CONSTRAINT bill_paid_lte_total       CHECK (paid_amount <= total_amount * 1.01),
  ADD CONSTRAINT bill_method_valid         CHECK (payment_method IN ('cash','upi','card')),
  ADD CONSTRAINT bill_status_valid         CHECK (payment_status IN ('paid','partial','pending','unpaid'));

ALTER TABLE pending_payments
  ADD CONSTRAINT pending_due_positive      CHECK (amount_due > 0),
  ADD CONSTRAINT pending_paid_nonneg       CHECK (amount_paid >= 0),
  ADD CONSTRAINT pending_paid_lte_due      CHECK (amount_paid <= amount_due),
  ADD CONSTRAINT pending_status_valid      CHECK (status IN ('unpaid','partial','paid'));

-- ── 4. PERFORMANCE INDEXES ───────────────────
CREATE INDEX IF NOT EXISTS idx_bills_created_at         ON bills(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bills_customer_id        ON bills(customer_id);
CREATE INDEX IF NOT EXISTS idx_bills_status             ON bills(payment_status);
CREATE INDEX IF NOT EXISTS idx_bill_items_bill_id       ON bill_items(bill_id);
CREATE INDEX IF NOT EXISTS idx_pending_customer_id      ON pending_payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_pending_status           ON pending_payments(status);
CREATE INDEX IF NOT EXISTS idx_customers_phone          ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_products_barcode         ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_products_category        ON products(category);
CREATE INDEX IF NOT EXISTS idx_audit_table_action       ON audit_log(table_name, action);
CREATE INDEX IF NOT EXISTS idx_audit_changed_at         ON audit_log(changed_at DESC);

-- ── 5. BACKUP VIEW ───────────────────────────
-- Easy snapshot view for quick exports

CREATE OR REPLACE VIEW v_bills_summary AS
SELECT
  b.id, b.bill_number, b.created_at,
  c.name AS customer_name, c.phone AS customer_phone,
  b.total_amount, b.paid_amount, b.pending_amount,
  b.payment_status, b.payment_method, b.discount_amount,
  COUNT(bi.id) AS item_count
FROM bills b
LEFT JOIN customers c ON b.customer_id = c.id
LEFT JOIN bill_items bi ON bi.bill_id = b.id
GROUP BY b.id, c.name, c.phone;

CREATE OR REPLACE VIEW v_pending_summary AS
SELECT
  pp.id, pp.created_at,
  c.name AS customer_name, c.phone AS customer_phone,
  b.bill_number, pp.amount_due, pp.amount_paid,
  pp.amount_due - pp.amount_paid AS balance,
  pp.status, pp.last_reminder_at
FROM pending_payments pp
JOIN customers c ON pp.customer_id = c.id
LEFT JOIN bills b ON pp.bill_id = b.id
WHERE pp.status != 'paid';

CREATE OR REPLACE VIEW v_product_sales AS
SELECT
  bi.product_name,
  SUM(bi.quantity) AS total_sold,
  SUM(bi.total_price) AS total_revenue,
  COUNT(DISTINCT bi.bill_id) AS num_bills,
  p.price, p.cost_price, p.stock
FROM bill_items bi
LEFT JOIN products p ON p.name = bi.product_name
GROUP BY bi.product_name, p.price, p.cost_price, p.stock
ORDER BY total_sold DESC;

-- ── 6. DAILY BACKUP FUNCTION ─────────────────
-- Supabase scheduled function for cloud-side backup
-- Enable in Supabase Dashboard → Edge Functions → Schedule

CREATE OR REPLACE FUNCTION create_backup_snapshot()
RETURNS JSONB AS $$
DECLARE
  snap JSONB;
BEGIN
  snap := jsonb_build_object(
    'timestamp', NOW()::TEXT,
    'customer_count', (SELECT COUNT(*) FROM customers),
    'product_count', (SELECT COUNT(*) FROM products),
    'bill_count', (SELECT COUNT(*) FROM bills),
    'total_revenue', (SELECT COALESCE(SUM(paid_amount),0) FROM bills),
    'pending_total', (SELECT COALESCE(SUM(amount_due - amount_paid),0) FROM pending_payments WHERE status != 'paid')
  );
  -- Store snapshot in audit_log as a BACKUP record
  INSERT INTO audit_log (table_name, action, new_data)
  VALUES ('_system', 'BACKUP_SNAPSHOT', snap);
  RETURN snap;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- DONE! Security and backup configured.
-- ============================================
