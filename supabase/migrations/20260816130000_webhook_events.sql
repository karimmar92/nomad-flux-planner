-- Webhook event log.
--
-- WHY THIS EXISTS
--
-- Until now every Stripe event was processed and thrown away. That is fine
-- until the day somebody writes "I paid and I'm still on the free plan", and
-- then there is no way to answer the only question that matters: did the
-- event arrive, and what did we do with it? Stripe's own dashboard shows
-- delivery and the response code, but not what our handler decided, and the
-- decisions are where the bugs are.
--
-- The payload is stored so an event can be replayed against fixed code. That
-- is the difference between "we think it is fixed" and "we reprocessed the
-- exact event and the customer now has Pro".

create table if not exists public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  -- Stripe's own event id. UNIQUE, so a retried delivery updates the existing
  -- row instead of creating a duplicate, and so we can see the retry count.
  stripe_event_id text not null unique,
  type text not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  -- received | processed | skipped | error
  status text not null default 'received',
  -- What the handler decided, e.g. {"plan":"pro"} or {"skipped":"unmapped_price"}.
  result jsonb,
  error text,
  -- Which user it touched, when we could work that out. Indexed because
  -- "show me everything that happened to this customer" is the query that
  -- actually gets run during a support conversation.
  user_id uuid,
  delivery_count int not null default 1,
  payload jsonb not null
);

create index if not exists webhook_events_user_idx on public.webhook_events (user_id, received_at desc);
create index if not exists webhook_events_type_idx on public.webhook_events (type, received_at desc);
create index if not exists webhook_events_status_idx on public.webhook_events (status, received_at desc)
  where status in ('error', 'received');

alter table public.webhook_events enable row level security;

-- No client may read this. It contains full Stripe payloads: emails, billing
-- addresses, card metadata. Admins reach it only through a server function
-- running as service_role, never through the anon key from a browser.
revoke all on public.webhook_events from anon, authenticated;
grant all on public.webhook_events to service_role;

comment on table public.webhook_events is
  'Stripe webhook audit log. Contains personal data from Stripe payloads: purge rows older than the retention period. Never expose to client roles.';

-- Retention. Payloads contain billing addresses and emails, so keeping them
-- forever is a GDPR problem rather than a helpful archive. 90 days is long
-- enough to investigate any dispute and short enough to defend.
create or replace function public.purge_old_webhook_events()
returns int
language sql
security definer
set search_path = public
as $$
  with gone as (
    delete from public.webhook_events
    where received_at < now() - interval '90 days'
    returning 1
  )
  select count(*)::int from gone;
$$;

revoke all on function public.purge_old_webhook_events() from public;
grant execute on function public.purge_old_webhook_events() to service_role;
