import { redirect } from "next/navigation"
import { UserCog } from "lucide-react"
import { getMyRole, getAdminOverview } from "@/lib/data/queries"
import { InviteAdminForm, type TenantOption } from "@/components/admin/InviteAdminForm"

export const dynamic = "force-dynamic"

// Panel super_admin: daftarkan admin (kepala keluarga) baru ke tenant existing
// via undangan email. Gate ganda (layout + di sini) — defense in depth.
export default async function AdminUsersPage() {
  const role = await getMyRole()
  if (role !== "super_admin") redirect("/dashboard")

  const { tenants } = await getAdminOverview()
  const options: TenantOption[] = tenants.map((t) => ({
    id: t.id,
    name: t.name,
    slug: t.slug,
  }))

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <UserCog size={24} className="text-brand-500" /> Kelola Admin
        </h1>
        <p className="text-sm text-[var(--color-muted)] mt-0.5">
          Daftarkan admin (kepala keluarga) baru ke keluarga yang sudah ada lewat undangan email.
        </p>
      </div>

      <InviteAdminForm tenants={options} />

      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--color-border)]">
          <h2 className="font-semibold">Keluarga Terdaftar</h2>
        </div>
        {options.length === 0 ? (
          <p className="px-5 py-8 text-sm text-[var(--color-muted)] text-center">Belum ada keluarga terdaftar.</p>
        ) : (
          <ul className="divide-y divide-[var(--color-border)]">
            {options.map((t) => (
              <li key={t.id} className="px-5 py-3 flex items-center justify-between">
                <span className="font-medium">{t.name}</span>
                <span className="text-xs text-[var(--color-muted)] font-mono">{t.slug}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
