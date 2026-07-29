"use client"

import { useTheme } from "next-themes"
import { Monitor, Moon, Sun } from "lucide-react"

import { useHydrated } from "@/lib/use-hydrated"
import { cn } from "@/lib/utils"

const OPTIONS = [
  { value: "light", label: "Light", icon: Sun },
  { value: "system", label: "System", icon: Monitor },
  { value: "dark", label: "Dark", icon: Moon },
] as const

/**
 * A three-way segmented control, not a two-way switch.
 *
 * A bare light/dark toggle cannot express "follow the machine", so the moment
 * a visitor touches it they are opted out of their own OS preference forever
 * with no way back. Three segments keep "System" reachable, and it is a real
 * choice here: a clinic screen that dims with the rest of the desktop at 7pm
 * is the behaviour most people actually want.
 *
 * ── The hydration gate ────────────────────────────────────────────────────
 * The resolved theme is a client-only fact — the server cannot know what is in
 * `localStorage` or what the OS prefers. Rendering the selected state before
 * hydration would therefore mismatch for anyone whose stored theme is not the
 * default, so the first paint renders every segment unselected and the
 * highlight arrives a tick later. The buttons are live either way — only the
 * *marker* waits.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme()
  const hydrated = useHydrated()

  return (
    <div
      className={cn(
        // Recessed track holding raised keys — the same grammar as the dose
        // chips in the visit editor and the slot chips on the booking page.
        "flex items-center gap-0.5 rounded-full border border-sidebar-border/60 bg-black/20 p-0.5",
        className,
      )}
      role="group"
      aria-label="Colour theme"
    >
      {OPTIONS.map(({ value, label, icon: Icon }) => {
        const on = hydrated && theme === value
        return (
          <button
            key={value}
            type="button"
            onClick={() => setTheme(value)}
            aria-pressed={on}
            title={label}
            className={cn(
              "flex flex-1 items-center justify-center rounded-full py-1.5 transition-colors duration-150",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
              on
                ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-nm-raised"
                : "text-sidebar-foreground/55 hover:text-sidebar-foreground",
            )}
          >
            <Icon className="size-3.5" />
            <span className="sr-only">{label}</span>
          </button>
        )
      })}
    </div>
  )
}
