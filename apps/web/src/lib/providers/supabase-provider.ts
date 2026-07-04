import type { SupabaseClient } from "@supabase/supabase-js"
import type {
  StorageProvider, StorageType,
  Transaction, Budget, Category,
  TxFilter, BudgetFilter,
} from "./types"

export class SupabaseProvider implements StorageProvider {
  readonly type: StorageType = "supabase"

  constructor(private db: SupabaseClient) {}

  // ─── Transactions ──────────────────────────────────────────────────────────

  async getTransactions(tenantId: string, filter: TxFilter = {}): Promise<Transaction[]> {
    let q = this.db
      .from("transactions")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("date", { ascending: false })

    if (filter.type)     q = q.eq("type", filter.type)
    if (filter.category) q = q.eq("category", filter.category)
    if (filter.month)    q = q.like("date", `${filter.month}%`)
    if (filter.limit)    q = q.limit(filter.limit)
    if (filter.offset)   q = q.range(filter.offset, filter.offset + (filter.limit ?? 50) - 1)

    const { data, error } = await q
    if (error) throw new Error(error.message)
    return data as Transaction[]
  }

  async createTransaction(tx: Omit<Transaction, "id" | "created_at">): Promise<Transaction> {
    const { data, error } = await this.db
      .from("transactions")
      .insert(tx)
      .select()
      .single()
    if (error) throw new Error(error.message)
    return data as Transaction
  }

  async updateTransaction(id: string, tx: Partial<Transaction>): Promise<Transaction> {
    const { data, error } = await this.db
      .from("transactions")
      .update(tx)
      .eq("id", id)
      .select()
      .single()
    if (error) throw new Error(error.message)
    return data as Transaction
  }

  async deleteTransaction(id: string): Promise<void> {
    const { error } = await this.db.from("transactions").delete().eq("id", id)
    if (error) throw new Error(error.message)
  }

  // ─── Budgets ───────────────────────────────────────────────────────────────

  async getBudgets(tenantId: string, filter: BudgetFilter = {}): Promise<Budget[]> {
    let q = this.db
      .from("budgets")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("category")

    if (filter.month) q = q.eq("month", filter.month)

    const { data, error } = await q
    if (error) throw new Error(error.message)
    return data as Budget[]
  }

  async upsertBudget(b: Omit<Budget, "id" | "created_at">): Promise<Budget> {
    const { data, error } = await this.db
      .from("budgets")
      .upsert(b, { onConflict: "tenant_id,category,month" })
      .select()
      .single()
    if (error) throw new Error(error.message)
    return data as Budget
  }

  async deleteBudget(id: string): Promise<void> {
    const { error } = await this.db.from("budgets").delete().eq("id", id)
    if (error) throw new Error(error.message)
  }

  // ─── Categories ────────────────────────────────────────────────────────────

  async getCategories(tenantId: string): Promise<Category[]> {
    const { data, error } = await this.db
      .from("categories")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("name")
    if (error) throw new Error(error.message)
    return data as Category[]
  }

  async createCategory(c: Omit<Category, "id">): Promise<Category> {
    const { data, error } = await this.db
      .from("categories")
      .insert(c)
      .select()
      .single()
    if (error) throw new Error(error.message)
    return data as Category
  }

  // ─── Summary ───────────────────────────────────────────────────────────────

  async getMonthlySummary(tenantId: string, month: string) {
    const { data, error } = await this.db
      .from("transactions")
      .select("type, amount")
      .eq("tenant_id", tenantId)
      .like("date", `${month}%`)

    if (error) throw new Error(error.message)

    const income  = (data as Transaction[]).filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0)
    const expense = (data as Transaction[]).filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0)
    return { income, expense, balance: income - expense }
  }
}
