"use client"

import { useFormStatus } from "react-dom"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface SubmitButtonProps {
  /** Teks tombol saat idle. */
  label: string
  /** Teks saat proses berjalan. Default: `${label}…` */
  pendingLabel?: string
}

/**
 * Tombol submit untuk <form action={serverAction}>. Membaca status form via
 * useFormStatus() (react-dom): saat pending → tombol disabled + spinner +
 * teks loading. Ini mencegah double-submit dan memberi feedback instan saat
 * Server Action masih menunggu round-trip jaringan (mis. login ke Supabase).
 *
 * WAJIB dirender sebagai anak dari <form> yang sedang submit — useFormStatus
 * hanya membaca status <form> terdekat di atasnya.
 */
export function SubmitButton({ label, pendingLabel }: SubmitButtonProps) {
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className={cn(
        "w-full py-2.5 px-4 rounded-lg text-sm font-semibold text-white",
        "bg-[var(--color-brand-500)] hover:bg-[var(--color-brand-600)]",
        "transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-500)] focus:ring-offset-2",
        "disabled:opacity-60 disabled:cursor-not-allowed",
        "flex items-center justify-center gap-2"
      )}
    >
      {pending && <Loader2 size={16} className="animate-spin" />}
      {pending ? (pendingLabel ?? `${label}…`) : label}
    </button>
  )
}
