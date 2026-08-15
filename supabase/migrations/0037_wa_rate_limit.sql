-- ════════════════════════════════════════════════════════════════
-- 0037_wa_rate_limit.sql
--
-- Per-phone rate limiting for the WhatsApp bot.
--
-- The webhook is HMAC-verified, so only Meta can call it — but Meta will
-- faithfully deliver whatever a *patient* sends, and there is nothing stopping
-- one from holding down send. Each inbound message costs several queries, an
-- RPC and an outbound Cloud API call that Meta bills for, so an unthrottled
-- bot is a way to run up someone else's WhatsApp invoice.
--
-- ── Why the counter lives on wa_sessions ────────────────────────────────────
-- A separate table would need its own purge, its own RLS, and its own index. A
-- session row is already keyed by phone, already swept by the cron, and already
-- service-role only. Crucially `clinic_id` is nullable, so a phone we cannot
-- attribute to any clinic — which is exactly the traffic most worth throttling,
-- since it never even reaches the state machine — still gets a counter.
-- ════════════════════════════════════════════════════════════════

alter table wa_sessions
  add column if not exists rate_window_start timestamptz not null default now(),
  add column if not exists rate_count        int         not null default 0;

-- ── Count this message and say whether to act on it ─────────────────────────
--
-- One statement, so it is race-safe: two concurrent webhook invocations for the
-- same phone cannot both read 9 and both write 10. `on conflict do update` sees
-- the pre-update row, which is what makes the window roll correctly.
--
-- Returns true when the message is within the limit. The caller drops the
-- message silently when it is not: replying "you are sending too fast" is
-- itself an outbound message, which would bill for exactly the traffic this is
-- meant to suppress and hand a flooder an amplifier.
create or replace function public.wa_rate_allow(
  p_phone text,
  p_window_seconds int,
  p_limit int
)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_count int;
begin
  insert into wa_sessions (phone, expires_at, rate_window_start, rate_count)
  values (p_phone, now() + interval '30 minutes', now(), 1)
  on conflict (phone) do update
    set rate_window_start =
          case when wa_sessions.rate_window_start < now() - make_interval(secs => p_window_seconds)
               then now() else wa_sessions.rate_window_start end,
        rate_count =
          case when wa_sessions.rate_window_start < now() - make_interval(secs => p_window_seconds)
               then 1 else wa_sessions.rate_count + 1 end,
        -- Touching the row keeps it alive; a flooder's row is swept like any
        -- other once they stop.
        expires_at = greatest(wa_sessions.expires_at, now() + interval '30 minutes')
  returning rate_count into v_count;

  return v_count <= p_limit;
end;
$$;

revoke execute on function public.wa_rate_allow(text, int, int) from public, anon, authenticated;
grant execute on function public.wa_rate_allow(text, int, int) to service_role;
