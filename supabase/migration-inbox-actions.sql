-- وظائف سوريا: أدوات إدارة رسائل صندوق الوارد.
-- راجع الملف قبل تشغيله على مشروع الإنتاج؛ لا يحذف أي رسائل.

begin;

alter table public.messages
  add column if not exists is_read boolean not null default false;

alter table public.messages enable row level security;

drop policy if exists "admins can update contact message read status" on public.messages;
create policy "admins can update contact message read status"
  on public.messages
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "admins can delete contact messages" on public.messages;
create policy "admins can delete contact messages"
  on public.messages
  for delete
  to authenticated
  using (public.is_admin());

-- احصر امتيازات المستخدم المصادق في القراءة، وتغيير is_read، والحذف.
revoke all on table public.messages from public, anon, authenticated;
grant select, delete on table public.messages to authenticated;
grant update (is_read) on table public.messages to authenticated;
grant insert, select on table public.messages to service_role;

commit;
