-- ============================================================
-- MIGRATION: reminder harian per user (tenant_members)
-- Menambah preferensi jam reminder catat pengeluaran (disimpan WIB).
-- Aman dijalankan berkali-kali (idempoten). Jalankan di Supabase SQL editor.
-- ============================================================

-- reminder_hour / reminder_minute : jam WIB user mau diingatkan (NULL = mati)
-- reminder_last_sent              : anti-dobel harian (tanggal WIB terakhir kirim)
ALTER TABLE tenant_members
  ADD COLUMN IF NOT EXISTS reminder_hour      SMALLINT
    CHECK (reminder_hour IS NULL OR reminder_hour BETWEEN 0 AND 23);

ALTER TABLE tenant_members
  ADD COLUMN IF NOT EXISTS reminder_minute    SMALLINT NOT NULL DEFAULT 0
    CHECK (reminder_minute BETWEEN 0 AND 59);

ALTER TABLE tenant_members
  ADD COLUMN IF NOT EXISTS reminder_last_sent DATE;

-- Index: scheduler query "member yang jam remindernya = HH:MM"
CREATE INDEX IF NOT EXISTS idx_members_reminder
  ON tenant_members (reminder_hour, reminder_minute)
  WHERE reminder_hour IS NOT NULL;
