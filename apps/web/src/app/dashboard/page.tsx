import { TrendingUp, TrendingDown, Wallet, ArrowLeftRight } from "lucide-react"
import { StatCard }      from "@/components/ui/StatCard"
import { SpendingChart } from "@/components/charts/SpendingChart"
import { formatIDR }     from "@/lib/utils"

// Mock data — nanti diganti fetch dari Supabase
const STATS = {
  income:       12_500_000,
  expense:       8_340_000,
  savings:       4_160_000,
  transactions:  47,
}

const CHART_DATA = [
  { name: "Feb", income: 11_200_000, expense:  7_800_000 },
  { name: "Mar", income: 10_800_000, expense:  9_200_000 },
  { name: "Apr", income: 13_500_000, expense:  8_100_000 },
  { name: "Mei", income: 11_900_000, expense:  7_400_000 },
  { name: "Jun", income: 12_100_000, expense:  9_600_000 },
  { name: "Jul", income: 12_500_000, expense:  8_340_000 },
]

const RECENT_TX = [
  { id: 1, desc: "Gaji Juli",           type: "income",  amount: 8_500_000, cat: "Gaji",              date: "01 Jul" },
  { id: 2, desc: "Belanja Supermarket", type: "expense", amount:   450_000, cat: "Belanja",           date: "02 Jul" },
  { id: 3, desc: "Bensin",              type: "expense", amount:   120_000, cat: "Transportasi",      date: "03 Jul" },
  { id: 4, desc: "Netflix",             type: "expense", amount:    54_000, cat: "Hiburan",           date: "03 Jul" },
  { id: 5, desc: "Transfer Freelance",  type: "income",  amount: 2_500_000, cat: "Transfer Masuk",   date: "04 Jul" },
]

export default function DashboardPage() {
  const savingsRate = Math.round((STATS.savings / STATS.income) * 100)

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Beranda</h1>
        <p className="text-sm text-[var(--color-muted)] mt-0.5">Juli 2025 — ringkasan keuangan keluarga</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="Total Pemasukan"
          value={formatIDR(STATS.income)}
          sub="bulan ini"
          icon={TrendingUp}
          variant="income"
        />
        <StatCard
          label="Total Pengeluaran"
          value={formatIDR(STATS.expense)}
          sub="bulan ini"
          icon={TrendingDown}
          variant="expense"
        />
        <StatCard
          label="Tabungan Bersih"
          value={formatIDR(STATS.savings)}
          sub={`${savingsRate}% dari pemasukan`}
          icon={Wallet}
          variant="savings"
        />
        <StatCard
          label="Transaksi"
          value={String(STATS.transactions)}
          sub="bulan ini"
          icon={ArrowLeftRight}
          variant="default"
        />
      </div>

      {/* Chart */}
      <SpendingChart data={CHART_DATA} />

      {/* Recent transactions */}
      <div className="rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)]">
          <h3 className="font-semibold">Transaksi Terbaru</h3>
          <a href="/dashboard/transactions" className="text-sm text-[var(--color-brand-500)] hover:underline">
            Lihat semua →
          </a>
        </div>
        <ul className="divide-y divide-[var(--color-border)]">
          {RECENT_TX.map((tx) => (
            <li key={tx.id} className="flex items-center justify-between px-5 py-3.5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-[var(--color-border)] flex items-center justify-center text-xs font-medium">
                  {tx.cat.slice(0, 2)}
                </div>
                <div>
                  <p className="text-sm font-medium">{tx.desc}</p>
                  <p className="text-xs text-[var(--color-muted)]">{tx.cat} · {tx.date}</p>
                </div>
              </div>
              <span className={tx.type === "income" ? "text-[var(--color-income)] font-semibold text-sm" : "text-[var(--color-expense)] font-semibold text-sm"}>
                {tx.type === "income" ? "+" : "−"}{formatIDR(tx.amount)}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
