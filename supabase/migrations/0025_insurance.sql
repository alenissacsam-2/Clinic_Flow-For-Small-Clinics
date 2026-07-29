-- ════════════════════════════════════════════════════════════════
-- 0025_insurance.sql — insurance / TPA claims
--
--   payers           — insurers, TPAs, government schemes, corporate tie-ups
--   patient_policies — a patient's policy with one payer
--   claims           — pre-auth → submission → settlement against an invoice
--   claim_events     — append-only history of every status change
--
-- ── Why claim_events exists ──────────────────────────────────────────
-- Claims get queried and resubmitted, sometimes several times. A single
-- `status` column tells you where a claim is now but not what it has been
-- through — and "what did we send, when, and what did they say" is exactly
-- the conversation a clinic has with a TPA. The ledger is the feature.
--
-- ── On money ─────────────────────────────────────────────────────────
-- `claimed`, `approved` and `settled` are stored separately and never derived
-- from one another. A payer approving ₹8,000 of a ₹10,000 claim and settling
-- ₹7,600 of that is normal, and flattening those into one number loses the
-- two shortfalls the clinic actually needs to chase.
-- ════════════════════════════════════════════════════════════════

create table if not exists payers (
  id         uuid primary key default gen_random_uuid(),
  clinic_id  uuid not null references clinics(id) on delete cascade,
  name       text not null,
  kind       text not null default 'tpa'
               check (kind in ('insurer','tpa','government','corporate')),
  code       text,      -- the payer's own identifier for this clinic
  contact    text,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index if not exists payers_uniq on payers (clinic_id, lower(name));
create index if not exists payers_clinic_idx on payers (clinic_id) where is_active;

create table if not exists patient_policies (
  id          uuid primary key default gen_random_uuid(),
  clinic_id   uuid not null references clinics(id) on delete cascade,
  patient_id  uuid not null references patients(id) on delete cascade,
  payer_id    uuid not null references payers(id) on delete cascade,
  policy_no   text not null,
  member_id   text,
  valid_from  date,
  valid_to    date,
  sum_insured numeric(12,2),
  note        text,
  created_at  timestamptz not null default now()
);

create index if not exists patient_policies_patient_idx on patient_policies (patient_id);
create unique index if not exists patient_policies_uniq
  on patient_policies (patient_id, payer_id, lower(policy_no));

create table if not exists claims (
  id              uuid primary key default gen_random_uuid(),
  clinic_id       uuid not null references clinics(id) on delete cascade,
  patient_id      uuid not null references patients(id) on delete cascade,
  payer_id        uuid not null references payers(id) on delete restrict,
  policy_id       uuid references patient_policies(id) on delete set null,
  -- The invoice being claimed against. SET NULL rather than CASCADE: a claim
  -- is a record of a conversation with a payer and must survive the bill.
  invoice_id      uuid references invoices(id) on delete set null,

  claim_no        text,
  preauth_no      text,
  status          text not null default 'draft'
                    check (status in ('draft','preauth_requested','preauth_approved',
                                      'preauth_rejected','submitted','queried',
                                      'approved','settled','rejected')),

  claimed_amount  numeric(12,2) not null default 0,
  approved_amount numeric(12,2),
  settled_amount  numeric(12,2),
  -- What the patient owes after the payer's share — the co-pay plus anything
  -- disallowed. Stored, not derived: the split is a decision, not arithmetic.
  patient_payable numeric(12,2),

  submitted_at    timestamptz,
  settled_at      timestamptz,
  note            text,
  created_at      timestamptz not null default now()
);

create index if not exists claims_clinic_idx on claims (clinic_id, created_at desc);
create index if not exists claims_patient_idx on claims (patient_id, created_at desc);
create index if not exists claims_payer_idx on claims (payer_id, status);
create index if not exists claims_invoice_idx on claims (invoice_id) where invoice_id is not null;

create table if not exists claim_events (
  id         uuid primary key default gen_random_uuid(),
  claim_id   uuid not null references claims(id) on delete cascade,
  status     text not null,
  amount     numeric(12,2),
  note       text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists claim_events_claim_idx on claim_events (claim_id, created_at desc);

alter table payers           enable row level security;
alter table patient_policies enable row level security;
alter table claims           enable row level security;
alter table claim_events     enable row level security;

drop policy if exists tenant_all on payers;
create policy tenant_all on payers for all
  using (clinic_id in (select auth_clinic_ids()))
  with check (clinic_id in (select auth_clinic_ids()));

drop policy if exists tenant_all on patient_policies;
create policy tenant_all on patient_policies for all
  using (clinic_id in (select auth_clinic_ids()))
  with check (clinic_id in (select auth_clinic_ids()));

drop policy if exists tenant_all on claims;
create policy tenant_all on claims for all
  using (clinic_id in (select auth_clinic_ids()))
  with check (clinic_id in (select auth_clinic_ids()));

-- No clinic_id of its own — scope through the parent claim.
drop policy if exists tenant_all on claim_events;
create policy tenant_all on claim_events for all
  using (claim_id in (select id from claims where clinic_id in (select auth_clinic_ids())))
  with check (claim_id in (select id from claims where clinic_id in (select auth_clinic_ids())));
