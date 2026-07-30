"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { Bell, AlertTriangle, AlertCircle, Info, CheckCircle2 } from "lucide-react"
import type { AppNotification, NotifSeverity } from "@/lib/data/queries"

const ICONS: Record<NotifSeverity, typeof Bell> = {
  danger: AlertCircle,
  warning: AlertTriangle,
  info: Info,
  success: CheckCircle2,
}

const TONE: Record<NotifSeverity, string> = {
  danger: "text-red-500",
  warning: "text-amber-500",
  info: "text-blue-500",
  success: "text-green-500",
}

/**
 * Lonceng notifikasi + dropdown ringkasan.
 * Data di-derive server-side (getNotifications) lalu dikirim sebagai props,
 * jadi komponen ini murni presentasi — tanpa fetch tambahan di klien.
 */
export function NotificationBell({ items }: { items: AppNotification[] }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Tutup saat klik di luar atau tekan Escape.
  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("mousedown", onClick)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onClick)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  // Badge hanya menghitung yang benar-benar perlu tindakan (bukan kabar baik).
  const actionable = items.filter((n) => n.severity !== "success").length
  const badge = actionable > 9 ? "9+" : String(actionable)

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={actionable > 0 ? `Notifikasi (${actionable} perlu perhatian)` : "Notifikasi"}
        aria-expanded={open}
        aria-haspopup="menu"
        className="relative p-2 rounded-lg text-[var(--color-muted)] hover:bg-[var(--color-border)] hover:text-[var(--color-foreground)] transition-colors"
      >
        <Bell size={18} strokeWidth={1.8} />
        {actionable > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-semibold leading-4 text-center">
            {badge}
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-2 w-[min(20rem,calc(100vw-2rem))] max-h-[70vh] overflow-y-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-lg z-50"
        >
          <div className="px-4 py-3 border-b border-[var(--color-border)]">
            <p className="text-sm font-semibold">Notifikasi</p>
            <p className="text-xs text-[var(--color-muted)]">
              {items.length === 0
                ? "Semua aman, tidak ada yang perlu diurus"
                : `${items.length} hal yang perlu kamu tahu`}
            </p>
          </div>

          {items.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <CheckCircle2 size={28} strokeWidth={1.6} className="mx-auto mb-2 text-green-500" />
              <p className="text-sm text-[var(--color-muted)]">Tidak ada notifikasi</p>
            </div>
          ) : (
            <ul className="divide-y divide-[var(--color-border)]">
              {items.map((n) => {
                const Icon = ICONS[n.severity]
                return (
                  <li key={n.id}>
                    <Link
                      href={n.href}
                      onClick={() => setOpen(false)}
                      className="flex gap-3 px-4 py-3 hover:bg-[var(--color-border)] transition-colors"
                    >
                      <Icon size={16} strokeWidth={2} className={`mt-0.5 shrink-0 ${TONE[n.severity]}`} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium leading-snug">{n.title}</p>
                        <p className="text-xs text-[var(--color-muted)] leading-snug mt-0.5 break-words">
                          {n.detail}
                        </p>
                      </div>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
