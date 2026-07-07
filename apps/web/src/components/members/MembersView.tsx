"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import type { MembersData } from "@/lib/data/queries"
import { Crown, User, Copy, Check, Link2, Users } from "lucide-react"

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

      {/* Undang anggota (admin only) */}
      {data.isAdmin && (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Link2 size={16} className="text-[var(--color-brand-500)]" />
            Undang anggota keluarga
          </div>
          {data.inviteLink ? (
            <>
              <p className="text-xs text-[var(--color-muted)] leading-relaxed">
                Bagikan link ini. Saat dibuka di Telegram, mereka otomatis masuk ke workspace kamu.
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
    </div>
  )
}
