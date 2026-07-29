"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import {
  BarChart3,
  CalendarDays,
  FileHeart,
  LayoutList,
  LogOut,
  MessageCircle,
  Monitor,
  Moon,
  Pill,
  Receipt,
  Settings as SettingsIcon,
  ShieldCheck,
  Sun,
  Tv,
  UserRound,
  Users,
} from "lucide-react"

import { signOut } from "@/actions/auth"
import { createClient } from "@/lib/supabase/client"
import { formatPhoneDisplay } from "@/lib/format"
import { initials } from "@/lib/name"
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command"

/**
 * ⌘K — one keystroke to anywhere in the clinic.
 *
 * ── Why a product like this needs one ─────────────────────────────────────
 * A solo doctor uses this app between patients, with someone sitting opposite
 * them. The nine-item sidebar is fine for browsing and useless for that: it
 * cannot search, so "pull up Mrs Rao" is Patients → wait → type → scan →
 * click, four screens deep, while a consultation is paused. This collapses it
 * to ⌘K, three letters, Enter — and the same key covers every destination, so
 * the muscle memory is one shortcut instead of nine positions.
 *
 * ── The event bus, and why there is no context provider ───────────────────
 * The palette is mounted once in the app layout, but it has to be openable
 * from the desktop sidebar *and* the mobile tab bar — two components that share
 * no parent below the layout. A React context would work and would mean a
 * provider wrapping the tree, re-rendering it on every open. A DOM event costs
 * nothing, crosses any tree shape, and keeps the trigger buttons ignorant of
 * the palette entirely: they announce intent, this listens.
 */
export const OPEN_EVENT = "clinicflow:command-palette"

/** Ask the palette to open, from anywhere on the page. */
export function openCommandPalette() {
  window.dispatchEvent(new Event(OPEN_EVENT))
}

type Patient = { id: string; full_name: string; phone: string }

type Destination = {
  href: string
  label: string
  icon: typeof LayoutList
  /** Extra words that should match this row — never rendered. */
  keywords?: string
  doctorOnly?: boolean
  adminOnly?: boolean
}

const DESTINATIONS: Destination[] = [
  { href: "/today", label: "Today's queue", icon: LayoutList, keywords: "queue waiting walk-in" },
  { href: "/calendar", label: "Calendar", icon: CalendarDays, keywords: "appointments book slots" },
  { href: "/patients", label: "Patients", icon: Users, keywords: "records people" },
  { href: "/billing", label: "Billing", icon: Receipt, keywords: "invoices payments money" },
  { href: "/pharmacy", label: "Pharmacy", icon: Pill, keywords: "stock inventory batches expiry" },
  { href: "/insurance", label: "Insurance", icon: FileHeart, keywords: "claims tpa payers" },
  { href: "/reports", label: "Reports", icon: BarChart3, keywords: "revenue analytics collections" },
  { href: "/messages", label: "Messages", icon: MessageCircle, keywords: "whatsapp reminders sent" },
  {
    href: "/settings",
    label: "Settings",
    icon: SettingsIcon,
    keywords: "clinic hours fee upi staff logo",
    doctorOnly: true,
  },
  {
    href: "/admin",
    label: "Operator console",
    icon: ShieldCheck,
    keywords: "platform admin clinics",
    adminOnly: true,
  },
]

/** Case-insensitive substring match over the label and its hidden keywords. */
function matches(term: string, label: string, keywords = "") {
  if (!term) return true
  return `${label} ${keywords}`.toLowerCase().includes(term.toLowerCase())
}

export function CommandPalette({
  role,
  isAdmin = false,
  slug,
}: {
  role: "doctor" | "staff"
  isAdmin?: boolean
  slug: string
}) {
  const router = useRouter()
  const { setTheme } = useTheme()
  const [, startTransition] = useTransition()

  const [open, setOpen] = useState(false)
  const [term, setTerm] = useState("")
  const [patients, setPatients] = useState<Patient[]>([])
  const [searching, setSearching] = useState(false)

  // ⌘K / Ctrl+K anywhere, plus the event the trigger buttons dispatch.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== "k" || !(e.metaKey || e.ctrlKey)) return
      // Chrome binds Ctrl+K to the address bar and Firefox to search; both are
      // preventable, and a palette that only *sometimes* opens is worse than
      // one that never does.
      e.preventDefault()
      setOpen((v) => !v)
    }
    const onOpen = () => setOpen(true)
    window.addEventListener("keydown", onKey)
    window.addEventListener(OPEN_EVENT, onOpen)
    return () => {
      window.removeEventListener("keydown", onKey)
      window.removeEventListener(OPEN_EVENT, onOpen)
    }
  }, [])

  // Patient search. Debounced because this fires per keystroke against a real
  // database, and 180ms is comfortably under the point where typing feels
  // laggy while still collapsing a burst of characters into one query.
  //
  // With an empty box it deliberately still runs, returning the most recently
  // added patients — an empty palette that says "type to search" wastes the
  // most common case, which is the person registered ten minutes ago.
  useEffect(() => {
    if (!open) return
    let cancelled = false
    const t = setTimeout(async () => {
      setSearching(true)
      const supabase = createClient()
      let q = supabase
        .from("patients")
        .select("id, full_name, phone")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(6)
      const needle = term.trim()
      if (needle) q = q.or(`full_name.ilike.%${needle}%,phone.ilike.%${needle}%`)
      const { data } = await q
      if (cancelled) return
      setPatients(data ?? [])
      setSearching(false)
    }, 180)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [term, open])

  function go(href: string) {
    setOpen(false)
    setTerm("")
    router.push(href)
  }

  const destinations = DESTINATIONS.filter(
    (d) =>
      (!d.doctorOnly || role === "doctor") &&
      (!d.adminOnly || isAdmin) &&
      matches(term, d.label, d.keywords),
  )

  const links = [
    {
      href: `/book/${slug}`,
      label: "Open your booking page",
      icon: UserRound,
      keywords: "share link patients online",
    },
    {
      href: `/display/${slug}`,
      label: "Open waiting-room display",
      icon: Tv,
      keywords: "screen token board",
    },
  ].filter((l) => matches(term, l.label, l.keywords))

  const themes = [
    { value: "light", label: "Light theme", icon: Sun },
    { value: "system", label: "Match system theme", icon: Monitor },
    { value: "dark", label: "Dark theme", icon: Moon },
  ].filter((t) => matches(term, t.label, "appearance colour color dark light"))

  const showSignOut = matches(term, "Sign out", "logout leave exit")
  const nothing =
    !destinations.length && !links.length && !themes.length && !patients.length && !showSignOut

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="Command palette"
      description="Search patients, jump to a page, or run a quick action."
      // `CommandDialog`'s own default is `top-1/3` — a fine position for a
      // palette invoked by typing on a keyboard, but this app's other primary
      // entry point is a thumb on a phone (the compact trigger in the mobile
      // top bar), and a launcher opened by touch reads better anchored near
      // the thumb than pinned near the status bar. `bottom-*` + `translate-y-0`
      // overrides the vertical half of `CommandDialog`'s default (tailwind-merge
      // resolves the conflicting utility, last one wins); the horizontal
      // centering (`left-1/2 -translate-x-1/2`) is inherited untouched from
      // `DialogContent` and never needs to move.
      className="sm:max-w-xl top-auto bottom-6 translate-y-0 sm:bottom-[8vh]"
    >
      {/* `shouldFilter={false}` — the patient rows are already filtered by the
          database and re-filtering them client-side against the same string
          would drop legitimate phone-number hits (cmdk scores on the rendered
          label, which shows the name). Everything static is filtered by
          `matches()` instead, so one predictable rule covers both halves. */}
      <Command shouldFilter={false} loop>
        <CommandInput
          placeholder="Search patients, or jump to…"
          value={term}
          onValueChange={setTerm}
        />
        {/* `h-*`, not `max-h-*`. The dialog is bottom-anchored (see the
            `className` above) and sizes to its content — so a `max-h` let the
            box shrink every time a search narrowed the results, and because
            the anchor point is the *bottom*, a shorter box means the whole
            thing (search input included) slides down the screen mid-type.
            A fixed height keeps the box, and the input inside it, planted:
            fewer results just means more empty space below them, not a
            smaller box. */}
        <CommandList className="h-[min(28rem,60vh)] max-h-none">
          {nothing && (
            <CommandEmpty>
              {searching ? "Searching…" : `Nothing matches “${term}”.`}
            </CommandEmpty>
          )}

          {patients.length > 0 && (
            <CommandGroup heading={term.trim() ? "Patients" : "Recently added"}>
              {patients.map((p) => (
                <CommandItem key={p.id} value={`patient-${p.id}`} onSelect={() => go(`/patients/${p.id}`)}>
                  {/* Initials rather than an icon: in a list of six people the
                      avatar is the thing the eye lands on, and every row
                      carrying the same generic glyph would defeat that. */}
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[0.625rem] font-semibold text-primary">
                    {initials(p.full_name)}
                  </span>
                  <span className="truncate">{p.full_name}</span>
                  <span className="ml-auto shrink-0 text-xs tabular-nums text-muted-foreground">
                    {formatPhoneDisplay(p.phone)}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {destinations.length > 0 && (
            <>
              {patients.length > 0 && <CommandSeparator />}
              <CommandGroup heading="Go to">
                {destinations.map(({ href, label, icon: Icon }) => (
                  <CommandItem key={href} value={href} onSelect={() => go(href)}>
                    <Icon className="text-muted-foreground" />
                    <span>{label}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}

          {links.length > 0 && (
            <>
              <CommandSeparator />
              <CommandGroup heading="Share">
                {links.map(({ href, label, icon: Icon }) => (
                  <CommandItem key={href} value={href} onSelect={() => go(href)}>
                    <Icon className="text-muted-foreground" />
                    <span>{label}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}

          {(themes.length > 0 || showSignOut) && (
            <>
              <CommandSeparator />
              <CommandGroup heading="Preferences">
                {themes.map(({ value, label, icon: Icon }) => (
                  <CommandItem
                    key={value}
                    value={`theme-${value}`}
                    onSelect={() => {
                      setTheme(value)
                      setOpen(false)
                    }}
                  >
                    <Icon className="text-muted-foreground" />
                    <span>{label}</span>
                  </CommandItem>
                ))}
                {showSignOut && (
                  <CommandItem
                    value="sign-out"
                    onSelect={() => {
                      setOpen(false)
                      // A server action, called straight from the handler. It
                      // ends in `redirect("/login")`, so there is nothing to
                      // await and nothing to route afterwards.
                      startTransition(() => {
                        void signOut()
                      })
                    }}
                  >
                    <LogOut className="text-muted-foreground" />
                    <span>Sign out</span>
                  </CommandItem>
                )}
              </CommandGroup>
            </>
          )}
        </CommandList>

        {/* A permanent legend. The palette's whole value is that it becomes
            reflex, and a shortcut nobody can see is a shortcut nobody learns. */}
        <div className="flex items-center justify-between border-t border-edge/15 px-3 py-2 text-[0.6875rem] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd>
            to navigate
          </span>
          <span className="flex items-center gap-1.5">
            <Kbd>↵</Kbd>
            to open
            <span className="mx-1 opacity-40">·</span>
            <Kbd>esc</Kbd>
            to close
          </span>
        </div>
      </Command>
    </CommandDialog>
  )
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex h-4 min-w-4 items-center justify-center rounded border border-edge/25 bg-muted px-1 font-sans text-[0.625rem] leading-none">
      {children}
    </kbd>
  )
}

/**
 * The visible half of the shortcut — a search-box-shaped button that opens the
 * palette. Discoverability is the entire job: ⌘K is invisible, and a product
 * whose best feature is only reachable by people who already guessed it has
 * shipped the feature to nobody.
 */
export function CommandPaletteTrigger({
  className,
  /** Icon only — for the phone bar, where there is no keyboard to hint at. */
  compact = false,
}: {
  className?: string
  compact?: boolean
}) {
  // `userAgent`, not the deprecated `navigator.platform`. On the server this is
  // simply undefined and the button renders "Ctrl K"; the hint is corrected on
  // the client, which is what `suppressHydrationWarning` below covers.
  const hasMeta = typeof navigator !== "undefined" && /mac|iphone|ipad/i.test(navigator.userAgent)
  return (
    <button
      type="button"
      onClick={openCommandPalette}
      className={className}
      aria-label="Search patients and pages"
    >
      <SearchGlyph />
      {!compact && (
        <>
          <span className="flex-1 text-left">Search…</span>
          <CommandShortcut className="ml-0 text-current opacity-70" suppressHydrationWarning>
            {hasMeta ? "⌘K" : "Ctrl K"}
          </CommandShortcut>
        </>
      )}
    </button>
  )
}

function SearchGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="size-4 shrink-0" aria-hidden>
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
      <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}
