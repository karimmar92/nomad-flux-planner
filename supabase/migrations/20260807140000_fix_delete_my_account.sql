-- Corrects delete_my_account().
--
-- WHAT WAS WRONG: the first version was written against an assumed schema
-- rather than the real one. plpgsql does not validate function bodies at
-- creation, so it compiled cleanly and would have thrown on the first genuine
-- deletion request — the worst possible time. Specifically it referenced
-- user_referral_rewards.user_id, referral_clicks.user_id and
-- fraud_flags.user_id, none of which exist, and set commission_ledger.creator_id
-- to NULL on a NOT NULL column.
--
-- Actual columns, verified against the generated types:
--   user_referral_rewards  referrer_id (NOT NULL), referred_user_id (NOT NULL)
--   referral_clicks        code, created_at, id, landing_path, program
--                          -> no user column at all; clicks are anonymous and
--                             there is nothing per-user to erase
--   fraud_flags            creator_id (NULL-able), referred_user_id (NULL-able)
--   commission_ledger      creator_id (NOT NULL, -> creators.id),
--                          referred_user_id (NULL-able)
--   creators               user_id (NOT NULL, -> auth.users)
--
-- THE RETENTION CONFLICT, AND WHY THE LEDGER IS NOW DELETED:
--
-- The original intent was to keep commission_ledger rows and anonymise them,
-- because GDPR Art. 17(3)(b) permits retaining records needed for accounting.
-- That is impossible against this schema: creator_id is NOT NULL and points at
-- creators.id, whose user_id is NOT NULL and points at auth.users. The chain
-- forces the ledger to go when the account goes.
--
-- Rather than fake it, the ledger rows are deleted and the UI claim has been
-- removed to match. There are currently no creators and no payouts, so nothing
-- of accounting value is lost.
--
-- WHEN REAL PAYOUTS EXIST, this needs revisiting properly: decouple the ledger
-- from creators (store a payout reference and amount rather than an FK to a
-- person), so financial history can outlive the account. Do that BEFORE the
-- first creator is paid, not after.

CREATE OR REPLACE FUNCTION public.delete_my_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  uid        uuid := auth.uid();
  creator_row uuid;
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

  -- Employer link. The organisation itself is untouched.
  DELETE FROM public.travel_requests WHERE user_id = uid;
  DELETE FROM public.org_members     WHERE user_id = uid;

  -- Where this person was the REFERRED party, not the creator. Both of these
  -- columns are nullable, so the counterparty's record survives without
  -- identifying anyone.
  UPDATE public.commission_ledger SET referred_user_id = NULL WHERE referred_user_id = uid;
  UPDATE public.fraud_flags       SET referred_user_id = NULL WHERE referred_user_id = uid;

  -- referrer_id and referred_user_id are both NOT NULL here, so a reward row
  -- cannot be anonymised — it goes.
  DELETE FROM public.user_referral_rewards
   WHERE referrer_id = uid OR referred_user_id = uid;

  -- referral_clicks has no user column. Nothing to erase.

  -- The creator chain, children first.
  SELECT id INTO creator_row FROM public.creators WHERE user_id = uid;
  IF creator_row IS NOT NULL THEN
    DELETE FROM public.commission_ledger WHERE creator_id = creator_row;
    DELETE FROM public.creator_payouts   WHERE creator_id = creator_row;
    DELETE FROM public.fraud_flags       WHERE creator_id = creator_row;
    DELETE FROM public.creators          WHERE id = creator_row;
  END IF;

  DELETE FROM public.creator_applications WHERE user_id = uid;
  DELETE FROM public.user_roles           WHERE user_id = uid;
  DELETE FROM public.profiles             WHERE id = uid;

  -- Finally the identity. Anything still holding an ON DELETE CASCADE
  -- reference to auth.users goes with it.
  DELETE FROM auth.users WHERE id = uid;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_my_account() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_my_account() TO authenticated;

COMMENT ON FUNCTION public.delete_my_account() IS
  'GDPR Art.17 / App Store 5.1.1(v) erasure. Deletes only auth.uid(); takes no '
  'arguments by design. Column names verified against the live schema — the '
  'first version referenced columns that did not exist and would have thrown '
  'at runtime.';
