-- ════════════════════════════════════════════════════════════════
-- 0024_pharmacy.sql — in-clinic pharmacy: stock, batches, movements
--
--   inventory_items  — what the clinic stocks (optionally linked to a
--                      `medicines` row so prescribing and stock share a name)
--   stock_batches    — physical batches, each with its own expiry and MRP.
--                      Expiry lives on the BATCH, never on the item — that is
--                      the whole point of batch tracking.
--   stock_movements  — the append-only ledger. Every change in quantity is a
--                      row; `stock_batches.qty_available` is the running
--                      balance, and the ledger is what explains it.
--
-- ── The rule enforced in the database ────────────────────────────────
-- Stock cannot leave without a bill line. A `dispense` movement must carry an
-- `invoice_item_id`, enforced by a CHECK constraint rather than by application
-- code — a bypass would be silent shrinkage, and the whole reason a clinic
-- keeps stock records is to notice that.
-- ════════════════════════════════════════════════════════════════

create table if not exists inventory_items (
  id            uuid primary key default gen_random_uuid(),
  clinic_id     uuid not null references clinics(id) on delete cascade,
  -- Optional: links the stock row to the prescribing catalogue so the same
  -- drug is not spelled two ways. ON DELETE SET NULL — losing the catalogue
  -- row must not lose the stock.
  medicine_id   uuid references medicines(id) on delete set null,
  name          text not null,
  form          text,
  strength      text,
  unit          text not null default 'unit',   -- strip, tablet, bottle, vial
  hsn_code      text,
  gst_rate      numeric(5,2) not null default 0,
  reorder_level int not null default 0,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);

create unique index if not exists inventory_items_uniq on inventory_items
  (clinic_id, lower(name), lower(coalesce(form,'')), lower(coalesce(strength,'')));
create index if not exists inventory_items_clinic_idx on inventory_items (clinic_id) where is_active;
create index if not exists inventory_items_name_trgm on inventory_items using gin (name gin_trgm_ops);

create table if not exists stock_batches (
  id            uuid primary key default gen_random_uuid(),
  clinic_id     uuid not null references clinics(id) on delete cascade,
  item_id       uuid not null references inventory_items(id) on delete cascade,
  batch_no      text not null,
  expiry_date   date,                       -- NULL for things that do not expire
  qty_received  integer not null check (qty_received > 0),
  qty_available integer not null check (qty_available >= 0),
  cost_price    numeric(10,2),
  mrp           numeric(10,2),
  received_at   timestamptz not null default now(),
  -- Belt and braces: a batch can never show more on hand than ever arrived.
  check (qty_available <= qty_received)
);

-- Same batch number with a different expiry is a different physical batch.
create unique index if not exists stock_batches_uniq on stock_batches
  (item_id, lower(batch_no), coalesce(expiry_date, '9999-12-31'::date));
-- The FEFO index: earliest expiry first, and only batches with stock left.
create index if not exists stock_batches_fefo_idx
  on stock_batches (item_id, expiry_date nulls last) where qty_available > 0;
create index if not exists stock_batches_expiry_idx
  on stock_batches (clinic_id, expiry_date) where qty_available > 0;

create table if not exists stock_movements (
  id              uuid primary key default gen_random_uuid(),
  clinic_id       uuid not null references clinics(id) on delete cascade,
  item_id         uuid not null references inventory_items(id) on delete cascade,
  batch_id        uuid references stock_batches(id) on delete set null,
  kind            text not null
                    check (kind in ('receipt','dispense','adjustment','return','expiry_writeoff')),
  -- Signed: positive adds to stock, negative removes. The sign is the truth;
  -- `kind` is why.
  qty             integer not null check (qty <> 0),
  invoice_id      uuid references invoices(id) on delete set null,
  invoice_item_id uuid references invoice_items(id) on delete set null,
  note            text,
  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),

  -- Stock cannot leave without a bill line.
  constraint stock_dispense_needs_bill_line
    check (kind <> 'dispense' or invoice_item_id is not null),
  -- Directions that must agree with the kind, so the ledger can be trusted.
  constraint stock_receipt_is_inward  check (kind <> 'receipt'  or qty > 0),
  constraint stock_dispense_is_outward check (kind <> 'dispense' or qty < 0),
  constraint stock_writeoff_is_outward check (kind <> 'expiry_writeoff' or qty < 0)
);

create index if not exists stock_movements_clinic_idx on stock_movements (clinic_id, created_at desc);
create index if not exists stock_movements_item_idx on stock_movements (item_id, created_at desc);
create index if not exists stock_movements_invoice_idx on stock_movements (invoice_id) where invoice_id is not null;

alter table inventory_items enable row level security;
alter table stock_batches   enable row level security;
alter table stock_movements enable row level security;

drop policy if exists tenant_all on inventory_items;
create policy tenant_all on inventory_items for all
  using (clinic_id in (select auth_clinic_ids()))
  with check (clinic_id in (select auth_clinic_ids()));

drop policy if exists tenant_all on stock_batches;
create policy tenant_all on stock_batches for all
  using (clinic_id in (select auth_clinic_ids()))
  with check (clinic_id in (select auth_clinic_ids()));

drop policy if exists tenant_all on stock_movements;
create policy tenant_all on stock_movements for all
  using (clinic_id in (select auth_clinic_ids()))
  with check (clinic_id in (select auth_clinic_ids()));

-- ─── Dispense atomically ────────────────────────────────────────
-- FEFO allocation happens in app code, where it is unit-tested
-- (src/lib/pharmacy/stock.ts). The *commit* happens here, in one function, so
-- the whole multi-batch dispense is a single transaction: if the last batch
-- turns out to be short, every earlier decrement rolls back too, rather than
-- leaving stock half-issued against a bill line.
--
-- Each batch row is locked FOR UPDATE, so two people billing the same strip at
-- once queue up instead of both reading the same "available" and overselling.
-- SECURITY DEFINER with an explicit membership check, matching 0004's hardening.
create or replace function dispense_stock(
  p_allocations     jsonb,   -- [{"batch_id": "...", "qty": 3}, …]
  p_invoice_item_id uuid,
  p_invoice_id      uuid
)
returns integer               -- total units dispensed
language plpgsql
security definer
set search_path = public
as $$
declare
  v_alloc    jsonb;
  v_batch_id uuid;
  v_qty      integer;
  v_clinic   uuid;
  v_item     uuid;
  v_left     integer;
  v_total    integer := 0;
begin
  if p_invoice_item_id is null then
    -- Mirrors the CHECK constraint, but fails with a sentence a human wrote.
    raise exception 'stock cannot leave without a bill line';
  end if;

  for v_alloc in select * from jsonb_array_elements(p_allocations)
  loop
    v_batch_id := (v_alloc ->> 'batch_id')::uuid;
    v_qty      := (v_alloc ->> 'qty')::integer;

    if v_qty is null or v_qty <= 0 then
      raise exception 'dispense qty must be positive';
    end if;

    select clinic_id, item_id, qty_available
      into v_clinic, v_item, v_left
      from stock_batches
     where id = v_batch_id
       for update;

    if v_clinic is null then
      raise exception 'batch not found';
    end if;
    if v_clinic not in (select auth_clinic_ids()) then
      raise exception 'not your clinic';
    end if;
    if v_left < v_qty then
      raise exception 'only % left in that batch', v_left;
    end if;

    update stock_batches
       set qty_available = qty_available - v_qty
     where id = v_batch_id;

    insert into stock_movements
      (clinic_id, item_id, batch_id, kind, qty, invoice_id, invoice_item_id, created_by)
    values
      (v_clinic, v_item, v_batch_id, 'dispense', -v_qty, p_invoice_id, p_invoice_item_id, auth.uid());

    v_total := v_total + v_qty;
  end loop;

  return v_total;
end;
$$;

revoke all on function dispense_stock(jsonb, uuid, uuid) from public;
grant execute on function dispense_stock(jsonb, uuid, uuid) to authenticated;
