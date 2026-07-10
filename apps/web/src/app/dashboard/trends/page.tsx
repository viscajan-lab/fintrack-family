import { TrendingUp, TrendingDown, Wallet, CalendarRange } from "lucide-react"
import { StatCard }         from "@/components/ui/StatCard"
import { YearlyTrendChart } from "@/components/charts/YearlyTrendChart"
import { YearSelector }     from "@/components/charts/YearSelector"
import { formatIDR }        from "@/lib/utils"
import { getYearlyTrend, getAvailableYears } from "@/lib/data/queries"

export const dynamic = "force-dynamic"

interface Props {
  searchParams: Promise<{ year?: string }>
}

export default async function TrendsPage({ searchParams }: Props) {
  const { year: yearParam } = await searchParams
  const years = await getAvailableYears()

  // Validasi tahun: harus salah satu dari daftar tahun yang tersedia, else default ke tahun terbaru
  const parsed  = Number(yearParam)
  const year    = years.includes(parsed) ? parsed : years[0]

  const trend = await getYearlyTrend(year)

  const savingsRate = trend.totalIncome > 0
    ? Math.round((trend.totalSavings / trend.totalIncome) * 100)
    : 0

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Tren Tahunan</h1>
          <p className="text-sm text-[var(--color-muted)] mt-0.5">
            Pola arus kas keluarga sepanjang tahun {year}.
          </p>
        </div>
        <YearSelector years={years} current={year} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label={`Total Pemasukan ${year}`}   value={formatIDR(trend.totalIncome)}  icon={TrendingUp}   variant="income" />
        <StatCard label={`Total Pengeluaran ${year}`} value={formatIDR(trend.totalExpense)} icon={TrendingDown} variant="expense" />
        <StatCard
          label={`Tabungan ${year}`}
          value={formatIDR(trend.totalSavings)}
          icon={Wallet}
          variant="savings"
          sub={`${savingsRate}% dari pemasukan`}
        />
      </div>

      <YearlyTrendChart data={trend.months} />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] p-5">
          <div className="flex items-center gap-2 text-[var(--color-muted)] mb-1.5">
            <CalendarRange size={16} strokeWidth={1.8} />
            <span className="text-sm">Rata-rata Pengeluaran / Bulan</span>
          </div>
          <p className="text-lg font-semibold">{formatIDR(trend.avgMonthlyExpense)}</p>
        </div>

        <div className="rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] p-5">
          <div className="flex items-center gap-2 text-[var(--color-muted)] mb-1.5">
            <TrendingUp size={16} strokeWidth={1.8} />
            <span className="text-sm">Bulan Terbaik</span>
          </div>
          <p className="text-lg font-semibold">
            {trend.bestMonth ? `${trend.bestMonth} ${year}` : "—"}
          </p>
          <p className="text-xs text-[var(--color-muted)] mt-0.5">tabungan tertinggi</p>
        </div>

        <div className="rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] p-5">
          <div className="flex items-center gap-2 text-[var(--color-muted)] mb-1.5">
            <TrendingDown size={16} strokeWidth={1.8} />
            <span className="text-sm">Bulan Paling Boros</span>
          </div>
          <p className="text-lg font-semibold">
            {trend.worstMonth ? `${trend.worstMonth} ${year}` : "—"}
          </p>
          <p className="text-xs text-[var(--color-muted)] mt-0.5">tabungan terendah</p>
        </div>
      </div>
    </div>
  )
}
