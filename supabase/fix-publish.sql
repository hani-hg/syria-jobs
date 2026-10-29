alter table public.job_submissions disable row level security;
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on table public.job_submissions to anon, authenticated;
