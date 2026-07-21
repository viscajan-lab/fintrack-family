import { redirect } from "next/navigation"
import { AuthCard, Field, SubmitButton } from "@/components/auth/AuthCard"
import { createClient } from "@/lib/supabase/server"
import { createFamily, userHasTenant } from "./actions"

export const dynamic = "force-dynamic"

interface Props {
  searchParams: Promise<{ error?: string }>
}

// Halaman "buat keluarga" untuk admin baru yang diundang tanpa tenant. Guard:
//   - belum login → /login
//   - sudah punya tenant → /onboarding/wizard (tidak perlu buat lagi)
export default async function CreateFamilyPage({ searchParams }: Props) {
  const { error } = await searchParams

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user)
    redirect(`/login?error=${encodeURIComponent("Silakan login untuk melanjutkan.")}`)

  // Sudah punya keluarga → langsung ke wizard, jangan tampilkan form ini.
  if (await userHasTenant()) redirect("/onboarding/wizard")

  return (
    <AuthCard
      title="Buat Keluarga"
      subtitle="Beri nama keluargamu. Kamu akan menjadi admin dan bisa mengundang anggota setelah ini."
      error={error ?? null}
    >
      <form action={createFamily} className="space-y-4">
        <Field
          label="Nama keluarga"
          name="name"
          type="text"
          placeholder="Contoh: Keluarga Rahariski"
          required
        />

        <div className="pt-1">
          <SubmitButton label="Buat & Lanjut" />
        </div>
      </form>
    </AuthCard>
  )
}
