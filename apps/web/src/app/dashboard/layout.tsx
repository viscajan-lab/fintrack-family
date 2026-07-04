import { Sidebar } from "@/components/layout/Sidebar"
import { StorageContextProvider } from "@/lib/storage/context"

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <StorageContextProvider>
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </StorageContextProvider>
  )
}
