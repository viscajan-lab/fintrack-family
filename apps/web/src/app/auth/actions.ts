"use server"

import { redirect } from "next/navigation"
import { createClient, createAdminClient } from "@/lib/supabase/server"

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

export async function register(formData: FormData) {
  const email      = formData.get("email")       as string
  const password   = formData.get("password")    as string
  const familyName = formData.get("family_name") as string

  const admin = createAdminClient()

  // 1. Buat user via admin — langsung confirmed, tidak butuh email verifikasi
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { family_name: familyName },
  })

  if (createErr) {
    console.error("[register] createUser error:", createErr.message)
    redirect(`/register?error=${encodeURIComponent(createErr.message)}`)
  }

  const userId = created.user.id

  // 2. Buat tenant + tambah user sebagai admin
  const slug = `${familyName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${Date.now().toString(36)}`
  const { data: tenant, error: tenantErr } = await admin
    .from("tenants")
    .insert({ name: familyName, slug, plan: "free", storage_type: "supabase" })
    .select("id")
    .single()

  if (!tenantErr && tenant) {
    await admin.from("tenant_members").insert({
      tenant_id:    tenant.id,
      user_id:      userId,
      role:         "admin",
      display_name: email.split("@")[0],
    })
  }

  // 3. Sign in via anon client untuk set session cookie
  const supabase = await createClient()
  const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password })
  if (signInErr) {
    console.error("[register] signIn after create error:", signInErr.message)
    redirect(`/login?error=${encodeURIComponent("Akun dibuat, silakan login")}`)
  }

  redirect("/dashboard")
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect("/login")
}
