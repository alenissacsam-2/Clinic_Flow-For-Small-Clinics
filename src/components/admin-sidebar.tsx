"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, Building2, ArrowLeft, Menu, X } from "lucide-react"
import { useState } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { signOut } from "@/actions/auth"

const NAV = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/admin/clinics", label: "Clinics", icon: Building2 },
]

export function AdminSidebar({ email }: { email: string }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  const nav = (
    <nav className="flex flex-1 flex-col gap-1 p-3">
      {NAV.map(({ href, label, icon: Icon, exact }) => {
        const active = exact ? pathname === href : pathname === href || pathname.startsWith(href + "/")
        return (
          <Link
            key={href}
            href={href}
            onClick={() => setOpen(false)}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
              active
                ? "bg-sidebar-primary text-sidebar-primary-foreground"
                : "text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            )}
          >
            <Icon className="size-4" />
            {label}
          </Link>
        )
      })}

      <Link
        href="/today"
        onClick={() => setOpen(false)}
        className={cn(
          "mt-2 flex items-center gap-3 rounded-md border border-sidebar-border/60 px-3 py-2 text-sm font-medium transition-colors",
          "text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
        )}
      >
        <ArrowLeft className="size-4" />
        Back to app
      </Link>
    </nav>
  )

  const header = (
    <div className="flex items-center gap-2 border-b border-sidebar-border px-4 py-4">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/mark-tile.png" alt="" className="h-8 w-8 shrink-0 rounded-lg object-cover" />
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 truncate font-heading text-sm font-semibold">
          ClinicFlow
          <span className="rounded bg-sidebar-accent px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-sidebar-accent-foreground">
            Operator
          </span>
        </p>
        <p className="truncate text-xs text-sidebar-foreground/60">{email}</p>
      </div>
    </div>
  )

  const footer = (
    <form action={signOut} className="border-t border-sidebar-border p-3">
      <Button
        type="submit"
        variant="ghost"
        size="sm"
        className="w-full justify-start text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
      >
        Sign out
      </Button>
    </form>
  )

  return (
    <>
      {/* Mobile top bar */}
      <div className="nm-dark-surface flex items-center justify-between bg-sidebar px-4 py-3 text-sidebar-foreground md:hidden">
        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/mark-tile.png" alt="" className="h-7 w-7 rounded-md object-cover" />
          <span className="font-heading text-sm font-semibold">ClinicFlow · Operator</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setOpen((o) => !o)}
          className="text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </Button>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="nm-dark-surface absolute left-0 top-0 flex h-full w-64 flex-col bg-sidebar text-sidebar-foreground shadow-lg">
            {header}
            {nav}
            {footer}
          </aside>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="nm-dark-surface hidden w-60 shrink-0 flex-col bg-sidebar text-sidebar-foreground md:flex">
        {header}
        {nav}
        {footer}
      </aside>
    </>
  )
}
