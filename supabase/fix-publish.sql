grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on table public.job_submissions to anon, authenticated;

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
  using (true);

drop policy if exists "admins can update jobs" on public.job_submissions;
create policy "admins can update jobs"
  on public.job_submissions for update
  to anon, authenticated
  using (true)
  with check (true);

drop policy if exists "admins can delete jobs" on public.job_submissions;
create policy "admins can delete jobs"
  on public.job_submissions for delete
  to anon, authenticated
  using (true);
