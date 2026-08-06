-- Rate limiting for anonymously-insertable tables.
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE TABLE IF NOT EXISTS public.rate_limit_buckets (
  bucket_key  text        NOT NULL,
  window_start timestamptz NOT NULL,
  hits        integer     NOT NULL DEFAULT 1,
  PRIMARY KEY (bucket_key, window_start)
);

ALTER TABLE public.rate_limit_buckets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.rate_limit_buckets FROM anon, authenticated;
GRANT ALL ON public.rate_limit_buckets TO service_role;

CREATE INDEX IF NOT EXISTS rate_limit_buckets_window_idx
  ON public.rate_limit_buckets (window_start);

CREATE OR REPLACE FUNCTION public.caller_bucket_key()
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  ip  text;
BEGIN
  IF uid IS NOT NULL THEN
    RETURN 'u:' || uid::text;
  END IF;

  BEGIN
    ip := split_part(
      coalesce(current_setting('request.headers', true)::json ->> 'x-forwarded-for', ''),
      ',', 1
    );
  EXCEPTION WHEN OTHERS THEN
    ip := '';
  END;

  IF ip = '' THEN
    RETURN 'unknown';
  END IF;

  RETURN 'ip:' || encode(extensions.digest(ip || 'driftly-rl', 'sha256'), 'hex');
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_insert_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  max_per_minute integer := coalesce(TG_ARGV[0]::integer, 30);
  key    text := TG_TABLE_NAME || ':' || public.caller_bucket_key();
  win    timestamptz := date_trunc('minute', now());
  current_hits integer;
BEGIN
  INSERT INTO public.rate_limit_buckets (bucket_key, window_start, hits)
  VALUES (key, win, 1)
  ON CONFLICT (bucket_key, window_start)
  DO UPDATE SET hits = public.rate_limit_buckets.hits + 1
  RETURNING hits INTO current_hits;

  IF current_hits > max_per_minute THEN
    RAISE EXCEPTION 'Rate limit exceeded. Try again in a minute.'
      USING ERRCODE = '53400';
  END IF;

  IF random() < 0.01 THEN
    DELETE FROM public.rate_limit_buckets WHERE window_start < now() - interval '1 hour';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_insert_rate_limit() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.caller_bucket_key() FROM PUBLIC;

DROP TRIGGER IF EXISTS rl_waitlist ON public.waitlist;
CREATE TRIGGER rl_waitlist
  BEFORE INSERT ON public.waitlist
  FOR EACH ROW EXECUTE FUNCTION public.enforce_insert_rate_limit('5');

DROP TRIGGER IF EXISTS rl_radar_waitlist ON public.radar_waitlist;
CREATE TRIGGER rl_radar_waitlist
  BEFORE INSERT ON public.radar_waitlist
  FOR EACH ROW EXECUTE FUNCTION public.enforce_insert_rate_limit('5');

DROP TRIGGER IF EXISTS rl_partner_clicks ON public.partner_clicks;
CREATE TRIGGER rl_partner_clicks
  BEFORE INSERT ON public.partner_clicks
  FOR EACH ROW EXECUTE FUNCTION public.enforce_insert_rate_limit('30');

DROP TRIGGER IF EXISTS rl_reports ON public.reports;
CREATE TRIGGER rl_reports
  BEFORE INSERT ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.enforce_insert_rate_limit('10');

DROP TRIGGER IF EXISTS rl_connections ON public.connections;
CREATE TRIGGER rl_connections
  BEFORE INSERT ON public.connections
  FOR EACH ROW EXECUTE FUNCTION public.enforce_insert_rate_limit('10');

ALTER TABLE public.partner_clicks
  ADD COLUMN IF NOT EXISTS click_day date NOT NULL DEFAULT ((now() AT TIME ZONE 'UTC')::date);

CREATE UNIQUE INDEX IF NOT EXISTS partner_clicks_daily_unique
  ON public.partner_clicks (user_id, partner_id, placement, click_day)
  WHERE user_id IS NOT NULL;