import { getCategories }     from "@/lib/data/queries"
import { CategoryManager }   from "@/components/categories/CategoryManager"

export const dynamic = "force-dynamic"

export default async function CategoriesPage() {
  const categories = await getCategories()

  return (
    <div className="p-6 space-y-5">
      <CategoryManager categories={categories} />
    </div>
  )
}
