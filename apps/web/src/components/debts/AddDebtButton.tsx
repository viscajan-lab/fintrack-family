"use client"

import { useState, useTransition } from "react"
import { Plus, X, Loader2, ArrowDownLeft, ArrowUpRight } from "lucide-react"
import { addDebt } from "@/app/dashboard/actions"
import { cn } from "@/lib/utils"

type Direction = "payable" | "receivable"

export function AddDebtButton() {
  const [open, setOpen]           = useState(false)
  const [direction, setDirection] = useState<Direction>("payable")
  const [error, setError]         = useState<string | null>(null)
  const [isPending, start]        = useTransition()

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const fd = new FormData(e.currentTarget)
    fd.set("direction", direction)
    start(async () => {
      const res = await addDebt(fd)
      if (res?.error) { setError(res.error); return }
      setOpen(false)
      setDirection("payable")
    })
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--color-brand-500)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
      >
        <Plus size={16} /> Catat Baru
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-[var(--color-background)] rounded-2xl border border-[var(--color-border)] shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)]">
              <h2 className="font-semibold">Catat Hutang / Piutang</h2>
              <button onClick={() => setOpen(false)} className="text-[var(--color-muted)] hover:text-[var(--color-foreground)]">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              {/* Direction toggle */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setDirection("payable")}
                  className={cn(
                    "flex items-center justify-center gap-2 py-2.5 rounded-lg border text-sm font-medium transition-colors",
                    direction === "payable"
                      ? "border-[var(--color-expense)] bg-[var(--color-expense)]/10 text-[var(--color-expense)]"
                      : "border-[var(--color-border)] text-[var(--color-muted)] hover:bg-[var(--color-surface)]"
                  )}
                >
                  <ArrowUpRight size={15} /> Hutang
                </button>
                <button
                  type="button"
                  onClick={() => setDirection("receivable")}
                  className={cn(
                    "flex items-center justify-center gap-2 py-2.5 rounded-lg border text-sm font-medium transition-colors",
                    direction === "receivable"
                      ? "border-[var(--color-income)] bg-[var(--color-income)]/10 text-[var(--color-income)]"
                      : "border-[var(--color-border)] text-[var(--color-muted)] hover:bg-[var(--color-surface)]"
                  )}
                >
                  <ArrowDownLeft size={15} /> Piutang
                </button>
              </div>
              <p className="text-[11px] text-[var(--color-muted)] -mt-2">
                {direction === "payable"
                  ? "Hutang = kamu meminjam / harus membayar ke pihak lain."
                  : "Piutang = kamu meminjamkan / akan menerima dari pihak lain."}
              </p>

              <div>
                <label className="block text-xs font-medium text-[var(--color-muted)] mb-1">
                  {direction === "payable" ? "Kepada siapa?" : "Dari siapa?"}
                </label>
                <input
                  name="person_name" required maxLength={80}
                  placeholder="Contoh: Budi"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] outline-none focus:ring-2 focus:ring-[var(--color-brand-500)]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--color-muted)] mb-1">Nominal (Rp)</label>
                <input
                  name="amount" required type="number" min="1"
                  placeholder="500000"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] outline-none focus:ring-2 focus:ring-[var(--color-brand-500)]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--color-muted)] mb-1">
                  Jatuh tempo <span className="text-[var(--color-muted)]/70">(opsional)</span>
                </label>
                <input
                  name="due_date" type="date"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] outline-none focus:ring-2 focus:ring-[var(--color-brand-500)]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--color-muted)] mb-1">
                  Catatan <span className="text-[var(--color-muted)]/70">(opsional)</span>
                </label>
                <input
                  name="note" maxLength={140}
                  placeholder="Untuk apa?"
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
                {isPending ? <><Loader2 size={15} className="animate-spin" /> Menyimpan...</> : "Simpan"}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
