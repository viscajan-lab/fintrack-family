"use client"

import { useState, useTransition } from "react"
import { Users, Clock, Loader2, Check, Link2Off, CheckCircle2, XCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { setGroupRecap, unlinkGroup, type GroupStatus } from "@/app/dashboard/settings/actions"

function pad(n: number): string {
  return n.toString().padStart(2, "0")
}

export function GroupCard({ status }: { status: GroupStatus }) {
  const [enabled, setEnabled] = useState(status.enabled)
  const [time, setTime]       = useState(`${pad(status.hour)}:00`)
  const [connected, setConnected] = useState(status.connected)
  const [error, setError]     = useState<string | null>(null)
  const [saved, setSaved]     = useState(false)
  const [isPending, start]    = useTransition()

  function flashSaved() {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  function persist(nextEnabled: boolean, hh: number) {
    setError(null)
    start(async () => {
      const res = await setGroupRecap(nextEnabled, hh)
      if (!res.ok) { setError(res.error ?? "Gagal menyimpan."); return }
      setEnabled(nextEnabled)
      flashSaved()
    })
  }

  function handleToggle() {
    const hh = Number(time.split(":")[0])
    persist(!enabled, hh)
  }

  function handleSaveTime() {
    const hh = Number(time.split(":")[0])
    persist(true, hh)
  }

  function handleUnlink() {
    setError(null)
    start(async () => {
      const res = await unlinkGroup()
      if (!res.ok) { setError(res.error ?? "Gagal melepas grup."); return }
      setConnected(false)
      flashSaved()
    })
  }

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Users size={18} className="text-[var(--color-brand-500)]" />
          <h2 className="font-semibold">Grup Keluarga</h2>
        </div>
        {connected ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-500/10 text-green-600 dark:text-green-400">
            <CheckCircle2 size={14} /> Terhubung
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[var(--color-border)] text-[var(--color-muted)]">
            <XCircle size={14} /> Belum terhubung
          </span>
        )}
      </div>

      {/* Belum terhubung → instruksi bind lewat bot */}
      {!connected ? (
        <div className="space-y-2 text-sm text-[var(--color-muted)]">
          <p>
            Sambungkan grup Telegram keluarga biar bot kirim <b>rekap harian</b> otomatis ke grup. ✨
          </p>
          <ol className="list-decimal list-inside space-y-1">
            <li>Tambahkan bot FinTrack ke grup keluarga kamu.</li>
            <li>Ketik <code className="px-1.5 py-0.5 rounded bg-[var(--color-background)] font-mono text-xs">/hubungkan_grup</code> di dalam grup (khusus admin).</li>
            <li>Refresh halaman ini — status akan jadi Terhubung.</li>
          </ol>
        </div>
      ) : (
        <>
          {status.groupTitle && (
            <p className="text-sm text-[var(--color-muted)] mb-4">
              Grup: <b className="text-[var(--color-foreground)]">{status.groupTitle}</b>
            </p>
          )}

          {/* Toggle recap harian */}
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-[var(--color-muted)]">
              Rekap harian otomatis ke grup
            </span>
            <button
              type="button"
              onClick={handleToggle}
              disabled={isPending || !status.isAdmin}
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

          {enabled && (
            <div className="flex items-center gap-3 mb-3">
              <div className="flex items-center gap-2 flex-1">
                <Clock size={16} className="text-[var(--color-muted)]" />
                <input
                  type="time"
                  step={3600}
                  value={time}
                  disabled={!status.isAdmin}
                  onChange={(e) => { setTime(e.target.value); setSaved(false) }}
                  className="px-3 py-2 text-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] outline-none focus:ring-2 focus:ring-[var(--color-brand-500)] disabled:opacity-60"
                />
                <span className="text-xs text-[var(--color-muted)]">WIB</span>
              </div>
              {status.isAdmin && (
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
              )}
            </div>
          )}

          <p className="text-xs text-[var(--color-muted)] mb-3">
            {enabled
              ? "Bot kirim ringkasan pemasukan & pengeluaran keluarga tiap hari ke grup. 🙌"
              : "Recap harian dimatikan. Kamu tetap bisa cek rekap lewat perintah bot kapan saja."}
          </p>

          {status.isAdmin ? (
            <button
              type="button"
              onClick={handleUnlink}
              disabled={isPending}
              className="inline-flex items-center gap-1.5 text-xs text-[var(--color-expense)] hover:underline disabled:opacity-60"
            >
              <Link2Off size={13} /> Lepas grup
            </button>
          ) : (
            <p className="text-xs text-[var(--color-muted)] italic">
              Hanya admin keluarga yang bisa mengubah pengaturan grup.
            </p>
          )}
        </>
      )}

      {saved && !connected && (
        <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1 mt-2">
          <Check size={13} /> Grup dilepas.
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
