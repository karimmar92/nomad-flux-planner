
-- ============ roles ============
create type public.app_role as enum ('admin', 'creator', 'user');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create policy "read own roles" on public.user_roles for select to authenticated using (auth.uid() = user_id);
create policy "admins read all roles" on public.user_roles for select to authenticated using (public.has_role(auth.uid(), 'admin'));
create policy "admins manage roles" on public.user_roles for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

-- ============ shared updated_at ============
create or replace function public.update_updated_at_column()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end; $$;

-- ============ profiles ============
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  plan text not null default 'free',
  referral_code text not null unique,
  referred_by uuid references public.profiles(id) on delete set null,
  referred_at timestamptz,
  referral_program text check (referral_program in ('creator', 'user')),
  heard_about text,
  free_months_granted integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

create policy "read own profile" on public.profiles for select to authenticated using (auth.uid() = id);
create policy "admins read profiles" on public.profiles for select to authenticated using (public.has_role(auth.uid(), 'admin'));
create policy "insert own profile" on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy "update own profile" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.update_updated_at_column();

-- attribution is write-once: never overwrite referred_by / referred_at
create or replace function public.lock_referral_attribution()
returns trigger language plpgsql set search_path = public as $$
begin
  if old.referred_by is not null then
    new.referred_by := old.referred_by;
    new.referred_at := old.referred_at;
    new.referral_program := old.referral_program;
  end if;
  if new.referred_by = new.id then
    raise exception 'self referral is not allowed';
  end if;
  new.referral_code := old.referral_code;
  new.free_months_granted := old.free_months_granted;
  return new;
end; $$;
create trigger profiles_lock_attribution before update on public.profiles
  for each row execute function public.lock_referral_attribution();

-- ============ creator applications ============
create table public.creator_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  contact_email text not null,
  audience_description text not null,
  primary_channel text not null,
  channel_url text,
  audience_size integer,
  pitch text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  review_note text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert on public.creator_applications to authenticated;
grant update on public.creator_applications to authenticated;
grant all on public.creator_applications to service_role;
alter table public.creator_applications enable row level security;

create policy "read own application" on public.creator_applications for select to authenticated using (auth.uid() = user_id);
create policy "submit own application" on public.creator_applications for insert to authenticated with check (auth.uid() = user_id);
create policy "admins read applications" on public.creator_applications for select to authenticated using (public.has_role(auth.uid(), 'admin'));
create policy "admins review applications" on public.creator_applications for update to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

create trigger creator_applications_updated_at before update on public.creator_applications
  for each row execute function public.update_updated_at_column();

-- ============ creators ============
create table public.creators (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  code text not null unique,
  status text not null default 'active' check (status in ('active', 'paused', 'removed')),
  stripe_connect_account_id text,
  payouts_enabled boolean not null default false,
  terms_version text not null default '2026-08-04',
  approved_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.creators to authenticated;
grant all on public.creators to service_role;
alter table public.creators enable row level security;

create policy "read own creator row" on public.creators for select to authenticated using (auth.uid() = user_id);
create policy "admins read creators" on public.creators for select to authenticated using (public.has_role(auth.uid(), 'admin'));
create policy "admins manage creators" on public.creators for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

create trigger creators_updated_at before update on public.creators
  for each row execute function public.update_updated_at_column();

-- ============ commission ledger (append only) ============
create table public.commission_ledger (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creators(id) on delete cascade,
  referred_user_id uuid references auth.users(id) on delete set null,
  type text not null check (type in ('accrual', 'clawback', 'payout', 'adjustment')),
  amount_cents bigint not null,
  currency text not null default 'usd',
  status text not null check (status in ('pending', 'available', 'paid', 'reversed')),
  available_at timestamptz not null default (now() + interval '45 days'),
  stripe_invoice_id text,
  note text,
  created_at timestamptz not null default now(),
  constraint commission_ledger_note_required_on_adjustment
    check (type <> 'adjustment' or (note is not null and length(btrim(note)) > 0)),
  constraint commission_ledger_invoice_type_unique unique (stripe_invoice_id, type)
);
create index commission_ledger_creator_idx on public.commission_ledger (creator_id, created_at desc);
grant select on public.commission_ledger to authenticated;
grant all on public.commission_ledger to service_role;
alter table public.commission_ledger enable row level security;

create policy "creators read own ledger" on public.commission_ledger for select to authenticated
  using (exists (select 1 from public.creators c where c.id = creator_id and c.user_id = auth.uid()));
create policy "admins read ledger" on public.commission_ledger for select to authenticated using (public.has_role(auth.uid(), 'admin'));
create policy "admins append ledger" on public.commission_ledger for insert to authenticated
  with check (public.has_role(auth.uid(), 'admin'));

-- the ledger is append-only: block any attempt to change or delete a money row
create or replace function public.block_ledger_mutation()
returns trigger language plpgsql set search_path = public as $$
begin
  raise exception 'commission_ledger is append-only';
end; $$;
create trigger commission_ledger_no_update before update on public.commission_ledger
  for each row execute function public.block_ledger_mutation();
create trigger commission_ledger_no_delete before delete on public.commission_ledger
  for each row execute function public.block_ledger_mutation();

-- ============ payouts ============
create table public.creator_payouts (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creators(id) on delete cascade,
  amount_cents bigint not null,
  currency text not null default 'usd',
  status text not null default 'pending' check (status in ('pending', 'in_transit', 'paid', 'failed')),
  stripe_transfer_id text,
  period_start date,
  period_end date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.creator_payouts to authenticated;
grant all on public.creator_payouts to service_role;
alter table public.creator_payouts enable row level security;

create policy "creators read own payouts" on public.creator_payouts for select to authenticated
  using (exists (select 1 from public.creators c where c.id = creator_id and c.user_id = auth.uid()));
create policy "admins read payouts" on public.creator_payouts for select to authenticated using (public.has_role(auth.uid(), 'admin'));
create policy "admins manage payouts" on public.creator_payouts for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

create trigger creator_payouts_updated_at before update on public.creator_payouts
  for each row execute function public.update_updated_at_column();

-- ============ fraud flags (soft review only) ============
create table public.fraud_flags (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid references public.creators(id) on delete cascade,
  referred_user_id uuid references auth.users(id) on delete set null,
  kind text not null check (kind in ('ip_cluster', 'high_conversion_rate', 'volume_spike', 'other')),
  severity text not null default 'review' check (severity in ('review', 'urgent')),
  detail jsonb not null default '{}'::jsonb,
  status text not null default 'open' check (status in ('open', 'cleared', 'actioned')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.fraud_flags to authenticated;
grant all on public.fraud_flags to service_role;
alter table public.fraud_flags enable row level security;

create policy "admins read flags" on public.fraud_flags for select to authenticated using (public.has_role(auth.uid(), 'admin'));
create policy "admins manage flags" on public.fraud_flags for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

create trigger fraud_flags_updated_at before update on public.fraud_flags
  for each row execute function public.update_updated_at_column();

-- ============ referral clicks ============
create table public.referral_clicks (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  program text not null check (program in ('creator', 'user')),
  landing_path text,
  created_at timestamptz not null default now()
);
create index referral_clicks_code_idx on public.referral_clicks (code, created_at desc);
grant select on public.referral_clicks to authenticated;
grant insert on public.referral_clicks to anon, authenticated;
grant all on public.referral_clicks to service_role;
alter table public.referral_clicks enable row level security;

create policy "anyone can log a click" on public.referral_clicks for insert to anon, authenticated with check (true);
create policy "creators read own clicks" on public.referral_clicks for select to authenticated
  using (exists (select 1 from public.creators c where c.code = code and c.user_id = auth.uid()));
create policy "admins read clicks" on public.referral_clicks for select to authenticated using (public.has_role(auth.uid(), 'admin'));

-- ============ user referral rewards (free months only) ============
create table public.user_referral_rewards (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references public.profiles(id) on delete cascade,
  referred_user_id uuid not null references public.profiles(id) on delete cascade,
  side text not null check (side in ('referrer', 'referred')),
  free_months integer not null default 1 check (free_months = 1),
  status text not null default 'pending' check (status in ('pending', 'granted', 'void')),
  eligible_at timestamptz not null default now(),
  granted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (referred_user_id, side)
);
grant select on public.user_referral_rewards to authenticated;
grant all on public.user_referral_rewards to service_role;
alter table public.user_referral_rewards enable row level security;

create policy "read own rewards" on public.user_referral_rewards for select to authenticated
  using (auth.uid() = referrer_id or auth.uid() = referred_user_id);
create policy "admins read rewards" on public.user_referral_rewards for select to authenticated using (public.has_role(auth.uid(), 'admin'));
create policy "admins manage rewards" on public.user_referral_rewards for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

create trigger user_referral_rewards_updated_at before update on public.user_referral_rewards
  for each row execute function public.update_updated_at_column();

-- ============ derived balance (never a stored mutable number) ============
create or replace function public.creator_balance(_creator_id uuid)
returns table (available_cents bigint, pending_cents bigint, lifetime_cents bigint, paid_cents bigint)
language sql stable security definer set search_path = public as $$
  select
    coalesce(sum(amount_cents) filter (where status in ('available', 'paid')), 0)::bigint
      + coalesce(sum(amount_cents) filter (where status = 'pending' and available_at <= now()), 0)::bigint
      - coalesce(sum(-amount_cents) filter (where type = 'payout'), 0)::bigint * 0,
    coalesce(sum(amount_cents) filter (where status = 'pending' and available_at > now()), 0)::bigint,
    coalesce(sum(amount_cents) filter (where type = 'accrual'), 0)::bigint,
    coalesce(sum(-amount_cents) filter (where type = 'payout'), 0)::bigint
  from public.commission_ledger
  where creator_id = _creator_id;
$$;

-- new signups get a profile with a referral code
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  new_code text;
begin
  loop
    new_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    exit when not exists (select 1 from public.profiles where referral_code = new_code);
  end loop;
  insert into public.profiles (id, display_name, referral_code)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', ''), new_code)
  on conflict (id) do nothing;
  return new;
end; $$;
