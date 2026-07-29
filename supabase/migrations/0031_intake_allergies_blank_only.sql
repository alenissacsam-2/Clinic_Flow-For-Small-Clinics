-- ════════════════════════════════════════════════════════════════
-- 0031_intake_allergies_blank_only.sql
--
-- Stop the pre-visit intake form from overwriting a doctor-recorded allergy.
--
-- 0012 merges intake answers onto the patient record "blank fields only" — its
-- own comment says so — and then makes exactly one exception:
--
--     allergies = case when v_allergies is not null then v_allergies else allergies end
--
-- Every other field uses `coalesce(existing, incoming)` and so can only ever
-- fill a gap. Allergies alone replace whatever is already there.
--
-- ── Why that particular column matters ───────────────────────────────────────
-- `patients.allergies` is not a note. It is the input to the drug-safety
-- screen: `checkPrescriptionSafety` in src/actions/clinical.ts reads that column
-- and matches it against the ingredients of every medicine being prescribed.
--
-- `submit_intake` is granted to `anon` and authorised by a link sent over
-- WhatsApp. So the sequence is:
--
--   1. the doctor records "Penicillin — anaphylaxis" during a consultation
--   2. before the next visit the patient opens the intake link and, reading
--      "Any allergies?", types "none" — or "no", or "-"
--   3. that string replaces the doctor's entry
--   4. at the next visit Amoxicillin is prescribed and the safety panel says
--      nothing, because there is no longer an allergy to match
--
-- Step 2 is not misuse. It is the single most likely thing a patient types into
-- that box, and the form gives them no way to know they are editing a clinical
-- record rather than answering a question.
--
-- ── Why blank-only loses nothing ─────────────────────────────────────────────
-- The patient's answer is still written to `intake_requests.payload`, and the
-- visit editor already renders it: `IntakePanel` shows an "Allergies" row from
-- the payload whenever one was given. The doctor sees what the patient said,
-- next to what the record says, and decides. That is the correct place for a
-- conflict between the two to be resolved — by the clinician, not by a silent
-- last-write-wins in an anonymous RPC.
--
-- So allergies now behave like age, dob and gender: fill a blank, never
-- overwrite. The only behaviour change is for a patient who already has an
-- allergy on file, which is precisely the case that was unsafe.
-- ════════════════════════════════════════════════════════════════

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

  v_age := case when (p_payload->>'age_years') ~ '^\d{1,3}$' then (p_payload->>'age_years')::int else null end;
  v_dob := case when (p_payload->>'dob') ~ '^\d{4}-\d{2}-\d{2}$' then (p_payload->>'dob')::date else null end;
  v_gender := case when (p_payload->>'gender') in ('male','female','other') then p_payload->>'gender' else null end;
  v_allergies := nullif(trim(coalesce(p_payload->>'allergies','')), '');

  -- Single-use guard: only transitions a pending row. The patient's own words
  -- are kept here in full, including any allergy they reported, so the doctor
  -- sees them even when the merge below declines to touch the record.
  update intake_requests
    set status = 'submitted', submitted_at = now(),
        payload = jsonb_build_object(
          'age_years', v_age, 'dob', v_dob, 'gender', v_gender,
          'allergies', v_allergies,
          'complaints', nullif(trim(coalesce(p_payload->>'complaints','')), ''),
          'medicines', nullif(trim(coalesce(p_payload->>'medicines','')), ''))
    where id = v_row.id and status = 'pending';
  if not found then return json_build_object('ok', false, 'error', 'already_submitted'); end if;

  -- Blank-only, allergies included. `coalesce(allergies, v_allergies)` keeps an
  -- existing clinical entry and fills an empty one; it can never replace.
  update patients set
    age_years = coalesce(age_years, v_age),
    dob       = coalesce(dob, v_dob),
    gender    = coalesce(gender, v_gender),
    allergies = coalesce(nullif(trim(coalesce(allergies, '')), ''), v_allergies)
  where id = v_row.patient_id;

  return json_build_object('ok', true);
end; $$;

grant execute on function public.submit_intake(text, jsonb) to anon, authenticated;
