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
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);

create index if not exists job_submissions_status_deadline_idx
  on public.job_submissions (status, deadline);

alter table public.job_submissions enable row level security;

-- الزوار يرون الإعلانات الموافق عليها فقط.
drop policy if exists "public can read approved jobs" on public.job_submissions;
create policy "public can read approved jobs"
  on public.job_submissions for select
  to anon, authenticated
  using (status = 'approved');

-- يسمح النموذج العام بإرسال طلب جديد فقط، ولا يسمح للزائر باعتماده بنفسه.
drop policy if exists "public can submit pending jobs" on public.job_submissions;
create policy "public can submit pending jobs"
  on public.job_submissions for insert
  to anon, authenticated
  with check (status = 'pending' and type = 'خاص');

-- لا توجد صلاحيات عامة للتعديل أو الحذف.
