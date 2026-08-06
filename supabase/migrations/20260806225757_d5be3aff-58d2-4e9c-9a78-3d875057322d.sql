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

  DELETE FROM public.messages
   WHERE connection_id IN (
     SELECT id FROM public.connections
      WHERE requester_id = uid OR recipient_id = uid
   );
  DELETE FROM public.connections WHERE requester_id = uid OR recipient_id = uid;
  DELETE FROM public.blocks      WHERE blocker_id = uid OR blocked_id = uid;
  DELETE FROM public.reports     WHERE reporter_id = uid OR reported_id = uid;

  DELETE FROM public.trips     WHERE user_id = uid;
  DELETE FROM public.documents WHERE user_id = uid;

  DELETE FROM public.travel_requests WHERE user_id = uid;
  DELETE FROM public.org_members     WHERE user_id = uid;

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

  DELETE FROM auth.users WHERE id = uid;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_my_account() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_my_account() TO authenticated;

COMMENT ON FUNCTION public.delete_my_account() IS
  'GDPR Art.17 / App Store 5.1.1(v) erasure. Deletes only auth.uid(). Takes no '
  'arguments by design. Financial ledger rows are anonymised, not deleted, to '
  'preserve accounting records permitted under Art.17(3)(b).';