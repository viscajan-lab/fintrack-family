import { AuthCard, Field, SubmitButton } from "@/components/auth/AuthCard"
import { InviteFragmentHandler } from "@/components/auth/InviteFragmentHandler"
import { login } from "@/app/auth/actions"
import Link from "next/link"

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
      <InviteFragmentHandler />
      <form action={login} className="space-y-4">
        <Field label="Email" name="email" type="email" placeholder="kamu@email.com" required />
        <Field label="Password" name="password" type="password" placeholder="••••••••" required />

        <div className="pt-1">
          <SubmitButton label="Masuk" pendingLabel="Masuk…" />
        </div>
      </form>
      <div className="mt-5 text-center">
        <Link
          href="/forgot-password"
          className="text-sm font-medium text-[var(--color-brand-500)] hover:underline"
        >
          Lupa password?
        </Link>
      </div>
    </AuthCard>
  )
}
