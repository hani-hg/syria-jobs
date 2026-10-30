-- وظائف سوريا: رسائل نموذج «تواصل معنا»
-- تُحفظ الأسرار في Vercel Environment Variables، ولا تُضاف إلى هذا الملف.

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 100),
  contact text not null check (char_length(contact) between 3 and 180),
  message text not null check (char_length(message) between 5 and 3000),
  created_at timestamptz not null default now()
);

alter table public.messages enable row level security;
revoke all on table public.messages from anon, authenticated;
grant select on table public.messages to authenticated;
grant usage on schema public to service_role;
grant insert, select on table public.messages to service_role;

drop policy if exists "admins can read contact messages" on public.messages;
create policy "admins can read contact messages"
  on public.messages
  for select
  to authenticated
  using (public.is_admin());

create index if not exists messages_created_at_idx on public.messages (created_at desc);
