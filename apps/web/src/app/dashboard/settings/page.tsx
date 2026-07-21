import Link from "next/link"
import { Mail, CheckCircle2, XCircle, Users, MessageCircle } from "lucide-react"
import { getLinkStatus, getReminderStatus, getGroupStatus } from "./actions"
import { getMyRole } from "@/lib/data/queries"
import { ReminderCard } from "@/components/settings/ReminderCard"
import { GroupCard } from "@/components/settings/GroupCard"
import { SubTabs } from "@/components/layout/SubTabs"
import { pengaturanTabs } from "@/components/layout/tabs"

export const dynamic = "force-dynamic"

function fmtDate(iso: string | null): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })
}

export default async function SettingsPage() {
  const role = await getMyRole()
  const s = await getLinkStatus()
  const reminder = await getReminderStatus()
  const group = await getGroupStatus()

  return (
    <div className="p-6 space-y-5 max-w-2xl">
      <SubTabs tabs={pengaturanTabs(role)} />
      <div>
        <h1 className="text-2xl font-bold">Pengaturan</h1>
        <p className="text-sm text-[var(--color-muted)] mt-0.5">Kelola akun dan koneksi bot Telegram kamu.</p>
      </div>

      {/* ── Akun ─────────────────────────────────────────── */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
        <h2 className="font-semibold mb-4">Akun</h2>
        <div className="space-y-3">
          <Row icon={<Mail size={18} className="text-[var(--color-brand-500)]" />} label="Email">
            <span className="font-medium">{s.email ?? "—"}</span>
          </Row>
          <Row icon={<Users size={18} className="text-[var(--color-brand-500)]" />} label="Keluarga">
            <span className="font-medium">{s.tenantName ?? "—"}</span>
          </Row>
        </div>
      </div>

      {/* ── Koneksi Telegram ─────────────────────────────── */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">Koneksi Telegram</h2>
          {s.connected ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-500/10 text-green-600 dark:text-green-400">
              <CheckCircle2 size={14} /> Terhubung
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[var(--color-border)] text-[var(--color-muted)]">
              <XCircle size={14} /> Belum terhubung
            </span>
          )}
        </div>

        {s.connected ? (
          <div className="space-y-3">
            <Row icon={<MessageCircle size={18} className="text-[var(--color-brand-500)]" />} label="Telegram ID">
              <span className="font-mono font-medium">{s.telegramId}</span>
            </Row>
            <Row icon={<CheckCircle2 size={18} className="text-green-500" />} label="Terhubung sejak">
              <span className="font-medium">{fmtDate(s.memberSince)}</span>
            </Row>
            <p className="text-sm text-[var(--color-muted)] pt-1">
              Transaksi yang kamu catat lewat bot Telegram otomatis muncul di sini. ✨
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-[var(--color-muted)]">
              Akun web kamu belum tersambung ke bot Telegram. Hubungkan supaya transaksi dari chat langsung masuk ke dashboard.
            </p>
            <Link
              href="/dashboard/link"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[var(--color-brand-500)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
            >
              Hubungkan Sekarang
            </Link>
          </div>
        )}
      </div>

      {/* ── Pengingat Harian ──────────────────────────────── */}
      <ReminderCard status={reminder} />

      {/* ── Grup Keluarga ─────────────────────────────────── */}
      <GroupCard status={group} />
    </div>
  )
}

function Row({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-2.5 text-sm text-[var(--color-muted)]">
        {icon}
        {label}
      </div>
      {children}
    </div>
  )
}
