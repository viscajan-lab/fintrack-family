-- ============================================================
-- MIGRATION 012: super_admin berdiri sendiri (lepas dari tenant)
-- Super_admin adalah peran GLOBAL platform; tak boleh bergantung pada
-- keanggotaan tenant (yang bisa dihapus). Sumber kebenaran baru: super_admins.
-- ============================================================

-- 1. Tabel daftar super_admin global. Satu baris = satu user platform-admin.
CREATE TABLE IF NOT EXISTS public.super_admins (
  user_id    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.super_admins ENABLE ROW LEVEL SECURITY;
-- Hanya super_admin yang boleh membaca daftar; ditulis via service_role (bypass RLS).
DROP POLICY IF EXISTS super_admins_read ON public.super_admins;
CREATE POLICY super_admins_read ON public.super_admins
  FOR SELECT USING (public.is_super_admin());

-- 2. is_super_admin(): cek tabel super_admins DULU (sumber kebenaran baru),
--    fallback ke tenant_members demi kompatibilitas mundur.
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM super_admins WHERE user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM tenant_members
                 WHERE user_id = auth.uid() AND role = 'super_admin');
$$;

-- 3. my_role(): super_admin dari super_admins ATAU tenant_members; lalu admin; lalu member.
CREATE OR REPLACE FUNCTION public.my_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT 'super_admin' WHERE public.is_super_admin()),
    (SELECT 'admin' FROM tenant_members
      WHERE user_id = auth.uid() AND role = 'admin' LIMIT 1),
    'member'
  );
$$;

-- 4. Daftarkan super_admin saat ini: viscajan5@gmail.com.
INSERT INTO public.super_admins (user_id)
VALUES ('f36bdce0-fc4d-4694-a170-9bd13980858c')
ON CONFLICT (user_id) DO NOTHING;
