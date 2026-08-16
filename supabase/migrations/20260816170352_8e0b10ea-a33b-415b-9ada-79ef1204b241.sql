
-- 1. org_members: block self-escalation
DROP POLICY IF EXISTS "members update own membership" ON public.org_members;
CREATE POLICY "members leave own membership"
ON public.org_members FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id AND status = 'left');

CREATE OR REPLACE FUNCTION public.guard_org_member_self_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW; -- server/service-role paths
  END IF;
  IF public.is_org_admin(auth.uid(), OLD.org_id) THEN
    RETURN NEW;
  END IF;
  IF NEW.role IS DISTINCT FROM OLD.role
     OR NEW.org_id IS DISTINCT FROM OLD.org_id
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR (NEW.status IS DISTINCT FROM OLD.status AND NEW.status <> 'left') THEN
    RAISE EXCEPTION 'Only an organisation admin can change membership role, organisation or status';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_org_member_self_update() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS guard_org_member_self_update ON public.org_members;
CREATE TRIGGER guard_org_member_self_update
BEFORE UPDATE ON public.org_members
FOR EACH ROW EXECUTE FUNCTION public.guard_org_member_self_update();

-- 2. profiles: billing/referral columns are not user-writable
CREATE OR REPLACE FUNCTION public.guard_profile_billing_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW; -- webhook / service-role writes
  END IF;
  NEW.plan := OLD.plan;
  NEW.free_months_granted := OLD.free_months_granted;
  NEW.referred_by := OLD.referred_by;
  NEW.referral_program := OLD.referral_program;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_profile_billing_columns() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS guard_profile_billing_columns ON public.profiles;
CREATE TRIGGER guard_profile_billing_columns
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.guard_profile_billing_columns();

-- 3. Replace owner-privileged (SECURITY DEFINER) views with invoker views
--    backed by narrow, access-checked definer functions.
CREATE OR REPLACE FUNCTION public.org_presence_rows()
RETURNS TABLE (
  org_id uuid,
  user_id uuid,
  trip_id uuid,
  country_code text,
  entry_date date,
  exit_date date,
  logged_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.org_id, m.user_id, t.id, t.country_code, t.entry_date, t.exit_date, t.created_at
  FROM org_members m
  JOIN trips t ON t.user_id = m.user_id
  WHERE m.status = 'active'
    AND auth.uid() IS NOT NULL
    AND (m.user_id = auth.uid() OR public.is_org_admin(auth.uid(), m.org_id));
$$;
REVOKE ALL ON FUNCTION public.org_presence_rows() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.org_presence_rows() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.org_directory_rows()
RETURNS TABLE (
  org_id uuid,
  user_id uuid,
  member_id uuid,
  invite_email text,
  role text,
  status text,
  joined_at timestamptz,
  display_name text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.org_id, m.user_id, m.id, m.invite_email, m.role, m.status, m.joined_at,
         COALESCE(p.display_name, '')
  FROM org_members m
  LEFT JOIN profiles p ON p.id = m.user_id
  WHERE auth.uid() IS NOT NULL
    AND (m.user_id = auth.uid() OR public.is_org_admin(auth.uid(), m.org_id));
$$;
REVOKE ALL ON FUNCTION public.org_directory_rows() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.org_directory_rows() TO authenticated, service_role;

DROP VIEW IF EXISTS public.org_member_presence;
CREATE VIEW public.org_member_presence WITH (security_invoker = true) AS
  SELECT * FROM public.org_presence_rows();
GRANT SELECT ON public.org_member_presence TO authenticated, service_role;

DROP VIEW IF EXISTS public.org_member_directory;
CREATE VIEW public.org_member_directory WITH (security_invoker = true) AS
  SELECT * FROM public.org_directory_rows();
GRANT SELECT ON public.org_member_directory TO authenticated, service_role;

-- 4. Trim EXECUTE on SECURITY DEFINER helpers that signed-out users never need.
REVOKE EXECUTE ON FUNCTION public.delete_my_radar_data() FROM anon;
REVOKE EXECUTE ON FUNCTION public.blocked_between(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.cell_occupancy(numeric, numeric) FROM anon;
REVOKE EXECUTE ON FUNCTION public.caller_bucket_key() FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_active_subscription(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.enforce_insert_rate_limit() FROM PUBLIC, anon, authenticated;
