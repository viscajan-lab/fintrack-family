"use client"

import { usePathname } from "next/navigation"
import { NavLink } from "./NavLink"
import type { SubTab } from "./tabs"

// Re-export data & helper tab (non-client) agar import lama
// `from "@/components/layout/SubTabs"` tetap jalan.
export { ANALISIS_TABS, PENGATURAN_TABS, pengaturanTabs } from "./tabs"
export type { SubTab } from "./tabs"

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
            <NavLink
              key={href}
              href={href}
              active={active}
              className="px-3.5 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors flex items-center gap-1.5"
              activeClassName="border-[var(--color-brand-500)] text-[var(--color-foreground)]"
              idleClassName="border-transparent text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
            >
              {label}
            </NavLink>
          )
        })}
      </nav>
    </div>
  )
}
