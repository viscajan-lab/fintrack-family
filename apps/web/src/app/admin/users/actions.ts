"use server"

import { revalidatePath } from "next/cache"
import { createClient, createAdminClient } from "@/lib/supabase/server"

// ─── Fitur 9: super_admin daftarkan admin baru via EMAIL ─────────────────────
// Alur (opsi: tempel ke tenant yang SUDAH ada):
//   1. super_admin buka /admin/users → pilih keluarga (tenant existing) + email
//   2. inviteUserByEmail() kirim undangan; tenant+role dititip di user_metadata
//      (pending_tenant_id, pending_role) + redirectTo /auth/callback→set-password
//   3. user klik link, set password di /auth/set-password
//   4. finalizeInvite() baca metadata → INSERT tenant_members (role=admin) →
//      bersihkan metadata pending. Idempotent (aman kalau dipanggil 2x).

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://fintrack-family.vercel.app"

async function requireSuperAdmin(): Promise<
  { ok: true; userId: string } | { ok: false; error: string }
> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "Tidak terautentikasi" }

  const admin = createAdminClient()
  const { data } = await admin
    .from("tenant_members")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "super_admin")
    .limit(1)
    .maybeSingle()

  if (!data) return { ok: false, error: "Hanya super admin yang boleh mendaftarkan admin" }
  return { ok: true, userId: user.id }
}

/**
 * super_admin mengundang admin baru ke tenant yang sudah ada.
 * FormData: email, tenant_id.
 */
export async function inviteAdmin(formData: FormData) {
  const gate = await requireSuperAdmin()
  if (!gate.ok) return { error: gate.error }

  const email = ((formData.get("email") as string) || "").trim().toLowerCase()
  const tenantId = ((formData.get("tenant_id") as string) || "").trim()

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return { error: "Email tidak valid" }
  if (!tenantId) return { error: "Pilih keluarga (tenant) tujuan dulu" }

  const admin = createAdminClient()

  // Pastikan tenant benar-benar ada (hindari titip role ke tenant hantu).
  const { data: tenant } = await admin
    .from("tenants")
    .select("id, name")
    .eq("id", tenantId)
    .maybeSingle()
  if (!tenant) return { error: "Keluarga (tenant) tidak ditemukan" }

  const { data: invited, error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { pending_tenant_id: tenantId, pending_role: "admin" },
    redirectTo: `${SITE_URL}/auth/callback?next=${encodeURIComponent("/auth/set-password")}`,
  })

  if (error) {
    // Email sudah terdaftar → tawarkan jalur tempel langsung tanpa undang ulang.
    if (/already been registered|already registered|already exists/i.test(error.message))
      return {
        error:
          "Email ini sudah punya akun. Tempelkan langsung ke keluarga lewat menu Anggota, atau minta user login.",
      }
    return { error: error.message }
  }

  revalidatePath("/admin/users")
  return {
    success: true,
    email,
    tenantName: tenant.name,
    userId: invited?.user?.id ?? null,
  }
}

/**
 * Dipanggil dari halaman /auth/set-password SETELAH user set password &
 * punya session valid. Membaca pending_tenant_id/pending_role dari metadata,
 * lalu membuat baris tenant_members (role=admin). Idempotent.
 */
export async function finalizeInvite() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Sesi tidak valid, silakan buka ulang link undangan" }

  const meta = (user.user_metadata ?? {}) as Record<string, unknown>
  const pendingTenantId = (meta.pending_tenant_id as string) || null
  const pendingRole = (meta.pending_role as string) || "admin"

  // Tidak ada assignment tertunda → tidak apa-apa (user mungkin sudah difinalisasi).
  if (!pendingTenantId) return { success: true, already: true }

  const role = pendingRole === "admin" ? "admin" : "member"
  const admin = createAdminClient()

  // Sudah jadi member tenant ini? jangan gandakan.
  const { data: existing } = await admin
    .from("tenant_members")
    .select("id, role")
    .eq("tenant_id", pendingTenantId)
    .eq("user_id", user.id)
    .maybeSingle()

  if (!existing) {
    const { error: insErr } = await admin.from("tenant_members").insert({
      tenant_id: pendingTenantId,
      user_id: user.id,
      role,
    })
    if (insErr) return { error: insErr.message }
  } else if (existing.role !== role) {
    const { error: updErr } = await admin
      .from("tenant_members")
      .update({ role })
      .eq("id", existing.id)
    if (updErr) return { error: updErr.message }
  }

  // Bersihkan metadata pending supaya finalize tidak jalan dua kali.
  await admin.auth.admin.updateUserById(user.id, {
    user_metadata: { ...meta, pending_tenant_id: null, pending_role: null },
  })

  revalidatePath("/dashboard")
  return { success: true }
}
