"use server"

import { redirect } from "next/navigation"
import { createClient, createAdminClient } from "@/lib/supabase/server"

// Membuat keluarga (tenant) baru untuk admin yang diundang tanpa tenant.
// Memanggil RPC self_create_tenant (SECURITY DEFINER, guard 1-user-1-tenant).
// Setelah sukses → lanjut ke wizard onboarding (step tambah anggota).
export async function createFamily(formData: FormData) {
  const name = ((formData.get("name") as string) || "").trim()

  if (name.length < 2)
    redirect(`/onboarding/family?error=${encodeURIComponent("Nama keluarga minimal 2 karakter")}`)

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user)
    redirect(`/login?error=${encodeURIComponent("Sesi habis. Silakan login lagi.")}`)

  // Panggil RPC. Pakai client ber-sesi user supaya auth.uid() di dalam fungsi
  // terisi benar (guard & kepemilikan berbasis auth.uid()).
  const { error } = await supabase.rpc("self_create_tenant", { p_name: name })

  if (error) {
    // Guard "already belongs to a tenant" → user sudah punya keluarga, teruskan.
    if (/already belongs to a tenant/i.test(error.message)) redirect("/onboarding/wizard")
    redirect(`/onboarding/family?error=${encodeURIComponent(error.message)}`)
  }

  redirect("/onboarding/wizard")
}

// Dipakai page guard: apakah user sudah punya tenant? (kalau ya, skip form ini)
export async function userHasTenant(): Promise<boolean> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return false

  const admin = createAdminClient()
  const { data } = await admin
    .from("tenant_members")
    .select("tenant_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle()

  return !!data
}
