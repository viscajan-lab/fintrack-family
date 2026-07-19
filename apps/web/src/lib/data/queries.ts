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

export interface RecurringRule {
  id: string
  description: string
  type: "income" | "expense"
  amount: number
  category_name: string
  day_of_month: number      // 1-31
  mode: "auto" | "reminder"
  active: boolean
}

export interface DeltaStat {
  now: number
  prev: number
  diff: number
  pct: number | null      // null = tak terdefinisi (prev 0)
  goodWhenUp: boolean
}

export interface CategoryMover {
  category: string
  now: number
  prev: number
  diff: number
  pct: number | null
}

export interface InsightData {
  hasData: boolean
  month: number           // 1-12
  year: number
  prevMonth: number
  prevYear: number
  income: DeltaStat
  expense: DeltaStat
  savings: DeltaStat
  movers: CategoryMover[]
  dailyAvg: number
  projectedExpense: number
  daysInMonth: number
  dayNow: number
  tips: string[]
}

export interface Member {
  id: string
  display_name: string
  role: "admin" | "member"
  isMe: boolean           // baris ini = user yang sedang login
  linked: boolean         // sudah punya akun web (user_id terisi)
}

export interface InviteRow {
  id: string
  token: string
  role: "admin" | "member"
  label: string | null
  link: string | null     // deep-link Telegram siap pakai (null jika env bot kosong)
  expires_at: string
  expired: boolean         // sudah lewat expires_at
}

export interface MembersData {
  familyName: string
  tenantId: string
  members: Member[]
  isAdmin: boolean        // user login = admin (boleh lihat link undangan)
  inviteLink: string | null
  invites: InviteRow[]    // undangan tertarget aktif (admin only)
}

export interface SavingsGoal {
  id: string
  name: string
  target_amount: number
  saved_amount: number
  deadline: string | null      // YYYY-MM-DD
  note: string | null
  achieved: boolean            // saved >= target
  pct: number                  // 0-100 (clamped)
  remaining: number            // max(target - saved, 0)
  daysLeft: number | null      // null jika tak ada deadline
}

export interface Category {
  id: string
  name: string
  emoji: string | null
  type: "income" | "expense" | "both"
  isDefault: boolean           // true = kategori bawaan global (tenant_id NULL), tak bisa diedit/hapus
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function getTenantId(): Promise<string | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // Prioritaskan tenant yang punya telegram_id (tenant bot) agar deterministik
  // saat user jadi member >1 tenant; fallback ke keanggotaan terlama.
  const { data } = await supabase
    .from("tenant_members")
    .select("tenant_id, telegram_id, joined_at")
    .eq("user_id", user.id)
    .order("telegram_id", { ascending: false, nullsFirst: false })
    .order("joined_at",   { ascending: true })
    .limit(1)
    .maybeSingle()

  return data?.tenant_id ?? null
}

// Role tertinggi user login lintas semua tenant: super_admin > admin > member.
// Dipakai untuk gating menu sidebar & akses panel /admin (model SaaS managed).
export type UserRole = "super_admin" | "admin" | "member"

export async function getMyRole(): Promise<UserRole> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return "member"

  const { data } = await supabase
    .from("tenant_members")
    .select("role")
    .eq("user_id", user.id)

  const roles = new Set((data ?? []).map((r) => r.role))
  if (roles.has("super_admin")) return "super_admin"
  if (roles.has("admin")) return "admin"
  return "member"
}

// ─── Panel /admin — ringkasan lintas-tenant (super_admin) ────────────────────
// Data global dibuka lewat RPC SECURITY DEFINER (admin_list_tenants /
// admin_global_stats) yang di-guard is_super_admin() di sisi DB — RLS biasa
// membatasi ke tenant sendiri, jadi RPC ini satu-satunya jalan sah super_admin
// melihat seluruh tenant. Non-super-admin: RPC balikan kosong (bukan error).

export interface AdminTenantRow {
  id: string
  name: string
  slug: string
  plan: string
  created_at: string
  member_count: number
  tx_count: number
}

export interface AdminGlobalStats {
  tenant_count: number
  member_count: number
  tx_count: number
  admin_count: number
}

export interface AdminOverview {
  stats: AdminGlobalStats
  tenants: AdminTenantRow[]
}

export async function getAdminOverview(): Promise<AdminOverview> {
  const supabase = await createClient()

  const [{ data: statsRows }, { data: tenantRows }] = await Promise.all([
    supabase.rpc("admin_global_stats"),
    supabase.rpc("admin_list_tenants"),
  ])

  const s = (statsRows ?? [])[0] as Partial<AdminGlobalStats> | undefined
  const stats: AdminGlobalStats = {
    tenant_count: Number(s?.tenant_count ?? 0),
    member_count: Number(s?.member_count ?? 0),
    tx_count:     Number(s?.tx_count ?? 0),
    admin_count:  Number(s?.admin_count ?? 0),
  }

  const tenants: AdminTenantRow[] = (tenantRows ?? []).map((r: AdminTenantRow) => ({
    id:           r.id,
    name:         r.name,
    slug:         r.slug,
    plan:         r.plan,
    created_at:   r.created_at,
    member_count: Number(r.member_count ?? 0),
    tx_count:     Number(r.tx_count ?? 0),
  }))

  return { stats, tenants }
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
    .gte("transaction_date", from)
    .lt("transaction_date", to)

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
    .select("type, amount, date:transaction_date")
    .eq("tenant_id", tenantId)
    .gte("transaction_date", months[0].from)
    .lt("transaction_date", months[months.length - 1].to)

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
    .select("id, description, type, amount, date:transaction_date, notes, category_name")
    .eq("tenant_id", tenantId)
    .order("transaction_date", { ascending: false })
    .limit(5)

  return (data ?? []).map((r) => ({
    id:            r.id,
    description:   r.description,
    type:          r.type,
    amount:        r.amount,
    category_name: r.category_name ?? null,
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
    .select("id, description, type, amount, date:transaction_date, notes, category_name", { count: "exact" })
    .eq("tenant_id", tenantId)
    .order("transaction_date", { ascending: false })

  if (opts?.type)  q = q.eq("type", opts.type)
  if (opts?.month) {
    const [y, m] = opts.month.split("-")
    const from   = `${y}-${m}-01`
    const next   = new Date(Number(y), Number(m), 1)
    const to     = next.toISOString().split("T")[0]
    q = q.gte("transaction_date", from).lt("transaction_date", to)
  }
  if (opts?.limit)  q = q.limit(opts.limit)
  if (opts?.offset) q = q.range(opts.offset, (opts.offset + (opts.limit ?? 20)) - 1)

  const { data, count } = await q

  return {
    rows: (data ?? []).map((r) => ({
      id:            r.id,
      description:   r.description,
      type:          r.type,
      amount:        r.amount,
      category_name: r.category_name ?? null,
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
  const year  = now.getFullYear()
  const month = now.getMonth() + 1                    // 1-12 (smallint di DB)
  const from  = `${year}-${String(month).padStart(2, "0")}-01`
  const next  = new Date(year, month, 1)
  const to    = next.toISOString().split("T")[0]

  // Budgets bulan ini (kategori disimpan sbg TEXT di category_name)
  const { data: budgets } = await supabase
    .from("budgets")
    .select("id, amount, category_name")
    .eq("tenant_id", tenantId)
    .eq("year", year)
    .eq("month", month)

  if (!budgets?.length) return []

  // Transaksi expense bulan ini, di-agregat by category_name (match cara bot simpan)
  const { data: txs } = await supabase
    .from("transactions")
    .select("amount, category_name")
    .eq("tenant_id", tenantId)
    .eq("type", "expense")
    .gte("transaction_date", from)
    .lt("transaction_date", to)

  const spentByCategory: Record<string, number> = {}
  for (const tx of txs ?? []) {
    if (tx.category_name) {
      spentByCategory[tx.category_name] = (spentByCategory[tx.category_name] ?? 0) + tx.amount
    }
  }

  return budgets.map((b) => ({
    id:            b.id,
    category_name: b.category_name,
    amount:        b.amount,
    spent:         spentByCategory[b.category_name] ?? 0,
    month:         `${year}-${String(month).padStart(2, "0")}`,
  }))
}

// ─── Budget alerts (kategori mendekati / lewat limit) ─────────────────────────

export type BudgetAlertLevel = "warning" | "danger" | "over"

export interface BudgetAlert {
  category_name: string
  amount:  number   // limit
  spent:   number
  pct:     number   // 0-100+ (dibulatkan)
  level:   BudgetAlertLevel
}

/**
 * Kembalikan kategori yang sudah >=70% terpakai bulan ini.
 * Ambang mirror bot: 🟡 warning >=70% · 🔴 danger >=90% · 🚨 over >100%.
 * Diurutkan dari yang paling kritis (pct terbesar) lebih dulu.
 */
export async function getBudgetAlerts(): Promise<BudgetAlert[]> {
  const budgets = await getBudgets()   // reuse: sudah menghitung spent by category_name

  const alerts: BudgetAlert[] = []
  for (const b of budgets) {
    if (b.amount <= 0) continue
    const ratio = b.spent / b.amount
    if (ratio < 0.70) continue

    const level: BudgetAlertLevel =
      ratio > 1.0  ? "over"
      : ratio >= 0.90 ? "danger"
      : "warning"

    alerts.push({
      category_name: b.category_name,
      amount: b.amount,
      spent:  b.spent,
      pct:    Math.round(ratio * 100),
      level,
    })
  }

  // paling kritis dulu
  return alerts.sort((a, b) => b.pct - a.pct)
}

// ─── Expense breakdown by category (current month) ───────────────────────────

export interface CategorySlice {
  category_name: string
  total:  number
  count:  number
  pct:    number   // 0-100, share dari total pengeluaran bulan ini
}

/**
 * Rincian pengeluaran per kategori bulan berjalan, diurutkan dari terbesar.
 * Query transactions langsung + agregat by category_name (match cara bot simpan),
 * konsisten dgn getBudgets. Kategori kosong dikelompokkan jadi "Lainnya".
 */
export async function getExpenseByCategory(): Promise<CategorySlice[]> {
  const supabase = await createClient()
  const tenantId = await getTenantId()
  if (!tenantId) return []

  const now   = new Date()
  const from  = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`
  const next  = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  const to    = next.toISOString().split("T")[0]

  const { data } = await supabase
    .from("transactions")
    .select("amount, category_name")
    .eq("tenant_id", tenantId)
    .eq("type", "expense")
    .gte("transaction_date", from)
    .lt("transaction_date", to)

  const rows = data ?? []
  if (!rows.length) return []

  const byCat: Record<string, { total: number; count: number }> = {}
  for (const r of rows) {
    const key = r.category_name?.trim() || "Lainnya"
    byCat[key] ??= { total: 0, count: 0 }
    byCat[key].total += r.amount
    byCat[key].count += 1
  }

  const grand = Object.values(byCat).reduce((s, v) => s + v.total, 0)

  return Object.entries(byCat)
    .map(([category_name, v]) => ({
      category_name,
      total: v.total,
      count: v.count,
      pct:   grand > 0 ? Math.round((v.total / grand) * 100) : 0,
    }))
    .sort((a, b) => b.total - a.total)
}

// ─── Recurring rules (tagihan/langganan berulang) ────────────────────────────

export async function getRecurringRules(): Promise<RecurringRule[]> {
  const supabase = await createClient()
  const tenantId = await getTenantId()
  if (!tenantId) return []

  const { data } = await supabase
    .from("recurring_rules")
    .select("id, description, type, amount, category_name, day_of_month, mode, active")
    .eq("tenant_id", tenantId)
    .order("active", { ascending: false })
    .order("day_of_month", { ascending: true })

  return (data ?? []) as RecurringRule[]
}

// ─── Audit log / riwayat aktivitas ────────────────────────────────────────────

export type AuditLog = {
  id: string
  action: string
  table_name: string
  record_id: string | null
  old_data: Record<string, unknown> | null
  new_data: Record<string, unknown> | null
  created_at: string
  actor_name: string | null
}

export async function getAuditLogs(limit = 100): Promise<AuditLog[]> {
  const supabase = await createClient()
  const tenantId = await getTenantId()
  if (!tenantId) return []

  const { data } = await supabase
    .from("audit_logs")
    .select("id, user_id, action, table_name, record_id, old_data, new_data, created_at")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(limit)

  const rows = data ?? []

  // Resolusi nama pelaku via tenant_members (best-effort).
  const userIds = [...new Set(rows.map((r) => r.user_id).filter(Boolean))] as string[]
  const nameMap = new Map<string, string>()
  if (userIds.length > 0) {
    const { data: members } = await supabase
      .from("tenant_members")
      .select("user_id, display_name")
      .eq("tenant_id", tenantId)
      .in("user_id", userIds)
    for (const m of members ?? []) {
      if (m.user_id && m.display_name) nameMap.set(m.user_id, m.display_name)
    }
  }

  return rows.map((r) => ({
    id:         r.id,
    action:     r.action,
    table_name: r.table_name,
    record_id:  r.record_id,
    old_data:   r.old_data,
    new_data:   r.new_data,
    created_at: r.created_at,
    actor_name: r.user_id ? (nameMap.get(r.user_id) ?? null) : null,
  })) as AuditLog[]
}

// ─── Insight / analitik (bulan ini vs bulan lalu) ─────────────────────────────
// Mirror logika bot /insight: read-only dari tabel transactions, tanpa migrasi.

function monthRange(month: number, year: number): { from: string; to: string } {
  const from = `${year}-${String(month).padStart(2, "0")}-01`
  const nm = month === 12 ? 1 : month + 1
  const ny = month === 12 ? year + 1 : year
  const to = `${ny}-${String(nm).padStart(2, "0")}-01`  // eksklusif
  return { from, to }
}

function delta(now: number, prev: number, goodWhenUp: boolean): DeltaStat {
  const diff = now - prev
  const pct = prev === 0 ? null : Math.round((Math.abs(diff) / prev) * 100)
  return { now, prev, diff, pct, goodWhenUp }
}

export async function getInsight(): Promise<InsightData> {
  const supabase = await createClient()
  const tenantId = await getTenantId()

  const now = new Date()
  const month = now.getMonth() + 1
  const year = now.getFullYear()
  const prevMonth = month === 1 ? 12 : month - 1
  const prevYear = month === 1 ? year - 1 : year
  const daysInMonth = new Date(year, month, 0).getDate()
  const dayNow = now.getDate()

  const empty: InsightData = {
    hasData: false, month, year, prevMonth, prevYear,
    income: delta(0, 0, true), expense: delta(0, 0, false), savings: delta(0, 0, true),
    movers: [], dailyAvg: 0, projectedExpense: 0, daysInMonth, dayNow, tips: [],
  }
  if (!tenantId) return empty

  const cur = monthRange(month, year)
  const prv = monthRange(prevMonth, prevYear)

  // Satu query menutup dua bulan (prev.from → cur.to eksklusif), lalu dipilah in-memory.
  const { data } = await supabase
    .from("transactions")
    .select("type, amount, category_name, transaction_date")
    .eq("tenant_id", tenantId)
    .gte("transaction_date", prv.from)
    .lt("transaction_date", cur.to)

  const rows = data ?? []
  if (rows.length === 0) return empty

  const inCur = (d: string) => d >= cur.from && d < cur.to
  const inPrv = (d: string) => d >= prv.from && d < prv.to

  const sum = (pred: (r: (typeof rows)[number]) => boolean) =>
    rows.filter(pred).reduce((s, r) => s + r.amount, 0)

  const nowInc = sum(r => r.type === "income" && inCur(r.transaction_date))
  const nowExp = sum(r => r.type === "expense" && inCur(r.transaction_date))
  const prevInc = sum(r => r.type === "income" && inPrv(r.transaction_date))
  const prevExp = sum(r => r.type === "expense" && inPrv(r.transaction_date))

  // Pengeluaran per kategori tiap bulan
  const catAgg = (pred: (r: (typeof rows)[number]) => boolean) => {
    const m: Record<string, number> = {}
    for (const r of rows) {
      if (r.type !== "expense" || !pred(r)) continue
      const k = r.category_name || "Lainnya"
      m[k] = (m[k] ?? 0) + r.amount
    }
    return m
  }
  const nowCat = catAgg(r => inCur(r.transaction_date))
  const prevCat = catAgg(r => inPrv(r.transaction_date))

  // Top movers: perubahan absolut terbesar (naik & turun)
  const keys = new Set([...Object.keys(nowCat), ...Object.keys(prevCat)])
  const movers: CategoryMover[] = []
  for (const k of keys) {
    const n = nowCat[k] ?? 0
    const p = prevCat[k] ?? 0
    if (n === p) continue
    movers.push({ category: k, now: n, prev: p, diff: n - p, pct: p === 0 ? null : Math.round((Math.abs(n - p) / p) * 100) })
  }
  movers.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))

  const nowNet = nowInc - nowExp
  const prevNet = prevInc - prevExp
  const dailyAvg = dayNow > 0 ? Math.round(nowExp / dayNow) : 0
  const projectedExpense = dailyAvg * daysInMonth

  // ── Tips kalimat (mirror _build_insights bot) ──
  const tips: string[] = []
  if (prevExp > 0 && nowExp > prevExp * 1.15) {
    tips.push(`⚠️ Pengeluaran naik ${Math.round(((nowExp - prevExp) / prevExp) * 100)}% dari bulan lalu — cek kategori yang melonjak di bawah.`)
  } else if (prevExp > 0 && nowExp < prevExp * 0.85) {
    tips.push(`👏 Pengeluaran turun ${Math.round(((prevExp - nowExp) / prevExp) * 100)}% dari bulan lalu. Hemat, mantap!`)
  }
  const topCat = Object.keys(nowCat).sort((a, b) => nowCat[b] - nowCat[a])[0]
  if (topCat) {
    const v = nowCat[topCat]
    const pv = prevCat[topCat] ?? 0
    tips.push(
      pv > 0 && v > pv * 1.3
        ? `🔍 ${topCat} jadi pos terbesar & naik ${Math.round(((v - pv) / pv) * 100)}% — pantau ekstra ya.`
        : `🔍 Pos terbesar bulan ini: ${topCat}.`,
    )
  }
  if (dayNow > 0 && nowExp > 0 && projectedExpense > nowExp) {
    tips.push(`📈 Rata-rata harian → proyeksi akhir bulan sekitar segitu. Sisakan ruang ya.`)
  }
  if (nowNet > 0) tips.push(`💰 Sejauh ini kamu nabung bulan ini. Pertahankan!`)
  else if (nowNet < 0) tips.push(`🚨 Pengeluaran > pemasukan bulan ini. Rem dikit yuk.`)

  return {
    hasData: true, month, year, prevMonth, prevYear,
    income: delta(nowInc, prevInc, true),
    expense: delta(nowExp, prevExp, false),
    savings: delta(nowNet, prevNet, true),
    movers: movers.slice(0, 5),
    dailyAvg, projectedExpense, daysInMonth, dayNow,
    tips: tips.slice(0, 4),
  }
}

// ─── Anggota keluarga (mirror bot /anggota) ───────────────────────────────────
// Read-only + link undangan. Join member baru tetap lewat bot (deep-link
// Telegram), jadi web hanya menampilkan daftar & memunculkan link untuk admin.
export async function getMembers(): Promise<MembersData | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const tenantId = await getTenantId()
  if (!user || !tenantId) return null

  const { data: tenant } = await supabase
    .from("tenants")
    .select("name")
    .eq("id", tenantId)
    .maybeSingle()

  const { data: rows } = await supabase
    .from("tenant_members")
    .select("id, display_name, role, user_id")
    .eq("tenant_id", tenantId)
    .order("role", { ascending: true })       // admin dulu (alfabetis: admin < member)
    .order("display_name", { ascending: true })

  const members: Member[] = (rows ?? []).map((r) => ({
    id: r.id,
    display_name: r.display_name ?? "Tanpa nama",
    role: r.role === "admin" ? "admin" : "member",
    isMe: r.user_id === user.id,
    linked: !!r.user_id,
  }))

  const isAdmin = members.some((m) => m.isMe && m.role === "admin")
  const botUser = process.env.NEXT_PUBLIC_BOT_USERNAME
  const inviteLink =
    isAdmin && botUser
      ? `https://t.me/${botUser}?start=join_${tenantId.replace(/-/g, "_")}`
      : null

  // Undangan tertarget aktif (belum dipakai) — admin only.
  let invites: InviteRow[] = []
  if (isAdmin) {
    const { data: invRows } = await supabase
      .from("invites")
      .select("id, token, role, label, expires_at, used_at")
      .eq("tenant_id", tenantId)
      .is("used_at", null)
      .order("created_at", { ascending: false })

    const now = Date.now()
    invites = (invRows ?? []).map((r) => ({
      id: r.id,
      token: r.token,
      role: r.role === "admin" ? "admin" : "member",
      label: r.label ?? null,
      link: botUser ? `https://t.me/${botUser}?start=inv_${r.token}` : null,
      expires_at: r.expires_at,
      expired: new Date(r.expires_at).getTime() < now,
    }))
  }

  return {
    familyName: tenant?.name ?? "Keluarga",
    tenantId,
    members,
    isAdmin,
    inviteLink,
    invites,
  }
}

// ─── Savings goals (target tabungan keluarga) ────────────────────────────────

export async function getSavingsGoals(): Promise<SavingsGoal[]> {
  const supabase = await createClient()
  const tenantId = await getTenantId()
  if (!tenantId) return []

  const { data } = await supabase
    .from("savings_goals")
    .select("id, name, target_amount, saved_amount, deadline, note")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  return (data ?? []).map((g) => {
    const target    = g.target_amount ?? 0
    const saved     = g.saved_amount ?? 0
    const achieved  = target > 0 && saved >= target
    const pct       = target > 0 ? Math.min(Math.round((saved / target) * 100), 100) : 0
    const remaining = Math.max(target - saved, 0)

    let daysLeft: number | null = null
    if (g.deadline) {
      const d = new Date(`${g.deadline}T00:00:00`)
      daysLeft = Math.ceil((d.getTime() - today.getTime()) / 86_400_000)
    }

    return {
      id: g.id,
      name: g.name,
      target_amount: target,
      saved_amount: saved,
      deadline: g.deadline,
      note: g.note,
      achieved,
      pct,
      remaining,
      daysLeft,
    }
  })
}

// ─── Categories (kategori custom keluarga) ───────────────────────────────────

export async function getCategories(): Promise<Category[]> {
  const supabase = await createClient()
  const tenantId = await getTenantId()

  // RLS: SELECT mengembalikan default global (tenant_id NULL) + custom milik tenant ini.
  // Query eksplisit meng-OR-kan agar tetap benar walau dipanggil tanpa konteks tenant.
  const filter = tenantId
    ? `tenant_id.is.null,tenant_id.eq.${tenantId}`
    : "tenant_id.is.null"

  const { data } = await supabase
    .from("categories")
    .select("id, name, emoji, type, tenant_id, sort_order")
    .or(filter)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true })

  return (data ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    emoji: c.emoji,
    type: (c.type === "income" || c.type === "expense") ? c.type : "both",
    isDefault: c.tenant_id === null,
  }))
}

// ─── Yearly trend (tren tahunan 12 bulan) ────────────────────────────────────

export interface YearlyTrendData {
  year: number
  months: ChartPoint[]          // 12 titik: Jan..Des (income/expense per bulan)
  totalIncome: number
  totalExpense: number
  totalSavings: number
  avgMonthlyExpense: number     // rata-rata pengeluaran per bulan yang ada transaksinya
  bestMonth: string | null      // bulan dgn tabungan tertinggi
  worstMonth: string | null     // bulan dgn tabungan terendah (paling boros)
}

const MONTHS_ID = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Ags","Sep","Okt","Nov","Des"]

// Daftar tahun yang punya transaksi (untuk year picker). Selalu sertakan tahun ini.
export async function getAvailableYears(): Promise<number[]> {
  const supabase = await createClient()
  const tenantId = await getTenantId()
  const nowYear  = new Date().getFullYear()
  if (!tenantId) return [nowYear]

  const { data } = await supabase
    .from("transactions")
    .select("transaction_date")
    .eq("tenant_id", tenantId)
    .order("transaction_date", { ascending: false })
    .limit(2000)

  const years = new Set<number>([nowYear])
  for (const r of data ?? []) {
    const y = Number(String(r.transaction_date).slice(0, 4))
    if (!Number.isNaN(y)) years.add(y)
  }
  return Array.from(years).sort((a, b) => b - a)
}

export async function getYearlyTrend(year: number): Promise<YearlyTrendData> {
  const supabase = await createClient()
  const tenantId = await getTenantId()

  const empty: YearlyTrendData = {
    year,
    months: MONTHS_ID.map((name) => ({ name, income: 0, expense: 0 })),
    totalIncome: 0, totalExpense: 0, totalSavings: 0,
    avgMonthlyExpense: 0, bestMonth: null, worstMonth: null,
  }
  if (!tenantId) return empty

  const from = `${year}-01-01`
  const to   = `${year + 1}-01-01`

  const { data } = await supabase
    .from("transactions")
    .select("type, amount, transaction_date")
    .eq("tenant_id", tenantId)
    .gte("transaction_date", from)
    .lt("transaction_date", to)

  const rows = data ?? []

  const months: ChartPoint[] = MONTHS_ID.map((name) => ({ name, income: 0, expense: 0 }))
  for (const r of rows) {
    const m = Number(String(r.transaction_date).slice(5, 7)) - 1  // 0-indexed
    if (m < 0 || m > 11) continue
    if (r.type === "income")  months[m].income  += r.amount
    else if (r.type === "expense") months[m].expense += r.amount
  }

  const totalIncome  = months.reduce((s, m) => s + m.income, 0)
  const totalExpense = months.reduce((s, m) => s + m.expense, 0)

  const monthsWithActivity = months.filter((m) => m.income > 0 || m.expense > 0)
  const avgMonthlyExpense  = monthsWithActivity.length
    ? Math.round(totalExpense / monthsWithActivity.length)
    : 0

  let bestMonth: string | null = null
  let worstMonth: string | null = null
  if (monthsWithActivity.length) {
    let bestVal = -Infinity, worstVal = Infinity
    for (const m of monthsWithActivity) {
      const savings = m.income - m.expense
      if (savings > bestVal)  { bestVal = savings;  bestMonth  = m.name }
      if (savings < worstVal) { worstVal = savings; worstMonth = m.name }
    }
  }

  return {
    year,
    months,
    totalIncome,
    totalExpense,
    totalSavings: totalIncome - totalExpense,
    avgMonthlyExpense,
    bestMonth,
    worstMonth,
  }
}

// ─── Kalender Cashflow (arus kas harian + saldo berjalan + prediksi) ──────────
// Menampilkan pemasukan/pengeluaran per HARI dalam satu bulan, saldo berjalan
// kumulatif (dalam bulan tsb), plus proyeksi saldo akhir bulan berdasarkan
// rata-rata net harian dari hari-hari yang sudah berlalu.

export interface CalendarDay {
  day: number            // 1..daysInMonth
  date: string           // YYYY-MM-DD
  income: number
  expense: number
  net: number            // income - expense (hari itu)
  balance: number        // saldo berjalan kumulatif s/d hari itu (dalam bulan)
  txCount: number
  isFuture: boolean      // hari setelah "hari ini" (untuk bulan berjalan)
  isToday: boolean
}

export interface CashflowCalendarData {
  year: number
  month: number          // 1-12
  monthName: string      // "Januari" dst
  daysInMonth: number
  leadingBlanks: number  // sel kosong sebelum tanggal 1 (0=Senin .. 6=Minggu)
  days: CalendarDay[]
  totalIncome: number
  totalExpense: number
  totalNet: number       // income - expense sebulan
  endBalance: number     // saldo berjalan di hari terakhir yg ada aktivitas
  busiestDay: number | null   // tanggal dgn |net| terbesar
  busiestNet: number
  isCurrentMonth: boolean
  projectedNet: number | null // proyeksi net akhir bulan (hanya utk bulan berjalan)
}

const MONTHS_FULL_ID = [
  "Januari","Februari","Maret","April","Mei","Juni",
  "Juli","Agustus","September","Oktober","November","Desember",
]

export async function getCashflowCalendar(year: number, month: number): Promise<CashflowCalendarData> {
  const supabase = await createClient()
  const tenantId = await getTenantId()

  const m0 = Math.min(11, Math.max(0, month - 1))   // 0-indexed, clamp
  const daysInMonth = new Date(year, m0 + 1, 0).getDate()
  // getDay(): 0=Minggu..6=Sabtu. Kita mau minggu mulai Senin → geser.
  const firstDow = new Date(year, m0, 1).getDay()
  const leadingBlanks = (firstDow + 6) % 7            // 0=Senin .. 6=Minggu

  const now = new Date()
  const isCurrentMonth = now.getFullYear() === year && now.getMonth() === m0
  const todayDate = now.getDate()

  const mkDays = (): CalendarDay[] =>
    Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1
      return {
        day,
        date: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
        income: 0, expense: 0, net: 0, balance: 0, txCount: 0,
        isFuture: isCurrentMonth && day > todayDate,
        isToday:  isCurrentMonth && day === todayDate,
      }
    })

  const empty: CashflowCalendarData = {
    year, month, monthName: MONTHS_FULL_ID[m0], daysInMonth, leadingBlanks,
    days: mkDays(), totalIncome: 0, totalExpense: 0, totalNet: 0, endBalance: 0,
    busiestDay: null, busiestNet: 0, isCurrentMonth, projectedNet: null,
  }
  if (!tenantId) return empty

  const from = `${year}-${String(month).padStart(2, "0")}-01`
  const to   = m0 === 11
    ? `${year + 1}-01-01`
    : `${year}-${String(month + 1).padStart(2, "0")}-01`

  const { data } = await supabase
    .from("transactions")
    .select("type, amount, transaction_date")
    .eq("tenant_id", tenantId)
    .gte("transaction_date", from)
    .lt("transaction_date", to)

  const rows = data ?? []
  const days = mkDays()

  for (const r of rows) {
    const d = Number(String(r.transaction_date).slice(8, 10))
    if (d < 1 || d > daysInMonth) continue
    const idx = d - 1
    if (r.type === "income")       days[idx].income  += r.amount
    else if (r.type === "expense") days[idx].expense += r.amount
    days[idx].txCount += 1
  }

  // net harian + saldo berjalan kumulatif
  let running = 0
  for (const d of days) {
    d.net = d.income - d.expense
    running += d.net
    d.balance = running
  }

  const totalIncome  = days.reduce((s, d) => s + d.income, 0)
  const totalExpense = days.reduce((s, d) => s + d.expense, 0)
  const totalNet     = totalIncome - totalExpense

  // hari tersibuk = |net| terbesar (yang ada aktivitas)
  let busiestDay: number | null = null
  let busiestNet = 0
  for (const d of days) {
    if (d.txCount > 0 && Math.abs(d.net) > Math.abs(busiestNet)) {
      busiestNet = d.net
      busiestDay = d.day
    }
  }

  // proyeksi net akhir bulan (bulan berjalan): ekstrapolasi rata-rata net/hari
  // dari hari 1..hari ini ke seluruh hari di bulan.
  let projectedNet: number | null = null
  if (isCurrentMonth && todayDate >= 1) {
    const elapsed = Math.min(todayDate, daysInMonth)
    const netToDate = days.slice(0, elapsed).reduce((s, d) => s + d.net, 0)
    projectedNet = Math.round((netToDate / elapsed) * daysInMonth)
  }

  return {
    year, month, monthName: MONTHS_FULL_ID[m0], daysInMonth, leadingBlanks,
    days, totalIncome, totalExpense, totalNet, endBalance: running,
    busiestDay, busiestNet, isCurrentMonth, projectedNet,
  }
}

// ─── Kantong per anggota (allowance + terpakai + sisa) ────────────────────────
// Setiap anggota punya "kantong" = jatah pengeluaran bulanan. Tiap transaksi
// expense yang ditandai member_id-nya mengurangi sisa kantong anggota tsb.

export type PocketLevel = "safe" | "warning" | "danger" | "over"

export interface MemberPocket {
  member_id:    string
  display_name: string
  role:         "admin" | "member"
  isMe:         boolean
  allowance:    number    // jatah bulan ini (0 jika belum di-set)
  spent:        number    // total expense bertanda member_id ini bulan ini
  remaining:    number    // allowance - spent (bisa negatif jika lewat)
  pct:          number    // 0-100+ (dibulatkan), 0 jika allowance 0
  level:        PocketLevel
  hasAllowance: boolean   // sudah di-set jatah untuk bulan ini
}

export interface PocketsData {
  month:       string        // "YYYY-MM"
  year:        number
  monthNum:    number        // 1-12
  isAdmin:     boolean       // boleh set jatah anggota
  pockets:     MemberPocket[]
  totalAllowance: number
  totalSpent:     number
  unassignedSpent: number    // expense bulan ini tanpa member_id ("Belum ditandai")
}

function pocketLevel(pct: number): PocketLevel {
  if (pct >  100) return "over"
  if (pct >=  90) return "danger"
  if (pct >=  75) return "warning"
  return "safe"
}

export async function getPockets(monthStr?: string): Promise<PocketsData | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const tenantId = await getTenantId()
  if (!user || !tenantId) return null

  // Tentukan bulan target (default: bulan berjalan)
  const now = new Date()
  let year  = now.getFullYear()
  let month = now.getMonth() + 1
  if (monthStr && /^\d{4}-\d{2}$/.test(monthStr)) {
    const [y, m] = monthStr.split("-").map((n) => parseInt(n, 10))
    if (y && m >= 1 && m <= 12) { year = y; month = m }
  }
  const from = `${year}-${String(month).padStart(2, "0")}-01`
  const next = new Date(year, month, 1)
  const to   = next.toISOString().split("T")[0]

  // Daftar anggota
  const { data: rows } = await supabase
    .from("tenant_members")
    .select("id, display_name, role, user_id")
    .eq("tenant_id", tenantId)
    .order("role", { ascending: true })
    .order("display_name", { ascending: true })

  // Jatah bulan ini
  const { data: allowRows } = await supabase
    .from("member_allowances")
    .select("member_id, amount")
    .eq("tenant_id", tenantId)
    .eq("year", year)
    .eq("month", month)

  const allowanceByMember: Record<string, number> = {}
  for (const a of allowRows ?? []) allowanceByMember[a.member_id] = a.amount

  // Expense bulan ini (dengan member_id) → agregat terpakai per anggota
  const { data: txs } = await supabase
    .from("transactions")
    .select("amount, member_id")
    .eq("tenant_id", tenantId)
    .eq("type", "expense")
    .gte("transaction_date", from)
    .lt("transaction_date", to)

  const spentByMember: Record<string, number> = {}
  let unassignedSpent = 0
  for (const tx of txs ?? []) {
    if (tx.member_id) {
      spentByMember[tx.member_id] = (spentByMember[tx.member_id] ?? 0) + tx.amount
    } else {
      unassignedSpent += tx.amount
    }
  }

  const isAdmin = (rows ?? []).some((r) => r.user_id === user.id && r.role === "admin")

  let totalAllowance = 0
  let totalSpent     = 0

  const pockets: MemberPocket[] = (rows ?? []).map((r) => {
    const allowance = allowanceByMember[r.id] ?? 0
    const spent     = spentByMember[r.id] ?? 0
    const remaining = allowance - spent
    const pct       = allowance > 0 ? Math.round((spent / allowance) * 100) : 0
    totalAllowance += allowance
    totalSpent     += spent
    return {
      member_id:    r.id,
      display_name: r.display_name ?? "Tanpa nama",
      role:         r.role === "admin" ? "admin" : "member",
      isMe:         r.user_id === user.id,
      allowance,
      spent,
      remaining,
      pct,
      level:        allowance > 0 ? pocketLevel(pct) : "safe",
      hasAllowance: allowance > 0,
    }
  })

  return {
    month:    `${year}-${String(month).padStart(2, "0")}`,
    year,
    monthNum: month,
    isAdmin,
    pockets,
    totalAllowance,
    totalSpent,
    unassignedSpent,
  }
}

// ─── Ranking "siapa paling ngabisin" (spending per anggota bulan ini) ─────────
export interface MemberSpendingRow {
  member_id:    string | null   // null = "Belum ditandai"
  display_name: string
  spent:        number
  pct:          number          // porsi dari total expense bulan ini (0-100)
}

export async function getMemberSpending(monthStr?: string): Promise<MemberSpendingRow[]> {
  const pockets = await getPockets(monthStr)
  if (!pockets) return []

  const total = pockets.totalSpent + pockets.unassignedSpent
  const rows: MemberSpendingRow[] = pockets.pockets
    .filter((p) => p.spent > 0)
    .map((p) => ({
      member_id:    p.member_id,
      display_name: p.display_name,
      spent:        p.spent,
      pct:          total > 0 ? Math.round((p.spent / total) * 100) : 0,
    }))

  if (pockets.unassignedSpent > 0) {
    rows.push({
      member_id:    null,
      display_name: "Belum ditandai",
      spent:        pockets.unassignedSpent,
      pct:          total > 0 ? Math.round((pockets.unassignedSpent / total) * 100) : 0,
    })
  }

  rows.sort((a, b) => b.spent - a.spent)
  return rows
}

// ─── Daftar anggota ringkas untuk pemilih di form transaksi ───────────────────
export interface PickerMember {
  id:           string
  display_name: string
  isMe:         boolean
}

export async function getMembersForPicker(): Promise<PickerMember[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const tenantId = await getTenantId()
  if (!user || !tenantId) return []

  const { data: rows } = await supabase
    .from("tenant_members")
    .select("id, display_name, user_id")
    .eq("tenant_id", tenantId)
    .order("role", { ascending: true })
    .order("display_name", { ascending: true })

  return (rows ?? []).map((r) => ({
    id:           r.id,
    display_name: r.display_name ?? "Tanpa nama",
    isMe:         r.user_id === user.id,
  }))
}

// ─── Hutang / Piutang (debts) ────────────────────────────────────────────────

export type DebtDirection = "payable" | "receivable"

export interface Debt {
  id:          string
  direction:   DebtDirection    // payable = hutang, receivable = piutang
  person_name: string
  amount:      number           // pokok total
  paid_amount: number           // sudah dibayar / diterima
  remaining:   number           // max(amount - paid, 0)
  pct:         number           // 0-100 (progres pelunasan)
  due_date:    string | null    // YYYY-MM-DD
  note:        string | null
  settled:     boolean          // paid_amount >= amount
  daysLeft:    number | null    // null jika tak ada jatuh tempo / sudah lunas
  overdue:     boolean          // jatuh tempo lewat & belum lunas
}

export interface DebtSummary {
  payableTotal:      number     // sisa hutang (yang harus dibayar)
  receivableTotal:   number     // sisa piutang (yang akan diterima)
  net:               number     // receivable - payable (positif = surplus)
  overdueCount:      number     // item lewat jatuh tempo & belum lunas
  activePayables:    number     // jumlah hutang belum lunas
  activeReceivables: number     // jumlah piutang belum lunas
}

export interface DebtsData {
  debts:   Debt[]
  summary: DebtSummary
}

export async function getDebts(): Promise<DebtsData> {
  const empty: DebtsData = {
    debts: [],
    summary: {
      payableTotal: 0, receivableTotal: 0, net: 0,
      overdueCount: 0, activePayables: 0, activeReceivables: 0,
    },
  }

  const supabase = await createClient()
  const tenantId = await getTenantId()
  if (!tenantId) return empty

  const { data } = await supabase
    .from("debts")
    .select("id, direction, person_name, amount, paid_amount, due_date, note, settled_at")
    .eq("tenant_id", tenantId)
    .order("settled_at", { ascending: true, nullsFirst: true })  // aktif dulu, lunas di bawah
    .order("due_date",   { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false })

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const debts: Debt[] = (data ?? []).map((d) => {
    const amount    = d.amount ?? 0
    const paid      = d.paid_amount ?? 0
    const remaining = Math.max(amount - paid, 0)
    const settled   = !!d.settled_at || (amount > 0 && paid >= amount)
    const pct       = amount > 0 ? Math.min(Math.round((paid / amount) * 100), 100) : 0

    let daysLeft: number | null = null
    let overdue = false
    if (d.due_date && !settled) {
      const due = new Date(`${d.due_date}T00:00:00`)
      daysLeft = Math.ceil((due.getTime() - today.getTime()) / 86_400_000)
      overdue  = daysLeft < 0
    }

    return {
      id:          d.id,
      direction:   d.direction as DebtDirection,
      person_name: d.person_name,
      amount,
      paid_amount: paid,
      remaining,
      pct,
      due_date:    d.due_date,
      note:        d.note,
      settled,
      daysLeft,
      overdue,
    }
  })

  const summary: DebtSummary = debts.reduce(
    (acc, d) => {
      if (!d.settled) {
        if (d.direction === "payable") {
          acc.payableTotal   += d.remaining
          acc.activePayables += 1
        } else {
          acc.receivableTotal   += d.remaining
          acc.activeReceivables += 1
        }
        if (d.overdue) acc.overdueCount += 1
      }
      return acc
    },
    { payableTotal: 0, receivableTotal: 0, net: 0, overdueCount: 0, activePayables: 0, activeReceivables: 0 },
  )
  summary.net = summary.receivableTotal - summary.payableTotal

  return { debts, summary }
}

