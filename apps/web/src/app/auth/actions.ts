"use server"

import { redirect } from "next/navigation"
import { createClient, createAdminClient } from "@/lib/supabase/server"

export async function login(formData: FormData) {
  const email    = formData.get("email")    as string
  const password = formData.get("password") as string

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) redirect(`/login?error=${encodeURIComponent(error.message)}`)
  redirect("/dashboard")
}

export async function register(formData: FormData) {
  const email      = formData.get("email")       as string
  const password   = formData.get("password")    as string
  const familyName = formData.get("family_name") as string

  const supabase = await createClient()

  // 1. Signup via anon client (sets session cookie)
  const { data, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { family_name: familyName } },
  })

  if (signUpError) redirect(`/register?error=${encodeURIComponent(signUpError.message)}`)

  // 2. Buat tenant + tambah user sebagai admin — pakai admin client (bypass RLS)
  if (data.user) {
    const admin = createAdminClient()

    // Generate slug unik
    const baseSlug = familyName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
    const slug     = `${baseSlug}-${Date.now().toString(36)}`

    const { data: tenant, error: tenantErr } = await admin
      .from("tenants")
      .insert({ name: familyName, slug, plan: "free", storage_type: "supabase" })
      .select("id")
      .single()

    if (!tenantErr && tenant) {
      const displayName = email.split("@")[0]
      await admin.from("tenant_members").insert({
        tenant_id:    tenant.id,
        user_id:      data.user.id,
        role:         "admin",
        display_name: displayName,
      })
    }
  }

  redirect("/dashboard")
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect("/login")
}
