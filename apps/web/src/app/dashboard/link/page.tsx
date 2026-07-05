import { LinkClient } from "./LinkClient"

export const dynamic = "force-dynamic"

export default function LinkPage() {
  return (
    <div className="p-6 space-y-5 max-w-2xl">
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
