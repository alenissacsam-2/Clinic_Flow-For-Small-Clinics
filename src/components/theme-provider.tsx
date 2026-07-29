"use client"

import { ThemeProvider as NextThemes } from "next-themes"

/**
 * The app's theme controller.
 *
 * ── Why this exists at all ────────────────────────────────────────────────
 * `globals.css` has carried a fully authored, contrast-audited `.dark` block
 * since the neumorphic rebuild — every token, both lamps, the whole chart ramp
 * — and until now **nothing could ever set that class**. `next-themes` was in
 * `package.json` but only `ui/sonner.tsx` imported it, calling `useTheme()`
 * with no provider above it, which silently returns the default forever. A
 * complete dark theme was shipped and unreachable.
 *
 * ── Why the class goes on `<html>` and not on the app shell ───────────────
 * Scoping the class to `(app)/layout.tsx` looks tidier — it would leave the
 * marketing page untouched by construction — and it is wrong. Every dialog,
 * dropdown, popover and toast in this app renders through a **portal to
 * `document.body`**, which sits outside any wrapper inside the layout. Themed
 * subtree, unthemed overlays: a dark queue with a bone-white dropdown on top
 * of it. The theme has to live at or above `<body>`, so it lives on `<html>`.
 *
 * ── Why `defaultTheme="light"` rather than `"system"` ─────────────────────
 * A large share of visitors have a dark OS preference, and `/` is a marketing
 * page whose whole composition — light product cards floating over a dark
 * film, bone bands alternating with indigo ones — was art-directed in light.
 * Defaulting to `system` would hand roughly half of all first-time visitors a
 * version of the pitch nobody designed. Dark is opt-in: a doctor turns it on
 * from the sidebar or ⌘K, inside the product, where it earns its keep on a
 * late clinic evening. `enableSystem` stays on so "System" is still offered as
 * an explicit choice for anyone who wants it.
 *
 * `disableTransitionOnChange` kills the ~200ms of every colour transition on
 * the page firing at once when the class flips, which reads as a smear rather
 * than a switch.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemes
      attribute="class"
      defaultTheme="light"
      enableSystem
      disableTransitionOnChange
      storageKey="clinicflow-theme"
    >
      {children}
    </NextThemes>
  )
}
