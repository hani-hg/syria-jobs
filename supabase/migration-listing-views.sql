-- Per-listing visit counter for public job and job-seeker listings.
-- Run once in Supabase Dashboard -> SQL Editor before relying on the counter UI.

alter table public.job_submissions
  add column if not exists view_count bigint not null default 0;

alter table public.job_submissions
  drop constraint if exists job_submissions_view_count_check;

alter table public.job_submissions
  add constraint job_submissions_view_count_check check (view_count >= 0);

create or replace function public.increment_listing_view(p_listing_id uuid)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  updated_count bigint;
begin
  update public.job_submissions
  set view_count = view_count + 1
  where id = p_listing_id
    and status = 'approved'
    and deadline >= current_date
  returning view_count into updated_count;

  return coalesce(updated_count, 0);
end;
$function$;

revoke all on function public.increment_listing_view(uuid) from public;
revoke all on function public.increment_listing_view(uuid) from anon, authenticated;
grant execute on function public.increment_listing_view(uuid) to anon, authenticated;
