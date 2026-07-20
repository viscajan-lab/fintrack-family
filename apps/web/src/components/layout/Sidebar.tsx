"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
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
  LogOut,
} from "lucide-react"
import { cn } from "@/lib/utils"
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
  // Kalau true, hanya aktif saat path == href persis (tidak menangkap sub-path).
  exact?: boolean
}

const NAV: NavItem[] = [
  { href: "/dashboard",              label: "Beranda",    icon: LayoutDashboard },
  { href: "/dashboard/transactions", label: "Transaksi",  icon: ArrowLeftRight },
  { href: "/dashboard/budget",       label: "Budget",     icon: PieChart },
  { href: "/dashboard/kantong",      label: "Kantong",    icon: Wallet },
  { href: "/dashboard/savings",      label: "Tabungan",   icon: PiggyBank },
  { href: "/dashboard/debts",        label: "Hutang/Piutang", icon: HandCoins },
  { href: "/dashboard/recurring",    label: "Berulang",   icon: Repeat },
  {
    href: "/dashboard/reports",
    label: "Analisis",
    icon: BarChart3,
    match: ["/dashboard/reports", "/dashboard/trends", "/dashboard/insight", "/dashboard/riwayat"],
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
]

// Peringkat role untuk perbandingan minRole (makin tinggi makin berkuasa).
const ROLE_RANK: Record<UserRole, number> = {
  member: 0,
  admin: 1,
  super_admin: 2,
}

export function Sidebar({ role }: { role: UserRole }) {
  const path = usePathname()

  // Sembunyikan menu yang butuh role lebih tinggi dari role user.
  const visibleNav = NAV.filter(
    (item) => !item.minRole || ROLE_RANK[role] >= ROLE_RANK[item.minRole],
  )

  const isActive = (item: NavItem) => {
    const targets = item.match ?? [item.href]
    if (item.exact) return targets.some((t) => path === t)
    return targets.some(
      (t) => path === t || (t !== "/dashboard" && path.startsWith(t + "/")) || (t !== "/dashboard" && path.startsWith(t)),
    )
  }

  return (
    <aside className="flex flex-col w-60 shrink-0 bg-[var(--color-surface)] border-r border-[var(--color-border)] h-screen sticky top-0">
      {/* Logo */}
      <div className="flex items-center gap-2 px-5 py-5 border-b border-[var(--color-border)]">
        <div className="w-8 h-8 rounded-lg bg-[var(--color-brand-500)] flex items-center justify-center text-white font-bold text-sm">
          F
        </div>
        <span className="font-semibold text-base tracking-tight">FinTrack</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {visibleNav.map((item) => {
          const { href, label, icon: Icon } = item
          const active = isActive(item)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                active
                  ? "bg-[var(--color-brand-500)] text-white"
                  : "text-[var(--color-muted)] hover:bg-[var(--color-border)] hover:text-[var(--color-foreground)]"
              )}
            >
              <Icon size={18} strokeWidth={1.8} />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* User footer */}
      <div className="px-3 pb-4">
        <form action={logout}>
          <button type="submit" className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-[var(--color-muted)] hover:bg-[var(--color-border)] hover:text-[var(--color-foreground)] transition-colors">
            <LogOut size={18} strokeWidth={1.8} />
            Keluar
          </button>
        </form>
      </div>
    </aside>
  )
}
