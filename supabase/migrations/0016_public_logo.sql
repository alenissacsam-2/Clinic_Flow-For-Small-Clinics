-- v4 Phase 2: expose clinic logo_path to the public patient pages so the
-- booking / intake / pay surfaces can show the clinic's own brand. Re-creates
-- the three public RPCs with a logo_path field added (behaviour otherwise
-- identical to 0016's predecessors: get_booking_context=0014, intake=0012, pay=0013).

create or replace function public.get_booking_context(p_slug text)
 returns json
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_clinic clinics%rowtype;
  v_result json;
begin
  select * into v_clinic from clinics where slug = p_slug;
  if not found then
    return json_build_object('found', false);
  end if;
  if v_clinic.suspended_at is not null then
    return json_build_object('found', true, 'enabled', false,
      'clinic', json_build_object('name', v_clinic.name));
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
      'logo_path', v_clinic.logo_path,
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
    'blocks', coalesce((
      select json_agg(json_build_object('date', date,
        'start_time', to_char(start_time,'HH24:MI'), 'end_time', to_char(end_time,'HH24:MI')))
      from slot_blocks
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
$function$;

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
    'logo_path', v_clinic.logo_path,
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

create or replace function public.get_invoice_public(p_token text)
 returns json language plpgsql security definer set search_path = public as $$
declare
  v_inv invoices%rowtype;
  v_clinic clinics%rowtype;
  v_paid numeric;
begin
  select * into v_inv from invoices where pay_token = p_token;
  if not found then return json_build_object('found', false); end if;
  select * into v_clinic from clinics where id = v_inv.clinic_id;
  select coalesce(sum(amount), 0) into v_paid from payments where invoice_id = v_inv.id;

  return json_build_object(
    'found', true,
    'invoice_no', v_inv.invoice_no,
    'status', v_inv.status,
    'amount_due', greatest(0, v_inv.total_amount - v_paid),
    'claimed', v_inv.claimed_utr is not null,
    'clinic', json_build_object(
      'name', v_clinic.name,
      'logo_path', v_clinic.logo_path,
      'upi_vpa', v_clinic.settings->>'upi_vpa',
      'upi_name', coalesce(nullif(v_clinic.settings->>'upi_name',''), v_clinic.name)
    )
  );
end; $$;
