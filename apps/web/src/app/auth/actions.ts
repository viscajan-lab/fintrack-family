"use server"

import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"

export async function login(formData: FormData) {
  const email    = formData.get("email")    as string
  const password = formData.get("password") as string

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`)
  }

  redirect("/dashboard")
}

export async function register(formData: FormData) {
  const email       = formData.get("email")        as string
  const password    = formData.get("password")     as string
  const familyName  = formData.get("family_name")  as string

  const supabase = await createClient()

  // 1. Daftar user
  const { data, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { family_name: familyName } },
  })

  if (signUpError) {
    redirect(`/register?error=${encodeURIComponent(signUpError.message)}`)
  }

  // 2. Buat tenant keluarga (RPC ke DB)
  if (data.user) {
    await supabase.rpc("create_tenant_for_user", {
      p_user_id:    data.user.id,
      p_name:       familyName,
    })
  }

  // After register → onboarding to pick storage provider
  redirect("/onboarding")
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect("/login")
}
