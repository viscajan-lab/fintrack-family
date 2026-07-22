"use server"

import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { userHasTenant } from "@/app/onboarding/family/actions"

export async function login(formData: FormData) {
  const email    = formData.get("email")    as string
  const password = formData.get("password") as string

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    console.error("[login] error:", error.message)
    redirect(`/login?error=${encodeURIComponent(error.message)}`)
  }

  // User yang belum menyelesaikan onboarding (belum punya tenant — mis. diundang
  // sbg admin tanpa keluarga, atau set password tapi tak lanjut buat keluarga)
  // dilempar ke /onboarding/family, bukan mendarat di /dashboard kosong. Konsisten
  // dgn alur set-password. userHasTenant() aman dipanggil di sini (server action).
  if (!(await userHasTenant())) redirect("/onboarding/family")

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

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://fintrack-family.vercel.app"

// Lupa/atur password (self-service). Dipakai dua kasus:
//   1. User yang link undangannya kadaluarsa & belum pernah set password.
//   2. User lama yang lupa password.
// Supabase mengirim email recovery. Link recovery → /auth/callback (type=recovery)
// atau fragment #type=recovery (ditangani InviteFragmentHandler) → keduanya
// mengarahkan ke /auth/set-password untuk membuat password baru.
//
// CATATAN privasi: selalu balikkan sukses walau email tak terdaftar, supaya
// tidak membocorkan email mana yang punya akun (account enumeration).
export async function resetPassword(formData: FormData) {
  const email = ((formData.get("email") as string) || "").trim().toLowerCase()

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    redirect(`/forgot-password?error=${encodeURIComponent("Email tidak valid")}`)

  const supabase = await createClient()
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${SITE_URL}/auth/callback?next=${encodeURIComponent("/auth/set-password")}`,
  })

  // Jangan bocorkan error selain kegagalan tak terduga. Rate-limit dsb tetap
  // ditampilkan generik.
  if (error) console.error("[resetPassword] error:", error.message)

  redirect("/forgot-password?sent=1")
}
