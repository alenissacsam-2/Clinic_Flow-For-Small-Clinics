-- Members may enqueue and update their clinic's WhatsApp messages so the
-- in-app triggers (confirm, cancel, Rx send) work with the user's session.
-- The webhook and cron run with the service role (which bypasses RLS).
create policy wa_insert on wa_messages for insert
  with check (clinic_id in (select auth_clinic_ids()));
create policy wa_update on wa_messages for update
  using (clinic_id in (select auth_clinic_ids()))
  with check (clinic_id in (select auth_clinic_ids()));

-- Private storage buckets for generated documents (accessed via signed URLs
-- from server code using the service role).
insert into storage.buckets (id, name, public)
values ('rx-pdfs', 'rx-pdfs', false), ('receipts', 'receipts', false)
on conflict (id) do nothing;
