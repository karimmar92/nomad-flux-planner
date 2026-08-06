-- Plans — group meetups in a public venue.
--
-- Design rationale in docs/plans-spec.md. The short version: this app surfaces
-- PLANS, never matches people. A group, in public, organised around an activity
-- is social without being a dating product — and the structure does the safety
-- work that policy would otherwise have to.
--
-- Deliberately absent: any gender column, any photo column, any 1:1 message
-- table. Adding them changes what this product is.

DO $$ BEGIN
  CREATE TYPE public.plan_activity AS ENUM (
    'coffee','lunch','dinner','drinks','coworking','walk','gym','other'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.plan_status AS ENUM ('open','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── plans ───────────────────────────────────────────────────────────────────
--
-- NOTE: there is no 'past' or 'full' status. Both are derived — past from
-- starts_at, full from the attendee count. Storing either would need a cron job
-- to keep them true, and a status column that silently goes stale is worse than
-- one computed on read.

CREATE TABLE IF NOT EXISTS public.plans (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  city_id     text NOT NULL,
  activity    public.plan_activity NOT NULL DEFAULT 'coffee',
  venue_name  text NOT NULL CHECK (char_length(trim(venue_name)) BETWEEN 2 AND 120),
  venue_hint  text CHECK (venue_hint IS NULL OR char_length(venue_hint) <= 120),
  starts_at   timestamptz NOT NULL,
  capacity    int NOT NULL DEFAULT 6 CHECK (capacity BETWEEN 2 AND 10),
  note        text CHECK (note IS NULL OR char_length(note) <= 200),
  status      public.plan_status NOT NULL DEFAULT 'open',
  created_at  timestamptz NOT NULL DEFAULT now(),
  -- Nothing more than 14 days out. Distant plans have poor turnout and a board
  -- full of them reads as stale. Spontaneity is the product.
  CONSTRAINT plans_horizon CHECK (starts_at < created_at + interval '14 days')
);

CREATE INDEX IF NOT EXISTS plans_city_time_idx ON public.plans (city_id, starts_at);

GRANT SELECT, INSERT, UPDATE ON public.plans TO authenticated;
GRANT ALL ON public.plans TO service_role;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

-- Blocking is transitive and enforced in the QUERY, not the UI: if A blocks B,
-- neither sees the other's plans at all.
DROP POLICY IF EXISTS "Signed-in users read unblocked plans" ON public.plans;
CREATE POLICY "Signed-in users read unblocked plans"
  ON public.plans FOR SELECT TO authenticated
  USING (NOT public.blocked_between(auth.uid(), host_id));

DROP POLICY IF EXISTS "Host creates own plans" ON public.plans;
CREATE POLICY "Host creates own plans"
  ON public.plans FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = host_id AND starts_at > now());

DROP POLICY IF EXISTS "Host edits own plans" ON public.plans;
CREATE POLICY "Host edits own plans"
  ON public.plans FOR UPDATE TO authenticated
  USING (auth.uid() = host_id) WITH CHECK (auth.uid() = host_id);

-- ── attendees ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.plan_attendees (
  plan_id   uuid NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  user_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (plan_id, user_id)
);

GRANT SELECT, INSERT, DELETE ON public.plan_attendees TO authenticated;
GRANT ALL ON public.plan_attendees TO service_role;
ALTER TABLE public.plan_attendees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Attendees visible on visible plans" ON public.plan_attendees;
CREATE POLICY "Attendees visible on visible plans"
  ON public.plan_attendees FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.plans p WHERE p.id = plan_id)
    AND NOT public.blocked_between(auth.uid(), user_id)
  );

DROP POLICY IF EXISTS "Join as yourself" ON public.plan_attendees;
CREATE POLICY "Join as yourself"
  ON public.plan_attendees FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Leaving is silent: the row is deleted, the host is not notified. Someone who
-- feels uncomfortable should be able to withdraw without an announcement.
DROP POLICY IF EXISTS "Leave silently" ON public.plan_attendees;
CREATE POLICY "Leave silently"
  ON public.plan_attendees FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- ── capacity, enforced in the database ──────────────────────────────────────
--
-- The UI hides a full plan, but two people tapping Join at the same moment
-- would both pass a client-side check. Capacity has to hold at the row level or
-- it does not hold at all.

CREATE OR REPLACE FUNCTION public.enforce_plan_capacity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cap      int;
  going    int;
  plan_row public.plans%ROWTYPE;
BEGIN
  SELECT * INTO plan_row FROM public.plans WHERE id = NEW.plan_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Plan not found';
  END IF;
  IF plan_row.status <> 'open' THEN
    RAISE EXCEPTION 'This plan is cancelled.' USING ERRCODE = '53400';
  END IF;
  IF plan_row.starts_at <= now() THEN
    RAISE EXCEPTION 'This plan has already started.' USING ERRCODE = '53400';
  END IF;

  cap := plan_row.capacity;
  SELECT count(*) INTO going FROM public.plan_attendees WHERE plan_id = NEW.plan_id;
  IF going >= cap THEN
    RAISE EXCEPTION 'This plan is full.' USING ERRCODE = '53400';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS plan_capacity ON public.plan_attendees;
CREATE TRIGGER plan_capacity
  BEFORE INSERT ON public.plan_attendees
  FOR EACH ROW EXECUTE FUNCTION public.enforce_plan_capacity();

-- The host is always attending their own plan.
CREATE OR REPLACE FUNCTION public.add_host_as_attendee()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.plan_attendees (plan_id, user_id)
  VALUES (NEW.id, NEW.host_id)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS plan_host_attends ON public.plans;
CREATE TRIGGER plan_host_attends
  AFTER INSERT ON public.plans
  FOR EACH ROW EXECUTE FUNCTION public.add_host_as_attendee();

-- Rate limit plan creation — same limiter as the anon tables.
DROP TRIGGER IF EXISTS rl_plans ON public.plans;
CREATE TRIGGER rl_plans
  BEFORE INSERT ON public.plans
  FOR EACH ROW EXECUTE FUNCTION public.enforce_insert_rate_limit('10');
