-- ============================================================================
-- FinTrack Family — MIGRATION SIAP-PASTE: recurring_rules
-- ============================================================================
-- CARA PAKAI:
--   1. Buka Supabase Dashboard project ukjykxndgefebvjbcycl
--   2. Menu kiri: SQL Editor  ->  + New query
--   3. Paste SELURUH isi file ini  ->  klik "Run" (atau Ctrl/Cmd + Enter)
--   4. Lihat hasil query verifikasi di bagian bawah (harus muncul 1 baris tabel
--      + 1 baris policy). Kalau muncul, migration SUKSES.
--
-- AMAN diulang: semua statement idempoten (IF NOT EXISTS / DROP..CREATE).
-- Menjalankan 2x tidak merusak data / tidak menduplikasi apa pun.
-- Prasyarat (sudah ada di schema): tabel tenants, fungsi my_tenant_ids(),
--   fungsi set_updated_at().
-- ============================================================================

-- ── 1. TABEL ────────────────────────────────────────────────────────────────
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

-- ── 2. INDEX ────────────────────────────────────────────────────────────────
-- scheduler query "rule aktif jatuh tempo hari X"
CREATE INDEX IF NOT EXISTS idx_recurring_due
  ON recurring_rules (active, day_of_month);
CREATE INDEX IF NOT EXISTS idx_recurring_tenant
  ON recurring_rules (tenant_id);

-- ── 3. RLS (tenant isolation, sama polanya dgn transactions/budgets) ─────────
ALTER TABLE recurring_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant isolation on recurring_rules" ON recurring_rules;
CREATE POLICY "tenant isolation on recurring_rules" ON recurring_rules
  FOR ALL USING (tenant_id IN (SELECT my_tenant_ids()));

-- ── 4. TRIGGER auto-update updated_at (reuse set_updated_at() yg sudah ada) ──
DROP TRIGGER IF EXISTS trg_recurring_updated_at ON recurring_rules;
CREATE TRIGGER trg_recurring_updated_at
  BEFORE UPDATE ON recurring_rules
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- VERIFIKASI — hasil kedua query di bawah harus tampil setelah Run:
-- ============================================================================

-- (a) Tabel + RLS aktif? Harus 1 baris, rowsecurity = true
SELECT tablename, rowsecurity
FROM   pg_tables
WHERE  tablename = 'recurring_rules';

-- (b) Policy terpasang? Harus 1 baris "tenant isolation on recurring_rules"
SELECT policyname, cmd
FROM   pg_policies
WHERE  tablename = 'recurring_rules';
