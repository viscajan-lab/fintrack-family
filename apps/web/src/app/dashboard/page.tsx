import { TrendingUp, TrendingDown, Wallet, ArrowLeftRight } from "lucide-react"
import { StatCard }      from "@/components/ui/StatCard"
import { SpendingChart } from "@/components/charts/SpendingChart"
import { formatIDR }     from "@/lib/utils"
import {
  getDashboardStats,
  getChartData,
  getRecentTransactions,
} from "@/lib/data/queries"

export const dynamic = "force-dynamic"

export default async function DashboardPage() {
  const [stats, chartData, recentTx] = await Promise.all([
    getDashboardStats(),
    getChartData(),
    getRecentTransactions(),
  ])

  const now        = new Date()
  const MONTHS_ID  = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"]
  const monthLabel = `${MONTHS_ID[now.getMonth()]} ${now.getFullYear()}`
  const savingsRate = stats.income > 0 ? Math.round((stats.savings / stats.income) * 100) : 0

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Beranda</h1>
        <p className="text-sm text-[var(--color-muted)] mt-0.5">{monthLabel} — ringkasan keuangan keluarga</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="Total Pemasukan"
          value={formatIDR(stats.income)}
          sub="bulan ini"
          icon={TrendingUp}
          variant="income"
        />
        <StatCard
          label="Total Pengeluaran"
          value={formatIDR(stats.expense)}
          sub="bulan ini"
          icon={TrendingDown}
          variant="expense"
        />
        <StatCard
          label="Tabungan Bersih"
          value={formatIDR(stats.savings)}
          sub={stats.income > 0 ? `${savingsRate}% dari pemasukan` : "belum ada data"}
          icon={Wallet}
          variant="savings"
        />
        <StatCard
          label="Transaksi"
          value={String(stats.tx_count)}
          sub="bulan ini"
          icon={ArrowLeftRight}
          variant="default"
        />
      </div>

      {/* Chart */}
      <SpendingChart data={chartData} />

      {/* Recent transactions */}
      <div className="rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)]">
          <h3 className="font-semibold">Transaksi Terbaru</h3>
          <a href="/dashboard/transactions" className="text-sm text-[var(--color-brand-500)] hover:underline">
            Lihat semua →
          </a>
        </div>

        {recentTx.length === 0 ? (
          <div className="py-12 text-center text-sm text-[var(--color-muted)]">
            Belum ada transaksi bulan ini 💸<br />
            <span className="text-xs">Tambah lewat Telegram Bot atau halaman Transaksi</span>
          </div>
        ) : (
          <ul className="divide-y divide-[var(--color-border)]">
            {recentTx.map((tx) => {
              const initials = (tx.category_name ?? "??").slice(0, 2).toUpperCase()
              const dateStr  = new Date(tx.date).toLocaleDateString("id-ID", {
                day: "numeric", month: "short",
              })
              return (
                <li key={tx.id} className="flex items-center justify-between px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-[var(--color-border)] flex items-center justify-center text-xs font-medium">
                      {initials}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{tx.description}</p>
                      <p className="text-xs text-[var(--color-muted)]">
                        {tx.category_name ?? "Tanpa Kategori"} · {dateStr}
                      </p>
                    </div>
                  </div>
                  <span className={
                    tx.type === "income"
                      ? "text-[var(--color-income)] font-semibold text-sm"
                      : "text-[var(--color-expense)] font-semibold text-sm"
                  }>
                    {tx.type === "income" ? "+" : "−"}{formatIDR(tx.amount)}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
