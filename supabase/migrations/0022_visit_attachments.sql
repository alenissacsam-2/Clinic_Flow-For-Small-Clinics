-- ════════════════════════════════════════════════════════════════
-- 0022_visit_attachments.sql — files on a visit (scans, lab reports, photos)
--
-- Private bucket. Objects live under {clinic_id}/{patient_id}/... and are
-- read through short-lived signed URLs.
--
-- Unlike `rx-pdfs` and `receipts` (written by server code with the service
-- role), this bucket is written by the *doctor's own session* — so it needs a
-- `select` policy too, or `createSignedUrl` fails for a signed-in member and
-- attachments would silently require SUPABASE_SERVICE_ROLE_KEY to be set.
-- ════════════════════════════════════════════════════════════════

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'visit-files', 'visit-files', false,
  10485760,  -- 10 MB: a phone photo of a report, not a DICOM study
  array['image/jpeg','image/png','image/webp','image/heic','application/pdf']
)
on conflict (id) do update
  set file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Members may read/write only inside their own clinic's folder.
drop policy if exists visit_files_member_select on storage.objects;
create policy visit_files_member_select on storage.objects for select to authenticated
  using (
    bucket_id = 'visit-files'
    and ((storage.foldername(name))[1])::uuid in (select auth_clinic_ids())
  );

drop policy if exists visit_files_member_insert on storage.objects;
create policy visit_files_member_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'visit-files'
    and ((storage.foldername(name))[1])::uuid in (select auth_clinic_ids())
  );

drop policy if exists visit_files_member_update on storage.objects;
create policy visit_files_member_update on storage.objects for update to authenticated
  using (
    bucket_id = 'visit-files'
    and ((storage.foldername(name))[1])::uuid in (select auth_clinic_ids())
  )
  with check (
    bucket_id = 'visit-files'
    and ((storage.foldername(name))[1])::uuid in (select auth_clinic_ids())
  );

drop policy if exists visit_files_member_delete on storage.objects;
create policy visit_files_member_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'visit-files'
    and ((storage.foldername(name))[1])::uuid in (select auth_clinic_ids())
  );

-- ─── The record of what was uploaded ────────────────────────────
-- `visit_id` is nullable on purpose: a file can belong to the patient without
-- belonging to a consultation (an old report brought in, a scan posted later),
-- and deleting a visit must not delete the patient's imaging.
create table if not exists visit_attachments (
  id           uuid primary key default gen_random_uuid(),
  clinic_id    uuid not null references clinics(id) on delete cascade,
  patient_id   uuid not null references patients(id) on delete cascade,
  visit_id     uuid references visits(id) on delete set null,

  storage_path text not null,   -- bucket-prefixed, e.g. 'visit-files/{clinic}/{patient}/{uuid}.pdf'
  file_name    text not null,   -- the name the clinic uploaded, shown in the UI
  mime_type    text,
  size_bytes   integer,

  kind         text not null default 'other'
                 check (kind in ('scan','lab_report','discharge','photo','other')),
  note         text,
  uploaded_by  uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now()
);

create index if not exists visit_attachments_patient_idx
  on visit_attachments (patient_id, created_at desc);
create index if not exists visit_attachments_visit_idx
  on visit_attachments (visit_id) where visit_id is not null;

alter table visit_attachments enable row level security;

drop policy if exists tenant_all on visit_attachments;
create policy tenant_all on visit_attachments for all
  using (clinic_id in (select auth_clinic_ids()))
  with check (clinic_id in (select auth_clinic_ids()));
