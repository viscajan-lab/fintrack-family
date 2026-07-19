-- ============================================================
-- MIGRATION 010: monitoring admin (kepala keluarga) untuk super_admin
-- Panel /admin fokus baru: pantau siapa admin yang aktif & kapan terakhir
-- mereka login. Sumber "terakhir dipakai" = auth.users.last_sign_in_at
-- (di-update Supabase Auth tiap login). NULL = belum pernah login.
--
-- RLS biasa membatasi ke tenant sendiri + auth.users tak terjangkau anon,
-- jadi RPC SECURITY DEFINER ini satu-satunya jalan sah super_admin melihat
-- lintas-admin. Guard is_super_admin() (defense in depth: non-super-admin
-- dapat hasil kosong, bukan error). Read-only: tidak mengubah data apa pun.
-- ============================================================

CREATE OR REPLACE FUNCTION public.admin_list_admins()
RETURNS TABLE (
  member_id       UUID,
  user_id         UUID,
  display_name    TEXT,
  email           TEXT,
  role            TEXT,
  tenant_id       UUID,
  tenant_name     TEXT,
  member_count    BIGINT,
  joined_at       TIMESTAMPTZ,
  last_sign_in_at TIMESTAMPTZ,
  user_created_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    tm.id            AS member_id,
    tm.user_id,
    tm.display_name,
    u.email::text    AS email,
    tm.role,
    tm.tenant_id,
    t.name           AS tenant_name,
    (SELECT count(*) FROM tenant_members m WHERE m.tenant_id = tm.tenant_id) AS member_count,
    tm.joined_at,
    u.last_sign_in_at,
    u.created_at     AS user_created_at
  FROM tenant_members tm
  JOIN auth.users u ON u.id = tm.user_id
  JOIN tenants    t ON t.id = tm.tenant_id
  WHERE public.is_super_admin()          -- guard: kosongkan hasil (bkn error) utk non-super-admin
    AND tm.role IN ('admin', 'super_admin')
  ORDER BY u.last_sign_in_at DESC NULLS LAST;
$$;
