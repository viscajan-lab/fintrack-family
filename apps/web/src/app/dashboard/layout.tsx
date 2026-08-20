import { Sidebar } from "@/components/layout/Sidebar"
import { StorageContextProvider } from "@/lib/storage/context"
import { getMyRole, getNotifications } from "@/lib/data/queries"

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [role, notifications] = await Promise.all([getMyRole(), getNotifications()])
  return (
    <StorageContextProvider>
      <div className="flex min-h-screen">
        <Sidebar role={role} notifications={notifications} />
        <main className="flex-1 overflow-y-auto pt-14 md:pt-0">
          {children}
        </main>
      </div>
    </StorageContextProvider>
  )
}
