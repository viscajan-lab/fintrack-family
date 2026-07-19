import { redirect } from "next/navigation"
import { AuthCard, Field, SubmitButton } from "@/components/auth/AuthCard"
import { createClient } from "@/lib/supabase/server"
import { setPassword } from "./actions"

export const dynamic = "force-dynamic"

interface Props {
  searchParams: Promise<{ error?: string }>
}

// Halaman set-password untuk penerima undangan email. Guard: harus ada sesi
// (dibuat oleh /auth/callback dari link invite). Tanpa sesi → balik ke login.
export default async function SetPasswordPage({ searchParams }: Props) {
  const { error } = await searchParams

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user)
    redirect(`/login?error=${encodeURIComponent("Buka halaman ini dari link undangan di email kamu.")}`)

  return (
    <AuthCard
      title="Atur Password"
      subtitle={`Selamat datang, ${user.email}. Buat password untuk mengakses FinTrack.`}
      error={error ?? null}
    >
      <form action={setPassword} className="space-y-4">
        <Field label="Password baru" name="password" type="password" placeholder="Minimal 8 karakter" required />
        <Field label="Konfirmasi password" name="confirm" type="password" placeholder="Ulangi password" required />

        <div className="pt-1">
          <SubmitButton label="Simpan & Masuk" />
        </div>
      </form>
    </AuthCard>
  )
}
