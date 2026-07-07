import { getMembers } from "@/lib/data/queries"
import { MembersView } from "@/components/members/MembersView"

export const dynamic = "force-dynamic"

export default async function MembersPage() {
  const data = await getMembers()

  if (!data) {
    return (
      <div className="p-6 text-sm text-[var(--color-muted)]">
        Belum ada workspace. Hubungkan akun kamu dengan bot Telegram dulu lewat menu Hubungkan.
      </div>
    )
  }

  return (
    <div className="p-6">
      <MembersView data={data} />
    </div>
  )
}
