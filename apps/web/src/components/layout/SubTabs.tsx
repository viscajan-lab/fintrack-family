"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

export type SubTab = { href: string; label: string }

/**
 * Baris tab sub-menu untuk mengelompokkan halaman berkerabat
 * (mis. Analisis: Laporan/Tren/Insight/Riwayat, atau Pengaturan:
 * Umum/Kategori/Anggota/Hubungkan) tanpa mengubah route aslinya.
 */
export function SubTabs({ tabs }: { tabs: SubTab[] }) {
  const path = usePathname()

  return (
    <div className="border-b border-[var(--color-border)] -mt-1">
      <nav className="flex gap-1 overflow-x-auto">
        {tabs.map(({ href, label }) => {
          const active = path === href || path.startsWith(href + "/")
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "px-3.5 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors",
                active
                  ? "border-[var(--color-brand-500)] text-[var(--color-foreground)]"
                  : "border-transparent text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
              )}
            >
              {label}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}

/** Preset tab untuk grup Analisis. */
export const ANALISIS_TABS: SubTab[] = [
  { href: "/dashboard/reports", label: "Laporan" },
  { href: "/dashboard/trends",  label: "Tren" },
  { href: "/dashboard/insight", label: "Insight" },
  { href: "/dashboard/riwayat", label: "Riwayat" },
]

/** Preset tab untuk grup Pengaturan. */
export const PENGATURAN_TABS: SubTab[] = [
  { href: "/dashboard/settings",   label: "Umum" },
  { href: "/dashboard/categories", label: "Kategori" },
  { href: "/dashboard/members",    label: "Anggota" },
  { href: "/dashboard/link",       label: "Hubungkan" },
]
