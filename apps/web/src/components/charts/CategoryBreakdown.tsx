"use client"

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts"
import type { TooltipContentProps } from "recharts"
import { formatIDR, formatIDRShort } from "@/lib/utils"
import type { CategorySlice } from "@/lib/data/queries"

interface Props { data: CategorySlice[] }

// Palet selaras tema — expense-ish, cukup kontras untuk dibedakan
const COLORS = [
  "var(--color-expense)",
  "#f59e0b",
  "#8b5cf6",
  "#06b6d4",
  "#ec4899",
  "#84cc16",
  "#f97316",
  "#64748b",
]

function CustomTooltip({ active, payload }: Partial<TooltipContentProps<number, string>>) {
  if (!active || !payload?.length) return null
  const slice = payload[0].payload as CategorySlice
  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg p-3 text-sm shadow-lg">
      <p className="font-medium mb-1">{slice.category_name}</p>
      <p className="text-[var(--color-muted)]">
        {formatIDR(slice.total)} · {slice.pct}%
      </p>
    </div>
  )
}

export function CategoryBreakdown({ data }: Props) {
  if (!data.length) {
    return (
      <div className="rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] p-5">
        <h3 className="font-semibold mb-4">Pengeluaran per Kategori</h3>
        <p className="text-sm text-[var(--color-muted)] py-8 text-center">
          Belum ada pengeluaran bulan ini.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] p-5">
      <h3 className="font-semibold mb-4">Pengeluaran per Kategori</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
        {/* Donut */}
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie
              data={data}
              dataKey="total"
              nameKey="category_name"
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={90}
              paddingAngle={2}
              stroke="none"
            >
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>

        {/* Legend + bar tabel */}
        <div className="space-y-3">
          {data.map((slice, i) => (
            <div key={slice.category_name} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ background: COLORS[i % COLORS.length] }}
                  />
                  <span className="truncate">{slice.category_name}</span>
                </span>
                <span className="text-[var(--color-muted)] shrink-0 ml-2">
                  {formatIDRShort(slice.total)} · {slice.pct}%
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-[var(--color-border)] overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${slice.pct}%`, background: COLORS[i % COLORS.length] }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
