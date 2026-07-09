import { getSavingsGoals } from "@/lib/data/queries"
import { GoalList }        from "@/components/savings/GoalList"
import { AddGoalButton }   from "@/components/savings/AddGoalButton"

export const dynamic = "force-dynamic"

export default async function SavingsPage() {
  const goals = await getSavingsGoals()

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Target Tabungan</h1>
          <p className="text-sm text-[var(--color-muted)] mt-0.5">
            Tetapkan target & nabung bareng keluarga 🐷
          </p>
        </div>
        <AddGoalButton />
      </div>

      <GoalList goals={goals} />
    </div>
  )
}
