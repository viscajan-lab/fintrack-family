import { redirect } from "next/navigation"
import { getMembers, getMyRole } from "@/lib/data/queries"
import { MembersView } from "@/components/members/MembersView"
import { SubTabs, pengaturanTabs } from "@/components/layout/SubTabs"

export const dynamic = "force-dynamic"

export default async function MembersPage() {
  const role = await getMyRole()
  if (role === "member") redirect("/dashboard/settings")

  const data = await getMembers()

  if (!data) {
    return (
      <div className="p-6 space-y-5">
        <SubTabs tabs={pengaturanTabs(role)} />
        <p className="text-sm text-[var(--color-muted)]">
          Belum ada workspace. Hubungkan akun kamu dengan bot Telegram dulu lewat tab Hubungkan.
        </p>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-5">
      <SubTabs tabs={pengaturanTabs(role)} />
      <MembersView data={data} />
    </div>
  )
}
