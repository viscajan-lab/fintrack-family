-- ============================================================
-- 004 — Channel Grup Keluarga (broadcast rekap harian)
-- ============================================================
-- Menyimpan chat_id grup Telegram per tenant supaya scheduler
-- bisa mengirim ringkasan harian ke satu grup keluarga.
--
-- group_chat_id      : chat_id grup Telegram (negatif untuk grup/supergroup).
--                      NULL = belum ada grup terhubung.
-- group_title        : judul grup saat dihubungkan (untuk ditampilkan di web).
-- group_daily_recap  : toggle broadcast rekap harian ke grup (default true).
-- group_recap_hour   : jam WIB broadcast (default 21 = 21:00 WIB).
-- group_last_recap    : penanda tanggal WIB terakhir broadcast (anti-dobel).
-- ============================================================

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS group_chat_id     BIGINT,
  ADD COLUMN IF NOT EXISTS group_title       TEXT,
  ADD COLUMN IF NOT EXISTS group_daily_recap BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS group_recap_hour  SMALLINT NOT NULL DEFAULT 21,
  ADD COLUMN IF NOT EXISTS group_last_recap  DATE;

-- Satu grup Telegram hanya boleh terikat ke satu tenant.
CREATE UNIQUE INDEX IF NOT EXISTS idx_tenants_group_chat_id
  ON tenants (group_chat_id)
  WHERE group_chat_id IS NOT NULL;
