"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Database, Sheet } from "lucide-react"
import { cn } from "@/lib/utils"
import type { StorageType } from "@/lib/providers"

const OPTIONS = [
  {
    value:   "supabase" as StorageType,
    icon:    Database,
    title:   "Supabase Database",
    badge:   "Direkomendasikan",
    badgeColor: "bg-emerald-100 text-emerald-700",
    desc:    "Data tersimpan aman di cloud database. Cepat, real-time, dan bisa diakses dari mana saja.",
    pros:    ["⚡ Real-time & cepat", "🔒 Aman dengan enkripsi", "📱 Multi-device sync", "♾️ Tidak ada batas baris"],
  },
  {
    value:   "sheets" as StorageType,
    icon:    Sheet,
    title:   "Google Spreadsheet",
    badge:   "Familiar",
    badgeColor: "bg-blue-100 text-blue-700",
    desc:    "Data tersimpan di Google Sheet milikmu sendiri. Mudah diedit, diexport, dan dibagikan.",
    pros:    ["📊 Mudah diedit manual", "📤 Export ke Excel/CSV", "👁️ Data transparan", "🔗 Bebas vendor lock-in"],
  },
]

export default function OnboardingPage() {
  const [selected, setSelected] = useState<StorageType>("supabase")
  const [loading,  setLoading]  = useState(false)
  const router = useRouter()

  async function handleContinue() {
    setLoading(true)

    if (selected === "sheets") {
      // Redirect ke Google OAuth
      window.location.href = `/api/auth/google?intent=sheets_setup`
      return
    }

    // Supabase — set storage_type via API then go to dashboard
    const res = await fetch("/api/onboarding/set-storage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ storage_type: "supabase" }),
    })
    if (res.ok) router.push("/dashboard")
    else setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-background)] px-4 py-12">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="flex items-center gap-2 justify-center mb-4">
            <div className="w-10 h-10 rounded-xl bg-[var(--color-brand-500)] flex items-center justify-center text-white font-bold text-lg">F</div>
            <span className="text-2xl font-bold tracking-tight">FinTrack</span>
          </div>
          <h1 className="text-2xl font-bold mb-2">Pilih tempat simpan data kamu</h1>
          <p className="text-[var(--color-muted)] text-sm">Pilihan ini tidak bisa diubah setelah setup. Tenang, keduanya gratis!</p>
        </div>

        {/* Option cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          {OPTIONS.map(({ value, icon: Icon, title, badge, badgeColor, desc, pros }) => (
            <button
              key={value}
              onClick={() => setSelected(value)}
              className={cn(
                "text-left p-6 rounded-2xl border-2 transition-all",
                selected === value
                  ? "border-[var(--color-brand-500)] bg-[var(--color-brand-500)]/5 shadow-md"
                  : "border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-brand-500)]/40"
              )}
            >
              <div className="flex items-start justify-between mb-3">
                <div className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center",
                  selected === value ? "bg-[var(--color-brand-500)] text-white" : "bg-[var(--color-border)] text-[var(--color-muted)]"
                )}>
                  <Icon size={20} strokeWidth={1.8} />
                </div>
                <span className={cn("text-xs font-semibold px-2.5 py-1 rounded-full", badgeColor)}>{badge}</span>
              </div>

              <h3 className="font-semibold mb-1">{title}</h3>
              <p className="text-xs text-[var(--color-muted)] mb-4 leading-relaxed">{desc}</p>

              <ul className="space-y-1.5">
                {pros.map(p => (
                  <li key={p} className="text-xs text-[var(--color-foreground)]">{p}</li>
                ))}
              </ul>
            </button>
          ))}
        </div>

        {/* CTA */}
        <button
          onClick={handleContinue}
          disabled={loading}
          className={cn(
            "w-full py-3.5 rounded-xl text-sm font-semibold text-white transition-colors",
            "bg-[var(--color-brand-500)] hover:bg-[var(--color-brand-600)]",
            "disabled:opacity-60 disabled:cursor-not-allowed"
          )}
        >
          {loading ? "Memproses..." : selected === "sheets" ? "Sambungkan Google Sheets →" : "Lanjut ke Dashboard →"}
        </button>

        {selected === "sheets" && (
          <p className="text-center text-xs text-[var(--color-muted)] mt-3">
            Kamu akan diarahkan ke halaman izin Google. FinTrack hanya meminta akses ke Spreadsheet.
          </p>
        )}
      </div>
    </div>
  )
}
