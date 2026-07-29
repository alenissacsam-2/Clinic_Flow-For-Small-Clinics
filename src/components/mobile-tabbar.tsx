"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutList,
  CalendarDays,
  Users,
  Receipt,
  Menu,
  BarChart3,
  MessageCircle,
  Settings as SettingsIcon,
  ShieldCheck,
  LogOut,
  Pill,
  FileHeart,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { ThemeToggle } from "@/components/theme-toggle"
import { signOut } from "@/actions/auth"

const TABS = [
  { href: "/today", label: "Today", icon: LayoutList },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/patients", label: "Patients", icon: Users },
  { href: "/billing", label: "Billing", icon: Receipt },
]

// Everything reachable from the "More" sheet — so the bar highlights More when
// you're on one of these.
const MORE_PATHS = ["/reports", "/messages", "/settings", "/admin"]

/**
 * Bottom tab bar for phones — one-tap access to the four core screens, with a
 * "More" sheet for the rest. Desktop keeps the full sidebar (`md:hidden` here).
 */
export function MobileTabbar({
  role,
  isAdmin = false,
}: {
  role: "doctor" | "staff"
  isAdmin?: boolean
}) {
  const pathname = usePathname()
  const [moreOpen, setMoreOpen] = useState(false)

  const active = (href: string) => pathname === href || pathname.startsWith(href + "/")
  const moreActive = MORE_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))

  const moreItems = [
    { href: "/pharmacy", label: "Pharmacy", icon: Pill, show: true },
    { href: "/insurance", label: "Insurance", icon: FileHeart, show: true },
    { href: "/reports", label: "Reports", icon: BarChart3, show: true },
    { href: "/messages", label: "Messages", icon: MessageCircle, show: true },
    { href: "/settings", label: "Settings", icon: SettingsIcon, show: role === "doctor" },
    { href: "/admin", label: "Operator console", icon: ShieldCheck, show: isAdmin },
  ].filter((i) => i.show)

  const tabClass = (on: boolean) =>
    cn(
      "flex flex-1 flex-col items-center gap-1 py-2 text-[11px] font-medium transition-colors",
      on ? "text-sidebar-primary" : "text-sidebar-foreground/60",
    )

  return (
    <>
      <nav className="nm-dark-surface fixed inset-x-0 bottom-0 z-30 flex border-t border-sidebar-border bg-sidebar pb-[env(safe-area-inset-bottom)] text-sidebar-foreground md:hidden">
        {TABS.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} className={tabClass(active(href))}>
            <Icon className="size-5" />
            {label}
          </Link>
        ))}
        <button type="button" onClick={() => setMoreOpen(true)} className={tabClass(moreActive)}>
          <Menu className="size-5" />
          More
        </button>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="gap-0 rounded-t-xl pb-[env(safe-area-inset-bottom)]">
          <SheetTitle className="p-4 pb-2">Menu</SheetTitle>
          {/* The theme control is scoped to the sheet's own dark surface —
              `ThemeToggle` styles itself against `--sidebar-*`, and the sheet
              is a light popover, so it needs a dark plane to sit on rather
              than floating unstyled on cream. */}
          <div className="nm-dark-surface mx-2 mb-1 rounded-lg bg-sidebar p-2 text-sidebar-foreground">
            <ThemeToggle />
          </div>
          <div className="flex flex-col p-2">
            {moreItems.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setMoreOpen(false)}
                className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors hover:bg-accent"
              >
                <Icon className="size-4 text-muted-foreground" />
                {label}
              </Link>
            ))}
            <form action={signOut} className="mt-1 border-t pt-1">
              <Button
                type="submit"
                variant="ghost"
                size="sm"
                className="h-auto w-full justify-start gap-3 px-3 py-2.5 font-medium text-muted-foreground"
              >
                <LogOut className="size-4" />
                Sign out
              </Button>
            </form>
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
