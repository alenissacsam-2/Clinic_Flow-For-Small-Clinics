-- ════════════════════════════════════════════════════════════════
-- 0028_least_privilege_grants.sql
--
-- Trim EXECUTE grants that were wider than the callers need.
--
-- Supabase exposes every function in `public` over PostgREST at
-- /rest/v1/rpc/<name>, and Postgres grants EXECUTE to PUBLIC by default. Three
-- functions were therefore reachable by the `anon` role even though only
-- signed-in code ever calls them:
--
--   dispense_stock     — mutates stock and writes a bill-backed movement
--   next_invoice_no    — burns a number from the clinic's invoice counter
--   next_token_number  — burns a queue token for a clinic/day
--
-- None of them were exploitable for data theft: `dispense_stock` re-checks
-- `auth_clinic_ids()` and raises 'not your clinic', and the two counters take a
-- clinic id and return only an integer. But the counters are UNAUTHENTICATED
-- SIDE EFFECTS — anyone who knows a clinic's uuid could advance its invoice
-- numbering or its token numbering all day, leaving gaps in a billing sequence
-- that is supposed to be contiguous for audit. That is worth closing on its
-- own, and the grant was never intentional in the first place.
--
-- SECURITY DEFINER callers are unaffected: `create_verified_booking` invokes
-- `next_token_number` while running as the function owner, not as the caller,
-- so it keeps its own EXECUTE regardless of what anon holds.
-- ════════════════════════════════════════════════════════════════

-- Stock movement is a signed-in, clinic-scoped operation.
revoke execute on function public.dispense_stock(jsonb, uuid, uuid) from public, anon;
grant  execute on function public.dispense_stock(jsonb, uuid, uuid) to authenticated;

-- Counters: called from server actions on the doctor's own session.
revoke execute on function public.next_invoice_no(uuid) from public, anon;
grant  execute on function public.next_invoice_no(uuid) to authenticated;

revoke execute on function public.next_token_number(uuid, date) from public, anon;
grant  execute on function public.next_token_number(uuid, date) to authenticated;

-- `is_platform_admin()` is granted to PUBLIC by default. It returns false for
-- anon rather than leaking anything, but an unauthenticated caller has no
-- reason to ask.
revoke execute on function public.is_platform_admin() from public, anon;
grant  execute on function public.is_platform_admin() to authenticated;
