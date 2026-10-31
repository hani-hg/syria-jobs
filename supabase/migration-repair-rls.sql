-- إصلاح RLS لمشروع وظائف سوريا.
-- هذه migration يجب مراجعتها قبل تطبيقها على قاعدة الإنتاج.
-- تحافظ على السجلات الموجودة؛ ولا تحذف إعلانات أو رسائل.

-- إيقاف الانكشاف الحالي: الجدول كان RLS معطلاً رغم وجود سياسات.
alter table public.job_submissions enable row level security;
alter table public.messages enable row level security;
alter table public.admin_users enable row level security;

-- إزالة سياسات قديمة متعارضة، خصوصًا سياسة قراءة الرسائل لأي مستخدم مسجل وسياسات الإدخال العامة.
drop policy if exists "public can submit pending jobs" on public.job_submissions;
drop policy if exists "admins can insert jobs" on public.job_submissions;
drop policy if exists "admins can update jobs" on public.job_submissions;
drop policy if exists "admins can delete jobs" on public.job_submissions;
drop policy if exists "public can read approved jobs" on public.job_submissions;
drop policy if exists "admins can read all jobs" on public.job_submissions;
drop policy if exists "admins can read own admin row" on public.admin_users;
drop policy if exists "Admins can read messages" on public.messages;
drop policy if exists "Allow public inserts" on public.messages;
drop policy if exists "Public can insert messages" on public.messages;
drop policy if exists "admins can read contact messages" on public.messages;

-- إعلانات الوظائف: الزوار يرسلون طلبات معلقة ويقرؤون المنشور غير المنتهي فقط.
create policy "public can submit pending jobs"
  on public.job_submissions for insert to anon, authenticated
  with check (status = 'pending');
create policy "admins can insert jobs"
  on public.job_submissions for insert to authenticated
  with check (public.is_admin());
create policy "admins can update jobs"
  on public.job_submissions for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "admins can delete jobs"
  on public.job_submissions for delete to authenticated
  using (public.is_admin());
create policy "public can read approved jobs"
  on public.job_submissions for select to anon, authenticated
  using (status = 'approved' and deadline >= current_date);
create policy "admins can read all jobs"
  on public.job_submissions for select to authenticated
  using (public.is_admin());

-- رسائل التواصل: لا يكتبها إلا API الخلفي بمفتاح خادمي، ولا يقرأها إلا المشرف.
create policy "admins can read contact messages"
  on public.messages for select to authenticated
  using (public.is_admin());

-- مدراء الموقع لا يستطيع المستخدمون قراءة إلا سجلهم الخاص للتحقق من عضوية الإدارة.
create policy "admins can read own admin row"
  on public.admin_users for select to authenticated
  using (user_id = auth.uid());

-- أقل صلاحيات لازمة: إزالة منح CRUD العامة القديمة ثم منح ما تحتاجه الواجهات فقط.
revoke all on table public.job_submissions from public, anon, authenticated;
grant select, insert on table public.job_submissions to anon;
grant select, insert, update, delete on table public.job_submissions to authenticated;
grant all on table public.job_submissions to service_role;

revoke all on table public.messages from public, anon, authenticated;
grant select on table public.messages to authenticated;
grant insert, select on table public.messages to service_role;

grant usage on schema public to anon, authenticated, service_role;
revoke all on table public.admin_users from public, anon, authenticated;
grant select on table public.admin_users to authenticated;
grant all on table public.admin_users to service_role;

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

create index if not exists job_submissions_status_deadline_idx
  on public.job_submissions (status, deadline);
create index if not exists messages_created_at_idx
  on public.messages (created_at desc);
