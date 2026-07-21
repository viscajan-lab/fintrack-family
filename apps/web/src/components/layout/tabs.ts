// Data & helper tab sub-menu. SENGAJA tanpa "use client": dipakai oleh server
// components (settings/categories/members/link page) untuk menghitung tab sesuai
// role. Komponen render-nya (SubTabs) yang client-only ada di ./SubTabs.

export type SubTab = { href: string; label: string }

/** Preset tab untuk grup Analisis. */
export const ANALISIS_TABS: SubTab[] = [
  { href: "/dashboard/reports",  label: "Laporan" },
  { href: "/dashboard/trends",   label: "Tren" },
  { href: "/dashboard/calendar", label: "Kalender" },
  { href: "/dashboard/insight",  label: "Insight" },
  { href: "/dashboard/riwayat",  label: "Riwayat" },
]

/** Preset tab untuk grup Pengaturan. */
export const PENGATURAN_TABS: SubTab[] = [
  { href: "/dashboard/settings",   label: "Umum" },
  { href: "/dashboard/categories", label: "Kategori" },
  { href: "/dashboard/members",    label: "Anggota" },
  { href: "/dashboard/link",       label: "Hubungkan" },
]

/**
 * Tab Pengaturan yang boleh dilihat sesuai role. Member biasa hanya "Umum"
 * (tema/password); Kategori/Anggota/Hubungkan khusus admin & super_admin.
 */
export function pengaturanTabs(role: "super_admin" | "admin" | "member"): SubTab[] {
  if (role === "member") return PENGATURAN_TABS.filter((t) => t.href === "/dashboard/settings")
  return PENGATURAN_TABS
}
