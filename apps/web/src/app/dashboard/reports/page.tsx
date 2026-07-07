import { TrendingUp, TrendingDown, Wallet } from "lucide-react"
import { StatCard }      from "@/components/ui/StatCard"
import { SpendingChart } from "@/components/charts/SpendingChart"
import { CategoryBreakdown } from "@/components/charts/CategoryBreakdown"
import { formatIDR }     from "@/lib/utils"
import { getDashboardStats, getChartData, getExpenseByCategory } from "@/lib/data/queries"

export const dynamic = "force-dynamic"

export default async function ReportsPage() {
  const [stats, chartData, categories] = await Promise.all([
    getDashboardStats(),
    getChartData(),
    getExpenseByCategory(),
  ])

  const savingsRate = stats.income > 0 ? Math.round((stats.savings / stats.income) * 100) : 0

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Laporan</h1>
        <p className="text-sm text-[var(--color-muted)] mt-0.5">Ringkasan arus kas keluarga — 6 bulan terakhir.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Pemasukan"   value={formatIDR(stats.income)}  icon={TrendingUp}   variant="income" />
        <StatCard label="Pengeluaran" value={formatIDR(stats.expense)} icon={TrendingDown} variant="expense" />
        <StatCard label="Tabungan"    value={formatIDR(stats.savings)} icon={Wallet}       variant="savings" sub={`${savingsRate}% dari pemasukan`} />
      </div>

      <SpendingChart data={chartData} />

      <CategoryBreakdown data={categories} />
    </div>
  )
}
