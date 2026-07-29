-- Phase 5 (v2): pre-visit intake. After a booking is confirmed the patient gets
-- a tokenized link to fill age/gender/allergies/complaints/medicines. Answers
-- merge onto the patient record (blank fields only) and pre-fill the visit editor.

create table if not exists intake_requests (
  id             uuid primary key default gen_random_uuid(),
  clinic_id      uuid not null references clinics(id) on delete cascade,
  appointment_id uuid not null unique references appointments(id) on delete cascade,
  patient_id     uuid not null references patients(id) on delete cascade,
  token_hash     text not null unique,        -- sha256(raw token)
  status         text not null default 'pending' check (status in ('pending','submitted','expired')),
  payload        jsonb not null default '{}',
  expires_at     timestamptz not null,
  submitted_at   timestamptz,
  created_at     timestamptz not null default now()
);
create index if not exists intake_appt_idx on intake_requests (clinic_id, appointment_id);

alter table intake_requests enable row level security;
drop policy if exists intake_member_read on intake_requests;
create policy intake_member_read on intake_requests for select
  using (clinic_id in (select auth_clinic_ids()));  -- writes via definer/service only

-- Public: fetch the intake context for a raw token.
create or replace function public.get_intake_context(p_token text)
 returns json language plpgsql security definer set search_path = public as $$
declare
  v_row intake_requests%rowtype;
  v_clinic clinics%rowtype;
  v_patient patients%rowtype;
  v_appt appointments%rowtype;
begin
  select * into v_row from intake_requests
    where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex');
  if not found then return json_build_object('found', false); end if;
  if v_row.expires_at < now() then return json_build_object('found', false, 'expired', true); end if;

  select * into v_clinic from clinics where id = v_row.clinic_id;
  select * into v_patient from patients where id = v_row.patient_id;
  select * into v_appt from appointments where id = v_row.appointment_id;

  return json_build_object(
    'found', true,
    'submitted', v_row.status = 'submitted',
    'clinic_name', v_clinic.name,
    'doctor_name', v_clinic.doctor_name,
    'appointment_time', v_appt.starts_at,
    'prefill', json_build_object(
      'full_name', v_patient.full_name,
      'age_years', v_patient.age_years,
      'dob', v_patient.dob,
      'gender', v_patient.gender,
      'allergies', v_patient.allergies
    )
  );
end; $$;

-- Public: submit the intake (single-use). Merges blank-only demographics onto
-- the patient; keeps complaints/medicines in payload for the visit editor.
create or replace function public.submit_intake(p_token text, p_payload jsonb)
 returns json language plpgsql security definer set search_path = public as $$
declare
  v_row intake_requests%rowtype;
  v_age int;
  v_dob date;
  v_gender text;
  v_allergies text;
begin
  select * into v_row from intake_requests
    where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex');
  if not found then return json_build_object('ok', false, 'error', 'not_found'); end if;
  if v_row.expires_at < now() then return json_build_object('ok', false, 'error', 'expired'); end if;
  if v_row.status = 'submitted' then return json_build_object('ok', false, 'error', 'already_submitted'); end if;

  -- Sanitize the incoming values.
  v_age := case when (p_payload->>'age_years') ~ '^\d{1,3}$' then (p_payload->>'age_years')::int else null end;
  v_dob := case when (p_payload->>'dob') ~ '^\d{4}-\d{2}-\d{2}$' then (p_payload->>'dob')::date else null end;
  v_gender := case when (p_payload->>'gender') in ('male','female','other') then p_payload->>'gender' else null end;
  v_allergies := nullif(trim(coalesce(p_payload->>'allergies','')), '');

  -- Single-use guard: only transitions a pending row.
  update intake_requests
    set status = 'submitted', submitted_at = now(),
        payload = jsonb_build_object(
          'age_years', v_age, 'dob', v_dob, 'gender', v_gender,
          'allergies', v_allergies,
          'complaints', nullif(trim(coalesce(p_payload->>'complaints','')), ''),
          'medicines', nullif(trim(coalesce(p_payload->>'medicines','')), ''))
    where id = v_row.id and status = 'pending';
  if not found then return json_build_object('ok', false, 'error', 'already_submitted'); end if;

  -- Merge demographics onto the patient: blanks only, except allergies (overwrite if provided).
  update patients set
    age_years = coalesce(age_years, v_age),
    dob = coalesce(dob, v_dob),
    gender = coalesce(gender, v_gender),
    allergies = case when v_allergies is not null then v_allergies else allergies end
  where id = v_row.patient_id;

  return json_build_object('ok', true);
end; $$;

grant execute on function public.get_intake_context(text) to anon, authenticated;
grant execute on function public.submit_intake(text, jsonb) to anon, authenticated;
