-- ════════════════════════════════════════════════════════════════
-- 0023_labs.sql — lab & radiology orders with results
--
-- Three tables:
--   lab_tests       — catalogue (global seed + per-clinic additions, exactly
--                     like `medicines`)
--   lab_orders      — what was ordered, from which visit
--   lab_order_items — one row per test, carrying the result when it arrives
--
-- ── On LOINC ─────────────────────────────────────────────────────────
-- `loinc_code` is seeded ONLY where the code is certain. Many tests common in
-- Indian OPD (Widal, dengue NS1, most radiology) are left NULL rather than
-- guessed: a wrong LOINC is worse than no LOINC, because it exports as a
-- confident claim about what was measured. Uncoded tests work normally — they
-- just don't carry a code into the FHIR export.
--
-- ── On reference ranges ──────────────────────────────────────────────
-- The catalogue stores NO reference ranges. Ranges are method-, lab-, age- and
-- sex-specific, and shipping our own would be inventing clinical thresholds.
-- The range is entered per result, from the report the lab issued, and the
-- high/low flag is then plain arithmetic on the lab's own numbers.
-- ════════════════════════════════════════════════════════════════

-- ─── Catalogue ──────────────────────────────────────────────────
create table if not exists lab_tests (
  id         uuid primary key default gen_random_uuid(),
  clinic_id  uuid references clinics(id) on delete cascade,  -- NULL = global seed row
  name       text not null,
  short_name text,
  category   text,          -- Haematology, Biochemistry, Endocrine, Serology, Urine, Radiology
  loinc_code text,          -- NULL when not certain — see header
  unit       text,          -- typical reporting unit; a result may override it
  specimen   text,          -- Blood, Serum, Urine, — (imaging)
  is_panel   boolean not null default false
);

create index if not exists lab_tests_name_trgm on lab_tests using gin (name gin_trgm_ops);
create index if not exists lab_tests_clinic_idx on lab_tests (clinic_id);
create unique index if not exists lab_tests_uniq on lab_tests
  (coalesce(clinic_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name));

alter table lab_tests enable row level security;

-- Global rows readable by all; clinic rows tenant-scoped (mirrors `medicines`).
drop policy if exists lab_tests_read on lab_tests;
create policy lab_tests_read on lab_tests for select
  using (clinic_id is null or clinic_id in (select auth_clinic_ids()));
drop policy if exists lab_tests_write on lab_tests;
create policy lab_tests_write on lab_tests for insert
  with check (clinic_id in (select auth_clinic_ids()));
drop policy if exists lab_tests_update on lab_tests;
create policy lab_tests_update on lab_tests for update
  using (clinic_id in (select auth_clinic_ids()))
  with check (clinic_id in (select auth_clinic_ids()));
drop policy if exists lab_tests_delete on lab_tests;
create policy lab_tests_delete on lab_tests for delete
  using (clinic_id in (select auth_clinic_ids()));

-- ─── Orders ─────────────────────────────────────────────────────
create table if not exists lab_orders (
  id          uuid primary key default gen_random_uuid(),
  clinic_id   uuid not null references clinics(id) on delete cascade,
  patient_id  uuid not null references patients(id) on delete cascade,
  -- Nullable and ON DELETE SET NULL: results outlive the consultation that
  -- ordered them, same reasoning as visit_attachments.
  visit_id    uuid references visits(id) on delete set null,
  status      text not null default 'ordered'
                check (status in ('ordered','collected','resulted','cancelled')),
  lab_name    text,          -- the external lab, when the clinic uses one
  note        text,
  ordered_at  timestamptz not null default now(),
  resulted_at timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists lab_orders_patient_idx on lab_orders (patient_id, ordered_at desc);
create index if not exists lab_orders_clinic_idx on lab_orders (clinic_id, ordered_at desc);
create index if not exists lab_orders_visit_idx on lab_orders (visit_id) where visit_id is not null;

alter table lab_orders enable row level security;
drop policy if exists tenant_all on lab_orders;
create policy tenant_all on lab_orders for all
  using (clinic_id in (select auth_clinic_ids()))
  with check (clinic_id in (select auth_clinic_ids()));

-- ─── Ordered tests + their results ──────────────────────────────
create table if not exists lab_order_items (
  id              uuid primary key default gen_random_uuid(),
  order_id        uuid not null references lab_orders(id) on delete cascade,
  -- Catalogue link is a convenience, not the source of truth: `test_name` and
  -- `loinc_code` are snapshotted at order time so a later catalogue edit can
  -- never rewrite history on an issued report.
  lab_test_id     uuid references lab_tests(id) on delete set null,
  position        int not null default 0,
  test_name       text not null,
  loinc_code      text,

  value_text      text,       -- exactly what the lab reported
  value_number    numeric,    -- parsed when numeric — enables flagging and trends
  unit            text,
  reference_low   numeric,
  reference_high  numeric,
  reference_text  text,       -- for ranges that aren't a numeric interval ("Negative")
  flag            text check (flag in ('low','normal','high','abnormal')),
  note            text
);

create index if not exists lab_order_items_order_idx on lab_order_items (order_id, position);

alter table lab_order_items enable row level security;

-- No clinic_id of its own — scope through the parent order (same shape as
-- prescription_items in 0002_rls.sql).
drop policy if exists tenant_all on lab_order_items;
create policy tenant_all on lab_order_items for all
  using (order_id in (select id from lab_orders where clinic_id in (select auth_clinic_ids())))
  with check (order_id in (select id from lab_orders where clinic_id in (select auth_clinic_ids())));

-- ─── Seed: tests common in Indian OPD ───────────────────────────
-- CURATED and NON-EXHAUSTIVE. A clinic adds its own rows; the ones here are
-- the tests a solo GP orders week in, week out.
insert into lab_tests (clinic_id, name, short_name, category, loinc_code, unit, specimen, is_panel) values
-- Haematology
(null, 'Complete Blood Count',                'CBC',    'Haematology', '58410-2', null,        'Blood', true),
(null, 'Haemoglobin',                         'Hb',     'Haematology', '718-7',   'g/dL',      'Blood', false),
(null, 'Total Leucocyte Count',               'TLC',    'Haematology', '6690-2',  '10^3/µL',   'Blood', false),
(null, 'Platelet Count',                      'PLT',    'Haematology', '777-3',   '10^3/µL',   'Blood', false),
(null, 'Red Blood Cell Count',                'RBC',    'Haematology', '789-8',   '10^6/µL',   'Blood', false),
(null, 'Packed Cell Volume',                  'PCV',    'Haematology', '4544-3',  '%',         'Blood', false),
(null, 'Mean Corpuscular Volume',             'MCV',    'Haematology', '787-2',   'fL',        'Blood', false),
(null, 'Erythrocyte Sedimentation Rate',      'ESR',    'Haematology', '4537-7',  'mm/hr',     'Blood', false),
(null, 'Peripheral Smear',                    null,     'Haematology', null,      null,        'Blood', false),
(null, 'Differential Leucocyte Count',        'DLC',    'Haematology', null,      '%',         'Blood', false),
(null, 'Reticulocyte Count',                  null,     'Haematology', null,      '%',         'Blood', false),
(null, 'Prothrombin Time',                    'PT',     'Haematology', '5902-2',  'sec',       'Plasma', false),
(null, 'INR',                                 'INR',    'Haematology', '6301-6',  null,        'Plasma', false),
-- Biochemistry
(null, 'Fasting Blood Sugar',                 'FBS',    'Biochemistry', '1558-6', 'mg/dL',     'Serum', false),
(null, 'Random Blood Sugar',                  'RBS',    'Biochemistry', '2345-7', 'mg/dL',     'Serum', false),
(null, 'Post Prandial Blood Sugar',           'PPBS',   'Biochemistry', null,     'mg/dL',     'Serum', false),
(null, 'Glycated Haemoglobin',                'HbA1c',  'Biochemistry', '4548-4', '%',         'Blood', false),
(null, 'Serum Creatinine',                    null,     'Biochemistry', '2160-0', 'mg/dL',     'Serum', false),
(null, 'Blood Urea Nitrogen',                 'BUN',    'Biochemistry', '3094-0', 'mg/dL',     'Serum', false),
(null, 'Serum Uric Acid',                     null,     'Biochemistry', '3084-1', 'mg/dL',     'Serum', false),
(null, 'Serum Sodium',                        'Na',     'Biochemistry', '2951-2', 'mmol/L',    'Serum', false),
(null, 'Serum Potassium',                     'K',      'Biochemistry', '2823-3', 'mmol/L',    'Serum', false),
(null, 'Serum Chloride',                      'Cl',     'Biochemistry', '2075-0', 'mmol/L',    'Serum', false),
(null, 'Serum Calcium',                       'Ca',     'Biochemistry', '17861-6','mg/dL',     'Serum', false),
(null, 'Total Cholesterol',                   null,     'Biochemistry', '2093-3', 'mg/dL',     'Serum', false),
(null, 'Triglycerides',                       'TG',     'Biochemistry', '2571-8', 'mg/dL',     'Serum', false),
(null, 'HDL Cholesterol',                     'HDL',    'Biochemistry', '2085-9', 'mg/dL',     'Serum', false),
(null, 'LDL Cholesterol',                     'LDL',    'Biochemistry', '13457-7','mg/dL',     'Serum', false),
(null, 'Alanine Aminotransferase',            'SGPT',   'Biochemistry', '1742-6', 'U/L',       'Serum', false),
(null, 'Aspartate Aminotransferase',          'SGOT',   'Biochemistry', '1920-8', 'U/L',       'Serum', false),
(null, 'Alkaline Phosphatase',                'ALP',    'Biochemistry', '6768-6', 'U/L',       'Serum', false),
(null, 'Total Bilirubin',                     null,     'Biochemistry', '1975-2', 'mg/dL',     'Serum', false),
(null, 'Direct Bilirubin',                    null,     'Biochemistry', '1968-7', 'mg/dL',     'Serum', false),
(null, 'Serum Albumin',                       null,     'Biochemistry', '1751-7', 'g/dL',      'Serum', false),
(null, 'Total Protein',                       null,     'Biochemistry', '2885-2', 'g/dL',      'Serum', false),
(null, 'Serum Amylase',                       null,     'Biochemistry', '1798-8', 'U/L',       'Serum', false),
(null, 'Lactate Dehydrogenase',               'LDH',    'Biochemistry', '2532-0', 'U/L',       'Serum', false),
(null, 'C-Reactive Protein',                  'CRP',    'Biochemistry', '1988-5', 'mg/L',      'Serum', false),
(null, 'Serum Ferritin',                      null,     'Biochemistry', '2276-4', 'ng/mL',     'Serum', false),
(null, 'Vitamin B12',                         null,     'Biochemistry', '2132-9', 'pg/mL',     'Serum', false),
(null, 'Vitamin D (25-OH)',                   null,     'Biochemistry', null,     'ng/mL',     'Serum', false),
(null, 'Serum Magnesium',                     'Mg',     'Biochemistry', null,     'mg/dL',     'Serum', false),
(null, 'Serum Phosphorus',                    null,     'Biochemistry', null,     'mg/dL',     'Serum', false),
(null, 'Serum Iron',                          null,     'Biochemistry', null,     'µg/dL',     'Serum', false),
-- Endocrine
(null, 'Thyroid Stimulating Hormone',         'TSH',    'Endocrine', '3016-3',    'µIU/mL',    'Serum', false),
(null, 'Total T3',                            'T3',     'Endocrine', '3053-6',    'ng/dL',     'Serum', false),
(null, 'Total T4',                            'T4',     'Endocrine', '3026-2',    'µg/dL',     'Serum', false),
(null, 'Free T4',                             'FT4',    'Endocrine', '3024-7',    'ng/dL',     'Serum', false),
(null, 'Prostate Specific Antigen',           'PSA',    'Endocrine', '2857-1',    'ng/mL',     'Serum', false),
(null, 'Serum Cortisol',                      null,     'Endocrine', null,        'µg/dL',     'Serum', false),
(null, 'Beta HCG',                            null,     'Endocrine', null,        'mIU/mL',    'Serum', false),
-- Serology / infectious disease (LOINC deliberately omitted — see header)
(null, 'Dengue NS1 Antigen',                  null,     'Serology', null, null, 'Serum', false),
(null, 'Dengue IgM/IgG',                      null,     'Serology', null, null, 'Serum', false),
(null, 'Malaria Parasite (Rapid)',            'MP',     'Serology', null, null, 'Blood', false),
(null, 'Widal Test',                          null,     'Serology', null, null, 'Serum', false),
(null, 'Typhidot (IgM)',                      null,     'Serology', null, null, 'Serum', false),
(null, 'HBsAg',                               null,     'Serology', null, null, 'Serum', false),
(null, 'Anti-HCV',                            null,     'Serology', null, null, 'Serum', false),
(null, 'HIV I & II',                          null,     'Serology', null, null, 'Serum', false),
(null, 'VDRL',                                null,     'Serology', null, null, 'Serum', false),
(null, 'Rheumatoid Factor',                   'RA',     'Serology', null, 'IU/mL', 'Serum', false),
(null, 'Anti-Streptolysin O',                 'ASO',    'Serology', null, 'IU/mL', 'Serum', false),
(null, 'COVID-19 RT-PCR',                     null,     'Serology', null, null, 'Swab', false),
-- Urine & stool
(null, 'Urine Routine & Microscopy',          null,     'Urine', '24357-6', null, 'Urine', true),
(null, 'Urine Culture & Sensitivity',         null,     'Urine', null, null, 'Urine', false),
(null, 'Urine Microalbumin',                  null,     'Urine', '14957-5', 'mg/L', 'Urine', false),
(null, 'Urine Pregnancy Test',                'UPT',    'Urine', null, null, 'Urine', false),
(null, 'Stool Routine',                       null,     'Urine', null, null, 'Stool', false),
-- Radiology & cardiology (LOINC omitted — imaging codes are not our strong claim)
(null, 'Chest X-Ray PA',                      null,     'Radiology', null, null, '—', false),
(null, 'X-Ray Knee (AP/Lateral)',             null,     'Radiology', null, null, '—', false),
(null, 'X-Ray Lumbar Spine',                  null,     'Radiology', null, null, '—', false),
(null, 'Ultrasound Abdomen & Pelvis',         'USG A/P','Radiology', null, null, '—', false),
(null, 'Ultrasound KUB',                      null,     'Radiology', null, null, '—', false),
(null, 'Obstetric Ultrasound',                null,     'Radiology', null, null, '—', false),
(null, 'Electrocardiogram',                   'ECG',    'Radiology', null, null, '—', false),
(null, '2D Echocardiography',                 '2D Echo','Radiology', null, null, '—', false),
(null, 'CT Brain (Plain)',                    null,     'Radiology', null, null, '—', false),
(null, 'MRI Lumbar Spine',                    null,     'Radiology', null, null, '—', false),
-- Panels
(null, 'Lipid Profile',                       null,     'Biochemistry', '24331-1', null, 'Serum', true),
(null, 'Liver Function Test',                 'LFT',    'Biochemistry', null,      null, 'Serum', true),
(null, 'Kidney Function Test',                'KFT',    'Biochemistry', null,      null, 'Serum', true),
(null, 'Thyroid Profile',                     'TFT',    'Endocrine',    null,      null, 'Serum', true),
(null, 'Comprehensive Metabolic Panel',       'CMP',    'Biochemistry', '24323-8', null, 'Serum', true)
on conflict do nothing;
