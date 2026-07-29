-- Phase 6 (v2): UPI payments. The doctor sets their UPI VPA; invoices expose a
-- public pay page (QR + deep link). Personal UPI has no status API, so a payment
-- is only ever confirmed by the doctor ("Mark received"); the patient-entered UTR
-- is stored as an unverified claim.

alter table payments add column if not exists utr_reference text;
alter table invoices
  add column if not exists pay_token   text unique,
  add column if not exists claimed_utr text,
  add column if not exists claimed_at  timestamptz;

-- Public: minimal invoice view for the /pay/[token] page.
create or replace function public.get_invoice_public(p_token text)
 returns json language plpgsql security definer set search_path = public as $$
declare
  v_inv invoices%rowtype;
  v_clinic clinics%rowtype;
  v_paid numeric;
begin
  select * into v_inv from invoices where pay_token = p_token;
  if not found then return json_build_object('found', false); end if;
  select * into v_clinic from clinics where id = v_inv.clinic_id;
  select coalesce(sum(amount), 0) into v_paid from payments where invoice_id = v_inv.id;

  return json_build_object(
    'found', true,
    'invoice_no', v_inv.invoice_no,
    'status', v_inv.status,
    'amount_due', greatest(0, v_inv.total_amount - v_paid),
    'claimed', v_inv.claimed_utr is not null,
    'clinic', json_build_object(
      'name', v_clinic.name,
      'upi_vpa', v_clinic.settings->>'upi_vpa',
      'upi_name', coalesce(nullif(v_clinic.settings->>'upi_name',''), v_clinic.name)
    )
  );
end; $$;

-- Public: the patient reports the UTR they paid with (a claim, not a confirmation).
create or replace function public.submit_payment_reference(p_token text, p_utr text)
 returns json language plpgsql security definer set search_path = public as $$
declare v_inv invoices%rowtype;
begin
  select * into v_inv from invoices where pay_token = p_token;
  if not found then return json_build_object('ok', false, 'error', 'not_found'); end if;
  if v_inv.status in ('paid','void') then
    return json_build_object('ok', false, 'error', 'not_payable');
  end if;
  if p_utr !~ '^[A-Za-z0-9]{6,30}$' then
    return json_build_object('ok', false, 'error', 'invalid_utr');
  end if;

  update invoices set claimed_utr = p_utr, claimed_at = now() where id = v_inv.id;
  return json_build_object('ok', true);
end; $$;

grant execute on function public.get_invoice_public(text) to anon, authenticated;
grant execute on function public.submit_payment_reference(text, text) to anon, authenticated;
