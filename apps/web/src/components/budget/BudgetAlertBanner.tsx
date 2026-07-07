import { formatIDR, cn } from "@/lib/utils"
import type { BudgetAlert } from "@/lib/data/queries"

/**
 * Banner peringatan budget untuk dashboard web.
 * Mirror ambang bot: 🟡 warning >=70% · 🔴 danger >=90% · 🚨 over >100%.
 *
 * Tidak me-render apa pun kalau tidak ada kategori yang perlu diwaspadai
 * (semua < 70%), jadi aman dipasang di halaman mana pun.
 */

const LEVEL_META: Record<
  BudgetAlert["level"],
  { icon: string; label: string; accent: string; bg: string; border: string }
> = {
  warning: {
    icon: "🟡",
    label: "Perhatian",
    accent: "text-[var(--color-warning)]",
    bg: "bg-[var(--color-warning)]/10",
    border: "border-[var(--color-warning)]/30",
  },
  danger: {
    icon: "🔴",
    label: "Hampir Habis",
    accent: "text-[var(--color-expense)]",
    bg: "bg-[var(--color-expense)]/10",
    border: "border-[var(--color-expense)]/30",
  },
  over: {
    icon: "🚨",
    label: "Budget Jebol",
    accent: "text-[var(--color-expense)]",
    bg: "bg-[var(--color-expense)]/15",
    border: "border-[var(--color-expense)]/50",
  },
}

export function BudgetAlertBanner({ alerts }: { alerts: BudgetAlert[] }) {
  if (!alerts.length) return null

  return (
    <div className="space-y-2">
      {alerts.map((a) => {
        const meta = LEVEL_META[a.level]
        const sisa = a.amount - a.spent

        return (
          <div
            key={a.category_name}
            className={cn(
              "flex items-start gap-3 rounded-xl border px-4 py-3",
              meta.bg,
              meta.border,
            )}
          >
            <span className="text-lg leading-none mt-0.5">{meta.icon}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold">
                  <span className={meta.accent}>{meta.label}</span>
                  {" · "}
                  <span className="font-medium">{a.category_name}</span>
                </p>
                <span className={cn("text-sm font-bold shrink-0", meta.accent)}>
                  {a.pct}%
                </span>
              </div>
              <p className="text-xs text-[var(--color-muted)] mt-0.5">
                Terpakai {formatIDR(a.spent)} / {formatIDR(a.amount)}
                {" · "}
                {sisa < 0
                  ? <span className={meta.accent}>Lebih {formatIDR(Math.abs(sisa))}</span>
                  : <>Sisa {formatIDR(sisa)}</>}
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
