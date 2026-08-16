-- Founding 100: one-time purchase granting Pro permanently.
--
-- THE CAP IS ENFORCED HERE, NOT IN THE UI.
--
-- A limit checked in React is a limit that fails the moment two people
-- click at the same time, and "sorry, we actually sold 103 lifetime deals"
-- is both a refund conversation and a misleading-advertising problem. The
-- sequence below makes spot 101 impossible at the database level.

-- Which spot someone holds (1..100). NULL means not a founding member.
-- Unique, so the same number cannot be issued twice even under a race.
alter table public.profiles
  add column if not exists founding_number int unique,
  add column if not exists founding_purchased_at timestamptz,
  add column if not exists founding_payment_id text unique;

comment on column public.profiles.founding_number is
  'Founding-100 spot number, 1..100. NULL for everyone else. Grants Pro permanently.';
comment on column public.profiles.founding_payment_id is
  'Stripe checkout session id. UNIQUE so a replayed webhook cannot issue a second spot.';

-- ---------------------------------------------------------------------
-- Public counter.
--
-- SECURITY DEFINER because profiles is behind RLS and an anonymous
-- visitor must be able to see how many spots are gone without being able
-- to see a single row. Returns one integer and nothing else.
-- ---------------------------------------------------------------------
create or replace function public.founding_spots_taken()
returns int
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int from public.profiles where founding_number is not null;
$$;

revoke all on function public.founding_spots_taken() from public;
grant execute on function public.founding_spots_taken() to anon, authenticated;

-- ---------------------------------------------------------------------
-- Claim a spot. Called ONLY by the Stripe webhook as service_role.
--
-- Returns the assigned number, or NULL if the cohort is full.
--
-- Idempotency is load-bearing: Stripe retries webhooks, and without the
-- payment-id check a retry would burn a second spot for the same payment.
-- The unique index on founding_payment_id is the backstop if this races.
-- ---------------------------------------------------------------------
create or replace function public.claim_founding_spot(
  p_user_id uuid,
  p_payment_id text
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing int;
  v_next int;
begin
  -- Already processed this payment, or this user already holds a spot.
  select founding_number into v_existing
  from public.profiles
  where id = p_user_id or founding_payment_id = p_payment_id
  limit 1;

  if v_existing is not null then
    return v_existing;
  end if;

  -- Serialise claimants. Without this lock two concurrent purchases can
  -- both read the same max() and both try to take the same number; one
  -- would then fail on the unique index and that customer would be
  -- charged with no spot issued.
  perform pg_advisory_xact_lock(hashtext('founding_100'));

  select coalesce(max(founding_number), 0) + 1 into v_next
  from public.profiles;

  if v_next > 100 then
    return null;  -- sold out; caller must refund
  end if;

  update public.profiles
     set founding_number = v_next,
         founding_purchased_at = now(),
         founding_payment_id = p_payment_id,
         plan = 'pro'
   where id = p_user_id;

  return v_next;
end;
$$;

revoke all on function public.claim_founding_spot(uuid, text) from public;
-- service_role only. An authenticated user must never be able to grant
-- themselves Pro by calling this directly.
grant execute on function public.claim_founding_spot(uuid, text) to service_role;

-- ---------------------------------------------------------------------
-- Protect founding members from the subscription downgrade path.
--
-- The webhook sets plan='free' on customer.subscription.deleted. A
-- founding member has no subscription so that event should never fire for
-- them, but if they ever subscribe to Teams and later cancel, the same
-- handler would strip the Pro access they paid for permanently. This
-- trigger makes that impossible regardless of what the handler does.
-- ---------------------------------------------------------------------
create or replace function public.keep_founding_members_pro()
returns trigger
language plpgsql
as $$
begin
  if old.founding_number is not null and new.plan = 'free' then
    new.plan := 'pro';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_keep_founding_members_pro on public.profiles;
create trigger trg_keep_founding_members_pro
  before update of plan on public.profiles
  for each row
  execute function public.keep_founding_members_pro();
