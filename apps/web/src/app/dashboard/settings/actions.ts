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
