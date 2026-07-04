import Link from "next/link"
import { AuthCard, Field, SubmitButton } from "@/components/auth/AuthCard"
import { login } from "@/app/auth/actions"

interface Props {
  searchParams: Promise<{ error?: string }>
}

export default async function LoginPage({ searchParams }: Props) {
  const { error } = await searchParams

  return (
    <AuthCard
      title="Masuk ke FinTrack"
      subtitle="Pantau keuangan keluarga kamu"
      error={error ?? null}
    >
      <form action={login} className="space-y-4">
        <Field label="Email" name="email" type="email" placeholder="kamu@email.com" required />
        <Field label="Password" name="password" type="password" placeholder="••••••••" required />

        <div className="pt-1">
          <SubmitButton label="Masuk" />
        </div>
      </form>

      <p className="text-center text-sm text-[var(--color-muted)] mt-5">
        Belum punya akun?{" "}
        <Link href="/register" className="text-[var(--color-brand-500)] font-medium hover:underline">
          Daftar sekarang
        </Link>
      </p>
    </AuthCard>
  )
}
