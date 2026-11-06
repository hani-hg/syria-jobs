-- Public listing access and explicit contact visibility.
-- Run after migration-listing-types.sql. Existing contact details stay private by default.

alter table public.job_submissions
  add column if not exists contact_public boolean not null default false;
alter table public.job_submissions
  add column if not exists view_count bigint not null default 0;

-- Public users may submit pending rows, but cannot read or mutate table rows directly.
alter table public.job_submissions enable row level security;
revoke all on table public.job_submissions from public, anon;
grant insert on table public.job_submissions to anon;
grant select, insert, update, delete on table public.job_submissions to authenticated;

-- Enforce pending-only public submissions and admin-only direct table access.
drop policy if exists "public can submit pending jobs" on public.job_submissions;
create policy "public can submit pending jobs"
  on public.job_submissions for insert to anon, authenticated
  with check (status = 'pending');
drop policy if exists "admins can insert jobs" on public.job_submissions;
create policy "admins can insert jobs"
  on public.job_submissions for insert to authenticated
  with check (public.is_admin());
drop policy if exists "admins can update jobs" on public.job_submissions;
create policy "admins can update jobs"
  on public.job_submissions for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists "admins can delete jobs" on public.job_submissions;
create policy "admins can delete jobs"
  on public.job_submissions for delete to authenticated
  using (public.is_admin());
drop policy if exists "public can read approved jobs" on public.job_submissions;
drop policy if exists "admins can read all jobs" on public.job_submissions;
create policy "admins can read all jobs"
  on public.job_submissions for select to authenticated
  using (public.is_admin());

-- Only this fixed public RPC can list jobs; contact is included only with explicit consent.
create or replace function public.list_public_jobs()
returns table (
  id uuid,
  listing_type text,
  title text,
  company text,
  governorate text,
  field text,
  "type" text,
  deadline date,
  source text,
  description text,
  contact text,
  experience text,
  work_arrangement text,
  view_count bigint,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $function$
  select
    job.id,
    job.listing_type,
    job.title,
    job.company,
    job.governorate,
    job.field,
    job.type,
    job.deadline,
    job.source,
    job.description,
    case when job.contact_public then job.contact else null::text end as contact,
    job.experience,
    job.work_arrangement,
    job.view_count,
    job.created_at
  from public.job_submissions as job
  where job.status = 'approved'
    and job.deadline >= current_date
  order by job.created_at desc;
$function$;
revoke all on function public.list_public_jobs() from public, anon, authenticated;
grant execute on function public.list_public_jobs() to anon, authenticated;
