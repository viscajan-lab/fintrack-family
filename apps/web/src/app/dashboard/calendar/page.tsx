import { TrendingUp, TrendingDown, Wallet, CalendarDays } from "lucide-react"
import { StatCard }          from "@/components/ui/StatCard"
import { CashflowCalendar }  from "@/components/charts/CashflowCalendar"
import { MonthSelector }     from "@/components/charts/MonthSelector"
import { formatIDR }         from "@/lib/utils"
import { getCashflowCalendar } from "@/lib/data/queries"
import { SubTabs } from "@/components/layout/SubTabs"
import { ANALISIS_TABS } from "@/components/layout/tabs"

export const dynamic = "force-dynamic"

interface Props {
  searchParams: Promise<{ year?: string; month?: string }>
}

export default async function CalendarPage({ searchParams }: Props) {
  const { year: yearParam, month: monthParam } = await searchParams

  const now = new Date()
  const parsedYear  = Number(yearParam)
  const parsedMonth = Number(monthParam)

  const year  = Number.isInteger(parsedYear)  && parsedYear  >= 2000 && parsedYear <= 2100
    ? parsedYear
    : now.getFullYear()
  const month = Number.isInteger(parsedMonth) && parsedMonth >= 1 && parsedMonth <= 12
    ? parsedMonth
    : now.getMonth() + 1

  const cal = await getCashflowCalendar(year, month)

  const netPositive = cal.totalNet >= 0

  return (
    <div className="p-6 space-y-6">
      <SubTabs tabs={ANALISIS_TABS} />

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Kalender Cashflow</h1>
          <p className="text-sm text-[var(--color-muted)] mt-0.5">
            Arus kas harian keluarga — {cal.monthName} {year}.
          </p>
        </div>
        <MonthSelector year={year} month={month} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label={`Pemasukan ${cal.monthName}`}   value={formatIDR(cal.totalIncome)}  icon={TrendingUp}   variant="income" />
        <StatCard label={`Pengeluaran ${cal.monthName}`} value={formatIDR(cal.totalExpense)} icon={TrendingDown} variant="expense" />
        <StatCard
          label={`Net ${cal.monthName}`}
          value={`${netPositive ? "+" : "−"}${formatIDR(Math.abs(cal.totalNet))}`}
          icon={Wallet}
          variant="savings"
          sub={netPositive ? "surplus bulan ini" : "defisit bulan ini"}
        />
      </div>

      <CashflowCalendar
        days={cal.days}
        leadingBlanks={cal.leadingBlanks}
        monthName={cal.monthName}
        year={year}
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] p-5">
          <div className="flex items-center gap-2 text-[var(--color-muted)] mb-1.5">
            <CalendarDays size={16} strokeWidth={1.8} />
            <span className="text-sm">Hari Tersibuk</span>
          </div>
          <p className="text-lg font-semibold">
            {cal.busiestDay ? `${cal.busiestDay} ${cal.monthName}` : "—"}
          </p>
          {cal.busiestDay && (
            <p className={"text-xs mt-0.5 " + (cal.busiestNet >= 0 ? "text-green-500" : "text-red-400")}>
              {cal.busiestNet >= 0 ? "+" : "−"}{formatIDR(Math.abs(cal.busiestNet))} net
            </p>
          )}
        </div>

        <div className="rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] p-5">
          <div className="flex items-center gap-2 text-[var(--color-muted)] mb-1.5">
            <Wallet size={16} strokeWidth={1.8} />
            <span className="text-sm">Saldo Akhir Bulan</span>
          </div>
          <p className={"text-lg font-semibold " + (cal.endBalance >= 0 ? "" : "text-red-400")}>
            {cal.endBalance >= 0 ? "" : "−"}{formatIDR(Math.abs(cal.endBalance))}
          </p>
          <p className="text-xs text-[var(--color-muted)] mt-0.5">akumulasi net dalam bulan</p>
        </div>

        <div className="rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] p-5">
          <div className="flex items-center gap-2 text-[var(--color-muted)] mb-1.5">
            <TrendingUp size={16} strokeWidth={1.8} />
            <span className="text-sm">Proyeksi Akhir Bulan</span>
          </div>
          {cal.isCurrentMonth && cal.projectedNet !== null ? (
            <>
              <p className={"text-lg font-semibold " + (cal.projectedNet >= 0 ? "text-green-500" : "text-red-400")}>
                {cal.projectedNet >= 0 ? "+" : "−"}{formatIDR(Math.abs(cal.projectedNet))}
              </p>
              <p className="text-xs text-[var(--color-muted)] mt-0.5">estimasi net berdasar tren harian</p>
            </>
          ) : (
            <>
              <p className="text-lg font-semibold">—</p>
              <p className="text-xs text-[var(--color-muted)] mt-0.5">hanya untuk bulan berjalan</p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
