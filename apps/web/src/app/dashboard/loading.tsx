import { PageSkeleton } from "@/components/ui/PageSkeleton"

// Dirender instan oleh Next saat berpindah ke halaman mana pun di /dashboard,
// selama Server Component tujuan masih mengambil data. Menghilangkan kesan
// "klik menu tapi tidak pindah".
export default function DashboardLoading() {
  return <PageSkeleton />
}
