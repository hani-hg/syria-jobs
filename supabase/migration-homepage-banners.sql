-- وظائف سوريا: صور البانر الرئيسية.
-- ينشئ مساحة تخزين عامة للعرض؛ الكتابة والاستبدال محصوران بمشرفي الموقع.
-- حد الرفع للصورة 8 MiB، وبحد أقصى ثلاث خانات في الجدول.

begin;

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
create policy "public can read homepage banners"
  on public.homepage_banners for select to anon, authenticated
  using (true);

drop policy if exists "admins can insert homepage banners" on public.homepage_banners;
create policy "admins can insert homepage banners"
  on public.homepage_banners for insert to authenticated
  with check (public.is_admin() and updated_by = auth.uid());

drop policy if exists "admins can update homepage banners" on public.homepage_banners;
create policy "admins can update homepage banners"
  on public.homepage_banners for update to authenticated
  using (public.is_admin())
  with check (public.is_admin() and updated_by = auth.uid());

drop policy if exists "admins can delete homepage banners" on public.homepage_banners;
create policy "admins can delete homepage banners"
  on public.homepage_banners for delete to authenticated
  using (public.is_admin());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('homepage-banners', 'homepage-banners', true, 8388608, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "admins can upload homepage banners" on storage.objects;
create policy "admins can upload homepage banners"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'homepage-banners' and public.is_admin());

drop policy if exists "admins can delete homepage banners" on storage.objects;
create policy "admins can delete homepage banners"
  on storage.objects for delete to authenticated
  using (bucket_id = 'homepage-banners' and public.is_admin());

commit;
