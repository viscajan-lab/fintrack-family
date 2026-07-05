"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  ArrowLeftRight,
  PieChart,
  Settings,
  Wallet,
  Link2,
  LogOut,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { logout } from "@/app/auth/actions"

const NAV = [
  { href: "/dashboard",              label: "Beranda",    icon: LayoutDashboard },
  { href: "/dashboard/transactions", label: "Transaksi",  icon: ArrowLeftRight },
  { href: "/dashboard/budget",       label: "Budget",     icon: PieChart },
  { href: "/dashboard/reports",      label: "Laporan",    icon: Wallet },
  { href: "/dashboard/link",         label: "Hubungkan",  icon: Link2 },
  { href: "/dashboard/settings",     label: "Pengaturan", icon: Settings },
]

export function Sidebar() {
  const path = usePathname()

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
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = path === href || (href !== "/dashboard" && path.startsWith(href))
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
