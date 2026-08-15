# ClinicFlow

Clinic & patient management for **solo doctors in India**, with WhatsApp reminders built in.
Appointments, a live queue, EMR-lite visits, digital prescriptions (PDF), billing, a public
booking page, and automated WhatsApp notifications — all in one fast app.

> Built to the spec in [`PLAN.md`](./PLAN.md).

## Stack

- **Next.js 16** (App Router, Server Components + Server Actions), TypeScript, Tailwind v4, shadcn/ui (Base UI)
- **Supabase** — Postgres + RLS, Auth, Storage
- **Meta WhatsApp Cloud API** (direct, no BSP)
- **Vercel** — hosting + Cron
- `@react-pdf/renderer` for prescriptions & receipts, `recharts` for reports, `vitest` for unit tests

## Features

| Area | What it does |
|---|---|
| Patients | Registry with instant search, consent capture, DPDP export/delete |
| Appointments | Day calendar, slot booking with tokens, walk-ins, reschedule/cancel |
| Today queue | Focus card (who's in the room / who's next), a proportional day rail, and a live queue with one-tap status flow |
| Command palette | ⌘K from anywhere — search patients, jump to any screen, switch theme |
| Dark mode | Real light/dark/system, chosen from the sidebar or ⌘K |
| Visits | Vitals + notes, medicine autocomplete, Rx builder, branded PDF |
| Drug safety | Allergy cross-check + drug–drug interaction screening while prescribing — **advisory, never blocking** |
| Coded diagnosis | Optional ICD-10 codes alongside free text — the foundation for FHIR export and claims |
| Pharmacy | Batch-tracked stock, 90/60/30 expiry tiers, FEFO dispensing; stock cannot leave without a bill line |
| Insurance & TPA | Pre-auth → submission → settlement with a full event history, and outstanding by payer |
| Waiting-room display | Public `/display/<slug>` board — token numbers only, per-token wait estimate, live clock, wake lock |
| Offline consults | A visit written with no connection is kept on the device and synced on reconnect |
| Patient languages | Booking, intake, payment and the display board in Hindi, Marathi and Tamil |
| AI dictation | Dictate a note, get structured fields to review — suggestions only, never auto-applied |
| Labs & imaging | Order from the visit, record results, LOINC-coded where certain, high/low flagged from the lab's own range |
| Attachments | Scans, lab reports and photos on a visit or a patient — private bucket, short-lived signed URLs |
| ABHA identity | Optional ABHA number (Verhoeff-checked) + ABHA address on every patient |
| FHIR R4 export | Any patient's record as an ABDM-shaped OPConsultRecord bundle — `/api/patients/<id>/fhir` |
| ABDM consent | Consent requests recorded as artefacts before any record is fetched; gateway client dry-runs until credentials exist |
| Billing | Auto-drafted invoices, payments, receipts + CSV |
| Reports | Period switcher, period-over-period deltas, 7-day moving average, payment mix, arrivals by hour, takings by weekday |
| Public booking | `/book/<slug>` self-service; slots grouped by part of day, stale-slot refresh, add-to-calendar on confirm; **instant** (phone OTP → auto-confirm) or **approve** mode per clinic |
| WhatsApp | Confirmations, 24h/2h reminders, prescriptions, receipts, follow-ups, OTP, intake & payment links |
| Team | Invite a receptionist by email; staff run the clinic, only the doctor edits settings |
| Slot blocking | Block a day/session/slot from the calendar; booked patients are auto-cancelled + notified |
| Pre-visit intake | Confirmed patients get a form link; answers pre-fill the visit and merge onto the record |
| UPI payments | Doctor's UPI QR + `/pay/<token>` page + WhatsApp request; doctor confirms receipt (+ optional UTR) |
| CSV import | Upload → map columns → dedupe by phone → per-row report; DPDP-safe consent default |
| Landing page | Public marketing page at `/` for self-serve signup |
| Link previews | `/book/<slug>` shared on WhatsApp previews as *the clinic* — per-clinic title + generated OG card |
| Clinic branding | Upload a logo in Settings — appears on the booking page, prescriptions and receipts |
| Specialty presets | Onboarding seeds sensible fee/slot defaults per specialty (dentist, pediatrician, …) |
| Operator console | Platform super-admins get `/admin` — every clinic's usage & revenue, WhatsApp health, and pause/unpause |

## Clinical safety (read before touching prescribing code)

Prescribing screens the draft against the patient's recorded allergies and a drug–drug
interaction rule set. Three rules govern this and must not be weakened:

1. **Advisory, never blocking.** Warnings never disable saving or finalising. A prescriber
   overriding a warning is a normal, informed decision; the software's job is to put the
   information in front of them, not to overrule them.
2. **Matching is on active ingredients, never brand names.** `medicines.composition` is the join
   key — that is why prescribing *Augmentin* correctly trips a penicillin allergy. A medicine row
   imported without a composition is silently excluded from screening, so the importer warns when
   the column is missing.
3. **An unchecked drug must never look like a checked one.** Names that can't be resolved to
   ingredients are reported as `unresolved` in the UI, not passed over in silence. The all-clear
   message deliberately says *"no warnings in ClinicFlow's list"* — never *"safe"*.

The engine is pure and unit-tested: [`src/lib/clinical/safety.ts`](./src/lib/clinical/safety.ts)
(+ `tests/unit/safety.test.ts`). Drug classes live in code (`DRUG_CLASSES`) so one interaction rule
covers a whole family via a `class:nsaid`-style token; the rules themselves are data in
`drug_interactions`. **Adding a rule with a new class token requires adding that class to
`DRUG_CLASSES`** or the rule silently never fires — there's a regression test guarding this.

**The seeded medicine list (~850) and interaction rules (~79) are curated and NOT exhaustive**, and
neither is a licensed drug-safety database. Clinics reach full coverage via Settings → Medicines →
Import (CSV, clinic-scoped rows that sort above the shared seed).

> **Instant booking** issues OTPs from a service-role-only RPC, so it needs `SUPABASE_SERVICE_ROLE_KEY`
> set. Without it the booking page falls back to a "call the clinic" message (or use approve mode).
> **UPI payments** are never auto-verified — personal UPI has no status API, so the doctor taps
> "Mark received" once they see the money land.

## Labs, imaging and attachments

**Reference ranges are never ours.** The catalogue (`lab_tests`, ~83 seeded) stores no reference
ranges at all. A range is method-, lab-, age- and sex-specific, so shipping our own would be
inventing a clinical threshold. The clinic types the range off the report the lab issued, and the
high/low flag is then plain arithmetic on the lab's own numbers —
[`src/lib/clinical/lab-result.ts`](./src/lib/clinical/lab-result.ts). No range entered means no
flag; the result still records fine, it is just not interpreted.

The parser refuses anything ambiguous rather than guessing: a range pasted into the value box
(`5.5-6.0`), scientific notation, and a comma that might be a decimal separator (`12,5` — 12.5 in
several locales) all return null and go unflagged. Indian lakh grouping (`1,50,000`, how platelet
counts get reported) *is* understood. Censored values are resolved only when the range settles
them — `<0.01` against a low of 0.4 is low, but `<5` inside 1–10 tells us nothing.

**LOINC only where certain.** 45 of the 83 seeded tests carry a LOINC code. The rest — Widal,
dengue NS1, most radiology — are deliberately `NULL`. A wrong LOINC is worse than none, because it
exports as a confident claim about what was measured. Uncoded tests work normally.

**Attachments** live in the private `visit-files` bucket under `{clinic_id}/{patient_id}/…`, with
member-scoped storage policies including `select` — so uploads and signed URLs work on the
doctor's own session, without `SUPABASE_SERVICE_ROLE_KEY`. Files are read through 5-minute signed
URLs and never public links. Both labs and files may attach to a visit *or* to the patient alone
(an old report brought in), and deleting a visit does not delete the patient's imaging.

## Pharmacy

**Stock cannot leave without a bill line.** That is a `CHECK` constraint on `stock_movements`, not
an app-level rule — a bypass would be silent shrinkage, and noticing shrinkage is the whole reason
a clinic keeps stock records. `dispense_stock` refuses a dispense with no `invoice_item_id`, and
the constraint refuses it again underneath.

**Dispensing is FEFO, and expired batches are never dispensed** however much is left in them —
that is a patient-safety rule, not an inventory preference, which is why
[`allocateFefo`](./src/lib/pharmacy/stock.ts) has to know today's date. Allocation happens in app
code where it is unit-tested; the commit happens inside `dispense_stock` so a multi-batch dispense
is one transaction — if the last batch turns out short, every earlier decrement rolls back rather
than leaving stock half-issued against a bill.

Expiry alerts are tiered at 90/60/30 days. `none` (no expiry recorded) is a distinct tier from
`ok` (dated and comfortably far off), because "not recorded" must never read as "checked and fine".

## Insurance & TPA

`claimed`, `approved` and `settled` are three separate columns and are never derived from one
another. A payer approving ₹8,000 of a ₹10,000 claim and settling ₹7,600 of that is normal, and
flattening it into one number loses both shortfalls — which are exactly what the clinic chases.

Every status change writes to `claim_events`. A single `status` column says where a claim is now
but not what it has been through, and "what did we send, when, and what did they say" is the
conversation a clinic actually has with a TPA. The status graph is deliberately permissive rather
than strict: real workflows loop (queried → resubmitted → queried), and a rigid machine would just
make the software wrong about the clinic's situation.

## Waiting-room display

`/display/<slug>` is public and unauthenticated — it hangs on a wall and nobody logs it in. It
shows **token numbers only**: no names, no phone numbers, no reason for visit. A board in a room
full of strangers needs a token to do its job, and anything more is a disclosure the patient never
agreed to. It is `noindex`, never cached, and reads in the clinic's chosen language.

Four things about it are non-obvious and easy to undo by accident:

- **It holds a screen wake lock.** A waiting-room board is a tablet nobody touches, and every
  tablet ever made sleeps after two minutes of that. Without the lock the product's most visible
  surface is a black rectangle most of the day, and the clinic concludes it is broken. The lock is
  dropped by the browser whenever the tab hides and is never returned automatically — the
  re-acquire on `visibilitychange` in `use-wake-lock.ts` is the whole mechanism, not a safety net.
- **The wait estimate is a pace, and it is allowed to be absent.** `get_display_queue` returns
  `pace_minutes`: the average gap between consecutive consultation *starts* today, not consultation
  duration — the queue advances at the rate patients enter the room, which includes turnaround.
  Gaps outside 2–60 minutes are discarded and fewer than two surviving gaps returns `NULL`, at
  which point the board shows no estimate at all. A wrong number on a wall is worse than none.
- **Type is fluid, not stepped.** The same board runs on a 55" reception TV and a 10" tablet in
  portrait. Every size is a `clamp()` capped against both `vw` and `vh`; a breakpoint scale tuned
  for one of those is illegible or clipped on the other.
- **`animate-board-drift` is the one deliberate exemption** from the `prefers-reduced-motion`
  block in `globals.css`. It shifts the layout twelve pixels over fifteen minutes to stop the
  panel burning in. That is roughly one pixel every 75 seconds — beneath perception, so
  disabling it would spare nobody discomfort and would only remove panel protection from displays
  whose owner happened to enable an accessibility setting. The reasoning is written next to the
  keyframe; don't "fix" it.

## Offline consultations

A visit is written to IndexedDB **before** the network call, so a connection that drops mid-save
still leaves the consultation recorded. Failed saves stay queued and are replayed from a banner on
Today. Retries are always explicit or triggered by the browser reporting the connection is back —
never on a timer, because a silent retry loop against a clinical record is how a visit gets
written twice.

This is **not** a full offline app, and does not claim to be: pages still need the network to
load. The narrow claim is the true one — *the consultation you are in the middle of will not be
lost*.

## AI dictation

Off unless `ANTHROPIC_API_KEY` is set. Three constraints hold it in place:

1. **Nothing is applied automatically.** Each field has its own Apply button. A model that
   silently fills in a diagnosis eventually fills in the wrong one, unnoticed.
2. **Audio never leaves the device.** The browser's own speech recognition does the transcription;
   only the resulting text is sent. No second vendor, no recording of a consultation in transit.
3. **Medicines come back as names, never as a prescription** — no doses. Suggested names still go
   through the medicine picker and the Wave 1 allergy/interaction screening.

## Languages

Patient-facing surfaces only — booking, intake, payment, and the waiting-room board — in English,
Hindi, Marathi and Tamil, driven by the clinic's existing `template_lang`. The clinical app a
doctor uses all day stays in English **deliberately**: half-translating a prescribing interface is
worse than not translating it, because a clinician ends up guessing which half they are reading.
Missing keys fall back to English, so a partial translation degrades into a readable page rather
than a raw key on a button.

## ABDM and FHIR

ClinicFlow speaks the national standards, and is precise about how far that goes.

**What works today, with no credentials and no registration:**

- **ABHA identity** — an optional ABHA number and address on every patient. The number's shape
  (14 digits) is enforced; its Verhoeff check digit is only ever an *advisory* on the profile.
  Blocking a save on our reading of the checksum spec would be the worse failure — a clinic must
  never be unable to record a patient's real ABHA number. See
  [`src/lib/abdm/abha.ts`](./src/lib/abdm/abha.ts).
- **FHIR R4 export** — `GET /api/patients/<id>/fhir` returns `application/fhir+json`: a
  `collection` Bundle of per-visit `document` Bundles, each an ABDM-shaped OPConsultRecord
  (Composition, Patient, Practitioner, Organization, Encounter, ICD-10 Conditions,
  AllergyIntolerance, LOINC vital-sign Observations, MedicationRequests, DiagnosticReports with
  lab Observations, and DocumentReferences). Pure and unit-tested:
  [`src/lib/fhir/bundle.ts`](./src/lib/fhir/bundle.ts).
  Labs and files that belong to no consultation get their own **"Records on file"** document —
  they are neither dropped nor attributed to a visit that did not produce them.
  DocumentReferences carry no `url`: our storage links are short-lived signed URLs, so embedding
  one would either expire in the recipient's hands or leak private-bucket access.
- **Consent artefacts** — ABDM is consent-first, so a request is recorded in `consent_artefacts`
  the moment it is made. A record with no artefact is a record we had no right to fetch.

**What needs NHA registration** — real gateway participation. `src/lib/abdm/gateway.ts` runs in
**dry-run** until `ABDM_CLIENT_ID` / `ABDM_CLIENT_SECRET` / `ABDM_BASE_URL` / `ABDM_HIP_ID` are set
(the same pattern as WhatsApp), and the consent UI says so in plain words rather than implying a
request was sent. Passing NHA's M1–M3 milestones is an operational step the clinic must complete;
no code substitutes for it.

**Two things deliberately left uncoded** in the FHIR output — medicines and free-text allergies
carry `text` with no `coding`. ClinicFlow's medicine list is curated, not a licensed coded drug
dictionary, and an allergy is whatever the clinic typed. Emitting a guessed SNOMED code would be
inventing clinical data. Uncoded is honest; the ICD-10 diagnoses *are* coded, because those were
picked from a real code list.

Conformance to the published NDHM StructureDefinitions is **not** claimed anywhere in the output.
What is verified: required fields, cardinality, code systems, and that every internal reference
resolves inside its bundle.

## Design system

**"Indigo & Bone."** Neumorphic depth and glass on **warm** neutrals, with a deep indigo
primary and a clay accent. Plus Jakarta Sans carries both UI and display type. Light **and**
dark, both real.

Live reference at **`/design`** (dev only — it 404s in production): every token, depth state,
control, the interactive cards and the Aurora background on one page.

| Token | Light | Used for |
|---|---|---|
| `--background` | bone `#EDE9E1` | the plane everything extrudes from |
| `--card` | `#F4F1EA` | cards, tables, list rows |
| `--primary` | indigo `#31418C` | buttons, links, active states |
| `--accent` | clay wash `#F5D7C9` | selected chips, icon tiles |
| `--sidebar` | indigo ink `#26224A` | app sidebar, landing CTA band |
| `--nm-edge` | `#86827B` | **interactive boundaries — see below** |
| `--success` / `--warning` / `--info` | — | all status colour |

**Why warm neutrals.** Cool grey-slate surfaces plus a bright violet accent is the default of
practically every product shipped since 2023, so that combination reads as a template rather than
as a considered choice. Warming the neutral to hue 85 is the single change that most decisively
escapes it — and the shadow (`--nm-lo`) is warm too, because a cool shadow falling on a warm
surface is what makes nominally-warm palettes still feel synthetic. Indigo rather than violet is
the other half: it is the dye Bengal was built on, so it is rooted rather than borrowed, and being
deep it clears 7.65:1 as text where the violet managed 5.02.

### Depth, and the one rule that keeps it accessible

Neumorphism renders a control in the *same* colour as its background and extrudes it with shadow
alone. That is the look, and unmodified it is also a **WCAG 1.4.11 failure**: a control
whose only boundary is a soft shadow has no 3:1 contrast against its surround. On a prescription
form that is not a style debate — it is a dose typed into the wrong box.

So: **decorative depth comes from the `--nm-*` shadow tokens; every interactive boundary
additionally carries `--nm-edge`**, which is held ≥3:1 against its adjacent surface in both themes.
`ghost` and `link` buttons are the deliberate exceptions — their label text carries the
affordance, so there is no boundary that has to be perceivable on its own.

| Utility | Meaning |
|---|---|
| `shadow-nm-raised` | resting extrusion — cards, buttons, tiles |
| `shadow-nm-float` | hover lift |
| `shadow-nm-pressed` | active push-in (the outer shadow inverts to inner) |
| `shadow-nm-inset` | resting well — inputs, icon chips, list rows |
| `glass` / `glass-dark` | frosted overlays for things floating *above* the plane (currently unused) |
| `liquid-glass` | the landing nav — a glass pane that **re-tints itself** per band |
| `glow-primary` / `glow-clay` / `spotlight` | ambient light and pointer-tracked specular |
| `range-glass` | `<input type="range">` with a transparent track, so the component can draw its own rail and fill *behind* it |
| `bg-grain` | film grain on a dark band — **needs `isolate` on the host** |
| `nm-dark-surface` | **required on dark surfaces inside the light theme** |

**The FAQ animates a native `<details>`, with no JavaScript.** `interpolate-size: allow-keywords`
on `:root` lets `auto` participate in a transition, and `::details-content` is the browser's own
handle on the collapsible part; `content-visibility … allow-discrete` keeps the panel in the
accessibility tree while it closes. It is progressive enhancement by construction — a browser that
does not know these selectors ignores the block and the disclosure opens instantly, exactly as
before. That is what buys the animation *without* trading away the reason `<details>` was chosen:
it is keyboard accessible, correctly exposed, and works before a byte of JS has run, which matters
because it is the section a sceptical visitor reaches for on a slow connection.

**Raised surfaces cast down; only wells are dual-lit.** `raised` and `float` are a plain warm
drop shadow — contact + ambient, straight down (`--nm-cast-1` / `--nm-cast-2`). The textbook
up-left white highlight was removed: it only works when the page behind the surface is neutral,
and ours is warm bone, so a white bloom came out both lighter *and* cooler than the surface it sat
on and read as a smudge ringing every card. The dual light source survives where it never smudged —
*inside* `inset` and `pressed`, which still use `--nm-hi` / `--nm-lo` for the lip of the well.
Dark mode had always known this (`--nm-hi` is a lifted grey there, never white); light mode caught
up. Anything hand-rolling a `shadow-[...]` should follow the same rule — see the `default` button
variant, whose cast is indigo-tinted but equally highlight-free.

**Never hand-write `-webkit-backdrop-filter`.** Tailwind v4 runs Lightning CSS, which prefixes from
the browserslist targets itself — and when it finds an author-written prefixed copy alongside the
standard property it collapses the pair and keeps *only the prefixed one*. The standard property
vanishes from the build and the blur stops applying in Chrome. Declare `backdrop-filter` alone; the
production CSS ends up with both. Both `glass` utilities carried this bug and shipped un-frosted.

**Adaptive tint (`liquid-glass`).** The landing nav crosses bone and deep-indigo bands, and a fixed
tint is wrong on one of them by construction — dark-on-light disappears over indigo, light-on-dark
becomes a grey slab over bone. So the tint, rim, specular lip and drop shadow are all `--lg-*`
variables that a `[data-over="dark"]` block inverts; `site-header.tsx` measures every
`[data-band="dark"]` section and writes the attribute as the pane crosses each seam. **The
foreground has to invert with it** — over indigo the tint is a 10% white wash, nowhere near opaque
enough to carry dark ink, so the logo, nav links and both buttons flip too. An adaptive surface
without an adaptive foreground is just an unreadable nav.

`nm-dark-surface` is the sharp edge here: the sidebar, mobile tab bar and landing CTA band are
dark surfaces living in the light theme. Without it they inherit the light lamp and paint a
95%-white highlight onto near-black, which reads as a glowing seam. Custom properties inherit, so
it goes on the container once. (The waiting-room display is the exception — it uses the real
`.dark` class, because it is genuinely the dark theme rather than a dark patch inside the light
one, and `.dark` already sets the correct lamp values.)

### Depth means something — don't apply it decoratively

The system is not "add shadow to make it look nice". It encodes one consistent idea, and screens
are readable at a glance because of it:

> **Raised = active or actionable. Recessed = waiting, containing, or holding content.**

- **Today queue** — waiting patients sit recessed in the day-plane; the one patient *in
  consultation* is the only raised row. Finding "who am I seeing" is a glance, before reading a word.
- **Booking slots** — a free slot is a key standing proud, the chosen one is a key held down.
- **Waiting-room display** — up-next is raised, the rest recessed; the serving token additionally
  *emits* light (`glow-primary`), because it is the one thing everyone in the room is looking for.
- **Inputs, tables, list rows** — recessed. They contain content rather than doing something.
- **Icon chips inside a raised card** — recessed, against the card's own extrusion. That
  counterpoint is what sells both as physical.

Colour always changes alongside depth. Depth is never the only cue for state — that would fail
the same users the `--nm-edge` rule protects.

### Dark mode is reachable (it wasn't)

`globals.css` has carried a complete, contrast-audited `.dark` block since the neumorphic rebuild,
and until now **nothing in the app could ever set that class** — `next-themes` was installed but
only `ui/sonner.tsx` imported it, calling `useTheme()` with no provider above it. A whole theme
shipped and was unreachable.

`src/components/theme-provider.tsx` now wraps the tree in the root layout. Two decisions worth
keeping:

- **The class goes on `<html>`, not on the app shell.** Scoping it to `(app)/layout.tsx` looks
  tidier and would leave the marketing page untouched by construction — and it is wrong, because
  every dialog, dropdown, popover and toast renders through a **portal to `document.body`**, which
  is outside any wrapper inside a layout. Themed page, unthemed overlays.
- **`defaultTheme="light"`, not `"system"`.** `/` is a marketing page art-directed in light (pale
  product cards over a dark film, bone bands alternating with indigo). Defaulting to `system` hands
  roughly half of first-time visitors a version of the pitch nobody designed. Dark is opt-in from
  the sidebar or ⌘K; `enableSystem` stays on so "System" is still an explicit choice.

Anything that renders a client-only fact (a stored theme, a `matchMedia` result) must gate on
`useHydrated()` from `src/lib/use-hydrated.ts` — a `useSyncExternalStore` shim, because the obvious
`useState` + `useEffect(() => setX(true))` spelling is exactly what the React Compiler's
`set-state-in-effect` rule rejects.

### ⌘K is the primary navigation

`src/components/command-palette.tsx`, mounted once in the app layout. Live patient search, every
destination, the share links and the theme, on one keystroke. A solo doctor uses this app between
patients with someone sitting opposite them; "pull up Mrs Rao" was four screens deep through a
nine-item sidebar that cannot search.

- **The trigger buttons talk to it over a DOM event** (`openCommandPalette()`), not React context.
  It has to be openable from the desktop sidebar *and* the phone top bar — two components sharing
  no parent below the layout — and a provider would re-render the tree on every open.
- **The visible search-shaped button is not optional.** ⌘K is invisible; a best feature only
  reachable by people who already guessed it has shipped to nobody.

### Lists are paginated — never `.limit(n)` and render

Billing, Patients and Messages each ended their query with a bare `.limit(100)`. That is not a page
size, it is **silent truncation**: a clinic with 400 invoices got the newest hundred with nothing on
screen admitting it, and an invoice from three months ago was unreachable through the UI. All three
now use `count: "exact"` + `.range()` + `src/components/pagination.tsx`, which always prints
"Showing 1–50 of 446".

**Insurance was worse, and shows why the rule is not just about lists.** It ran one `.limit(100)`
and computed *both* the table and the headline money from it. A cut-off table is a nuisance; a
cut-off total is a lie — "Outstanding" is the figure a clinic chases its TPAs with, and past a
hundred claims it silently reported the debt of the newest hundred only, always too low and never
flagged. It now runs two queries: a light one over the whole claim set for the totals, and a paged
one with the heavy `claim_events` join for what is on screen. **When a number aggregates a query,
the limit on that query is part of the number.**

The same instinct applies to *time* windows, not just row counts. Today's "Online booking requests"
banner had no date floor, so requests for slots that had already passed — which can no longer be
accepted — accumulated for ever and, because the list is ordered soonest-first and capped, pushed
the live ones off the end.

This class of bug is invisible on a demo database. **Seed a realistic amount of history before
declaring a list screen done** — with 18 rows a truncating query and a correct one are the same
screen.

### Downloads: filenames are bytes, and CSV cells are code

Two traps that both come from user-controlled text ending up somewhere it is not merely displayed.

**`Content-Disposition` cannot hold a non-ASCII name.** HTTP header values are byte strings, so
`new Response(body, { headers })` throws the moment a value contains a code point above 255. The
prescription route built its filename from the patient's name — in an app that ships Hindi, Marathi
and Tamil and serves Indian clinics. A patient called अनिता शर्मा did not get a badly named file;
they got a **500 and no prescription**, in a header, long before the PDF (which renders those names
perfectly well) was ever sent. All download routes now go through `contentDisposition()` in
[`src/lib/http.ts`](src/lib/http.ts), which emits an RFC 6266 pair: a sanitised ASCII `filename=`
fallback plus `filename*=UTF-8''…`, so the patient sees their own name and a `"` in it cannot close
the quoted-string and inject further header parameters.

**A quoted CSV cell is still a formula.** Excel, LibreOffice and Sheets evaluate a cell whose text
begins with `=`, `+`, `-` or `@` regardless of quoting. The payments export includes the patient
name, and patient names are attacker-supplied — anyone can open a clinic's public booking page and
book under `=HYPERLINK(...)`. The doctor then opens `payments.csv` in Excel, which is the entire
point of the export. [`src/lib/csv.ts`](src/lib/csv.ts) prefixes a single quote (the OWASP fix);
amounts go through `csvNumber` instead so a negative figure stays a sortable number rather than
becoming a string.

### KPI tiles carry a comparison, and it must be real

`StatCard` takes an optional `delta` and `spark`. A bare "Revenue today: ₹2,600" is a fact with no
meaning attached — good or bad depends on what a Tuesday normally looks like in *this* clinic,
which the tile was making the doctor recall from memory every morning.

- **The baseline is always printed, never implied** ("vs last week", "vs prev 30d").
- **`pct: null` renders "no baseline yet"** rather than a confident 0%. A clinic in its first week
  genuinely has nothing to compare against.
- **Direction is an arrow as well as a colour**, same rule as the status rails.
- Every number is computed from this clinic's own rows. No benchmarks, no "clinics like yours", no
  projections — inventing a comparison is the fastest way to make a report authoritative and
  worthless.

One real trap this surfaced: **money must not be divided by appointments.** "Average per visit" as
`collected / completed appointments` assumes every visit produces exactly one bill and every
appointment gets closed; when that doesn't hold it reads "₹24,950 per visit". It is now average
*payment* — a denominator that always matches the numerator.

### The patient never sees the app — they see `/book` and the wall

Two surfaces carry the entire patient-side experience, and neither of them is behind a login. They
get held to a different standard than the clinical app, because the person using them has no
training, no second attempt, and often a low-end Android phone on a bad connection.

**Slots are grouped, not listed.** A 15-minute clinic running 9–1 and 5–9 offers 32 slots. As one
flat grid that is a wall of near-identical numbers and someone looking for "after work" has to read
all of it. `groupSlots()` splits on the two boundaries people already think in — lunch and the end
of the working day.

**A day with no slots says *why*.** "Closed" and "Full" produce identical empty arrays out of
`generateDaySlots`, and they are opposite instructions to a patient: come another day, versus try
calling. `buildBookingDays` recovers the distinction with `closed`, and the chip is genuinely
`disabled` rather than faded to 40% and still clickable — which reads as broken, not as shut.

**Slots go stale while someone decides, and the widget re-reads on focus.** The page is
server-rendered once. Someone who opens the WhatsApp link, gets pulled away and comes back twenty
minutes later used to discover the slot was gone *after* entering a phone number and typing an OTP
— the most expensive possible moment. `refreshBookingDays` moves that failure to the only point
where it costs nothing: while they are still choosing.

**The OTP field is one input, not six.** Six inputs is the obvious build and it is wrong: paste
lands entirely in box one, Android SMS autofill fights it, backspace and arrow keys need
hand-rolled focus juggling, and a screen reader announces six unlabelled fields. `OtpInput` draws
six boxes over a single real field carrying `autocomplete="one-time-code"` — which is what makes
iOS offer the code above the keyboard — and auto-verifies on the sixth digit.

**Confirmation is where the no-show is prevented.** The moment after booking is the only one where
the patient holds both the appointment and their phone. `src/lib/ics.ts` puts it in the calendar
they already check, by `.ics` download and by Google Calendar template URL, next to Directions and
Call. Times go out as UTC instants with a `Z`, never as IST-local plus a hand-written VTIMEZONE —
that is a well-known way to be an hour off twice a year.

**Palette contrast is measured, not eyeballed.** The `--success` / `--warning` / `--info`
lightness values are pinned to the highest L that still clears 4.5:1 as *text* on `--background`
(4.72–4.75:1), because `status.ts` renders them as `text-success` etc. Raising any of them by
0.03 drops that pair below AA. If you change a colour token, re-run the audit before shipping.

Conventions worth knowing before editing UI:

- **Status colour lives in one place** — [`src/lib/status.ts`](./src/lib/status.ts). Never hardcode
  Tailwind palette colours (`text-amber-600` etc.) in feature code; use `APPOINTMENT_STATUS`,
  `INVOICE_STATUS`, `MESSAGE_STATUS` or the `TONE` recipes. Class strings there are spelled out in
  full because Tailwind only generates classes it finds as literals.
- **Display type** comes from `font-heading` (Jakarta at weight 700 with tight negative tracking —
  the serif/sans pairing is gone, not restyled). `CardTitle` already applies it.
- **Links styled as buttons** must be `<Link className={cn(buttonVariants({...}))}>`, never
  `<Button render={<Link/>}>` — the latter trips a Base UI accessibility error.
- **Cards use `bg-card`, not `bg-background`.** `--card` sits one step lighter than the plane on
  purpose, so a surface still separates when shadows are suppressed (forced-colours mode, print).
  Depth is never the *only* cue.
- **Status rails / dots** come from `src/lib/status.ts` too — each `APPOINTMENT_STATUS` entry
  carries a `rail` class (the coloured left strip on queue and calendar rows).
- **In-app motion** is subtle and CSS-only: the Button's raised→pressed shadow inversion,
  `transition-colors` on rows/links. No entrance animations on clinical screens. `glass` is for
  things that float *above* the plane (sticky headers, dialogs, popovers) — don't stack it on a
  surface that already has a neumorphic extrusion, the two depth cues fight.
- **Landing motion is the one exception** — the marketing page (`src/components/landing/*`) uses
  the [`motion`](https://motion.dev) library for scroll reveals, spring pops, parallax, a
  scripted hero mockup and animated counters. `motion/react` must **only** ever be imported under
  `src/components/landing/` (grep-enforceable); the clinical app stays CSS-only. Shared landing
  primitives live in [`motion-primitives.tsx`](./src/components/landing/motion-primitives.tsx)
  (`LandingMotionProvider` wraps the tree with `MotionConfig reducedMotion="user"`; `Reveal`,
  `Stagger`/`StaggerItem`, `SplitReveal`, `Magnetic`, `ScrollSkew`, `ScrollProgress`). The
  looping CSS bits (marquee, CTA shine, live dot) are `@utility` rules in `globals.css`, all
  gated by the `prefers-reduced-motion` block. Everything animates opacity/transform only; the
  hero `<h1>` stays static server HTML (CSS entrance) so it never breaks the e2e `"clinic day"`
  assertion or LCP.
- **Public patient pages stay CSS-only** — the booking / intake / pay pages (`PublicShell`) are
  what patients open on low-end Android phones, so they never load `motion`. Polish there uses the
  cheap CSS utilities only: `animate-rise` (entrance), `animate-pop` (confirmation check /
  brand logo), `active:scale-*` press feedback. The instant-booking flow has a `Stepper`
  (Time → Verify → Details) in [`booking-widget.tsx`](./src/components/booking/booking-widget.tsx).
- **The landing page is scroll-choreographed.** Three attempts at a hero background were thrown
  away before this one — an R3F/three.js scene (~200KB gz, and the abstract object competed with
  the product mockup in front of it) and an animate-ui hexagon lattice (louder than the content it
  sat behind). Both are gone; `three`/`fiber`/`drei` are uninstalled. What replaced them is motion
  applied to the *content* rather than a decorative layer behind it:
  - [`smooth-scroll.tsx`](./src/components/landing/smooth-scroll.tsx) — Lenis, mounted only on `/`.
    It wraps **native** scroll (not a transform on a wrapper), which is why `useScroll` needs no
    bridge and `position: sticky` keeps working. `syncTouch: false` leaves touch devices alone.
  - [`page-curtain.tsx`](./src/components/landing/page-curtain.tsx) — the boot sequence. The hero
    used to assemble in the wrong order: type and buttons rose into place over the *poster frame*
    and the film cut in underneath them a beat later. Now a plate holds the page until the film is
    actually running, then parts from the middle. Three rules make a full-page opaque overlay safe:
    it is **hidden by default and shown by `data-boot`** (so no-JS never sees it, rather than
    needing JS to remove it); the arming inline script sets **its own 4s failsafe** before React
    exists, so a failed hydration cannot trap anyone; and `MAX_WAIT` caps the wait no matter what
    the video does. `hero-video.tsx` reports ready via `boot.ts` on *every* settling path — playing,
    autoplay-refused, `error`, and each opt-out — because "the film is never coming" has to release
    the plate exactly as fast as "the film is here". The latch in `boot.ts` is not ceremony: a
    cached video resolves before the curtain mounts its listener, so a plain event would be lost and
    the *faster* the load the longer the wait. Cost, stated honestly: holding the `<h1>`'s entrance
    holds the LCP element. `MAX_WAIT` is the dial for that, not `MIN_SHOW`.
  - [`scroll-to.ts`](./src/components/landing/scroll-to.ts) — nav anchors travel instead of jumping.
    Two traps, both measured. **Lenis already subtracts `scroll-margin-top`** from the target
    (`scrollTo`, `lenis.mjs`), so passing `offset: -96` *as well as* the `scroll-mt-24` the sections
    carry landed every one of them 192px down; the number lives on the sections, once.
    And **the easing matters more than the duration**: `easeOutExpo` — the reflex pick — spends half
    its distance in the first tenth of its time, and was measured moving **2,886px in a single
    frame** en route to Features. Technically a scroll, indistinguishable from a jump. Symmetric
    easing (`easeInOutCubic`) spends its time in the middle of the journey, which is the part that
    tells the visitor which way the page went.
  - [`hero-fragments.tsx`](./src/components/landing/hero-fragments.tsx) — pointer parallax and
    scroll parallax on the same fragment, composed by **nesting** (outer = scroll, inner = pointer)
    rather than merging two MotionValue streams by hand.
  - [`hero-video.tsx`](./src/components/landing/hero-video.tsx) — the hero's background film.

    **Only 6.4s–9.95s of the clip is usable.** The source is AI-generated and carries a transition
    artifact from **2.0s to 5.4s** — a green particle spray that at its peak engulfs the reception.
    It does not read as an effect; it reads as a rendering fault, on the most-seen surface on the
    site. Playback is held inside the clean window (`CLIP`), guarded per presented frame via
    `requestVideoFrameCallback` — `timeupdate` fires ~4×/s and would leak up to 250ms of green on
    every loop. `<source src="/hero.mp4#t=6.4">` sets the start position as a **media fragment** so
    the first range request is for the right offset instead of byte zero followed by a seek; that
    only works because the file is faststart (`moov` at 28KB, ahead of a 10.6MB `mdat` — verified by
    walking the atoms). **Keep `-movflags +faststart` on any re-encode** or this silently becomes a
    full-file download before a frame appears. The real fix is re-cutting the file, which would also
    roughly halve the download; the exact `ffmpeg` command is in the module doc.

    **`public/hero-poster.jpg` is cut from the same frame playback starts on**, so the poster→video
    handoff is invisible. It also needed replacing on its own merits: the shipped one was a
    screenshot of a *video player*, with the scrubber, pause button and "0:00 / 0:10" baked into the
    JPEG — sitting across the bottom of the hero for every reduced-motion / Data Saver / 2G visitor,
    i.e. for exactly the people who only ever see the poster.

    A measurement trap worth keeping: scoring each frame by its **average** green cast put the
    artifact's end at 4.4s, and a poster cut from 4.6s on that basis still had green spray across
    its lower third — a large neutral ceiling had diluted a localised artifact below the threshold.
    Re-scored by **worst 8×8 tile**, the tail runs to 5.4s. When hunting a localised defect, a mean
    is the one statistic guaranteed to hide it. (Restricting the window also moved which frames the
    headline sits over, so `hero-plate`'s contrast was re-measured against the new range: worst
    case 5.1:1, still clearing the 4.5 body-text bar with nothing on the type.)

    It also deliberately refuses to fetch 11 MB for reduced-motion, Data Saver or 2G/3G visitors,
    and that refusal is **re-evaluated on `connection.change`**: `effectiveType` is a rolling
    estimate, so
    sampling it once at page load — the busiest moment in the page's life — made a healthy
    connection that happened to be congested lose the film for the life of the tab. That was the
    "why does the video only play sometimes" bug. Its sibling: the pause-when-buried optimisation
    tracked a local `buried` flag that desynchronised from the element, because `pause()` during a
    pending `play()` set the flag and then playback started anyway — measured at `scrollY: 5000`,
    `paused` was `false`, i.e. the film decoded behind twelve screens for the whole page. State is
    read off `v.paused` now, never shadowed.
  - [`day-chapter.tsx`](./src/components/landing/day-chapter.tsx) — the page's centrepiece, and the
    one section worth reading the source of. See **"The claim and its evidence are one scroll"**
    below. Correct and dull is still dull, and for a while it was exactly that — one column of type
    on a flat indigo field. What fixed it was not more effects but the *same* idea (the section is a
    day) said three more ways: the light cross-fades cool → warm → cool against scroll; `DayMeter`
    interpolates the real beat times, so the clock races through nine hours between the first two
    beats and crawls three minutes between 11:41 and 11:44 — which is what the day actually does and
    what the copy cannot say without labouring it; and the lit rail ends near-white so its leading
    edge reads as light travelling, for the price of one colour stop.
  - [`stat-board.tsx`](./src/components/landing/stat-board.tsx) — three odometers on a board that
    turns under the pointer. The numerals **used to be extruded** (a front face plus seven copies
    pushed back in Z, sharing the board's vanishing point). On paper it was the most interesting
    thing on the page; on screen the copies read as a smeared grey echo behind every figure, worst
    on the two-digit ones where each digit threw its own. There was nothing to tune down — the
    ghosting *was* the effect — so it is a digit reel now, which means something in a section about
    how long things take and costs one transform per digit instead of eight stacked copies.
    The trap that cost the most: a reel's strip is twenty numerals tall inside a one-numeral window,
    and `IntersectionObserver` intersects the **clipped** rect — so its visible fraction is 5% at
    every scroll position, and a `viewport.amount` of 0.6 was a condition it could never meet. Every
    counter sat at **0**. The trigger belongs on the unclipped row, propagating by variants; no
    threshold value would have fixed it. Second trap: the reel must *not* carry `data-parallax`
    like everything else here, because that hook's reduced-motion rule is `transform: none`, and
    `y: 0%` on a reel is the numeral zero — it would silently show 0 to exactly the people who
    cannot see it move.
  - [`pricing-slider.tsx`](./src/components/landing/pricing-slider.tsx) — the visitor's own patient
    count turned into a per-patient cost. Deliberately not a "savings calculator": the headline
    figure needs no assumption at all (price ÷ their visit count), and the one assumption behind the
    second figure is printed under it rather than buried.
  - [`try-it.tsx`](./src/components/landing/try-it.tsx) — the playable one, and the page's turn from
    telling to showing. Tap a patient out of the queue, tap medicines onto the pad, sign, watch it
    land on a phone, with a clock running. It demonstrates four things a feature card can only
    claim: the queue, the pad, the drug-safety advisory and WhatsApp delivery. **Amoxicillin is one
    of the four chips deliberately** — the patient's record lists a penicillin allergy, so tapping
    it trips a live ingredient-level advisory, and the advisory pointedly does *not* block the send,
    because the real one doesn't. Two layout rules it encodes: the stage is one fixed height across
    all three steps (a growing panel shoves the page under a thumb mid-tap), and the advisory
    renders *below* the action row rather than beside the pad it describes — it is the one element
    that can appear mid-flow, and measured at 390px it adds 139px, all of which would otherwise
    push "Sign & send" down the screen. Verified: the button moves 0px.
  - [`trust-marquee.tsx`](./src/components/landing/trust-marquee.tsx) — the belt **reacts to scroll
    velocity**: it drifts when the page is still, accelerates as you scroll, and reverses when you
    scroll up. That needs per-frame integration (`useAnimationFrame` + `useVelocity`), which is why
    it is no longer a CSS `@keyframes` translate — a keyframe has one speed and one direction. Two
    traps: the wrap must be `(((n % 50) - 50) % 50)`, because JS remainder keeps the *dividend's*
    sign and scrolling up would otherwise fling the track off-screen; and the loop is gated on
    `useInView`, so an off-screen belt costs nothing.
  - [`pointer-glow.tsx`](./src/components/landing/pointer-glow.tsx) — a light that follows the
    pointer across whichever band it is dropped into. It listens on its **parent** node, which is
    what lets a server-rendered section stay a server component and still be interactive; an overlay
    with its own handler would have to choose between swallowing clicks and receiving no events.
    Requires `isolate` on the host, since it sits at `-z-10`.
  - `ScrollSkew` (in `motion-primitives.tsx`) — the only effect on the page driven by scroll
    *velocity* rather than scroll *position*, so it answers to how the visitor is reading rather
    than to where they are: flick the wheel and the headings lean and settle; read slowly and it
    never appears. Kept to 3.5° because skew distorts letterforms, and clamped because a trackpad
    fling reports tens of thousands of px/s. The spring is stiff and heavily damped on purpose — a
    loose one keeps oscillating after the page has stopped, which reads as a bug rather than as
    weight.
- **The hero does not scroll away — the page rises over it.** `Hero` is a **stage**: exactly
  `h-svh` and `sticky top-0`, so it locks from the first pixel of scroll and never moves. Everything
  after it travels over the top and buries it. Three parts make that work, and each was a bug
  before it was a fix:
  - **The queue mockup had to move out of the stage.** The old single-section hero was ~1,170px —
    taller than any viewport it will be opened in — and a pinned box is exactly one screen, so the
    mockup would have been cropped out of existence permanently. It is now `HeroShowcase`, an
    ordinary in-flow section on the same dark band, which makes it the *first* thing that rises over
    the film.
  - **`sticky bottom-0` on one tall section looks like the obvious alternative and does nothing.**
    Measured: it never engages. A sticky box is additionally constrained to its containing block,
    and a box whose static position is at the top of a 12,000px `main` has no bottom-edge constraint
    to satisfy, so it just scrolls away like a normal element.
  - **A pinned element cannot be measured into document coordinates**, which broke the glass nav's
    band detection. Both `rect.top + scrollY` *and* `offsetTop` drift with the scroll for a pinned
    box (verified in Chromium — the obvious "use layout position instead" fix does not work), so the
    stage's `data-band="dark"` lives on a static, absolutely-positioned marker in `page.tsx`
    instead. The showcase, being in flow, carries the attribute directly.
  - The rising stack is one `relative z-10 bg-background` wrapper. **Opaque is load-bearing**:
    several bands below are translucent tints (`bg-secondary/35`) which would otherwise composite
    against the *footage* rather than the page. The showcase's top edge is rounded, which is what
    makes the curtain read as a panel sliding over rather than as a clipping artefact — and since
    it is the same colour as the stage, the corner notches are the only place the film shows
    through.
  - **The showcase panel is frosted, not painted.** It was originally a flat `bg-sidebar` — opaque,
    so the curtain covered the film with a wall of solid indigo the instant it arrived. It is now
    `bg-black/18 backdrop-blur-xs`: `backdrop-filter` samples whatever is already composited
    behind an element in *paint order*, not DOM ancestry, so it picks up the pinned hero's video
    even though the showcase is a sibling several DOM levels removed from it — confirmed with a real
    screenshot mid-scroll, where the video is visibly, blurrily present through the panel. Only the
    panel's empty background is glass; the floating mockup cards inside stay fully opaque, or the
    headline would bleed through them while both are on screen. The tint is **black, not the
    `bg-sidebar` indigo** every other dark band on the page uses — a colour cast reads as a blue
    overlay smeared over real video footage rather than as depth, and only got more visible once the
    hero clip stopped being a dim clinic interior. Both values are also deliberately *small* — the
    first pass used `backdrop-blur-2xl` (40px) over a 55% tint, which is real frosted glass rather
    than the barely-there pane this wants; a little of each beats a lot of either, because tint alone
    is a diluted flat wall and blur with no tint lets a bright frame wash out the mockup's contrast at
    the edges the cards sit near.
  - **The fragments pop in on a scroll-scrubbed cascade** ([`hero-fragments.tsx`](./src/components/landing/hero-fragments.tsx)).
    Six chips, each with its own `[start, mid, end]` slice of the section's scroll pass offset by
    `POP_STEP` from the last, driving `opacity` and `scale` off the *same* MotionValue that already
    drives the drift — nothing extra measured or subscribed to. The scale range is three points
    (`[0.5, 1.08, 1]`), not two: overshooting past 1 before settling is what makes it read as a
    notification landing rather than a chip fading in. Measured, the whole cascade runs between
    scrollY 200 and 900 at 1440×900 — i.e. it finishes exactly as the curtain finishes rising, so
    the composition is fully assembled the moment it is fully framed.
    `[data-parallax]`'s reduced-motion rule therefore pins **`opacity: 1` as well as
    `transform: none`** — without the opacity half, a visitor who prefers reduced motion and never
    scrolls would be left staring at six invisible chips.
  - `hero-video.tsx` **pauses the film once it is buried**. An IntersectionObserver cannot detect
    this: the pinned stage never stops *intersecting* the viewport, it stops being visible because
    content is painted on top, and occlusion is not something IO reports. Scroll depth past the
    stage's own height is the only test that means "buried".
- **The hero is a dark band with a video behind it**, which has three consequences worth knowing:
  - **The nav is `fixed`, not `sticky`.** A sticky header still occupies a row in normal flow, which
    pushed the hero down and left a bare strip of page background across the very top of the site.
    Only taking it out of flow lets a full-bleed background reach the top edge; the hero pays for
    the nav with `pt-28`.
  - **Light cards on a dark band must set `text-card-foreground` next to `bg-card`.** Any text
    inside that doesn't name its own colour inherits the *band's* light foreground and vanishes into
    the card. This silently ghosted every patient name in the queue mockup.
  - **The film is never downloaded for people who shouldn't pay for it.** No `autoplay` attribute
    and `preload="none"`, so zero bytes are fetched until an effect decides — it opts out on
    `prefers-reduced-motion`, on `navigator.connection.saveData`, and on 2G/3G. Everyone else gets
    the loop; the opt-outs keep the poster frame, so the hero is never empty and never shifts.
    Encoding matters as much: the source was 15.2MB for 7.8s with `moov` at the *end*, so playback
    could not begin until nearly all of it arrived. Shipped as 1.0MB H.264 (`-crf 30
    -movflags +faststart`) plus an 872KB VP9 WebM, offered WebM-first.
- **Static assets must be excluded from the proxy matcher by extension.** Anything matched by
  [`proxy.ts`](./src/proxy.ts) runs the auth gate, so `/hero.mp4` 307'd to `/login` for exactly the
  logged-out visitors the landing page exists for. The matcher's extension list is the fix — add to
  it whenever a new asset type lands in `public/`.
- **The page alternates bone and indigo, and that rhythm is functional.** Everything from the stats
  down had drifted into one continuous bone run — six sections deep by the time a visitor reached
  the price, which is the worst possible place for their attention to have flattened. Pricing is now
  a **dark** band, giving the money its own room and handing the closing CTA a light section to push
  off. The clinic day is one *uninterrupted* dark chapter — see the next entry for why it is now
  literally one section rather than two.
- **The claim and its evidence are one scroll.** This was two adjacent dark bands. `Manifesto` set a
  sentence that lit word by word ("A patient books at midnight. ClinicFlow confirms it on WhatsApp,
  reminds them two hours before…"); `DayTimeline` then ran a 24-hour dial past six events — 00:12
  books, 09:30 reminder, 11:26 check-in, 11:41 prescribe, 11:44 pays, 19:00 close.

  They were **the same six beats twice**. The sentence *listed* the day and the timeline *showed*
  it, back to back, with a seam between them: about a minute of scrolling to be told one thing, and
  the second half read as the page repeating itself, because it was.

  **The first fix was wrong, and the way it was wrong is the useful part.** It pinned the sentence
  above the cards so each clause lit as its own card arrived. That *synchronised* the duplication; it
  did not remove it. Every beat was still written out twice — once as a clause, once as a card title
  plus body — and pinning them together only guaranteed you read both. It was strictly more reading
  for the same information, and it was rejected on sight.

  [`day-chapter.tsx`](./src/components/landing/day-chapter.tsx) deletes one of the two copies. **The
  clause *is* the beat's headline**; there are no card titles, because a card title beside its own
  clause is a paraphrase of it. Read only the large type, top to bottom, and you have read the
  original manifesto sentence in full:

  > A patient books at midnight, and WhatsApp confirms her while you sleep. It reminds her two hours
  > before, she checks herself in, the prescription is gone before she reaches the door, and the
  > receipt sends itself when she pays. You just see patients.

  The timeline no longer illustrates the sentence — it *is* the sentence, with clock times in the
  gutter. That is why nothing needs pinning any more: there is no second thing to hold on screen
  alongside the first.

  Three rules that keep it honest:
  - **A `proof` line may not restate its clause.** Each beat carries one line of supporting detail,
    and the rule is absolute: the clause says what happened, the proof says what nobody had to do or
    which surface did it. Break that rule and the section is back to saying everything twice — just
    in a smaller font. It is set dim and small on purpose: skip every one and the pitch still lands.
  - **The six clauses must still parse as one sentence.** That is the whole conceit, and it is
    invisible in the source because each clause sits in its own array entry. Read them end to end
    after any copy edit. The e2e/Playwright probe joins them and prints the result for exactly this
    reason.
  - **Each beat scrubs against its own box, not against page progress.** One page-level progress
    value driving all six ties a clause's timing to how tall the beats above it happen to be, so
    editing one line's copy silently shifts when a later clause lights. Each beat owns its
    `useScroll`.

  The same reasoning applies to the rail: it is drawn as **one segment per beat**, anchored between
  its own node and the next, rather than once down the whole list. A list-level rail has to guess
  where to stop, and any fixed `bottom-*` is wrong the moment the last beat's copy changes length —
  in testing it died in the gap two beats early. The round 24-hour dial and the horizontal ruler that
  briefly replaced it are both in `assets/retired-components/`; the dial in particular is a nicer
  piece of work than anything that replaced it and may be worth reviving elsewhere.
- **The same duplication keeps growing back, and it is worth naming.** `DayChapter` was rebuilt
  twice because the clinic day was being told more than once. The third instance was in
  `HowItWorks`, whose step 03 read "See patients — bookings confirm themselves and the queue orders
  itself. You open the visit, prescribe, and the PDF is on its way before the patient reaches the
  door." That is DayChapter's six beats in different words, four sections later, with a
  prescription visual beside it.

  The boundary is now explicit and should be defended: **`DayChapter` owns the clinic day.
  `HowItWorks` owns onboarding and stops at the first booking.** Step 03 is "Take your first
  booking" and its visual is `FirstBookingVisual`, not a consultation. Anything about queues,
  prescribing or payment belongs in DayChapter or Features, not here.
- **A void you have to decorate is a section that is too big.** `HowItWorks` was three
  `StackPanels`, each pinned for a full viewport — measured at **2,921px, 3.2 viewports, 23% of
  the page**, for three sentences. Its own comment conceded the result and patched it: "its content
  only filled about half of it, and the void read as an unfinished page. A ghosted numeral is the
  cheapest honest way to occupy that space." It is compact alternating rows now, at 1,665px, and
  the whole page dropped from 14.0 to 12.6 viewports. `stack-panels.tsx` moved to
  `assets/retired-components/`; its reduced-motion rule is kept in globals.css so it stays
  revivable. Before adding another full-viewport scroll device, count how many the page already
  has — by this point a visitor has passed scrubbed text, a scroll-driven timeline, extruded
  numerals, a live WhatsApp thread, a working prescription demo and a pinned film.
- **Profile before you blame the JavaScript.** The landing page carries a lot of scroll-linked
  work — six per-beat subscriptions and ~43 word transforms in `DayChapter` alone, plus a running
  clock, an arc, three odometers and seven velocity-skewed headings. Measured in a headless
  production build it ran at 14–44fps, which looks damning and is the wrong conclusion.

  A controlled sweep found the whole of it: with `filter: blur()` and the glow fields removed,
  **every section hit a flat 60fps — including `DayChapter`, the one with the most subscriptions on
  the page**. The JS costs nothing. Two follow-ups worth keeping, because the obvious next guess was
  also wrong: removing the `scale()` from `glow-drift` changed nothing (12fps vs 14), and disabling
  the drift animation entirely changed nothing either. It is not *what is done to* the blurred
  layers — it is the static cost of rasterising 30–44rem blurred boxes in a software rasteriser,
  which is what headless Chromium is (the GPU-raster flags made no difference; SwiftShader still
  rasterises on the CPU). A real GPU caches those layers as textures.

  So the numbers are an artifact and the design should not be contorted to chase them. But the
  audience here is largely low-end Android, where blur is genuinely not free, so the blur *count*
  is still a budget: `DayChapter` cross-fades **two** light fields rather than three, and the day
  reads cool → warm → cool by bringing the indigo field back on a V curve instead of lighting a
  third layer to do it. If you add a blurred field, take one away.

- **Measure type and contrast; do not eyeball them.** Two defects shipped on this page purely
  because they looked plausible, and both were found in minutes once something actually sampled
  pixels:
  - **The hero headline was invisible.** An earlier pass removed the scrim from everything below
    the nav so the words would "sit directly over the film with no tint at all". Screenshotting the
    `<h1>`'s strip with the glyphs hidden and computing relative luminance gave **2.37:1** on the
    average pixel and **1.00:1** — the same luminance as the text — at the brightest.

    **Three fixes were built and rejected before the right one, and the sequence is the lesson.**
    Each was a different wrong answer to "how do you put white type on a bright, busy film":

    1. A translucent indigo **scrim** over the film. Bought the contrast honestly (7.81:1 at its
       worst readable point) but *composites a colour onto the picture*, lifting blacks toward the
       tint and flattening the range. A sunlit room became a dim one. That flattening is what
       "muddy" actually is.
    2. Stacked **`drop-shadow`s** on the letterforms, leaving the plate bright. Chained
       drop-shadows each filter the *result* of the last, so they compound into a dark rim hugging
       every stroke — and a dark rim around white type is a dated device at any strength worth
       having. Softening it to a measured 24.3% mean darkening did not rescue it, because the
       objection was the halo, not the amount.
    3. A masked **`backdrop-filter`** defocusing the plate behind the text. The right instinct —
       type over film competes with window frames and faces for *edges*, so detail hurts as much as
       luminance, and blur collapses blown-out highlights rather than merely dimming them. But blur
       is a local average, and this shot has a bright window dead centre, so it dragged that
       brightness inward and left a milky patch exactly under the headline.

    What ships is **`hero-plate`**: a single `brightness(0.46) saturate(1.28) contrast(1.06)` on the
    `<video>` itself, and **nothing whatsoever on the type**. `brightness()` is a multiply, not a
    composite: blacks stay black, the range survives, saturation comes back on top, so the shot
    reads as a room lit lower rather than as a picture with something laid over it. Sharp, colourful,
    and dark enough that pure white needs no help — **5.16–7.59:1** worst case across five frames of
    the loop, against 1.15–1.91:1 untreated. It is also the cheapest of the four: one GPU-composited
    filter on one element, versus a per-frame backdrop region or a four-pass shadow chain.

    Two traps if you re-measure. **Pause the clip first** — two captures of a playing video are two
    different pictures, and diffing them cheerfully reports the treatment *brightening* the frame.
    And if you are ever isolating a text shadow again, do not hide the type with
    `color: transparent`: `drop-shadow` works off rendered alpha, so transparent glyphs cast no
    shadow either.

    The hero's secondary CTA is tinted **`bg-black/35`, not `bg-white/10`**, for a related reason:
    a white glass plate over a sunlit frame is *lighter* than the film behind it, so its label
    disappeared entirely on bright frames.
  - **Every section heading was clipping its descenders.** `SplitReveal` masks each word in an
    `overflow-hidden` box and padded it 0.14em to spare the tails of g/y/p. Measuring
    `actualBoundingBoxDescent` for the real strings in the real font found Plus Jakarta Sans
    ExtraBold reaches **0.233em**, so fourteen words across five sections were being shaved by
    3–5.6px. Not obviously "clipped" — just subtly wrong-looking type. It is 0.26em now.
- **Four gotchas that cost real time here, all worth knowing before touching landing motion:**
  1. **Scroll-linked input ranges must stay inside `[0, 1]`.** Motion hands these to the browser's
     native ScrollTimeline, where the input range becomes WAAPI keyframe *offsets* — anything
     outside that range throws `Offsets must be null or in the range [0,1]` and the error boundary
     eats the whole section. Don't rely on `useTransform` clamping a range that runs past 1.
  2. **Never branch the rendered tree on `useReducedMotion()`.** The server cannot know a visitor's
     motion preference, so `reduced ? <a/> : <b/>` (or `style={reduced ? undefined : {...}}`)
     hydration-mismatches for exactly the people who set the preference. Render one tree for
     everyone and reduce in CSS — see the `prefers-reduced-motion` block at the end of
     [`globals.css`](./src/app/globals.css), which switches off `[data-scrub-word]`,
     `[data-split-word]`, `[data-wa-bubble]`, `[data-wa-typing]`, `[data-day-*]`,
     `[data-stack-panel]`, `[data-stack-veil]`, `[data-parallax]` and `[data-spotlight]`.
     `useReducedMotion()` inside an *effect* is fine — it affects no markup.
  3. **A pinned panel cannot scroll, so its content has a hard ceiling.** `StackPanels` panels are
     exactly `h-svh`; anything taller than the viewport is silently clipped with no scrollbar and no
     error. Measure at **360×640** — the smallest realistic Android viewport once browser chrome is
     subtracted — before adding a line to a step. The fix when it is tight is always *smaller type
     and tighter gaps*, never removing copy: a phone should not get a shorter argument than a
     laptop.
  4. **`overflow-hidden` anywhere above a `position: sticky` element kills the stickiness.** That
     ancestor becomes the sticky element's scrollport, and since it does not itself scroll, the
     element never sticks — it just scrolls away looking like sticky "isn't working", when in fact
     it is working perfectly against the wrong container. The clinic-day chapter hit this twice, and
     the site header sits above every band and is itself sticky: the fix is to clip on a dedicated
     inner layer (an `absolute inset-0 overflow-hidden` div holding the glow) and leave the section
     `overflow: visible`.
- **`FeatureCard` lives under `landing/`, not `ui/`** — it imports `motion/react`, and the
  "motion only under `src/components/landing/`" rule above is a real guardrail, not a filing
  convention: it is what keeps the animation library off the phones patients open the booking page
  on. Putting a motion-dependent component in `ui/` would invite exactly that regression. It also
  takes `icon` as an **element, not a component** (`icon={<Stethoscope />}`) — it's a Client
  Component and nearly every page here is a Server Component, so a function prop cannot cross that
  boundary. Its tilt and specular run on motion values and CSS custom properties, so pointer
  movement never re-renders React, and never trips the React Compiler's no-setState-in-effect rule.
- Shared building blocks: `StatCard` (KPI tiles — Today/Reports/Operator), `FilterChips`
  (URL-driven filter pills), `EmptyState`, `PageSkeleton`, `PublicShell` / `PublicCard`,
  `initials()` in `src/lib/name.ts` (avatar fallbacks).
- **Navigation**: desktop uses the left `AppSidebar`; phones get a fixed `MobileTabbar`
  (Today · Calendar · Patients · Billing · More-sheet) — the sidebar's mobile drawer was
  retired in favour of it. Add `pb`-clearance to any full-height mobile surface.

## Operator console (platform admin)

A **platform operator** (you, the SaaS owner) can sign in and manage every clinic at `/admin`:
cross-clinic usage & revenue, WhatsApp health, and pause/unpause a clinic (which disables its
booking page and blocks its staff). Operators are identified by the `platform_admins` table — not
a clinic role — and all cross-tenant reads go through `is_platform_admin()`-gated SECURITY DEFINER
RPCs, so tenant RLS is never weakened. To promote an account (after it has signed up once):

```sql
insert into platform_admins (user_id)
select id from auth.users where email = 'you@example.com'
on conflict do nothing;
```

An operator account with no clinic of its own lands on `/admin` after login instead of onboarding.

## Local setup

1. **Install**
   ```bash
   npm install
   ```

2. **Environment** — copy `.env.example` to `.env.local` and fill in:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — from Supabase → Project Settings → API
   - `SUPABASE_SERVICE_ROLE_KEY` — same page (secret). Needed for cron, the WhatsApp webhook,
     and storing PDF attachments. Without it the app still runs; WhatsApp sends run in **dry-run**.
   - `CRON_SECRET` — any random string (protects `/api/cron/*`)
   - `WHATSAPP_*` — see **Going live with WhatsApp** below (optional for local dev)
   - `ABDM_*` — see **ABDM and FHIR** below (optional; the gateway dry-runs without them)
   - `ANTHROPIC_API_KEY` — optional; without it the AI dictation panel is simply not shown

3. **Database** — the schema lives in `supabase/migrations/`. Apply them **in order** to your
   project (via the Supabase SQL editor, the Supabase MCP, or `supabase db push`):

   | | |
   |---|---|
   | `0001` schema · `0002` RLS · `0003` seed medicines | core |
   | `0004` function hardening · `0005` onboarding RPC | v1 |
   | `0006` WhatsApp policies + storage buckets · `0007` public booking RPCs · `0008` lock `create_clinic` | v1 |
   | `0009` staff invites · `0010` slot blocks · `0011` booking OTP | v2 |
   | `0012` pre-visit intake · `0013` UPI payments | v2 |
   | `0014` platform operator console + clinic suspend · `0015` logo bucket · `0016` public logo | v4 |
   | `0017` medicine composition + dedupe index · `0018` expanded medicine seed | v7 |
   | `0019` drug interaction rules · `0020` ICD-10 codes + `visits.diagnosis_codes` | v7 |
   | `0021` ABHA fields on `patients` + `consent_artefacts` | v7 |
   | `0022` `visit-files` bucket + `visit_attachments` · `0023` lab catalogue, orders & results | v7 |
   | `0024` pharmacy (items, batches, movements, `dispense_stock`) · `0025` insurance & claims | v7 |
   | `0026` `get_display_queue` for the waiting-room board | v7 |
   | `0027` `booking_slot_rejection` + slot-validating booking RPCs · `0028` least-privilege function grants | v7 |

   These files are the complete schema — a fresh Supabase project can be built from them alone.

4. **Run**
   ```bash
   npm run dev
   ```
   Open http://localhost:3000, create an account, and complete onboarding.

### Scripts

```bash
npm run dev         # dev server
npm run build       # production build
npm run lint        # eslint
npm run typecheck   # tsc --noEmit
npm run test        # vitest unit tests (slots, phone, UPI)
npm run e2e         # playwright: public pages, auth gate, link previews
```

`npm run e2e` reuses a dev server if one is already running, otherwise starts its own.
First run needs browsers once: `npx playwright install chromium`.

## Dry-run mode

Until real Meta credentials are set, WhatsApp runs in **dry-run**: messages are queued, rendered,
and marked `sent` with a synthetic id (visible in the Messages log and each patient's WhatsApp tab),
but nothing is actually delivered. This lets you build and demo the entire flow first. The Messages
page shows a banner while dry-run is active.

## Going live with WhatsApp (Meta Cloud API)

1. Create a Meta Business Portfolio and start **business verification** early (it can take days).
2. In Meta for Developers, create an app → add **WhatsApp** → note `PHONE_NUMBER_ID` and `WABA_ID`.
   Use the free **test number** to develop against up to 5 whitelisted phones.
3. Create a **System User** and generate a permanent token → `WHATSAPP_ACCESS_TOKEN`.
4. Set the webhook to `https://<your-domain>/api/whatsapp/webhook`, verify token =
   `WHATSAPP_WEBHOOK_VERIFY_TOKEN`, and subscribe to `messages`. Set `WHATSAPP_APP_SECRET` for
   signature verification.
5. Submit the six **utility** templates (see `src/lib/whatsapp/templates.ts`) in English and Hindi.
6. Fill the `WHATSAPP_*` env vars and redeploy — sends switch from dry-run to real automatically.

## Deployment (Vercel)

- Import the repo, set all env vars from `.env.example` (including `SUPABASE_SERVICE_ROLE_KEY`
  and `CRON_SECRET`).
- `/api/cron/reminders` sends due reminders/follow-ups, retries failed messages, marks
  no-shows, and purges soft-deleted patients after 30 days. Vercel passes `CRON_SECRET` as a
  bearer token automatically. Without it the route answers **503**, not 500 — an unconfigured
  deployment should not look like a broken endpoint.

### The build does not need env vars — the running site does

`next build` completes with no environment at all (verified by building with `.env.local`
moved aside). Every Supabase call sits behind a request-time code path, so a missing variable
never fails the build — it fails **at runtime**, on a deployment that looks green. If the
deployed site renders but every data-backed page errors, check the project's env vars first;
nothing upstream will have complained.

The same goes for the database itself. Supabase pauses free-tier projects after a period of
inactivity, and a paused project's subdomain **stops resolving entirely** (`ENOTFOUND`, not a
5xx). The marketing page still renders — it degrades to the logged-out view — so the site can
look healthy while every authenticated surface is dead. Confirm the project is `ACTIVE_HEALTHY`
before blaming the deployment.

### Cron frequency is a plan limit, and it silently changes behaviour

`vercel.json` originally scheduled the cron every 15 minutes. **Vercel's Hobby plan rejects
sub-daily cron schedules at deploy time**, so that schedule cannot ship on Hobby; the committed
schedule is now once daily (`0 8 * * *`).

That change used to break reminders outright. The route looked for appointments starting inside
a fixed 15-minute window at each offset — correct only at the original cadence. Run once a day,
it inspected one 15-minute slice of each day and never saw anything else, delivering roughly 1%
of reminders while still returning `{ok: true}`. The window is gone: each run now sweeps
everything whose moment has arrived and that has not been sent, which is correct at any cadence.

Cadence still governs *quality* — a daily run cannot deliver a 2-hour reminder near its mark.
For the intended timing on Hobby, leave the daily Vercel cron as a backstop and point an
external scheduler (GitHub Actions, cron-job.org) at the endpoint every 15 minutes:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://<your-domain>/api/cron/reminders
```

On Pro, restore `*/15 * * * *` in `vercel.json` and drop the external scheduler.

### `.vercelignore`

`vercel deploy` from the CLI uploads the working directory, not the git index, so untracked
files next to the source go up with it — this repo accumulates raw video masters of tens of MB
each. `.vercelignore` keeps those, the vendored skill/agent directories, and the test output
out of every upload. Git-integration deployments only ever see committed files, so it is
belt-and-braces there and load-bearing for CLI deploys.

### `public/hero.mp4` — three properties that must hold

The shipped clip is **753KB / 3.58s**, cut from a 10s, 11MB original. Whatever tool ever
regenerates it, all three of these have to survive:

1. **Cut to the clean window.** The source carried a green particle artifact reading as a
   rendering fault across roughly its first five seconds. Score it by *worst 8×8 tile*, never
   by frame mean — a mean dilutes a localised spray below any sensible threshold and reports
   a badly damaged frame as clean. Peak green cast was 85 before the cut and is 24.9 after,
   the remainder being foliage in the shot. Because the cut is baked in, no JavaScript
   playback-window guard is needed.
2. **`-movflags +faststart`.** Puts the `moov` index ahead of `mdat` so the browser can start
   playing after a few KB instead of downloading the whole file first. An intermediate version
   of this asset lost the flag and had `moov` sitting after 2MB of `mdat`. If it is ever lost
   again the fix is a remux, not a re-encode — no frame is touched:
   `ffmpeg -i in.mp4 -c copy -movflags +faststart out.mp4`
3. **`public/hero-poster.jpg` must be frame 0 of the shipped clip.** Everyone who opts out of
   the video (reduced motion, Data Saver, 2G) sees only the poster, and everyone else sees it
   during load — so a poster taken from any other frame turns the handoff into a visible cut.

```bash
ffmpeg -ss 6.4 -i src.mp4 -t 3.55 -an -c:v libx264 -crf 26 \
       -pix_fmt yuv420p -movflags +faststart public/hero.mp4
ffmpeg -i public/hero.mp4 -frames:v 1 -q:v 4 public/hero-poster.jpg
```

## Security invariants (do not regress)

Rules that are load-bearing rather than stylistic. Each was a real defect at some point,
so each is written down.

1. **Membership is granted by code that checked an invite, never by a client.** `clinic_members`
   has **no INSERT policy**, deliberately. Rows are written only by `create_clinic()` (onboarding)
   and `accept_pending_invites()` (which matches the caller's *verified* email against a pending
   invite) — both `SECURITY DEFINER`, both bypassing RLS.

   The original policy was `with check (user_id = auth.uid())`, which proves the row is about
   *you* and never asks which clinic you are joining. Any signed-up account could therefore
   `POST /rest/v1/clinic_members` with someone else's `clinic_id` and land inside their practice,
   at which point `auth_clinic_ids()` returns their clinic and every `tenant_all` policy in the
   schema opens. The clinic uuid is not secret either — `get_booking_context` returns it to `anon`
   so the booking page can render, so every public booking link was a ready-made target.

   Measured against the live database before the fix: an account with zero memberships went from
   0 readable patient rows to 9, plus 15 appointments and 4 visit notes, on that one INSERT. See
   [`0030`](supabase/migrations/0030_tenant_isolation_and_suspension.sql).

   **If you ever need a client-side membership write, you are about to reopen this.** Add a
   definer function that checks an invite instead.
2. **RLS validates the row you write, not the rows you point at.** `tenant_all` checks the new
   row's own `clinic_id` and nothing else — a foreign key only proves a row *exists*, never whose
   it is. Any id that arrives from the client and gets stored as a reference (`patient_id`,
   `visit_id`, `invoice_id`, `payer_id`, …) must go through `firstForeignRef()` in
   [`src/lib/ownership.ts`](src/lib/ownership.ts) first.

   This is easy to apply to new modules and easy to forget in old ones: it was added to
   attachments, pharmacy, labs and insurance while `saveVisit`, `createAppointment`, `addWalkIn`
   and every payment write went without it for far longer — which is to say the three highest-
   traffic writes in the product.
3. **`suspended_at` belongs to the platform operator.** RLS has no column granularity, so
   `clinics_member_update` let the doctor of a paused clinic `PATCH` their own row and clear it.
   A `BEFORE UPDATE` trigger (`guard_clinic_suspension`) now restricts that one column to
   platform admins and the service role. Suspension is also re-checked inside `create_booking`,
   `create_verified_booking`, `issue_booking_otp`, `verify_booking_otp` and `get_display_queue` —
   it used to be consulted only while *rendering*, so a paused clinic kept taking bookings and
   serving its wall board to anyone calling the RPC directly, and the cron kept sending its
   WhatsApp reminders.
4. **A patient's export contains only that patient.** `payments` has no `patient_id` — it hangs off
   an invoice. Scope it through the patient's own invoice ids, never by `clinic_id`, or the
   DPDP data-portability export hands one patient every other patient's payment history.
5. **The public booking RPCs do not trust the browser.** `src/lib/slots.ts` decides what to *offer*;
   `booking_slot_rejection()` decides what is *accepted*. Both `create_booking` and
   `create_verified_booking` are `anon`-callable, so opening hours, closures, `slot_blocks`, the
   slot grid and the lead time are all re-checked in SQL. Keep the two in step — the block test is
   the same half-open interval comparison as `overlapsBlock()`.
6. **The WhatsApp webhook fails closed.** It is unauthenticated and writes with the service role, so
   an unsigned payload is never processed. With no `WHATSAPP_APP_SECRET` set, inbound WhatsApp is
   off (logged, still 200 so Meta keeps the subscription) rather than open to anyone who can guess
   a patient's phone number.
7. **A patient-facing form never overwrites a clinical field.** `submit_intake` is `anon`-callable
   and merges the pre-visit answers onto the patient record. It merges *blank-only* — including
   allergies, which was the one exception until [`0031`](supabase/migrations/0031_intake_allergies_blank_only.sql).

   That exception mattered because `patients.allergies` is not a note: it is the input to the drug
   interaction screen in [`src/actions/clinical.ts`](src/actions/clinical.ts). A patient reading
   "Any allergies?" and typing **"none"** — the single most likely thing anyone types in that box —
   replaced a doctor-recorded "Penicillin — anaphylaxis", and the safety panel then said nothing
   when Amoxicillin was prescribed at the next visit. The answer is still kept in
   `intake_requests.payload` and shown by `IntakePanel`, so the doctor sees what the patient said
   next to what the record says and reconciles it themselves. That is where a conflict between the
   two belongs — with the clinician, not in a last-write-wins inside an anonymous RPC.

Two platform-level traps behind several of the above:

- Functions in `public` are exposed at `/rest/v1/rpc/<name>` and Postgres grants EXECUTE to PUBLIC
  by default — new functions need an explicit `revoke … from public, anon` unless they are
  genuinely public (see `0028`).

  **But do not apply that rule to the RLS helpers.** The Supabase linter flags
  `auth_clinic_ids()`, `is_clinic_doctor()` and `is_platform_admin()` as `SECURITY DEFINER`
  functions the `authenticated` role can call, and recommends revoking EXECUTE. **Doing so takes
  the entire app down.** RLS policies are evaluated as the *querying* role, so a policy calling a
  function the caller cannot execute fails the query rather than merely denying the row — and
  **44 policies reference these three**. Verify before acting on that advice:

  ```bash
  psql -c "select count(*) from pg_policies where schemaname='public' and (coalesce(qual,'')||coalesce(with_check,'')) ~ '(auth_clinic_ids|is_clinic_doctor|is_platform_admin)'"
  ```

  They are safe as they stand: each reads only `auth.uid()`'s own memberships, so a caller learns
  nothing it could not already read through the policies these functions power.
- **Every function in `public` must pin `set search_path`.** `0033` exists only because
  `guard_clinic_suspension` — added by `0030` to stop a clinic lifting its own suspension — was
  written without one, and was the single function in the schema missing it. An unpinned path on
  the trigger guarding a security control is the wrong place to rely on an exploit being
  impractical. `select proname from pg_proc … where proconfig is null` should return nothing but
  `pg_trgm`'s own functions.
- **`src/proxy.ts` deliberately excludes `api` from its matcher**, so nothing in front of
  `/api/*` checks a session. Every API route hand-rolls its own `getUser()` guard, and those
  routes return a full medical record, a prescription PDF and the clinic's payment history. One
  forgotten guard is an unauthenticated PHI leak that no page-redirect test would catch.

**Regression cover.** These are tested, not just documented:

- [`tests/unit/ownership.test.ts`](tests/unit/ownership.test.ts) — the reference guard, including
  that an id belonging to another clinic is refused even though it is a real row a foreign key
  would accept.
- [`tests/e2e/api-auth.spec.ts`](tests/e2e/api-auth.spec.ts) — every `/api` route refuses an
  anonymous caller (the proxy will not do it for them), the cron and webhook refuse a wrong
  secret, and `anon` reads zero rows from all ten tenant tables via PostgREST and cannot insert
  into `clinic_members` or `patients`. Opens with a positive control so a bad key cannot make the
  suite pass vacuously.

  The full rule-1 exploit needs a *signed-in* account, which this suite has no fixture for; that
  half was verified directly against the database, and the reproduction lives in the header of
  [`0030`](supabase/migrations/0030_tenant_isolation_and_suspension.sql).
- [`tests/e2e/booking-rpc.spec.ts`](tests/e2e/booking-rpc.spec.ts) — attacks the booking RPC
  directly with the anon key, the way a hostile client would. Every case is a *rejection* case
  (slot validation runs before the patient find-or-create), so the suite writes nothing and is safe
  against a real project. It opens with a positive control, because if the anon key were wrong every
  attack assertion would pass vacuously. Verified by reinstalling the pre-fix function: 5 of 7
  failed, and the 2 that passed were the control and the one check the old version already had.

Vitest aliases `server-only` to a stub ([`tests/stubs/server-only.ts`](tests/stubs/server-only.ts))
so server modules can be unit tested directly instead of having their logic split out to reach it.

## Compliance notes

- **DPDP Act 2023** — per-clinic RLS on every table, patient consent + timestamp, JSON export and
  soft-delete-then-purge, privacy/terms pages. For production, host the Supabase project in the
  **Mumbai (ap-south-1)** region for data residency.
- **Telemedicine Guidelines 2020** — the Rx PDF shows the doctor's name, qualifications and
  registration number.
- **WhatsApp policy** — opt-in required (captured), utility templates only, STOP honored.

## Project layout

```
src/
  app/            routes: (auth) (app) book/[slug] api/*
  actions/        server actions per domain
  lib/
    supabase/     server / client / admin clients
    whatsapp/     client, templates, enqueue+sender, triggers
    pdf/          rx & receipt documents, render, store
    slots.ts      slot generation (unit-tested)
    billing.ts    invoice totals & numbering
  components/     ui/ (shadcn) + feature components
supabase/migrations/   all DDL
tests/unit/            vitest specs
```
