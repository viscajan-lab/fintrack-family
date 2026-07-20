-- ============================================================
-- 008: admin_create_tenant — RPC untuk super admin buat keluarga (tenant) baru
-- ============================================================
-- Fungsi ini:
--   * Hanya dapat dipanggil oleh super_admin (guard via is_super_admin())
--   * Membuat baris baru di tabel tenants
--   * Secara otomatis menambahkan user pemanggil (auth.uid()) sebagai admin tenant
--   * Mengembalikan UUID tenant yang baru dibuat
--   * Operasi dibungkus dalam satu transaksi atomic

CREATE OR REPLACE FUNCTION public.admin_create_tenant(
  p_name TEXT,
  p_slug TEXT,
  p_plan TEXT DEFAULT 'free'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_tenant_id UUID;
BEGIN
  -- Guard: hanya super_admin yang boleh memanggil
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Only super_admin can create a tenant';
  END IF;

  -- Insert tenant
  INSERT INTO tenants (name, slug, plan)
  VALUES (p_name, p_slug, p_plan)
  RETURNING id INTO new_tenant_id;

  -- Insert tenant member: pemanggil menjadi admin
  INSERT INTO tenant_members (tenant_id, user_id, role)
  VALUES (new_tenant_id, auth.uid(), 'admin');

  RETURN new_tenant_id;
END;
$$;

-- Hak akses: hanya super_admin yang dapat eksekusi (di tingkat RLS)
GRANT EXECUTE ON FUNCTION public.admin_create_tenant(TEXT, TEXT, TEXT) TO anon, authenticated;

-- ============================================================
-- Catatan:
--   * `auth.uid()` tersedia di Supabase untuk mengakses ID user yang memanggil RPC.
--   * Jika aplikasi menginginkan penambahan member lain, gunakan RPC tambahan.
--   * Pastikan RLS di tabel tenants & tenant_members mengizinkan SECURITY DEFINER
--     supaya fungsi dapat menulis meski pemanggil bukan owner tenant.
-- ============================================================
