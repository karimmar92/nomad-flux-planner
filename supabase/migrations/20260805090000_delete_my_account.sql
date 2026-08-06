-- Full account deletion.
--
-- Required by GDPR Article 17 (right to erasure) — binding on us today, since
-- we are an EU business holding passport scans, travel histories and income
-- data. Also required by App Store Review Guideline 5.1.1(v), which obliges any
-- app offering account creation to offer in-app account deletion; that applies
-- once the PWA is wrapped for iOS.
--
-- SAFETY PROPERTIES:
--
--   * The function takes NO arguments and only ever deletes auth.uid(). There
--     is no parameter an attacker could point at another account.
--   * SECURITY DEFINER is required to reach auth.users, so search_path is
--     pinned to defeat search-path hijacking.
--   * EXECUTE is granted to `authenticated` only, never to `anon`.
--
-- Most user-owned tables cascade from auth.users. The explicit deletes below
-- are belt-and-braces for any table whose FK is missing or set to SET NULL —
-- a deletion that silently leaves rows behind is not a deletion, and under
-- GDPR that is the difference between compliance and a false claim.
--
-- Storage objects are removed client-side BEFORE this runs, via the storage
-- API. Deleting a `documents` row does not delete the file it points at.

CREATE OR REPLACE FUNCTION public.delete_my_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Radar and social graph
  DELETE FROM public.messages
   WHERE connection_id IN (
     SELECT id FROM public.connections
      WHERE requester_id = uid OR recipient_id = uid
   );
  DELETE FROM public.connections WHERE requester_id = uid OR recipient_id = uid;
  DELETE FROM public.blocks      WHERE blocker_id = uid OR blocked_id = uid;
  DELETE FROM public.reports     WHERE reporter_id = uid OR reported_id = uid;

  -- The record
  DELETE FROM public.trips     WHERE user_id = uid;
  DELETE FROM public.documents WHERE user_id = uid;

  -- Employer link. The organisation itself is not touched — only this
  -- person's membership and their own travel requests.
  DELETE FROM public.travel_requests WHERE user_id = uid;
  DELETE FROM public.org_members     WHERE user_id = uid;

  -- Referral and creator records.
  --
  -- NOTE: commission_ledger rows are financial records. Deleting them removes
  -- the audit trail for money already paid, which conflicts with accounting
  -- retention obligations that override erasure under GDPR Art. 17(3)(b).
  -- We therefore anonymise rather than delete: the payout history survives,
  -- the person does not.
  UPDATE public.commission_ledger SET referred_user_id = NULL WHERE referred_user_id = uid;
  UPDATE public.commission_ledger SET creator_id       = NULL WHERE creator_id = uid;
  DELETE FROM public.user_referral_rewards  WHERE user_id = uid;
  DELETE FROM public.referral_clicks        WHERE user_id = uid;
  DELETE FROM public.creator_payouts        WHERE creator_id = uid;
  DELETE FROM public.creator_applications   WHERE user_id = uid;
  DELETE FROM public.creators               WHERE user_id = uid;
  DELETE FROM public.fraud_flags            WHERE user_id = uid;

  DELETE FROM public.user_roles WHERE user_id = uid;
  DELETE FROM public.profiles   WHERE id = uid;

  -- Finally the identity itself. Anything still carrying an ON DELETE CASCADE
  -- reference to auth.users goes with it.
  DELETE FROM auth.users WHERE id = uid;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_my_account() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_my_account() TO authenticated;

COMMENT ON FUNCTION public.delete_my_account() IS
  'GDPR Art.17 / App Store 5.1.1(v) erasure. Deletes only auth.uid(). Takes no '
  'arguments by design. Financial ledger rows are anonymised, not deleted, to '
  'preserve accounting records permitted under Art.17(3)(b).';
