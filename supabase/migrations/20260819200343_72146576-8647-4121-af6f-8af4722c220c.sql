CREATE TABLE public.analytics_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event text NOT NULL CHECK (event IN ('trial_start','paywall_intent','soft_gate_upsell','hard_gate_block','waitlist_signup')),
  feature text,
  reason text,
  plan text,
  checks_left integer,
  session_id text,
  user_id uuid,
  props jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX analytics_events_event_created_idx ON public.analytics_events (event, created_at DESC);
CREATE INDEX analytics_events_session_idx ON public.analytics_events (session_id, created_at DESC);

GRANT INSERT ON public.analytics_events TO anon;
GRANT INSERT ON public.analytics_events TO authenticated;
GRANT ALL ON public.analytics_events TO service_role;

ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can record a funnel event" ON public.analytics_events
  FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "Admins can read funnel events" ON public.analytics_events
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

GRANT SELECT ON public.analytics_events TO authenticated;

CREATE TRIGGER rl_analytics_events
  BEFORE INSERT ON public.analytics_events
  FOR EACH ROW EXECUTE FUNCTION public.enforce_insert_rate_limit('120');