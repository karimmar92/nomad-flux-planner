-- Threshold alert state.
--
-- One row per (user, rule) holding the last band we told them about. The
-- notify rule lives in src/lib/alerts/thresholds.ts and is deliberately simple:
-- email only when the band RISES. This table is what makes that possible
-- across nightly runs, and without it the job emails every user every night
-- for as long as they sit above 75%, which is how a useful warning becomes
-- something people filter to trash.
--
-- Bands are 0, 75, 90, 100. 100 is separate from 90 because "you are over the
-- limit" must never be delivered as though it were "you are getting close".

create table if not exists public.alert_state (
  user_id     uuid not null references auth.users(id) on delete cascade,
  rule_id     text not null,
  last_band   smallint not null default 0 check (last_band in (0, 75, 90, 100)),
  last_sent_at timestamptz,
  -- Recorded so a failing send can be seen and retried rather than silently
  -- marking the user as notified.
  last_error  text,
  updated_at  timestamptz not null default now(),
  primary key (user_id, rule_id)
);

-- RLS on, and no policies for anon or authenticated.
--
-- This table is written only by the alert job using the service-role key,
-- which bypasses RLS. Nobody should read or write it from a browser. Enabling
-- RLS with zero policies is the correct way to say that: it denies by default
-- rather than relying on nobody guessing the table name.
alter table public.alert_state enable row level security;

revoke all on public.alert_state from anon, authenticated;

-- Lets a user see what they have been told, if a UI for it is ever built.
-- Read only, own rows only. Commented rather than deleted so the decision is
-- visible: today nothing needs it, and an unused policy is still attack surface.
-- create policy "own alert state read" on public.alert_state
--   for select to authenticated using (auth.uid() = user_id);

create index if not exists alert_state_user_idx on public.alert_state(user_id);

-- Passport, so the server can tell whose rules actually apply.
--
-- `nationality` existed on the client Profile type but lived only in
-- localStorage, so a server-side job had no way to know it. Without this
-- column the alert run would evaluate the Schengen 90/180 for EU, EEA and
-- Swiss citizens, who have free movement and no such limit — emailing people
-- warnings about a rule that does not bind them, which is the fastest way to
-- teach somebody that our alerts are noise.
--
-- Nullable. Nobody is forced to declare it, and the rules engine already
-- treats an unknown passport as "assume the limit applies", which fails toward
-- warning rather than staying quiet.
alter table public.profiles add column if not exists nationality text;

comment on column public.profiles.nationality is
  'ISO country code of the passport the user travels on. Decides which day-count rules apply.';

comment on table public.alert_state is
  'Last notified threshold band per user per rule. Written only by the alert job via service role.';
