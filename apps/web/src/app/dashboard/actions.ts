"use server"

import { revalidatePath } from "next/cache"
import { createClient }   from "@/lib/supabase/server"

async function getTenantId() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase
    .from("tenant_members")
    .select("tenant_id, telegram_id, joined_at")
    .eq("user_id", user.id)
    .order("telegram_id", { ascending: false, nullsFirst: false })
    .order("joined_at",   { ascending: true })
    .limit(1)
    .maybeSingle()
  return data?.tenant_id ?? null
}

// ─── Add Transaction ──────────────────────────────────────────────────────────

export async function addTransaction(formData: FormData) {
  const supabase  = await createClient()
  const tenantId  = await getTenantId()
  if (!tenantId) return { error: "Tidak terautentikasi" }

  const { data: { user } } = await supabase.auth.getUser()

  const description    = formData.get("description") as string
  const type           = formData.get("type") as "income" | "expense"
  const amount         = parseInt((formData.get("amount") as string).replace(/\D/g, ""), 10)
  const date           = formData.get("date") as string
  const category_name  = formData.get("category_name") as string | null
  const notes          = formData.get("notes") as string | null

  if (!description || !type || !amount || !date) {
    return { error: "Deskripsi, tipe, jumlah, dan tanggal wajib diisi" }
  }

  const { error } = await supabase.from("transactions").insert({
    tenant_id:        tenantId,
    recorded_by:      user!.id,
    description,
    type,
    amount,
    source:           "web",
    transaction_date: date,
    category_name:    category_name || null,
    notes:            notes || null,
  })

  if (error) return { error: error.message }

  revalidatePath("/dashboard")
  revalidatePath("/dashboard/transactions")
  return { success: true }
}

// ─── Add Budget ───────────────────────────────────────────────────────────────

export async function addBudget(formData: FormData) {
  const supabase  = await createClient()
  const tenantId  = await getTenantId()
  if (!tenantId) return { error: "Tidak terautentikasi" }

  const category_name = formData.get("category_name") as string
  const amount        = parseInt((formData.get("amount") as string).replace(/\D/g, ""), 10)
  const monthStr      = formData.get("month") as string   // YYYY-MM

  if (!category_name || !amount || !monthStr) {
    return { error: "Kategori, jumlah, dan bulan wajib diisi" }
  }

  const [yearPart, monthPart] = monthStr.split("-")
  const year  = parseInt(yearPart, 10)
  const month = parseInt(monthPart, 10)               // 1-12 (smallint)

  if (!year || !month) {
    return { error: "Format bulan tidak valid" }
  }

  // Upsert: jika sudah ada budget kategori ini di bulan+tahun ini, update
  const { error } = await supabase.from("budgets").upsert({
    tenant_id:     tenantId,
    category_name,
    amount,
    month,
    year,
  }, { onConflict: "tenant_id,category_name,month,year" })

  if (error) return { error: error.message }

  revalidatePath("/dashboard/budget")
  return { success: true }
}

// ─── Update Transaction ───────────────────────────────────────────────────────

export async function updateTransaction(id: string, formData: FormData) {
  const supabase  = await createClient()
  const tenantId  = await getTenantId()
  if (!tenantId) return { error: "Tidak terautentikasi" }

  const description   = formData.get("description") as string
  const type          = formData.get("type") as "income" | "expense"
  const amount        = parseInt((formData.get("amount") as string).replace(/\D/g, ""), 10)
  const date          = formData.get("date") as string
  const category_name = formData.get("category_name") as string | null
  const notes         = formData.get("notes") as string | null

  if (!description || !type || !amount || !date) {
    return { error: "Deskripsi, tipe, jumlah, dan tanggal wajib diisi" }
  }

  const { error } = await supabase
    .from("transactions")
    .update({
      description,
      type,
      amount,
      transaction_date: date,
      category_name: category_name || null,
      notes:         notes || null,
    })
    .eq("id", id)
    .eq("tenant_id", tenantId)   // RLS safety belt

  if (error) return { error: error.message }

  revalidatePath("/dashboard")
  revalidatePath("/dashboard/transactions")
  return { success: true }
}

// ─── Delete Transaction ───────────────────────────────────────────────────────

export async function deleteTransaction(id: string) {
  const supabase = await createClient()
  const tenantId = await getTenantId()
  if (!tenantId) return { error: "Tidak terautentikasi" }

  const { error } = await supabase
    .from("transactions")
    .delete()
    .eq("id", id)
    .eq("tenant_id", tenantId)   // RLS safety belt

  if (error) return { error: error.message }

  revalidatePath("/dashboard")
  revalidatePath("/dashboard/transactions")
  return { success: true }
}
