"use client"

import { useState, useTransition } from "react"
import { UserPlus, CheckCircle2, AlertCircle } from "lucide-react"
import { inviteAdmin } from "@/app/admin/users/actions"

export interface TenantOption {
  id: string
  name: string
  slug: string
}

type Feedback =
  | { kind: "success"; email: string; tenantName: string }
  | { kind: "error"; message: string }
  | null

export function InviteAdminForm({ tenants }: { tenants: TenantOption[] }) {
  const [pending, startTransition] = useTransition()
  const [feedback, setFeedback] = useState<Feedback>(null)
  const [formKey, setFormKey] = useState(0)

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    setFeedback(null)
    startTransition(async () => {
      const res = await inviteAdmin(fd)
      if (res?.error) {
        setFeedback({ kind: "error", message: res.error })
      } else if (res?.success) {
        setFeedback({
          kind: "success",
          email: res.email as string,
          tenantName: res.tenantName as string,
        })
        setFormKey((k) => k + 1) // reset form
      }
    })
  }

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 space-y-4">
      <div className="flex items-center gap-2">
        <UserPlus size={18} className="text-brand-500" />
        <h2 className="font-semibold">Daftarkan Admin Baru</h2>
      </div>
      <p className="text-sm text-[var(--color-muted)] -mt-1">
        Pilih keluarga, masukkan email calon admin. Undangan dikirim via email —
        penerima menyetel password sendiri lalu otomatis jadi admin keluarga itu.
      </p>

      {feedback?.kind === "success" && (
        <div className="flex items-start gap-2 px-4 py-3 rounded-lg bg-green-50 border border-green-200 text-sm text-green-700">
          <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
          <span>
            Undangan terkirim ke <strong>{feedback.email}</strong> untuk keluarga{" "}
            <strong>{feedback.tenantName}</strong>. Minta mereka cek email (termasuk folder spam).
          </span>
        </div>
      )}
      {feedback?.kind === "error" && (
        <div className="flex items-start gap-2 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-600">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span>{feedback.message}</span>
        </div>
      )}

      {tenants.length === 0 ? (
        <p className="text-sm text-[var(--color-muted)]">
          Belum ada keluarga terdaftar. Buat keluarga dulu lewat onboarding.
        </p>
      ) : (
        <form key={formKey} onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="tenant_id" className="block text-sm font-medium">Keluarga</label>
            <select
              id="tenant_id"
              name="tenant_id"
              required
              defaultValue=""
              className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            >
              <option value="" disabled>Pilih keluarga…</option>
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="email" className="block text-sm font-medium">Email calon admin</label>
            <input
              id="email"
              name="email"
              type="email"
              required
              placeholder="admin@email.com"
              className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent placeholder:text-[var(--color-muted)]"
            />
          </div>

          <button
            type="submit"
            disabled={pending}
            className="w-full py-2.5 px-4 rounded-lg text-sm font-semibold text-white bg-brand-500 hover:bg-brand-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {pending ? "Mengirim undangan…" : "Kirim Undangan"}
          </button>
        </form>
      )}
    </div>
  )
}
