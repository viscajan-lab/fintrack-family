"use client"

import { useState, useTransition, useRef } from "react"
import { X, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { updateTransaction } from "@/app/dashboard/actions"
import type { TxRow } from "@/lib/data/queries"

const CATEGORIES = [
  { id: "makanan",    name: "Makanan & Minuman",  type: "expense" },
  { id: "transport",  name: "Transportasi",        type: "expense" },
  { id: "belanja",    name: "Belanja",             type: "expense" },
  { id: "tagihan",    name: "Rumah & Tagihan",     type: "expense" },
  { id: "hiburan",    name: "Hiburan",             type: "expense" },
  { id: "kesehatan",  name: "Kesehatan",           type: "expense" },
  { id: "pendidikan", name: "Pendidikan",          type: "expense" },
  { id: "gaji",       name: "Gaji",                type: "income"  },
  { id: "freelance",  name: "Freelance",           type: "income"  },
  { id: "transfer",   name: "Transfer Masuk",      type: "income"  },
  { id: "lainnya",    name: "Lainnya",             type: "both"    },
]

export function EditTransactionModal({ tx, onClose }: { tx: TxRow; onClose: () => void }) {
  const [type, setType]    = useState<"income" | "expense">(tx.type)
  const [error, setError]  = useState<string | null>(null)
  const [isPending, start] = useTransition()
  const formRef            = useRef<HTMLFormElement>(null)

  const cats = CATEGORIES.filter(c => c.type === type || c.type === "both")

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const fd = new FormData(e.currentTarget)
    fd.set("type", type)
    start(async () => {
      const res = await updateTransaction(tx.id, fd)
      if (res?.error) { setError(res.error); return }
      onClose()
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-[var(--color-background)] rounded-2xl border border-[var(--color-border)] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)]">
          <h2 className="font-semibold">Edit Transaksi</h2>
          <button onClick={onClose} className="text-[var(--color-muted)] hover:text-[var(--color-foreground)]">
            <X size={18} />
          </button>
        </div>

        <form ref={formRef} onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Type toggle */}
          <div className="flex gap-2">
            {(["expense", "income"] as const).map((t) => (
              <button
                key={t} type="button"
                onClick={() => setType(t)}
                className={cn(
                  "flex-1 py-2 rounded-lg text-sm font-medium border transition-colors",
                  type === t
                    ? t === "income"
                      ? "bg-[var(--color-income)]/10 border-[var(--color-income)] text-[var(--color-income)]"
                      : "bg-[var(--color-expense)]/10 border-[var(--color-expense)] text-[var(--color-expense)]"
                    : "border-[var(--color-border)] text-[var(--color-muted)]"
                )}
              >
                {t === "income" ? "💰 Pemasukan" : "💸 Pengeluaran"}
              </button>
            ))}
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-[var(--color-muted)] mb-1">Deskripsi</label>
            <input
              name="description" required defaultValue={tx.description}
              placeholder="contoh: Belanja supermarket"
              className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] outline-none focus:ring-2 focus:ring-[var(--color-brand-500)]"
            />
          </div>

          {/* Amount */}
          <div>
            <label className="block text-xs font-medium text-[var(--color-muted)] mb-1">Jumlah (Rp)</label>
            <input
              name="amount" required type="number" min="1" defaultValue={tx.amount}
              placeholder="150000"
              className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] outline-none focus:ring-2 focus:ring-[var(--color-brand-500)]"
            />
          </div>

          {/* Date + Category */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[var(--color-muted)] mb-1">Tanggal</label>
              <input
                name="date" type="date" required defaultValue={tx.date}
                className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] outline-none focus:ring-2 focus:ring-[var(--color-brand-500)]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--color-muted)] mb-1">Kategori</label>
              <select
                name="category_name" defaultValue={tx.category_name ?? ""}
                className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] outline-none focus:ring-2 focus:ring-[var(--color-brand-500)]"
              >
                <option value="">— Pilih —</option>
                {cats.map(c => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-[var(--color-muted)] mb-1">Catatan (opsional)</label>
            <input
              name="notes" defaultValue={tx.notes ?? ""}
              placeholder="opsional..."
              className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] outline-none focus:ring-2 focus:ring-[var(--color-brand-500)]"
            />
          </div>

          {error && (
            <p className="text-xs text-[var(--color-expense)] bg-[var(--color-expense)]/10 rounded-lg px-3 py-2">
              ⚠️ {error}
            </p>
          )}

          <button
            type="submit" disabled={isPending}
            className="w-full py-2.5 rounded-lg bg-[var(--color-brand-500)] text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {isPending ? <><Loader2 size={15} className="animate-spin" /> Menyimpan...</> : "Simpan Perubahan"}
          </button>
        </form>
      </div>
    </div>
  )
}
