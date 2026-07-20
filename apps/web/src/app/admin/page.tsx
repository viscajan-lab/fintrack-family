import { redirect } from "next/navigation"
import { ShieldCheck, Users, UserCheck, Home, PlusCircle } from "lucide-react"
import { getMyRole, getAdminMonitoring, type AdminMonitorRow, getAdminOverview, type AdminTenantRow } from "@/lib/data/queries"
import Link from "next/link"

export const dynamic = "force-dynamic"

const ACTIVE_WINDOW_DAYS = 30
const DAY_MS = 86_400_000

function daysSince(iso: string): number {
  return (Date.now() - new Date(iso).getTime()) / DAY_MS
}

// "Terakhir login" dalam bahasa manusia (WIB-agnostic — relatif ke sekarang).
function fmtLastSeen(iso: string | null): string {
  if (!iso) return "Belum pernah login"
  const d = daysSince(iso)
  if (d < 1 / 24) return "Baru saja"
  if (d < 1) return `${Math.floor(d * 24)} jam lalu`
  if (d < 30) return `${Math.floor(d)} hari lalu`
  if (d < 365) return `${Math.floor(d / 30)} bulan lalu`
  return `${Math.floor(d / 365)} tahun lalu`
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("id-ID", {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  })
}

type Status = "active" | "idle" | "never"

function statusOf(iso: string | null): Status {
  if (!iso) return "never"
  return daysSince(iso) <= ACTIVE_WINDOW_DAYS ? "active" : "idle"
}

const STATUS_META: Record<Status, { label: string; cls: string; dot: string }> = {
  active: { label: "Aktif",        cls: "bg-green-500/10 text-green-600 dark:text-green-400",  dot: "bg-green-500" },
  idle:   { label: "Tidak aktif",  cls: "bg-amber-500/10 text-amber-600 dark:text-amber-400",  dot: "bg-amber-500" },
  never:  { label: "Belum login",  cls: "bg-[var(--color-border)] text-[var(--color-muted)]", dot: "bg-[var(--color-muted)]" },
}

const ROLE_LABEL: Record<string, string> = {
  super_admin: "Super Admin",
  admin:       "Admin",
}

export default async function AdminPage() {
  const role = await getMyRole()
  if (role !== "super_admin") redirect("/dashboard")

  const [admins, adminOverview] = await Promise.all([
    getAdminMonitoring(),
    getAdminOverview(),
  ])

  const activeAdmins = admins.filter((a) => statusOf(a.last_sign_in_at) === "active").length

  const { stats, tenants } = adminOverview

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ShieldCheck size={24} className="text-brand-500" /> Dashboard Admin
        </h1>
        <p className="text-sm text-[var(--color-muted)] mt-0.5">
          Ringkasan seluruh sistem FinTrack. Hanya untuk super admin.
        </p>
      </div>

      {/* ── Kartu Ringkasan Global ─────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard icon={<Home size={18} />}        label="Total Keluarga"         value={stats.tenant_count.toLocaleString("id-ID")} />
        <StatCard icon={<Users size={18} />}       label="Total Anggota"          value={stats.member_count.toLocaleString("id-ID")} />
        <StatCard icon={<UserCheck size={18} />}   label="Total Admin Aktif"      value={activeAdmins.toLocaleString("id-ID")} />
        <StatCard icon={<ShieldCheck size={18} />} label="Total Transaksi"        value={stats.tx_count.toLocaleString("id-ID")} />
      </div>

      {/* ── Daftar Keluarga (Tenants) ────────────────────────── */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--color-border)] flex items-center justify-between">
          <h2 className="font-semibold flex items-center gap-2"><Home size={18} /> Daftar Keluarga</h2>
          <Link
            href="/admin/tenants/create"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold text-white bg-brand-500 hover:bg-brand-600 transition-colors"
          >
            <PlusCircle size={16} /> Buat Keluarga Baru
          </Link>
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
                  <TenantRow key={t.id} t={t} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Tabel monitoring admin ─────────────────────────── */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--color-border)]">
          <h2 className="font-semibold flex items-center gap-2"><Users size={18} /> Monitoring Admin</h2>
        </div>

        {admins.length === 0 ? (
          <p className="px-5 py-8 text-sm text-[var(--color-muted)] text-center">Belum ada admin terdaftar.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[var(--color-muted)] border-b border-[var(--color-border)]">
                  <th className="px-5 py-3 font-medium">Admin</th>
                  <th className="px-5 py-3 font-medium">Keluarga</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium text-right">Anggota</th>
                  <th className="px-5 py-3 font-medium text-right">Terakhir login</th>
                </tr>
              </thead>
              <tbody>
                {admins.map((a) => (
                  <AdminRow key={a.member_id} a={a} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function AdminRow({ a }: { a: AdminMonitorRow }) {
  const status = statusOf(a.last_sign_in_at)
  const meta   = STATUS_META[status]

  return (
    <tr className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-border)]/30">
      <td className="px-5 py-3">
        <div className="font-medium flex items-center gap-2">
          {a.display_name || a.email.split("@")[0]}
          {a.role === "super_admin" && (
            <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-brand-500/10 text-brand-600 dark:text-brand-400">
              {ROLE_LABEL[a.role]}
            </span>
          )}
        </div>
        <div className="text-xs text-[var(--color-muted)]">{a.email}</div>
      </td>
      <td className="px-5 py-3">{a.tenant_name}</td>
      <td className="px-5 py-3">
        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold ${meta.cls}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
          {meta.label}
        </span>
      </td>
      <td className="px-5 py-3 text-right tabular-nums">{a.member_count.toLocaleString("id-ID")}</td>
      <td className="px-5 py-3 text-right">
        <div className="text-[var(--color-foreground)]">{fmtLastSeen(a.last_sign_in_at)}</div>
        {a.last_sign_in_at && (
          <div className="text-xs text-[var(--color-muted)]">{fmtDateTime(a.last_sign_in_at)}</div>
        )}
      </td>
    </tr>
  )
}

function TenantRow({ t }: { t: AdminTenantRow }) {
  return (
    <tr className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-border)]/30">
      <td className="px-5 py-3">
        <div className="font-medium">{t.name}</div>
        <div className="text-xs text-[var(--color-muted)] font-mono">{t.slug}</div>
      </td>
      <td className="px-5 py-3">{t.plan}</td>
      <td className="px-5 py-3 text-right tabular-nums">{t.member_count.toLocaleString("id-ID")}</td>
      <td className="px-5 py-3 text-right tabular-nums">{t.tx_count.toLocaleString("id-ID")}</td>
      <td className="px-5 py-3 text-right text-xs text-[var(--color-muted)]">{fmtDateTime(t.created_at)}</td>
    </tr>
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
