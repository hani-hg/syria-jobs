-- نفّذ هذا الملف مرة واحدة من Supabase: SQL Editor ثم Run
grant usage on schema public to anon, authenticated;
grant select, insert on table public.job_submissions to anon, authenticated;

alter table public.job_submissions add column if not exists contact text;
alter table public.job_submissions add column if not exists field text;
alter table public.job_submissions add column if not exists deadline date;
alter table public.job_submissions add column if not exists type text;
alter table public.job_submissions add column if not exists source text;
alter table public.job_submissions add column if not exists status text;

drop policy if exists "public can submit pending jobs" on public.job_submissions;
create policy "public can submit pending jobs"
  on public.job_submissions for insert
  to anon, authenticated
  with check (status = 'pending');

drop policy if exists "public can read approved jobs" on public.job_submissions;
create policy "public can read approved jobs"
  on public.job_submissions for select
  to anon, authenticated
  using (status = 'approved' or public.is_admin());
