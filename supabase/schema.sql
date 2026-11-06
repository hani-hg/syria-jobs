-- وظائف سوريا: فرص العمل وطلبات الباحثين عن عمل
create table if not exists public.job_submissions (
  id uuid primary key default gen_random_uuid(),
  listing_type text not null default 'job',
  title text not null check (char_length(title) between 2 and 160),
  company text not null check (char_length(company) between 2 and 160),
  governorate text not null check (char_length(governorate) between 2 and 80),
  field text not null check (char_length(field) between 2 and 100),
  type text not null default 'خاص' check (type in ('حكومي', 'خاص')),
  deadline date not null,
  source text,
  description text not null check (char_length(description) between 10 and 5000),
  contact text check (contact is null or char_length(contact) <= 160),
  contact_public boolean not null default false,
  experience text check (experience is null or char_length(experience) <= 120),
  work_arrangement text check (work_arrangement is null or char_length(work_arrangement) <= 80),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  view_count bigint not null default 0 constraint job_submissions_view_count_check check (view_count >= 0),
  created_at timestamptz not null default now(),
  constraint job_submissions_listing_type_check check (listing_type in ('job','seeker')),
  constraint job_submissions_source_by_kind_check check (listing_type = 'seeker' or (source is not null and source ~* '^https?://'))
);

alter table public.job_submissions add column if not exists listing_type text not null default 'job';
alter table public.job_submissions add column if not exists experience text;
alter table public.job_submissions add column if not exists work_arrangement text;
alter table public.job_submissions add column if not exists contact text;
alter table public.job_submissions add column if not exists contact_public boolean not null default false;
alter table public.job_submissions add column if not exists view_count bigint not null default 0;
alter table public.job_submissions drop constraint if exists job_submissions_view_count_check;
alter table public.job_submissions add constraint job_submissions_view_count_check check (view_count >= 0);
alter table public.job_submissions alter column source drop not null;
alter table public.job_submissions drop constraint if exists job_submissions_source_check;
alter table public.job_submissions drop constraint if exists job_submissions_listing_type_check;
alter table public.job_submissions drop constraint if exists job_submissions_source_by_kind_check;
alter table public.job_submissions add constraint job_submissions_listing_type_check check (listing_type in ('job','seeker'));
alter table public.job_submissions add constraint job_submissions_source_by_kind_check check (listing_type = 'seeker' or (source is not null and source ~* '^https?://'));
create index if not exists job_submissions_status_deadline_idx on public.job_submissions (status, deadline);
create index if not exists job_submissions_kind_sector_deadline_idx on public.job_submissions (listing_type, type, deadline);

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.job_submissions enable row level security;
alter table public.admin_users enable row level security;
grant usage on schema public to anon, authenticated;
revoke all on table public.job_submissions from public, anon;
grant insert on table public.job_submissions to anon;
grant select, insert, update, delete on table public.job_submissions to authenticated;
grant select on table public.admin_users to authenticated;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admin_users where user_id = auth.uid());
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

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
revoke all on function public.increment_listing_view(uuid) from public, anon, authenticated;
grant execute on function public.increment_listing_view(uuid) to anon, authenticated;

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

drop policy if exists "public can submit pending jobs" on public.job_submissions;
create policy "public can submit pending jobs" on public.job_submissions for insert to anon, authenticated with check (status = 'pending');
drop policy if exists "admins can insert jobs" on public.job_submissions;
create policy "admins can insert jobs" on public.job_submissions for insert to authenticated with check (public.is_admin());
drop policy if exists "admins can update jobs" on public.job_submissions;
create policy "admins can update jobs" on public.job_submissions for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "admins can delete jobs" on public.job_submissions;
create policy "admins can delete jobs" on public.job_submissions for delete to authenticated using (public.is_admin());
drop policy if exists "public can read approved jobs" on public.job_submissions;
drop policy if exists "public can read approved jobs" on public.job_submissions;
drop policy if exists "admins can read all jobs" on public.job_submissions;
create policy "admins can read all jobs" on public.job_submissions for select to authenticated using (public.is_admin());
drop policy if exists "admins can read own admin row" on public.admin_users;
create policy "admins can read own admin row" on public.admin_users for select to authenticated using (user_id = auth.uid());

-- إنشاء مدير: أنشئ حسابًا من Supabase Auth ثم أضف معرّفه من SQL Editor بصلاحية مالك المشروع.
-- insert into public.admin_users (user_id) values ('USER_UUID_HERE');


-- رسائل نموذج «تواصل معنا»
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 100),
  contact text not null check (char_length(contact) between 3 and 180),
  message text not null check (char_length(message) between 5 and 3000),
  created_at timestamptz not null default now(),
  is_read boolean not null default false
);
alter table public.messages enable row level security;
revoke all on table public.messages from anon, authenticated;
grant select, delete on table public.messages to authenticated;
grant update (is_read) on table public.messages to authenticated;
grant usage on schema public to service_role;
grant insert, select on table public.messages to service_role;
drop policy if exists "admins can read contact messages" on public.messages;
create policy "admins can read contact messages" on public.messages for select to authenticated using (public.is_admin());
drop policy if exists "admins can update contact message read status" on public.messages;
create policy "admins can update contact message read status" on public.messages for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "admins can delete contact messages" on public.messages;
create policy "admins can delete contact messages" on public.messages for delete to authenticated using (public.is_admin());
create index if not exists messages_created_at_idx on public.messages (created_at desc);

-- صور البانر الرئيسية، مع ثلاث خانات ثابتة وقراءة عامة للصور المنشورة.
create table if not exists public.homepage_banners (
  slot smallint primary key check (slot between 1 and 3),
  image_url text not null check (image_url like 'https://%'),
  storage_path text not null unique,
  alt_text text check (alt_text is null or char_length(alt_text) <= 120),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);
alter table public.homepage_banners enable row level security;
revoke all on table public.homepage_banners from public, anon, authenticated;
grant select on table public.homepage_banners to anon, authenticated;
grant insert, select, update, delete on table public.homepage_banners to authenticated;
grant all on table public.homepage_banners to service_role;
drop policy if exists "public can read homepage banners" on public.homepage_banners;
create policy "public can read homepage banners" on public.homepage_banners for select to anon, authenticated using (true);
drop policy if exists "admins can insert homepage banners" on public.homepage_banners;
create policy "admins can insert homepage banners" on public.homepage_banners for insert to authenticated with check (public.is_admin() and updated_by = auth.uid());
drop policy if exists "admins can update homepage banners" on public.homepage_banners;
create policy "admins can update homepage banners" on public.homepage_banners for update to authenticated using (public.is_admin()) with check (public.is_admin() and updated_by = auth.uid());
drop policy if exists "admins can delete homepage banners" on public.homepage_banners;
create policy "admins can delete homepage banners" on public.homepage_banners for delete to authenticated using (public.is_admin());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('homepage-banners', 'homepage-banners', true, 8388608, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists "admins can upload homepage banners" on storage.objects;
create policy "admins can upload homepage banners" on storage.objects for insert to authenticated with check (bucket_id = 'homepage-banners' and public.is_admin());
drop policy if exists "admins can delete homepage banners" on storage.objects;
create policy "admins can delete homepage banners" on storage.objects for delete to authenticated using (bucket_id = 'homepage-banners' and public.is_admin());
