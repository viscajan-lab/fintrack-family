"use client"

import { useState, useEffect, useTransition, useCallback } from "react"
import { useRouter } from "next/navigation"
import {
  Check, Loader2, Copy, Smartphone, Users, Database, Sheet,
  ArrowRight, ArrowLeft, PartyPopper,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { generateWebCode } from "@/app/dashboard/link/actions"
import { createInvite } from "@/app/dashboard/members/actions"
import { getWizardState, type WizardState } from "./actions"

const STEPS = [
  { key: "telegram", label: "Sambung Telegram", icon: Smartphone },
  { key: "members",  label: "Tambah Anggota",   icon: Users },
  { key: "storage",  label: "Pilih Storage",    icon: Database },
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

// ─── Step 3: Storage + finish (A4) ────────────────────────────────────────────

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
