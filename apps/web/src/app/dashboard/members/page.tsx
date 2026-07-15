import { getMembers } from "@/lib/data/queries"
import { MembersView } from "@/components/members/MembersView"
import { SubTabs, PENGATURAN_TABS } from "@/components/layout/SubTabs"

export const dynamic = "force-dynamic"

export default async function MembersPage() {
  const data = await getMembers()

  if (!data) {
    return (
      <div className="p-6 space-y-5">
        <SubTabs tabs={PENGATURAN_TABS} />
        <p className="text-sm text-[var(--color-muted)]">
          Belum ada workspace. Hubungkan akun kamu dengan bot Telegram dulu lewat tab Hubungkan.
        </p>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-5">
      <SubTabs tabs={PENGATURAN_TABS} />
      <MembersView data={data} />
    </div>
  )
}
