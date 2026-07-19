-- ============================================================
-- 009 — Hutang / Piutang (debts)
-- ============================================================
-- Mencatat uang yang keluarga PINJAM dari orang lain (hutang / payable)
-- maupun uang yang keluarga PINJAMKAN ke orang lain (piutang / receivable).
-- Tenant-scoped + RLS via helper my_tenant_ids() (anti-recursion, SECURITY DEFINER).
--
-- direction    : 'payable'    = hutang  (kita berutang, harus bayar)
--                'receivable' = piutang (orang berutang ke kita, akan diterima)
-- person_name  : nama pihak (yang kita utangi / yang berutang ke kita)
-- amount       : nominal pokok total
-- paid_amount  : akumulasi cicilan yang sudah dibayar / diterima
--                (lunas saat paid_amount >= amount)
-- due_date     : jatuh tempo (opsional)
-- settled_at   : penanda waktu lunas (NULL = belum lunas)
-- ============================================================

CREATE TABLE IF NOT EXISTS debts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  recorded_by  UUID REFERENCES auth.users(id),
  direction    TEXT NOT NULL CHECK (direction IN ('payable', 'receivable')),
  person_name  TEXT NOT NULL,
  amount       BIGINT NOT NULL CHECK (amount > 0),
  paid_amount  BIGINT NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
  due_date     DATE,
  note         TEXT,
  settled_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_debts_tenant           ON debts (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_debts_tenant_direction ON debts (tenant_id, direction);
CREATE INDEX IF NOT EXISTS idx_debts_tenant_due       ON debts (tenant_id, due_date);

ALTER TABLE debts ENABLE ROW LEVEL SECURITY;

-- Isolasi tenant: pola identik dengan transactions/savings_goals (my_tenant_ids SECURITY DEFINER).
CREATE POLICY "tenant isolation on debts" ON debts
  FOR ALL USING (tenant_id IN (SELECT my_tenant_ids()));
