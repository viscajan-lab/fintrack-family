-- Migration 001: make user_id nullable for bot-only members
ALTER TABLE tenant_members ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE tenant_members DROP CONSTRAINT IF EXISTS tenant_members_tenant_id_user_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_tenant_members_user
  ON tenant_members (tenant_id, user_id) WHERE user_id IS NOT NULL;

-- Migration 001: make recorded_by nullable for bot-created transactions
ALTER TABLE transactions ALTER COLUMN recorded_by DROP NOT NULL;
