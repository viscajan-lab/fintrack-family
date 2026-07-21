/**
 * Skeleton loading generik untuk transisi antar-halaman dashboard.
 * Dirender otomatis oleh Next (loading.tsx) selama Server Component
 * halaman tujuan masih fetch data — memberi feedback INSTAN saat navigasi
 * sehingga klik menu terasa langsung "jalan", bukan diam membeku.
 */
export function PageSkeleton() {
  return (
    <div className="p-6 space-y-6 animate-pulse" aria-busy="true" aria-label="Memuat halaman">
      {/* Header */}
      <div className="space-y-2">
        <div className="h-7 w-48 rounded-md bg-[var(--color-border)]" />
        <div className="h-4 w-72 rounded bg-[var(--color-border)]/60" />
      </div>

      {/* Baris kartu */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]" />
        ))}
      </div>

      {/* Blok konten besar */}
      <div className="h-64 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]" />

      {/* Baris list */}
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-12 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]" />
        ))}
      </div>
    </div>
  )
}
