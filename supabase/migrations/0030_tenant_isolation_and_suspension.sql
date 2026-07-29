-- ════════════════════════════════════════════════════════════════
-- 0030_tenant_isolation_and_suspension.sql
--
-- Two holes, both of which let a client reach past a boundary the app
-- believed it was enforcing.
--
-- ── 1. Anyone could join any clinic (CRITICAL) ───────────────────────────────
--
-- 0002 shipped:
--
--     create policy members_insert_self on clinic_members for insert
--       with check (user_id = auth.uid());
--
-- The check proves the row is about *you*. It never asks which clinic you are
-- inserting yourself into. So any signed-up account could run
--
--     insert into clinic_members (clinic_id, user_id, role)
--     values ('<someone else''s clinic>', auth.uid(), 'doctor');
--
-- against /rest/v1/clinic_members and land inside another practice. From that
-- moment `auth_clinic_ids()` returns the victim's clinic, and every `tenant_all`
-- policy in the schema — patients, visits, prescriptions, invoices, payments,
-- lab orders, attachments — opens up, because they all scope by clinic_id and
-- nothing else.
--
-- The clinic uuid is not even a secret: `get_booking_context` returns it to
-- `anon` so the booking page can render. Every public booking link is a
-- ready-made target id.
--
-- Verified against the live database before this migration: a real signed-up
-- account holding zero memberships went from 0 readable patient rows to 9, plus
-- 15 appointments and 4 visit notes, on the strength of that single INSERT.
--
-- The policy is also dead weight. Nothing in the application inserts into
-- clinic_members from a client-scoped connection; both legitimate paths are
-- SECURITY DEFINER and bypass RLS entirely:
--
--     create_clinic()           — onboarding, inserts the founding doctor
--     accept_pending_invites()  — claims invites matching the caller's verified
--                                 email, which is the actual authorisation
--
-- So the policy is removed rather than narrowed. With no INSERT policy on the
-- table, a direct insert is refused and membership can only be granted by code
-- that checks an invite first. That is the property we wanted all along.
--
-- `clinics_insert` goes for the same reason: nothing inserts a clinic row
-- directly (onboarding calls create_clinic), and the policy let any signed-in
-- user push rows into the clinics table that no one would ever be a member of.
--
-- ── 2. A suspended clinic could un-suspend itself ────────────────────────────
--
-- `suspended_at` is the platform operator's off switch. But 0009's
-- `clinics_member_update` grants a doctor UPDATE over their own clinic row, and
-- Postgres RLS has no column granularity — so the doctor of a paused clinic
-- could PATCH /rest/v1/clinics?id=eq.<mine> with {"suspended_at": null} and let
-- themselves straight back in. `requireClinic()` redirects to /suspended, but
-- that is a rendering decision in the app; the row is what actually decides.
--
-- A trigger restores the column to operator-only. The app's own settings forms
-- never touch `suspended_at`, so nothing legitimate changes shape.
--
-- Suspension was also only ever consulted while *rendering*. `create_booking`,
-- `create_verified_booking`, `issue_booking_otp`, `verify_booking_otp` and
-- `get_display_queue` never looked at it, so a paused clinic kept taking
-- bookings and kept serving its waiting-room board to anyone calling the RPC
-- directly. Each now refuses, which is what "paused" was supposed to mean.
-- ════════════════════════════════════════════════════════════════

-- ─── 1. Tenant isolation ────────────────────────────────────────────────────

drop policy if exists members_insert_self on clinic_members;
drop policy if exists clinics_insert      on clinics;

comment on table clinic_members is
  'Membership grants tenant access. There is deliberately NO insert policy: rows '
  'are written only by create_clinic() (onboarding) and accept_pending_invites() '
  '(invite redemption), both SECURITY DEFINER. A client-side insert must stay '
  'impossible — see 0030.';

-- ─── 2. suspended_at is the operator's column ───────────────────────────────

create or replace function public.guard_clinic_suspension()
returns trigger
language plpgsql
-- Deliberately SECURITY INVOKER: the guard turns on who is *calling*, so
-- current_user must stay the caller's role rather than the function owner's.
as $$
begin
  if new.suspended_at is distinct from old.suspended_at then
    -- Server-side callers: the definer RPC (runs as owner), the cron job and
    -- anything else holding the service-role key.
    if current_user in ('postgres', 'service_role', 'supabase_admin') then
      return new;
    end if;
    -- A platform operator going through admin_set_clinic_suspended().
    if public.is_platform_admin() then
      return new;
    end if;
    raise exception 'suspended_at is managed by the platform operator'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

drop trigger if exists clinics_guard_suspension on clinics;
create trigger clinics_guard_suspension
  before update on clinics
  for each row execute function public.guard_clinic_suspension();

-- ─── 3. Suspension holds at the public write paths ──────────────────────────

create or replace function public.create_booking(
  p_slug text, p_name text, p_phone text,
  p_starts_at timestamptz, p_reason text, p_consent boolean
)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_clinic clinics%rowtype;
  v_slot_min int;
  v_patient_id uuid;
  v_pending_count int;
  v_reject text;
begin
  select * into v_clinic from clinics where slug = p_slug;
  if not found then
    return json_build_object('ok', false, 'error', 'Clinic not found');
  end if;
  -- A paused clinic takes nothing. get_booking_context already hides the page;
  -- this is the half that survives someone calling the RPC directly.
  if v_clinic.suspended_at is not null then
    return json_build_object('ok', false, 'error', 'Online booking is unavailable');
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

  v_reject := booking_slot_rejection(v_clinic.id, p_starts_at);
  if v_reject is not null then
    return json_build_object('ok', false, 'error',
      case v_reject
        when 'slot_too_soon'     then 'That time is too soon. Please pick a later slot.'
        when 'clinic_closed'     then 'The clinic is closed that day. Please pick another date.'
        when 'slot_blocked'      then 'That slot is not available. Please pick another.'
        when 'outside_hours'     then 'That time is outside the clinic''s hours. Please pick an offered slot.'
        when 'slot_out_of_range' then 'Please pick a date within the next week.'
        else 'Please pick an offered time slot.'
      end);
  end if;

  v_slot_min := coalesce((v_clinic.settings->>'slot_minutes')::int, 15);

  select id into v_patient_id
  from patients
  where clinic_id = v_clinic.id and phone = p_phone and deleted_at is null
  limit 1;

  -- The rate limit is checked BEFORE creating a patient row. Previously the
  -- insert came first, so a refused request still left a registry entry behind
  -- and the clinic's patient list could be filled with junk by a caller who
  -- never actually got an appointment.
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

  if v_patient_id is null then
    insert into patients (clinic_id, full_name, phone, whatsapp_opt_in, consent_at)
    values (v_clinic.id, trim(p_name), p_phone, coalesce(p_consent, true),
            case when coalesce(p_consent, true) then now() else null end)
    returning id into v_patient_id;
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
  if v_clinic.suspended_at is not null then
    return json_build_object('ok', false, 'error', 'booking_disabled');
  end if;
  if coalesce((v_clinic.settings->>'booking_enabled')::boolean, true) = false then
    return json_build_object('ok', false, 'error', 'booking_disabled');
  end if;
  if p_phone !~ '^\+91[6-9][0-9]{9}$' then
    return json_build_object('ok', false, 'error', 'invalid_phone');
  end if;

  select max(created_at) into v_last from booking_otps
    where clinic_id = v_clinic.id and phone = p_phone;
  if v_last is not null and v_last > now() - interval '45 seconds' then
    return json_build_object('ok', false, 'error', 'cooldown', 'retry_after', 45);
  end if;

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

create or replace function public.verify_booking_otp(
  p_slug text, p_phone text, p_otp_id uuid, p_code text)
 returns json language plpgsql security definer set search_path = public as $$
declare
  v_clinic clinics%rowtype;
  v_otp booking_otps%rowtype;
  v_token text;
  v_name text;
begin
  select * into v_clinic from clinics where slug = p_slug;
  if not found then return json_build_object('ok', false, 'error', 'clinic_not_found'); end if;
  if v_clinic.suspended_at is not null then
    return json_build_object('ok', false, 'error', 'clinic_not_found');
  end if;

  select * into v_otp from booking_otps
    where id = p_otp_id and clinic_id = v_clinic.id and phone = p_phone
      and expires_at > now() and verified_at is null and consumed_at is null;
  if not found then return json_build_object('ok', false, 'error', 'expired'); end if;

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

  select full_name into v_name from patients
    where clinic_id = v_clinic.id and phone = p_phone and deleted_at is null limit 1;

  return json_build_object('ok', true, 'verify_token', v_token,
    'patient', case when v_name is null then null else json_build_object('full_name', v_name) end);
end; $$;

create or replace function public.create_verified_booking(
  p_slug text, p_verify_token text, p_name text,
  p_starts_at timestamptz, p_reason text, p_consent boolean)
 returns json language plpgsql security definer set search_path = public as $$
declare
  v_clinic clinics%rowtype;
  v_otp booking_otps%rowtype;
  v_slot_min int;
  v_patient_id uuid;
  v_token int;
  v_appt_id uuid;
  v_day date;
  v_reject text;
begin
  select * into v_clinic from clinics where slug = p_slug;
  if not found then return json_build_object('ok', false, 'error', 'clinic_not_found'); end if;
  if v_clinic.suspended_at is not null then
    return json_build_object('ok', false, 'error', 'booking_disabled');
  end if;
  if coalesce((v_clinic.settings->>'booking_enabled')::boolean, true) = false then
    return json_build_object('ok', false, 'error', 'booking_disabled');
  end if;
  if p_name is null or length(trim(p_name)) < 2 then
    return json_build_object('ok', false, 'error', 'name_required');
  end if;

  v_reject := booking_slot_rejection(v_clinic.id, p_starts_at);
  if v_reject is not null then
    return json_build_object('ok', false, 'error',
      case when v_reject = 'slot_too_soon' then 'slot_past' else v_reject end);
  end if;

  select * into v_otp from booking_otps
    where clinic_id = v_clinic.id
      and verified_at is not null and verified_at > now() - interval '15 minutes'
      and consumed_at is null
      and verify_hash = encode(extensions.digest(id::text || p_verify_token, 'sha256'), 'hex')
    limit 1;
  if not found then return json_build_object('ok', false, 'error', 'invalid_token'); end if;

  v_slot_min := coalesce((v_clinic.settings->>'slot_minutes')::int, 15);
  v_day := (p_starts_at at time zone 'Asia/Kolkata')::date;

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
    return json_build_object('ok', false, 'error', 'slot_taken');
  end;

  update booking_otps set consumed_at = now() where id = v_otp.id;

  return json_build_object('ok', true, 'appointment_id', v_appt_id,
    'token_number', v_token, 'starts_at', p_starts_at);
end; $$;

-- The wall board of a paused clinic reads as "not found" rather than showing a
-- live queue. 404 is the honest answer: there is no board to serve.
create or replace function public.get_display_queue(p_slug text)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_clinic clinics%rowtype;
  v_today  date := (now() at time zone 'Asia/Kolkata')::date;
  v_pace   int;
begin
  select * into v_clinic from clinics where slug = p_slug;
  if not found or v_clinic.suspended_at is not null then
    return json_build_object('found', false);
  end if;

  -- Pace, unchanged from 0029 — see that file for why this measures the gap
  -- between consultation starts rather than consultation duration.
  select case when count(*) >= 2 then round(avg(gap))::int end
    into v_pace
  from (
    select extract(epoch from (created_at - lag(created_at) over (order by created_at))) / 60.0 as gap
    from visits
    where clinic_id = v_clinic.id
      and visit_date = v_today
  ) g
  where gap between 2 and 60;

  return json_build_object(
    'found', true,
    'clinic', json_build_object(
      'name', v_clinic.name,
      'doctor_name', v_clinic.doctor_name,
      'specialty', v_clinic.specialty,
      'logo_path', v_clinic.logo_path,
      'lang', coalesce(v_clinic.settings->>'template_lang', 'en')
    ),
    'in_consult', coalesce((
      select json_agg(json_build_object('token', token_number) order by starts_at)
      from appointments
      where clinic_id = v_clinic.id
        and (starts_at at time zone 'Asia/Kolkata')::date = v_today
        and status = 'in_progress'
        and token_number is not null
    ), '[]'::json),
    'waiting', coalesce((
      select json_agg(json_build_object('token', token_number) order by
        case when status = 'arrived' then 0 else 1 end, starts_at)
      from appointments
      where clinic_id = v_clinic.id
        and (starts_at at time zone 'Asia/Kolkata')::date = v_today
        and status in ('arrived', 'confirmed')
        and token_number is not null
    ), '[]'::json),
    'completed_count', (
      select count(*)
      from appointments
      where clinic_id = v_clinic.id
        and (starts_at at time zone 'Asia/Kolkata')::date = v_today
        and status = 'completed'
    ),
    'pace_minutes', v_pace,
    'as_of', to_char(now() at time zone 'Asia/Kolkata', 'HH24:MI')
  );
end;
$$;

-- Grants are unchanged by CREATE OR REPLACE, but restated so this file alone
-- describes the reachable surface.
grant execute on function public.create_booking(text, text, text, timestamptz, text, boolean) to anon, authenticated;
grant execute on function public.create_verified_booking(text, text, text, timestamptz, text, boolean) to anon, authenticated;
grant execute on function public.verify_booking_otp(text, text, uuid, text) to anon, authenticated;
grant execute on function public.get_display_queue(text) to anon, authenticated;
revoke execute on function public.issue_booking_otp(text, text) from public, anon, authenticated;
grant  execute on function public.issue_booking_otp(text, text) to service_role;
revoke execute on function public.guard_clinic_suspension() from public, anon, authenticated;
