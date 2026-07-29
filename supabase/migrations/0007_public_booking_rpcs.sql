-- Public booking runs entirely through these SECURITY DEFINER functions, so
-- anon never gets direct table access and no service-role key is required.

-- Context for rendering the booking page: clinic public fields, availability,
-- the next 8 days of overrides, and the booked slot starts (no patient data).
create or replace function get_booking_context(p_slug text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clinic clinics%rowtype;
  v_result json;
begin
  select * into v_clinic from clinics where slug = p_slug;
  if not found then
    return json_build_object('found', false);
  end if;
  if coalesce((v_clinic.settings->>'booking_enabled')::boolean, true) = false then
    return json_build_object('found', true, 'enabled', false,
      'clinic', json_build_object('name', v_clinic.name));
  end if;

  select json_build_object(
    'found', true,
    'enabled', true,
    'clinic', json_build_object(
      'id', v_clinic.id, 'name', v_clinic.name, 'slug', v_clinic.slug,
      'doctor_name', v_clinic.doctor_name, 'specialty', v_clinic.specialty,
      'address', v_clinic.address, 'phone', v_clinic.phone,
      'settings', v_clinic.settings
    ),
    'availability', coalesce((
      select json_agg(json_build_object('weekday', weekday,
        'start_time', to_char(start_time,'HH24:MI'), 'end_time', to_char(end_time,'HH24:MI')))
      from availability where clinic_id = v_clinic.id), '[]'::json),
    'overrides', coalesce((
      select json_agg(json_build_object('date', date, 'closed', closed,
        'start_time', to_char(start_time,'HH24:MI'), 'end_time', to_char(end_time,'HH24:MI')))
      from availability_overrides
      where clinic_id = v_clinic.id
        and date between (now() at time zone 'Asia/Kolkata')::date
                     and ((now() at time zone 'Asia/Kolkata')::date + 8)), '[]'::json),
    'booked', coalesce((
      select json_agg(starts_at)
      from appointments
      where clinic_id = v_clinic.id
        and status in ('pending','confirmed','arrived','in_progress')
        and starts_at >= now()
        and starts_at < now() + interval '9 days'), '[]'::json)
  ) into v_result;

  return v_result;
end;
$$;

-- Create a pending online booking. Finds or creates the patient by phone,
-- rate-limits per phone, and relies on the unique slot index to block races.
create or replace function create_booking(
  p_slug text,
  p_name text,
  p_phone text,
  p_starts_at timestamptz,
  p_reason text,
  p_consent boolean
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clinic clinics%rowtype;
  v_slot_min int;
  v_patient_id uuid;
  v_pending_count int;
begin
  select * into v_clinic from clinics where slug = p_slug;
  if not found then
    return json_build_object('ok', false, 'error', 'Clinic not found');
  end if;
  if coalesce((v_clinic.settings->>'booking_enabled')::boolean, true) = false then
    return json_build_object('ok', false, 'error', 'Online booking is disabled');
  end if;
  if p_name is null or length(trim(p_name)) < 2 then
    return json_build_object('ok', false, 'error', 'Please enter your name');
  end if;
  if p_phone !~ '^\+91[6-9][0-9]{9}$' then
    return json_build_object('ok', false, 'error', 'Enter a valid mobile number');
  end if;
  if p_starts_at <= now() then
    return json_build_object('ok', false, 'error', 'Pick a future time slot');
  end if;

  v_slot_min := coalesce((v_clinic.settings->>'slot_minutes')::int, 15);

  -- Find or create the patient within this clinic.
  select id into v_patient_id
  from patients
  where clinic_id = v_clinic.id and phone = p_phone and deleted_at is null
  limit 1;

  if v_patient_id is null then
    insert into patients (clinic_id, full_name, phone, whatsapp_opt_in, consent_at)
    values (v_clinic.id, trim(p_name), p_phone, coalesce(p_consent, true),
            case when coalesce(p_consent, true) then now() else null end)
    returning id into v_patient_id;
  end if;

  -- Rate limit: at most 3 pending online bookings per phone per rolling day.
  select count(*) into v_pending_count
  from appointments a
  join patients pt on pt.id = a.patient_id
  where pt.phone = p_phone
    and a.clinic_id = v_clinic.id
    and a.status = 'pending'
    and a.created_at > now() - interval '24 hours';
  if v_pending_count >= 3 then
    return json_build_object('ok', false, 'error', 'You already have pending requests. Please wait for confirmation.');
  end if;

  begin
    insert into appointments (clinic_id, patient_id, starts_at, ends_at, status, source, reason)
    values (v_clinic.id, v_patient_id, p_starts_at,
            p_starts_at + make_interval(mins => v_slot_min),
            'pending', 'online', nullif(trim(coalesce(p_reason,'')), ''));
  exception when unique_violation then
    return json_build_object('ok', false, 'error', 'That slot was just taken. Please pick another.');
  end;

  return json_build_object('ok', true);
end;
$$;

grant execute on function get_booking_context(text) to anon, authenticated;
grant execute on function create_booking(text, text, text, timestamptz, text, boolean) to anon, authenticated;
