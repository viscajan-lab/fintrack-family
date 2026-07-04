// ─── Domain types ────────────────────────────────────────────────────────────

export type StorageType = "supabase" | "sheets"

export interface Transaction {
  id:          string
  tenant_id:   string
  user_id:     string
  type:        "income" | "expense"
  amount:      number          // IDR integer
  description: string
  category:    string
  date:        string          // ISO date YYYY-MM-DD
  created_at:  string
}

export interface Budget {
  id:         string
  tenant_id:  string
  category:   string
  amount:     number           // IDR integer
  month:      string           // YYYY-MM
  created_at: string
}

export interface Category {
  id:        string
  tenant_id: string
  name:      string
  type:      "income" | "expense"
  icon?:     string
}

// ─── Filter / pagination helpers ─────────────────────────────────────────────

export interface TxFilter {
  type?:     "income" | "expense"
  category?: string
  month?:    string            // YYYY-MM
  limit?:    number
  offset?:   number
}

export interface BudgetFilter {
  month?: string               // YYYY-MM
}

// ─── Provider interface ───────────────────────────────────────────────────────

export interface StorageProvider {
  readonly type: StorageType

  // Transactions
  getTransactions(tenantId: string, filter?: TxFilter):    Promise<Transaction[]>
  createTransaction(tx: Omit<Transaction, "id" | "created_at">): Promise<Transaction>
  updateTransaction(id: string, tx: Partial<Transaction>): Promise<Transaction>
  deleteTransaction(id: string):                           Promise<void>

  // Budgets
  getBudgets(tenantId: string, filter?: BudgetFilter):     Promise<Budget[]>
  upsertBudget(b: Omit<Budget, "id" | "created_at">):     Promise<Budget>
  deleteBudget(id: string):                                Promise<void>

  // Categories
  getCategories(tenantId: string):                         Promise<Category[]>
  createCategory(c: Omit<Category, "id">):                 Promise<Category>

  // Summary helpers
  getMonthlySummary(tenantId: string, month: string): Promise<{
    income:   number
    expense:  number
    balance:  number
  }>
}
