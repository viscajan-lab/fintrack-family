import { formatIDR, cn } from "@/lib/utils"
import type { BudgetRow } from "@/lib/data/queries"

function progressColor(pct: number) {
  if (pct >= 95) return "bg-[var(--color-expense)]"
  if (pct >= 75) return "bg-[var(--color-warning)]"
  return "bg-[var(--color-income)]"
}

export function BudgetList({ budgets }: { budgets: BudgetRow[] }) {
  if (budgets.length === 0) {
    return (
      <div className="rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] py-14 text-center text-sm text-[var(--color-muted)]">
        Belum ada budget bulan ini 📊<br />
        <span className="text-xs">Klik &ldquo;Atur Budget&rdquo; untuk mulai menetapkan batas pengeluaran.</span>
      </div>
    )
  }

  const totalBudget = budgets.reduce((s, b) => s + b.amount, 0)
  const totalSpent  = budgets.reduce((s, b) => s + b.spent,  0)
  const overallPct  = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0

  return (
    <div className="space-y-4">
      {/* Overview card */}
      <div className="rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] p-5">
        <div className="flex items-end justify-between mb-3">
          <div>
            <p className="text-sm text-[var(--color-muted)]">Total terpakai</p>
            <p className="text-2xl font-bold">{formatIDR(totalSpent)}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-[var(--color-muted)]">dari {formatIDR(totalBudget)}</p>
            <p className={cn(
              "text-lg font-semibold",
              overallPct >= 90 ? "text-[var(--color-expense)]"
              : overallPct >= 70 ? "text-[var(--color-warning)]"
              : "text-[var(--color-income)]"
            )}>{overallPct}%</p>
          </div>
        </div>
        <div className="h-3 w-full rounded-full bg-[var(--color-border)] overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-all", progressColor(overallPct))}
            style={{ width: `${Math.min(overallPct, 100)}%` }}
          />
        </div>
        <p className="text-xs text-[var(--color-muted)] mt-2">
          Sisa: {formatIDR(totalBudget - totalSpent)}
        </p>
      </div>

      {/* Per-category */}
      <div className="rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] divide-y divide-[var(--color-border)]">
        {budgets.map((b) => {
          const pct    = b.amount > 0 ? Math.round((b.spent / b.amount) * 100) : 0
          const sisa   = b.amount - b.spent
          const isOver = sisa < 0

          return (
            <div key={b.id} className="px-5 py-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">{b.category_name}</span>
                <div className="text-right text-xs">
                  <span className={cn("font-semibold", isOver ? "text-[var(--color-expense)]" : "text-[var(--color-foreground)]")}>
                    {formatIDR(b.spent)}
                  </span>
                  <span className="text-[var(--color-muted)]"> / {formatIDR(b.amount)}</span>
                </div>
              </div>
              <div className="h-2 w-full rounded-full bg-[var(--color-border)] overflow-hidden">
                <div
                  className={cn("h-full rounded-full transition-all", progressColor(pct))}
                  style={{ width: `${Math.min(pct, 100)}%` }}
                />
              </div>
              <div className="flex justify-between mt-1 text-xs text-[var(--color-muted)]">
                <span>{pct}% terpakai</span>
                <span className={isOver ? "text-[var(--color-expense)] font-medium" : ""}>
                  {isOver ? `Lebih ${formatIDR(Math.abs(sisa))}` : `Sisa ${formatIDR(sisa)}`}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
