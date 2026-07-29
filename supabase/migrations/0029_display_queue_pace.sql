-- ════════════════════════════════════════════════════════════════
-- 0029_display_queue_pace.sql — "roughly how long?" on the waiting-room board
--
-- The board already answers "whose turn is it". The question every person in
-- the room actually has is the next one — how long until mine — and the only
-- honest answer available is how fast this clinic is moving *today*.
--
-- Pace is measured as the average gap between consecutive consultation starts
-- (`visits.created_at`), not as consultation duration. Duration would be the
-- wrong number: the queue advances at the rate patients enter the room, which
-- includes the turnaround between them. A doctor who consults for 8 minutes
-- and takes 4 between patients moves the queue at 12.
--
-- Guards, because a wrong estimate on a wall is worse than none:
--   · gaps outside 2–60 minutes are dropped (lunch, a first patient hours
--     after opening, two visits saved back-to-back after a paper catch-up)
--   · fewer than two surviving gaps returns NULL, and the board then shows
--     nothing rather than extrapolating a morning from a single data point
--
-- The privacy guarantee of 0026 is unchanged: still tokens only, still no
-- names, phones, reasons or ids. A pace is an aggregate over the whole day
-- and identifies nobody.
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
  v_pace   int;
begin
  select * into v_clinic from clinics where slug = p_slug;
  if not found then
    return json_build_object('found', false);
  end if;

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
    -- NULL until the day has enough history to mean anything.
    'pace_minutes', v_pace,
    'as_of', to_char(now() at time zone 'Asia/Kolkata', 'HH24:MI')
  );
end;
$$;

revoke all on function get_display_queue(text) from public;
grant execute on function get_display_queue(text) to anon, authenticated;
