-- ============================================================
-- 011: self_create_tenant — user (kepala keluarga baru) buat keluarganya sendiri
-- ============================================================
-- Beda dengan 008 (admin_create_tenant, khusus super_admin). Fungsi ini dipakai
-- di alur onboarding: admin baru diundang via email TANPA tenant, set password,
-- lalu diarahkan ke /onboarding/family untuk membuat keluarganya sendiri.
--
-- Fungsi ini:
--   * Bisa dipanggil user login mana pun YANG BELUM punya tenant apa pun
--   * GUARD 1-user-1-tenant: kalau pemanggil sudah jadi member tenant apa pun
--     (role apa pun) -> RAISE EXCEPTION. Ini sekaligus menutup penyalahgunaan
--     (tak bisa spam bikin tenant tak terbatas).
--   * Auto-generate slug unik dari nama (slugify + suffix angka bila bentrok)
--   * Insert tenant + insert pemanggil sebagai admin, dalam satu transaksi
--   * Mengembalikan UUID tenant baru
--
-- Catatan keamanan: SECURITY DEFINER + SET search_path = public (konsisten dg
-- helper 006). Guard berbasis auth.uid() jadi tak bisa dititipi user lain.

CREATE OR REPLACE FUNCTION public.self_create_tenant(
  p_name TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid          UUID := auth.uid();
  new_id       UUID;
  base_slug    TEXT;
  final_slug   TEXT;
  suffix       INT := 0;
  clean_name   TEXT;
BEGIN
  -- Harus login
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- GUARD 1-user-1-tenant: tolak kalau sudah jadi member tenant apa pun
  IF EXISTS (SELECT 1 FROM tenant_members WHERE user_id = uid) THEN
    RAISE EXCEPTION 'User already belongs to a tenant';
  END IF;

  -- Validasi nama
  clean_name := btrim(COALESCE(p_name, ''));
  IF length(clean_name) < 2 THEN
    RAISE EXCEPTION 'Tenant name too short';
  END IF;

  -- Slugify: lowercase, ganti non-alnum jadi '-', rapikan '-' beruntun/tepi
  base_slug := lower(clean_name);
  base_slug := regexp_replace(base_slug, '[^a-z0-9]+', '-', 'g');
  base_slug := btrim(base_slug, '-');
  IF base_slug = '' THEN
    base_slug := 'keluarga';
  END IF;

  -- Cari slug unik (base, base-1, base-2, ...)
  final_slug := base_slug;
  WHILE EXISTS (SELECT 1 FROM tenants WHERE slug = final_slug) LOOP
    suffix := suffix + 1;
    final_slug := base_slug || '-' || suffix::text;
  END LOOP;

  -- Insert tenant (plan default 'free')
  INSERT INTO tenants (name, slug, plan)
  VALUES (clean_name, final_slug, 'free')
  RETURNING id INTO new_id;

  -- Pemanggil jadi admin keluarganya sendiri
  INSERT INTO tenant_members (tenant_id, user_id, role)
  VALUES (new_id, uid, 'admin');

  RETURN new_id;
END;
$$;

-- authenticated saja (butuh auth.uid()); anon tak berguna karena guard uid.
REVOKE ALL ON FUNCTION public.self_create_tenant(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.self_create_tenant(TEXT) TO authenticated;
