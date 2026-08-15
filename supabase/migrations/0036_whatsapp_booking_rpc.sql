-- ════════════════════════════════════════════════════════════════
-- 0036_whatsapp_booking_rpc.sql
--
-- Booking from a WhatsApp conversation.
--
-- ── Why there is no OTP here ────────────────────────────────────────────────
-- `create_verified_booking` exists because the web booking page cannot trust
-- the phone number typed into it, so it issues a code and checks the caller can
-- read it. None of that applies over WhatsApp: Meta has already established
-- that the sender controls that number — it is the account identity, verified
-- at registration and re-verified on every device change — and the webhook
-- signature proves the message really came from Meta.
--
-- Asking a patient to prove ownership of the phone they are literally texting
-- from would be security theatre that costs a real step in the funnel. So this
-- takes the phone as given, and its safety instead comes from being callable
-- ONLY by the service role: the caller is our webhook, never a browser.
--
-- Everything else mirrors `create_booking` / `create_verified_booking` — the
-- same suspension and booking_enabled gates, the same `booking_slot_rejection`
-- validation, the same rate limit checked before any patient row is created,
-- the same unique-violation race handling. Divergence between the three would
-- be a way to book something one of the others would refuse.
-- ════════════════════════════════════════════════════════════════

create or replace function public.create_whatsapp_booking(
  p_clinic_id uuid,
  p_phone text,
  p_name text,
  p_starts_at timestamptz,
  p_reason text
)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_clinic        clinics%rowtype;
  v_slot_min      int;
  v_pending_count int;
  v_patient_id    uuid;
  v_status        appointment_status;
  v_token         int;
  v_appt_id       uuid;
  v_day           date;
  v_reject        text;
begin
  select * into v_clinic from clinics where id = p_clinic_id;
  if not found then
    return json_build_object('ok', false, 'error', 'clinic_not_found');
  end if;
  if v_clinic.suspended_at is not null then
    return json_build_object('ok', false, 'error', 'booking_disabled');
  end if;
  if coalesce((v_clinic.settings->>'booking_enabled')::boolean, true) = false then
    return json_build_object('ok', false, 'error', 'booking_disabled');
  end if;
  if p_name is null or length(trim(p_name)) < 2 then
    return json_build_object('ok', false, 'error', 'name_required');
  end if;
  if p_phone !~ '^\+91[6-9][0-9]{9}$' then
    return json_build_object('ok', false, 'error', 'invalid_phone');
  end if;

  -- Errors are machine codes, not prose. `create_booking` returns sentences
  -- because its caller renders them straight into the page; this one's caller
  -- is a state machine that has its own wording in `bot/copy.ts`, and a
  -- sentence from the database would be a second, untranslatable voice in the
  -- conversation.
  v_reject := booking_slot_rejection(v_clinic.id, p_starts_at);
  if v_reject is not null then
    return json_build_object('ok', false, 'error',
      case when v_reject = 'slot_too_soon' then 'slot_past' else v_reject end);
  end if;

  -- Rate limit before the patient upsert, for the same reason as
  -- `create_booking`: a refused request must not leave a registry row behind.
  -- It matters more here — this endpoint is reachable by anyone who can send a
  -- WhatsApp message to the platform number.
  select count(*) into v_pending_count
  from appointments a
  join patients pt on pt.id = a.patient_id
  where pt.phone = p_phone
    and a.clinic_id = v_clinic.id
    and a.status = 'pending'
    and a.created_at > now() - interval '24 hours';
  if v_pending_count >= 3 then
    return json_build_object('ok', false, 'error', 'too_many_pending');
  end if;

  v_slot_min := coalesce((v_clinic.settings->>'slot_minutes')::int, 15);
  v_day      := (p_starts_at at time zone 'Asia/Kolkata')::date;

  -- Approve-mode clinics get a request their doctor accepts, exactly as the web
  -- widget produces. Token numbers are queue positions for a day that is
  -- actually happening, so a pending request does not get one yet.
  v_status := case
                when coalesce(v_clinic.settings->>'booking_mode', 'instant') = 'approve'
                then 'pending' else 'confirmed'
              end::appointment_status;

  select id into v_patient_id
  from patients
  where clinic_id = v_clinic.id and phone = p_phone and deleted_at is null
  limit 1;

  if v_patient_id is null then
    -- Consent is implied and specific: this person opened a WhatsApp thread
    -- with the clinic in order to book. That is consent to be contacted on
    -- WhatsApp about it, and `STOP` revokes it at any point.
    insert into patients (clinic_id, full_name, phone, whatsapp_opt_in, consent_at)
    values (v_clinic.id, trim(p_name), p_phone, true, now())
    returning id into v_patient_id;
  end if;

  if v_status = 'confirmed' then
    v_token := next_token_number(v_clinic.id, v_day);
  end if;

  begin
    insert into appointments
      (clinic_id, patient_id, starts_at, ends_at, status, source, reason, token_number)
    values
      (v_clinic.id, v_patient_id, p_starts_at,
       p_starts_at + make_interval(mins => v_slot_min),
       v_status, 'whatsapp', nullif(trim(coalesce(p_reason, '')), ''), v_token)
    returning id into v_appt_id;
  exception when unique_violation then
    return json_build_object('ok', false, 'error', 'slot_taken');
  end;

  return json_build_object(
    'ok', true,
    'appointment_id', v_appt_id,
    'patient_id', v_patient_id,
    'token_number', v_token,
    'starts_at', p_starts_at,
    'pending', v_status = 'pending'
  );
end;
$$;

-- The webhook is the only caller. Nothing reachable from a browser may book
-- without proving the phone number, which is the entire premise above.
revoke execute on function public.create_whatsapp_booking(uuid, text, text, timestamptz, text)
  from public, anon, authenticated;
grant execute on function public.create_whatsapp_booking(uuid, text, text, timestamptz, text)
  to service_role;
