"use client"

import { useState, useTransition } from "react"
import { cn } from "@/lib/utils"
import type { MembersData, InviteRow } from "@/lib/data/queries"
import { createInvite, revokeInvite } from "@/app/dashboard/members/actions"
import { Crown, User, Copy, Check, Link2, Users, Ticket, Plus, Trash2, Clock } from "lucide-react"

export function MembersView({ data }: { data: MembersData }) {
  const [copied, setCopied] = useState(false)

  async function copyLink() {
    if (!data.inviteLink) return
    await navigator.clipboard.writeText(data.inviteLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="max-w-2xl space-y-6">
      <header className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[var(--color-brand-500)]/10 flex items-center justify-center text-[var(--color-brand-500)]">
          <Users size={20} strokeWidth={1.8} />
        </div>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Anggota {data.familyName}</h1>
          <p className="text-sm text-[var(--color-muted)]">{data.members.length} orang di workspace ini</p>
        </div>
      </header>

      {/* Daftar anggota */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] divide-y divide-[var(--color-border)]">
        {data.members.map((m) => (
          <div key={m.id} className="flex items-center gap-3 px-4 py-3.5">
            <div
              className={cn(
                "w-9 h-9 rounded-full flex items-center justify-center shrink-0",
                m.role === "admin"
                  ? "bg-amber-500/15 text-amber-500"
                  : "bg-[var(--color-border)] text-[var(--color-muted)]",
              )}
            >
              {m.role === "admin" ? <Crown size={16} /> : <User size={16} />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium truncate">{m.display_name}</span>
                {m.isMe && (
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[var(--color-brand-500)] text-white">
                    KAMU
                  </span>
                )}
              </div>
              <span className="text-xs text-[var(--color-muted)]">
                {m.role === "admin" ? "Admin" : "Anggota"}
                {!m.linked && " · belum punya akun web"}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Undang cepat via link umum (admin only) */}
      {data.isAdmin && (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Link2 size={16} className="text-[var(--color-brand-500)]" />
            Link undangan umum
          </div>
          {data.inviteLink ? (
            <>
              <p className="text-xs text-[var(--color-muted)] leading-relaxed">
                Link permanen — siapa pun yang membukanya masuk sebagai <b>anggota biasa</b>. Untuk kontrol lebih (pilih role, sekali pakai, kedaluwarsa), pakai undangan tertarget di bawah.
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg px-3 py-2 truncate">
                  {data.inviteLink}
                </code>
                <button
                  onClick={copyLink}
                  className={cn(
                    "shrink-0 flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg transition-colors",
                    copied
                      ? "bg-emerald-500/15 text-emerald-600"
                      : "bg-[var(--color-brand-500)] text-white hover:opacity-90",
                  )}
                >
                  {copied ? <Check size={15} /> : <Copy size={15} />}
                  {copied ? "Tersalin" : "Salin"}
                </button>
              </div>
            </>
          ) : (
            <p className="text-xs text-[var(--color-muted)] leading-relaxed">
              Link undangan belum tersedia. Set env <code className="text-[11px]">NEXT_PUBLIC_BOT_USERNAME</code> agar link bisa dibuat, atau pakai <code className="text-[11px]">/anggota</code> di bot.
            </p>
          )}
        </div>
      )}

      {/* Undangan tertarget (admin only) */}
      {data.isAdmin && <TargetedInvites invites={data.invites} />}
    </div>
  )
}

// ─── Panel undangan tertarget ─────────────────────────────────────────────────

function TargetedInvites({ invites }: { invites: InviteRow[] }) {
  const [role, setRole] = useState<"member" | "admin">("member")
  const [label, setLabel] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function handleCreate() {
    setError(null)
    const fd = new FormData()
    fd.set("role", role)
    fd.set("label", label)
    startTransition(async () => {
      const res = await createInvite(fd)
      if (res?.error) setError(res.error)
      else setLabel("")
    })
  }

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 space-y-4">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Ticket size={16} className="text-[var(--color-brand-500)]" />
        Undangan tertarget
      </div>
      <p className="text-xs text-[var(--color-muted)] leading-relaxed">
        Buat undangan <b>sekali pakai</b> dengan role tertentu dan masa berlaku 72 jam. Cocok untuk mengundang admin baru atau menjaga siapa yang masuk.
      </p>

      {/* Form buat undangan */}
      <div className="space-y-2.5">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setRole("member")}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 text-sm font-medium py-2 rounded-lg border transition-colors",
              role === "member"
                ? "border-[var(--color-brand-500)] bg-[var(--color-brand-500)]/10 text-[var(--color-brand-500)]"
                : "border-[var(--color-border)] text-[var(--color-muted)] hover:bg-[var(--color-background)]",
            )}
          >
            <User size={15} /> Anggota
          </button>
          <button
            type="button"
            onClick={() => setRole("admin")}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 text-sm font-medium py-2 rounded-lg border transition-colors",
              role === "admin"
                ? "border-amber-500 bg-amber-500/10 text-amber-600"
                : "border-[var(--color-border)] text-[var(--color-muted)] hover:bg-[var(--color-background)]",
            )}
          >
            <Crown size={15} /> Admin
          </button>
        </div>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Catatan (opsional) — mis. 'buat Bunda'"
          maxLength={80}
          className="w-full text-sm bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg px-3 py-2 outline-none focus:border-[var(--color-brand-500)]"
        />
        <button
          onClick={handleCreate}
          disabled={pending}
          className="w-full flex items-center justify-center gap-1.5 text-sm font-medium py-2 rounded-lg bg-[var(--color-brand-500)] text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          <Plus size={15} /> {pending ? "Membuat…" : "Buat undangan"}
        </button>
        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>

      {/* Daftar undangan aktif */}
      {invites.length > 0 && (
        <div className="space-y-2 pt-1">
          <div className="text-xs font-medium text-[var(--color-muted)]">
            {invites.length} undangan aktif
          </div>
          {invites.map((inv) => (
            <InviteItem key={inv.id} inv={inv} />
          ))}
        </div>
      )}
    </div>
  )
}

function InviteItem({ inv }: { inv: InviteRow }) {
  const [copied, setCopied] = useState(false)
  const [pending, startTransition] = useTransition()

  async function copy() {
    if (!inv.link) return
    await navigator.clipboard.writeText(inv.link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function revoke() {
    const fd = new FormData()
    fd.set("id", inv.id)
    startTransition(async () => {
      await revokeInvite(fd)
    })
  }

  const expiresLabel = new Date(inv.expires_at).toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })

  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2.5">
      <div
        className={cn(
          "w-7 h-7 rounded-full flex items-center justify-center shrink-0",
          inv.role === "admin" ? "bg-amber-500/15 text-amber-500" : "bg-[var(--color-border)] text-[var(--color-muted)]",
        )}
      >
        {inv.role === "admin" ? <Crown size={13} /> : <User size={13} />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 text-sm">
          <span className="font-medium">{inv.role === "admin" ? "Admin" : "Anggota"}</span>
          {inv.label && <span className="text-[var(--color-muted)] truncate">· {inv.label}</span>}
        </div>
        <div className="flex items-center gap-1 text-[11px] text-[var(--color-muted)]">
          <Clock size={11} />
          {inv.expired ? (
            <span className="text-red-500">Kedaluwarsa · {expiresLabel}</span>
          ) : (
            <span>Berlaku sampai {expiresLabel}</span>
          )}
        </div>
      </div>
      {inv.link && !inv.expired && (
        <button
          onClick={copy}
          title="Salin link undangan"
          className={cn(
            "shrink-0 w-8 h-8 flex items-center justify-center rounded-lg transition-colors",
            copied ? "bg-emerald-500/15 text-emerald-600" : "text-[var(--color-muted)] hover:bg-[var(--color-surface)]",
          )}
        >
          {copied ? <Check size={15} /> : <Copy size={15} />}
        </button>
      )}
      <button
        onClick={revoke}
        disabled={pending}
        title="Batalkan undangan"
        className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-[var(--color-muted)] hover:bg-red-500/10 hover:text-red-500 disabled:opacity-50 transition-colors"
      >
        <Trash2 size={15} />
      </button>
    </div>
  )
}
