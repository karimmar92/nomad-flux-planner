-- Fixes for the six linter findings, in severity order.
--
-- 1. CRITICAL — referral_clicks readable by the wrong people.
--    The old policy compared `c.code = code`; inside the EXISTS subquery the
--    unqualified `code` resolves to creators.code, making the comparison a
--    tautology. Any creator (and depending on planner behaviour, any
--    authenticated user) could read every click. Qualify the outer column.
DROP POLICY IF EXISTS "creators read own clicks" ON public.referral_clicks;
CREATE POLICY "creators read own clicks"
  ON public.referral_clicks FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.creators c
    WHERE c.code = referral_clicks.code AND c.user_id = auth.uid()
  ));

-- 2. CRITICAL — users could grant themselves Pro.
--    The "update own profile" policy covers every column, and the existing
--    lock trigger pins referral fields but not `plan`. Pin it: only the
--    service role (billing, admin jobs) or the dashboard may change plan.
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
  -- plan is server-owned: end users cannot write it, whatever the RLS says.
  IF COALESCE(auth.role(), 'postgres') NOT IN ('service_role', 'postgres', 'supabase_admin') THEN
    new.plan := old.plan;
  END IF;
  RETURN new;
END; $$;

-- 3. CRITICAL — Security definer view.
--    radar_profiles was later given security_invoker in code, but the remote
--    database may still hold the original definer-semantics version.
--    Idempotent either way.
ALTER VIEW public.radar_profiles SET (security_invoker = true);

-- 4. WARNING — employees could approve their own travel requests.
--    Two permissive UPDATE policies OR together, so a requester could set
--    status='approved' through the "own requests" path. Requesters may now
--    only edit while pending, and only to pending/withdrawn; deciding is for
--    admins, and never on their own requests.
DROP POLICY IF EXISTS "own requests update" ON public.travel_requests;
CREATE POLICY "own requests update"
  ON public.travel_requests FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND status = 'pending')
  WITH CHECK (
    auth.uid() = user_id
    AND status IN ('pending', 'withdrawn')
    AND decided_by IS NULL
  );

DROP POLICY IF EXISTS "admins decide requests" ON public.travel_requests;
CREATE POLICY "admins decide requests"
  ON public.travel_requests FOR UPDATE TO authenticated
  USING (public.is_org_admin(auth.uid(), org_id) AND user_id <> auth.uid())
  WITH CHECK (public.is_org_admin(auth.uid(), org_id) AND user_id <> auth.uid());

-- 5. WARNING — SECURITY DEFINER functions executable by PUBLIC.
--    Postgres grants EXECUTE to PUBLIC on new functions by default. Revoke
--    everywhere, then grant back only what each caller needs.
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

REVOKE ALL ON FUNCTION public.is_org_admin(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_org_admin(uuid, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.is_org_member(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_org_member(uuid, uuid) TO authenticated;

-- handle_new_user only ever runs from the auth trigger; nobody calls it.
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- creator_balance was the worst of these: definer rights + PUBLIC execute
-- meant anyone could read any creator's earnings by passing their id.
-- Ownership check inside the function AND tightened grants.
CREATE OR REPLACE FUNCTION public.creator_balance(_creator_id uuid)
RETURNS table (available_cents bigint, pending_cents bigint, lifetime_cents bigint, paid_cents bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    COALESCE(sum(amount_cents) FILTER (WHERE status IN ('available', 'paid')), 0)::bigint
      + COALESCE(sum(amount_cents) FILTER (WHERE status = 'pending' AND available_at <= now()), 0)::bigint
      - COALESCE(sum(-amount_cents) FILTER (WHERE type = 'payout'), 0)::bigint * 0,
    COALESCE(sum(amount_cents) FILTER (WHERE status = 'pending' AND available_at > now()), 0)::bigint,
    COALESCE(sum(amount_cents) FILTER (WHERE type = 'accrual'), 0)::bigint,
    COALESCE(sum(-amount_cents) FILTER (WHERE type = 'payout'), 0)::bigint
  FROM public.commission_ledger
  WHERE creator_id = _creator_id
    -- Callers see only their own balance (admins see all). Non-owners get
    -- zeros, not an error — nothing to probe.
    AND EXISTS (
      SELECT 1 FROM public.creators c
      WHERE c.id = _creator_id
        AND (c.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
    );
$$;
REVOKE ALL ON FUNCTION public.creator_balance(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.creator_balance(uuid) TO authenticated;

-- 6. WARNING — "Signed-In Users Can Execute SECURITY DEFINER Function".
--    This flags delete_my_account() and delete_my_radar_data(). It is
--    INTENTIONAL: both operate strictly on auth.uid(), take no target
--    parameter, and exist precisely so signed-in users can erase their own
--    data (GDPR Art. 17). Restricting them further would break erasure.
--    Accept this finding; do not "fix" it.
