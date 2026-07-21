"use client"

import { useState, useEffect } from "react"
import { usePathname } from "next/navigation"
import { NavLink } from "./NavLink"
import {
  LayoutDashboard,
  ArrowLeftRight,
  PieChart,
  Settings,
  Repeat,
  BarChart3,
  PiggyBank,
  HandCoins,
  Wallet,
  UserCog,
  ShieldCheck,
  LogOut,
  Menu,
  X,
} from "lucide-react"
import { logout } from "@/app/auth/actions"
import type { UserRole } from "@/lib/data/queries"

type NavItem = {
  href: string
  label: string
  icon: typeof LayoutDashboard
  // Sub-halaman yang membuat menu grup ini ikut ter-highlight.
  match?: string[]
  // Role minimum yang boleh melihat menu ini. Default: semua role.
  minRole?: UserRole
  // Role yang menu ini disembunyikan darinya (mis. super_admin tak butuh menu operasional).
  hideFor?: UserRole[]
  // Kalau true, hanya aktif saat path == href persis (tidak menangkap sub-path).
  exact?: boolean
}

// Menu operasional yang tak relevan bagi super_admin (dia hanya kelola sistem, bukan keuangan tenant).
const OPS_ONLY: UserRole[] = ["super_admin"]

const NAV: NavItem[] = [
  { href: "/dashboard",              label: "Beranda",    icon: LayoutDashboard },
  { href: "/dashboard/transactions", label: "Transaksi",  icon: ArrowLeftRight, hideFor: OPS_ONLY },
  { href: "/dashboard/budget",       label: "Budget",     icon: PieChart,       hideFor: OPS_ONLY },
  { href: "/dashboard/kantong",      label: "Kantong",    icon: Wallet,         hideFor: OPS_ONLY },
  { href: "/dashboard/savings",      label: "Tabungan",   icon: PiggyBank,      hideFor: OPS_ONLY },
  { href: "/dashboard/debts",        label: "Hutang/Piutang", icon: HandCoins,  hideFor: OPS_ONLY },
  { href: "/dashboard/recurring",    label: "Berulang",   icon: Repeat,         hideFor: OPS_ONLY },
  {
    href: "/dashboard/reports",
    label: "Analisis",
    icon: BarChart3,
    match: ["/dashboard/reports", "/dashboard/trends", "/dashboard/insight", "/dashboard/riwayat"],
    hideFor: OPS_ONLY,
  },
  {
    href: "/dashboard/settings",
    label: "Pengaturan",
    icon: Settings,
    match: ["/dashboard/settings", "/dashboard/categories", "/dashboard/members", "/dashboard/link"],
  },
  {
    href: "/admin/users",
    label: "Kelola Admin",
    icon: UserCog,
    match: ["/admin/users"],
    minRole: "super_admin",
  },
  {
    href: "/admin",
    label: "Admin",
    icon: ShieldCheck,
    match: ["/admin"],
    exact: true,
    minRole: "super_admin",
  },
]

// Peringkat role untuk perbandingan minRole (makin tinggi makin berkuasa).
const ROLE_RANK: Record<UserRole, number> = {
  member: 0,
  admin: 1,
  super_admin: 2,
}

function Brand({ role }: { role?: UserRole }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-8 h-8 rounded-lg bg-[var(--color-brand-500)] flex items-center justify-center text-white font-bold text-sm">
        F
      </div>
      <span className="font-semibold text-base tracking-tight">FinTrack</span>
      {role === "super_admin" && (
        <span
          title="Kamu login sebagai Super Admin platform"
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-500/15 text-amber-600 dark:text-amber-400 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset ring-amber-500/30"
        >
          <ShieldCheck size={11} strokeWidth={2.4} />
          Super Admin
        </span>
      )}
    </div>
  )
}

export function Sidebar({ role }: { role: UserRole }) {
  const path = usePathname()
  const [open, setOpen] = useState(false)

  // Kunci scroll body saat menu full-screen mobile terbuka.
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : ""
    return () => { document.body.style.overflow = "" }
  }, [open])

  // Sembunyikan menu yang butuh role lebih tinggi, atau yang di-hide untuk role ini.
  const visibleNav = NAV.filter(
    (item) =>
      (!item.minRole || ROLE_RANK[role] >= ROLE_RANK[item.minRole]) &&
      !item.hideFor?.includes(role),
  )

  const isActive = (item: NavItem) => {
    const targets = item.match ?? [item.href]
    if (item.exact) return targets.some((t) => path === t)
    return targets.some(
      (t) => path === t || (t !== "/dashboard" && path.startsWith(t + "/")) || (t !== "/dashboard" && path.startsWith(t)),
    )
  }

  // Daftar link nav — dipakai ulang oleh sidebar desktop & overlay mobile (DRY).
  const navLinks = visibleNav.map((item) => {
    const { href, label, icon: Icon } = item
    return (
      <NavLink
        key={href}
        href={href}
        active={isActive(item)}
        className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors"
        activeClassName="bg-[var(--color-brand-500)] text-white"
        idleClassName="text-[var(--color-muted)] hover:bg-[var(--color-border)] hover:text-[var(--color-foreground)]"
      >
        <Icon size={18} strokeWidth={1.8} />
        {label}
      </NavLink>
    )
  })

  const logoutBtn = (
    <form action={logout}>
      <button type="submit" className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-[var(--color-muted)] hover:bg-[var(--color-border)] hover:text-[var(--color-foreground)] transition-colors">
        <LogOut size={18} strokeWidth={1.8} />
        Keluar
      </button>
    </form>
  )

  return (
    <>
      {/* ===== Sidebar desktop (md+) ===== */}
      <aside className="hidden md:flex flex-col w-60 shrink-0 bg-[var(--color-surface)] border-r border-[var(--color-border)] h-screen sticky top-0">
        <div className="flex items-center px-5 py-5 border-b border-[var(--color-border)]">
          <Brand role={role} />
        </div>
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">{navLinks}</nav>
        <div className="px-3 pb-4">{logoutBtn}</div>
      </aside>

      {/* ===== Topbar mobile (< md) ===== */}
      <header className="md:hidden fixed inset-x-0 top-0 z-40 flex items-center justify-between px-4 h-14 bg-[var(--color-surface)] border-b border-[var(--color-border)]">
        <Brand role={role} />
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Tutup menu" : "Buka menu"}
          aria-expanded={open}
          className="p-2 -mr-2 rounded-lg text-[var(--color-muted)] hover:bg-[var(--color-border)] hover:text-[var(--color-foreground)] transition-colors"
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </header>

      {/* ===== Overlay menu full-screen mobile ===== */}
      {open && (
        <div className="md:hidden fixed inset-0 top-14 z-40 flex flex-col bg-[var(--color-background)]" onClickCapture={() => setOpen(false)}>
          <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">{navLinks}</nav>
          <div className="px-4 pb-6 pt-2 border-t border-[var(--color-border)]">{logoutBtn}</div>
        </div>
      )}
    </>
  )
}
