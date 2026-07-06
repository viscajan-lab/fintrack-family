"use server"

import { createClient, createAdminClient } from "@/lib/supabase/server"

export type LinkStatus = {
  email: string | null
  connected: boolean
  telegramId: number | null
  tenantName: string | null
  memberSince: string | null
}

/** Status akun + linking Telegram untuk user yang sedang login. */
export async function getLinkStatus(): Promise<LinkStatus> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { email: null, connected: false, telegramId: null, tenantName: null, memberSince: null }
  }

  const admin = createAdminClient()

  // Ambil keanggotaan tenant deterministik: prioritaskan tenant ber-telegram_id.
  const { data: member } = await admin
    .from("tenant_members")
    .select("tenant_id, telegram_id, joined_at")
    .eq("user_id", user.id)
    .order("telegram_id", { ascending: false, nullsFirst: false })
    .order("joined_at",   { ascending: true })
    .limit(1)
    .maybeSingle()

  let tenantName: string | null = null
  if (member?.tenant_id) {
    const { data: tenant } = await admin
      .from("tenants")
      .select("name")
      .eq("id", member.tenant_id)
      .maybeSingle()
    tenantName = tenant?.name ?? null
  }

  return {
    email:       user.email ?? null,
    connected:   member?.telegram_id != null,
    telegramId:  member?.telegram_id ?? null,
    tenantName,
    memberSince: member?.joined_at ?? null,
  }
}
