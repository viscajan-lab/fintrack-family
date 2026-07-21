import { redirect } from "next/navigation"
import { getMyRole } from "@/lib/data/queries"
import { LinkClient } from "./LinkClient"
import { SubTabs } from "@/components/layout/SubTabs"
import { pengaturanTabs } from "@/components/layout/tabs"

export const dynamic = "force-dynamic"

export default async function LinkPage() {
  const role = await getMyRole()
  if (role === "member") redirect("/dashboard/settings")

  return (
    <div className="p-6 space-y-5 max-w-2xl">
      <SubTabs tabs={pengaturanTabs(role)} />
      <div>
        <h1 className="text-2xl font-bold">Hubungkan Akun</h1>
        <p className="text-sm text-[var(--color-muted)] mt-0.5">
          Sambungkan akun web ini dengan bot Telegram FinTrack — dua arah.
        </p>
      </div>

      <LinkClient />
    </div>
  )
}
