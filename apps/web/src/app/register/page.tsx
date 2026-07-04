import Link from "next/link"
import { AuthCard, Field, SubmitButton } from "@/components/auth/AuthCard"
import { register } from "@/app/auth/actions"

interface Props {
  searchParams: Promise<{ error?: string }>
}

export default async function RegisterPage({ searchParams }: Props) {
  const { error } = await searchParams

  return (
    <AuthCard
      title="Buat Akun FinTrack"
      subtitle="Gratis selamanya untuk 1 keluarga"
      error={error ?? null}
    >
      <form action={register} className="space-y-4">
        <Field
          label="Nama Workspace Keluarga"
          name="family_name"
          placeholder="Keluarga Budi"
          required
        />
        <Field label="Email" name="email" type="email" placeholder="kamu@email.com" required />
        <Field label="Password" name="password" type="password" placeholder="Min. 8 karakter" required />

        <div className="pt-1">
          <SubmitButton label="Buat Akun" />
        </div>
      </form>

      <p className="text-center text-sm text-[var(--color-muted)] mt-5">
        Sudah punya akun?{" "}
        <Link href="/login" className="text-[var(--color-brand-500)] font-medium hover:underline">
          Masuk
        </Link>
      </p>
    </AuthCard>
  )
}
