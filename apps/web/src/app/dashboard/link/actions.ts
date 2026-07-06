"use server"

import { revalidatePath } from "next/cache"
import { createClient, createAdminClient } from "@/lib/supabase/server"

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CODE_TTL_MINUTES = 15

function genCode(): string {
  // 6-digit, tanpa leading-zero problem (100000–999999)
  return String(Math.floor(100000 + Math.random() * 900000))
}

async function getAuthUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

async function getTenantId(userId: string): Promise<string | null> {
  const admin = createAdminClient()
  const { data } = await admin
    .from("tenant_members")
    .select("tenant_id, telegram_id, joined_at")
    .eq("user_id", userId)
    .order("telegram_id", { ascending: false, nullsFirst: false })
    .order("joined_at",   { ascending: true })
    .limit(1)
    .maybeSingle()
  return data?.tenant_id ?? null
}

// ─── Arah A1: WEB generate kode (web_to_bot) ────────────────────────────────────
// User web bikin kode, lalu ketik kode itu di bot Telegram (/hubungkan <kode>).
// Bot yang akan set tenant_members.user_id = user web ini.

export async function generateWebCode() {
  const user = await getAuthUser()
  if (!user) return { error: "Tidak terautentikasi" }

  const admin = createAdminClient()

  // Invalidate kode web_to_bot lama yang belum diklaim untuk user ini
  await admin
    .from("account_link_codes")
    .delete()
    .eq("user_id", user.id)
    .eq("direction", "web_to_bot")
    .is("claimed_at", null)

  // Retry kalau tabrakan UNIQUE code (jarang, tapi aman)
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = genCode()
    const expires_at = new Date(Date.now() + CODE_TTL_MINUTES * 60_000).toISOString()

    const { error } = await admin.from("account_link_codes").insert({
      code,
      direction: "web_to_bot",
      user_id: user.id,
      expires_at,
    })

    if (!error) {
      revalidatePath("/dashboard/link")
      return { success: true, code, expiresInMinutes: CODE_TTL_MINUTES }
    }
    // 23505 = unique_violation → coba kode lain
    if (error.code !== "23505") return { error: error.message }
  }

  return { error: "Gagal membuat kode unik, coba lagi" }
}

// ─── Arah A2: WEB klaim kode dari BOT (bot_to_web) ──────────────────────────────
// Bot sudah bikin kode (direction='bot_to_web') berisi telegram_id + tenant_id.
// User web input kode itu di sini → web klaim → user web ikut ke tenant si bot.

export async function claimBotCode(formData: FormData) {
  const user = await getAuthUser()
  if (!user) return { error: "Tidak terautentikasi" }

  const rawCode = (formData.get("code") as string || "").trim()
  if (!/^\d{6}$/.test(rawCode)) {
    return { error: "Kode harus 6 digit angka" }
  }

  const admin = createAdminClient()

  // Ambil kode aktif bot_to_web yang belum diklaim & belum kadaluarsa
  const { data: link, error: fetchErr } = await admin
    .from("account_link_codes")
    .select("id, telegram_id, tenant_id, expires_at, claimed_at, direction")
    .eq("code", rawCode)
    .eq("direction", "bot_to_web")
    .is("claimed_at", null)
    .single()

  if (fetchErr || !link) {
    return { error: "Kode tidak ditemukan atau sudah dipakai" }
  }
  if (new Date(link.expires_at).getTime() < Date.now()) {
    return { error: "Kode sudah kadaluarsa, minta kode baru dari bot" }
  }
  if (!link.tenant_id) {
    return { error: "Kode tidak valid (tenant kosong)" }
  }

  // Model linking: bot sudah bikin baris tenant_members dgn telegram_id
  // (user_id=NULL). Saat klaim, kita ISI user_id ke baris member telegram itu,
  // supaya getTenantId(user) di web nemu tenant keluarga si bot.
  const tgId = link.telegram_id

  // 1) Cari baris member telegram di tenant tsb (kalau bot mengirim telegram_id)
  let linkedToExisting = false
  if (tgId) {
    const { data: tgMember } = await admin
      .from("tenant_members")
      .select("id, user_id")
      .eq("tenant_id", link.tenant_id)
      .eq("telegram_id", tgId)
      .limit(1)
      .single()

    if (tgMember) {
      if (!tgMember.user_id) {
        // Isi user_id ke baris member telegram yang sudah ada
        const { error: updErr } = await admin
          .from("tenant_members")
          .update({ user_id: user.id })
          .eq("id", tgMember.id)
        if (updErr) return { error: `Gagal menghubungkan akun: ${updErr.message}` }
        linkedToExisting = true
      } else if (tgMember.user_id === user.id) {
        linkedToExisting = true // sudah ke-link ke user ini
      }
      // else: baris telegram sudah dipakai user lain → jatuh ke fallback
    }
  }

  // 2) Fallback: belum ke-link ke baris telegram manapun → pastikan user
  //    jadi anggota tenant si bot (buat baris baru bila belum ada).
  if (!linkedToExisting) {
    const existingTenant = await getTenantId(user.id)
    if (existingTenant === link.tenant_id) {
      // sudah satu tenant, no-op
    } else if (existingTenant) {
      const { error: updErr } = await admin
        .from("tenant_members")
        .update({ tenant_id: link.tenant_id })
        .eq("user_id", user.id)
      if (updErr) return { error: `Gagal menggabungkan akun: ${updErr.message}` }
    } else {
      const { error: insErr } = await admin.from("tenant_members").insert({
        tenant_id: link.tenant_id,
        user_id: user.id,
        role: "member",
      })
      if (insErr) return { error: `Gagal menghubungkan akun: ${insErr.message}` }
    }
  }

  // Tandai kode terpakai
  const { error: claimErr } = await admin
    .from("account_link_codes")
    .update({ claimed_at: new Date().toISOString() })
    .eq("id", link.id)
  if (claimErr) return { error: claimErr.message }

  revalidatePath("/dashboard")
  revalidatePath("/dashboard/link")
  return { success: true, tenantId: link.tenant_id }
}
