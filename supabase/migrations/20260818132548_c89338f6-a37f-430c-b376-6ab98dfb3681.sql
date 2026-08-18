
-- Guard billing-controlled columns on organisations against client tampering.
CREATE OR REPLACE FUNCTION public.guard_organisation_billing_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Trusted server-side callers (service_role) may set anything.
  IF current_setting('request.jwt.claims', true) IS NULL
     OR coalesce((current_setting('request.jwt.claims', true)::jsonb ->> 'role'), '') = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.plan := 'unpaid';
    NEW.seats_purchased := 10;
    RETURN NEW;
  END IF;

  NEW.plan := OLD.plan;
  NEW.seats_purchased := OLD.seats_purchased;
  NEW.billing_email := OLD.billing_email;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_organisation_billing_columns ON public.organisations;
CREATE TRIGGER guard_organisation_billing_columns
BEFORE INSERT OR UPDATE ON public.organisations
FOR EACH ROW EXECUTE FUNCTION public.guard_organisation_billing_columns();

REVOKE EXECUTE ON FUNCTION public.guard_organisation_billing_columns() FROM anon, authenticated, public;
