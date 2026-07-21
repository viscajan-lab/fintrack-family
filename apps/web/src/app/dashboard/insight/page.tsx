import { getInsight } from "@/lib/data/queries"
import { InsightView } from "@/components/insight/InsightView"
import { SubTabs } from "@/components/layout/SubTabs"
import { ANALISIS_TABS } from "@/components/layout/tabs"

export const dynamic = "force-dynamic"

export default async function InsightPage() {
  const data = await getInsight()
  return (
    <div className="p-6 space-y-6">
      <SubTabs tabs={ANALISIS_TABS} />
      <InsightView data={data} />
    </div>
  )
}
