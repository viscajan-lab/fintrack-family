"use client"

import { useState, useTransition } from "react"
import {
  Loader2, Plus, Trash2, CheckCircle2, CalendarClock,
  ArrowUpRight, ArrowDownLeft, HandCoins,
} from "lucide-react"
import { formatIDR, cn } from "@/lib/utils"
import { recordDebtPayment, settleDebt, deleteDebt } from "@/app/dashboard/actions"
import type { Debt } from "@/lib/data/queries"

function DebtCard({ debt }: { debt: Debt }) {
  const [openPay, setOpenPay]     = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [isPending, start]        = useTransition()
  const [isSettling, startSettle] = useTransition()
  const [isDeleting, startDelete] = useTransition()

  const isPayable = debt.direction === "payable"
  const accent    = isPayable ? "expense" : "income"

  function handlePay(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const fd = new FormData(e.currentTarget)
    start(async () => {
      const res = await recordDebtPayment(debt.id, fd)
      if (res?.error) { setError(res.error); return }
      setOpenPay(false)
    })
  }

  function handleSettle() {
    if (!confirm(`Tandai "${debt.person_name}" sebagai lunas penuh?`)) return
    startSettle(async () => { await settleDebt(debt.id) })
  }

  function handleDelete() {
    if (!confirm(`Hapus catatan ${isPayable ? "hutang" : "piutang"} "${debt.person_name}"?`)) return
    startDelete(async () => { await deleteDebt(debt.id) })
  }

  const dueLabel =
    debt.due_date
      ? new Date(`${debt.due_date}T00:00:00`).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })
      : null

  return (
    <div className={cn(
      "rounded-xl bg-[var(--color-surface)] border p-5 space-y-3",
      debt.settled ? "border-[var(--color-border)] opacity-75" : "border-[var(--color-border)]"
    )}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className={cn(
            "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
            debt.settled
              ? "bg-[var(--color-income)]/15 text-[var(--color-income)]"
              : `bg-[var(--color-${accent})]/15 text-[var(--color-${accent})]`
          )}>
            {debt.settled ? <CheckCircle2 size={20} /> : isPayable ? <ArrowUpRight size={20} /> : <ArrowDownLeft size={20} />}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-semibold truncate">{debt.person_name}</p>
              <span className={cn(
                "px-1.5 py-0.5 rounded-full text-[10px] font-medium shrink-0",
                `bg-[var(--color-${accent})]/15 text-[var(--color-${accent})]`
              )}>
                {isPayable ? "Hutang" : "Piutang"}
              </span>
            </div>
            {debt.note && <p className="text-xs text-[var(--color-muted)] truncate">{debt.note}</p>}
          </div>
        </div>
        <button
          onClick={handleDelete}
          disabled={isDeleting}
          className="text-[var(--color-muted)] hover:text-[var(--color-expense)] transition-colors shrink-0 disabled:opacity-50"
          aria-label="Hapus"
        >
          {isDeleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
        </button>
      </div>

      {/* Progress pelunasan */}
      <div>
        <div className="flex items-end justify-between mb-1.5">
          <span className="text-lg font-bold">{formatIDR(debt.remaining)}</span>
          <span className="text-xs text-[var(--color-muted)]">
            {debt.settled ? "Lunas" : `sisa dari ${formatIDR(debt.amount)}`}
          </span>
        </div>
        <div className="h-3 w-full rounded-full bg-[var(--color-border)] overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              debt.settled ? "bg-[var(--color-income)]" : `bg-[var(--color-${accent})]`
            )}
            style={{ width: `${debt.pct}%` }}
          />
        </div>
        <div className="flex justify-between mt-1.5 text-xs">
          <span className={cn("font-medium", debt.settled ? "text-[var(--color-income)]" : "text-[var(--color-foreground)]")}>
            {debt.pct}%{debt.settled ? " • Lunas 🎉" : ` terbayar`}
          </span>
          {!debt.settled && debt.paid_amount > 0 && (
            <span className="text-[var(--color-muted)]">Sudah {formatIDR(debt.paid_amount)}</span>
          )}
        </div>
      </div>

      {/* Jatuh tempo */}
      {dueLabel && !debt.settled && (
        <div className="flex items-center gap-1.5 text-xs text-[var(--color-muted)]">
          <CalendarClock size={13} />
          <span>{dueLabel}</span>
          {debt.daysLeft !== null && (
            <span className={cn(
              "ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium",
              debt.overdue         ? "bg-[var(--color-expense)]/15 text-[var(--color-expense)]"
              : debt.daysLeft <= 7 ? "bg-[var(--color-warning)]/15 text-[var(--color-warning)]"
              : "bg-[var(--color-border)] text-[var(--color-muted)]"
            )}>
              {debt.overdue ? `Telat ${Math.abs(debt.daysLeft)} hari` : `${debt.daysLeft} hari lagi`}
            </span>
          )}
        </div>
      )}

      {/* Aksi bayar */}
      {!debt.settled && (
        openPay ? (
          <form onSubmit={handlePay} className="space-y-2 pt-1">
            <input
              name="amount" required type="number" min="1" autoFocus
              placeholder={isPayable ? "Jumlah bayar (Rp)" : "Jumlah diterima (Rp)"}
              className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] outline-none focus:ring-2 focus:ring-[var(--color-brand-500)]"
            />
            {error && (
              <p className="text-xs text-[var(--color-expense)] bg-[var(--color-expense)]/10 rounded-lg px-3 py-2">⚠️ {error}</p>
            )}
            <div className="flex gap-2">
              <button
                type="submit" disabled={isPending}
                className="flex-1 py-2 rounded-lg bg-[var(--color-brand-500)] text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {isPending ? <><Loader2 size={14} className="animate-spin" /> Menyimpan...</> : "Catat"}
              </button>
              <button
                type="button" onClick={() => { setOpenPay(false); setError(null) }}
                className="px-4 py-2 rounded-lg border border-[var(--color-border)] text-sm text-[var(--color-muted)] hover:bg-[var(--color-border)] transition-colors"
              >
                Batal
              </button>
            </div>
          </form>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={() => setOpenPay(true)}
              className="flex-1 py-2 rounded-lg border border-[var(--color-border)] text-sm font-medium text-[var(--color-brand-500)] hover:bg-[var(--color-brand-500)]/5 transition-colors flex items-center justify-center gap-2"
            >
              <Plus size={15} /> {isPayable ? "Bayar" : "Terima"}
            </button>
            <button
              onClick={handleSettle}
              disabled={isSettling}
              className="px-4 py-2 rounded-lg border border-[var(--color-income)]/40 text-sm font-medium text-[var(--color-income)] hover:bg-[var(--color-income)]/5 transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {isSettling ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />} Lunas
            </button>
          </div>
        )
      )}
    </div>
  )
}

export function DebtList({ debts }: { debts: Debt[] }) {
  if (debts.length === 0) {
    return (
      <div className="rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] py-14 text-center text-sm text-[var(--color-muted)]">
        <HandCoins size={28} className="mx-auto mb-2 opacity-50" />
        Belum ada catatan hutang / piutang<br />
        <span className="text-xs">Klik &ldquo;Catat Baru&rdquo; untuk mulai melacak pinjaman keluarga.</span>
      </div>
    )
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {debts.map((d) => <DebtCard key={d.id} debt={d} />)}
    </div>
  )
}
