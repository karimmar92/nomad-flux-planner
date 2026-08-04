DO $$ BEGIN
  CREATE TYPE public.radar_visibility AS ENUM ('ghost', 'city', 'radar');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS headline text,
  ADD COLUMN IF NOT EXISTS skills text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS looking_for text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS availability text NOT NULL DEFAULT 'available',
  ADD COLUMN IF NOT EXISTS bio text,
  ADD COLUMN IF NOT EXISTS links jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS timezone text,
  ADD COLUMN IF NOT EXISTS visibility public.radar_visibility NOT NULL DEFAULT 'ghost',
  ADD COLUMN IF NOT EXISTS cell_lat numeric(6,3),
  ADD COLUMN IF NOT EXISTS cell_lng numeric(7,3),
  ADD COLUMN IF NOT EXISTS last_active_at timestamptz,
  ADD COLUMN IF NOT EXISTS radar_city_id text;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_bio_len,
  DROP CONSTRAINT IF EXISTS profiles_availability_check,
  DROP CONSTRAINT IF EXISTS profiles_looking_for_check,
  DROP CONSTRAINT IF EXISTS profiles_cell_snapped;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_bio_len CHECK (bio IS NULL OR char_length(bio) <= 300),
  ADD CONSTRAINT profiles_availability_check
    CHECK (availability IN ('available', 'limited', 'booked')),
  ADD CONSTRAINT profiles_looking_for_check
    CHECK (looking_for <@ ARRAY['cofounder','contract_work','hiring','collaborators','coffee']::text[]),
  ADD CONSTRAINT profiles_cell_snapped CHECK (
    (cell_lat IS NULL AND cell_lng IS NULL) OR (
      cell_lat IS NOT NULL AND cell_lng IS NOT NULL
      AND (cell_lat * 1000)::numeric % 5 = 0
      AND (cell_lng * 1000)::numeric % 5 = 0
    )
  );

CREATE TABLE IF NOT EXISTS public.blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);
GRANT SELECT, INSERT, DELETE ON public.blocks TO authenticated;
GRANT ALL ON public.blocks TO service_role;
ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Blockers manage their own blocks" ON public.blocks;
CREATE POLICY "Blockers manage their own blocks"
  ON public.blocks FOR ALL TO authenticated
  USING (auth.uid() = blocker_id) WITH CHECK (auth.uid() = blocker_id);

CREATE OR REPLACE FUNCTION public.blocked_between(_a uuid, _b uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.blocks
    WHERE (blocker_id = _a AND blocked_id = _b)
       OR (blocker_id = _b AND blocked_id = _a)
  )
$$;

CREATE OR REPLACE FUNCTION public.cell_occupancy(_lat numeric, _lng numeric)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT count(*)::int FROM public.profiles p
  WHERE p.cell_lat = _lat AND p.cell_lng = _lng
    AND p.visibility <> 'ghost'
    AND p.last_active_at > now() - interval '7 days'
$$;

REVOKE ALL ON FUNCTION public.blocked_between(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cell_occupancy(numeric, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.blocked_between(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cell_occupancy(numeric, numeric) TO authenticated;

DROP POLICY IF EXISTS "Visible radar profiles" ON public.profiles;
CREATE POLICY "Visible radar profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (
    auth.uid() <> id
    AND visibility <> 'ghost'
    AND last_active_at IS NOT NULL
    AND last_active_at > now() - interval '7 days'
    AND NOT public.blocked_between(auth.uid(), id)
  );

CREATE OR REPLACE VIEW public.radar_profiles
WITH (security_invoker = true) AS
SELECT
  p.id, p.display_name, p.avatar_url, p.headline, p.skills, p.looking_for,
  p.availability, p.bio, p.links, p.timezone, p.radar_city_id,
  date_trunc('hour', p.last_active_at) AS last_active_at,
  CASE WHEN p.visibility = 'radar' AND public.cell_occupancy(p.cell_lat, p.cell_lng) >= 5
       THEN p.cell_lat END AS cell_lat,
  CASE WHEN p.visibility = 'radar' AND public.cell_occupancy(p.cell_lat, p.cell_lng) >= 5
       THEN p.cell_lng END AS cell_lng
FROM public.profiles p;
GRANT SELECT ON public.radar_profiles TO authenticated;

DO $$ BEGIN
  CREATE TYPE public.connection_status AS ENUM ('pending', 'accepted', 'declined');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status public.connection_status NOT NULL DEFAULT 'pending',
  intro_note text NOT NULL CHECK (char_length(intro_note) BETWEEN 1 AND 200),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (requester_id, recipient_id),
  CHECK (requester_id <> recipient_id)
);
GRANT SELECT, INSERT, UPDATE ON public.connections TO authenticated;
GRANT ALL ON public.connections TO service_role;
ALTER TABLE public.connections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Parties read their connections" ON public.connections;
CREATE POLICY "Parties read their connections"
  ON public.connections FOR SELECT TO authenticated
  USING (auth.uid() IN (requester_id, recipient_id));
DROP POLICY IF EXISTS "Send intro requests" ON public.connections;
CREATE POLICY "Send intro requests"
  ON public.connections FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = requester_id AND status = 'pending'
    AND NOT public.blocked_between(auth.uid(), recipient_id)
  );
DROP POLICY IF EXISTS "Recipient responds" ON public.connections;
CREATE POLICY "Recipient responds"
  ON public.connections FOR UPDATE TO authenticated
  USING (auth.uid() = recipient_id)
  WITH CHECK (auth.uid() = recipient_id AND status IN ('accepted', 'declined'));

CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid NOT NULL REFERENCES public.connections(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 4000),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Parties read accepted-thread messages" ON public.messages;
CREATE POLICY "Parties read accepted-thread messages"
  ON public.messages FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.connections c
    WHERE c.id = connection_id AND c.status = 'accepted'
      AND auth.uid() IN (c.requester_id, c.recipient_id)
  ));
DROP POLICY IF EXISTS "Parties write accepted-thread messages" ON public.messages;
CREATE POLICY "Parties write accepted-thread messages"
  ON public.messages FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = sender_id AND EXISTS (
      SELECT 1 FROM public.connections c
      WHERE c.id = connection_id AND c.status = 'accepted'
        AND auth.uid() IN (c.requester_id, c.recipient_id)
        AND NOT public.blocked_between(c.requester_id, c.recipient_id)
    )
  );

DO $$ BEGIN
  CREATE TYPE public.report_reason AS ENUM (
    'spam', 'harassment', 'romantic_advance', 'impersonation', 'safety_concern', 'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reported_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason public.report_reason NOT NULL,
  detail text CHECK (detail IS NULL OR char_length(detail) <= 1000),
  created_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewing', 'closed')),
  CHECK (reporter_id <> reported_id)
);
GRANT SELECT, INSERT ON public.reports TO authenticated;
GRANT ALL ON public.reports TO service_role;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Reporters see their own reports" ON public.reports;
CREATE POLICY "Reporters see their own reports"
  ON public.reports FOR SELECT TO authenticated
  USING (auth.uid() = reporter_id);
DROP POLICY IF EXISTS "Anyone signed in can report" ON public.reports;
CREATE POLICY "Anyone signed in can report"
  ON public.reports FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = reporter_id AND status = 'open');

CREATE TABLE IF NOT EXISTS public.radar_waitlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  city_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (email, city_id)
);
GRANT INSERT ON public.radar_waitlist TO anon, authenticated;
GRANT ALL ON public.radar_waitlist TO service_role;
ALTER TABLE public.radar_waitlist ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can join the radar waitlist" ON public.radar_waitlist;
CREATE POLICY "Anyone can join the radar waitlist"
  ON public.radar_waitlist FOR INSERT TO anon, authenticated
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.delete_my_radar_data()
RETURNS void LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.profiles
     SET cell_lat = NULL, cell_lng = NULL, last_active_at = NULL,
         radar_city_id = NULL, visibility = 'ghost'
   WHERE id = auth.uid();
  DELETE FROM public.connections
   WHERE auth.uid() IN (requester_id, recipient_id);
$$;
REVOKE ALL ON FUNCTION public.delete_my_radar_data() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_my_radar_data() TO authenticated;

CREATE TABLE IF NOT EXISTS public.partner_clicks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  partner_id text NOT NULL,
  placement text NOT NULL CHECK (placement IN ('city_detail', 'trip_confirm', 'visa_card', 'kit_page', 'border_run', 'onboarding')),
  city_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT ON public.partner_clicks TO anon, authenticated;
GRANT ALL ON public.partner_clicks TO service_role;
ALTER TABLE public.partner_clicks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anyone can log a click" ON public.partner_clicks;
CREATE POLICY "anyone can log a click"
  ON public.partner_clicks FOR INSERT TO anon, authenticated
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());
CREATE INDEX IF NOT EXISTS partner_clicks_placement_idx
  ON public.partner_clicks (placement, created_at desc);