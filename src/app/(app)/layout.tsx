import { requireClinic, getMembership, logoUrl } from "@/lib/clinic"
import { isPlatformAdmin } from "@/lib/admin"
import { AppSidebar } from "@/components/app-sidebar"
import { CommandPalette } from "@/components/command-palette"
import { MobileTabbar } from "@/components/mobile-tabbar"

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const clinic = await requireClinic()
  const membership = await getMembership()
  const isAdmin = await isPlatformAdmin()
  const role = membership?.role ?? "staff"

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <AppSidebar
        clinicName={clinic.name}
        doctorName={clinic.doctor_name}
        role={role}
        logo={logoUrl(clinic)}
        isAdmin={isAdmin}
      />
      <main className="flex-1 overflow-x-hidden bg-background">
        {/* pb-20 clears the fixed mobile tab bar; removed at md. */}
        <div className="mx-auto w-full max-w-6xl p-4 pb-20 md:p-8 md:pb-8">{children}</div>
      </main>
      <MobileTabbar role={role} isAdmin={isAdmin} />

      {/* Mounted once for the whole app, at the layout rather than per page, so
          ⌘K works identically on every route and the listener is installed
          exactly once. */}
      <CommandPalette role={role} isAdmin={isAdmin} slug={clinic.slug} />
    </div>
  )
}
