"use client"

import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend,
} from "recharts"
import type { TooltipContentProps } from "recharts"
import { formatIDRShort, formatIDR } from "@/lib/utils"

interface DataPoint { name: string; income: number; expense: number }

interface YearlyTrendChartProps { data: DataPoint[] }

function CustomTooltip({ active, payload, label }: Partial<TooltipContentProps<number, string>>) {
  if (!active || !payload?.length) return null

  const income  = Number(payload.find((p) => p.dataKey === "income")?.value  ?? 0)
  const expense = Number(payload.find((p) => p.dataKey === "expense")?.value ?? 0)
  const savings = income - expense

  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg p-3 text-sm shadow-lg min-w-[180px]">
      <p className="font-medium mb-1.5">{label}</p>
      <p style={{ color: "var(--color-income)" }}>Pemasukan: {formatIDR(income)}</p>
      <p style={{ color: "var(--color-expense)" }}>Pengeluaran: {formatIDR(expense)}</p>
      <p className="mt-1 pt-1 border-t border-[var(--color-border)] font-medium"
         style={{ color: savings >= 0 ? "var(--color-income)" : "var(--color-expense)" }}>
        Tabungan: {formatIDR(savings)}
      </p>
    </div>
  )
}

function LegendLabel(value: string) {
  const map: Record<string, string> = {
    income:  "Pemasukan",
    expense: "Pengeluaran",
    savings: "Tabungan (garis)",
  }
  return <span className="text-xs text-[var(--color-muted)]">{map[value] ?? value}</span>
}

export function YearlyTrendChart({ data }: YearlyTrendChartProps) {
  // Turunkan seri tabungan (income - expense) untuk garis overlay
  const chartData = data.map((d) => ({
    ...d,
    savings: d.income - d.expense,
  }))

  return (
    <div className="rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] p-5">
      <h3 className="font-semibold mb-4">Arus Kas 12 Bulan</h3>
      <ResponsiveContainer width="100%" height={320}>
        <ComposedChart data={chartData} barGap={4} barCategoryGap="24%">
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
          <YAxis tickFormatter={formatIDRShort} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={60} />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "transparent" }} />
          <Legend formatter={LegendLabel} iconType="circle" iconSize={8} />
          <Bar dataKey="income"  radius={[4,4,0,0]} fill="var(--color-income)"  name="income" />
          <Bar dataKey="expense" radius={[4,4,0,0]} fill="var(--color-expense)" name="expense" />
          <Line
            type="monotone"
            dataKey="savings"
            name="savings"
            stroke="var(--color-brand-500)"
            strokeWidth={2}
            dot={{ r: 3, fill: "var(--color-brand-500)" }}
            activeDot={{ r: 5 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
