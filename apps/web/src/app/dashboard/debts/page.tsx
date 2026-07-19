import { getDebts }      from "@/lib/data/queries"
import { DebtList }      from "@/components/debts/DebtList"
import { AddDebtButton } from "@/components/debts/AddDebtButton"
import { formatIDR }     from "@/lib/utils"
import { ArrowUpRight, ArrowDownLeft, Scale, AlertTriangle } from "lucide-react"

export const dynamic = "force-dynamic"

export default async function DebtsPage() {
  const { debts, summary } = await getDebts()

  const netPositive = summary.net >= 0

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Hutang / Piutang</h1>
          <p className="text-sm text-[var(--color-muted)] mt-0.5">
            Lacak pinjaman & tagihan keluarga 🤝
          </p>
        </div>
        <AddDebtButton />
      </div>

      {/* StatCards */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] p-4">
          <div className="flex items-center gap-2 text-[var(--color-expense)] mb-1">
            <ArrowUpRight size={16} />
            <span className="text-xs font-medium text-[var(--color-muted)]">Total Hutang</span>
          </div>
          <p className="text-xl font-bold">{formatIDR(summary.payableTotal)}</p>
          <p className="text-[11px] text-[var(--color-muted)] mt-0.5">{summary.activePayables} belum lunas</p>
        </div>

        <div className="rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] p-4">
          <div className="flex items-center gap-2 text-[var(--color-income)] mb-1">
            <ArrowDownLeft size={16} />
            <span className="text-xs font-medium text-[var(--color-muted)]">Total Piutang</span>
          </div>
          <p className="text-xl font-bold">{formatIDR(summary.receivableTotal)}</p>
          <p className="text-[11px] text-[var(--color-muted)] mt-0.5">{summary.activeReceivables} belum lunas</p>
        </div>

        <div className="rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] p-4">
          <div className={`flex items-center gap-2 mb-1 ${netPositive ? "text-[var(--color-income)]" : "text-[var(--color-expense)]"}`}>
            <Scale size={16} />
            <span className="text-xs font-medium text-[var(--color-muted)]">Posisi Bersih</span>
          </div>
          <p className={`text-xl font-bold ${netPositive ? "text-[var(--color-income)]" : "text-[var(--color-expense)]"}`}>
            {netPositive ? "+" : "−"}{formatIDR(Math.abs(summary.net))}
          </p>
          <p className="text-[11px] text-[var(--color-muted)] mt-0.5">{netPositive ? "Surplus" : "Defisit"}</p>
        </div>

        <div className="rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] p-4">
          <div className={`flex items-center gap-2 mb-1 ${summary.overdueCount > 0 ? "text-[var(--color-warning)]" : "text-[var(--color-muted)]"}`}>
            <AlertTriangle size={16} />
            <span className="text-xs font-medium text-[var(--color-muted)]">Jatuh Tempo</span>
          </div>
          <p className="text-xl font-bold">{summary.overdueCount}</p>
          <p className="text-[11px] text-[var(--color-muted)] mt-0.5">item terlewat</p>
        </div>
      </div>

      <DebtList debts={debts} />
    </div>
  )
}
