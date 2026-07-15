import { redirect } from "next/navigation"
import { Sidebar } from "@/components/layout/Sidebar"
import { StorageContextProvider } from "@/lib/storage/context"
import { getMyRole } from "@/lib/data/queries"

// Panel /admin hidup di luar grup /dashboard, jadi Sidebar dipasang ulang di sini
// (konsisten dgn dashboard). Gate keras: hanya super_admin; selainnya lempar balik.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const role = await getMyRole()
  if (role !== "super_admin") redirect("/dashboard")

  return (
    <StorageContextProvider>
      <div className="flex min-h-screen">
        <Sidebar role={role} />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </StorageContextProvider>
  )
}
