"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { ArrowLeft, CheckCircle2, AlertCircle, Loader2, Home } from "lucide-react"
import { createTenant, generateSlug } from "../actions"

type Feedback =
  | { kind: "success"; tenantId: string; tenantName: string }
  | { kind: "error"; message: string }
  | null

const PLAN_OPTIONS = [
  { value: "free",   label: "Free",    desc: "最大5名成员，基本功能" },
  { value: "family", label: "Family",   desc: "无限成员，高级功能" },
  { value: "self_hosted", label: "Self Hosted", desc: "自托管，完全控制" },
]

export default function CreateTenantPage() {
  const [pending, startTransition] = useTransition()
  const [feedback, setFeedback] = useState<Feedback>(null)
  const [formKey, setFormKey] = useState(0)
  const [nameValue, setNameValue] = useState("")

  async function handleNameBlur() {
    // Auto-generate slug from name when user leaves name field (if slug is empty)
    const slugInput = document.getElementById("slug") as HTMLInputElement
    if (slugInput && !slugInput.value && nameValue.trim()) {
      const slug = await generateSlug(nameValue)
      slugInput.value = slug
    }
  }

  async function handleAutoSlug() {
    if (nameValue.trim()) {
      const slugInput = document.getElementById("slug") as HTMLInputElement
      if (slugInput) {
        const slug = await generateSlug(nameValue)
        slugInput.value = slug
      }
    }
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    setFeedback(null)
    startTransition(async () => {
      const res = await createTenant(fd)
      if (res.error) {
        setFeedback({ kind: "error", message: res.error })
      } else if (res.tenantId && res.tenantName) {
        setFeedback({ kind: "success", tenantId: res.tenantId, tenantName: res.tenantName })
        // Reset form after short delay
        setTimeout(() => {
          setFormKey((k) => k + 1)
          setNameValue("")
          setFeedback(null)
        }, 3000)
      }
    })
  }

  return (
    <div className="p-6 max-w-xl">
      {/* Back link */}
      <Link
        href="/admin"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--color-muted)] hover:text-[var(--color-foreground)] mb-6 transition-colors"
      >
        <ArrowLeft size={16} /> Kembali ke Dashboard Admin
      </Link>

      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Home size={24} className="text-brand-500" /> Buat Keluarga Baru
        </h1>
        <p className="text-sm text-[var(--color-muted)] mt-0.5">
          Tambahkan keluarga (tenant) baru ke sistem FinTrack.
        </p>
      </div>

      {/* Feedback */}
      {feedback?.kind === "success" && (
        <div className="mb-4 flex items-start gap-2 px-4 py-3 rounded-lg bg-green-50 border border-green-200 text-sm text-green-700">
          <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
          <div>
            <strong>Keluarga &quot;{feedback.tenantName}&quot; berhasil dibuat!</strong>
            <br />
            Kamu sudah terdaftar sebagai admin keluarga ini.
          </div>
        </div>
      )}
      {feedback?.kind === "error" && (
        <div className="mb-4 flex items-start gap-2 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-600">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Form */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
        <form key={formKey} onSubmit={onSubmit} className="space-y-5">
          {/* Nama Keluarga */}
          <div className="space-y-1.5">
            <label htmlFor="name" className="block text-sm font-medium">
              Nama Keluarga <span className="text-red-500">*</span>
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              minLength={2}
              placeholder="Contoh: Keluarga Budiono"
              value={nameValue}
              onChange={(e) => setNameValue(e.target.value)}
              onBlur={handleNameBlur}
              className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent placeholder:text-[var(--color-muted)]"
            />
          </div>

          {/* Slug */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="slug" className="block text-sm font-medium">
                Slug / URL <span className="text-red-500">*</span>
              </label>
              <button
                type="button"
                onClick={handleAutoSlug}
                className="text-xs text-brand-500 hover:text-brand-600 font-medium"
              >
                Auto-generate
              </button>
            </div>
            <div className="flex items-center rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] focus-within:ring-2 focus-within:ring-brand-500 focus-within:border-transparent">
              <span className="px-3.5 py-2.5 text-sm text-[var(--color-muted)] border-r border-[var(--color-border)] select-none">
                /keluarga/
              </span>
              <input
                id="slug"
                name="slug"
                type="text"
                required
                pattern="[a-z0-9-]+"
                placeholder="keluarga-budiono"
                className="flex-1 px-3.5 py-2.5 text-sm bg-transparent outline-none placeholder:text-[var(--color-muted)]"
              />
            </div>
            <p className="text-xs text-[var(--color-muted)]">
              Hanya huruf kecil, angka, dan tanda hubung (-). Contoh: <code className="bg-[var(--color-border)] px-1 rounded">keluarga-ardi</code>
            </p>
          </div>

          {/* Plan */}
          <div className="space-y-1.5">
            <label htmlFor="plan" className="block text-sm font-medium">
              Paket Langganan
            </label>
            <select
              id="plan"
              name="plan"
              defaultValue="free"
              className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            >
              {PLAN_OPTIONS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label} — {p.desc}
                </option>
              ))}
            </select>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={pending}
            className="w-full py-2.5 px-4 rounded-lg text-sm font-semibold text-white bg-brand-500 hover:bg-brand-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {pending ? (
              <>
                <Loader2 size={16} className="animate-spin" /> Membuat…
              </>
            ) : (
              <>
                <Home size={16} /> Buat Keluarga
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  )
}