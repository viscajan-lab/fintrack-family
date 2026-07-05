-- ============================================================
-- Migration 003: account_link_codes
-- Menjembatani akun WEB (auth.users) <-> akun BOT (telegram_id)
-- Dukung DUA ARAH:
--   - direction='web_to_bot' : web generate kode, bot yang klaim
--   - direction='bot_to_web' : bot generate kode, web yang klaim
-- Prinsip: sekali diklaim, tenant_members.user_id di-isi dgn auth.uid()
--          sehingga getTenantId() di web menemukan tenant si user.
-- ============================================================

CREATE TABLE IF NOT EXISTS account_link_codes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code         TEXT NOT NULL UNIQUE,                 -- 6-digit, mis. "428913"
  direction    TEXT NOT NULL CHECK (direction IN ('web_to_bot', 'bot_to_web')),

  -- Diisi tergantung arah:
  user_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE,  -- arah web_to_bot: siapa user web-nya
  telegram_id  BIGINT,                                            -- arah bot_to_web: telegram mana
  tenant_id    UUID REFERENCES tenants(id) ON DELETE CASCADE,     -- arah bot_to_web: tenant si telegram

  claimed_at   TIMESTAMPTZ,                          -- NULL = belum dipakai
  expires_at   TIMESTAMPTZ NOT NULL,                 -- kadaluarsa (mis. +15 menit)
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Cari kode aktif dengan cepat (belum diklaim & belum kadaluarsa)
CREATE INDEX IF NOT EXISTS idx_link_codes_code_active
  ON account_link_codes (code)
  WHERE claimed_at IS NULL;

-- ============================================================
-- RLS: tabel ini HANYA diakses lewat service_role (bot & web admin client).
-- Aktifkan RLS tanpa policy apa pun => user biasa (anon/auth) tidak bisa
-- baca/tulis; service_role otomatis bypass RLS. Aman by default.
-- ============================================================
ALTER TABLE account_link_codes ENABLE ROW LEVEL SECURITY;
