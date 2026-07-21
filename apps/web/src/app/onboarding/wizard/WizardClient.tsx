"use client"

import { useState, useEffect, useTransition, useCallback } from "react"
import { useRouter } from "next/navigation"
import {
  Check, Loader2, Copy, Smartphone, Users, Database, Sheet,
  ArrowRight, ArrowLeft, PartyPopper, Tags, Wallet, Plus,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { generateWebCode } from "@/app/dashboard/link/actions"
import { createInvite } from "@/app/dashboard/members/actions"
import { addCategory, setMemberAllowance } from "@/app/dashboard/actions"
import {
  getWizardState,
  type WizardState,
  type WizardMember,
} from "./actions"

const STEPS = [
  { key: "telegram",   label: "Sambung Telegram", icon: Smartphone },
  { key: "members",    label: "Tambah Anggota",   icon: Users },
  { key: "categories", label: "Kategori",         icon: Tags },
  { key: "pockets",    label: "Kantong",          icon: Wallet },
  { key: "storage",    label: "Pilih Storage",    icon: Database },
] as const

type StepKey = (typeof STEPS)[number]["key"]

export function WizardClient({ initial }: { initial: WizardState }) {
  const router = useRouter()
  const [state, setState] = useState<WizardState>(initial)
  const [stepIdx, setStepIdx] = useState(0)

  const refresh = useCallback(async () => {
    const s = await getWizardState()
    setState(s)
    return s
  }, [])

  const step = STEPS[stepIdx].key
  const goNext = () => setStepIdx((i) => Math.min(i + 1, STEPS.length - 1))
  const goBack = () => setStepIdx((i) => Math.max(i - 1, 0))

  return (
    <div className="min-h-screen bg-[var(--color-background)] px-4 py-10">
      <div className="w-full max-w-2xl mx-auto">
        {/* Header + brand */}
        <div className="flex items-center gap-2 justify-center mb-8">
          <div className="w-9 h-9 rounded-xl bg-[var(--color-brand-500)] flex items-center justify-center text-white font-bold">F</div>
          <span className="text-xl font-bold tracking-tight">FinTrack</span>
        </div>

        {/* Progress indicator */}
        <ProgressBar stepIdx={stepIdx} state={state} />

        {/* Step body */}
        <div className="mt-8 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 sm:p-8">
          {step === "telegram" && (
            <TelegramStep state={state} refresh={refresh} onNext={goNext} />
          )}
          {step === "members" && (
            <MembersStep state={state} onNext={goNext} onBack={goBack} />
          )}
          {step === "categories" && (
            <CategoriesStep state={state} refresh={refresh} onNext={goNext} onBack={goBack} />
          )}
          {step === "pockets" && (
            <PocketsStep state={state} refresh={refresh} onNext={goNext} onBack={goBack} />
          )}
          {step === "storage" && (
            <StorageStep onBack={goBack} onFinish={() => router.push("/dashboard")} />
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Progress indicator ───────────────────────────────────────────────────────

function ProgressBar({ stepIdx, state }: { stepIdx: number; state: WizardState }) {
  const done: Record<StepKey, boolean> = {
    telegram: state.telegramLinked,
    members: state.memberCount > 1,
    categories: state.categories.some((c) => !c.isDefault),
    pockets: state.members.some((m) => m.allowance > 0),
    storage: state.storageType != null,
  }
  return (
    <div className="flex items-center">
      {STEPS.map((s, i) => {
        const Icon = s.icon
        const active = i === stepIdx
        const complete = done[s.key]
        return (
          <div key={s.key} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1.5">
              <div className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors",
                complete
                  ? "bg-emerald-500 border-emerald-500 text-white"
                  : active
                    ? "border-[var(--color-brand-500)] text-[var(--color-brand-500)]"
                    : "border-[var(--color-border)] text-[var(--color-muted)]"
              )}>
                {complete ? <Check size={18} /> : <Icon size={18} />}
              </div>
              <span className={cn(
                "text-[11px] font-medium whitespace-nowrap",
                active ? "text-[var(--color-foreground)]" : "text-[var(--color-muted)]"
              )}>{s.label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={cn(
                "h-0.5 flex-1 mx-2 rounded",
                i < stepIdx ? "bg-emerald-500" : "bg-[var(--color-border)]"
              )} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Step 1: Sambung Telegram (A2) ────────────────────────────────────────────

function TelegramStep({
  state, refresh, onNext,
}: { state: WizardState; refresh: () => Promise<WizardState>; onNext: () => void }) {
  const [code, setCode] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const [polling, setPolling] = useState(false)

  // Polling status setelah kode dibuat: cek tiap 4 detik apakah sudah linked.
  useEffect(() => {
    if (!polling || state.telegramLinked) return
    const id = setInterval(async () => {
      const s = await refresh()
      if (s.telegramLinked) setPolling(false)
    }, 4000)
    return () => clearInterval(id)
  }, [polling, state.telegramLinked, refresh])

  function makeCode() {
    setErr(null)
    start(async () => {
      const res = await generateWebCode()
      if (res.error) setErr(res.error)
      else if (res.success) { setCode(res.code!); setPolling(true) }
    })
  }

  function copy() {
    if (!code) return
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  if (state.telegramLinked) {
    return (
      <div className="text-center space-y-4">
        <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
          <Check size={28} />
        </div>
        <div>
          <h2 className="text-lg font-bold">Telegram tersambung! 🎉</h2>
          <p className="text-sm text-[var(--color-muted)] mt-1">
            Akun web kamu sudah terhubung ke bot FinTrack.
          </p>
        </div>
        <button onClick={onNext} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--color-brand-500)] text-white text-sm font-semibold hover:opacity-90">
          Lanjut <ArrowRight size={16} />
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold">Sambungkan bot Telegram</h2>
        <p className="text-sm text-[var(--color-muted)] mt-1">
          Buat kode di bawah, lalu kirim <code className="px-1 rounded bg-[var(--color-border)]">/hubungkan KODE</code> ke bot Telegram FinTrack.
        </p>
      </div>

      {code ? (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="font-mono text-3xl font-bold tracking-[0.3em] px-4 py-3 rounded-lg bg-[var(--color-border)] select-all">{code}</div>
            <button onClick={copy} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border border-[var(--color-border)] hover:bg-[var(--color-border)]">
              {copied ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
              {copied ? "Tersalin" : "Salin"}
            </button>
          </div>
          <p className="text-xs text-[var(--color-muted)]">
            Kirim ke bot: <code className="px-1 rounded bg-[var(--color-border)]">/hubungkan {code}</code> — kode berlaku 15 menit.
          </p>
          <div className="flex items-center gap-2 text-sm text-[var(--color-brand-500)]">
            <Loader2 size={15} className="animate-spin" />
            Menunggu kamu mengirim kode ke bot…
          </div>
        </div>
      ) : (
        <button onClick={makeCode} disabled={pending} className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[var(--color-brand-500)] text-white text-sm font-medium hover:opacity-90 disabled:opacity-50">
          {pending && <Loader2 size={16} className="animate-spin" />}
          Buat Kode Hubungkan
        </button>
      )}

      {err && <p className="text-sm text-red-500">{err}</p>}
    </div>
  )
}

// ─── Step 2: Tambah Anggota (A3) ──────────────────────────────────────────────

function MembersStep({
  state, onNext, onBack,
}: { state: WizardState; onNext: () => void; onBack: () => void }) {
  const [link, setLink] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [pending, start] = useTransition()

  function invite() {
    setErr(null)
    const fd = new FormData()
    fd.set("role", "member")
    start(async () => {
      const res = await createInvite(fd)
      if (res.error) setErr(res.error)
      else if (res.success) {
        const url = state.botUsername
          ? `https://t.me/${state.botUsername}?start=inv_${res.token}`
          : `inv_${res.token}`
        setLink(url)
      }
    })
  }

  function copy() {
    if (!link) return
    navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold">Undang anggota keluarga</h2>
        <p className="text-sm text-[var(--color-muted)] mt-1">
          Bikin link undangan sekali-pakai. Kirim ke pasangan/anggota keluarga — mereka tinggal klik untuk gabung lewat bot. (Opsional, bisa dilewati.)
        </p>
      </div>

      {!state.isAdmin && (
        <p className="text-sm text-amber-600">Hanya admin yang bisa mengundang. Kamu bisa lewati langkah ini.</p>
      )}

      {link ? (
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="flex-1 font-mono text-xs px-3 py-2.5 rounded-lg bg-[var(--color-border)] truncate select-all">{link}</div>
            <button onClick={copy} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border border-[var(--color-border)] hover:bg-[var(--color-border)]">
              {copied ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
              {copied ? "Tersalin" : "Salin"}
            </button>
          </div>
          <p className="text-xs text-[var(--color-muted)]">Link berlaku 72 jam & hanya bisa dipakai sekali.</p>
        </div>
      ) : (
        <button onClick={invite} disabled={pending || !state.isAdmin} className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[var(--color-brand-500)] text-white text-sm font-medium hover:opacity-90 disabled:opacity-50">
          {pending && <Loader2 size={16} className="animate-spin" />}
          Buat Link Undangan
        </button>
      )}

      {err && <p className="text-sm text-red-500">{err}</p>}

      <div className="flex items-center justify-between pt-2">
        <button onClick={onBack} className="inline-flex items-center gap-1.5 text-sm text-[var(--color-muted)] hover:text-[var(--color-foreground)]">
          <ArrowLeft size={16} /> Kembali
        </button>
        <button onClick={onNext} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--color-brand-500)] text-white text-sm font-semibold hover:opacity-90">
          {link ? "Lanjut" : "Lewati"} <ArrowRight size={16} />
        </button>
      </div>
    </div>
  )
}

// ─── Step 3: Kategori (opsional, pre-filled default) ──────────────────────────

function CategoriesStep({
  state, refresh, onNext, onBack,
}: {
  state: WizardState
  refresh: () => Promise<WizardState>
  onNext: () => void
  onBack: () => void
}) {
  const defaults = state.categories.filter((c) => c.isDefault)
  const customs = state.categories.filter((c) => !c.isDefault)

  const [name, setName] = useState("")
  const [emoji, setEmoji] = useState("")
  const [type, setType] = useState<"expense" | "income" | "both">("expense")
  const [err, setErr] = useState<string | null>(null)
  const [pending, start] = useTransition()

  function add() {
    setErr(null)
    if (!name.trim()) { setErr("Nama kategori wajib diisi"); return }
    const fd = new FormData()
    fd.set("name", name.trim())
    fd.set("emoji", emoji.trim())
    fd.set("type", type)
    start(async () => {
      const res = await addCategory(fd)
      if (res?.error) { setErr(res.error); return }
      setName(""); setEmoji("")
      await refresh()
    })
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold">Kategori keluarga</h2>
        <p className="text-sm text-[var(--color-muted)] mt-1">
          Keluargamu sudah punya {defaults.length} kategori bawaan — langsung bisa dipakai mencatat.
          Mau tambah kategori sendiri? Silakan (opsional).
        </p>
      </div>

      {/* Kategori bawaan (read-only chips) */}
      {defaults.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-[var(--color-muted)] mb-2">Kategori bawaan</p>
          <div className="flex flex-wrap gap-2">
            {defaults.map((c) => (
              <span key={c.id} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm bg-[var(--color-border)]">
                <span>{c.emoji || "🏷️"}</span>{c.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Kategori custom yang sudah ditambahkan */}
      {customs.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-[var(--color-muted)] mb-2">Kategori kamu</p>
          <div className="flex flex-wrap gap-2">
            {customs.map((c) => (
              <span key={c.id} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm bg-[var(--color-brand-500)]/10 text-[var(--color-brand-500)] border border-[var(--color-brand-500)]/30">
                <span>{c.emoji || "🏷️"}</span>{c.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Form tambah kategori custom */}
      <div className="rounded-xl border border-[var(--color-border)] p-4 space-y-3">
        <p className="text-sm font-medium">Tambah kategori baru</p>
        <div className="flex gap-2">
          <input
            value={emoji}
            onChange={(e) => setEmoji(e.target.value)}
            placeholder="🍔"
            maxLength={2}
            className="w-14 text-center px-2 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] text-sm"
          />
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nama kategori (mis. Jajan)"
            className="flex-1 px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] text-sm"
          />
        </div>
        <div className="flex items-center gap-2">
          {(["expense", "income", "both"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
                type === t
                  ? "border-[var(--color-brand-500)] bg-[var(--color-brand-500)]/10 text-[var(--color-brand-500)]"
                  : "border-[var(--color-border)] text-[var(--color-muted)]"
              )}
            >
              {t === "expense" ? "Pengeluaran" : t === "income" ? "Pemasukan" : "Keduanya"}
            </button>
          ))}
          <button
            type="button"
            onClick={add}
            disabled={pending}
            className="ml-auto inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--color-brand-500)] text-white text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            {pending ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
            Tambah
          </button>
        </div>
        {err && <p className="text-sm text-red-500">{err}</p>}
      </div>

      <div className="flex items-center justify-between pt-2">
        <button onClick={onBack} className="inline-flex items-center gap-1.5 text-sm text-[var(--color-muted)] hover:text-[var(--color-foreground)]">
          <ArrowLeft size={16} /> Kembali
        </button>
        <button onClick={onNext} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--color-brand-500)] text-white text-sm font-semibold hover:opacity-90">
          Lanjut <ArrowRight size={16} />
        </button>
      </div>
    </div>
  )
}

// ─── Step 4: Kantong (jatah bulanan per anggota) ──────────────────────────────

function formatRupiah(n: number): string {
  return n > 0 ? n.toLocaleString("id-ID") : ""
}

function PocketsStep({
  state, refresh, onNext, onBack,
}: {
  state: WizardState
  refresh: () => Promise<WizardState>
  onNext: () => void
  onBack: () => void
}) {
  // Nilai input per member (string, hanya digit). Seed dari allowance existing.
  const [amounts, setAmounts] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    for (const m of state.members) init[m.id] = m.allowance > 0 ? String(m.allowance) : ""
    return init
  })
  const [savingId, setSavingId] = useState<string | null>(null)
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set())
  const [err, setErr] = useState<string | null>(null)
  const [pending, start] = useTransition()

  function setAmount(id: string, raw: string) {
    const digits = raw.replace(/\D/g, "")
    setAmounts((a) => ({ ...a, [id]: digits }))
    setSavedIds((s) => { const n = new Set(s); n.delete(id); return n })
  }

  function save(member: WizardMember) {
    setErr(null)
    const val = amounts[member.id] ?? ""
    if (!val) { setErr("Isi jumlah jatah dulu untuk " + member.displayName); return }
    setSavingId(member.id)
    const fd = new FormData()
    fd.set("member_id", member.id)
    fd.set("amount", val)
    fd.set("month", state.currentMonth)
    start(async () => {
      const res = await setMemberAllowance(fd)
      setSavingId(null)
      if (res?.error) { setErr(res.error); return }
      setSavedIds((s) => new Set(s).add(member.id))
      await refresh()
    })
  }

  const monthLabel = new Date(state.currentMonth + "-01").toLocaleDateString("id-ID", {
    month: "long", year: "numeric",
  })

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold">Kantong bulanan</h2>
        <p className="text-sm text-[var(--color-muted)] mt-1">
          Atur jatah pengeluaran tiap anggota untuk <b>{monthLabel}</b>. Kosongkan kalau belum mau
          diatur — bisa kapan saja lewat menu Kantong. (Opsional.)
        </p>
      </div>

      {!state.isAdmin && (
        <p className="text-sm text-amber-600">Hanya admin yang bisa mengatur jatah. Kamu bisa lewati langkah ini.</p>
      )}

      <div className="space-y-2.5">
        {state.members.map((m) => {
          const saved = savedIds.has(m.id)
          const busy = savingId === m.id
          return (
            <div key={m.id} className="flex items-center gap-3 rounded-xl border border-[var(--color-border)] p-3">
              <div className="w-9 h-9 rounded-full bg-[var(--color-border)] flex items-center justify-center text-sm font-semibold shrink-0">
                {m.displayName.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{m.displayName}</p>
                <p className="text-[11px] text-[var(--color-muted)]">{m.role === "admin" ? "Admin" : "Anggota"}</p>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-sm text-[var(--color-muted)]">Rp</span>
                <input
                  inputMode="numeric"
                  value={formatRupiah(parseInt(amounts[m.id] || "0", 10))}
                  onChange={(e) => setAmount(m.id, e.target.value)}
                  placeholder="0"
                  disabled={!state.isAdmin}
                  className="w-32 px-2.5 py-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] text-sm text-right disabled:opacity-50"
                />
              </div>
              <button
                onClick={() => save(m)}
                disabled={!state.isAdmin || busy || pending}
                className={cn(
                  "shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50",
                  saved
                    ? "bg-emerald-500 text-white"
                    : "border border-[var(--color-border)] hover:bg-[var(--color-border)]"
                )}
              >
                {busy ? <Loader2 size={15} className="animate-spin" /> : saved ? <Check size={15} /> : null}
                {saved ? "Tersimpan" : "Simpan"}
              </button>
            </div>
          )
        })}
      </div>

      {err && <p className="text-sm text-red-500">{err}</p>}

      <div className="flex items-center justify-between pt-2">
        <button onClick={onBack} className="inline-flex items-center gap-1.5 text-sm text-[var(--color-muted)] hover:text-[var(--color-foreground)]">
          <ArrowLeft size={16} /> Kembali
        </button>
        <button onClick={onNext} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--color-brand-500)] text-white text-sm font-semibold hover:opacity-90">
          Lanjut <ArrowRight size={16} />
        </button>
      </div>
    </div>
  )
}

// ─── Step 5: Storage + finish (A4) ────────────────────────────────────────────

function StorageStep({ onBack, onFinish }: { onBack: () => void; onFinish: () => void }) {
  const [selected, setSelected] = useState<"supabase" | "sheets">("supabase")
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const OPTIONS = [
    { value: "supabase" as const, icon: Database, title: "Supabase Database", badge: "Direkomendasikan", desc: "Cepat, real-time, aman di cloud." },
    { value: "sheets" as const, icon: Sheet, title: "Google Spreadsheet", badge: "Familiar", desc: "Data di Google Sheet milikmu sendiri." },
  ]

  async function finish() {
    setErr(null)
    setLoading(true)
    if (selected === "sheets") {
      window.location.href = `/api/auth/google?intent=sheets_setup`
      return
    }
    const res = await fetch("/api/onboarding/set-storage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ storage_type: "supabase" }),
    })
    if (res.ok) onFinish()
    else { setErr("Gagal menyimpan pilihan, coba lagi."); setLoading(false) }
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold">Pilih tempat simpan data</h2>
        <p className="text-sm text-[var(--color-muted)] mt-1">Keduanya gratis. Pilihan ini menentukan ke mana transaksi keluarga disimpan.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {OPTIONS.map(({ value, icon: Icon, title, badge, desc }) => (
          <button key={value} onClick={() => setSelected(value)} className={cn(
            "text-left p-5 rounded-2xl border-2 transition-all",
            selected === value
              ? "border-[var(--color-brand-500)] bg-[var(--color-brand-500)]/5 shadow-md"
              : "border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-brand-500)]/40"
          )}>
            <div className="flex items-center justify-between mb-2">
              <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center", selected === value ? "bg-[var(--color-brand-500)] text-white" : "bg-[var(--color-border)] text-[var(--color-muted)]")}>
                <Icon size={18} />
              </div>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[var(--color-border)]">{badge}</span>
            </div>
            <h3 className="font-semibold text-sm">{title}</h3>
            <p className="text-xs text-[var(--color-muted)] mt-1">{desc}</p>
          </button>
        ))}
      </div>

      {err && <p className="text-sm text-red-500">{err}</p>}

      <div className="flex items-center justify-between pt-2">
        <button onClick={onBack} className="inline-flex items-center gap-1.5 text-sm text-[var(--color-muted)] hover:text-[var(--color-foreground)]">
          <ArrowLeft size={16} /> Kembali
        </button>
        <button onClick={finish} disabled={loading} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--color-brand-500)] text-white text-sm font-semibold hover:opacity-90 disabled:opacity-60">
          {loading ? <Loader2 size={16} className="animate-spin" /> : <PartyPopper size={16} />}
          {selected === "sheets" ? "Sambungkan Google Sheets" : "Selesai — ke Dashboard"}
        </button>
      </div>
    </div>
  )
}
