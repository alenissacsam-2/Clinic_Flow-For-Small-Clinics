-- ════════════════════════════════════════════════════════════════
-- 0032_fk_indexes_and_rls_initplan.sql
--
-- Two things the database linter flags that are worth acting on, and one it
-- flags that is not.
--
-- ── 1. Nineteen foreign keys with no covering index ──────────────────────────
--
-- Postgres indexes the *referenced* side of a foreign key automatically (it has
-- to — that side is a primary or unique key). It never indexes the referencing
-- side. So every `on delete cascade` and `on delete set null` in the schema is
-- a promise that, when a parent row goes, Postgres will find the children — and
-- without an index it finds them by reading the whole child table. Per parent
-- row.
--
-- Three of these are on paths this product runs constantly:
--
--   * `wa_messages.patient_id` and `intake_requests.patient_id`
--     The DPDP purge in the reminder cron runs
--     `delete from patients where deleted_at < now() - 30 days` every 15
--     minutes. `wa_messages` is the largest table in the product — every
--     reminder, confirmation, receipt and OTP for every patient lands in it —
--     and it was being sequentially scanned once per purged patient. Every
--     other child of `patients` was already indexed; these two were the gap.
--
--   * `prescriptions.clinic_id`
--     `tenant_all on prescriptions` filters `clinic_id in (select
--     auth_clinic_ids())`. With no index on that column, *every* prescription
--     read in the app — the visit editor, the patient timeline, the Rx PDF,
--     the FHIR export — was a sequential scan through every clinic's
--     prescriptions.
--
--   * `prescriptions.visit_id`, `invoices.visit_id`, `visits.appointment_id`
--     Looked up by `saveVisit`, `ensureInvoiceForVisit` and the visit editor
--     respectively — which is to say once or more per consultation, on the
--     hottest write path in the app.
--
-- The rest are indexed here too. The rule "every foreign key gets a covering
-- index" is worth applying uniformly rather than case by case: a btree on a
-- uuid column is cheap at this scale, and the alternative is re-deriving which
-- deletion paths are slow every time the schema grows.
--
-- ── 2. auth.uid() re-evaluated per row ───────────────────────────────────────
--
-- `members_read` and `members_delete` call `auth.uid()` directly, so Postgres
-- treats it as volatile and re-runs it for every row scanned. Wrapping it in a
-- scalar subquery — `(select auth.uid())` — makes it an InitPlan, evaluated
-- once per statement. Every other policy in this schema already uses that shape
-- for `auth_clinic_ids()`; these two were written before the pattern settled.
--
-- Behaviour is identical. `auth.uid()` reads a request-scoped JWT claim that
-- cannot change mid-statement, so evaluating it once is not an approximation.
--
-- ── 3. What is deliberately NOT done: dropping "unused" indexes ──────────────
--
-- The linter also reports `patients_name_trgm`, `icd10_title_trgm`,
-- `medicines_composition_trgm` and a dozen others as never used. They are not
-- dead — this database holds nine patients. `pg_stat_user_indexes` counts scans
-- that have actually happened, and on a fresh project with no traffic that is
-- zero for everything that is not on a page someone has clicked. The trigram
-- indexes in particular back the patient search, the ICD-10 picker and the
-- medicine combobox, all of which the planner will correctly ignore on a table
-- small enough to scan.
--
-- Dropping an index because a nine-row database has not needed it is how a
-- search box that works in development becomes a timeout in production. Revisit
-- this only against a project with real traffic behind it.
-- ════════════════════════════════════════════════════════════════

-- ─── Children of patients: the nightly DPDP purge walks these ───────────────
--
-- Note the name. `wa_messages_patient_idx` is already taken — by
-- `(clinic_id, patient_id, created_at desc)`, which serves the patient's
-- message timeline but is useless to a cascade, because a btree can only be
-- probed on a prefix of its columns and the leading column there is
-- `clinic_id`. `create index if not exists` matches on the index *name*, not on
-- its definition, so reusing that name would have silently done nothing and
-- left the purge scanning the whole table while looking like it was fixed.
create index if not exists wa_messages_patient_fk_idx   on wa_messages (patient_id);
create index if not exists intake_requests_patient_idx  on intake_requests (patient_id);

-- ─── Hot consultation-path lookups ─────────────────────────────────────────
create index if not exists prescriptions_clinic_idx     on prescriptions (clinic_id);
create index if not exists prescriptions_visit_idx      on prescriptions (visit_id);
create index if not exists invoices_visit_idx           on invoices (visit_id);
create index if not exists visits_appointment_idx       on visits (appointment_id);

-- ─── Remaining tenant-scoped columns ───────────────────────────────────────
create index if not exists visit_attachments_clinic_idx on visit_attachments (clinic_id);
create index if not exists patient_policies_clinic_idx  on patient_policies (clinic_id);
create index if not exists drug_interactions_clinic_idx on drug_interactions (clinic_id);

-- ─── Remaining reference columns ───────────────────────────────────────────
create index if not exists patient_policies_payer_idx   on patient_policies (payer_id);
create index if not exists claims_policy_idx            on claims (policy_id);
create index if not exists inventory_items_medicine_idx on inventory_items (medicine_id);
create index if not exists lab_order_items_test_idx     on lab_order_items (lab_test_id);
create index if not exists stock_movements_batch_idx    on stock_movements (batch_id);
create index if not exists stock_movements_inv_item_idx on stock_movements (invoice_item_id);

-- ─── Audit columns referencing auth.users ──────────────────────────────────
-- Only walked when an account is deleted, which is rare — but a user deletion
-- that has to scan four tables is a rare event that fails loudly.
create index if not exists claim_events_created_by_idx      on claim_events (created_by);
create index if not exists clinic_invites_invited_by_idx    on clinic_invites (invited_by);
create index if not exists stock_movements_created_by_idx   on stock_movements (created_by);
create index if not exists visit_attachments_uploaded_by_idx on visit_attachments (uploaded_by);

-- ─── RLS: evaluate auth.uid() once per statement, not once per row ─────────
drop policy if exists members_read on clinic_members;
create policy members_read on clinic_members for select
  using (user_id = (select auth.uid()) or clinic_id in (select auth_clinic_ids()));

drop policy if exists members_delete on clinic_members;
create policy members_delete on clinic_members for delete
  using (is_clinic_doctor(clinic_id) or user_id = (select auth.uid()));
