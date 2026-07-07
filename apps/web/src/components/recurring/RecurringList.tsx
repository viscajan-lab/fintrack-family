"use client"

import { useState, useMemo, useTransition, useRef } from "react"
import { Plus, X, Loader2, Repeat, Trash2, Pencil, TrendingUp, TrendingDown, Bell, Zap } from "lucide-react"
import { formatIDR, cn } from "@/lib/utils"
import { addRecurring, updateRecurring, toggleRecurring, deleteRecurring } from "@/app/dashboard/actions"
import type { RecurringRule } from "@/lib/data/queries"

const CATEGORIES = [
  { id: "makanan",    name: "Makanan & Minuman",  type: "expense" },
  { id: "transport",  name: "Transportasi",        type: "expense" },
  { id: "belanja",    name: "Belanja",             type: "expense" },
  { id: "tagihan",    name: "Rumah & Tagihan",     type: "expense" },
  { id: "hiburan",    name: "Hiburan",             type: "expense" },
  { id: "kesehatan",  name: "Kesehatan",           type: "expense" },
  { id: "pendidikan", name: "Pendidikan",          type: "expense" },
  { id: "gaji",       name: "Gaji",                type: "income"  },
  { id: "freelance",  name: "Freelance",           type: "income"  },
  { id: "transfer",   name: "Transfer Masuk",      type: "income"  },
  { id: "lainnya",    name: "Lainnya",             type: "both"    },
]

// ─── Add / Edit modal ─────────────────────────────────────────────────────────

function RuleForm({
  rule,
  onClose,
}: {
  rule: RecurringRule | null   // null = tambah baru
  onClose: () => void
}) {
  const isEdit = !!rule
  const [type, setType]    = useState<"income" | "expense">(rule?.type ?? "expense")
  const [mode, setMode]    = useState<"auto" | "reminder">(rule?.mode ?? "auto")
  const [error, setError]  = useState<string | null>(null)
  const [isPending, start] = useTransition()
  const formRef            = useRef<HTMLFormElement>(null)

  const cats = CATEGORIES.filter(c => c.type === type || c.type === "both")

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const fd = new FormData(e.currentTarget)
    fd.set("type", type)
    fd.set("mode", mode)
    start(async () => {
      const res = isEdit ? await updateRecurring(rule!.id, fd) : await addRecurring(fd)
      if (res?.error) { setError(res.error); return }
      onClose()
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-[var(--color-background)] rounded-2xl border border-[var(--color-border)] shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)]">
          <h2 className="font-semibold">{isEdit ? "Edit Berulang" : "Tambah Berulang"}</h2>
          <button onClick={onClose} className="text-[var(--color-muted)] hover:text-[var(--color-foreground)]">
            <X size={18} />
          </button>
        </div>

        <form ref={formRef} onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Type toggle */}
          <div className="flex gap-2">
            {(["expense", "income"] as const).map((t) => (
              <button
                key={t} type="button"
                onClick={() => setType(t)}
                className={cn(
                  "flex-1 py-2 rounded-lg text-sm font-medium border transition-colors",
                  type === t
                    ? t === "income"
                      ? "bg-[var(--color-income)]/10 border-[var(--color-income)] text-[var(--color-income)]"
                      : "bg-[var(--color-expense)]/10 border-[var(--color-expense)] text-[var(--color-expense)]"
                    : "border-[var(--color-border)] text-[var(--color-muted)]"
                )}
              >
                {t === "income" ? "💰 Pemasukan" : "💸 Pengeluaran"}
              </button>
            ))}
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-[var(--color-muted)] mb-1">Nama Tagihan</label>
            <input
              name="description" required defaultValue={rule?.description ?? ""}
              placeholder="contoh: Langganan Netflix"
              className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] outline-none focus:ring-2 focus:ring-[var(--color-brand-500)]"
            />
          </div>

          {/* Amount */}
          <div>
            <label className="block text-xs font-medium text-[var(--color-muted)] mb-1">Nominal (Rp)</label>
            <input
              name="amount" required type="number" min="1" defaultValue={rule?.amount ?? ""}
              placeholder="54000"
              className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] outline-none focus:ring-2 focus:ring-[var(--color-brand-500)]"
            />
          </div>

          {/* Day + Category */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[var(--color-muted)] mb-1">Tanggal (1–31)</label>
              <input
                name="day_of_month" type="number" min="1" max="31" required
                defaultValue={rule?.day_of_month ?? ""}
                placeholder="1"
                className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] outline-none focus:ring-2 focus:ring-[var(--color-brand-500)]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--color-muted)] mb-1">Kategori</label>
              <select
                name="category_name" required defaultValue={rule?.category_name ?? ""}
                className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] outline-none focus:ring-2 focus:ring-[var(--color-brand-500)]"
              >
                <option value="">— Pilih —</option>
                {cats.map(c => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))}
                {/* Jika kategori lama tak ada di daftar, tetap tampilkan */}
                {rule?.category_name && !cats.some(c => c.name === rule.category_name) && (
                  <option value={rule.category_name}>{rule.category_name}</option>
                )}
              </select>
            </div>
          </div>

          {/* Mode toggle */}
          <div>
            <label className="block text-xs font-medium text-[var(--color-muted)] mb-1.5">Mode</label>
            <div className="flex gap-2">
              {(["auto", "reminder"] as const).map((m) => (
                <button
                  key={m} type="button"
                  onClick={() => setMode(m)}
                  className={cn(
                    "flex-1 py-2 rounded-lg text-xs font-medium border transition-colors flex items-center justify-center gap-1.5",
                    mode === m
                      ? "bg-[var(--color-brand-500)]/10 border-[var(--color-brand-500)] text-[var(--color-brand-500)]"
                      : "border-[var(--color-border)] text-[var(--color-muted)]"
                  )}
                >
                  {m === "auto"
                    ? <><Zap size={13} /> Otomatis catat</>
                    : <><Bell size={13} /> Ingatkan saja</>}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-[var(--color-muted)] mt-1.5">
              {mode === "auto"
                ? "Transaksi dicatat otomatis tiap tanggal tsb."
                : "Kamu cuma diingatkan, catat manual."}
            </p>
          </div>

          {error && (
            <p className="text-xs text-[var(--color-expense)] bg-[var(--color-expense)]/10 rounded-lg px-3 py-2">
              ⚠️ {error}
            </p>
          )}

          <button
            type="submit" disabled={isPending}
            className="w-full py-2.5 rounded-lg bg-[var(--color-brand-500)] text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {isPending
              ? <><Loader2 size={15} className="animate-spin" /> Menyimpan...</>
              : isEdit ? "Simpan Perubahan" : "Simpan"}
          </button>
        </form>
      </div>
    </div>
  )
}

// ─── Main list ────────────────────────────────────────────────────────────────

export function RecurringList({ initialRules }: { initialRules: RecurringRule[] }) {
  const [showAdd, setShowAdd]     = useState(false)
  const [editRule, setEditRule]   = useState<RecurringRule | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [togglingId, setToggling] = useState<string | null>(null)
  const [actError, setActError]   = useState<string | null>(null)
  const [, start]                 = useTransition()

  function handleDelete(id: string) {
    setActError(null)
    setPendingId(id)
    start(async () => {
      const res = await deleteRecurring(id)
      setPendingId(null)
      if (res?.error) { setActError(res.error); return }
      setConfirmId(null)
    })
  }

  function handleToggle(id: string, next: boolean) {
    setActError(null)
    setToggling(id)
    start(async () => {
      const res = await toggleRecurring(id, next)
      setToggling(null)
      if (res?.error) setActError(res.error)
    })
  }

  const monthlyExpense = useMemo(() =>
    initialRules.filter(r => r.active && r.type === "expense").reduce((s, r) => s + r.amount, 0),
    [initialRules])
  const monthlyIncome = useMemo(() =>
    initialRules.filter(r => r.active && r.type === "income").reduce((s, r) => s + r.amount, 0),
    [initialRules])

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Transaksi Berulang</h1>
          <p className="text-sm text-[var(--color-muted)] mt-0.5">
            {initialRules.length} aturan tersimpan
          </p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--color-brand-500)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <Plus size={16} /> Tambah
        </button>
      </div>

      {/* Summary bar */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 flex items-center gap-3">
          <TrendingUp size={20} className="text-[var(--color-income)]" />
          <div>
            <p className="text-xs text-[var(--color-muted)]">Pemasukan rutin / bln</p>
            <p className="font-semibold text-[var(--color-income)]">{formatIDR(monthlyIncome)}</p>
          </div>
        </div>
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 flex items-center gap-3">
          <TrendingDown size={20} className="text-[var(--color-expense)]" />
          <div>
            <p className="text-xs text-[var(--color-muted)]">Pengeluaran rutin / bln</p>
            <p className="font-semibold text-[var(--color-expense)]">{formatIDR(monthlyExpense)}</p>
          </div>
        </div>
      </div>

      {actError && (
        <p className="text-xs text-[var(--color-expense)] bg-[var(--color-expense)]/10 rounded-lg px-3 py-2">
          ⚠️ {actError}
        </p>
      )}

      {/* List */}
      <div className="rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] overflow-hidden">
        {initialRules.length === 0 ? (
          <div className="py-14 text-center text-sm text-[var(--color-muted)] whitespace-pre-line">
            {"Belum ada transaksi berulang 🔁\nTambah lewat tombol di atas atau /add_recurring di Bot."}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-[var(--color-muted)]">
                <th className="text-left px-5 py-3 font-medium">Nama</th>
                <th className="text-left px-5 py-3 font-medium">Kategori</th>
                <th className="text-left px-5 py-3 font-medium">Tiap tgl</th>
                <th className="text-left px-5 py-3 font-medium">Mode</th>
                <th className="text-right px-5 py-3 font-medium">Nominal</th>
                <th className="text-center px-5 py-3 font-medium w-16">Aktif</th>
                <th className="text-right px-5 py-3 font-medium w-20">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {initialRules.map((r) => (
                <tr key={r.id} className={cn("transition-colors", r.active ? "hover:bg-[var(--color-border)]/30" : "opacity-55")}>
                  <td className="px-5 py-3.5 font-medium flex items-center gap-2">
                    <Repeat size={14} className="text-[var(--color-muted)] shrink-0" />
                    {r.description}
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--color-border)] text-[var(--color-muted)]">
                      {r.category_name}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-[var(--color-muted)]">tgl {r.day_of_month}</td>
                  <td className="px-5 py-3.5">
                    <span className={cn(
                      "inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full",
                      r.mode === "auto"
                        ? "bg-[var(--color-brand-500)]/10 text-[var(--color-brand-500)]"
                        : "bg-[var(--color-border)] text-[var(--color-muted)]"
                    )}>
                      {r.mode === "auto" ? <><Zap size={11} /> Otomatis</> : <><Bell size={11} /> Ingatkan</>}
                    </span>
                  </td>
                  <td className={cn(
                    "px-5 py-3.5 text-right font-semibold",
                    r.type === "income" ? "text-[var(--color-income)]" : "text-[var(--color-expense)]"
                  )}>
                    {r.type === "income" ? "+" : "−"}{formatIDR(r.amount)}
                  </td>
                  <td className="px-5 py-3.5 text-center">
                    <button
                      onClick={() => handleToggle(r.id, !r.active)}
                      disabled={togglingId === r.id}
                      aria-label={r.active ? "Nonaktifkan" : "Aktifkan"}
                      className={cn(
                        "relative inline-flex h-5 w-9 items-center rounded-full transition-colors disabled:opacity-60",
                        r.active ? "bg-[var(--color-income)]" : "bg-[var(--color-border)]"
                      )}
                    >
                      {togglingId === r.id ? (
                        <Loader2 size={11} className="animate-spin mx-auto text-white" />
                      ) : (
                        <span className={cn(
                          "inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform",
                          r.active ? "translate-x-4.5" : "translate-x-1"
                        )} />
                      )}
                    </button>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    {confirmId === r.id ? (
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleDelete(r.id)}
                          disabled={pendingId === r.id}
                          className="text-xs font-medium px-2 py-1 rounded-md bg-[var(--color-expense)] text-white hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center gap-1"
                        >
                          {pendingId === r.id ? <Loader2 size={12} className="animate-spin" /> : "Hapus"}
                        </button>
                        <button
                          onClick={() => setConfirmId(null)}
                          disabled={pendingId === r.id}
                          className="text-xs font-medium px-2 py-1 rounded-md border border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-foreground)] transition-colors"
                        >
                          Batal
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-end gap-0.5">
                        <button
                          onClick={() => setEditRule(r)}
                          aria-label="Edit berulang"
                          className="text-[var(--color-muted)] hover:text-[var(--color-brand-500)] transition-colors p-1"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => { setConfirmId(r.id); setActError(null) }}
                          aria-label="Hapus berulang"
                          className="text-[var(--color-muted)] hover:text-[var(--color-expense)] transition-colors p-1"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showAdd && <RuleForm rule={null} onClose={() => setShowAdd(false)} />}
      {editRule && <RuleForm rule={editRule} onClose={() => setEditRule(null)} />}
    </div>
  )
}
