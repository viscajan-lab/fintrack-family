-- ============================================================
-- FinTrack Family — Database Schema
-- PostgreSQL 15 / Supabase
-- Multi-tenant: isolasi via tenant_id + Row Level Security
-- ============================================================

-- Enable UUID generator
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- 1. TENANTS — satu workspace per keluarga
-- ============================================================
CREATE TABLE tenants (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,                        -- "Keluarga Ardi"
  slug        TEXT UNIQUE NOT NULL,                 -- "keluarga-ardi"
  plan         TEXT NOT NULL DEFAULT 'free',         -- 'free' | 'family' | 'self_hosted'
  storage_type TEXT NOT NULL DEFAULT 'supabase',     -- 'supabase' | 'sheets'
  -- Google Sheets credentials (NULL jika storage_type = 'supabase')
  sheets_spreadsheet_id  TEXT,
  sheets_access_token    TEXT,
  sheets_refresh_token   TEXT,
  sheets_token_expiry    TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT valid_storage_type CHECK (storage_type IN ('supabase', 'sheets'))
);

-- ============================================================
-- 2. TENANT MEMBERS — user bisa masuk ke beberapa tenant
-- ============================================================
CREATE TABLE tenant_members (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role          TEXT NOT NULL DEFAULT 'member',     -- 'admin' | 'member'
  display_name  TEXT,                               -- nama panggilan di dalam keluarga
  telegram_id   BIGINT UNIQUE,                      -- link ke akun Telegram
  joined_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, user_id)
);

-- ============================================================
-- 3. CATEGORIES — kategori default + custom per tenant
-- ============================================================
CREATE TABLE categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID REFERENCES tenants(id) ON DELETE CASCADE, -- NULL = kategori global/default
  name        TEXT NOT NULL,
  emoji       TEXT NOT NULL DEFAULT '💰',
  type        TEXT NOT NULL DEFAULT 'both',         -- 'income' | 'expense' | 'both'
  sort_order  INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Data default (tenant_id NULL = berlaku global untuk semua)
INSERT INTO categories (tenant_id, name, emoji, type, sort_order) VALUES
  (NULL, 'Makanan & Minuman',   '🍽',  'expense', 1),
  (NULL, 'Transportasi',        '⛽',  'expense', 2),
  (NULL, 'Rumah & Tagihan',     '🏠',  'expense', 3),
  (NULL, 'Belanja',             '🛒',  'expense', 4),
  (NULL, 'Kesehatan',           '💊',  'expense', 5),
  (NULL, 'Pendidikan',          '🎓',  'expense', 6),
  (NULL, 'Hiburan',             '🎮',  'expense', 7),
  (NULL, 'Gaji',                '💼',  'income',  8),
  (NULL, 'Usaha / Freelance',   '💰',  'income',  9),
  (NULL, 'Transfer Masuk',      '📲',  'income',  10),
  (NULL, 'Lainnya',             '🎁',  'both',    99);

-- ============================================================
-- 4. TRANSACTIONS — inti: semua transaksi keuangan
-- ============================================================
CREATE TABLE transactions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  recorded_by      UUID NOT NULL REFERENCES auth.users(id),
  type             TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  amount           BIGINT NOT NULL CHECK (amount > 0),  -- dalam rupiah, integer (hindari float)
  description      TEXT NOT NULL,
  category_id      UUID REFERENCES categories(id),
  category_name    TEXT,                                -- cache nama kategori (denormalized)
  source           TEXT NOT NULL DEFAULT 'bot' CHECK (source IN ('bot', 'web', 'import')),
  notes            TEXT,
  receipt_url      TEXT,                               -- URL foto struk di Supabase Storage
  transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index untuk query umum (filter by tenant + date range)
CREATE INDEX idx_transactions_tenant_date ON transactions (tenant_id, transaction_date DESC);
CREATE INDEX idx_transactions_tenant_type ON transactions (tenant_id, type);
CREATE INDEX idx_transactions_recorded_by ON transactions (recorded_by);

-- ============================================================
-- 5. BUDGETS — budget bulanan per kategori per tenant
-- ============================================================
CREATE TABLE budgets (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  category_id   UUID REFERENCES categories(id),
  category_name TEXT NOT NULL,
  amount        BIGINT NOT NULL CHECK (amount > 0),
  month         SMALLINT NOT NULL CHECK (month BETWEEN 1 AND 12),
  year          SMALLINT NOT NULL CHECK (year >= 2020),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, category_name, month, year)
);

-- ============================================================
-- 6. BOT SESSIONS — state mesin percakapan Telegram (FSM)
-- ============================================================
CREATE TABLE bot_sessions (
  telegram_id   BIGINT PRIMARY KEY,
  tenant_id     UUID REFERENCES tenants(id) ON DELETE SET NULL,
  user_id       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  state         TEXT NOT NULL DEFAULT 'idle',       -- FSM state saat ini
  context       JSONB NOT NULL DEFAULT '{}',        -- data sementara percakapan
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 7. AUDIT LOG — opsional, catat semua perubahan penting
-- ============================================================
CREATE TABLE audit_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID REFERENCES tenants(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES auth.users(id),
  action      TEXT NOT NULL,                        -- 'create_transaction' | 'delete_transaction' | ...
  table_name  TEXT NOT NULL,
  record_id   UUID,
  old_data    JSONB,
  new_data    JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 8. ROW LEVEL SECURITY (RLS)
-- ============================================================

-- Aktifkan RLS di semua tabel sensitif
ALTER TABLE tenants          ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_members   ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories       ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets          ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs       ENABLE ROW LEVEL SECURITY;

-- Helper function: ambil tenant_id user yang sedang login
CREATE OR REPLACE FUNCTION my_tenant_ids()
RETURNS SETOF UUID
LANGUAGE SQL STABLE SECURITY DEFINER AS $$
  SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid();
$$;

-- ---- TENANTS ----
CREATE POLICY "user can view own tenants" ON tenants
  FOR SELECT USING (id IN (SELECT my_tenant_ids()));

-- ---- TENANT_MEMBERS ----
CREATE POLICY "user can view members of own tenant" ON tenant_members
  FOR SELECT USING (tenant_id IN (SELECT my_tenant_ids()));

CREATE POLICY "admin can manage members" ON tenant_members
  FOR ALL USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_members
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- ---- CATEGORIES ----
-- Global categories (tenant_id IS NULL) + kategori tenant sendiri
CREATE POLICY "user can view categories" ON categories
  FOR SELECT USING (
    tenant_id IS NULL
    OR tenant_id IN (SELECT my_tenant_ids())
  );

CREATE POLICY "admin can manage custom categories" ON categories
  FOR INSERT WITH CHECK (tenant_id IN (
    SELECT tenant_id FROM tenant_members
    WHERE user_id = auth.uid() AND role = 'admin'
  ));

-- ---- TRANSACTIONS ----
CREATE POLICY "tenant isolation on transactions" ON transactions
  FOR ALL USING (tenant_id IN (SELECT my_tenant_ids()));

-- ---- BUDGETS ----
CREATE POLICY "tenant isolation on budgets" ON budgets
  FOR ALL USING (tenant_id IN (SELECT my_tenant_ids()));

-- ---- AUDIT LOGS ----
CREATE POLICY "tenant isolation on audit_logs" ON audit_logs
  FOR SELECT USING (tenant_id IN (SELECT my_tenant_ids()));

-- ============================================================
-- 9. FUNGSI & TRIGGER UTILITAS
-- ============================================================

-- Auto-update kolom updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_tenants_updated_at
  BEFORE UPDATE ON tenants
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_transactions_updated_at
  BEFORE UPDATE ON transactions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_budgets_updated_at
  BEFORE UPDATE ON budgets
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- 10. VIEW BERGUNA (opsional, mempermudah query di dashboard)
-- ============================================================

-- Ringkasan per bulan per tenant
CREATE VIEW v_monthly_summary AS
SELECT
  tenant_id,
  DATE_TRUNC('month', transaction_date) AS month,
  SUM(CASE WHEN type = 'income'  THEN amount ELSE 0 END) AS total_income,
  SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) AS total_expense,
  SUM(CASE WHEN type = 'income'  THEN amount
           WHEN type = 'expense' THEN -amount ELSE 0 END) AS net_savings,
  COUNT(*) AS transaction_count
FROM transactions
GROUP BY tenant_id, DATE_TRUNC('month', transaction_date);

-- Pengeluaran per kategori bulan ini
CREATE VIEW v_expense_by_category AS
SELECT
  tenant_id,
  DATE_TRUNC('month', transaction_date) AS month,
  category_name,
  SUM(amount) AS total,
  COUNT(*) AS count
FROM transactions
WHERE type = 'expense'
GROUP BY tenant_id, DATE_TRUNC('month', transaction_date), category_name;
