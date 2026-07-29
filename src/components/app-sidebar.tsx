"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  CalendarDays,
  LayoutList,
  Users,
  Receipt,
  BarChart3,
  MessageCircle,
  Settings,
  ShieldCheck,
  Pill,
  FileHeart,
  LogOut,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { CommandPaletteTrigger } from "@/components/command-palette"
import { ThemeToggle } from "@/components/theme-toggle"
import { signOut } from "@/actions/auth"

/** Clinic logo tile, falling back to the ClinicFlow brand mark. */
function ClinicMark({ logo, name, size }: { logo: string | null; name: string; size: "sm" | "md" }) {
  const box = size === "md" ? "h-8 w-8 rounded-lg" : "h-7 w-7 rounded-md text-sm"
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={logo ?? "/brand/mark-tile.png"}
      alt={name}
      className={cn("shrink-0 object-cover", box, logo ? "bg-sidebar-primary" : "bg-transparent")}
    />
  )
}

const NAV = [
  { href: "/today", label: "Today", icon: LayoutList },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/patients", label: "Patients", icon: Users },
  { href: "/billing", label: "Billing", icon: Receipt },
  { href: "/pharmacy", label: "Pharmacy", icon: Pill },
  { href: "/insurance", label: "Insurance", icon: FileHeart },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/messages", label: "Messages", icon: MessageCircle },
  { href: "/settings", label: "Settings", icon: Settings, doctorOnly: true },
]

export function AppSidebar({
  clinicName,
  doctorName,
  role,
  logo = null,
  isAdmin = false,
}: {
  clinicName: string
  doctorName: string
  role: "doctor" | "staff"
  logo?: string | null
  isAdmin?: boolean
}) {
  const pathname = usePathname()

  const nav = (
    <nav className="flex flex-1 flex-col gap-1 p-3">
      {/* Search sits above navigation, not inside it, because it is not a
          destination — it is the way to reach every destination *and* every
          patient. Shaped like the input it stands in for so it reads as
          "type here", with the shortcut printed on it so ⌘K gets learned. */}
      <CommandPaletteTrigger
        className={cn(
          "mb-2 flex w-full items-center gap-2 rounded-lg border border-sidebar-border/70 bg-black/20 px-2.5 py-2",
          "text-sm text-sidebar-foreground/55 transition-colors",
          "hover:border-sidebar-border hover:bg-black/30 hover:text-sidebar-foreground/80",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
        )}
      />

      {NAV.filter((item) => role === "doctor" || !item.doctorOnly).map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(href + "/")
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group/nav relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium",
              "transition-[color,background-color] duration-150",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
              active
                ? // A paper chip on the indigo cover — like a bookmark in a ledger.
                  "bg-sidebar-primary text-sidebar-primary-foreground"
                : "text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            )}
          >
            {/* The active marker is a rail bleeding off the sidebar's left
                edge, not only the chip. Nine chips of the same shape are hard
                to scan at a glance; one thing touching the edge of the panel
                is not, and it survives being seen out of the corner of an eye
                mid-consultation. */}
            <span
              aria-hidden
              className={cn(
                "absolute top-1/2 -left-3 h-5 w-1 -translate-y-1/2 rounded-r-full bg-sidebar-primary",
                "transition-opacity duration-150",
                active ? "opacity-100" : "opacity-0",
              )}
            />
            <Icon className="size-4" />
            {label}
          </Link>
        )
      })}

      {isAdmin && (
        <Link
          href="/admin"
          className={cn(
            "mt-2 flex items-center gap-3 rounded-md border border-sidebar-border/60 px-3 py-2 text-sm font-medium transition-colors",
            "text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
          )}
        >
          <ShieldCheck className="size-4" />
          Operator console
        </Link>
      )}
    </nav>
  )

  const header = (
    <div className="flex items-center gap-2 border-b border-sidebar-border px-4 py-4">
      <ClinicMark logo={logo} name={clinicName} size="md" />
      <div className="min-w-0">
        <p className="truncate font-heading text-sm font-semibold">{clinicName}</p>
        <p className="truncate text-xs text-sidebar-foreground/60">{doctorName}</p>
      </div>
    </div>
  )

  const footer = (
    <div className="space-y-2 border-t border-sidebar-border p-3">
      <ThemeToggle />
      {/* Ghost hover defaults to bg-muted (a light tint) — override, or it
          flashes pale on the dark cover. */}
      <form action={signOut}>
        <Button
          type="submit"
          variant="ghost"
          size="sm"
          className="w-full justify-start text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
          <LogOut className="size-4" />
          Sign out
        </Button>
      </form>
    </div>
  )

  return (
    <>
      {/* Mobile top bar — clinic identity plus search; the rest of the
          navigation lives in the bottom tab bar (see MobileTabbar). Search
          belongs up here rather than down there because it is the one action
          that is about *finding* rather than *going*, and because the tab bar
          has no room left. */}
      <div className="nm-dark-surface flex items-center gap-2 bg-sidebar px-4 py-3 text-sidebar-foreground md:hidden">
        <ClinicMark logo={logo} name={clinicName} size="sm" />
        <span className="truncate font-heading text-sm font-semibold">{clinicName}</span>
        <CommandPaletteTrigger
          compact
          className={cn(
            "ml-auto flex size-9 shrink-0 items-center justify-center rounded-full",
            "border border-sidebar-border/70 bg-black/20 text-sidebar-foreground/70",
            "transition-colors active:bg-black/35",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
          )}
        />
      </div>

      {/* Desktop sidebar */}
      {/* The colour junction against the paper content is the border. */}
      <aside className="nm-dark-surface hidden w-60 shrink-0 flex-col bg-sidebar text-sidebar-foreground md:flex">
        {header}
        {nav}
        {footer}
      </aside>
    </>
  )
}
