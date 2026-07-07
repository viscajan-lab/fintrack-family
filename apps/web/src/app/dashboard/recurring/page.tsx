import { getRecurringRules } from "@/lib/data/queries"
import { RecurringList } from "@/components/recurring/RecurringList"

export const dynamic = "force-dynamic"

export default async function RecurringPage() {
  const rules = await getRecurringRules()

  return (
    <div className="p-6">
      <RecurringList initialRules={rules} />
    </div>
  )
}
