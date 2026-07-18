"use client"

import { useState, useTransition } from "react"
import { X, Loader2, Wallet, Crown, User, Trophy, AlertTriangle } from "lucide-react"
import { formatIDR, cn } from "@/lib/utils"
import { setMemberAllowance } from "@/app/dashboard/actions"
import type { PocketsData, MemberPocket, MemberSpendingRow, PocketLevel } from "@/lib/data/queries"

// Warna & label per level peringatan kantong
const LEVEL_STYLE: Record<PocketLevel, { bar: string; text: string; badge: string; label: string }> = {
  safe:    { bar: "bg-[var(--color-income)]",  text: "text-[var(--color-income)]",  badge: "bg-[var(--color-income)]/10 text-[var(--color-income)]",   label: "Aman" },
  warning: { bar: "bg-amber-500",              text: "text-amber-600",              badge: "bg-amber-500/10 text-amber-600",                           label: "Hati-hati" },
  danger:  { bar: "bg-orange-500",             text: "text-orange-600",             badge: "bg-orange-500/10 text-orange-600",                         label: "Hampir habis" },
  over:    { bar: "bg-[var(--color-expense)]", text: "text-[var(--color-expense)]", badge: "bg-[var(--color-expense)]/10 text-[var(--color-expense)]", label: "Lewat jatah!" },
}

function PocketCard({
  pocket, month, isAdmin, onSetAllowance,
}: {
  pocket: MemberPocket
  month: string
  isAdmin: boolean
  onSetAllowance: (p: MemberPocket) => void
}) {
  const st = LEVEL_STYLE[pocket.level]
  const barPct = pocket.allowance > 0 ? Math.min(pocket.pct, 100) : 0

  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-background)] p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={cn(
            "w-9 h-9 rounded-full flex items-center justify-center",
            pocket.role === "admin" ? "bg-[var(--color-brand-500)]/10" : "bg-[var(--color-surface)]"
          )}>
            {pocket.role === "admin"
              ? <Crown size={17} className="text-[var(--color-brand-500)]" />
              : <User size={17} className="text-[var(--color-muted)]" />}
          </div>
          <div>
            <p className="font-semibold leading-tight">
              {pocket.display_name}
              {pocket.isMe && <span className="ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded bg-[var(--color-brand-500)]/10 text-[var(--color-brand-500)]">KAMU</span>}
            </p>
            <p className="text-xs text-[var(--color-muted)]">{pocket.role === "admin" ? "Admin" : "Anggota"}</p>
          </div>
        </div>

        {pocket.hasAllowance && (
          <span className={cn("text-[11px] font-semibold px-2 py-0.5 rounded-full", st.badge)}>
            {st.label}
          </span>
        )}
      </div>

      {pocket.hasAllowance ? (
        <>
          <div className="flex items-end justify-between">
            <div>
              <p className="text-xs text-[var(--color-muted)]">Sisa jatah</p>
              <p className={cn("text-xl font-bold tabular-nums", pocket.remaining < 0 ? "text-[var(--color-expense)]" : "")}>
                {formatIDR(pocket.remaining)}
              </p>
            </div>
            <p className="text-xs text-[var(--color-muted)] text-right">
              <span className="tabular-nums">{formatIDR(pocket.spent)}</span> / {formatIDR(pocket.allowance)}
            </p>
          </div>

          {/* progress bar */}
          <div className="h-2.5 rounded-full bg-[var(--color-surface)] overflow-hidden">
            <div className={cn("h-full rounded-full transition-all", st.bar)} style={{ width: `${barPct}%` }} />
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className={cn("font-medium tabular-nums", st.text)}>{pocket.pct}% terpakai</span>
            {isAdmin && (
              <button onClick={() => onSetAllowance(pocket)} className="text-[var(--color-brand-500)] hover:underline">
                Ubah jatah
              </button>
            )}
          </div>

          {pocket.level === "over" && (
            <div className="flex items-center gap-1.5 text-xs text-[var(--color-expense)] bg-[var(--color-expense)]/10 rounded-lg px-2.5 py-1.5">
              <AlertTriangle size={13} /> Lewat jatah {formatIDR(Math.abs(pocket.remaining))}
            </div>
          )}
        </>
      ) : (
        <div className="flex items-center justify-between">
          <p className="text-sm text-[var(--color-muted)]">Belum ada jatah bulan ini</p>
          {isAdmin && (
            <button
              onClick={() => onSetAllowance(pocket)}
              className="text-xs font-medium text-[var(--color-brand-500)] hover:underline"
            >
              + Set jatah
            </button>
          )}
        </div>
      )}
      <input type="hidden" value={month} readOnly />
    </div>
  )
}

export function PocketsView({
  data, ranking,
}: {
  data: PocketsData
  ranking: MemberSpendingRow[]
}) {
  const [modalFor, setModalFor] = useState<MemberPocket | null>(null)
  const [error, setError]       = useState<string | null>(null)
  const [isPending, start]      = useTransition()

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const fd = new FormData(e.currentTarget)
    fd.set("month", data.month)
    if (modalFor) fd.set("member_id", modalFor.member_id)
    start(async () => {
      const res = await setMemberAllowance(fd)
      if (res?.error) { setError(res.error); return }
      setModalFor(null)
    })
  }

  const topSpender = ranking[0]

  return (
    <div className="space-y-6">
      {/* Ringkasan atas */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] p-4">
          <p className="text-xs text-[var(--color-muted)]">Total jatah</p>
          <p className="text-lg font-bold tabular-nums">{formatIDR(data.totalAllowance)}</p>
        </div>
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] p-4">
          <p className="text-xs text-[var(--color-muted)]">Total terpakai</p>
          <p className="text-lg font-bold tabular-nums">{formatIDR(data.totalSpent)}</p>
        </div>
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] p-4">
          <p className="text-xs text-[var(--color-muted)]">Sisa total</p>
          <p className={cn("text-lg font-bold tabular-nums", (data.totalAllowance - data.totalSpent) < 0 ? "text-[var(--color-expense)]" : "text-[var(--color-income)]")}>
            {formatIDR(data.totalAllowance - data.totalSpent)}
          </p>
        </div>
      </div>

      {/* Kartu kantong per anggota */}
      {data.pockets.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--color-border)] p-10 text-center text-[var(--color-muted)]">
          <Wallet size={28} className="mx-auto mb-2 opacity-50" />
          Belum ada anggota keluarga. Undang lewat menu Pengaturan.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {data.pockets.map((p) => (
            <PocketCard
              key={p.member_id}
              pocket={p}
              month={data.month}
              isAdmin={data.isAdmin}
              onSetAllowance={setModalFor}
            />
          ))}
        </div>
      )}

      {/* Ranking siapa paling ngabisin */}
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-background)]">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-[var(--color-border)]">
          <Trophy size={18} className="text-amber-500" />
          <h3 className="font-semibold">Siapa Paling Ngabisin?</h3>
        </div>
        {ranking.length === 0 ? (
          <p className="px-5 py-6 text-sm text-[var(--color-muted)] text-center">Belum ada pengeluaran bulan ini.</p>
        ) : (
          <div className="divide-y divide-[var(--color-border)]">
            {ranking.map((r, i) => (
              <div key={r.member_id ?? "unassigned"} className="flex items-center gap-3 px-5 py-3">
                <span className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0",
                  i === 0 ? "bg-amber-500/15 text-amber-600"
                  : i === 1 ? "bg-[var(--color-surface)] text-[var(--color-muted)]"
                  : "bg-[var(--color-surface)] text-[var(--color-muted)]"
                )}>
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className={cn("text-sm font-medium truncate", r.member_id === null && "text-[var(--color-muted)] italic")}>
                      {r.display_name}
                      {i === 0 && topSpender && <span className="ml-1.5 text-[10px]">👑</span>}
                    </span>
                    <span className="text-sm font-semibold tabular-nums ml-2 shrink-0">{formatIDR(r.spent)}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-[var(--color-surface)] overflow-hidden">
                    <div className="h-full rounded-full bg-[var(--color-brand-500)]" style={{ width: `${r.pct}%` }} />
                  </div>
                </div>
                <span className="text-xs text-[var(--color-muted)] tabular-nums w-9 text-right shrink-0">{r.pct}%</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal set jatah (admin) */}
      {modalFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-[var(--color-background)] rounded-2xl border border-[var(--color-border)] shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)]">
              <h2 className="font-semibold">Set Jatah Kantong</h2>
              <button onClick={() => setModalFor(null)} className="text-[var(--color-muted)] hover:text-[var(--color-foreground)]">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <p className="text-sm">
                Anggota: <strong>{modalFor.display_name}</strong>
              </p>
              <div>
                <label className="block text-xs font-medium text-[var(--color-muted)] mb-1">Jatah bulan ini (Rp)</label>
                <input
                  name="amount" required type="number" min="0"
                  defaultValue={modalFor.allowance || ""}
                  placeholder="2000000"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] outline-none focus:ring-2 focus:ring-[var(--color-brand-500)]"
                />
              </div>
              <p className="text-xs text-[var(--color-muted)]">📅 Berlaku untuk bulan: <strong>{data.month}</strong></p>

              {error && (
                <p className="text-xs text-[var(--color-expense)] bg-[var(--color-expense)]/10 rounded-lg px-3 py-2">⚠️ {error}</p>
              )}

              <button
                type="submit" disabled={isPending}
                className="w-full py-2.5 rounded-lg bg-[var(--color-brand-500)] text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {isPending ? <><Loader2 size={15} className="animate-spin" /> Menyimpan...</> : "Simpan Jatah"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
