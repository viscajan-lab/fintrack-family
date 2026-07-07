"use client"

import { useState, useMemo, useTransition, useRef, useEffect } from "react"
import { Search, TrendingUp, TrendingDown, Trash2, Pencil, Loader2, Download, FileText, FileSpreadsheet } from "lucide-react"
import { formatIDR, cn } from "@/lib/utils"
import { deleteTransaction } from "@/app/dashboard/actions"
import { exportTransactionsCSV, exportTransactionsPDF } from "@/lib/export"
import { EditTransactionModal } from "./EditTransactionModal"
import type { TxRow } from "@/lib/data/queries"

type FilterType = "all" | "income" | "expense"

export function TransactionsList({ initialRows }: { initialRows: TxRow[] }) {
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState<FilterType>("all")
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [delError,  setDelError]  = useState<string | null>(null)
  const [editTx,    setEditTx]    = useState<TxRow | null>(null)
  const [exportOpen, setExportOpen] = useState(false)
  const exportRef = useRef<HTMLDivElement>(null)
  const [, startDelete] = useTransition()

  // Tutup menu export saat klik di luar
  useEffect(() => {
    if (!exportOpen) return
    function onClick(e: MouseEvent) {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setExportOpen(false)
      }
    }
    document.addEventListener("mousedown", onClick)
    return () => document.removeEventListener("mousedown", onClick)
  }, [exportOpen])

  function handleDelete(id: string) {
    setDelError(null)
    setPendingId(id)
    startDelete(async () => {
      const res = await deleteTransaction(id)
      setPendingId(null)
      if (res?.error) { setDelError(res.error); return }
      setConfirmId(null)
    })
  }

  const filtered = useMemo(() => initialRows.filter((tx) => {
    const q = search.toLowerCase()
    const matchSearch =
      tx.description.toLowerCase().includes(q) ||
      (tx.category_name ?? "").toLowerCase().includes(q)
    const matchFilter = filter === "all" || tx.type === filter
    return matchSearch && matchFilter
  }), [initialRows, search, filter])

  const totalIncome  = useMemo(() =>
    filtered.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0), [filtered])
  const totalExpense = useMemo(() =>
    filtered.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0), [filtered])

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 flex items-center gap-3">
          <TrendingUp size={20} className="text-[var(--color-income)]" />
          <div>
            <p className="text-xs text-[var(--color-muted)]">Pemasukan</p>
            <p className="font-semibold text-[var(--color-income)]">{formatIDR(totalIncome)}</p>
          </div>
        </div>
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 flex items-center gap-3">
          <TrendingDown size={20} className="text-[var(--color-expense)]" />
          <div>
            <p className="text-xs text-[var(--color-muted)]">Pengeluaran</p>
            <p className="font-semibold text-[var(--color-expense)]">{formatIDR(totalExpense)}</p>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-muted)]" />
          <input
            type="text"
            placeholder="Cari transaksi..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] outline-none focus:ring-2 focus:ring-[var(--color-brand-500)]"
          />
        </div>
        <div className="flex gap-1 p-1 rounded-lg bg-[var(--color-border)]">
          {(["all", "income", "expense"] as FilterType[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "px-3 py-1 text-xs font-medium rounded-md transition-colors",
                filter === f
                  ? "bg-[var(--color-surface)] shadow-sm text-[var(--color-foreground)]"
                  : "text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
              )}
            >
              {f === "all" ? "Semua" : f === "income" ? "Pemasukan" : "Pengeluaran"}
            </button>
          ))}
        </div>

        {/* Export dropdown */}
        <div className="relative ml-auto" ref={exportRef}>
          <button
            onClick={() => setExportOpen((o) => !o)}
            disabled={filtered.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-border)]/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download size={15} />
            Export
          </button>
          {exportOpen && (
            <div className="absolute right-0 mt-1 w-48 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-lg z-10 overflow-hidden">
              <button
                onClick={() => { exportTransactionsCSV(filtered); setExportOpen(false) }}
                className="flex items-center gap-2.5 w-full px-3 py-2.5 text-sm text-left hover:bg-[var(--color-border)]/40 transition-colors"
              >
                <FileSpreadsheet size={16} className="text-[var(--color-income)]" />
                <div>
                  <div className="font-medium">Export CSV</div>
                  <div className="text-xs text-[var(--color-muted)]">Buka di Excel/Sheets</div>
                </div>
              </button>
              <button
                onClick={() => { exportTransactionsPDF(filtered); setExportOpen(false) }}
                className="flex items-center gap-2.5 w-full px-3 py-2.5 text-sm text-left hover:bg-[var(--color-border)]/40 transition-colors border-t border-[var(--color-border)]"
              >
                <FileText size={16} className="text-[var(--color-expense)]" />
                <div>
                  <div className="font-medium">Export PDF</div>
                  <div className="text-xs text-[var(--color-muted)]">Cetak / simpan PDF</div>
                </div>
              </button>
            </div>
          )}
        </div>
      </div>

      {delError && (
        <p className="text-xs text-[var(--color-expense)] bg-[var(--color-expense)]/10 rounded-lg px-3 py-2">
          ⚠️ {delError}
        </p>
      )}

      {/* Table */}
      <div className="rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-14 text-center text-sm text-[var(--color-muted)]">
            {initialRows.length === 0
              ? "Belum ada transaksi 💸\nTambah lewat Telegram Bot atau tombol di atas."
              : "Tidak ada transaksi yang cocok dengan filter"}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-[var(--color-muted)]">
                <th className="text-left px-5 py-3 font-medium">Deskripsi</th>
                <th className="text-left px-5 py-3 font-medium">Kategori</th>
                <th className="text-left px-5 py-3 font-medium">Tanggal</th>
                <th className="text-right px-5 py-3 font-medium">Jumlah</th>
                <th className="text-right px-5 py-3 font-medium w-20">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {filtered.map((tx) => (
                <tr key={tx.id} className="hover:bg-[var(--color-border)]/30 transition-colors">
                  <td className="px-5 py-3.5 font-medium">{tx.description}</td>
                  <td className="px-5 py-3.5">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--color-border)] text-[var(--color-muted)]">
                      {tx.category_name ?? "Tanpa Kategori"}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-[var(--color-muted)]">
                    {new Date(tx.date).toLocaleDateString("id-ID", {
                      day: "numeric", month: "short", year: "numeric",
                    })}
                  </td>
                  <td className={cn(
                    "px-5 py-3.5 text-right font-semibold",
                    tx.type === "income" ? "text-[var(--color-income)]" : "text-[var(--color-expense)]"
                  )}>
                    {tx.type === "income" ? "+" : "−"}{formatIDR(tx.amount)}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    {confirmId === tx.id ? (
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleDelete(tx.id)}
                          disabled={pendingId === tx.id}
                          className="text-xs font-medium px-2 py-1 rounded-md bg-[var(--color-expense)] text-white hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center gap-1"
                        >
                          {pendingId === tx.id
                            ? <Loader2 size={12} className="animate-spin" />
                            : "Hapus"}
                        </button>
                        <button
                          onClick={() => setConfirmId(null)}
                          disabled={pendingId === tx.id}
                          className="text-xs font-medium px-2 py-1 rounded-md border border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-foreground)] transition-colors"
                        >
                          Batal
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-end gap-0.5">
                        <button
                          onClick={() => setEditTx(tx)}
                          aria-label="Edit transaksi"
                          className="text-[var(--color-muted)] hover:text-[var(--color-brand-500)] transition-colors p-1"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => { setConfirmId(tx.id); setDelError(null) }}
                          aria-label="Hapus transaksi"
                          className="text-[var(--color-muted)] hover:text-[var(--color-expense)] transition-colors p-1"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {editTx && (
        <EditTransactionModal tx={editTx} onClose={() => setEditTx(null)} />
      )}
    </div>
  )
}
