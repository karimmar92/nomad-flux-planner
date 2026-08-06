-- Rate limiting for anonymously-insertable tables.
--
-- THE PROBLEM: `waitlist`, `radar_waitlist` and `partner_clicks` all grant
-- INSERT to `anon` with WITH CHECK (true). The anon key is public by design —
-- it ships in the browser — so anyone can POST to those endpoints in a loop and
-- fill the database. On the free tier that is 500 MB until the project stops
-- accepting writes; on Pro it is an unbounded bill.
--
-- Client-side throttling does nothing here: an attacker never runs our
-- JavaScript. Enforcement has to be in the database.
--
-- PRIVACY: we rate limit on a SALTED HASH of the caller's IP, never the IP
-- itself. Raw IPs are personal data under GDPR and would need their own lawful
-- basis, disclosure and retention policy. A hash with a server-side salt gives
-- the same abuse protection without holding an identifier, and buckets expire
-- after an hour.

-- digest() lives in pgcrypto. Supabase ships it but it is not always enabled.
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- ── Bucket table ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.rate_limit_buckets (
  bucket_key  text        NOT NULL,
  window_start timestamptz NOT NULL,
  hits        integer     NOT NULL DEFAULT 1,
  PRIMARY KEY (bucket_key, window_start)
);

-- Never readable or writable from the client. Only the trigger touches it.
ALTER TABLE public.rate_limit_buckets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.rate_limit_buckets FROM anon, authenticated;
GRANT ALL ON public.rate_limit_buckets TO service_role;

CREATE INDEX IF NOT EXISTS rate_limit_buckets_window_idx
  ON public.rate_limit_buckets (window_start);

-- ── Caller fingerprint ──────────────────────────────────────────────────────

/**
 * A stable, non-identifying key for the caller.
 *
 * Prefers the authenticated user id. Falls back to a salted hash of the
 * forwarded IP for anonymous callers. Returns 'unknown' when neither is
 * available, which buckets all such callers together — deliberately strict, so
 * a missing header cannot be used to bypass the limit.
 */
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

  -- Salted so the hash cannot be reversed by trying candidate IPs.
  -- Replace 'driftly-rl' with a secret in Vault before this carries real load.
  RETURN 'ip:' || encode(extensions.digest(ip || 'driftly-rl', 'sha256'), 'hex');
END;
$$;

-- ── The limiter ─────────────────────────────────────────────────────────────

/**
 * BEFORE INSERT trigger. Rejects once a caller exceeds N inserts per minute on
 * a given table.
 *
 * Limits are per table, passed as a trigger argument, and are set generously —
 * they exist to stop scripted flooding, not to inconvenience a real person who
 * clicks two partner links in a row.
 */
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

  -- Opportunistic cleanup: ~1 call in 100 clears anything over an hour old,
  -- so the table stays small without needing a scheduled job.
  IF random() < 0.01 THEN
    DELETE FROM public.rate_limit_buckets WHERE window_start < now() - interval '1 hour';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_insert_rate_limit() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.caller_bucket_key() FROM PUBLIC;

-- ── Apply ───────────────────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS rl_waitlist ON public.waitlist;
CREATE TRIGGER rl_waitlist
  BEFORE INSERT ON public.waitlist
  FOR EACH ROW EXECUTE FUNCTION public.enforce_insert_rate_limit('5');

DROP TRIGGER IF EXISTS rl_radar_waitlist ON public.radar_waitlist;
CREATE TRIGGER rl_radar_waitlist
  BEFORE INSERT ON public.radar_waitlist
  FOR EACH ROW EXECUTE FUNCTION public.enforce_insert_rate_limit('5');

-- partner_clicks currently has no writer — clicks are held in localStorage and
-- the table is unused. The trigger and index below are applied anyway so that
-- whoever wires the server-side write later inherits the protection instead of
-- having to remember it. An unused table with anon INSERT granted is still an
-- open endpoint.
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

-- ── Bound partner_clicks independently of rate limiting ─────────────────────
--
-- Rate limiting caps the rate; it does not cap the total. partner_clicks has no
-- uniqueness at all, so a patient script could still add rows indefinitely at
-- 30/min. One row per user, partner, placement and day is all the measurement
-- needs — we care which placements earn, not how many times someone clicked.

-- NOTE: click_day is a plain column with a DEFAULT, not a generated column.
-- `GENERATED ALWAYS AS ((created_at AT TIME ZONE 'UTC')::date) STORED` looks
-- cleaner but does not apply: timezone() is marked STABLE rather than IMMUTABLE
-- (timezone definitions can change), and both generated columns and index
-- expressions require IMMUTABLE. Postgres rejects it with
-- "generation expression is not immutable". Column defaults have no such
-- restriction, so the value is set on insert instead.

ALTER TABLE public.partner_clicks
  ADD COLUMN IF NOT EXISTS click_day date NOT NULL DEFAULT ((now() AT TIME ZONE 'UTC')::date);

CREATE UNIQUE INDEX IF NOT EXISTS partner_clicks_daily_unique
  ON public.partner_clicks (user_id, partner_id, placement, click_day)
  WHERE user_id IS NOT NULL;
