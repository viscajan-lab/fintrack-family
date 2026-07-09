"use client"

import { useState, useTransition } from "react"
import { Loader2, Plus, Trash2, PiggyBank, CheckCircle2, CalendarClock } from "lucide-react"
import { formatIDR, cn } from "@/lib/utils"
import { addSavingsContribution, deleteSavingsGoal } from "@/app/dashboard/actions"
import type { SavingsGoal } from "@/lib/data/queries"

function progressColor(pct: number, achieved: boolean) {
  if (achieved)   return "bg-[var(--color-income)]"
  if (pct >= 75)  return "bg-[var(--color-brand-500)]"
  if (pct >= 40)  return "bg-[var(--color-warning)]"
  return "bg-[var(--color-brand-500)]"
}

function GoalCard({ goal }: { goal: SavingsGoal }) {
  const [openContrib, setOpenContrib] = useState(false)
  const [error, setError]             = useState<string | null>(null)
  const [isPending, start]            = useTransition()
  const [isDeleting, startDelete]     = useTransition()

  function handleContribute(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const fd = new FormData(e.currentTarget)
    start(async () => {
      const res = await addSavingsContribution(goal.id, fd)
      if (res?.error) { setError(res.error); return }
      setOpenContrib(false)
    })
  }

  function handleDelete() {
    if (!confirm(`Hapus target "${goal.name}"? Riwayat setoran akan hilang.`)) return
    startDelete(async () => { await deleteSavingsGoal(goal.id) })
  }

  const deadlineLabel =
    goal.deadline
      ? new Date(`${goal.deadline}T00:00:00`).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })
      : null

  return (
    <div className="rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] p-5 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className={cn(
            "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
            goal.achieved ? "bg-[var(--color-income)]/15 text-[var(--color-income)]" : "bg-[var(--color-brand-500)]/15 text-[var(--color-brand-500)]"
          )}>
            {goal.achieved ? <CheckCircle2 size={20} /> : <PiggyBank size={20} />}
          </div>
          <div className="min-w-0">
            <p className="font-semibold truncate">{goal.name}</p>
            {goal.note && <p className="text-xs text-[var(--color-muted)] truncate">{goal.note}</p>}
          </div>
        </div>
        <button
          onClick={handleDelete}
          disabled={isDeleting}
          className="text-[var(--color-muted)] hover:text-[var(--color-expense)] transition-colors shrink-0 disabled:opacity-50"
          aria-label="Hapus target"
        >
          {isDeleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
        </button>
      </div>

      {/* Progress */}
      <div>
        <div className="flex items-end justify-between mb-1.5">
          <span className="text-lg font-bold">{formatIDR(goal.saved_amount)}</span>
          <span className="text-xs text-[var(--color-muted)]">dari {formatIDR(goal.target_amount)}</span>
        </div>
        <div className="h-3 w-full rounded-full bg-[var(--color-border)] overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-all", progressColor(goal.pct, goal.achieved))}
            style={{ width: `${goal.pct}%` }}
          />
        </div>
        <div className="flex justify-between mt-1.5 text-xs">
          <span className={cn("font-medium", goal.achieved ? "text-[var(--color-income)]" : "text-[var(--color-foreground)]")}>
            {goal.pct}%{goal.achieved ? " • Tercapai! 🎉" : ""}
          </span>
          {!goal.achieved && (
            <span className="text-[var(--color-muted)]">Kurang {formatIDR(goal.remaining)}</span>
          )}
        </div>
      </div>

      {/* Deadline */}
      {deadlineLabel && (
        <div className="flex items-center gap-1.5 text-xs text-[var(--color-muted)]">
          <CalendarClock size={13} />
          <span>{deadlineLabel}</span>
          {goal.daysLeft !== null && !goal.achieved && (
            <span className={cn(
              "ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium",
              goal.daysLeft < 0   ? "bg-[var(--color-expense)]/15 text-[var(--color-expense)]"
              : goal.daysLeft <= 30 ? "bg-[var(--color-warning)]/15 text-[var(--color-warning)]"
              : "bg-[var(--color-border)] text-[var(--color-muted)]"
            )}>
              {goal.daysLeft < 0 ? `Lewat ${Math.abs(goal.daysLeft)} hari` : `${goal.daysLeft} hari lagi`}
            </span>
          )}
        </div>
      )}

      {/* Contribute */}
      {openContrib ? (
        <form onSubmit={handleContribute} className="space-y-2 pt-1">
          <input
            name="amount" required type="number" min="1" autoFocus
            placeholder="Jumlah setoran (Rp)"
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
              {isPending ? <><Loader2 size={14} className="animate-spin" /> Menyimpan...</> : "Setor"}
            </button>
            <button
              type="button" onClick={() => { setOpenContrib(false); setError(null) }}
              className="px-4 py-2 rounded-lg border border-[var(--color-border)] text-sm text-[var(--color-muted)] hover:bg-[var(--color-border)] transition-colors"
            >
              Batal
            </button>
          </div>
        </form>
      ) : (
        <button
          onClick={() => setOpenContrib(true)}
          className="w-full py-2 rounded-lg border border-[var(--color-border)] text-sm font-medium text-[var(--color-brand-500)] hover:bg-[var(--color-brand-500)]/5 transition-colors flex items-center justify-center gap-2"
        >
          <Plus size={15} /> Tambah Setoran
        </button>
      )}
    </div>
  )
}

export function GoalList({ goals }: { goals: SavingsGoal[] }) {
  if (goals.length === 0) {
    return (
      <div className="rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] py-14 text-center text-sm text-[var(--color-muted)]">
        Belum ada target tabungan 🐷<br />
        <span className="text-xs">Klik &ldquo;Target Baru&rdquo; untuk mulai menabung bareng keluarga.</span>
      </div>
    )
  }

  const totalTarget = goals.reduce((s, g) => s + g.target_amount, 0)
  const totalSaved  = goals.reduce((s, g) => s + g.saved_amount,  0)
  const overallPct  = totalTarget > 0 ? Math.min(Math.round((totalSaved / totalTarget) * 100), 100) : 0

  return (
    <div className="space-y-4">
      {/* Overview */}
      <div className="rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] p-5">
        <div className="flex items-end justify-between mb-3">
          <div>
            <p className="text-sm text-[var(--color-muted)]">Total terkumpul</p>
            <p className="text-2xl font-bold">{formatIDR(totalSaved)}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-[var(--color-muted)]">dari {formatIDR(totalTarget)}</p>
            <p className="text-lg font-semibold text-[var(--color-brand-500)]">{overallPct}%</p>
          </div>
        </div>
        <div className="h-3 w-full rounded-full bg-[var(--color-border)] overflow-hidden">
          <div
            className="h-full rounded-full bg-[var(--color-brand-500)] transition-all"
            style={{ width: `${overallPct}%` }}
          />
        </div>
      </div>

      {/* Cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        {goals.map((g) => <GoalCard key={g.id} goal={g} />)}
      </div>
    </div>
  )
}
