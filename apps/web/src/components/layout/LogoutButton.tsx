"use client"

import { useFormStatus } from "react-dom"
import { LogOut, Loader2 } from "lucide-react"
import { logout } from "@/app/auth/actions"

/**
 * Tombol "Keluar" dengan pending state.
 *
 * Tombol Keluar memanggil Server Action logout() yang melakukan
 * supabase.auth.signOut() (round-trip jaringan) sebelum redirect. Tanpa
 * pending state, tombol terlihat tidak merespons dan bisa diklik berkali-kali
 * (tiap klik = submit logout lagi). useFormStatus() (react-dom, React 19)
 * membaca status pending dari <form> induk → disable tombol + spinner begitu
 * diklik, mencegah double-submit dan memberi feedback instan.
 */
function LogoutInner() {
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-[var(--color-muted)] hover:bg-[var(--color-border)] hover:text-[var(--color-foreground)] transition-colors disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:bg-transparent"
    >
      {pending ? (
        <Loader2 size={18} strokeWidth={1.8} className="animate-spin" />
      ) : (
        <LogOut size={18} strokeWidth={1.8} />
      )}
      {pending ? "Keluar…" : "Keluar"}
    </button>
  )
}

export default function LogoutButton() {
  return (
    <form action={logout}>
      <LogoutInner />
    </form>
  )
}
