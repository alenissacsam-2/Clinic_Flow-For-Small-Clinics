-- Pin the search_path on guard_clinic_suspension.
--
-- 0030 added this trigger to stop a clinic lifting its own suspension, but it
-- was written without `set search_path`, and it was the *only* function in the
-- public schema (extensions aside) missing one — a gap the Supabase linter
-- flagged as `function_search_path_mutable`.
--
-- Without a pinned path, `public.is_platform_admin()` is the only reference the
-- body resolves unambiguously; everything else, including the operators in the
-- `current_user in (...)` test, resolves through whatever search_path the
-- calling session happens to have set. The exploit needs CREATE on a schema
-- that sorts ahead of `public`, which `authenticated` does not have on Supabase,
-- so this was not reachable in practice — but a trigger whose entire job is to
-- guard a security control is the last place to rely on "not reachable in
-- practice". Every other function here already pins it; this one now matches.
--
-- `pg_temp` is listed last deliberately: it is where a session can create
-- objects freely, so leaving it off the front is what stops a temp table or
-- function shadowing a real one.
create or replace function public.guard_clinic_suspension()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.suspended_at is distinct from old.suspended_at then
    if current_user in ('postgres', 'service_role', 'supabase_admin') then
      return new;
    end if;
    if public.is_platform_admin() then
      return new;
    end if;
    raise exception 'suspended_at is managed by the platform operator'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;
