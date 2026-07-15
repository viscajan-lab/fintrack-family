-- ============================================================
-- MIGRATION 007: panel /admin — ringkasan lintas-tenant (super_admin)
-- RLS tenants/tenant_members membatasi ke my_tenant_ids(), jadi super_admin
-- TIDAK bisa lihat tenant lain lewat query biasa. RPC SECURITY DEFINER ini
-- membuka data global TAPI dijaga guard is_super_admin() (defense in depth:
-- gate bukan cuma di UI, tapi juga di DB — non-super-admin dapat exception).
-- Read-only: tidak mengubah data apa pun.
-- ============================================================

CREATE OR REPLACE FUNCTION public.admin_list_tenants()
RETURNS TABLE (
  id           UUID,
  name         TEXT,
  slug         TEXT,
  plan         TEXT,
  created_at   TIMESTAMPTZ,
  member_count BIGINT,
  tx_count     BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    t.id,
    t.name,
    t.slug,
    t.plan,
    t.created_at,
    (SELECT count(*) FROM tenant_members tm WHERE tm.tenant_id = t.id) AS member_count,
    (SELECT count(*) FROM transactions   tx WHERE tx.tenant_id = t.id) AS tx_count
  FROM tenants t
  WHERE public.is_super_admin()   -- guard: kosongkan hasil (bkn error) utk non-super-admin
  ORDER BY t.created_at DESC;
$$;

-- Statistik global agregat (kartu ringkasan di atas tabel). Guard sama.
CREATE OR REPLACE FUNCTION public.admin_global_stats()
RETURNS TABLE (
  tenant_count  BIGINT,
  member_count  BIGINT,
  tx_count      BIGINT,
  admin_count   BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (SELECT count(*) FROM tenants),
    (SELECT count(*) FROM tenant_members),
    (SELECT count(*) FROM transactions),
    (SELECT count(*) FROM tenant_members WHERE role IN ('admin', 'super_admin'))
  WHERE public.is_super_admin();
$$;
