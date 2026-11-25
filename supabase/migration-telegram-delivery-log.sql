-- Independent Telegram delivery log. Apply only after review and approval.
-- Existing job_submissions rows are intentionally not backfilled: the first run
-- after this migration sends each currently scraped eligible source message once.
begin;

create table if not exists public.telegram_delivery_log (
  source_key text primary key,
  source_message_url text not null,
  channel_id text not null,
  title text not null,
  status text not null default 'processing'
    check (status in ('processing', 'sent', 'failed')),
  attempts integer not null default 1 check (attempts > 0),
  telegram_message_id bigint,
  claimed_at timestamptz not null default now(),
  sent_at timestamptz,
  last_error text
);

create index if not exists telegram_delivery_log_status_claimed_at_idx
  on public.telegram_delivery_log (status, claimed_at);

alter table public.telegram_delivery_log enable row level security;
grant usage on schema public to service_role;
revoke all on table public.telegram_delivery_log from public, anon, authenticated, service_role;
grant select, update on table public.telegram_delivery_log to service_role;

create or replace function public.claim_telegram_delivery(
  p_source_key text,
  p_source_message_url text,
  p_channel_id text,
  p_title text
)
returns table (claimed boolean)
language sql
security definer
set search_path = pg_catalog, pg_temp
as $function$
  insert into public.telegram_delivery_log as current_delivery (
    source_key,
    source_message_url,
    channel_id,
    title,
    status,
    attempts,
    claimed_at
  )
  values (
    p_source_key,
    p_source_message_url,
    p_channel_id,
    p_title,
    'processing',
    1,
    now()
  )
  on conflict (source_key) do update
    set source_message_url = excluded.source_message_url,
        channel_id = excluded.channel_id,
        title = excluded.title,
        status = 'processing',
        attempts = current_delivery.attempts + 1,
        claimed_at = now(),
        last_error = null
    where current_delivery.status in ('failed', 'processing')
      and current_delivery.claimed_at < now() - interval '30 minutes'
  returning true as claimed;
$function$;

revoke all on function public.claim_telegram_delivery(text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.claim_telegram_delivery(text, text, text, text)
  to service_role;

comment on table public.telegram_delivery_log is
  'Tracks Telegram delivery independently from job_submissions; sent source keys are not re-posted.';

commit;
