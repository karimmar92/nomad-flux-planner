CREATE TABLE public.waitlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  feature text NOT NULL CHECK (feature IN ('community','stays','radar_city','b2b','recruiter')),
  city_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (email, feature, city_id)
);

GRANT INSERT ON public.waitlist TO anon;
GRANT INSERT ON public.waitlist TO authenticated;
GRANT ALL ON public.waitlist TO service_role;

ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can join the waitlist" ON public.waitlist
  FOR INSERT TO anon, authenticated WITH CHECK (true);