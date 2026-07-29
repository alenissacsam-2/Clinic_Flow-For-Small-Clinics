-- ════════════════════════════════════════════════════════════════
-- 0021_abdm.sql — ABDM (Ayushman Bharat Digital Mission) foundation
--
-- Two things live here:
--   1. ABHA identity on patients — the 14-digit ABHA number and the
--      ABHA (PHR) address. Both are OPTIONAL. A clinic that never
--      touches ABDM is unaffected; nothing in the app requires them.
--   2. consent_artefacts — the record of a patient's consent for health
--      information to be shared through the ABDM gateway. ABDM is
--      consent-first: no artefact, no data exchange. We store our own
--      row the moment consent is requested so the audit trail exists
--      even before (or without) a live gateway.
--
-- The gateway client itself is scaffolded in src/lib/abdm/gateway.ts and
-- runs in dry-run mode until NHA credentials are configured — the same
-- pattern as WhatsApp. Real M1–M3 milestone certification requires NHA
-- registration, which is an operational step, not a code change.
-- ════════════════════════════════════════════════════════════════

-- ─── ABHA identity on patients ──────────────────────────────────
alter table patients add column if not exists abha_number  text;  -- 14 digits, stored unformatted
alter table patients add column if not exists abha_address text;  -- e.g. 'aarav.shah@sbx'

comment on column patients.abha_number is
  '14-digit ABHA number, digits only (no hyphens). Verhoeff-checksummed; validated advisory-only in app code.';
comment on column patients.abha_address is
  'ABHA address / PHR address, e.g. username@sbx. Lowercased on save.';

-- Partial: most rows will be NULL, and we only ever look up by a real number.
create index if not exists patients_abha_number_idx
  on patients (clinic_id, abha_number) where abha_number is not null;

-- ─── Consent artefacts ──────────────────────────────────────────
create table if not exists consent_artefacts (
  id           uuid primary key default gen_random_uuid(),
  clinic_id    uuid not null references clinics(id) on delete cascade,
  patient_id   uuid not null references patients(id) on delete cascade,

  -- Gateway identifiers. NULL while the request is local-only (dry-run or
  -- pre-credentials); populated from the gateway's response once live.
  request_id   text,
  artefact_id  text,

  status       text not null default 'requested'
                 check (status in ('requested','granted','denied','expired','revoked')),
  purpose_code text not null default 'CAREMGT',   -- ABDM purpose-of-use code
  hi_types     text[] not null default '{}',      -- OPConsultation, Prescription, DiagnosticReport, …

  -- The window of health data the consent covers…
  date_from    timestamptz,
  date_to      timestamptz,
  -- …and when the consent itself stops being usable.
  expires_at   timestamptz,

  granted_at   timestamptz,
  revoked_at   timestamptz,

  raw          jsonb,                             -- gateway payload, exactly as received
  created_at   timestamptz not null default now()
);

create index if not exists consent_artefacts_clinic_idx
  on consent_artefacts (clinic_id, created_at desc);
create index if not exists consent_artefacts_patient_idx
  on consent_artefacts (patient_id, created_at desc);
-- Gateway ids are globally unique when present; the partial unique index makes
-- webhook handling idempotent without constraining the local-only rows.
create unique index if not exists consent_artefacts_artefact_uniq
  on consent_artefacts (artefact_id) where artefact_id is not null;
create unique index if not exists consent_artefacts_request_uniq
  on consent_artefacts (request_id) where request_id is not null;

alter table consent_artefacts enable row level security;

-- Standard tenant scoping (matches payments/appointments in 0002_rls.sql).
drop policy if exists tenant_all on consent_artefacts;
create policy tenant_all on consent_artefacts for all
  using (clinic_id in (select auth_clinic_ids()))
  with check (clinic_id in (select auth_clinic_ids()));
