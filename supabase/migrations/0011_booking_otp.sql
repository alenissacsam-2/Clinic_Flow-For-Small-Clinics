-- Phase 4 (v2): OTP-verified instant booking.
-- A patient verifies their phone with a 6-digit code, then the slot confirms
-- instantly (no doctor approval). Codes are hashed at rest; all rate-limiting
-- lives inside the SECURITY DEFINER RPCs. The issuer returns the plaintext code
-- and is therefore callable ONLY by the service role (server-side delivery).

create table if not exists booking_otps (
  id          uuid primary key default gen_random_uuid(),
  clinic_id   uuid not null references clinics(id) on delete cascade,
  phone       text not null,                 -- E.164
  code_hash   text not null,                 -- sha256(id || code)
  verify_hash text,                          -- sha256(id || verify_token), set on success
  attempts    int not null default 0,
  expires_at  timestamptz not null,          -- created + 5 min
  verified_at timestamptz,
  consumed_at timestamptz,                   -- booking created with this verify token
  created_at  timestamptz not null default now()
);
create index if not exists booking_otps_phone_idx on booking_otps (clinic_id, phone, created_at desc);
alter table booking_otps enable row level security;  -- no policies: definer/service only

-- ── Issue a code ────────────────────────────────────────────────────────────
create or replace function public.issue_booking_otp(p_slug text, p_phone text)
 returns json language plpgsql security definer set search_path = public as $$
declare
  v_clinic clinics%rowtype;
  v_id uuid := gen_random_uuid();
  v_code text := lpad((floor(random() * 1000000))::int::text, 6, '0');
  v_last timestamptz;
  v_per_phone int; v_per_clinic int; v_per_phone_day int;
begin
  select * into v_clinic from clinics where slug = p_slug;
  if not found then return json_build_object('ok', false, 'error', 'clinic_not_found'); end if;
  if coalesce((v_clinic.settings->>'booking_enabled')::boolean, true) = false then
    return json_build_object('ok', false, 'error', 'booking_disabled');
  end if;
  if p_phone !~ '^\+91[6-9][0-9]{9}$' then
    return json_build_object('ok', false, 'error', 'invalid_phone');
  end if;

  -- Resend cooldown: 45s since the last code for this phone+clinic.
  select max(created_at) into v_last from booking_otps
    where clinic_id = v_clinic.id and phone = p_phone;
  if v_last is not null and v_last > now() - interval '45 seconds' then
    return json_build_object('ok', false, 'error', 'cooldown', 'retry_after', 45);
  end if;

  -- Layered hourly / daily caps.
  select count(*) into v_per_phone from booking_otps
    where clinic_id = v_clinic.id and phone = p_phone and created_at > now() - interval '1 hour';
  if v_per_phone >= 5 then return json_build_object('ok', false, 'error', 'rate_limited'); end if;

  select count(*) into v_per_clinic from booking_otps
    where clinic_id = v_clinic.id and created_at > now() - interval '1 hour';
  if v_per_clinic >= 30 then return json_build_object('ok', false, 'error', 'rate_limited'); end if;

  select count(*) into v_per_phone_day from booking_otps
    where phone = p_phone and created_at > now() - interval '1 day';
  if v_per_phone_day >= 15 then return json_build_object('ok', false, 'error', 'rate_limited'); end if;

  insert into booking_otps (id, clinic_id, phone, code_hash, expires_at)
  values (v_id, v_clinic.id, p_phone,
          encode(extensions.digest(v_id::text || v_code, 'sha256'), 'hex'),
          now() + interval '5 minutes');

  return json_build_object('ok', true, 'otp_id', v_id, 'code', v_code, 'resend_after', 45);
end; $$;

-- ── Verify a code ───────────────────────────────────────────────────────────
create or replace function public.verify_booking_otp(p_slug text, p_phone text, p_otp_id uuid, p_code text)
 returns json language plpgsql security definer set search_path = public as $$
declare
  v_clinic clinics%rowtype;
  v_otp booking_otps%rowtype;
  v_token text;
  v_name text;
begin
  select * into v_clinic from clinics where slug = p_slug;
  if not found then return json_build_object('ok', false, 'error', 'clinic_not_found'); end if;

  select * into v_otp from booking_otps
    where id = p_otp_id and clinic_id = v_clinic.id and phone = p_phone
      and expires_at > now() and verified_at is null and consumed_at is null;
  if not found then return json_build_object('ok', false, 'error', 'expired'); end if;

  -- Count the attempt before checking, and lock after 5 wrong tries.
  update booking_otps set attempts = attempts + 1 where id = v_otp.id;
  if v_otp.attempts + 1 > 5 then
    return json_build_object('ok', false, 'error', 'too_many_attempts');
  end if;

  if encode(extensions.digest(v_otp.id::text || p_code, 'sha256'), 'hex') <> v_otp.code_hash then
    return json_build_object('ok', false, 'error', 'wrong_code', 'attempts_left', 5 - (v_otp.attempts + 1));
  end if;

  v_token := gen_random_uuid()::text;
  update booking_otps
    set verified_at = now(),
        verify_hash = encode(extensions.digest(v_otp.id::text || v_token, 'sha256'), 'hex')
    where id = v_otp.id;

  -- Returning-patient pre-fill (name only).
  select full_name into v_name from patients
    where clinic_id = v_clinic.id and phone = p_phone and deleted_at is null limit 1;

  return json_build_object('ok', true, 'verify_token', v_token,
    'patient', case when v_name is null then null else json_build_object('full_name', v_name) end);
end; $$;

-- ── Create the confirmed booking with a verify token ────────────────────────
create or replace function public.create_verified_booking(
  p_slug text, p_verify_token text, p_name text, p_starts_at timestamptz, p_reason text, p_consent boolean)
 returns json language plpgsql security definer set search_path = public as $$
declare
  v_clinic clinics%rowtype;
  v_otp booking_otps%rowtype;
  v_slot_min int;
  v_patient_id uuid;
  v_token int;
  v_appt_id uuid;
  v_day date;
begin
  select * into v_clinic from clinics where slug = p_slug;
  if not found then return json_build_object('ok', false, 'error', 'clinic_not_found'); end if;
  if p_name is null or length(trim(p_name)) < 2 then
    return json_build_object('ok', false, 'error', 'name_required');
  end if;
  if p_starts_at <= now() then
    return json_build_object('ok', false, 'error', 'slot_past');
  end if;

  -- Match the verify token to its (verified, unconsumed, recent) OTP row.
  select * into v_otp from booking_otps
    where clinic_id = v_clinic.id
      and verified_at is not null and verified_at > now() - interval '15 minutes'
      and consumed_at is null
      and verify_hash = encode(extensions.digest(id::text || p_verify_token, 'sha256'), 'hex')
    limit 1;
  if not found then return json_build_object('ok', false, 'error', 'invalid_token'); end if;

  v_slot_min := coalesce((v_clinic.settings->>'slot_minutes')::int, 15);
  v_day := (p_starts_at at time zone 'Asia/Kolkata')::date;

  -- Find or create the patient (by verified phone).
  select id into v_patient_id from patients
    where clinic_id = v_clinic.id and phone = v_otp.phone and deleted_at is null limit 1;
  if v_patient_id is null then
    insert into patients (clinic_id, full_name, phone, whatsapp_opt_in, consent_at)
    values (v_clinic.id, trim(p_name), v_otp.phone, coalesce(p_consent, true),
            case when coalesce(p_consent, true) then now() else null end)
    returning id into v_patient_id;
  end if;

  v_token := next_token_number(v_clinic.id, v_day);

  begin
    insert into appointments (clinic_id, patient_id, starts_at, ends_at, status, source, reason, token_number)
    values (v_clinic.id, v_patient_id, p_starts_at,
            p_starts_at + make_interval(mins => v_slot_min),
            'confirmed', 'online', nullif(trim(coalesce(p_reason,'')), ''), v_token)
    returning id into v_appt_id;
  exception when unique_violation then
    -- Keep the verify token valid so the patient can pick another slot.
    return json_build_object('ok', false, 'error', 'slot_taken');
  end;

  update booking_otps set consumed_at = now() where id = v_otp.id;

  return json_build_object('ok', true, 'appointment_id', v_appt_id,
    'token_number', v_token, 'starts_at', p_starts_at);
end; $$;

-- Grants: issuer is service-role only (returns plaintext); verify/create are anon-callable.
revoke execute on function public.issue_booking_otp(text, text) from public, anon, authenticated;
grant execute on function public.issue_booking_otp(text, text) to service_role;
grant execute on function public.verify_booking_otp(text, text, uuid, text) to anon, authenticated;
grant execute on function public.create_verified_booking(text, text, text, timestamptz, text, boolean) to anon, authenticated;
