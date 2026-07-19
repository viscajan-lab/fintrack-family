"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useTransition } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"

const MONTHS_FULL_ID = [
  "Januari","Februari","Maret","April","Mei","Juni",
  "Juli","Agustus","September","Oktober","November","Desember",
]

interface MonthSelectorProps {
  year: number
  month: number   // 1-12
}

/** Navigasi bulan (prev/next) untuk halaman Kalender Cashflow. */
export function MonthSelector({ year, month }: MonthSelectorProps) {
  const router = useRouter()
  const params = useSearchParams()
  const [pending, startTransition] = useTransition()

  function go(y: number, m: number) {
    const next = new URLSearchParams(params.toString())
    next.set("year", String(y))
    next.set("month", String(m))
    startTransition(() => {
      router.push(`/dashboard/calendar?${next.toString()}`)
    })
  }

  function prev() {
    if (month <= 1) go(year - 1, 12)
    else go(year, month - 1)
  }
  function next() {
    if (month >= 12) go(year + 1, 1)
    else go(year, month + 1)
  }

  return (
    <div className="flex items-center gap-1.5">
      <button
        onClick={prev}
        disabled={pending}
        aria-label="Bulan sebelumnya"
        className="p-2 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-foreground)] hover:border-[var(--color-brand-500)] transition-colors disabled:opacity-50"
      >
        <ChevronLeft size={16} />
      </button>
      <div className="min-w-[9.5rem] text-center px-3 py-1.5 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-sm font-medium">
        {MONTHS_FULL_ID[month - 1]} {year}
      </div>
      <button
        onClick={next}
        disabled={pending}
        aria-label="Bulan berikutnya"
        className="p-2 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-foreground)] hover:border-[var(--color-brand-500)] transition-colors disabled:opacity-50"
      >
        <ChevronRight size={16} />
      </button>
    </div>
  )
}
