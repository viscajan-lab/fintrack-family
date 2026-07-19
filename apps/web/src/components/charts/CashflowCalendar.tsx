"use client"

import { useState } from "react"
import { formatIDR, formatIDRShort } from "@/lib/utils"
import type { CalendarDay } from "@/lib/data/queries"

const DOW_LABELS = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"]

interface CashflowCalendarProps {
  days: CalendarDay[]
  leadingBlanks: number
  monthName: string
  year: number
}

/**
 * Grid kalender arus kas: tiap sel = 1 hari, menampilkan net harian
 * (hijau=surplus, merah=defisit) + jumlah transaksi. Klik hari → panel detail.
 */
export function CashflowCalendar({ days, leadingBlanks, monthName, year }: CashflowCalendarProps) {
  const [selected, setSelected] = useState<CalendarDay | null>(null)

  const blanks = Array.from({ length: leadingBlanks })

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] p-3 sm:p-4">
        {/* header hari */}
        <div className="grid grid-cols-7 gap-1 sm:gap-1.5 mb-1.5">
          {DOW_LABELS.map((d, i) => (
            <div
              key={d}
              className={
                "text-center text-[11px] font-semibold py-1 " +
                (i >= 5 ? "text-[var(--color-brand-500)]" : "text-[var(--color-muted)]")
              }
            >
              {d}
            </div>
          ))}
        </div>

        {/* grid tanggal */}
        <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
          {blanks.map((_, i) => (
            <div key={`b${i}`} className="aspect-square" />
          ))}

          {days.map((d) => {
            const hasActivity = d.txCount > 0
            const isSelected = selected?.day === d.day
            const netPositive = d.net > 0
            const netNegative = d.net < 0

            return (
              <button
                key={d.day}
                onClick={() => setSelected(isSelected ? null : d)}
                className={
                  "aspect-square rounded-lg border p-1 sm:p-1.5 flex flex-col items-stretch text-left transition-colors overflow-hidden " +
                  (d.isFuture ? "opacity-40 " : "") +
                  (isSelected
                    ? "border-[var(--color-brand-500)] bg-[var(--color-brand-500)]/10 "
                    : "border-[var(--color-border)] hover:border-[var(--color-brand-500)] ") +
                  (d.isToday && !isSelected ? "ring-1 ring-[var(--color-brand-500)] " : "")
                }
              >
                <div className="flex items-center justify-between">
                  <span
                    className={
                      "text-[11px] sm:text-xs font-semibold " +
                      (d.isToday ? "text-[var(--color-brand-500)]" : "text-[var(--color-foreground)]")
                    }
                  >
                    {d.day}
                  </span>
                  {hasActivity && (
                    <span className="text-[9px] text-[var(--color-muted)]">{d.txCount}×</span>
                  )}
                </div>

                {hasActivity && (
                  <div className="mt-auto">
                    <span
                      className={
                        "block text-[10px] sm:text-[11px] font-semibold leading-tight truncate " +
                        (netPositive ? "text-green-500" : netNegative ? "text-red-400" : "text-[var(--color-muted)]")
                      }
                    >
                      {netPositive ? "+" : ""}{formatIDRShort(Math.abs(d.net))}
                    </span>
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* panel detail hari terpilih */}
      {selected && (
        <div className="rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">
              {selected.day} {monthName} {year}
            </h3>
            <button
              onClick={() => setSelected(null)}
              className="text-xs text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
            >
              Tutup
            </button>
          </div>

          {selected.txCount === 0 ? (
            <p className="text-sm text-[var(--color-muted)]">Tidak ada transaksi di hari ini.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <p className="text-xs text-[var(--color-muted)] mb-0.5">Masuk</p>
                <p className="text-sm font-semibold text-green-500">{formatIDR(selected.income)}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--color-muted)] mb-0.5">Keluar</p>
                <p className="text-sm font-semibold text-red-400">{formatIDR(selected.expense)}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--color-muted)] mb-0.5">Net Hari Ini</p>
                <p className={"text-sm font-semibold " + (selected.net >= 0 ? "text-green-500" : "text-red-400")}>
                  {selected.net >= 0 ? "+" : "−"}{formatIDR(Math.abs(selected.net))}
                </p>
              </div>
              <div>
                <p className="text-xs text-[var(--color-muted)] mb-0.5">Saldo Berjalan</p>
                <p className={"text-sm font-semibold " + (selected.balance >= 0 ? "text-[var(--color-foreground)]" : "text-red-400")}>
                  {selected.balance >= 0 ? "" : "−"}{formatIDR(Math.abs(selected.balance))}
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
