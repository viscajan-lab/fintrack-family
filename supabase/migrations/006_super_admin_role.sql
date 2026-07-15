-- ============================================================
-- MIGRATION 006: super_admin role (SaaS managed model)
-- 3 tingkat role: super_admin (global) > admin (kepala keluarga) > member
-- ============================================================

-- 1. Perluas nilai role yang sah. Kolom sudah TEXT, tinggal tambah CHECK.
--    Drop dulu kalau sudah ada (idempotent), lalu pasang constraint baru.
ALTER TABLE tenant_members DROP CONSTRAINT IF EXISTS tenant_members_role_check;
ALTER TABLE tenant_members
  ADD CONSTRAINT tenant_members_role_check
  CHECK (role IN ('member', 'admin', 'super_admin'));

-- 2. Helper SECURITY DEFINER: role tertinggi user login (lintas semua tenant).
--    super_admin menang atas admin menang atas member. Bypass RLS -> anti-rekursi.
--    Dipakai untuk gating menu & panel /admin.
CREATE OR REPLACE FUNCTION public.my_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT 'super_admin' FROM tenant_members
      WHERE user_id = auth.uid() AND role = 'super_admin' LIMIT 1),
    (SELECT 'admin' FROM tenant_members
      WHERE user_id = auth.uid() AND role = 'admin' LIMIT 1),
    'member'
  );
$$;

-- 3. Helper boolean cepat untuk RLS/panel.
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM tenant_members
    WHERE user_id = auth.uid() AND role = 'super_admin'
  );
$$;
