-- ════════════════════════════════════════════════════════════════
-- 0027_booking_slot_validation.sql
--
-- Close a trust-the-client hole in public booking.
--
-- `create_booking` and `create_verified_booking` are granted to `anon`. Until
-- now they validated only that the requested instant was in the future and
-- that no other live appointment held it. Everything else — clinic opening
-- hours, day closures, blocked windows, the slot grid, the lead time — was
-- enforced solely by `src/lib/slots.ts` in the browser. Anyone calling the RPC
-- directly (a trivial POST to /rest/v1/rpc) could therefore book 03:00 on a
-- holiday, land inside a blocked surgery window, or sit off-grid at 10:07 and
-- desync the whole day's tiling.
--
-- `booking_slot_rejection()` is the server-side mirror of `generateDaySlots`.
-- It returns NULL when a slot is legitimately bookable, or a short error code
-- otherwise. Keep the two in step: the block-overlap test here is the same
-- half-open interval comparison as `overlapsBlock`, and the window/grid test
-- is the same `for (m = startM; m + slotMinutes <= endM; m += slotMinutes)`.
--
-- Staff-side booking (`src/actions/appointments.ts`) writes to `appointments`
-- directly and is deliberately NOT subject to this — a doctor squeezing
-- someone in at 21:40 is a feature, not an attack.
-- ════════════════════════════════════════════════════════════════

create or replace function public.booking_slot_rejection(
  p_clinic_id uuid,
  p_starts_at timestamptz
)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_clinic   clinics%rowtype;
  v_slot_min int;
  v_lead_min int;
  v_local    timestamp;
  v_date     date;
  v_mins     int;
  v_ovr      availability_overrides%rowtype;
  v_has_ovr  boolean := false;
  v_win      record;
  v_fits     boolean := false;
begin
  select * into v_clinic from clinics where id = p_clinic_id;
  if not found then return 'clinic_not_found'; end if;

  v_slot_min := coalesce((v_clinic.settings->>'slot_minutes')::int, 15);
  v_lead_min := coalesce((v_clinic.settings->>'lead_time_minutes')::int, 30);
  if v_slot_min <= 0 then v_slot_min := 15; end if;

  v_local := p_starts_at at time zone 'Asia/Kolkata';
  v_date  := v_local::date;
  v_mins  := extract(hour from v_local)::int * 60 + extract(minute from v_local)::int;

  -- A slot start is always a whole minute on the grid.
  if extract(second from v_local) <> 0 then return 'slot_invalid'; end if;

  -- Lead time. Subsumes the old `p_starts_at <= now()` check.
  if p_starts_at < now() + make_interval(mins => v_lead_min) then
    return 'slot_too_soon';
  end if;

  -- The booking page only ever offers the next 9 days; anything beyond that
  -- did not come from the UI.
  if v_date > ((now() at time zone 'Asia/Kolkata')::date + 8) then
    return 'slot_out_of_range';
  end if;

  select * into v_ovr from availability_overrides
   where clinic_id = p_clinic_id and date = v_date;
  v_has_ovr := found;

  if v_has_ovr and v_ovr.closed then return 'clinic_closed'; end if;

  -- Effective windows for the day: an override carrying explicit hours
  -- REPLACES the weekday sessions; otherwise the weekday sessions apply.
  for v_win in
    select (extract(hour from x.s)::int * 60 + extract(minute from x.s)::int) as start_m,
           (extract(hour from x.e)::int * 60 + extract(minute from x.e)::int) as end_m
      from (
        select v_ovr.start_time as s, v_ovr.end_time as e
         where v_has_ovr and v_ovr.start_time is not null and v_ovr.end_time is not null
        union all
        select a.start_time, a.end_time
          from availability a
         where a.clinic_id = p_clinic_id
           and a.weekday = extract(dow from v_date)::int
           and not (v_has_ovr and v_ovr.start_time is not null and v_ovr.end_time is not null)
      ) x
  loop
    -- Same tiling as generateDaySlots: start on the grid, end inside the window.
    if v_mins >= v_win.start_m
       and v_mins + v_slot_min <= v_win.end_m
       and ((v_mins - v_win.start_m) % v_slot_min) = 0
    then
      v_fits := true;
      exit;
    end if;
  end loop;

  if not v_fits then return 'outside_hours'; end if;

  -- Blocked windows, as half-open intervals — identical to overlapsBlock().
  if exists (
    select 1 from slot_blocks b
     where b.clinic_id = p_clinic_id
       and b.date = v_date
       and v_mins < (extract(hour from b.end_time)::int * 60 + extract(minute from b.end_time)::int)
       and v_mins + v_slot_min > (extract(hour from b.start_time)::int * 60 + extract(minute from b.start_time)::int)
  ) then
    return 'slot_blocked';
  end if;

  return null;
end;
$$;

comment on function public.booking_slot_rejection(uuid, timestamptz) is
  'NULL when the instant is a bookable public slot for the clinic, else a rejection code. Server-side mirror of src/lib/slots.ts generateDaySlots.';

-- ── create_booking: approve-mode public booking ─────────────────────────────
create or replace function public.create_booking(
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
  v_reject text;
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

  -- The slot must be one the clinic actually offers, not merely a future time.
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

-- ── create_verified_booking: OTP instant-booking ────────────────────────────
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
  v_reject text;
begin
  select * into v_clinic from clinics where slug = p_slug;
  if not found then return json_build_object('ok', false, 'error', 'clinic_not_found'); end if;
  -- Re-checked here, not just in issue_booking_otp: a token issued before the
  -- doctor switched booking off must not still be spendable.
  if coalesce((v_clinic.settings->>'booking_enabled')::boolean, true) = false then
    return json_build_object('ok', false, 'error', 'booking_disabled');
  end if;
  if p_name is null or length(trim(p_name)) < 2 then
    return json_build_object('ok', false, 'error', 'name_required');
  end if;

  v_reject := booking_slot_rejection(v_clinic.id, p_starts_at);
  if v_reject is not null then
    -- 'slot_past' is kept as the code for a stale slot so existing callers,
    -- which already handle it, keep working.
    return json_build_object('ok', false, 'error',
      case when v_reject = 'slot_too_soon' then 'slot_past' else v_reject end);
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

-- `booking_slot_rejection` is a helper for the two definer functions above and
-- is not part of the public API surface.
revoke execute on function public.booking_slot_rejection(uuid, timestamptz) from public, anon, authenticated;

grant execute on function public.create_booking(text, text, text, timestamptz, text, boolean) to anon, authenticated;
grant execute on function public.create_verified_booking(text, text, text, timestamptz, text, boolean) to anon, authenticated;
