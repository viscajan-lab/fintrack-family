-- Migrasi 008: Kantong per anggota (member allowances + tagging transaksi)
-- Diterapkan ke produksi via Supabase Management API (project ukjykxndgefebvjbcycl).

-- 1) Kolom member_id di transactions (kantong siapa). Nullable = transaksi lama 'Belum ditandai'.
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS member_id uuid REFERENCES public.tenant_members(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_transactions_member_id ON public.transactions(member_id);

-- 2) Tabel jatah bulanan per anggota (mirror pola budgets)
CREATE TABLE IF NOT EXISTS public.member_allowances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.tenant_members(id) ON DELETE CASCADE,
  amount bigint NOT NULL CHECK (amount >= 0),
  month smallint NOT NULL CHECK (month BETWEEN 1 AND 12),
  year smallint NOT NULL CHECK (year BETWEEN 2000 AND 2100),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT member_allowances_unique UNIQUE (tenant_id, member_id, month, year)
);
CREATE INDEX IF NOT EXISTS idx_member_allowances_tenant ON public.member_allowances(tenant_id, year, month);

-- 3) RLS: anggota tenant boleh SELECT; admin boleh tulis (via helper SECURITY DEFINER, anti-recursion)
ALTER TABLE public.member_allowances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS member_allowances_select ON public.member_allowances;
CREATE POLICY member_allowances_select ON public.member_allowances
  FOR SELECT USING (tenant_id IN (SELECT public.my_tenant_ids()));

DROP POLICY IF EXISTS member_allowances_admin_write ON public.member_allowances;
CREATE POLICY member_allowances_admin_write ON public.member_allowances
  FOR ALL USING (tenant_id IN (SELECT public.my_admin_tenant_ids()))
  WITH CHECK (tenant_id IN (SELECT public.my_admin_tenant_ids()));
