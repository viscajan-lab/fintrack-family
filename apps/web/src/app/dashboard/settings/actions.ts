"use server"

import { revalidatePath } from "next/cache"
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

// ── Reminder harian (mirror bot /reminder) ────────────────────────────────────
// Disimpan di tenant_members, keyed by telegram_id (WIB). Scheduler bot yang kirim
// notif tiap menit saat jam WIB user tercapai. Web hanya baca/tulis preferensi jam.

export type ReminderStatus = {
  linked: boolean          // akun web ter-link ke Telegram?
  telegramId: number | null
  enabled: boolean         // reminder_hour tidak NULL?
  hour: number | null
  minute: number
}

/** Ambil telegram_id member yang sedang login (deterministik, prioritas ber-telegram_id). */
async function currentTelegramId(): Promise<{ telegramId: number | null; admin: ReturnType<typeof createAdminClient> } | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const admin = createAdminClient()
  const { data: member } = await admin
    .from("tenant_members")
    .select("telegram_id")
    .eq("user_id", user.id)
    .order("telegram_id", { ascending: false, nullsFirst: false })
    .order("joined_at",   { ascending: true })
    .limit(1)
    .maybeSingle()

  return { telegramId: member?.telegram_id ?? null, admin }
}

/** Status reminder harian user yang sedang login. */
export async function getReminderStatus(): Promise<ReminderStatus> {
  const ctx = await currentTelegramId()
  if (!ctx || ctx.telegramId == null) {
    return { linked: false, telegramId: null, enabled: false, hour: null, minute: 0 }
  }

  const { data } = await ctx.admin
    .from("tenant_members")
    .select("reminder_hour, reminder_minute")
    .eq("telegram_id", ctx.telegramId)
    .limit(1)
    .maybeSingle()

  const hour = data?.reminder_hour ?? null
  return {
    linked:     true,
    telegramId: ctx.telegramId,
    enabled:    hour != null,
    hour,
    minute:     data?.reminder_minute ?? 0,
  }
}

/** Set jam reminder harian (WIB). hour 0–23, minute 0–59. Reset penanda anti-dobel. */
export async function setReminder(hour: number, minute: number): Promise<{ ok: boolean; error?: string }> {
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return { ok: false, error: "Jam tidak valid. Jam 0–23, menit 0–59." }
  }
  const ctx = await currentTelegramId()
  if (!ctx || ctx.telegramId == null) {
    return { ok: false, error: "Akun belum tersambung ke bot Telegram." }
  }

  const { error } = await ctx.admin
    .from("tenant_members")
    .update({ reminder_hour: hour, reminder_minute: minute, reminder_last_sent: null })
    .eq("telegram_id", ctx.telegramId)

  if (error) return { ok: false, error: error.message }
  revalidatePath("/dashboard/settings")
  return { ok: true }
}

/** Matikan reminder harian (set jam ke NULL). */
export async function clearReminder(): Promise<{ ok: boolean; error?: string }> {
  const ctx = await currentTelegramId()
  if (!ctx || ctx.telegramId == null) {
    return { ok: false, error: "Akun belum tersambung ke bot Telegram." }
  }

  const { error } = await ctx.admin
    .from("tenant_members")
    .update({ reminder_hour: null, reminder_last_sent: null })
    .eq("telegram_id", ctx.telegramId)

  if (error) return { ok: false, error: error.message }
  revalidatePath("/dashboard/settings")
  return { ok: true }
}

// ── Grup keluarga (broadcast rekap harian ke grup Telegram) ───────────────────
// Grup di-bind lewat bot (/hubungkan_grup di dalam grup). Web menampilkan status
// koneksi + mengatur jadwal jam recap & on/off. Scheduler bot yang broadcast.

export type GroupStatus = {
  isAdmin: boolean          // user login = admin tenant?
  connected: boolean        // group_chat_id terisi?
  groupTitle: string | null
  enabled: boolean          // group_daily_recap
  hour: number              // group_recap_hour (0–23)
}

/** Ambil tenant + role member yang sedang login (prioritas member ber-telegram_id). */
async function currentTenant(): Promise<
  { tenantId: string; role: string | null; admin: ReturnType<typeof createAdminClient> } | null
> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const admin = createAdminClient()
  const { data: member } = await admin
    .from("tenant_members")
    .select("tenant_id, role")
    .eq("user_id", user.id)
    .order("telegram_id", { ascending: false, nullsFirst: false })
    .order("joined_at",   { ascending: true })
    .limit(1)
    .maybeSingle()

  if (!member?.tenant_id) return null
  return { tenantId: member.tenant_id, role: member.role ?? null, admin }
}

/** Status grup keluarga untuk tenant user yang sedang login. */
export async function getGroupStatus(): Promise<GroupStatus> {
  const ctx = await currentTenant()
  if (!ctx) {
    return { isAdmin: false, connected: false, groupTitle: null, enabled: false, hour: 21 }
  }

  const { data: tenant } = await ctx.admin
    .from("tenants")
    .select("group_chat_id, group_title, group_daily_recap, group_recap_hour")
    .eq("id", ctx.tenantId)
    .maybeSingle()

  return {
    isAdmin:    ctx.role === "admin",
    connected:  tenant?.group_chat_id != null,
    groupTitle: tenant?.group_title ?? null,
    enabled:    tenant?.group_daily_recap ?? true,
    hour:       tenant?.group_recap_hour ?? 21,
  }
}

/** Atur recap grup: on/off + jam (WIB). Admin-only. Reset penanda anti-dobel. */
export async function setGroupRecap(enabled: boolean, hour: number): Promise<{ ok: boolean; error?: string }> {
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
    return { ok: false, error: "Jam tidak valid (0–23)." }
  }
  const ctx = await currentTenant()
  if (!ctx) return { ok: false, error: "Sesi tidak valid." }
  if (ctx.role !== "admin") return { ok: false, error: "Hanya admin keluarga yang bisa mengatur ini." }

  const { error } = await ctx.admin
    .from("tenants")
    .update({ group_daily_recap: enabled, group_recap_hour: hour, group_last_recap: null })
    .eq("id", ctx.tenantId)

  if (error) return { ok: false, error: error.message }
  revalidatePath("/dashboard/settings")
  return { ok: true }
}

/** Lepas grup dari tenant (mirror bot /lepas_grup). Admin-only. */
export async function unlinkGroup(): Promise<{ ok: boolean; error?: string }> {
  const ctx = await currentTenant()
  if (!ctx) return { ok: false, error: "Sesi tidak valid." }
  if (ctx.role !== "admin") return { ok: false, error: "Hanya admin keluarga yang bisa melepas grup." }

  const { error } = await ctx.admin
    .from("tenants")
    .update({ group_chat_id: null, group_title: null })
    .eq("id", ctx.tenantId)

  if (error) return { ok: false, error: error.message }
  revalidatePath("/dashboard/settings")
  return { ok: true }
}
