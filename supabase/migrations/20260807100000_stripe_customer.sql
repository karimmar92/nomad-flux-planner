-- Billing: Stripe customer reference, and locking it against end users.
--
-- `stripe_customer_id` is what the billing portal is opened against. If a user
-- could write it, they could point their profile at someone else's Stripe
-- customer and open that person's billing portal — card details, invoices,
-- and the ability to cancel their subscription. It is server-owned, exactly
-- like `plan`.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS stripe_customer_id text;
CREATE INDEX IF NOT EXISTS profiles_stripe_customer_idx ON public.profiles (stripe_customer_id);

CREATE OR REPLACE FUNCTION public.lock_referral_attribution()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF old.referred_by IS NOT NULL THEN
    new.referred_by := old.referred_by;
    new.referred_at := old.referred_at;
    new.referral_program := old.referral_program;
  END IF;
  IF new.referred_by = new.id THEN
    RAISE EXCEPTION 'self referral is not allowed';
  END IF;
  new.referral_code := old.referral_code;
  new.free_months_granted := old.free_months_granted;
  -- Server-owned columns: only the Stripe webhook (service_role) may write
  -- these. Verified by simulating a signed-in user attempting both.
  IF COALESCE(auth.role(), 'postgres') NOT IN ('service_role', 'postgres', 'supabase_admin') THEN
    new.plan := old.plan;
    new.stripe_customer_id := old.stripe_customer_id;
  END IF;
  RETURN new;
END; $$;
