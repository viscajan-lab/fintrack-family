"use client"

import { useState } from "react"
import { Search, Filter, TrendingUp, TrendingDown } from "lucide-react"
import { formatIDR, cn } from "@/lib/utils"

const ALL_TX = [
  { id:  1, desc: "Gaji Juli",           type: "income",  amount:  8_500_000, cat: "Gaji",          date: "2025-07-01" },
  { id:  2, desc: "Freelance desain",     type: "income",  amount:  2_500_000, cat: "Transfer Masuk",date: "2025-07-04" },
  { id:  3, desc: "Belanja Supermarket",  type: "expense", amount:    450_000, cat: "Belanja",       date: "2025-07-02" },
  { id:  4, desc: "Bensin",               type: "expense", amount:    120_000, cat: "Transportasi",  date: "2025-07-03" },
  { id:  5, desc: "Netflix",              type: "expense", amount:     54_000, cat: "Hiburan",       date: "2025-07-03" },
  { id:  6, desc: "Listrik PLN",          type: "expense", amount:    380_000, cat: "Rumah & Tagihan",date:"2025-07-05" },
  { id:  7, desc: "Makan siang kantor",   type: "expense", amount:     45_000, cat: "Makanan",       date: "2025-07-05" },
  { id:  8, desc: "Ojek Grab",            type: "expense", amount:     25_000, cat: "Transportasi",  date: "2025-07-06" },
  { id:  9, desc: "Obat apotek",          type: "expense", amount:     85_000, cat: "Kesehatan",     date: "2025-07-07" },
  { id: 10, desc: "Pulsa internet",       type: "expense", amount:    135_000, cat: "Rumah & Tagihan",date:"2025-07-07" },
]

type Filter = "all" | "income" | "expense"

export default function TransactionsPage() {
  const [search, setSearch]   = useState("")
  const [filter, setFilter]   = useState<Filter>("all")

  const filtered = ALL_TX.filter((tx) => {
    const matchSearch = tx.desc.toLowerCase().includes(search.toLowerCase()) ||
                        tx.cat.toLowerCase().includes(search.toLowerCase())
    const matchFilter = filter === "all" || tx.type === filter
    return matchSearch && matchFilter
  })

  const totalIncome  = filtered.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0)
  const totalExpense = filtered.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0)

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Transaksi</h1>
          <p className="text-sm text-[var(--color-muted)] mt-0.5">Semua pemasukan & pengeluaran</p>
        </div>
      </div>

      {/* Summary bar */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 flex items-center gap-3">
          <TrendingUp size={20} className="text-[var(--color-income)]" />
          <div>
            <p className="text-xs text-[var(--color-muted)]">Pemasukan (filter)</p>
            <p className="font-semibold text-[var(--color-income)]">{formatIDR(totalIncome)}</p>
          </div>
        </div>
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 flex items-center gap-3">
          <TrendingDown size={20} className="text-[var(--color-expense)]" />
          <div>
            <p className="text-xs text-[var(--color-muted)]">Pengeluaran (filter)</p>
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
          {(["all","income","expense"] as Filter[]).map((f) => (
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
      </div>

      {/* Table */}
      <div className="rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border)] text-[var(--color-muted)]">
              <th className="text-left px-5 py-3 font-medium">Deskripsi</th>
              <th className="text-left px-5 py-3 font-medium">Kategori</th>
              <th className="text-left px-5 py-3 font-medium">Tanggal</th>
              <th className="text-right px-5 py-3 font-medium">Jumlah</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-center py-10 text-[var(--color-muted)]">
                  Tidak ada transaksi ditemukan
                </td>
              </tr>
            ) : filtered.map((tx) => (
              <tr key={tx.id} className="hover:bg-[var(--color-border)]/30 transition-colors">
                <td className="px-5 py-3.5 font-medium">{tx.desc}</td>
                <td className="px-5 py-3.5">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--color-border)] text-[var(--color-muted)]">
                    {tx.cat}
                  </span>
                </td>
                <td className="px-5 py-3.5 text-[var(--color-muted)]">
                  {new Date(tx.date).toLocaleDateString("id-ID", { day:"numeric",month:"short",year:"numeric" })}
                </td>
                <td className={cn(
                  "px-5 py-3.5 text-right font-semibold",
                  tx.type === "income" ? "text-[var(--color-income)]" : "text-[var(--color-expense)]"
                )}>
                  {tx.type === "income" ? "+" : "−"}{formatIDR(tx.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
