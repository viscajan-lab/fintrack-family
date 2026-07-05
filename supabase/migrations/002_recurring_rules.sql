-- ============================================================
-- MIGRATION: recurring_rules — tagihan/langganan berulang
-- Aman dijalankan berkali-kali (idempoten). Jalankan di Supabase SQL editor.
-- ============================================================

CREATE TABLE IF NOT EXISTS recurring_rules (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  created_by    BIGINT,                                    -- telegram_id pembuat (buat notif)
  type          TEXT NOT NULL DEFAULT 'expense' CHECK (type IN ('income', 'expense')),
  amount        BIGINT NOT NULL CHECK (amount > 0),
  category_name TEXT NOT NULL,
  description   TEXT NOT NULL,
  day_of_month  SMALLINT NOT NULL CHECK (day_of_month BETWEEN 1 AND 31),
  mode          TEXT NOT NULL DEFAULT 'auto' CHECK (mode IN ('auto', 'reminder')),
  active        BOOLEAN NOT NULL DEFAULT true,
  last_run_date DATE,                                      -- tanggal terakhir dieksekusi (anti-dobel)
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index: scheduler query "rule aktif jatuh tempo hari X"
CREATE INDEX IF NOT EXISTS idx_recurring_due
  ON recurring_rules (active, day_of_month);
CREATE INDEX IF NOT EXISTS idx_recurring_tenant
  ON recurring_rules (tenant_id);

-- RLS: tenant isolation, sama polanya dgn transactions/budgets
ALTER TABLE recurring_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant isolation on recurring_rules" ON recurring_rules;
CREATE POLICY "tenant isolation on recurring_rules" ON recurring_rules
  FOR ALL USING (tenant_id IN (SELECT my_tenant_ids()));

-- Trigger auto-update updated_at (reuse set_updated_at() yg sudah ada)
DROP TRIGGER IF EXISTS trg_recurring_updated_at ON recurring_rules;
CREATE TRIGGER trg_recurring_updated_at
  BEFORE UPDATE ON recurring_rules
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
