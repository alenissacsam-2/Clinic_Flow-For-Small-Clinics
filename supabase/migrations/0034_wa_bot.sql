-- ════════════════════════════════════════════════════════════════
-- 0034_wa_bot.sql
--
-- Phase 2 of the WhatsApp booking bot: somewhere to keep a conversation, and
-- a guarantee that Meta cannot make us book the same appointment twice.
--
-- The reducer in `src/lib/whatsapp/bot/machine.ts` is a pure function — it is
-- handed a session and returns the next one. This is where that session lives
-- between messages.
-- ════════════════════════════════════════════════════════════════

-- ── Conversation state ──────────────────────────────────────────────────────
--
-- `phone` is the primary key, not a surrogate id with a phone column. One
-- WhatsApp number is one human holding one phone, and the platform's Meta
-- number is shared across every clinic on it, so a patient can only ever be
-- mid-booking with one clinic at a time. Making that a database constraint
-- rather than a convention means a second concurrent conversation cannot exist
-- to be reasoned about — the `on conflict (phone) do update` in the store is
-- the only write path.
--
-- `context` holds the reducer's draft booking (dateKey, startUtc, name,
-- slotPage). It is deliberately schemaless: the draft's shape belongs to the
-- state machine, and pinning it into columns here would mean a migration every
-- time the conversation gains a step.
create table if not exists wa_sessions (
  phone      text primary key,                                  -- E.164
  clinic_id  uuid references clinics(id) on delete cascade,
  state      text not null default 'idle',
  context    jsonb not null default '{}'::jsonb,
  expires_at timestamptz not null,
  updated_at timestamptz not null default now()
);

-- The cron sweeps expired rows; see `/api/cron/reminders`.
create index if not exists wa_sessions_expires_idx on wa_sessions (expires_at);

-- No policies, by design — same posture as `booking_otps`. RLS on with zero
-- policies denies every role that goes through PostgREST and leaves only the
-- service role, which is the sole writer. A half-finished booking conversation
-- is patient data (a name and a phone number attached to a clinic), and nothing
-- in the browser has any reason to read it.
alter table wa_sessions enable row level security;

-- Belt-and-braces against the default PUBLIC grant: RLS is the real control,
-- but there is no reason for the anon or authenticated roles to hold table
-- privileges they can never successfully exercise.
revoke all on table wa_sessions from anon, authenticated;

-- ── Inbound idempotency ─────────────────────────────────────────────────────
--
-- Meta redelivers a webhook whenever it does not get a prompt 2xx — on a
-- timeout, on a 5xx, on a cold start that runs long. Today that only produced
-- a duplicate row in the message log, which is untidy but harmless. Once the
-- bot acts on inbound messages it stops being harmless: a redelivered "yes,
-- book it" is a second appointment, in a second slot, for a patient who tapped
-- once.
--
-- `wa_messages.wa_message_id` already exists and already carries Meta's id.
-- The existing `wa_messages_waid_idx` is non-unique because outbound rows are
-- looked up by it for status updates. This adds the constraint on the inbound
-- half only, so the webhook can insert-first and treat a unique violation as
-- "already handled, do nothing" — which is race-safe in a way that
-- check-then-insert is not, with two webhook deliveries landing on two
-- concurrent serverless invocations.
create unique index if not exists wa_messages_inbound_uniq
  on wa_messages (wa_message_id)
  where direction = 'in' and wa_message_id is not null;
