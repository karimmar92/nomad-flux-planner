-- partner_clicks: which affiliate placement actually earns, so dead placements
-- can be deleted rather than accumulating clutter.
-- No page views, no profiling — one row per outbound click.

create table if not exists public.partner_clicks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  partner_id text not null,
  placement text not null check (placement in ('city_detail', 'trip_confirm', 'visa_card', 'kit_page', 'border_run', 'onboarding')),
  city_id text,
  created_at timestamptz not null default now()
);

grant insert on public.partner_clicks to anon, authenticated;
grant all on public.partner_clicks to service_role;

alter table public.partner_clicks enable row level security;

-- Anyone (signed in or not) may log their own click; nobody may read them back
-- from the client. Reporting happens server-side with the service role.
create policy "anyone can log a click"
  on public.partner_clicks for insert
  to anon, authenticated
  with check (user_id is null or user_id = auth.uid());

-- Transport placements are limited to 'border_run', 'trip_confirm' and
-- 'kit_page' by product rule (see the TRANSPORT RULE in src/config/partners.ts).
-- Logged so we can tell whether the border-run planner actually earns or is
-- just a nice feature. Both outcomes are fine — we should know which.

create index if not exists partner_clicks_placement_idx
  on public.partner_clicks (placement, created_at desc);
