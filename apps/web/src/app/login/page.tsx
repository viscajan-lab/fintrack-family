import { AuthCard, Field, SubmitButton } from "@/components/auth/AuthCard"
import { InviteFragmentHandler } from "@/components/auth/InviteFragmentHandler"
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
      <InviteFragmentHandler />
      <form action={login} className="space-y-4">
        <Field label="Email" name="email" type="email" placeholder="kamu@email.com" required />
        <Field label="Password" name="password" type="password" placeholder="••••••••" required />

        <div className="pt-1">
          <SubmitButton label="Masuk" />
        </div>
      </form>
    </AuthCard>
  )
}
