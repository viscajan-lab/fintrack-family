import { formatIDR, cn } from "@/lib/utils"
import type { DeltaStat, CategoryMover, InsightData } from "@/lib/data/queries"
import { TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, Minus, Sparkles, CalendarClock } from "lucide-react"

const BULAN = [
  "", "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
]

// Naik-bagus / turun-jelek → hijau; sebaliknya → merah.
function moodColor(d: DeltaStat): string {
  if (d.diff === 0) return "text-[var(--color-muted)]"
  const upIsGood = (d.diff > 0) === d.goodWhenUp
  return upIsGood ? "text-green-600 dark:text-green-400" : "text-red-500"
}

function DeltaBadge({ d }: { d: DeltaStat }) {
  if (d.pct === null) {
    return <span className="text-xs text-[var(--color-muted)]">{d.now > 0 ? "baru bulan ini" : "—"}</span>
  }
  if (d.diff === 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs text-[var(--color-muted)]">
        <Minus size={12} /> tetap
      </span>
    )
  }
  const Icon = d.diff > 0 ? ArrowUpRight : ArrowDownRight
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-xs font-semibold", moodColor(d))}>
      <Icon size={13} /> {d.pct}%
    </span>
  )
}

function StatCard({ label, icon, d }: { label: string; icon: React.ReactNode; d: DeltaStat }) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-sm text-[var(--color-muted)]">{icon}{label}</span>
        <DeltaBadge d={d} />
      </div>
      <p className="mt-2 text-xl font-bold tabular-nums">{formatIDR(d.now)}</p>
      <p className="mt-0.5 text-xs text-[var(--color-muted)]">
        bulan lalu: <span className="tabular-nums">{formatIDR(d.prev)}</span>
      </p>
    </div>
  )
}

function MoverRow({ m }: { m: CategoryMover }) {
  const up = m.diff > 0
  const detail =
    m.prev === 0 ? `baru: ${formatIDR(m.now)}`
    : m.now === 0 ? `berhenti (dulu ${formatIDR(m.prev)})`
    : `${formatIDR(m.prev)} → ${formatIDR(m.now)}${m.pct !== null ? ` · ${m.pct}%` : ""}`
  return (
    <li className="flex items-center justify-between gap-3 py-2">
      <span className="flex items-center gap-2 text-sm font-medium">
        {up ? <TrendingUp size={15} className="text-red-500" /> : <TrendingDown size={15} className="text-green-500" />}
        {m.category}
      </span>
      <span className="text-xs text-[var(--color-muted)] text-right tabular-nums">{detail}</span>
    </li>
  )
}

export function InsightView({ data }: { data: InsightData }) {
  const { month, year, prevMonth, prevYear } = data

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Sparkles size={22} className="text-[var(--color-brand-500)]" /> Insight
        </h1>
        <p className="text-sm text-[var(--color-muted)] mt-0.5">
          {BULAN[month]} {year} <span className="opacity-60">dibanding {BULAN[prevMonth]} {prevYear}</span>
        </p>
      </div>

      {!data.hasData ? (
        <div className="rounded-xl border border-dashed border-[var(--color-border)] p-10 text-center">
          <Sparkles size={32} className="mx-auto text-[var(--color-muted)]" />
          <p className="mt-3 font-medium">Belum ada transaksi untuk dianalisis</p>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            Mulai catat pengeluaranmu — insight-nya bakal muncul di sini otomatis. ✨
          </p>
        </div>
      ) : (
        <>
          {/* Ringkasan 3 kartu */}
          <div className="grid gap-3 sm:grid-cols-3">
            <StatCard label="Pemasukan" icon={<TrendingUp size={15} className="text-green-500" />} d={data.income} />
            <StatCard label="Pengeluaran" icon={<TrendingDown size={15} className="text-red-500" />} d={data.expense} />
            <StatCard label="Tabungan" icon={<Sparkles size={15} className="text-[var(--color-brand-500)]" />} d={data.savings} />
          </div>

          {/* Proyeksi */}
          {data.dailyAvg > 0 && (
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 flex flex-wrap items-center gap-x-6 gap-y-2">
              <span className="flex items-center gap-1.5 text-sm text-[var(--color-muted)]">
                <CalendarClock size={16} /> Rata-rata harian
              </span>
              <span className="font-semibold tabular-nums">{formatIDR(data.dailyAvg)}<span className="text-xs font-normal text-[var(--color-muted)]">/hari</span></span>
              <span className="text-sm text-[var(--color-muted)]">→ proyeksi akhir bulan</span>
              <span className="font-semibold tabular-nums">{formatIDR(data.projectedExpense)}</span>
              <span className="ml-auto text-xs text-[var(--color-muted)]">hari ke-{data.dayNow}/{data.daysInMonth}</span>
            </div>
          )}

          {/* Top movers */}
          {data.movers.length > 0 && (
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
              <h2 className="font-semibold mb-1">Perubahan Kategori Terbesar</h2>
              <p className="text-xs text-[var(--color-muted)] mb-2">Ke mana uangmu bergeser dibanding bulan lalu.</p>
              <ul className="divide-y divide-[var(--color-border)]">
                {data.movers.map((m) => <MoverRow key={m.category} m={m} />)}
              </ul>
            </div>
          )}

          {/* Catatan / tips */}
          {data.tips.length > 0 && (
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
              <h2 className="font-semibold mb-3 flex items-center gap-1.5">💡 Catatan</h2>
              <ul className="space-y-2">
                {data.tips.map((t, i) => (
                  <li key={i} className="text-sm leading-relaxed">{t}</li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  )
}
