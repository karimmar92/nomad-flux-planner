-- RLS audit finding: profiles leaked every column to other users.
--
-- "Visible radar profiles" granted SELECT on public.profiles to any
-- authenticated user for any non-ghost, recently-active profile. RLS is
-- ROW-level, not column-level, so that policy exposed the whole row:
-- referral_code, plan, heard_about, referred_by, free_months_granted and the
-- RAW cell_lat/cell_lng.
--
-- The radar_profiles view masked coordinates behind a k-anonymity floor, but a
-- client can query the TABLE directly through PostgREST and bypass the view
-- entirely. Confirmed in a live rollback test: a signed-in user read another
-- user's referral_code ("SECRET99"), plan, heard_about note and unmasked
-- coordinates.
--
-- Impact if shipped: referral-code theft (commission fraud), plan enumeration,
-- and location disclosure below the k-anonymity threshold the radar promises.
--
-- Nothing consumes this policy today — the radar still reads mock data in
-- src/lib/radar-peers.ts — so removing it breaks no current feature.

DROP POLICY IF EXISTS "Visible radar profiles" ON public.profiles;

-- Replacement for when the radar goes live. Column exposure is fixed by the
-- SELECT list rather than by a policy, so a client cannot widen it. Every
-- visibility condition from the old policy is re-applied inside, and the
-- k-anonymity floor is enforced here rather than in a bypassable view.
CREATE OR REPLACE FUNCTION public.radar_peers()
RETURNS TABLE (
  id uuid, display_name text, avatar_url text, headline text, skills text[],
  looking_for text[], availability text, bio text, links jsonb, timezone text,
  radar_city_id text, last_active_at timestamptz, cell_lat numeric, cell_lng numeric
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.display_name, p.avatar_url, p.headline, p.skills::text[],
         p.looking_for::text[], p.availability::text, p.bio, p.links, p.timezone,
         p.radar_city_id, date_trunc('hour', p.last_active_at),
         CASE WHEN public.cell_occupancy(p.cell_lat, p.cell_lng) >= 5 THEN p.cell_lat END,
         CASE WHEN public.cell_occupancy(p.cell_lat, p.cell_lng) >= 5 THEN p.cell_lng END
  FROM public.profiles p
  WHERE auth.uid() IS NOT NULL
    AND p.id <> auth.uid()
    AND p.visibility <> 'ghost'
    AND p.last_active_at IS NOT NULL
    AND p.last_active_at > now() - interval '7 days'
    AND NOT public.blocked_between(auth.uid(), p.id);
$$;
REVOKE ALL ON FUNCTION public.radar_peers() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.radar_peers() TO authenticated;

-- NOTE for the radar build: read peers via `supabase.rpc("radar_peers")`.
-- Do NOT restore a broad SELECT policy on public.profiles.
