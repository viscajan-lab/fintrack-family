"use server"

import { revalidatePath } from "next/cache"
import { createClient, createAdminClient } from "@/lib/supabase/server"

// ─── Undangan tertarget (invites) ─────────────────────────────────────────────
// Admin bikin undangan sekali-pakai (pilih role + label opsional) → dapat token
// unik utk deep-link Telegram (?start=inv_<token>). Bot yang meng-klaim token,
// membuat baris tenant_members dgn role sesuai undangan, lalu menandai used_at.

const INVITE_TTL_HOURS = 72

function genToken(): string {
  // 10 char base36 acak (huruf kecil + angka) — aman utk Telegram deep-link
  // (Telegram start payload hanya izinkan [A-Za-z0-9_-]).
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789"
  let out = ""
  for (let i = 0; i < 10; i++) out += chars[Math.floor(Math.random() * chars.length)]
  return out
}

async function getAuthUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

// Kembalikan tenant_id HANYA jika user adalah admin di tenant tsb.
async function getAdminTenantId(userId: string): Promise<string | null> {
  const admin = createAdminClient()
  const { data } = await admin
    .from("tenant_members")
    .select("tenant_id, telegram_id, joined_at")
    .eq("user_id", userId)
    .eq("role", "admin")
    .order("telegram_id", { ascending: false, nullsFirst: false })
    .order("joined_at", { ascending: true })
    .limit(1)
    .maybeSingle()
  return data?.tenant_id ?? null
}

export async function createInvite(formData: FormData) {
  const user = await getAuthUser()
  if (!user) return { error: "Tidak terautentikasi" }

  const tenantId = await getAdminTenantId(user.id)
  if (!tenantId) return { error: "Hanya admin yang bisa membuat undangan" }

  const roleRaw = (formData.get("role") as string || "member").trim()
  const role = roleRaw === "admin" ? "admin" : "member"
  const label = ((formData.get("label") as string) || "").trim().slice(0, 80) || null

  const admin = createAdminClient()

  // Retry kalau tabrakan UNIQUE token (sangat jarang, tapi aman)
  for (let attempt = 0; attempt < 5; attempt++) {
    const token = genToken()
    const expires_at = new Date(Date.now() + INVITE_TTL_HOURS * 3_600_000).toISOString()

    const { error } = await admin.from("invites").insert({
      tenant_id: tenantId,
      token,
      role,
      label,
      created_by: user.id,
      expires_at,
    })

    if (!error) {
      revalidatePath("/dashboard/members")
      return { success: true, token, expiresInHours: INVITE_TTL_HOURS }
    }
    // 23505 = unique_violation → coba token lain
    if (error.code !== "23505") return { error: error.message }
  }

  return { error: "Gagal membuat token unik, coba lagi" }
}

export async function revokeInvite(formData: FormData) {
  const user = await getAuthUser()
  if (!user) return { error: "Tidak terautentikasi" }

  const tenantId = await getAdminTenantId(user.id)
  if (!tenantId) return { error: "Hanya admin yang bisa membatalkan undangan" }

  const id = (formData.get("id") as string || "").trim()
  if (!id) return { error: "ID undangan kosong" }

  const admin = createAdminClient()
  // Safety belt: hanya boleh hapus undangan milik tenant si admin & yg belum dipakai
  const { error } = await admin
    .from("invites")
    .delete()
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .is("used_at", null)

  if (error) return { error: error.message }

  revalidatePath("/dashboard/members")
  return { success: true }
}
