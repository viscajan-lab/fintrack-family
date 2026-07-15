import { History, Plus, Pencil, Trash2 } from "lucide-react"
import { getAuditLogs, type AuditLog } from "@/lib/data/queries"
import { formatIDR } from "@/lib/utils"

export const dynamic = "force-dynamic"

const ACTION_META: Record<
  string,
  { label: string; icon: typeof Plus; className: string }
> = {
  create_transaction: { label: "Tambah transaksi", icon: Plus,   className: "text-emerald-600 bg-emerald-50" },
  update_transaction: { label: "Ubah transaksi",   icon: Pencil, className: "text-amber-600 bg-amber-50" },
  delete_transaction: { label: "Hapus transaksi",  icon: Trash2, className: "text-rose-600 bg-rose-50" },
}

function fmtWaktu(iso: string): string {
  return new Date(iso).toLocaleString("id-ID", {
    timeZone: "Asia/Jakarta",
    day:    "2-digit",
    month:  "short",
    year:   "numeric",
    hour:   "2-digit",
    minute: "2-digit",
  })
}

function ringkas(log: AuditLog): string {
  const row = (log.new_data ?? log.old_data) as Record<string, unknown> | null
  if (!row) return "—"
  const desc   = typeof row.description === "string" ? row.description : ""
  const amount = typeof row.amount === "number" ? row.amount : Number(row.amount)
  const parts: string[] = []
  if (desc) parts.push(desc)
  if (!Number.isNaN(amount) && amount) parts.push(formatIDR(amount))
  return parts.join(" · ") || "—"
}

export default async function RiwayatPage() {
  const logs = await getAuditLogs(100)

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Riwayat Aktivitas</h1>
        <p className="text-sm text-[var(--color-muted)] mt-0.5">
          Jejak audit transaksi keluarga — siapa mengubah apa dan kapan.
        </p>
      </div>

      {logs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <History className="w-10 h-10 text-[var(--color-muted)] mb-3" />
          <p className="text-sm text-[var(--color-muted)]">
            Belum ada aktivitas tercatat. Log akan muncul saat ada transaksi ditambah, diubah, atau dihapus.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-[var(--color-border)] overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[var(--color-surface)] text-left text-[var(--color-muted)]">
              <tr>
                <th className="px-4 py-3 font-medium">Aksi</th>
                <th className="px-4 py-3 font-medium">Detail</th>
                <th className="px-4 py-3 font-medium">Oleh</th>
                <th className="px-4 py-3 font-medium whitespace-nowrap">Waktu</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => {
                const meta = ACTION_META[log.action] ?? {
                  label: log.action,
                  icon: History,
                  className: "text-slate-600 bg-slate-100",
                }
                const Icon = meta.icon
                return (
                  <tr key={log.id} className="border-t border-[var(--color-border)]">
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${meta.className}`}>
                        <Icon className="w-3.5 h-3.5" />
                        {meta.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">{ringkas(log)}</td>
                    <td className="px-4 py-3 text-[var(--color-muted)]">
                      {log.actor_name ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-[var(--color-muted)] whitespace-nowrap">
                      {fmtWaktu(log.created_at)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
