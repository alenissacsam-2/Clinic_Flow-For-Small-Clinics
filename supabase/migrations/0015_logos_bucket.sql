-- v4 Phase 2: clinic logo storage. Public bucket so the logo can appear on the
-- public booking page and inside generated PDFs (no signed URLs needed).
-- Objects live under {clinic_id}/... ; a clinic's members may write their own folder.

insert into storage.buckets (id, name, public)
values ('logos', 'logos', true)
on conflict (id) do nothing;

-- Members can upload/replace/remove logos only within their own clinic's folder.
drop policy if exists logos_member_insert on storage.objects;
create policy logos_member_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'logos'
    and ((storage.foldername(name))[1])::uuid in (select auth_clinic_ids())
  );

drop policy if exists logos_member_update on storage.objects;
create policy logos_member_update on storage.objects for update to authenticated
  using (
    bucket_id = 'logos'
    and ((storage.foldername(name))[1])::uuid in (select auth_clinic_ids())
  )
  with check (
    bucket_id = 'logos'
    and ((storage.foldername(name))[1])::uuid in (select auth_clinic_ids())
  );

drop policy if exists logos_member_delete on storage.objects;
create policy logos_member_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'logos'
    and ((storage.foldername(name))[1])::uuid in (select auth_clinic_ids())
  );
