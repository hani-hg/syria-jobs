-- Smart Apply contact channels. Run once before deploying the matching frontend.
-- Public responses expose email/WhatsApp only when contact_public = true.
begin;

alter table public.job_submissions
  add column if not exists contact_whatsapp text;
alter table public.job_submissions
  add column if not exists contact_email text;
alter table public.job_submissions
  add column if not exists contact_public boolean not null default false;

-- A posting can use WhatsApp/email instead of a source URL.
alter table public.job_submissions
  alter column source drop not null;
alter table public.job_submissions
  drop constraint if exists job_submissions_source_check;
alter table public.job_submissions
  drop constraint if exists job_submissions_source_by_kind_check;
alter table public.job_submissions
  add constraint job_submissions_source_by_kind_check
  check (listing_type = 'seeker' or source is null or source ~* '^https?://');

alter table public.job_submissions
  drop constraint if exists job_submissions_contact_whatsapp_check;
alter table public.job_submissions
  add constraint job_submissions_contact_whatsapp_check
  check (contact_whatsapp is null or char_length(contact_whatsapp) between 5 and 40);

alter table public.job_submissions
  drop constraint if exists job_submissions_contact_email_check;
alter table public.job_submissions
  add constraint job_submissions_contact_email_check
  check (contact_email is null or (char_length(contact_email) <= 254 and contact_email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'));

alter table public.job_submissions
  drop constraint if exists job_submissions_contact_whatsapp_kind_check;
alter table public.job_submissions
  add constraint job_submissions_contact_whatsapp_kind_check
  check (contact_whatsapp is null or listing_type = 'job');

-- Return type changes require replacing the function, not CREATE OR REPLACE.
drop function if exists public.list_public_jobs();
create function public.list_public_jobs()
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
  contact_whatsapp text,
  contact_email text,
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
    case when job.contact_public then job.contact_whatsapp else null::text end as contact_whatsapp,
    case when job.contact_public then job.contact_email else null::text end as contact_email,
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

commit;
