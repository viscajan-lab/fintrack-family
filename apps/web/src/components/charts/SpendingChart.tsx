"use client"

import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer,
} from "recharts"
import type { TooltipContentProps } from "recharts"
import { formatIDRShort } from "@/lib/utils"

interface DataPoint { name: string; income: number; expense: number }

interface SpendingChartProps { data: DataPoint[] }

function CustomTooltip({ active, payload, label }: Partial<TooltipContentProps<number, string>>) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg p-3 text-sm shadow-lg">
      <p className="font-medium mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name === "income" ? "Pemasukan" : "Pengeluaran"}: {formatIDRShort(Number(p.value))}
        </p>
      ))}
    </div>
  )
}

export function SpendingChart({ data }: SpendingChartProps) {
  return (
    <div className="rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] p-5">
      <h3 className="font-semibold mb-4">Arus Kas 6 Bulan</h3>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} barGap={4} barCategoryGap="30%">
          <XAxis dataKey="name" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
          <YAxis tickFormatter={formatIDRShort} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={60} />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "transparent" }} />
          <Bar dataKey="income"  radius={[4,4,0,0]} fill="var(--color-income)"  name="income" />
          <Bar dataKey="expense" radius={[4,4,0,0]} fill="var(--color-expense)" name="expense" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
