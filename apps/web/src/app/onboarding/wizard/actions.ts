"use server"

import { createClient, createAdminClient } from "@/lib/supabase/server"

/**
 * State onboarding untuk wizard: dipakai untuk polling langkah "Sambung Telegram".
 * Mengembalikan apakah user sudah tersambung ke sebuah tenant lewat Telegram
 * (punya baris tenant_members dengan telegram_id terisi di tenant-nya), plus
 * info dasar tenant (nama + storage_type) untuk menentukan langkah lanjutan.
 */
export type WizardCategory = {
  id: string
  name: string
  emoji: string
  type: "income" | "expense" | "both"
  isDefault: boolean            // true = kategori global (tenant_id NULL), tak bisa dihapus
}

export type WizardMember = {
  id: string                    // tenant_members.id (dipakai sebagai member_id allowance)
  displayName: string
  role: "admin" | "member"
  allowance: number             // jatah bulan berjalan (0 jika belum di-set)
}

export type WizardState = {
  authenticated: boolean
  tenantId: string | null
  tenantName: string | null
  isAdmin: boolean
  telegramLinked: boolean       // ada member ber-telegram_id di tenant ini?
  memberCount: number           // jumlah anggota tenant (untuk langkah "tambah anggota")
  storageType: string | null    // 'supabase' | 'sheets' | null (belum dipilih)
  botUsername: string | null    // untuk render deep-link t.me/<bot>?start=inv_<token>
  categories: WizardCategory[]  // default global + custom milik tenant ini
  members: WizardMember[]       // anggota yang sudah join + jatah bulan berjalan
  currentMonth: string          // 'YYYY-MM' bulan berjalan (untuk set allowance)
}

async function authUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function getWizardState(): Promise<WizardState> {
  const now = new Date()
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`

  const empty: WizardState = {
    authenticated: false, tenantId: null, tenantName: null,
    isAdmin: false, telegramLinked: false, memberCount: 0, storageType: null,
    botUsername: process.env.NEXT_PUBLIC_BOT_USERNAME ?? null,
    categories: [], members: [], currentMonth,
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

  // Ambil semua member tenant (id + nama + role) untuk hitung jumlah,
  // deteksi telegram linked, sekaligus daftar anggota untuk step Kantong.
  const { data: memberRows } = await admin
    .from("tenant_members")
    .select("id, display_name, role, telegram_id, user_id")
    .eq("tenant_id", me.tenant_id)
    .order("role", { ascending: true })
    .order("display_name", { ascending: true })

  const memberCount = memberRows?.length ?? 0
  const telegramLinked = (memberRows ?? []).some((m) => m.telegram_id != null)

  const { data: tenant } = await admin
    .from("tenants")
    .select("name, storage_type")
    .eq("id", me.tenant_id)
    .maybeSingle()

  // Kategori: default global (tenant_id NULL) + custom milik tenant ini
  const { data: catRows } = await admin
    .from("categories")
    .select("id, name, emoji, type, tenant_id")
    .or(`tenant_id.is.null,tenant_id.eq.${me.tenant_id}`)
    .order("type", { ascending: true })
    .order("name", { ascending: true })

  const categories: WizardCategory[] = (catRows ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    emoji: c.emoji ?? "",
    type: (c.type === "income" || c.type === "both") ? c.type : "expense",
    isDefault: c.tenant_id == null,
  }))

  // Jatah (allowance) anggota untuk bulan berjalan
  const now2 = new Date()
  const year = now2.getFullYear()
  const monthNum = now2.getMonth() + 1
  const { data: allowRows } = await admin
    .from("member_allowances")
    .select("member_id, amount")
    .eq("tenant_id", me.tenant_id)
    .eq("year", year)
    .eq("month", monthNum)

  const allowanceByMember: Record<string, number> = {}
  for (const a of allowRows ?? []) allowanceByMember[a.member_id] = a.amount

  const members: WizardMember[] = (memberRows ?? []).map((m) => ({
    id: m.id,
    displayName: m.display_name ?? "Tanpa nama",
    role: m.role === "admin" ? "admin" : "member",
    allowance: allowanceByMember[m.id] ?? 0,
  }))

  return {
    authenticated: true,
    tenantId: me.tenant_id,
    tenantName: tenant?.name ?? null,
    isAdmin: me.role === "admin",
    telegramLinked,
    memberCount,
    storageType: tenant?.storage_type ?? null,
    botUsername: process.env.NEXT_PUBLIC_BOT_USERNAME ?? null,
    categories,
    members,
    currentMonth,
  }
}
