"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useTransition } from "react"

interface YearSelectorProps {
  years: number[]
  current: number
}

export function YearSelector({ years, current }: YearSelectorProps) {
  const router = useRouter()
  const params = useSearchParams()
  const [pending, startTransition] = useTransition()

  function selectYear(year: number) {
    const next = new URLSearchParams(params.toString())
    next.set("year", String(year))
    startTransition(() => {
      router.push(`/dashboard/trends?${next.toString()}`)
    })
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {years.map((y) => {
        const active = y === current
        return (
          <button
            key={y}
            onClick={() => selectYear(y)}
            disabled={pending}
            className={
              "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 " +
              (active
                ? "bg-[var(--color-brand-500)] text-white"
                : "bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-foreground)] hover:border-[var(--color-brand-500)]")
            }
          >
            {y}
          </button>
        )
      })}
    </div>
  )
}
