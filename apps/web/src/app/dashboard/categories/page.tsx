import { redirect } from "next/navigation"
import { getCategories, getMyRole } from "@/lib/data/queries"
import { CategoryManager }   from "@/components/categories/CategoryManager"
import { SubTabs } from "@/components/layout/SubTabs"
import { pengaturanTabs } from "@/components/layout/tabs"

export const dynamic = "force-dynamic"

export default async function CategoriesPage() {
  const role = await getMyRole()
  if (role === "member") redirect("/dashboard/settings")

  const categories = await getCategories()

  return (
    <div className="p-6 space-y-5">
      <SubTabs tabs={pengaturanTabs(role)} />
      <CategoryManager categories={categories} />
    </div>
  )
}
