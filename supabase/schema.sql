-- وظائف سوريا: جدول طلبات التوظيف
create table if not exists public.job_submissions (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 2 and 160),
  company text not null check (char_length(company) between 2 and 160),
  governorate text not null check (char_length(governorate) between 2 and 80),
  field text not null check (char_length(field) between 2 and 100),
  type text not null default 'خاص' check (type in ('حكومي', 'خاص')),
  deadline date not null,
  source text not null check (source ~* '^https?://'),
  description text not null check (char_length(description) between 10 and 5000),
  contact text check (contact is null or char_length(contact) between 0 and 160),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);

alter table public.job_submissions add column if not exists contact text;

create index if not exists job_submissions_status_deadline_idx on public.job_submissions (status, deadline);

-- لا تستخدم service_role في المتصفح. أضف UID مدير موثوق هنا بعد إنشاء حسابه في Supabase Auth.
create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.job_submissions enable row level security;
alter table public.admin_users enable row level security;

grant usage on schema public to anon, authenticated;
grant select, insert on table public.job_submissions to anon, authenticated;
grant select, insert, update, delete on table public.job_submissions to authenticated;
grant select on table public.admin_users to authenticated;

-- دالة داخلية للتحقق من المدير، لا تُعرض كواجهة عامة.
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
grant execute on function public.is_admin() to anon, authenticated;

-- الزوار يرون الإعلانات المعتمدة، والمدير يرى كل الحالات.
drop policy if exists "public can read approved jobs" on public.job_submissions;
create policy "public can read approved jobs"
  on public.job_submissions for select
  to anon, authenticated
  using (status = 'approved' or public.is_admin());

-- النموذج العام يرسل طلبات قيد المراجعة فقط.
drop policy if exists "public can submit pending jobs" on public.job_submissions;
create policy "public can submit pending jobs"
  on public.job_submissions for insert
  to anon, authenticated
  with check (status = 'pending');

drop policy if exists "admins can insert jobs" on public.job_submissions;
create policy "admins can insert jobs"
  on public.job_submissions for insert
  to authenticated
  with check (public.is_admin());

-- المدير فقط يستطيع الاعتماد أو الرفض أو التعديل أو الحذف.
drop policy if exists "admins can update jobs" on public.job_submissions;
create policy "admins can update jobs"
  on public.job_submissions for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "admins can delete jobs" on public.job_submissions;
create policy "admins can delete jobs"
  on public.job_submissions for delete
  to authenticated
  using (public.is_admin());

-- المدير يستطيع التحقق من صفه فقط. إضافة المدراء تتم من SQL Editor بصلاحية مالك المشروع.
drop policy if exists "admins can read own admin row" on public.admin_users;
create policy "admins can read own admin row"
  on public.admin_users for select
  to authenticated
  using (user_id = auth.uid());

-- بعد إنشاء مستخدم في Authentication > Users، نفّذ:
-- insert into public.admin_users (user_id) values ('USER_UUID_HERE');
