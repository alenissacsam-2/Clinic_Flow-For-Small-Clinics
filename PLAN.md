# PLAN — Clinic/Patient Management SaaS for Solo Doctors (India, WhatsApp-first)

> **Execution note:** On approval, step 0.1 copies this document into the project as `D:\Dev\Mini Startups\Solo Doctors\PLAN.md` so it lives with the code and can be checked off as we build.

---

## 0. Context

Solo doctors in India (GPs, pediatricians, dermatologists, dentists, ENT running their own OPD) mostly manage patients with paper registers, phone calls, and their **personal** WhatsApp. Existing products (Practo Ray, HealthPlix, Eka Care) target bigger clinics, push marketplace agendas, or are bloated. The wedge: **a simple, fast clinic app where WhatsApp is the patient-communication channel** — confirmations, reminders, prescription PDFs, and payment receipts land in the patient's WhatsApp automatically, with zero effort from the doctor.

**Decisions locked with user:**
| Decision | Choice |
|---|---|
| Market | India first |
| WhatsApp depth (v1) | One-way notifications + reminders (no chatbot) |
| Stack | Next.js + Supabase + Vercel |
| MVP scope | Full: patients, appointments, visits, prescriptions, billing, public booking page, WhatsApp automation |

**Success criteria for v1:** a pilot doctor can run a full clinic day (walk-ins + online bookings), every patient gets confirmation/reminder/Rx-PDF/receipt on WhatsApp, and the doctor sees revenue + no-show stats — all without touching paper.

---

## 1. Product Specification

### 1.1 Personas
- **Dr. Solo** (primary): 30–55, runs own OPD, 20–60 patients/day, comfortable with WhatsApp, hates typing. Uses a laptop or tablet at the desk.
- **Receptionist** (secondary, optional): manages bookings/queue/payments on the same account (v1: shared login or second `staff` member).
- **Patient** (indirect): only touches the public booking page and receives WhatsApp messages. Never installs anything.

### 1.2 User stories (v1, explicit)

**Onboarding**
- As a doctor, I sign up with email or Google, and a wizard collects: clinic name → my name, qualifications, medical registration number, specialty → clinic address & phone → consultation fee → weekly hours → clinic slug (auto-suggested, editable) → logo (optional).
- After the wizard I land on an onboarding checklist (add first patient, set hours, share booking link).

**Patients**
- Create a patient in <15 seconds: name + mobile number are the only required fields (gender, age/DOB, address, blood group, allergies, chronic conditions, tags optional).
- WhatsApp consent checkbox (default ON, timestamp recorded) at creation — required by Meta policy and DPDP.
- Search patients instantly by name or phone (search-as-you-type).
- Patient profile shows tabs: Overview | Visits | Prescriptions | Invoices | WhatsApp log.
- Export a patient's full record (JSON + printable PDF); delete a patient (soft-delete, hard purge after 30 days) — DPDP requirements.

**Appointments & queue**
- Calendar with Day and Week views built from the clinic's availability grid (slot length from settings, default 15 min).
- Book for an existing or new patient in one dialog; reschedule via drag or edit; cancel with optional reason.
- Walk-in quick-add: one tap adds patient to today's queue with the next token number.
- **Today screen** (the doctor's home): ordered token list with statuses `pending → confirmed → arrived → in_progress → completed / no_show / cancelled`; one tap moves status; tapping "Start visit" opens the visit form pre-linked.
- Online bookings arrive as `pending` with an Accept / Reject control; accepting fires the WhatsApp confirmation.

**Visits (EMR-lite)**
- Visit form optimized for <60 seconds: vitals (BP, pulse, temp, weight, SpO₂ — all optional), complaints, diagnosis, advice, follow-up date picker.
- Previous visits visible in a side panel while writing the current one.

**Prescriptions**
- Rx builder inside the visit: medicine autocomplete (seeded list of ~1–2k common Indian brand/generic drugs, per-clinic custom additions), dosage shortcut chips (`1-0-1`, `1-1-1`, `0-0-1`, `SOS`), duration (days), instructions (before/after food, custom).
- "Finalize & Send" generates a branded PDF (letterhead: logo, clinic name/address/phone; doctor name, qualifications, **registration number** — required by Telemedicine Practice Guidelines 2020; patient details; Rx table; advice; follow-up date; signature line) → stores in private bucket → sends to patient's WhatsApp as a document message.
- Reprint/resend from the patient profile any time.

**Billing**
- On completing a visit, an invoice is auto-drafted with the consultation fee; doctor can add line items (procedure, dressing, injection…).
- Record payment: amount + mode (cash / UPI / card), supports partial payments.
- Receipt PDF sent to WhatsApp on full payment.
- Reports page: revenue by day/week/month (chart + table), payment-mode split, outstanding balances, CSV export.
- Per-clinic sequential invoice numbers: `INV-{YY}-{0001}`.

**Public booking page**
- `https://<domain>/book/[slug]` — mobile-first, no login: clinic name/logo/address/hours → next-7-days slot picker (server-computed: availability minus overrides minus booked slots) → patient enters name, mobile, reason (optional), WhatsApp-consent checkbox → creates `pending` appointment → "Thanks, you'll get a WhatsApp confirmation once the clinic confirms."
- Abuse protection: rate-limit per IP and per phone (max 3 pending bookings/phone), same-slot double-booking prevented by a DB constraint.

**WhatsApp automation (all outbound, template-based)**
- Booking confirmed → `appt_confirmed`
- 24h before and 2h before (offsets configurable in settings) → `appt_reminder`
- Cancellation → `appt_cancelled`
- Rx finalized → `prescription_doc` (with PDF)
- Payment completed → `payment_receipt` (with PDF)
- Follow-up due (daily scan, 1 day before follow-up date) → `followup_due` (with booking link)
- Inbound handling (minimal, v1): `STOP` → opt-out flag; `CANCEL` → flags the appointment "cancellation requested" for doctor review; anything else → stored, visible in patient's WhatsApp log tab. No outbound free-text replies in v1.
- Every send checks `whatsapp_opt_in = true`.

**Dashboard & settings**
- Dashboard cards: today's appointments, completed, revenue today/this week, no-show rate (30d), pending online bookings.
- Settings: clinic profile, doctor credentials, hours & slot length, fees, reminder offsets, template language (English/Hindi), logo, booking page on/off, data export.

### 1.3 Explicitly OUT of v1 (backlog for v2+)
Two-way WhatsApp bot / shared inbox · per-doctor WhatsApp numbers (Embedded Signup) · online prepayment (Razorpay) · ABDM/ABHA integration · labs/inventory/pharmacy · multi-doctor clinics · telemedicine video · patient app · Hindi UI for the doctor dashboard (booking page + WhatsApp templates ARE bilingual in v1).

---

## 2. Compliance Requirements (build-time constraints)

1. **DPDP Act 2023** (health data = sensitive): Supabase project in **Mumbai (ap-south-1)**; consent checkbox + timestamp stored per patient; per-tenant RLS on every table; patient export + delete; privacy policy & terms pages; no PHI in URLs or logs.
2. **Meta WhatsApp Business / Commerce Policy**: healthcare allowed; opt-in mandatory (we record it); business-initiated messages must use approved **utility** templates; honor opt-out; no clinical details in template text (PDF attachments are fine).
3. **Telemedicine Practice Guidelines 2020**: Rx PDF must display doctor name, qualifications, registration number, and signature space.

---

## 3. Architecture

```
┌─────────────────────────────────────────────┐
│ Next.js 15 App Router on Vercel             │
│                                             │
│  (auth)  /login /signup /onboarding         │
│  (app)   /today /calendar /patients /billing│
│          /messages /reports /settings       │
│  (public)/book/[slug]  /privacy /terms      │
│                                             │
│  Route handlers:                            │
│   POST/GET /api/whatsapp/webhook  ← Meta    │
│   GET  /api/cron/reminders        ← Vercel  │
│        Cron */15 min, CRON_SECRET-protected │
│  Server Actions: all app mutations          │
└──────────────┬──────────────────────────────┘
               │  @supabase/ssr (RLS, anon key)
               │  service-role key: server-only
┌──────────────▼──────────────────────────────┐
│ Supabase (ap-south-1 Mumbai)                │
│  Postgres + RLS  ·  Auth (email, Google)    │
│  Storage: buckets `rx-pdfs` `receipts`      │
│           `logos` (rx/receipts private)     │
└──────────────┬──────────────────────────────┘
               │ HTTPS (server-side only)
┌──────────────▼──────────────────────────────┐
│ Meta WhatsApp Cloud API (graph.facebook.com)│
│  Platform-owned number · utility templates  │
└─────────────────────────────────────────────┘
```

### 3.1 Key architectural decisions & rationale

| Decision | Choice | Why |
|---|---|---|
| WhatsApp provider | **Meta Cloud API direct** (no BSP) | No per-message markup. India utility messages ≈ ₹0.115–0.13 each → a 1,500-msg/month clinic costs ~₹180–200. BSPs (Gupshup/WATI/AiSensy) add fees + another dashboard. |
| Sender number model (v1) | **One platform-owned number** for all clinics; template body carries clinic + doctor name | A doctor's personal number cannot be used on Cloud API while staying on their phone app. Per-doctor numbers need Meta Tech Provider status + Embedded Signup — deferred to v2. |
| Outbound pipeline | **Postgres queue** (`wa_messages`) → sender → webhook status updates | Retries, audit trail, per-patient message timeline, idempotency — all from one table. Never call Meta directly from UI actions. |
| Scheduling | **Vercel Cron** → `/api/cron/reminders` every 15 min | One codebase, no pg_cron/Edge Function split. 15-min granularity is fine for 24h/2h reminders. |
| PDFs | `@react-pdf/renderer` in a server action → Supabase Storage → WhatsApp `document` message via 24h signed URL | React-y templating, no headless browser needed on Vercel. |
| Multi-tenancy | `clinic_id` on every row + RLS via `clinic_members` | Standard Supabase pattern; booking page uses service-role **server-side only**. |
| Time | Store UTC `timestamptz`; render Asia/Kolkata | Single-timezone country but avoids DST-style bugs and keeps v2 options open. |
| Client data layer | Server Components + Server Actions by default; TanStack Query only for the live queue/calendar | Minimal client JS; queue needs polling/refresh. |
| Validation | Zod schemas shared between forms and server actions | One source of truth. |

### 3.2 Directory structure (target)

```
solo-doctors/
├─ PLAN.md                        ← this document
├─ .env.local / .env.example
├─ next.config.ts
├─ package.json
├─ supabase/
│  ├─ migrations/
│  │  ├─ 0001_schema.sql
│  │  ├─ 0002_rls.sql
│  │  └─ 0003_seed_medicines.sql
│  └─ config.toml
├─ src/
│  ├─ app/
│  │  ├─ (auth)/login/page.tsx  signup/page.tsx  onboarding/page.tsx
│  │  ├─ (app)/                       ← authed layout w/ sidebar
│  │  │  ├─ today/page.tsx
│  │  │  ├─ calendar/page.tsx
│  │  │  ├─ patients/page.tsx  patients/[id]/page.tsx
│  │  │  ├─ billing/page.tsx   billing/[invoiceId]/page.tsx
│  │  │  ├─ messages/page.tsx
│  │  │  ├─ reports/page.tsx
│  │  │  └─ settings/…
│  │  ├─ (public)/book/[slug]/page.tsx   privacy/  terms/
│  │  └─ api/
│  │     ├─ whatsapp/webhook/route.ts    ← GET verify + POST events
│  │     └─ cron/reminders/route.ts
│  ├─ actions/                    ← server actions per domain
│  │  ├─ patients.ts appointments.ts visits.ts prescriptions.ts
│  │  ├─ invoices.ts payments.ts settings.ts booking.ts
│  ├─ lib/
│  │  ├─ supabase/{server.ts,client.ts,admin.ts}
│  │  ├─ whatsapp/{client.ts,templates.ts,enqueue.ts,sender.ts}
│  │  ├─ pdf/{rx-document.tsx,receipt-document.tsx,generate.ts}
│  │  ├─ slots.ts                 ← availability → open-slot computation
│  │  ├─ validation/*.ts          ← zod schemas
│  │  └─ utils.ts (IST formatting, phone E.164 normalization)
│  ├─ components/  (ui/ = shadcn, domain components per feature)
│  └─ types/database.ts           ← supabase gen types
└─ tests/
   ├─ unit/ (slots, invoice-numbering, template-params)
   ├─ integration/rls.test.ts
   └─ e2e/booking.spec.ts (Playwright)
```

### 3.3 Environment variables

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=          # server only
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_BUSINESS_ACCOUNT_ID=
WHATSAPP_ACCESS_TOKEN=              # permanent system-user token
WHATSAPP_WEBHOOK_VERIFY_TOKEN=      # random string we choose
WHATSAPP_APP_SECRET=                # for X-Hub-Signature-256 verification
CRON_SECRET=                        # Vercel cron auth
NEXT_PUBLIC_APP_URL=
SENTRY_DSN=                         # phase 6
```

---

## 4. Database Schema (migration `0001_schema.sql`, explicit)

```sql
-- ENUMS
create type appointment_status as enum
  ('pending','confirmed','arrived','in_progress','completed','no_show','cancelled');
create type appointment_source as enum ('walk_in','staff','online');
create type invoice_status as enum ('unpaid','partial','paid','void');
create type payment_mode as enum ('cash','upi','card','other');
create type wa_status as enum ('queued','sending','sent','delivered','read','failed');
create type member_role as enum ('doctor','staff');

create table clinics (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,                        -- booking URL
  doctor_name text not null,
  qualifications text,                              -- "MBBS, MD"
  registration_no text,                             -- medical council reg — printed on Rx
  specialty text,
  address text, phone text, email text,
  logo_path text,
  settings jsonb not null default '{
    "slot_minutes": 15,
    "consultation_fee": 300,
    "reminder_offsets_hours": [24, 2],
    "template_lang": "en",
    "booking_enabled": true,
    "timezone": "Asia/Kolkata"
  }'::jsonb,
  created_at timestamptz not null default now()
);

create table clinic_members (
  clinic_id uuid not null references clinics(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role member_role not null default 'doctor',
  primary key (clinic_id, user_id)
);

create table patients (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  full_name text not null,
  phone text not null,                              -- E.164: +91XXXXXXXXXX
  gender text, dob date, age_years int,             -- either dob or age
  address text, blood_group text,
  allergies text, chronic_conditions text,
  tags text[] not null default '{}',
  whatsapp_opt_in boolean not null default true,
  consent_at timestamptz,
  notes text,
  deleted_at timestamptz,                           -- soft delete (DPDP)
  created_at timestamptz not null default now()
);
create index on patients (clinic_id, phone);
create index patients_name_trgm on patients using gin (full_name gin_trgm_ops); -- needs pg_trgm

create table availability (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  weekday int not null check (weekday between 0 and 6),   -- 0=Sunday
  start_time time not null, end_time time not null
);                                                        -- multiple rows = morning/evening sessions

create table availability_overrides (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  date date not null,
  closed boolean not null default true,
  start_time time, end_time time,                         -- if closed=false: custom hours
  unique (clinic_id, date)
);

create table appointments (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  patient_id uuid not null references patients(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status appointment_status not null default 'confirmed',
  source appointment_source not null default 'staff',
  reason text,
  token_number int,                                       -- per clinic-day sequence
  cancellation_requested boolean not null default false,  -- set by inbound "CANCEL"
  reminders_sent int[] not null default '{}',             -- offsets already sent, e.g. {24,2}
  created_at timestamptz not null default now()
);
create index on appointments (clinic_id, starts_at);
-- prevent double-booking the same live slot:
create unique index appointments_slot_uniq on appointments (clinic_id, starts_at)
  where status in ('pending','confirmed','arrived','in_progress');

create table visits (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  appointment_id uuid references appointments(id) on delete set null,
  patient_id uuid not null references patients(id) on delete cascade,
  visit_date date not null default (now() at time zone 'Asia/Kolkata')::date,
  vitals jsonb not null default '{}',                     -- {bp_sys,bp_dia,pulse,temp_f,weight_kg,spo2}
  complaints text, diagnosis text, advice text,
  followup_date date,
  followup_notified_at timestamptz,
  created_at timestamptz not null default now()
);

create table medicines (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid references clinics(id) on delete cascade, -- NULL = global seed row
  name text not null, form text, strength text             -- "Tab" "500 mg"
);
create index medicines_name_trgm on medicines using gin (name gin_trgm_ops);

create table prescriptions (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  visit_id uuid not null references visits(id) on delete cascade,
  patient_id uuid not null references patients(id) on delete cascade,
  pdf_path text,                                          -- storage path in rx-pdfs bucket
  finalized_at timestamptz,
  created_at timestamptz not null default now()
);

create table prescription_items (
  id uuid primary key default gen_random_uuid(),
  prescription_id uuid not null references prescriptions(id) on delete cascade,
  position int not null,
  medicine_name text not null,                            -- denormalized on purpose
  dosage text,                                            -- "1-0-1"
  duration_days int,
  instructions text                                       -- "After food"
);

create table invoices (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  patient_id uuid not null references patients(id) on delete cascade,
  visit_id uuid references visits(id) on delete set null,
  invoice_no text not null,                               -- INV-26-0001 (per-clinic counter)
  status invoice_status not null default 'unpaid',
  total_amount numeric(10,2) not null default 0,
  created_at timestamptz not null default now(),
  unique (clinic_id, invoice_no)
);

create table invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices(id) on delete cascade,
  description text not null,
  qty int not null default 1,
  unit_price numeric(10,2) not null
);

create table invoice_counters (                            -- race-safe numbering
  clinic_id uuid primary key references clinics(id) on delete cascade,
  year int not null,
  last_no int not null default 0
);

create table payments (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  invoice_id uuid not null references invoices(id) on delete cascade,
  amount numeric(10,2) not null,
  mode payment_mode not null,
  receipt_pdf_path text,
  paid_at timestamptz not null default now()
);

create table wa_messages (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  patient_id uuid references patients(id) on delete set null,
  to_phone text not null,
  direction text not null default 'out',                  -- out | in
  template_name text,                                     -- null for inbound
  params jsonb not null default '{}',
  document_path text,                                     -- storage path for attached PDF
  body text,                                              -- inbound message text
  status wa_status not null default 'queued',
  wa_message_id text,                                     -- Meta's id, for status webhooks
  error text,
  attempts int not null default 0,
  related_type text, related_id uuid,                     -- 'appointment'|'prescription'|'payment'
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index on wa_messages (status, created_at);
create index on wa_messages (wa_message_id);
create index on wa_messages (clinic_id, patient_id, created_at);
-- idempotency: one reminder per appointment per offset
create unique index wa_reminder_uniq on wa_messages (related_id, template_name, (params->>'offset'))
  where template_name = 'appt_reminder';
```

### 4.1 RLS (migration `0002_rls.sql`, pattern)

```sql
alter table patients enable row level security;  -- …and every domain table

create policy tenant_all on patients for all
  using (clinic_id in (select clinic_id from clinic_members where user_id = auth.uid()))
  with check (clinic_id in (select clinic_id from clinic_members where user_id = auth.uid()));
-- Repeat per table. clinics: member-read/update, insert allowed for authed users (onboarding).
-- clinic_members: user can read own rows; inserts via onboarding server action.
-- medicines: readable if clinic_id is null OR member; writes only for own clinic rows.
-- wa_messages: member read; writes happen via service-role (enqueue/sender/webhook).
-- Public booking page NEVER uses anon client — server actions with service role + zod validation.
```

Storage buckets: `rx-pdfs` (private), `receipts` (private), `logos` (public). Rx/receipt access only via short-lived signed URLs generated server-side.

---

## 5. WhatsApp Integration — Explicit Design

### 5.1 One-time Meta setup (manual checklist, start day 1 — slowest external dependency)
1. Create Meta Business Portfolio → submit **business verification** (needs a website + business docs; can take days–weeks).
2. Create Meta App (type: Business) → add WhatsApp product → note `WABA_ID`, `PHONE_NUMBER_ID`.
3. Use the **free test number** immediately (send to 5 whitelisted phones) — all development happens on this.
4. Buy/assign a real phone number (a virtual number works; it must not be an active personal WhatsApp) + set display name.
5. Create a **System User** → generate a permanent access token with `whatsapp_business_messaging` scope.
6. Configure webhook: URL `https://<app>/api/whatsapp/webhook`, verify token = `WHATSAPP_WEBHOOK_VERIFY_TOKEN`, subscribe to `messages`.
7. Submit templates (below) in English + Hindi for the **utility** category.

### 5.2 Templates (submit exactly these; params numbered)

| Name | Category | Header | Body |
|---|---|---|---|
| `appt_confirmed` | utility | — | Your appointment with {{1}} at {{2}} is confirmed for {{3}} at {{4}}. Token no: {{5}}. |
| `appt_reminder` | utility | — | Reminder: your appointment with {{1}} at {{2}} is on {{3}} at {{4}}. Reply CANCEL if you cannot come. |
| `appt_cancelled` | utility | — | Your appointment at {{1}} on {{2}} has been cancelled. Call {{3}} to rebook. |
| `prescription_doc` | utility | DOCUMENT | Hello {{1}}, here is your prescription from {{2}}. Get well soon! |
| `payment_receipt` | utility | DOCUMENT | Hello {{1}}, payment of ₹{{2}} received at {{3}}. Receipt attached. Thank you! |
| `followup_due` | utility | — | Hello {{1}}, {{2}} advised a follow-up visit around {{3}}. Book here: {{4}} |

Rules: no promo language (rejection risk), no clinical details in body text (PDF carries those), each has an `en` and `hi` version; clinic settings choose which is sent.

### 5.3 Runtime pipeline

```
UI/server action ──insert──► wa_messages(status=queued)
                               │  fire-and-forget trySend(id)
                               ▼
                    sender: claims row (status queued→sending, attempts+1)
                    POST graph.facebook.com/v21.0/{PHONE_NUMBER_ID}/messages
                      { to, type:"template",
                        template:{ name, language:{code},
                          components:[ {type:"header", parameters:[{type:"document",
                              document:{ link: <24h signed URL>, filename }}]},   -- doc templates only
                            {type:"body", parameters:[{type:"text",text:p1},…]} ] } }
                      ok  → status=sent, wa_message_id stored
                      err → status=failed, error stored (retried by cron sweep ≤3 attempts)
                               ▲
Webhook POST /api/whatsapp/webhook ◄── Meta
  · verify X-Hub-Signature-256 with WHATSAPP_APP_SECRET (reject otherwise)
  · statuses[] → match wa_message_id → update status sent→delivered→read / failed(+error)
  · messages[] (inbound) → insert wa_messages(direction='in'), match patient by phone:
      body ~ /^stop$/i    → patients.whatsapp_opt_in=false
      body ~ /^cancel$/i  → next upcoming appointment.cancellation_requested=true
GET  /api/whatsapp/webhook → hub.challenge echo (verification handshake)
```

`enqueue()` contract (in `lib/whatsapp/enqueue.ts`): `enqueueWhatsApp({clinicId, patientId, template, params, documentPath?, relatedType?, relatedId?})` — checks `whatsapp_opt_in`, resolves language from clinic settings, inserts row, calls `trySend` without awaiting. **This is the only way any feature sends WhatsApp.**

### 5.4 Cron (`/api/cron/reminders`, every 15 min, `Authorization: Bearer CRON_SECRET`)
1. **Reminders:** for each clinic, for each configured offset H: select confirmed appointments where `starts_at` between `now()+H` and `now()+H+15min` and `H not in reminders_sent` → enqueue `appt_reminder`, append H to `reminders_sent`.
2. **Follow-ups:** visits where `followup_date = tomorrow (IST)` and `followup_notified_at is null` → enqueue `followup_due`, stamp.
3. **Retry sweep:** `wa_messages` where `status='failed' and attempts<3` or stuck `sending>10min` → re-send.
4. **No-show marking:** confirmed/arrived appointments whose `ends_at < now() - 3h` (same IST day) → `no_show`.

### 5.5 Cost model (India, per-message pricing since Jul 2025)
Utility ≈ ₹0.115–0.13/msg. Per patient visit ≈ 4 msgs (confirm, 2 reminders, Rx) ≈ ₹0.50. Clinic at 40 patients/day, 25 days ≈ 1,000 visits → **~₹500–600/month WhatsApp cost** worst case; realistically less (walk-ins skip confirm/reminders). Priced into subscription.

---

## 6. Core Algorithms (explicit)

### 6.1 Slot generation (`lib/slots.ts`)
```
getOpenSlots(clinicId, dateRange):
  sessions   = availability rows for weekday(date)        (IST)
  overrides  = availability_overrides for date  → closed? skip day : replace hours
  slots      = tile sessions by settings.slot_minutes
  booked     = appointments in (pending|confirmed|arrived|in_progress) for that day
  return slots − booked − past(now + 30min lead time)
```
Used by both the calendar UI and the public booking page (single source of truth). Unit-test heavily: weekday boundaries in IST vs UTC, overrides, lead time, slot-length changes.

### 6.2 Token numbers
On creating an appointment for day D: `token_number = count(existing appointments for clinic, IST-day D) + 1` inside the same transaction. Walk-ins and booked patients share one sequence.

### 6.3 Invoice numbering (race-safe)
`update invoice_counters set last_no = last_no + 1 where clinic_id = $1 returning last_no` (upsert on first use; reset when `year` changes) → format `INV-{YY}-{padded}`.

### 6.4 Phone normalization
All phones stored E.164. Input `98765 43210` → `+919876543210`. Zod refinement + `normalizePhone()` util; WhatsApp `to` field uses digits without `+`.

---

## 7. Screens & Components (explicit inventory)

| Route | Screen | Key components |
|---|---|---|
| `/login`, `/signup` | Auth | shadcn form + Supabase Auth (email + Google) |
| `/onboarding` | 5-step wizard | ClinicForm, DoctorForm, HoursEditor (weekday grid), FeeForm, SlugPicker |
| `/today` | **Queue (home)** | QueueList (token cards w/ status buttons), PendingBookingsBanner (accept/reject), WalkInDialog, StartVisitButton |
| `/calendar` | Day/Week calendar | SlotGrid, AppointmentDialog (patient search-or-create), RescheduleMenu |
| `/patients` | List + search | PatientTable, SearchInput (debounced trgm search), NewPatientDialog |
| `/patients/[id]` | Profile | ProfileHeader, Tabs: OverviewTab, VisitsTab, RxTab (resend button), InvoicesTab, WhatsAppLogTab (bubbles + status ticks), ExportButton, DeleteButton |
| `/today` → visit sheet | Visit form | VitalsRow, TextAreas, RxBuilder (MedicineAutocomplete, DosageChips, RxItemRow), FinalizeAndSendButton, PrevVisitsPanel |
| `/billing` | Invoices | InvoiceTable (filter by status/date), RecordPaymentDialog |
| `/billing/[invoiceId]` | Invoice detail | LineItemsEditor, PaymentHistory, SendReceiptButton |
| `/messages` | Clinic-wide WA log | MessageTable (status filter, failed-retry button) |
| `/reports` | Revenue | RevenueChart (recharts), ModeSplit, OutstandingTable, CsvExportButton |
| `/settings/*` | Settings | ClinicProfileForm, HoursEditor (reused), TemplatesLangPicker, ReminderOffsetsForm, LogoUpload, DataExport |
| `/book/[slug]` | Public booking | ClinicHeader, DayTabs (7 days), SlotPicker, BookingForm (name/phone/reason/consent), SuccessScreen |
| `/privacy`, `/terms` | Static | Markdown pages |

Design system: shadcn/ui defaults, `Inter` font, one accent color, mobile-responsive throughout (booking page mobile-first; dashboard optimized for laptop/tablet).

---

## 8. Build Phases — Explicit Task Checklists

### Phase 0 — Foundation
- [ ] 0.1 Copy this plan to `PLAN.md` in project root; `git init`
- [ ] 0.2 Scaffold: `create-next-app` (TS, App Router, Tailwind) + shadcn/ui init + deps (`@supabase/ssr`, `@supabase/supabase-js`, `zod`, `@tanstack/react-query`, `date-fns`, `date-fns-tz`, `@react-pdf/renderer`, `recharts`)
- [ ] 0.3 Create Supabase project (**Mumbai**); enable `pg_trgm`; run migrations `0001`–`0003`; `supabase gen types typescript` → `types/database.ts`
- [ ] 0.4 Storage buckets `rx-pdfs`, `receipts` (private), `logos` (public)
- [ ] 0.5 Auth wiring (`lib/supabase/{server,client,admin}.ts`, middleware session refresh), login/signup pages
- [ ] 0.6 Onboarding wizard → creates `clinics` + `clinic_members` + `availability` + `invoice_counters`
- [ ] 0.7 App shell: sidebar layout, auth guard, empty pages for all routes
- [ ] 0.8 Deploy to Vercel (envs set), CI = typecheck + lint + unit tests on push
- [ ] 0.9 **Kick off Meta business verification in parallel** (§5.1 steps 1–3)

### Phase 1 — Patients + Appointments
- [ ] 1.1 Patient CRUD server actions + zod; NewPatientDialog; E.164 normalization; consent capture
- [ ] 1.2 Patients list with trgm search; patient profile shell with tabs
- [ ] 1.3 `lib/slots.ts` + unit tests (IST edges, overrides, lead time)
- [ ] 1.4 Calendar day/week views; AppointmentDialog (search-or-create patient); reschedule/cancel
- [ ] 1.5 Today queue: token generation, status transitions, WalkInDialog
- [ ] 1.6 Availability editor in settings (weekday sessions + holiday overrides)

### Phase 2 — Visits + Prescriptions
- [ ] 2.1 Visit form sheet from queue ("Start visit"); vitals + text fields; PrevVisitsPanel
- [ ] 2.2 Seed `0003_seed_medicines.sql` (~1–2k common Indian meds); MedicineAutocomplete with per-clinic additions
- [ ] 2.3 RxBuilder (items, dosage chips, duration, instructions)
- [ ] 2.4 Rx PDF via `@react-pdf/renderer` (letterhead, credentials + reg no, Rx table, follow-up, signature space) → upload to `rx-pdfs`
- [ ] 2.5 Finalize flow: lock Rx, generate PDF, (Phase 3 wires the send); resend/reprint from profile

### Phase 3 — WhatsApp engine  *(depends on Meta test number from 0.9)*
- [ ] 3.1 `lib/whatsapp/client.ts` (Graph API wrapper) + `templates.ts` (param builders per template, en/hi)
- [ ] 3.2 `enqueue.ts` + `sender.ts` with claim/attempts logic
- [ ] 3.3 Webhook route: GET handshake, POST signature verification, status updates, inbound STOP/CANCEL handling
- [ ] 3.4 Wire triggers: confirm→`appt_confirmed`, cancel→`appt_cancelled`, Rx finalize→`prescription_doc`, accept-online-booking→`appt_confirmed`
- [ ] 3.5 Cron route: reminders (offset dedupe via `reminders_sent`), follow-ups, retry sweep, no-show marking; `vercel.json` cron entry
- [ ] 3.6 UI: WhatsAppLogTab on patient profile (bubbles + delivery ticks), `/messages` clinic log with retry
- [ ] 3.7 E2E on test number with 2 whitelisted phones (full matrix in §9)

### Phase 4 — Billing
- [ ] 4.1 Auto-draft invoice on visit completion (consultation fee from settings); LineItemsEditor
- [ ] 4.2 Race-safe numbering via `invoice_counters`
- [ ] 4.3 RecordPaymentDialog (partial payments → status math); receipt PDF; `payment_receipt` send
- [ ] 4.4 `/billing` list + filters; `/reports` revenue chart, mode split, outstanding, CSV export

### Phase 5 — Public booking page
- [ ] 5.1 `/book/[slug]` server-rendered (service role): clinic header + 7-day SlotPicker from `getOpenSlots`
- [ ] 5.2 BookingForm → server action: rate-limit (IP + phone, max 3 pending/phone), create/find patient, create `pending` appointment (unique slot index handles races)
- [ ] 5.3 PendingBookingsBanner on Today: accept (→confirm + WhatsApp) / reject
- [ ] 5.4 Playwright E2E: book, double-book blocked, rate-limit works
- [ ] 5.5 Booking on/off toggle in settings

### Phase 6 — Polish & launch
- [ ] 6.1 Dashboard cards on Today (counts, revenue, no-show %, pending bookings)
- [ ] 6.2 Empty states, loading skeletons, error boundaries, onboarding checklist
- [ ] 6.3 DPDP: patient export (JSON + PDF), soft-delete + purge job, privacy/terms pages
- [ ] 6.4 Sentry + Vercel Analytics; log scrubbing (no PHI)
- [ ] 6.5 Switch WhatsApp from test number → verified production number; re-verify webhook; template approval confirmed
- [ ] 6.6 Full simulated clinic day (§9.4) → fix list → pilot doctor onboarding

---

## 9. Verification Plan

### 9.1 Unit (Vitest)
- `slots.ts`: weekday mapping in IST (a 11:30 pm UTC slot is next-day IST), overrides, lead time, slot-length change mid-week
- Invoice numbering: concurrent increments (simulate), year rollover
- Template param builders: every template × en/hi renders expected params
- `normalizePhone`: `98765 43210`, `098…`, `+91…`, garbage → error

### 9.2 Integration
- RLS suite against local Supabase: user A (clinic A) cannot select/update/insert rows of clinic B on every table; anon key cannot touch anything without membership
- Webhook: valid vs invalid `X-Hub-Signature-256`; status transition ordering; inbound STOP/CANCEL side effects

### 9.3 WhatsApp E2E (Meta test number, 2 whitelisted phones)
- Book → confirm → confirmation received with correct params
- Set appointment ~24h/2h out (or temporarily shrink offsets) → cron → reminders arrive once each (idempotency)
- Finalize Rx → PDF document arrives, opens correctly on phone
- Record full payment → receipt arrives
- Reply STOP → next enqueue is skipped; reply CANCEL → appointment flagged in UI
- Kill network mid-send → retry sweep recovers

### 9.4 Simulated clinic day (manual, in-app browser)
Fake clinic, 10 patients: 4 walk-ins, 4 online bookings (accept 3, reject 1), 1 reschedule, 1 no-show; visits + Rx for 7; invoices/payments (1 partial); verify Today queue flow, message log statuses, reports numbers reconcile, patient export works.

---

## 10. Risks & Mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| Meta business verification takes weeks | High | Start day 1 (task 0.9); everything develops on test number |
| Template rejection | Medium | Utility-only wording (§5.2), no promo language; submit early; fallback copy ready |
| Messages "not from my doctor" (platform number) | Medium | Clinic+doctor name in every template; v2 = Embedded Signup per-doctor numbers |
| Doctor won't type during consults | High | Today-queue speed, optional-first visit fields, dosage chips; Rx is the only must-type surface |
| Duplicate reminders / message storms | Medium | `reminders_sent` array + unique partial index + attempts cap |
| DPDP exposure | Low | Mumbai region, RLS everywhere, consent trail, export/delete, no PHI in logs/URLs |
| Slot race on booking page | Medium | Unique partial index on (clinic_id, starts_at) — DB is the arbiter |

## 11. Business Framing (brief, for context)

- **Pricing:** 14-day free trial → ~₹750–1,000/month flat (WhatsApp COGS ≤ ₹600/clinic worst case → healthy margin), annual discount. 
- **GTM:** 3–5 pilot doctors onboarded personally (free 3 months) → testimonials → local medical-association/pharma-rep channels → self-serve.
- **Pre-work:** pick product name + domain **before** Meta verification (display name changes are painful).

## 12. Execution Order

Phase 0 → 1 → 2 → 3 → 4 → 5 → 6. Meta verification runs in parallel from day 1. The app is demoable to a pilot doctor after Phase 3 (core loop + WhatsApp), fully launchable after Phase 6.
