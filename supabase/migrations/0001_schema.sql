-- ════════════════════════════════════════════════════════════════
-- 0001_schema.sql — Solo Doctors core schema
-- Multi-tenant clinic management. Every domain row carries clinic_id.
-- ════════════════════════════════════════════════════════════════

create extension if not exists pg_trgm;

-- ─── Enums ──────────────────────────────────────────────────────
create type appointment_status as enum
  ('pending','confirmed','arrived','in_progress','completed','no_show','cancelled');
create type appointment_source as enum ('walk_in','staff','online');
create type invoice_status     as enum ('unpaid','partial','paid','void');
create type payment_mode       as enum ('cash','upi','card','other');
create type wa_status          as enum ('queued','sending','sent','delivered','read','failed');
create type wa_direction       as enum ('out','in');
create type member_role        as enum ('doctor','staff');

-- ─── Clinics & membership ───────────────────────────────────────
create table clinics (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  slug            text not null unique,
  doctor_name     text not null,
  qualifications  text,
  registration_no text,
  specialty       text,
  address         text,
  phone           text,
  email           text,
  logo_path       text,
  settings        jsonb not null default '{
    "slot_minutes": 15,
    "consultation_fee": 300,
    "reminder_offsets_hours": [24, 2],
    "template_lang": "en",
    "booking_enabled": true,
    "lead_time_minutes": 30,
    "timezone": "Asia/Kolkata"
  }'::jsonb,
  created_at      timestamptz not null default now()
);

create table clinic_members (
  clinic_id uuid not null references clinics(id) on delete cascade,
  user_id   uuid not null references auth.users(id) on delete cascade,
  role      member_role not null default 'doctor',
  primary key (clinic_id, user_id)
);
create index clinic_members_user_idx on clinic_members (user_id);

-- ─── Patients ───────────────────────────────────────────────────
create table patients (
  id                 uuid primary key default gen_random_uuid(),
  clinic_id          uuid not null references clinics(id) on delete cascade,
  full_name          text not null,
  phone              text not null,                 -- E.164 (+91XXXXXXXXXX)
  gender             text,
  dob                date,
  age_years          int,
  address            text,
  blood_group        text,
  allergies          text,
  chronic_conditions text,
  tags               text[] not null default '{}',
  whatsapp_opt_in    boolean not null default true,
  consent_at         timestamptz,
  notes              text,
  deleted_at         timestamptz,                   -- soft delete (DPDP)
  created_at         timestamptz not null default now()
);
create index patients_clinic_phone_idx on patients (clinic_id, phone);
create index patients_name_trgm on patients using gin (full_name gin_trgm_ops);

-- ─── Availability ───────────────────────────────────────────────
create table availability (
  id         uuid primary key default gen_random_uuid(),
  clinic_id  uuid not null references clinics(id) on delete cascade,
  weekday    int not null check (weekday between 0 and 6),  -- 0 = Sunday
  start_time time not null,
  end_time   time not null,
  check (end_time > start_time)
);
create index availability_clinic_idx on availability (clinic_id, weekday);

create table availability_overrides (
  id         uuid primary key default gen_random_uuid(),
  clinic_id  uuid not null references clinics(id) on delete cascade,
  date       date not null,
  closed     boolean not null default true,
  start_time time,
  end_time   time,
  unique (clinic_id, date)
);

-- ─── Appointments ───────────────────────────────────────────────
create table appointments (
  id                     uuid primary key default gen_random_uuid(),
  clinic_id              uuid not null references clinics(id) on delete cascade,
  patient_id             uuid not null references patients(id) on delete cascade,
  starts_at              timestamptz not null,
  ends_at                timestamptz not null,
  status                 appointment_status not null default 'confirmed',
  source                 appointment_source not null default 'staff',
  reason                 text,
  token_number           int,
  cancellation_requested boolean not null default false,
  reminders_sent         int[] not null default '{}',
  created_at             timestamptz not null default now()
);
create index appointments_clinic_starts_idx on appointments (clinic_id, starts_at);
create index appointments_patient_idx on appointments (patient_id);
-- one live booking per slot per clinic
create unique index appointments_slot_uniq on appointments (clinic_id, starts_at)
  where status in ('pending','confirmed','arrived','in_progress');

-- ─── Visits (EMR-lite) ──────────────────────────────────────────
create table visits (
  id                   uuid primary key default gen_random_uuid(),
  clinic_id            uuid not null references clinics(id) on delete cascade,
  appointment_id       uuid references appointments(id) on delete set null,
  patient_id           uuid not null references patients(id) on delete cascade,
  visit_date           date not null default ((now() at time zone 'Asia/Kolkata')::date),
  vitals               jsonb not null default '{}',   -- {bp_sys,bp_dia,pulse,temp_f,weight_kg,spo2}
  complaints           text,
  diagnosis            text,
  advice               text,
  followup_date        date,
  followup_notified_at timestamptz,
  created_at           timestamptz not null default now()
);
create index visits_patient_idx on visits (patient_id, visit_date desc);
create index visits_clinic_idx on visits (clinic_id, visit_date desc);

-- ─── Medicines (autocomplete) ───────────────────────────────────
create table medicines (
  id        uuid primary key default gen_random_uuid(),
  clinic_id uuid references clinics(id) on delete cascade,  -- NULL = global seed row
  name      text not null,
  form      text,
  strength  text
);
create index medicines_name_trgm on medicines using gin (name gin_trgm_ops);
create index medicines_clinic_idx on medicines (clinic_id);

-- ─── Prescriptions ──────────────────────────────────────────────
create table prescriptions (
  id           uuid primary key default gen_random_uuid(),
  clinic_id    uuid not null references clinics(id) on delete cascade,
  visit_id     uuid not null references visits(id) on delete cascade,
  patient_id   uuid not null references patients(id) on delete cascade,
  pdf_path     text,
  finalized_at timestamptz,
  created_at   timestamptz not null default now()
);
create index prescriptions_patient_idx on prescriptions (patient_id, created_at desc);

create table prescription_items (
  id              uuid primary key default gen_random_uuid(),
  prescription_id uuid not null references prescriptions(id) on delete cascade,
  position        int not null default 0,
  medicine_name   text not null,
  dosage          text,          -- e.g. "1-0-1"
  duration_days   int,
  instructions    text           -- e.g. "After food"
);
create index prescription_items_rx_idx on prescription_items (prescription_id, position);

-- ─── Billing ────────────────────────────────────────────────────
create table invoices (
  id           uuid primary key default gen_random_uuid(),
  clinic_id    uuid not null references clinics(id) on delete cascade,
  patient_id   uuid not null references patients(id) on delete cascade,
  visit_id     uuid references visits(id) on delete set null,
  invoice_no   text not null,
  status       invoice_status not null default 'unpaid',
  total_amount numeric(10,2) not null default 0,
  created_at   timestamptz not null default now(),
  unique (clinic_id, invoice_no)
);
create index invoices_clinic_created_idx on invoices (clinic_id, created_at desc);
create index invoices_patient_idx on invoices (patient_id);

create table invoice_items (
  id          uuid primary key default gen_random_uuid(),
  invoice_id  uuid not null references invoices(id) on delete cascade,
  description text not null,
  qty         int not null default 1,
  unit_price  numeric(10,2) not null
);
create index invoice_items_invoice_idx on invoice_items (invoice_id);

create table invoice_counters (
  clinic_id uuid primary key references clinics(id) on delete cascade,
  year      int not null,
  last_no   int not null default 0
);

create table payments (
  id               uuid primary key default gen_random_uuid(),
  clinic_id        uuid not null references clinics(id) on delete cascade,
  invoice_id       uuid not null references invoices(id) on delete cascade,
  amount           numeric(10,2) not null,
  mode             payment_mode not null,
  receipt_pdf_path text,
  paid_at          timestamptz not null default now()
);
create index payments_clinic_paid_idx on payments (clinic_id, paid_at desc);
create index payments_invoice_idx on payments (invoice_id);

-- ─── WhatsApp message queue / log ───────────────────────────────
create table wa_messages (
  id            uuid primary key default gen_random_uuid(),
  clinic_id     uuid not null references clinics(id) on delete cascade,
  patient_id    uuid references patients(id) on delete set null,
  to_phone      text not null,
  direction     wa_direction not null default 'out',
  template_name text,
  params        jsonb not null default '{}',
  document_path text,
  body          text,
  status        wa_status not null default 'queued',
  wa_message_id text,
  error         text,
  attempts      int not null default 0,
  related_type  text,
  related_id    uuid,
  created_at    timestamptz not null default now(),
  sent_at       timestamptz
);
create index wa_messages_status_idx on wa_messages (status, created_at);
create index wa_messages_waid_idx on wa_messages (wa_message_id);
create index wa_messages_patient_idx on wa_messages (clinic_id, patient_id, created_at desc);
-- one reminder per appointment per offset (idempotency)
create unique index wa_reminder_uniq
  on wa_messages (related_id, template_name, (params->>'offset'))
  where template_name = 'appt_reminder';

-- ════════════════════════════════════════════════════════════════
-- Helper functions (SECURITY DEFINER, race-safe)
-- ════════════════════════════════════════════════════════════════

-- Next per-clinic-day token. Shared by walk-ins and booked patients.
create or replace function next_token_number(p_clinic uuid, p_day date)
returns int
language sql
as $$
  select coalesce(count(*), 0)::int + 1
  from appointments
  where clinic_id = p_clinic
    and (starts_at at time zone 'Asia/Kolkata')::date = p_day
    and status <> 'cancelled';
$$;

-- Race-safe per-clinic invoice number: INV-YY-000N, resets each calendar year.
create or replace function next_invoice_no(p_clinic uuid)
returns text
language plpgsql
as $$
declare
  v_year int := extract(year from (now() at time zone 'Asia/Kolkata'))::int;
  v_no   int;
begin
  insert into invoice_counters (clinic_id, year, last_no)
  values (p_clinic, v_year, 1)
  on conflict (clinic_id) do update
    set last_no = case when invoice_counters.year = v_year
                       then invoice_counters.last_no + 1 else 1 end,
        year    = v_year
  returning last_no into v_no;

  return 'INV-' || right(v_year::text, 2) || '-' || lpad(v_no::text, 4, '0');
end;
$$;
