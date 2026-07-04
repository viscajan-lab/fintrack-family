import { formatIDR } from "@/lib/utils"
import { cn } from "@/lib/utils"

const BUDGETS = [
  { cat: "Makanan & Minuman", budget: 2_000_000, spent: 1_450_000 },
  { cat: "Transportasi",      budget:   800_000, spent:   620_000 },
  { cat: "Belanja",           budget: 1_500_000, spent: 1_480_000 },
  { cat: "Rumah & Tagihan",   budget: 1_200_000, spent:   760_000 },
  { cat: "Hiburan",           budget:   500_000, spent:   354_000 },
  { cat: "Kesehatan",         budget:   600_000, spent:    85_000 },
  { cat: "Pendidikan",        budget:   800_000, spent:   400_000 },
]

function progressColor(pct: number) {
  if (pct >= 95) return "bg-[var(--color-expense)]"
  if (pct >= 75) return "bg-[var(--color-warning)]"
  return "bg-[var(--color-income)]"
}

export default function BudgetPage() {
  const totalBudget = BUDGETS.reduce((s, b) => s + b.budget, 0)
  const totalSpent  = BUDGETS.reduce((s, b) => s + b.spent,  0)
  const overallPct  = Math.round((totalSpent / totalBudget) * 100)

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Budget</h1>
        <p className="text-sm text-[var(--color-muted)] mt-0.5">Pantau batas pengeluaran per kategori — Juli 2025</p>
      </div>

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

      {/* Per-category list */}
      <div className="rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] divide-y divide-[var(--color-border)]">
        {BUDGETS.map((b) => {
          const pct      = Math.round((b.spent / b.budget) * 100)
          const sisa     = b.budget - b.spent
          const isOver   = sisa < 0

          return (
            <div key={b.cat} className="px-5 py-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">{b.cat}</span>
                <div className="text-right text-xs">
                  <span className={cn("font-semibold", isOver ? "text-[var(--color-expense)]" : "text-[var(--color-foreground)]")}>
                    {formatIDR(b.spent)}
                  </span>
                  <span className="text-[var(--color-muted)]"> / {formatIDR(b.budget)}</span>
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
