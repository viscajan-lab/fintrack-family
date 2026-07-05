"use client"

import { useState, useTransition } from "react"
import { Copy, Check, Smartphone, Globe, Loader2 } from "lucide-react"
import { generateWebCode, claimBotCode } from "./actions"

export function LinkClient() {
  // ─── Arah A1: web generate kode ───────────────────────────────
  const [webCode, setWebCode] = useState<string | null>(null)
  const [webErr, setWebErr] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [genPending, startGen] = useTransition()

  function handleGenerate() {
    setWebErr(null)
    startGen(async () => {
      const res = await generateWebCode()
      if (res.error) setWebErr(res.error)
      else if (res.success) setWebCode(res.code!)
    })
  }

  function handleCopy() {
    if (!webCode) return
    navigator.clipboard.writeText(webCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  // ─── Arah A2: web klaim kode dari bot ─────────────────────────
  const [claimMsg, setClaimMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [claimPending, startClaim] = useTransition()

  function handleClaim(formData: FormData) {
    setClaimMsg(null)
    startClaim(async () => {
      const res = await claimBotCode(formData)
      if (res.error) setClaimMsg({ ok: false, text: res.error })
      else if (res.success) setClaimMsg({ ok: true, text: "Berhasil! Akun web kamu sekarang tersambung ke keluarga FinTrack di bot. 🎉" })
    })
  }

  return (
    <div className="space-y-5">
      {/* ── Card 1: Web → Bot ─────────────────────────────── */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
        <div className="flex items-center gap-2 mb-1">
          <Globe size={18} className="text-[var(--color-brand-500)]" />
          <h2 className="font-semibold">Web → Bot</h2>
        </div>
        <p className="text-sm text-[var(--color-muted)] mb-4">
          Buat kode di sini, lalu kirim <code className="px-1 rounded bg-[var(--color-border)]">/hubungkan KODE</code> ke bot Telegram.
        </p>

        {webCode ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="font-mono text-3xl font-bold tracking-[0.3em] px-4 py-3 rounded-lg bg-[var(--color-border)] select-all">
                {webCode}
              </div>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border border-[var(--color-border)] hover:bg-[var(--color-border)] transition-colors"
              >
                {copied ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
                {copied ? "Tersalin" : "Salin"}
              </button>
            </div>
            <p className="text-xs text-[var(--color-muted)]">
              Kode berlaku 15 menit. Kirim ke bot: <code className="px-1 rounded bg-[var(--color-border)]">/hubungkan {webCode}</code>
            </p>
            <button onClick={handleGenerate} disabled={genPending} className="text-sm text-[var(--color-brand-500)] hover:underline disabled:opacity-50">
              Buat kode baru
            </button>
          </div>
        ) : (
          <button
            onClick={handleGenerate}
            disabled={genPending}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[var(--color-brand-500)] text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {genPending && <Loader2 size={16} className="animate-spin" />}
            Buat Kode Hubungkan
          </button>
        )}

        {webErr && <p className="text-sm text-red-500 mt-3">{webErr}</p>}
      </div>

      {/* ── Card 2: Bot → Web ─────────────────────────────── */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
        <div className="flex items-center gap-2 mb-1">
          <Smartphone size={18} className="text-[var(--color-brand-500)]" />
          <h2 className="font-semibold">Bot → Web</h2>
        </div>
        <p className="text-sm text-[var(--color-muted)] mb-4">
          Punya kode dari bot Telegram? (kirim <code className="px-1 rounded bg-[var(--color-border)]">/hubungkan</code> di bot untuk dapat kode) Masukkan di sini.
        </p>

        <form action={handleClaim} className="flex items-center gap-3">
          <input
            name="code"
            inputMode="numeric"
            maxLength={6}
            placeholder="123456"
            required
            className="font-mono text-xl tracking-[0.2em] w-40 px-3 py-2.5 rounded-lg border border-[var(--color-border)] bg-transparent focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-500)]"
          />
          <button
            type="submit"
            disabled={claimPending}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[var(--color-brand-500)] text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {claimPending && <Loader2 size={16} className="animate-spin" />}
            Hubungkan
          </button>
        </form>

        {claimMsg && (
          <p className={`text-sm mt-3 ${claimMsg.ok ? "text-green-500" : "text-red-500"}`}>
            {claimMsg.text}
          </p>
        )}
      </div>
    </div>
  )
}
