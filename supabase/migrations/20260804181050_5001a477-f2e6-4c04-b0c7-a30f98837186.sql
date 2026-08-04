-- ============================================================
-- B2B tier: organisations, seats, policies, travel requests
-- ============================================================

create table public.trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  country_code text not null,
  city_id text,
  entry_date date not null,
  exit_date date,
  purpose text not null default 'tourist',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index trips_user_idx on public.trips(user_id);
grant select, insert, update, delete on public.trips to authenticated;
grant all on public.trips to service_role;
alter table public.trips enable row level security;
create policy "own trips read" on public.trips for select to authenticated using (auth.uid() = user_id);
create policy "own trips insert" on public.trips for insert to authenticated with check (auth.uid() = user_id);
create policy "own trips update" on public.trips for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own trips delete" on public.trips for delete to authenticated using (auth.uid() = user_id);
create trigger trips_updated_at before update on public.trips
  for each row execute function public.update_updated_at_column();

create table public.organisations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  plan text not null default 'business',
  seats_purchased integer not null default 10,
  billing_email text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.organisations to authenticated;
grant all on public.organisations to service_role;
alter table public.organisations enable row level security;
create trigger organisations_updated_at before update on public.organisations
  for each row execute function public.update_updated_at_column();

create table public.org_members (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  invite_email text,
  role text not null default 'member' check (role in ('admin','member')),
  status text not null default 'invited' check (status in ('invited','active','left')),
  joined_at timestamptz,
  left_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index org_members_org_user_idx on public.org_members(org_id, user_id) where user_id is not null;
create unique index org_members_org_email_idx on public.org_members(org_id, lower(invite_email)) where invite_email is not null;
grant select, insert, update, delete on public.org_members to authenticated;
grant all on public.org_members to service_role;
alter table public.org_members enable row level security;
create trigger org_members_updated_at before update on public.org_members
  for each row execute function public.update_updated_at_column();

-- Security-definer helpers: avoid recursive RLS on org_members.
create or replace function public.is_org_admin(_user_id uuid, _org_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.org_members
    where org_id = _org_id and user_id = _user_id
      and role = 'admin' and status = 'active'
  )
$$;

create or replace function public.is_org_member(_user_id uuid, _org_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.org_members
    where org_id = _org_id and user_id = _user_id and status = 'active'
  )
$$;

create policy "members read own membership" on public.org_members
  for select to authenticated using (auth.uid() = user_id);
create policy "admins read org members" on public.org_members
  for select to authenticated using (public.is_org_admin(auth.uid(), org_id));
create policy "admins manage org members" on public.org_members
  for insert to authenticated with check (public.is_org_admin(auth.uid(), org_id));
create policy "admins update org members" on public.org_members
  for update to authenticated using (public.is_org_admin(auth.uid(), org_id))
  with check (public.is_org_admin(auth.uid(), org_id));
create policy "members update own membership" on public.org_members
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "admins remove org members" on public.org_members
  for delete to authenticated using (public.is_org_admin(auth.uid(), org_id));

create policy "members read own org" on public.organisations
  for select to authenticated using (public.is_org_member(auth.uid(), id));
create policy "admins update own org" on public.organisations
  for update to authenticated using (public.is_org_admin(auth.uid(), id))
  with check (public.is_org_admin(auth.uid(), id));
create policy "authenticated create org" on public.organisations
  for insert to authenticated with check (true);

create table public.org_policies (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  country_code text,
  max_days integer not null,
  requires_approval boolean not null default true,
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.org_policies to authenticated;
grant all on public.org_policies to service_role;
alter table public.org_policies enable row level security;
create trigger org_policies_updated_at before update on public.org_policies
  for each row execute function public.update_updated_at_column();
create policy "org members read policies" on public.org_policies
  for select to authenticated using (public.is_org_member(auth.uid(), org_id));
create policy "org admins manage policies" on public.org_policies
  for all to authenticated using (public.is_org_admin(auth.uid(), org_id))
  with check (public.is_org_admin(auth.uid(), org_id));

create table public.travel_requests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  country_code text not null,
  start_date date not null,
  end_date date not null,
  status text not null default 'pending' check (status in ('pending','approved','declined','withdrawn')),
  decided_by uuid references auth.users(id),
  decided_at timestamptz,
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.travel_requests to authenticated;
grant all on public.travel_requests to service_role;
alter table public.travel_requests enable row level security;
create trigger travel_requests_updated_at before update on public.travel_requests
  for each row execute function public.update_updated_at_column();
create policy "own requests read" on public.travel_requests
  for select to authenticated using (auth.uid() = user_id);
create policy "admins read org requests" on public.travel_requests
  for select to authenticated using (public.is_org_admin(auth.uid(), org_id));
create policy "own requests insert" on public.travel_requests
  for insert to authenticated with check (auth.uid() = user_id and public.is_org_member(auth.uid(), org_id));
create policy "own requests update" on public.travel_requests
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "admins decide requests" on public.travel_requests
  for update to authenticated using (public.is_org_admin(auth.uid(), org_id))
  with check (public.is_org_admin(auth.uid(), org_id));

create table public.b2b_leads (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  contact_name text not null,
  work_email text not null,
  team_size integer,
  message text not null default '',
  status text not null default 'new',
  created_at timestamptz not null default now()
);
grant insert on public.b2b_leads to anon, authenticated;
grant all on public.b2b_leads to service_role;
alter table public.b2b_leads enable row level security;
create policy "anyone can submit a b2b lead" on public.b2b_leads
  for insert to anon, authenticated with check (true);
create policy "site admins read b2b leads" on public.b2b_leads
  for select to authenticated using (public.has_role(auth.uid(), 'admin'::app_role));

-- ============================================================
-- THE ONLY SURFACE THE EMPLOYER MAY QUERY.
-- Country + dates + the employee link. Nothing else, ever.
-- Widening this column list is a product decision, not a patch.
-- ============================================================
create view public.org_member_presence as
select
  m.org_id,
  m.user_id,
  t.id as trip_id,
  t.country_code,
  t.entry_date,
  t.exit_date,
  t.created_at as logged_at
from public.org_members m
join public.trips t on t.user_id = m.user_id
where m.status = 'active'
  and (m.user_id = auth.uid() or public.is_org_admin(auth.uid(), m.org_id));

grant select on public.org_member_presence to authenticated;

-- Name/role/status only, so the dashboard can label a row without touching profiles.
create view public.org_member_directory as
select
  m.org_id,
  m.user_id,
  m.id as member_id,
  m.invite_email,
  m.role,
  m.status,
  m.joined_at,
  coalesce(p.display_name, '') as display_name
from public.org_members m
left join public.profiles p on p.id = m.user_id
where m.user_id = auth.uid() or public.is_org_admin(auth.uid(), m.org_id);

grant select on public.org_member_directory to authenticated;