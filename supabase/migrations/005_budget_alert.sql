-- ============================================================
-- 005 — Push Budget Proaktif (alert budget hampir/tembus lewat bot)
-- ============================================================
-- Scheduler mengecek pemakaian budget per kategori tiap hari pada
-- BUDGET_ALERT_HOUR WIB. Kategori yang pemakaiannya >= 90% dari limit
-- akan diberitahukan ke anggota tenant (dan grup keluarga bila ada).
--
-- budget_alerts_enabled   : toggle fitur alert budget (default true).
-- budget_alert_last_sent  : penanda tanggal WIB terakhir alert dikirim
--                           (anti-dobel — maksimal sekali per hari per tenant).
-- ============================================================

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS budget_alerts_enabled  BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS budget_alert_last_sent DATE;
