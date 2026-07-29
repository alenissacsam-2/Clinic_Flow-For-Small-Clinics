-- ════════════════════════════════════════════════════════════════
-- 0002_rls.sql — Row Level Security
-- Tenant isolation: a user may touch only rows of clinics they belong to.
-- The public booking page and the WhatsApp pipeline use the service-role
-- key (which bypasses RLS) from server-only code.
-- ════════════════════════════════════════════════════════════════

-- Set of clinic_ids the current user belongs to. SECURITY DEFINER so it
-- reads clinic_members without triggering that table's own RLS (no recursion).
create or replace function auth_clinic_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select clinic_id from clinic_members where user_id = auth.uid();
$$;

-- ─── Enable RLS everywhere ──────────────────────────────────────
alter table clinics                enable row level security;
alter table clinic_members         enable row level security;
alter table patients               enable row level security;
alter table availability           enable row level security;
alter table availability_overrides enable row level security;
alter table appointments           enable row level security;
alter table visits                 enable row level security;
alter table medicines              enable row level security;
alter table prescriptions          enable row level security;
alter table prescription_items     enable row level security;
alter table invoices               enable row level security;
alter table invoice_items          enable row level security;
alter table invoice_counters       enable row level security;
alter table payments               enable row level security;
alter table wa_messages            enable row level security;

-- ─── clinics ────────────────────────────────────────────────────
create policy clinics_member_read on clinics for select
  using (id in (select auth_clinic_ids()));
create policy clinics_member_update on clinics for update
  using (id in (select auth_clinic_ids()))
  with check (id in (select auth_clinic_ids()));
-- any authenticated user may create a clinic (onboarding)
create policy clinics_insert on clinics for insert
  with check (auth.uid() is not null);

-- ─── clinic_members ─────────────────────────────────────────────
create policy members_read on clinic_members for select
  using (user_id = auth.uid() or clinic_id in (select auth_clinic_ids()));
-- a user may add themselves (onboarding / accepting an invite)
create policy members_insert_self on clinic_members for insert
  with check (user_id = auth.uid());
create policy members_delete on clinic_members for delete
  using (clinic_id in (select auth_clinic_ids()));

-- ─── Simple tenant tables (clinic_id column present) ────────────
create policy tenant_all on patients for all
  using (clinic_id in (select auth_clinic_ids()))
  with check (clinic_id in (select auth_clinic_ids()));
create policy tenant_all on availability for all
  using (clinic_id in (select auth_clinic_ids()))
  with check (clinic_id in (select auth_clinic_ids()));
create policy tenant_all on availability_overrides for all
  using (clinic_id in (select auth_clinic_ids()))
  with check (clinic_id in (select auth_clinic_ids()));
create policy tenant_all on appointments for all
  using (clinic_id in (select auth_clinic_ids()))
  with check (clinic_id in (select auth_clinic_ids()));
create policy tenant_all on visits for all
  using (clinic_id in (select auth_clinic_ids()))
  with check (clinic_id in (select auth_clinic_ids()));
create policy tenant_all on prescriptions for all
  using (clinic_id in (select auth_clinic_ids()))
  with check (clinic_id in (select auth_clinic_ids()));
create policy tenant_all on invoices for all
  using (clinic_id in (select auth_clinic_ids()))
  with check (clinic_id in (select auth_clinic_ids()));
create policy tenant_all on invoice_counters for all
  using (clinic_id in (select auth_clinic_ids()))
  with check (clinic_id in (select auth_clinic_ids()));
create policy tenant_all on payments for all
  using (clinic_id in (select auth_clinic_ids()))
  with check (clinic_id in (select auth_clinic_ids()));

-- ─── medicines: global rows readable by all; clinic rows tenant-scoped ──
create policy medicines_read on medicines for select
  using (clinic_id is null or clinic_id in (select auth_clinic_ids()));
create policy medicines_write on medicines for insert
  with check (clinic_id in (select auth_clinic_ids()));
create policy medicines_update on medicines for update
  using (clinic_id in (select auth_clinic_ids()))
  with check (clinic_id in (select auth_clinic_ids()));
create policy medicines_delete on medicines for delete
  using (clinic_id in (select auth_clinic_ids()));

-- ─── Child tables (no clinic_id — scope via parent) ─────────────
create policy tenant_all on prescription_items for all
  using (prescription_id in (
    select id from prescriptions where clinic_id in (select auth_clinic_ids())))
  with check (prescription_id in (
    select id from prescriptions where clinic_id in (select auth_clinic_ids())));
create policy tenant_all on invoice_items for all
  using (invoice_id in (
    select id from invoices where clinic_id in (select auth_clinic_ids())))
  with check (invoice_id in (
    select id from invoices where clinic_id in (select auth_clinic_ids())));

-- ─── wa_messages: members read; writes happen via service role ──
create policy wa_read on wa_messages for select
  using (clinic_id in (select auth_clinic_ids()));
