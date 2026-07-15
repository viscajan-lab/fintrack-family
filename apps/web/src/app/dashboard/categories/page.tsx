import { getCategories }     from "@/lib/data/queries"
import { CategoryManager }   from "@/components/categories/CategoryManager"
import { SubTabs, PENGATURAN_TABS } from "@/components/layout/SubTabs"

export const dynamic = "force-dynamic"

export default async function CategoriesPage() {
  const categories = await getCategories()

  return (
    <div className="p-6 space-y-5">
      <SubTabs tabs={PENGATURAN_TABS} />
      <CategoryManager categories={categories} />
    </div>
  )
}
