-- create_clinic is only for onboarding (authenticated users). Remove the
-- implicit PUBLIC/anon execute grant; it already refuses when auth.uid() is null,
-- this is defense in depth.
revoke execute on function create_clinic(text,text,text,text,text,text,text,text,text,jsonb,jsonb) from public;
revoke execute on function create_clinic(text,text,text,text,text,text,text,text,text,jsonb,jsonb) from anon;
grant execute on function create_clinic(text,text,text,text,text,text,text,text,text,jsonb,jsonb) to authenticated;
