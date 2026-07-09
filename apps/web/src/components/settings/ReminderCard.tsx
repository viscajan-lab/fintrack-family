"use client"

import { useState, useTransition } from "react"
import { Bell, BellOff, Clock, Loader2, Check } from "lucide-react"
import { cn } from "@/lib/utils"
import { setReminder, clearReminder, type ReminderStatus } from "@/app/dashboard/settings/actions"

function pad(n: number): string {
  return n.toString().padStart(2, "0")
}

export function ReminderCard({ status }: { status: ReminderStatus }) {
  const [enabled, setEnabled] = useState(status.enabled)
  const [time, setTime]       = useState(
    status.enabled && status.hour != null ? `${pad(status.hour)}:${pad(status.minute)}` : "21:00"
  )
  const [error, setError]     = useState<string | null>(null)
  const [saved, setSaved]     = useState(false)
  const [isPending, start]    = useTransition()

  // Akun belum ter-link → arahkan ke halaman hubungkan.
  if (!status.linked) {
    return (
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
        <div className="flex items-center gap-2 mb-2">
          <Bell size={18} className="text-[var(--color-brand-500)]" />
          <h2 className="font-semibold">Pengingat Harian</h2>
        </div>
        <p className="text-sm text-[var(--color-muted)]">
          Hubungkan akun ke bot Telegram dulu, baru kamu bisa atur jam pengingat harian di sini. 🔔
        </p>
      </div>
    )
  }

  function flashSaved() {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  function handleToggle() {
    setError(null)
    if (enabled) {
      // matikan
      start(async () => {
        const res = await clearReminder()
        if (!res.ok) { setError(res.error ?? "Gagal menyimpan."); return }
        setEnabled(false)
        flashSaved()
      })
    } else {
      // nyalakan dengan jam saat ini di input
      const [hh, mm] = time.split(":").map(Number)
      start(async () => {
        const res = await setReminder(hh, mm)
        if (!res.ok) { setError(res.error ?? "Gagal menyimpan."); return }
        setEnabled(true)
        flashSaved()
      })
    }
  }

  function handleSaveTime() {
    setError(null)
    const [hh, mm] = time.split(":").map(Number)
    start(async () => {
      const res = await setReminder(hh, mm)
      if (!res.ok) { setError(res.error ?? "Gagal menyimpan."); return }
      setEnabled(true)
      flashSaved()
    })
  }

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {enabled
            ? <Bell size={18} className="text-[var(--color-brand-500)]" />
            : <BellOff size={18} className="text-[var(--color-muted)]" />}
          <h2 className="font-semibold">Pengingat Harian</h2>
        </div>

        {/* Toggle switch */}
        <button
          type="button"
          onClick={handleToggle}
          disabled={isPending}
          aria-pressed={enabled}
          className={cn(
            "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-60",
            enabled ? "bg-[var(--color-brand-500)]" : "bg-[var(--color-border)]"
          )}
        >
          <span
            className={cn(
              "inline-block h-4 w-4 rounded-full bg-white shadow transition-transform",
              enabled ? "translate-x-6" : "translate-x-1"
            )}
          />
        </button>
      </div>

      <p className="text-sm text-[var(--color-muted)] mb-4">
        {enabled
          ? "Bot Telegram akan mengingatkanmu catat pengeluaran tiap hari. 🙌"
          : "Aktifkan biar nggak lupa catat pengeluaran tiap hari, langsung dari chat bot."}
      </p>

      {enabled && (
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 flex-1">
            <Clock size={16} className="text-[var(--color-muted)]" />
            <input
              type="time"
              value={time}
              onChange={(e) => { setTime(e.target.value); setSaved(false) }}
              className="px-3 py-2 text-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] outline-none focus:ring-2 focus:ring-[var(--color-brand-500)]"
            />
            <span className="text-xs text-[var(--color-muted)]">WIB</span>
          </div>
          <button
            type="button"
            onClick={handleSaveTime}
            disabled={isPending}
            className="px-4 py-2 rounded-lg bg-[var(--color-brand-500)] text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center gap-2"
          >
            {isPending
              ? <><Loader2 size={14} className="animate-spin" /> Simpan</>
              : saved
                ? <><Check size={14} /> Tersimpan</>
                : "Simpan"}
          </button>
        </div>
      )}

      {saved && !enabled && (
        <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
          <Check size={13} /> Pengingat dimatikan.
        </p>
      )}

      {error && (
        <p className="text-xs text-[var(--color-expense)] bg-[var(--color-expense)]/10 rounded-lg px-3 py-2 mt-2">
          ⚠️ {error}
        </p>
      )}
    </div>
  )
}
