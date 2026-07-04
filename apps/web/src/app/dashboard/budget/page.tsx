import { getBudgets } from "@/lib/data/queries"
import { BudgetList }  from "@/components/budget/BudgetList"
import { AddBudgetButton } from "@/components/budget/AddBudgetButton"

export const dynamic = "force-dynamic"

export default async function BudgetPage() {
  const budgets = await getBudgets()

  const now       = new Date()
  const MONTHS_ID = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"]
  const monthLabel = `${MONTHS_ID[now.getMonth()]} ${now.getFullYear()}`
  const curMonth   = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Budget</h1>
          <p className="text-sm text-[var(--color-muted)] mt-0.5">
            Pantau batas pengeluaran per kategori — {monthLabel}
          </p>
        </div>
        <AddBudgetButton currentMonth={curMonth} />
      </div>

      <BudgetList budgets={budgets} />
    </div>
  )
}
