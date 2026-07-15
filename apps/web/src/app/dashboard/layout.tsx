import { Sidebar } from "@/components/layout/Sidebar"
import { StorageContextProvider } from "@/lib/storage/context"
import { getMyRole } from "@/lib/data/queries"

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const role = await getMyRole()
  return (
    <StorageContextProvider>
      <div className="flex min-h-screen">
        <Sidebar role={role} />
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </StorageContextProvider>
  )
}
