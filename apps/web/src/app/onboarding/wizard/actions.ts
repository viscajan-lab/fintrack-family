"use server"

import { createClient, createAdminClient } from "@/lib/supabase/server"

/**
 * State onboarding untuk wizard: dipakai untuk polling langkah "Sambung Telegram".
 * Mengembalikan apakah user sudah tersambung ke sebuah tenant lewat Telegram
 * (punya baris tenant_members dengan telegram_id terisi di tenant-nya), plus
 * info dasar tenant (nama + storage_type) untuk menentukan langkah lanjutan.
 */
export type WizardState = {
  authenticated: boolean
  tenantId: string | null
  tenantName: string | null
  isAdmin: boolean
  telegramLinked: boolean       // ada member ber-telegram_id di tenant ini?
  memberCount: number           // jumlah anggota tenant (untuk langkah "tambah anggota")
  storageType: string | null    // 'supabase' | 'sheets' | null (belum dipilih)
  botUsername: string | null    // untuk render deep-link t.me/<bot>?start=inv_<token>
}

async function authUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function getWizardState(): Promise<WizardState> {
  const empty: WizardState = {
    authenticated: false, tenantId: null, tenantName: null,
    isAdmin: false, telegramLinked: false, memberCount: 0, storageType: null,
    botUsername: process.env.NEXT_PUBLIC_BOT_USERNAME ?? null,
  }

  const user = await authUser()
  if (!user) return empty

  const admin = createAdminClient()

  // Tenant utama user (prioritas baris ber-telegram_id, lalu paling awal join)
  const { data: me } = await admin
    .from("tenant_members")
    .select("tenant_id, role")
    .eq("user_id", user.id)
    .order("telegram_id", { ascending: false, nullsFirst: false })
    .order("joined_at", { ascending: true })
    .limit(1)
    .maybeSingle()

  if (!me?.tenant_id) {
    return { ...empty, authenticated: true }
  }

  // Ambil semua member tenant untuk hitung jumlah + deteksi telegram linked
  const { data: members } = await admin
    .from("tenant_members")
    .select("telegram_id")
    .eq("tenant_id", me.tenant_id)

  const memberCount = members?.length ?? 0
  const telegramLinked = (members ?? []).some((m) => m.telegram_id != null)

  const { data: tenant } = await admin
    .from("tenants")
    .select("name, storage_type")
    .eq("id", me.tenant_id)
    .maybeSingle()

  return {
    authenticated: true,
    tenantId: me.tenant_id,
    tenantName: tenant?.name ?? null,
    isAdmin: me.role === "admin",
    telegramLinked,
    memberCount,
    storageType: tenant?.storage_type ?? null,
    botUsername: process.env.NEXT_PUBLIC_BOT_USERNAME ?? null,
  }
}
