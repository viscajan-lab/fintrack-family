import { getInsight } from "@/lib/data/queries"
import { InsightView } from "@/components/insight/InsightView"

export const dynamic = "force-dynamic"

export default async function InsightPage() {
  const data = await getInsight()
  return (
    <div className="p-6">
      <InsightView data={data} />
    </div>
  )
}
