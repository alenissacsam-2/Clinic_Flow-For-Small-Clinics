-- Pin search_path on helper functions (advisor 0011)
alter function next_token_number(uuid, date) set search_path = public;
alter function next_invoice_no(uuid) set search_path = public;

-- auth_clinic_ids is only needed inside RLS (evaluated as 'authenticated').
-- anon never needs it (booking page uses service role), so revoke it (advisor 0028).
revoke execute on function auth_clinic_ids() from anon;
revoke execute on function auth_clinic_ids() from public;
