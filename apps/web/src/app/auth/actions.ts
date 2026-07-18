"use server"

import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"

export async function login(formData: FormData) {
  const email    = formData.get("email")    as string
  const password = formData.get("password") as string

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    console.error("[login] error:", error.message)
    redirect(`/login?error=${encodeURIComponent(error.message)}`)
  }
  redirect("/dashboard")
}

// Pendaftaran mandiri DIMATIKAN (model SaaS managed). Fungsi dipertahankan
// sebagai guard eksplisit: kalau ada yang mem-POST langsung ke action ini,
// mereka dilempar ke /login dengan pesan, bukan diam-diam bikin akun+tenant.
// Provisioning akun sekarang lewat:
//   - super_admin  -> daftarkan admin/kepala keluarga (app/admin/users/actions.ts)
//   - admin        -> daftarkan member keluarga        (app/dashboard/members/actions.ts)
// keduanya via undangan email (inviteUserByEmail) + set-password oleh user.
export async function register(_formData: FormData) {
  redirect(`/login?error=${encodeURIComponent("Pendaftaran mandiri dinonaktifkan. Hubungi admin untuk dibuatkan akun.")}`)
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect("/login")
}
