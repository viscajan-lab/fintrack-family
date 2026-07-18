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

// ─── Audit log helper (best-effort, tidak boleh menggagalkan aksi utama) ──────

async function logAudit(params: {
  action: string
  record_id?: string | null
  old_data?: unknown
  new_data?: unknown
}) {
  try {
    const supabase = await createClient()
    const tenantId = await getTenantId()
    if (!tenantId) return
    const { data: { user } } = await supabase.auth.getUser()

    await supabase.from("audit_logs").insert({
      tenant_id:  tenantId,
      user_id:    user?.id ?? null,
      action:     params.action,
      table_name: "transactions",
      record_id:  params.record_id ?? null,
      old_data:   params.old_data ?? null,
      new_data:   params.new_data ?? null,
    })
  } catch {
    // Audit tidak boleh bikin aksi utama gagal — telan error diam-diam.
  }
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
  const member_id      = formData.get("member_id") as string | null

  if (!description || !type || !amount || !date) {
    return { error: "Deskripsi, tipe, jumlah, dan tanggal wajib diisi" }
  }

  const { data: inserted, error } = await supabase.from("transactions").insert({
    tenant_id:        tenantId,
    recorded_by:      user!.id,
    description,
    type,
    amount,
    source:           "web",
    transaction_date: date,
    category_name:    category_name || null,
    notes:            notes || null,
    member_id:        member_id || null,
  }).select().single()

  if (error) return { error: error.message }

  await logAudit({
    action:    "create_transaction",
    record_id: inserted?.id,
    new_data:  inserted,
  })

  revalidatePath("/dashboard")
  revalidatePath("/dashboard/transactions")
  revalidatePath("/dashboard/kantong")
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

// ─── Set Jatah Kantong Anggota (admin-only, upsert per bulan) ─────────────────

export async function setMemberAllowance(formData: FormData) {
  const supabase  = await createClient()
  const tenantId  = await getTenantId()
  if (!tenantId) return { error: "Tidak terautentikasi" }

  const { data: { user } } = await supabase.auth.getUser()

  // Hanya admin yang boleh set jatah
  const { data: me } = await supabase
    .from("tenant_members")
    .select("role")
    .eq("tenant_id", tenantId)
    .eq("user_id", user!.id)
    .maybeSingle()
  if (me?.role !== "admin") {
    return { error: "Hanya admin yang bisa mengatur jatah kantong" }
  }

  const member_id = formData.get("member_id") as string
  const amount    = parseInt((formData.get("amount") as string).replace(/\D/g, ""), 10)
  const monthStr  = formData.get("month") as string   // YYYY-MM

  if (!member_id || !monthStr || Number.isNaN(amount) || amount < 0) {
    return { error: "Anggota, jumlah, dan bulan wajib diisi (jumlah tidak boleh negatif)" }
  }

  const [yearPart, monthPart] = monthStr.split("-")
  const year  = parseInt(yearPart, 10)
  const month = parseInt(monthPart, 10)               // 1-12 (smallint)
  if (!year || !month || month < 1 || month > 12) {
    return { error: "Format bulan tidak valid" }
  }

  // Pastikan member_id memang anggota tenant ini (cegah set jatah lintas-tenant)
  const { data: target } = await supabase
    .from("tenant_members")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("id", member_id)
    .maybeSingle()
  if (!target) {
    return { error: "Anggota tidak ditemukan di keluarga ini" }
  }

  // Upsert: jika sudah ada jatah anggota ini di bulan+tahun ini, update
  const { error } = await supabase.from("member_allowances").upsert({
    tenant_id: tenantId,
    member_id,
    amount,
    month,
    year,
  }, { onConflict: "tenant_id,member_id,month,year" })

  if (error) return { error: error.message }

  revalidatePath("/dashboard/kantong")
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

  // Ambil data lama untuk audit (old_data) sebelum di-update.
  const { data: oldRow } = await supabase
    .from("transactions")
    .select("*")
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .maybeSingle()

  const newValues = {
    description,
    type,
    amount,
    transaction_date: date,
    category_name: category_name || null,
    notes:         notes || null,
  }

  const { data: updated, error } = await supabase
    .from("transactions")
    .update(newValues)
    .eq("id", id)
    .eq("tenant_id", tenantId)   // RLS safety belt
    .select()
    .maybeSingle()

  if (error) return { error: error.message }

  await logAudit({
    action:    "update_transaction",
    record_id: id,
    old_data:  oldRow,
    new_data:  updated,
  })

  revalidatePath("/dashboard")
  revalidatePath("/dashboard/transactions")
  return { success: true }
}

// ─── Recurring rules (tagihan/langganan berulang) ─────────────────────────────

export async function addRecurring(formData: FormData) {
  const supabase  = await createClient()
  const tenantId  = await getTenantId()
  if (!tenantId) return { error: "Tidak terautentikasi" }

  const description   = formData.get("description") as string
  const type          = (formData.get("type") as "income" | "expense") || "expense"
  const category_name = formData.get("category_name") as string
  const amount        = parseInt((formData.get("amount") as string).replace(/\D/g, ""), 10)
  const day_of_month  = parseInt(formData.get("day_of_month") as string, 10)
  const mode          = (formData.get("mode") as "auto" | "reminder") || "auto"

  if (!description || !category_name || !amount || !day_of_month) {
    return { error: "Nama, kategori, nominal, dan tanggal wajib diisi" }
  }
  if (day_of_month < 1 || day_of_month > 31) {
    return { error: "Tanggal harus antara 1–31" }
  }

  const { error } = await supabase.from("recurring_rules").insert({
    tenant_id:     tenantId,
    type,
    amount,
    category_name,
    description,
    day_of_month,
    mode,
    active:        true,
  })

  if (error) return { error: error.message }

  revalidatePath("/dashboard/recurring")
  return { success: true }
}

export async function updateRecurring(id: string, formData: FormData) {
  const supabase  = await createClient()
  const tenantId  = await getTenantId()
  if (!tenantId) return { error: "Tidak terautentikasi" }

  const description   = formData.get("description") as string
  const type          = (formData.get("type") as "income" | "expense") || "expense"
  const category_name = formData.get("category_name") as string
  const amount        = parseInt((formData.get("amount") as string).replace(/\D/g, ""), 10)
  const day_of_month  = parseInt(formData.get("day_of_month") as string, 10)
  const mode          = (formData.get("mode") as "auto" | "reminder") || "auto"

  if (!description || !category_name || !amount || !day_of_month) {
    return { error: "Nama, kategori, nominal, dan tanggal wajib diisi" }
  }
  if (day_of_month < 1 || day_of_month > 31) {
    return { error: "Tanggal harus antara 1–31" }
  }

  const { error } = await supabase
    .from("recurring_rules")
    .update({ description, type, amount, category_name, day_of_month, mode })
    .eq("id", id)
    .eq("tenant_id", tenantId)   // RLS safety belt

  if (error) return { error: error.message }

  revalidatePath("/dashboard/recurring")
  return { success: true }
}

export async function toggleRecurring(id: string, active: boolean) {
  const supabase  = await createClient()
  const tenantId  = await getTenantId()
  if (!tenantId) return { error: "Tidak terautentikasi" }

  const { error } = await supabase
    .from("recurring_rules")
    .update({ active })
    .eq("id", id)
    .eq("tenant_id", tenantId)   // RLS safety belt

  if (error) return { error: error.message }

  revalidatePath("/dashboard/recurring")
  return { success: true }
}

export async function deleteRecurring(id: string) {
  const supabase = await createClient()
  const tenantId = await getTenantId()
  if (!tenantId) return { error: "Tidak terautentikasi" }

  const { error } = await supabase
    .from("recurring_rules")
    .delete()
    .eq("id", id)
    .eq("tenant_id", tenantId)   // RLS safety belt

  if (error) return { error: error.message }

  revalidatePath("/dashboard/recurring")
  return { success: true }
}

// ─── Delete Transaction ───────────────────────────────────────────────────────

export async function deleteTransaction(id: string) {
  const supabase = await createClient()
  const tenantId = await getTenantId()
  if (!tenantId) return { error: "Tidak terautentikasi" }

  // Ambil data lama untuk audit (old_data) sebelum dihapus.
  const { data: oldRow } = await supabase
    .from("transactions")
    .select("*")
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .maybeSingle()

  const { error } = await supabase
    .from("transactions")
    .delete()
    .eq("id", id)
    .eq("tenant_id", tenantId)   // RLS safety belt

  if (error) return { error: error.message }

  await logAudit({
    action:    "delete_transaction",
    record_id: id,
    old_data:  oldRow,
  })

  revalidatePath("/dashboard")
  revalidatePath("/dashboard/transactions")
  return { success: true }
}

// ─── Savings goals (target tabungan keluarga) ─────────────────────────────────

export async function addSavingsGoal(formData: FormData) {
  const supabase = await createClient()
  const tenantId = await getTenantId()
  if (!tenantId) return { error: "Tidak terautentikasi" }

  const name     = (formData.get("name") as string)?.trim()
  const target   = parseInt(((formData.get("target_amount") as string) || "").replace(/\D/g, ""), 10)
  const deadline = (formData.get("deadline") as string) || null
  const note     = ((formData.get("note") as string) || "").trim() || null

  if (!name)                  return { error: "Nama target wajib diisi" }
  if (!target || target <= 0) return { error: "Target nominal harus lebih dari 0" }

  const { error } = await supabase.from("savings_goals").insert({
    tenant_id:     tenantId,
    name,
    target_amount: target,
    deadline,
    note,
  })

  if (error) return { error: error.message }

  revalidatePath("/dashboard/savings")
  return { success: true }
}

export async function addSavingsContribution(id: string, formData: FormData) {
  const supabase = await createClient()
  const tenantId = await getTenantId()
  if (!tenantId) return { error: "Tidak terautentikasi" }

  const delta = parseInt(((formData.get("amount") as string) || "").replace(/\D/g, ""), 10)
  if (!delta || delta === 0) return { error: "Jumlah setoran wajib diisi" }

  // Ambil nilai saat ini (RLS batasi ke tenant sendiri)
  const { data: goal, error: readErr } = await supabase
    .from("savings_goals")
    .select("saved_amount, target_amount")
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .maybeSingle()

  if (readErr) return { error: readErr.message }
  if (!goal)   return { error: "Target tidak ditemukan" }

  const newSaved = Math.max((goal.saved_amount ?? 0) + delta, 0)
  const achieved = newSaved >= (goal.target_amount ?? 0)

  const { error } = await supabase
    .from("savings_goals")
    .update({
      saved_amount: newSaved,
      achieved_at:  achieved ? new Date().toISOString() : null,
      updated_at:   new Date().toISOString(),
    })
    .eq("id", id)
    .eq("tenant_id", tenantId)   // RLS safety belt

  if (error) return { error: error.message }

  revalidatePath("/dashboard/savings")
  return { success: true }
}

export async function deleteSavingsGoal(id: string) {
  const supabase = await createClient()
  const tenantId = await getTenantId()
  if (!tenantId) return { error: "Tidak terautentikasi" }

  const { error } = await supabase
    .from("savings_goals")
    .delete()
    .eq("id", id)
    .eq("tenant_id", tenantId)   // RLS safety belt

  if (error) return { error: error.message }

  revalidatePath("/dashboard/savings")
  return { success: true }
}

// ─── Categories (kelola kategori custom keluarga) ────────────────────────────

const CAT_TYPES = ["income", "expense", "both"] as const

// Kategori dipakai di banyak form; revalidasi semua route yang menampilkannya.
function revalidateCategoryConsumers() {
  revalidatePath("/dashboard/categories")
  revalidatePath("/dashboard/transactions")
  revalidatePath("/dashboard/recurring")
  revalidatePath("/dashboard/budget")
}

export async function addCategory(formData: FormData) {
  const supabase = await createClient()
  const tenantId = await getTenantId()
  if (!tenantId) return { error: "Tidak terautentikasi" }

  const name  = ((formData.get("name") as string) ?? "").trim()
  const emoji = ((formData.get("emoji") as string) ?? "").trim()
  const type  = formData.get("type") as string

  if (!name) return { error: "Nama kategori wajib diisi" }
  if (!CAT_TYPES.includes(type as (typeof CAT_TYPES)[number]))
    return { error: "Tipe kategori tidak valid" }

  const { error } = await supabase.from("categories").insert({
    tenant_id: tenantId,
    name,
    emoji: emoji || null,
    type,
  })

  if (error) {
    if (error.code === "23505") return { error: "Kategori dengan nama itu sudah ada" }
    return { error: error.message }
  }

  revalidateCategoryConsumers()
  return { success: true }
}

export async function updateCategory(id: string, formData: FormData) {
  const supabase = await createClient()
  const tenantId = await getTenantId()
  if (!tenantId) return { error: "Tidak terautentikasi" }

  const name  = ((formData.get("name") as string) ?? "").trim()
  const emoji = ((formData.get("emoji") as string) ?? "").trim()
  const type  = formData.get("type") as string

  if (!name) return { error: "Nama kategori wajib diisi" }
  if (!CAT_TYPES.includes(type as (typeof CAT_TYPES)[number]))
    return { error: "Tipe kategori tidak valid" }

  const { error } = await supabase
    .from("categories")
    .update({ name, emoji: emoji || null, type })
    .eq("id", id)
    .eq("tenant_id", tenantId)   // RLS safety belt — cegah edit kategori default (tenant_id NULL)

  if (error) {
    if (error.code === "23505") return { error: "Kategori dengan nama itu sudah ada" }
    return { error: error.message }
  }

  revalidateCategoryConsumers()
  return { success: true }
}

export async function deleteCategory(id: string) {
  const supabase = await createClient()
  const tenantId = await getTenantId()
  if (!tenantId) return { error: "Tidak terautentikasi" }

  const { error } = await supabase
    .from("categories")
    .delete()
    .eq("id", id)
    .eq("tenant_id", tenantId)   // RLS safety belt — kategori default (tenant_id NULL) tak akan match

  if (error) return { error: error.message }

  revalidateCategoryConsumers()
  return { success: true }
}
