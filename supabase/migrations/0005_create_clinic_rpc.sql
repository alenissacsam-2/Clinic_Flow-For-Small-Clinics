-- Atomic onboarding: create clinic + membership + availability + counter,
-- bypassing the RLS chicken-and-egg (membership doesn't exist yet) and
-- checking slug uniqueness across all clinics (not just the caller's).
create or replace function create_clinic(
  p_name text,
  p_slug text,
  p_doctor_name text,
  p_qualifications text,
  p_registration_no text,
  p_specialty text,
  p_phone text,
  p_address text,
  p_email text,
  p_settings jsonb,
  p_availability jsonb
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_id    uuid;
  v_slug  text := nullif(trim(p_slug), '');
  v_base  text;
  v_row   jsonb;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  -- Ensure a unique slug (global).
  v_base := coalesce(v_slug, 'clinic');
  v_slug := v_base;
  while exists (select 1 from clinics where slug = v_slug) loop
    v_slug := v_base || '-' || floor(1000 + random() * 9000)::int;
  end loop;

  insert into clinics (name, slug, doctor_name, qualifications, registration_no,
                       specialty, phone, address, email, settings)
  values (p_name, v_slug, p_doctor_name, p_qualifications, p_registration_no,
          p_specialty, p_phone, p_address, p_email, coalesce(p_settings, '{}'::jsonb))
  returning id into v_id;

  insert into clinic_members (clinic_id, user_id, role)
  values (v_id, v_uid, 'doctor');

  if p_availability is not null then
    for v_row in select * from jsonb_array_elements(p_availability) loop
      insert into availability (clinic_id, weekday, start_time, end_time)
      values (v_id,
              (v_row->>'weekday')::int,
              (v_row->>'start_time')::time,
              (v_row->>'end_time')::time);
    end loop;
  end if;

  insert into invoice_counters (clinic_id, year, last_no)
  values (v_id, extract(year from (now() at time zone 'Asia/Kolkata'))::int, 0)
  on conflict (clinic_id) do nothing;

  return v_id;
end;
$$;

revoke execute on function create_clinic(text,text,text,text,text,text,text,text,text,jsonb,jsonb) from anon;
