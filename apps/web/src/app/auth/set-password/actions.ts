"use server"

import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { finalizeInvite } from "@/app/admin/users/actions"

// Set password untuk user undangan. Dipanggil dari /auth/set-password SETELAH
// callback membuat sesi (user sudah terautentikasi lewat link invite). Setelah
// password diset, finalizeInvite() menempelkan user ke tenant (role admin).
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

  // Tempel user ke tenant sesuai undangan (idempotent).
  const res = await finalizeInvite()
  if (res && "error" in res && res.error)
    redirect(`/auth/set-password?error=${encodeURIComponent(res.error)}`)

  redirect("/dashboard")
}
