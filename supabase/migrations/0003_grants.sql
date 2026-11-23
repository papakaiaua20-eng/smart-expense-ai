-- Newer Supabase projects no longer grant table access to the API roles automatically.
-- Without these grants every read/write from the app fails with "permission denied"
-- (RLS policies still decide WHICH rows each signed-in user can touch).
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;
-- anon (not signed in) gets nothing: every table is per-user.
revoke all on all tables in schema public from anon;
