import Link from "next/link"
import { AuthCard, Field, SubmitButton } from "@/components/auth/AuthCard"
import { resetPassword } from "@/app/auth/actions"

interface Props {
  searchParams: Promise<{ error?: string; sent?: string }>
}

export default async function ForgotPasswordPage({ searchParams }: Props) {
  const { error, sent } = await searchParams

  // Setelah email dikirim, tampilkan konfirmasi generik (tanpa membocorkan
  // apakah email terdaftar). Pakai kasus ini juga untuk user undangan yang
  // link-nya kadaluarsa: mereka minta link baru dari sini.
  if (sent) {
    return (
      <AuthCard
        title="Cek email kamu"
        subtitle="Tautan atur ulang password sudah dikirim"
      >
        <div className="space-y-4">
          <div className="px-4 py-3 rounded-lg bg-green-50 border border-green-200 text-sm text-green-700">
            Kalau email tersebut terdaftar, kami sudah mengirim tautan untuk
            membuat password baru. Buka email (cek juga folder spam), klik
            tautannya, lalu setel password kamu.
          </div>
          <p className="text-xs text-[var(--color-muted)]">
            Tautan berlaku terbatas waktu. Kalau kadaluarsa, cukup minta lagi
            dari halaman ini.
          </p>
          <Link
            href="/login"
            className="block text-center text-sm font-medium text-[var(--color-brand-500)] hover:underline"
          >
            ← Kembali ke halaman masuk
          </Link>
        </div>
      </AuthCard>
    )
  }

  return (
    <AuthCard
      title="Lupa password?"
      subtitle="Masukkan email kamu, kami kirim tautan untuk atur ulang"
      error={error ?? null}
    >
      <form action={resetPassword} className="space-y-4">
        <Field label="Email" name="email" type="email" placeholder="kamu@email.com" required />
        <div className="pt-1">
          <SubmitButton label="Kirim tautan reset" pendingLabel="Mengirim…" />
        </div>
      </form>
      <div className="mt-5 text-center">
        <Link
          href="/login"
          className="text-sm font-medium text-[var(--color-brand-500)] hover:underline"
        >
          ← Kembali ke halaman masuk
        </Link>
      </div>
    </AuthCard>
  )
}
