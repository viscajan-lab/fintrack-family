/**
 * SheetsProvider — Google Sheets API v4 (REST, no SDK)
 *
 * Sheet structure (1 spreadsheet per tenant):
 *   Sheet "Transactions" : id | tenant_id | user_id | type | amount | description | category | date | created_at
 *   Sheet "Budgets"      : id | tenant_id | category | amount | month | created_at
 *   Sheet "Categories"   : id | tenant_id | name | type | icon
 *
 * OAuth token stored in Supabase: tenants.sheets_access_token + refresh_token
 */

import type {
  StorageProvider, StorageType,
  Transaction, Budget, Category,
  TxFilter, BudgetFilter,
} from "./types"

const SHEETS_BASE = "https://sheets.googleapis.com/v4/spreadsheets"

interface SheetsConfig {
  spreadsheetId:  string
  accessToken:    string
  refreshToken:   string
  refreshFn:      (refreshToken: string) => Promise<string>  // returns new accessToken
}

type Row = string[]

function uuid() {
  return crypto.randomUUID()
}

function now() {
  return new Date().toISOString()
}

export class SheetsProvider implements StorageProvider {
  readonly type: StorageType = "sheets"

  constructor(private cfg: SheetsConfig) {}

  // ─── Low-level API helpers ─────────────────────────────────────────────────

  private async fetch(path: string, init?: RequestInit): Promise<Response> {
    const res = await fetch(`${SHEETS_BASE}/${this.cfg.spreadsheetId}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.cfg.accessToken}`,
        "Content-Type": "application/json",
        ...init?.headers,
      },
    })
    // Auto-refresh on 401
    if (res.status === 401) {
      this.cfg.accessToken = await this.cfg.refreshFn(this.cfg.refreshToken)
      return this.fetch(path, init)
    }
    return res
  }

  private async getRows(sheet: string): Promise<Row[]> {
    const res = await this.fetch(`/values/${encodeURIComponent(sheet)}`)
    if (!res.ok) throw new Error(await res.text())
    const json = await res.json()
    const rows: Row[] = json.values ?? []
    return rows.slice(1) // skip header row
  }

  private async appendRow(sheet: string, row: Row): Promise<void> {
    const res = await this.fetch(
      `/values/${encodeURIComponent(sheet)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
      { method: "POST", body: JSON.stringify({ values: [row] }) }
    )
    if (!res.ok) throw new Error(await res.text())
  }

  private async updateRow(sheet: string, rowIndex: number, row: Row): Promise<void> {
    // rowIndex is 0-based data row → Sheet row = rowIndex + 2 (1-based + header)
    const range = `${sheet}!A${rowIndex + 2}`
    const res = await this.fetch(
      `/values/${encodeURIComponent(range)}?valueInputOption=RAW`,
      { method: "PUT", body: JSON.stringify({ values: [row] }) }
    )
    if (!res.ok) throw new Error(await res.text())
  }

  private async deleteRow(sheet: string, rowIndex: number): Promise<void> {
    // Get sheetId first
    const metaRes = await this.fetch("")
    const meta    = await metaRes.json()
    const sheetId = meta.sheets?.find((s: { properties: { title: string; sheetId: number } }) => s.properties.title === sheet)?.properties?.sheetId
    if (sheetId == null) throw new Error(`Sheet "${sheet}" not found`)

    const res = await this.fetch(":batchUpdate", {
      method: "POST",
      body: JSON.stringify({
        requests: [{
          deleteDimension: {
            range: { sheetId, dimension: "ROWS", startIndex: rowIndex + 1, endIndex: rowIndex + 2 }
          }
        }]
      })
    })
    if (!res.ok) throw new Error(await res.text())
  }

  // ─── Row ↔ Domain mappers ──────────────────────────────────────────────────

  private rowToTx(r: Row): Transaction {
    return { id: r[0], tenant_id: r[1], user_id: r[2], type: r[3] as "income"|"expense",
             amount: Number(r[4]), description: r[5], category: r[6], date: r[7], created_at: r[8] }
  }

  private txToRow(t: Transaction): Row {
    return [t.id, t.tenant_id, t.user_id, t.type, String(t.amount), t.description, t.category, t.date, t.created_at]
  }

  private rowToBudget(r: Row): Budget {
    return { id: r[0], tenant_id: r[1], category: r[2], amount: Number(r[3]), month: r[4], created_at: r[5] }
  }

  private budgetToRow(b: Budget): Row {
    return [b.id, b.tenant_id, b.category, String(b.amount), b.month, b.created_at]
  }

  private rowToCategory(r: Row): Category {
    return { id: r[0], tenant_id: r[1], name: r[2], type: r[3] as "income"|"expense", icon: r[4] }
  }

  private categoryToRow(c: Category): Row {
    return [c.id, c.tenant_id, c.name, c.type, c.icon ?? ""]
  }

  // ─── Transactions ──────────────────────────────────────────────────────────

  async getTransactions(tenantId: string, filter: TxFilter = {}): Promise<Transaction[]> {
    let rows = (await this.getRows("Transactions"))
      .map(this.rowToTx)
      .filter(t => t.tenant_id === tenantId)
      .sort((a, b) => b.date.localeCompare(a.date))

    if (filter.type)     rows = rows.filter(t => t.type === filter.type)
    if (filter.category) rows = rows.filter(t => t.category === filter.category)
    if (filter.month)    rows = rows.filter(t => t.date.startsWith(filter.month!))

    const start = filter.offset ?? 0
    const end   = filter.limit ? start + filter.limit : undefined
    return rows.slice(start, end)
  }

  async createTransaction(tx: Omit<Transaction, "id"|"created_at">): Promise<Transaction> {
    const full: Transaction = { ...tx, id: uuid(), created_at: now() }
    await this.appendRow("Transactions", this.txToRow(full))
    return full
  }

  async updateTransaction(id: string, patch: Partial<Transaction>): Promise<Transaction> {
    const rows = await this.getRows("Transactions")
    const idx  = rows.findIndex(r => r[0] === id)
    if (idx === -1) throw new Error(`Transaction ${id} not found`)
    const updated = { ...this.rowToTx(rows[idx]), ...patch }
    await this.updateRow("Transactions", idx, this.txToRow(updated))
    return updated
  }

  async deleteTransaction(id: string): Promise<void> {
    const rows = await this.getRows("Transactions")
    const idx  = rows.findIndex(r => r[0] === id)
    if (idx === -1) throw new Error(`Transaction ${id} not found`)
    await this.deleteRow("Transactions", idx)
  }

  // ─── Budgets ───────────────────────────────────────────────────────────────

  async getBudgets(tenantId: string, filter: BudgetFilter = {}): Promise<Budget[]> {
    let rows = (await this.getRows("Budgets"))
      .map(this.rowToBudget)
      .filter(b => b.tenant_id === tenantId)
      .sort((a, b) => a.category.localeCompare(b.category))

    if (filter.month) rows = rows.filter(b => b.month === filter.month)
    return rows
  }

  async upsertBudget(b: Omit<Budget, "id"|"created_at">): Promise<Budget> {
    const rows = await this.getRows("Budgets")
    const idx  = rows.findIndex(r => r[1] === b.tenant_id && r[2] === b.category && r[4] === b.month)

    if (idx !== -1) {
      const updated: Budget = { ...this.rowToBudget(rows[idx]), amount: b.amount }
      await this.updateRow("Budgets", idx, this.budgetToRow(updated))
      return updated
    }
    const full: Budget = { ...b, id: uuid(), created_at: now() }
    await this.appendRow("Budgets", this.budgetToRow(full))
    return full
  }

  async deleteBudget(id: string): Promise<void> {
    const rows = await this.getRows("Budgets")
    const idx  = rows.findIndex(r => r[0] === id)
    if (idx === -1) throw new Error(`Budget ${id} not found`)
    await this.deleteRow("Budgets", idx)
  }

  // ─── Categories ────────────────────────────────────────────────────────────

  async getCategories(tenantId: string): Promise<Category[]> {
    return (await this.getRows("Categories"))
      .map(this.rowToCategory)
      .filter(c => c.tenant_id === tenantId)
      .sort((a, b) => a.name.localeCompare(b.name))
  }

  async createCategory(c: Omit<Category, "id">): Promise<Category> {
    const full: Category = { ...c, id: uuid() }
    await this.appendRow("Categories", this.categoryToRow(full))
    return full
  }

  // ─── Summary ───────────────────────────────────────────────────────────────

  async getMonthlySummary(tenantId: string, month: string) {
    const txs     = await this.getTransactions(tenantId, { month })
    const income  = txs.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0)
    const expense = txs.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0)
    return { income, expense, balance: income - expense }
  }
}
