import { getPockets, getMemberSpending } from "@/lib/data/queries"
import { PocketsView } from "@/components/pockets/PocketsView"

export const dynamic = "force-dynamic"

const MONTHS_ID = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"]

export default async function KantongPage() {
  const [data, ranking] = await Promise.all([
    getPockets(),
    getMemberSpending(),
  ])

  if (!data) {
    return (
      <div className="p-6">
        <p className="text-sm text-[var(--color-muted)]">Tidak dapat memuat data kantong. Coba masuk ulang.</p>
      </div>
    )
  }

  const monthLabel = `${MONTHS_ID[data.monthNum - 1]} ${data.year}`

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Kantong</h1>
        <p className="text-sm text-[var(--color-muted)] mt-0.5">
          Jatah bulanan tiap anggota — {monthLabel}
        </p>
      </div>

      <PocketsView data={data} ranking={ranking} />
    </div>
  )
}
