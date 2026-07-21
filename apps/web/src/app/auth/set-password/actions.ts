"use server"

import { redirect } from "next/navigation"
import { createClient, createAdminClient } from "@/lib/supabase/server"
import { finalizeInvite } from "@/app/admin/users/actions"

// Set password untuk user undangan. Dipanggil dari /auth/set-password SETELAH
// callback membuat sesi (user sudah terautentikasi lewat link invite). Setelah
// password diset, finalizeInvite() menempelkan user ke tenant (kalau diundang
// dengan tenant). Kalau user BELUM punya tenant sama sekali (admin baru tanpa
// keluarga) → arahkan ke /onboarding/family untuk membuat keluarganya sendiri.
export async function setPassword(formData: FormData) {
  const password = (formData.get("password") as string) || ""
  const confirm = (formData.get("confirm") as string) || ""

  if (password.length < 8)
    redirect(`/auth/set-password?error=${encodeURIComponent("Password minimal 8 karakter")}`)
  if (password !== confirm)
    redirect(`/auth/set-password?error=${encodeURIComponent("Konfirmasi password tidak cocok")}`)

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user)
    redirect(`/login?error=${encodeURIComponent("Sesi habis. Buka ulang link undangan dari email.")}`)

  const { error } = await supabase.auth.updateUser({ password })
  if (error)
    redirect(`/auth/set-password?error=${encodeURIComponent(error.message)}`)

  // Tempel user ke tenant sesuai undangan (idempotent). Kalau undangan tanpa
  // tenant, finalizeInvite mengembalikan { already: true } tanpa attach apa pun.
  const res = await finalizeInvite()
  if (res && "error" in res && res.error)
    redirect(`/auth/set-password?error=${encodeURIComponent(res.error)}`)

  // Cek keanggotaan: kalau user belum jadi member tenant mana pun, arahkan ke
  // pembuatan keluarga sendiri. Kalau sudah, lanjut ke dashboard seperti biasa.
  const admin = createAdminClient()
  const { data: membership } = await admin
    .from("tenant_members")
    .select("tenant_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle()

  if (!membership) redirect("/onboarding/family")

  redirect("/dashboard")
}
