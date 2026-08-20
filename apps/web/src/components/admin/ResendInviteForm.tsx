"use client"

import { useState, useTransition } from "react"
import { MailWarning, CheckCircle2, AlertCircle } from "lucide-react"
import { resendInvite } from "@/app/admin/users/actions"

type Feedback =
  | { kind: "success"; email: string }
  | { kind: "error"; message: string }
  | null

export function ResendInviteForm() {
  const [pending, startTransition] = useTransition()
  const [feedback, setFeedback] = useState<Feedback>(null)
  const [formKey, setFormKey] = useState(0)

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    setFeedback(null)
    startTransition(async () => {
      const res = await resendInvite(fd)
      if (res?.error) {
        setFeedback({ kind: "error", message: res.error })
      } else if (res?.success) {
        setFeedback({ kind: "success", email: res.email as string })
        setFormKey((k) => k + 1)
      }
    })
  }

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 space-y-4">
      <div className="flex items-center gap-2">
        <MailWarning size={18} className="text-amber-500" />
        <h2 className="font-semibold">Undang Ulang / Kirim Ulang Akses</h2>
      </div>
      <p className="text-sm text-[var(--color-muted)] -mt-1">
        Untuk email yang sudah diundang tapi <strong>tautannya kadaluarsa</strong> atau
        tak sempat diklik. Kami kirim tautan baru agar user bisa menyetel password
        dan masuk. Aman diulang berkali-kali.
      </p>

      {feedback?.kind === "success" && (
        <div className="flex items-start gap-2 px-4 py-3 rounded-lg bg-green-50 border border-green-200 text-sm text-green-700">
          <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
          <span>
            Tautan akses baru dikirim ke <strong>{feedback.email}</strong>. Minta
            mereka cek email (termasuk folder spam) lalu setel password.
          </span>
        </div>
      )}
      {feedback?.kind === "error" && (
        <div className="flex items-start gap-2 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-600">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span>{feedback.message}</span>
        </div>
      )}

      <form key={formKey} onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="resend_email" className="block text-sm font-medium">
            Email yang sudah diundang
          </label>
          <input
            id="resend_email"
            name="email"
            type="email"
            required
            placeholder="user@email.com"
            className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent placeholder:text-[var(--color-muted)]"
          />
        </div>

        <button
          type="submit"
          disabled={pending}
          className="w-full py-2.5 px-4 rounded-lg text-sm font-semibold text-white bg-amber-500 hover:bg-amber-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {pending ? "Mengirim ulang…" : "Kirim Ulang Akses"}
        </button>
      </form>
    </div>
  )
}
