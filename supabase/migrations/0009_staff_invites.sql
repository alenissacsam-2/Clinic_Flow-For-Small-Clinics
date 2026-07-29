-- Phase 1 (v2): staff invites & doctor-only role enforcement.

-- Invite a staff member (receptionist) to a clinic by email.
create table if not exists clinic_invites (
  id          uuid primary key default gen_random_uuid(),
  clinic_id   uuid not null references clinics(id) on delete cascade,
  email       text not null,                 -- stored lowercased
  role        member_role not null default 'staff',
  token       uuid not null default gen_random_uuid(),
  invited_by  uuid references auth.users(id) on delete set null,
  expires_at  timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz,
  created_at  timestamptz not null default now()
);
-- One live invite per (clinic, email).
create unique index if not exists clinic_invites_pending_uniq
  on clinic_invites (clinic_id, lower(email)) where accepted_at is null;

-- Is the current user a DOCTOR of the given clinic? (SECURITY DEFINER, mirrors auth_clinic_ids.)
create or replace function is_clinic_doctor(p_clinic uuid)
  returns boolean
  language sql stable security definer set search_path = public as $$
    select exists (
      select 1 from clinic_members
      where clinic_id = p_clinic and user_id = auth.uid() and role = 'doctor'
    );
$$;

alter table clinic_invites enable row level security;
drop policy if exists invites_doctor_all on clinic_invites;
create policy invites_doctor_all on clinic_invites for all
  using (is_clinic_doctor(clinic_id))
  with check (is_clinic_doctor(clinic_id));

-- Tighten clinic settings update to doctors only (staff have data access but not settings).
drop policy if exists clinics_member_update on clinics;
create policy clinics_member_update on clinics for update
  using (is_clinic_doctor(id))
  with check (is_clinic_doctor(id));

-- Only a doctor may remove members; anyone may remove themselves.
drop policy if exists members_delete on clinic_members;
create policy members_delete on clinic_members for delete
  using (is_clinic_doctor(clinic_id) or user_id = auth.uid());

-- Claim any pending invites matching the caller's verified email. Idempotent.
create or replace function accept_pending_invites()
  returns json
  language plpgsql security definer set search_path = public as $$
declare
  v_email text := lower(coalesce(auth.jwt()->>'email', ''));
  v_count int := 0;
  r record;
begin
  if auth.uid() is null or v_email = '' then
    return json_build_object('accepted', 0);
  end if;

  for r in
    select * from clinic_invites
    where lower(email) = v_email and accepted_at is null and expires_at > now()
  loop
    insert into clinic_members (clinic_id, user_id, role)
    values (r.clinic_id, auth.uid(), r.role)
    on conflict (clinic_id, user_id) do nothing;
    update clinic_invites set accepted_at = now() where id = r.id;
    v_count := v_count + 1;
  end loop;

  return json_build_object('accepted', v_count);
end;
$$;

revoke execute on function accept_pending_invites() from public, anon;
grant execute on function accept_pending_invites() to authenticated;

-- List a clinic's members with their email (resolves auth.users). Doctor-only.
create or replace function list_clinic_members(p_clinic uuid)
  returns table (user_id uuid, email text, role member_role, is_self boolean)
  language plpgsql stable security definer set search_path = public as $$
begin
  if not is_clinic_doctor(p_clinic) then
    raise exception 'not authorized';
  end if;
  return query
    select cm.user_id, u.email::text, cm.role, (cm.user_id = auth.uid())
    from clinic_members cm
    join auth.users u on u.id = cm.user_id
    where cm.clinic_id = p_clinic
    order by cm.role, u.email;
end;
$$;
revoke execute on function list_clinic_members(uuid) from public, anon;
grant execute on function list_clinic_members(uuid) to authenticated;
