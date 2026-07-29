-- ════════════════════════════════════════════════════════════════
-- 0026_display_queue.sql — waiting-room display board
--
-- Powers the public screen at /display/<slug>. SECURITY DEFINER, following the
-- same pattern as 0007's booking RPCs: anon never touches a table directly and
-- no service-role key is needed.
--
-- ── What this deliberately does NOT return ───────────────────────────
-- No patient names, no phone numbers, no reasons for visit, no ids. A display
-- board hangs in a room full of strangers; a token number is all it needs to
-- do its job, and anything more would be a disclosure the patient never
-- agreed to. The queue is today's only.
-- ════════════════════════════════════════════════════════════════

create or replace function get_display_queue(p_slug text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clinic clinics%rowtype;
  v_today  date := (now() at time zone 'Asia/Kolkata')::date;
begin
  select * into v_clinic from clinics where slug = p_slug;
  if not found then
    return json_build_object('found', false);
  end if;

  return json_build_object(
    'found', true,
    'clinic', json_build_object(
      'name', v_clinic.name,
      'doctor_name', v_clinic.doctor_name,
      'specialty', v_clinic.specialty,
      'logo_path', v_clinic.logo_path,
      -- The clinic's chosen language, so the board reads in the language its
      -- patients already get their WhatsApp messages in.
      'lang', coalesce(v_clinic.settings->>'template_lang', 'en')
    ),
    -- Whoever is in the room right now. At most one, but returned as a list
    -- so the board does not have to special-case an empty chair.
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
        -- Arrived patients are ahead of merely-confirmed ones: someone in the
        -- room before you should not appear behind you on the board.
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
    'as_of', to_char(now() at time zone 'Asia/Kolkata', 'HH24:MI')
  );
end;
$$;

revoke all on function get_display_queue(text) from public;
grant execute on function get_display_queue(text) to anon, authenticated;
