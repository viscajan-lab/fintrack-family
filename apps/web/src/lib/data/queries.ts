import { createClient } from "@/lib/supabase/server"

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TxRow {
  id: string
  description: string
  type: "income" | "expense"
  amount: number
  category_name: string | null
  date: string
  notes: string | null
}

export interface BudgetRow {
  id: string
  category_name: string
  amount: number        // limit
  spent: number         // computed from transactions
  month: string         // YYYY-MM
}

export interface DashboardStats {
  income: number
  expense: number
  savings: number
  tx_count: number
}

export interface ChartPoint {
  name: string          // "Jan", "Feb", ...
  income: number
  expense: number
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function getTenantId(): Promise<string | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from("tenant_members")
    .select("tenant_id")
    .eq("user_id", user.id)
    .limit(1)
    .single()

  return data?.tenant_id ?? null
}

// ─── Dashboard summary stats (current month) ─────────────────────────────────

export async function getDashboardStats(): Promise<DashboardStats> {
  const supabase   = await createClient()
  const tenantId   = await getTenantId()
  if (!tenantId) return { income: 0, expense: 0, savings: 0, tx_count: 0 }

  const now    = new Date()
  const from   = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`
  const nextM  = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  const to     = nextM.toISOString().split("T")[0]

  const { data } = await supabase
    .from("transactions")
    .select("type, amount")
    .eq("tenant_id", tenantId)
    .gte("date", from)
    .lt("date", to)

  const rows = data ?? []
  const income  = rows.filter(r => r.type === "income").reduce((s, r) => s + r.amount, 0)
  const expense = rows.filter(r => r.type === "expense").reduce((s, r) => s + r.amount, 0)

  return {
    income,
    expense,
    savings:  income - expense,
    tx_count: rows.length,
  }
}

// ─── Last 6 months chart data ─────────────────────────────────────────────────

export async function getChartData(): Promise<ChartPoint[]> {
  const supabase  = await createClient()
  const tenantId  = await getTenantId()
  if (!tenantId) return []

  // Build last 6 month ranges
  const months: { label: string; from: string; to: string }[] = []
  for (let i = 5; i >= 0; i--) {
    const d    = new Date()
    d.setDate(1)
    d.setMonth(d.getMonth() - i)
    const y    = d.getFullYear()
    const m    = d.getMonth() + 1
    const from = `${y}-${String(m).padStart(2, "0")}-01`
    const next = new Date(y, m, 1)
    const to   = next.toISOString().split("T")[0]
    const MONTHS_ID = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Ags","Sep","Okt","Nov","Des"]
    months.push({ label: MONTHS_ID[m - 1], from, to })
  }

  const { data } = await supabase
    .from("transactions")
    .select("type, amount, date")
    .eq("tenant_id", tenantId)
    .gte("date", months[0].from)
    .lt("date", months[months.length - 1].to)

  const rows = data ?? []

  return months.map(({ label, from, to }) => {
    const inRange = rows.filter(r => r.date >= from && r.date < to)
    return {
      name:    label,
      income:  inRange.filter(r => r.type === "income").reduce((s, r) => s + r.amount, 0),
      expense: inRange.filter(r => r.type === "expense").reduce((s, r) => s + r.amount, 0),
    }
  })
}

// ─── Recent transactions (last 5) ─────────────────────────────────────────────

export async function getRecentTransactions(): Promise<TxRow[]> {
  const supabase  = await createClient()
  const tenantId  = await getTenantId()
  if (!tenantId) return []

  const { data } = await supabase
    .from("transactions")
    .select("id, description, type, amount, date, notes, categories(name)")
    .eq("tenant_id", tenantId)
    .order("date", { ascending: false })
    .limit(5)

  return (data ?? []).map((r: any) => ({
    id:            r.id,
    description:   r.description,
    type:          r.type,
    amount:        r.amount,
    category_name: r.categories?.name ?? null,
    date:          r.date,
    notes:         r.notes ?? null,
  }))
}

// ─── All transactions (paginated, with optional filter) ───────────────────────

export async function getTransactions(opts?: {
  type?: "income" | "expense"
  month?: string   // YYYY-MM
  limit?: number
  offset?: number
}): Promise<{ rows: TxRow[]; total: number }> {
  const supabase  = await createClient()
  const tenantId  = await getTenantId()
  if (!tenantId) return { rows: [], total: 0 }

  let q = supabase
    .from("transactions")
    .select("id, description, type, amount, date, notes, categories(name)", { count: "exact" })
    .eq("tenant_id", tenantId)
    .order("date", { ascending: false })

  if (opts?.type)  q = q.eq("type", opts.type)
  if (opts?.month) {
    const [y, m] = opts.month.split("-")
    const from   = `${y}-${m}-01`
    const next   = new Date(Number(y), Number(m), 1)
    const to     = next.toISOString().split("T")[0]
    q = q.gte("date", from).lt("date", to)
  }
  if (opts?.limit)  q = q.limit(opts.limit)
  if (opts?.offset) q = q.range(opts.offset, (opts.offset + (opts.limit ?? 20)) - 1)

  const { data, count } = await q

  return {
    rows: (data ?? []).map((r: any) => ({
      id:            r.id,
      description:   r.description,
      type:          r.type,
      amount:        r.amount,
      category_name: r.categories?.name ?? null,
      date:          r.date,
      notes:         r.notes ?? null,
    })),
    total: count ?? 0,
  }
}

// ─── Budgets + spent this month ───────────────────────────────────────────────

export async function getBudgets(): Promise<BudgetRow[]> {
  const supabase  = await createClient()
  const tenantId  = await getTenantId()
  if (!tenantId) return []

  const now   = new Date()
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  const from  = `${month}-01`
  const next  = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  const to    = next.toISOString().split("T")[0]

  // Budgets for this month
  const { data: budgets } = await supabase
    .from("budgets")
    .select("id, amount, month, categories(name)")
    .eq("tenant_id", tenantId)
    .eq("month", month)

  if (!budgets?.length) return []

  // Transactions this month grouped by category
  const { data: txs } = await supabase
    .from("transactions")
    .select("amount, category_id")
    .eq("tenant_id", tenantId)
    .eq("type", "expense")
    .gte("date", from)
    .lt("date", to)

  const spentByCategory: Record<string, number> = {}
  for (const tx of txs ?? []) {
    if (tx.category_id) {
      spentByCategory[tx.category_id] = (spentByCategory[tx.category_id] ?? 0) + tx.amount
    }
  }

  return budgets.map((b: any) => ({
    id:            b.id,
    category_name: b.categories?.name ?? "—",
    amount:        b.amount,
    spent:         spentByCategory[b.id] ?? 0,
    month,
  }))
}

// ─── Categories list ──────────────────────────────────────────────────────────

export async function getCategories() {
  const supabase = await createClient()
  const tenantId = await getTenantId()
  if (!tenantId) return []

  const { data } = await supabase
    .from("categories")
    .select("id, name, type, icon")
    .eq("tenant_id", tenantId)
    .order("name")

  return data ?? []
}
