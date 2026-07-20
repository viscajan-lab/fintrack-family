"use server"

import { createClient } from "@/lib/supabase/server"

export type CreateTenantResult =
  | { error: null; tenantId: string; tenantName: string }
  | { error: string; tenantId?: never; tenantName?: never }

/**
 * Membuat keluarga (tenant) baru dari panel super_admin.
 * Hanya super_admin yang boleh memanggil (guard di DB via is_super_admin()).
 *
 * @param formData  { name, slug, plan }
 */
export async function createTenant(formData: FormData): Promise<CreateTenantResult> {
  const name = (formData.get("name") as string | null)?.trim()
  const slug = (formData.get("slug") as string | null)?.trim()
  const plan = (formData.get("plan") as string | null) || "free"

  // Validasi dasar
  if (!name) return { error: "Nama keluarga wajib diisi." }
  if (name.length < 2) return { error: "Nama keluarga minimal 2 karakter." }
  if (!slug) return { error: "Slug wajib diisi." }
  if (!/^[a-z0-9-]+$/.test(slug)) {
    return { error: "Slug hanya boleh huruf kecil, angka, dan tanda hubung (-)." }
  }
  if (!["free", "family", "self_hosted"].includes(plan)) {
    return { error: "Paket tidak valid." }
  }

  const supabase = await createClient()

  // Cek apakah slug sudah dipakai
  const { data: existing } = await supabase
    .from("tenants")
    .select("id")
    .eq("slug", slug)
    .maybeSingle()

  if (existing) {
    return { error: `Slug "${slug}" sudah dipakai. Gunakan slug lain.` }
  }

  // Panggil RPC untuk membuat tenant dan langsung jadikan pemanggil sebagai admin
  const { data, error } = await supabase.rpc("admin_create_tenant", {
    p_name: name,
    p_slug: slug,
    p_plan: plan,
  })

  if (error) {
    // is_super_admin() guard di DB akan menolak non-super-admin
    if (error.message.includes("Only super_admin")) {
      return { error: "Hanya super admin yang boleh membuat keluarga." }
    }
    return { error: `Gagal membuat keluarga: ${error.message}` }
  }

  const tenantId = data as string
  return { error: null, tenantId, tenantName: name }
}

/**
 * Menghasilkan slug otomatis dari nama keluarga.
 * Dipanggil dari client via server action.
 */
export async function generateSlug(name: string): Promise<string> {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .substring(0, 50)
}