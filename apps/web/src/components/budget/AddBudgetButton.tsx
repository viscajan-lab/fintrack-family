"use client"

import { useState, useTransition } from "react"
import { Plus, X, Loader2 } from "lucide-react"
import { addBudget } from "@/app/dashboard/actions"

const EXPENSE_CATS = [
  { id: "makanan",    name: "Makanan & Minuman" },
  { id: "transport",  name: "Transportasi" },
  { id: "belanja",    name: "Belanja" },
  { id: "tagihan",    name: "Rumah & Tagihan" },
  { id: "hiburan",    name: "Hiburan" },
  { id: "kesehatan",  name: "Kesehatan" },
  { id: "pendidikan", name: "Pendidikan" },
  { id: "lainnya",    name: "Lainnya" },
]

export function AddBudgetButton({ currentMonth }: { currentMonth: string }) {
  const [open, setOpen]    = useState(false)
  const [error, setError]  = useState<string | null>(null)
  const [isPending, start] = useTransition()

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const fd = new FormData(e.currentTarget)
    fd.set("month", currentMonth)
    start(async () => {
      const res = await addBudget(fd)
      if (res?.error) { setError(res.error); return }
      setOpen(false)
    })
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--color-brand-500)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
      >
        <Plus size={16} /> Atur Budget
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-[var(--color-background)] rounded-2xl border border-[var(--color-border)] shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)]">
              <h2 className="font-semibold">Atur Budget Bulanan</h2>
              <button onClick={() => setOpen(false)} className="text-[var(--color-muted)] hover:text-[var(--color-foreground)]">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-[var(--color-muted)] mb-1">Kategori</label>
                <select
                  name="category_name" required
                  className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] outline-none focus:ring-2 focus:ring-[var(--color-brand-500)]"
                >
                  <option value="">— Pilih kategori —</option>
                  {EXPENSE_CATS.map(c => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--color-muted)] mb-1">
                  Batas Budget (Rp)
                </label>
                <input
                  name="amount" required type="number" min="1"
                  placeholder="1500000"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] outline-none focus:ring-2 focus:ring-[var(--color-brand-500)]"
                />
              </div>

              <p className="text-xs text-[var(--color-muted)]">
                📅 Berlaku untuk bulan: <strong>{currentMonth}</strong>
              </p>

              {error && (
                <p className="text-xs text-[var(--color-expense)] bg-[var(--color-expense)]/10 rounded-lg px-3 py-2">
                  ⚠️ {error}
                </p>
              )}

              <button
                type="submit" disabled={isPending}
                className="w-full py-2.5 rounded-lg bg-[var(--color-brand-500)] text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {isPending ? <><Loader2 size={15} className="animate-spin" /> Menyimpan...</> : "Simpan Budget"}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
