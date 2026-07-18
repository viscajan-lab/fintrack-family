import { getTransactions, getMembersForPicker } from "@/lib/data/queries"
import { TransactionsList } from "@/components/transactions/TransactionsList"
import { AddTransactionButton } from "@/components/transactions/AddTransactionButton"

export const dynamic = "force-dynamic"

export default async function TransactionsPage() {
  const [{ rows, total }, members] = await Promise.all([
    getTransactions({ limit: 50 }),
    getMembersForPicker(),
  ])

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Transaksi</h1>
          <p className="text-sm text-[var(--color-muted)] mt-0.5">
            {total} transaksi tersimpan
          </p>
        </div>
        <AddTransactionButton members={members} />
      </div>

      <TransactionsList initialRows={rows} />
    </div>
  )
}
