import { redirect } from "next/navigation"
import { Building2, Users, Receipt, ShieldCheck } from "lucide-react"
import { getMyRole, getAdminOverview } from "@/lib/data/queries"

export const dynamic = "force-dynamic"

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })
}

const PLAN_STYLE: Record<string, string> = {
  free:        "bg-[var(--color-border)] text-[var(--color-muted)]",
  family:      "bg-brand-500/10 text-brand-600 dark:text-brand-400",
  self_hosted: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
}

export default async function AdminPage() {
  // Gate ganda: layout sudah menjaga, ini defense in depth kalau page dipakai langsung.
  const role = await getMyRole()
  if (role !== "super_admin") redirect("/dashboard")

  const { stats, tenants } = await getAdminOverview()

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ShieldCheck size={24} className="text-brand-500" /> Panel Admin
        </h1>
        <p className="text-sm text-[var(--color-muted)] mt-0.5">
          Ringkasan seluruh keluarga (tenant) di FinTrack. Hanya untuk super admin.
        </p>
      </div>

      {/* ── Kartu statistik global ─────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={<Building2 size={18} />} label="Keluarga"  value={stats.tenant_count.toLocaleString("id-ID")} />
        <StatCard icon={<Users size={18} />}     label="Anggota"   value={stats.member_count.toLocaleString("id-ID")} />
        <StatCard icon={<ShieldCheck size={18} />} label="Admin"   value={stats.admin_count.toLocaleString("id-ID")} />
        <StatCard icon={<Receipt size={18} />}   label="Transaksi" value={stats.tx_count.toLocaleString("id-ID")} />
      </div>

      {/* ── Tabel tenant ───────────────────────────────────── */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--color-border)]">
          <h2 className="font-semibold">Daftar Keluarga</h2>
        </div>

        {tenants.length === 0 ? (
          <p className="px-5 py-8 text-sm text-[var(--color-muted)] text-center">Belum ada keluarga terdaftar.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[var(--color-muted)] border-b border-[var(--color-border)]">
                  <th className="px-5 py-3 font-medium">Keluarga</th>
                  <th className="px-5 py-3 font-medium">Paket</th>
                  <th className="px-5 py-3 font-medium text-right">Anggota</th>
                  <th className="px-5 py-3 font-medium text-right">Transaksi</th>
                  <th className="px-5 py-3 font-medium text-right">Dibuat</th>
                </tr>
              </thead>
              <tbody>
                {tenants.map((t) => (
                  <tr key={t.id} className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-border)]/30">
                    <td className="px-5 py-3">
                      <div className="font-medium">{t.name}</div>
                      <div className="text-xs text-[var(--color-muted)] font-mono">{t.slug}</div>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${PLAN_STYLE[t.plan] ?? PLAN_STYLE.free}`}>
                        {t.plan}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums">{t.member_count.toLocaleString("id-ID")}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{t.tx_count.toLocaleString("id-ID")}</td>
                    <td className="px-5 py-3 text-right text-[var(--color-muted)]">{fmtDate(t.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <div className="flex items-center gap-2 text-sm text-[var(--color-muted)]">
        <span className="text-brand-500">{icon}</span>
        {label}
      </div>
      <div className="mt-2 text-2xl font-bold tabular-nums">{value}</div>
    </div>
  )
}
