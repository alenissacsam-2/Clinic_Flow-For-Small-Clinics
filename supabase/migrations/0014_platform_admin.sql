-- v4 Phase 1: platform operator console (super-admin over ALL clinics).
-- Cross-tenant reads bypass per-clinic RLS, so they run through SECURITY DEFINER
-- RPCs that each gate on is_platform_admin() first — mirroring is_clinic_doctor().
-- No service-role key needed; the normal authenticated client calls these.

create table if not exists platform_admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table platform_admins enable row level security;  -- no policies: definer/service only

-- Operators can pause a clinic (blocks its booking page + app access).
alter table clinics add column if not exists suspended_at timestamptz;

-- Is the current user a platform operator? (SECURITY DEFINER, mirrors is_clinic_doctor.)
create or replace function is_platform_admin()
  returns boolean
  language sql stable security definer set search_path = public as $$
    select exists (select 1 from platform_admins where user_id = auth.uid());
$$;
revoke execute on function is_platform_admin() from anon;
grant execute on function is_platform_admin() to authenticated;

-- ── Platform-wide aggregates for the operator overview ──────────────────────
create or replace function admin_platform_stats()
  returns json language plpgsql stable security definer set search_path = public as $$
declare v json;
begin
  if not is_platform_admin() then raise exception 'not authorized'; end if;

  select json_build_object(
    'clinics',        (select count(*) from clinics),
    'suspended',      (select count(*) from clinics where suspended_at is not null),
    'doctors',        (select count(*) from clinic_members where role = 'doctor'),
    'staff',          (select count(*) from clinic_members where role = 'staff'),
    'patients',       (select count(*) from patients where deleted_at is null),
    'appts_total',    (select count(*) from appointments),
    'appts_7d',       (select count(*) from appointments where created_at > now() - interval '7 days'),
    'revenue_total',  (select coalesce(sum(amount),0) from payments),
    'revenue_today',  (select coalesce(sum(amount),0) from payments
                        where (paid_at at time zone 'Asia/Kolkata')::date
                            = (now()    at time zone 'Asia/Kolkata')::date),
    'revenue_7d',     (select coalesce(sum(amount),0) from payments where paid_at > now() - interval '7 days'),
    'revenue_30d',    (select coalesce(sum(amount),0) from payments where paid_at > now() - interval '30 days'),
    'wa_failed',      (select count(*) from wa_messages where status = 'failed'),
    'wa_by_status',   (select coalesce(json_object_agg(status, c), '{}'::json)
                        from (select status::text, count(*) c from wa_messages group by status) s),
    'signups', (
      select coalesce(json_agg(json_build_object('date', g.d::date, 'count', coalesce(c.cnt,0)) order by g.d), '[]'::json)
      from generate_series(
            ((now() at time zone 'Asia/Kolkata')::date - 29),
            ((now() at time zone 'Asia/Kolkata')::date),
            interval '1 day') as g(d)
      left join (
        select (created_at at time zone 'Asia/Kolkata')::date as dd, count(*) as cnt
        from clinics group by 1
      ) c on c.dd = g.d::date
    )
  ) into v;
  return v;
end; $$;

-- ── All clinics with usage, for the operator's clinic list ──────────────────
create or replace function admin_list_clinics()
  returns table (
    id uuid, name text, slug text, doctor_name text, created_at timestamptz,
    suspended_at timestamptz, booking_mode text,
    patient_count bigint, appt_count bigint, revenue numeric
  )
  language plpgsql stable security definer set search_path = public as $$
begin
  if not is_platform_admin() then raise exception 'not authorized'; end if;
  return query
    select c.id, c.name, c.slug, c.doctor_name, c.created_at, c.suspended_at,
      coalesce(c.settings->>'booking_mode','approve') as booking_mode,
      (select count(*) from patients p where p.clinic_id = c.id and p.deleted_at is null),
      (select count(*) from appointments a where a.clinic_id = c.id),
      (select coalesce(sum(pay.amount),0) from payments pay where pay.clinic_id = c.id)
    from clinics c
    order by c.created_at desc;
end; $$;

-- ── One clinic's full detail (profile, members, usage) ──────────────────────
create or replace function admin_clinic_detail(p_clinic uuid)
  returns json language plpgsql stable security definer set search_path = public as $$
declare v json;
begin
  if not is_platform_admin() then raise exception 'not authorized'; end if;
  select json_build_object(
    'clinic', to_jsonb(c.*),
    'members', coalesce((
      select json_agg(json_build_object('email', u.email, 'role', cm.role) order by cm.role)
      from clinic_members cm join auth.users u on u.id = cm.user_id
      where cm.clinic_id = c.id
    ), '[]'::json),
    'patient_count', (select count(*) from patients where clinic_id = c.id and deleted_at is null),
    'appt_count',    (select count(*) from appointments where clinic_id = c.id),
    'revenue',       (select coalesce(sum(amount),0) from payments where clinic_id = c.id),
    'last_appt',     (select max(starts_at) from appointments where clinic_id = c.id),
    'wa_failed',     (select count(*) from wa_messages where clinic_id = c.id and status = 'failed')
  ) into v
  from clinics c where c.id = p_clinic;
  return v;
end; $$;

-- ── Suspend / unsuspend a clinic ────────────────────────────────────────────
create or replace function admin_set_clinic_suspended(p_clinic uuid, p_suspend boolean)
  returns json language plpgsql security definer set search_path = public as $$
begin
  if not is_platform_admin() then raise exception 'not authorized'; end if;
  update clinics set suspended_at = case when p_suspend then now() else null end
  where id = p_clinic;
  return json_build_object('ok', true);
end; $$;

revoke execute on function admin_platform_stats()               from anon, public;
revoke execute on function admin_list_clinics()                 from anon, public;
revoke execute on function admin_clinic_detail(uuid)            from anon, public;
revoke execute on function admin_set_clinic_suspended(uuid, boolean) from anon, public;
grant  execute on function admin_platform_stats()               to authenticated;
grant  execute on function admin_list_clinics()                 to authenticated;
grant  execute on function admin_clinic_detail(uuid)            to authenticated;
grant  execute on function admin_set_clinic_suspended(uuid, boolean) to authenticated;

-- ── Suspended clinics can't take public bookings ────────────────────────────
-- Re-create get_booking_context (from 0010) with a suspended-clinic short-circuit.
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
