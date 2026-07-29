-- Phase 3 (v2): block off individual slots / sessions within a working day.
-- (Whole-day closures continue to use availability_overrides.)

create table if not exists slot_blocks (
  id         uuid primary key default gen_random_uuid(),
  clinic_id  uuid not null references clinics(id) on delete cascade,
  date       date not null,
  start_time time not null,
  end_time   time not null,
  reason     text,
  created_at timestamptz not null default now(),
  check (end_time > start_time)
);
create index if not exists slot_blocks_clinic_date_idx on slot_blocks (clinic_id, date);

alter table slot_blocks enable row level security;
drop policy if exists tenant_all on slot_blocks;
create policy tenant_all on slot_blocks for all
  using (clinic_id in (select auth_clinic_ids()))
  with check (clinic_id in (select auth_clinic_ids()));

-- Re-create the public booking context RPC with a `blocks` key so the booking
-- page can subtract blocked windows (same next-9-days horizon as overrides).
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
