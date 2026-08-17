create or replace function public.guard_profile_billing_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  NEW.plan := OLD.plan;
  NEW.free_months_granted := OLD.free_months_granted;
  NEW.referred_by := OLD.referred_by;
  NEW.referral_program := OLD.referral_program;
  NEW.stripe_customer_id := OLD.stripe_customer_id;
  NEW.founding_number := OLD.founding_number;
  RETURN NEW;
END;
$$;

drop policy if exists "members leave own membership" on public.org_members;
create policy "members leave own membership"
on public.org_members
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid() and status = 'left');

revoke all on public.rate_limit_buckets from anon, authenticated;
grant all on public.rate_limit_buckets to service_role;
alter table public.rate_limit_buckets enable row level security;

drop policy if exists "service role manages rate limit buckets" on public.rate_limit_buckets;
create policy "service role manages rate limit buckets"
on public.rate_limit_buckets
for all
to service_role
using (true)
with check (true);

drop policy if exists "no client access to rate limit buckets" on public.rate_limit_buckets;
create policy "no client access to rate limit buckets"
on public.rate_limit_buckets
for all
to anon, authenticated
using (false)
with check (false);

revoke execute on function public.claim_founding_spot(uuid, text) from anon, authenticated;
revoke execute on function public.purge_old_webhook_events() from anon, authenticated;