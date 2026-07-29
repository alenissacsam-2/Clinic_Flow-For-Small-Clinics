import { requirePlatformAdmin } from "@/lib/admin"
import { createClient } from "@/lib/supabase/server"
import { AdminSidebar } from "@/components/admin-sidebar"

export const metadata = { title: "Operator", robots: { index: false } }

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requirePlatformAdmin()
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <AdminSidebar email={user?.email ?? ""} />
      <main className="flex-1 overflow-x-hidden bg-background">
        <div className="mx-auto w-full max-w-6xl p-4 md:p-8">{children}</div>
      </main>
    </div>
  )
}
