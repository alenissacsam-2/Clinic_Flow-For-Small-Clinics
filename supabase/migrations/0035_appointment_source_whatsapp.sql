-- ════════════════════════════════════════════════════════════════
-- 0035_appointment_source_whatsapp.sql
--
-- A booking made in a WhatsApp conversation is not the same event as one made
-- on the booking page, and the doctor has a real reason to tell them apart:
-- "how many patients booked themselves over WhatsApp this month" is the
-- question this product's whole pitch rests on.
--
-- This is its own migration on purpose. `ALTER TYPE ... ADD VALUE` may not be
-- *used* in the same transaction that adds it, so the RPC that inserts
-- `'whatsapp'` rows has to land separately — see 0036.
--
-- Nothing switches exhaustively on this enum today (the only reader is a
-- `source === 'walk_in'` check in `queue-list.tsx`), so adding a value is
-- additive for every existing query and view.
-- ════════════════════════════════════════════════════════════════

alter type appointment_source add value if not exists 'whatsapp';
