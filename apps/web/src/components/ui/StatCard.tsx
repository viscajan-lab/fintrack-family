import { cn } from "@/lib/utils"
import type { LucideIcon } from "lucide-react"

interface StatCardProps {
  label:    string
  value:    string
  sub?:     string
  icon:     LucideIcon
  variant?: "income" | "expense" | "savings" | "default"
}

const variantStyles = {
  income:  "text-[var(--color-income)]  bg-green-50  dark:bg-green-950/30",
  expense: "text-[var(--color-expense)] bg-red-50    dark:bg-red-950/30",
  savings: "text-[var(--color-savings)] bg-blue-50   dark:bg-blue-950/30",
  default: "text-[var(--color-brand-500)] bg-[var(--color-brand-50)]",
}

export function StatCard({ label, value, sub, icon: Icon, variant = "default" }: StatCardProps) {
  return (
    <div className="rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] p-5 flex items-start gap-4">
      <div className={cn("rounded-lg p-2.5", variantStyles[variant])}>
        <Icon size={20} strokeWidth={1.8} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-[var(--color-muted)] mb-0.5">{label}</p>
        <p className="text-xl font-semibold truncate">{value}</p>
        {sub && <p className="text-xs text-[var(--color-muted)] mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}
