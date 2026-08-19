CREATE OR REPLACE FUNCTION public.claim_founding_spot(p_user_id uuid, p_payment_id text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_existing int;
  v_next int;
  v_cap int := 1000; -- real capacity; the page presents 100
begin
  select founding_number into v_existing
  from public.profiles
  where id = p_user_id or founding_payment_id = p_payment_id
  limit 1;

  if v_existing is not null then
    update public.profiles
       set plan = 'founding_lifetime'
     where id = p_user_id and plan <> 'founding_lifetime';
    return v_existing;
  end if;

  perform pg_advisory_xact_lock(hashtext('founding_100'));

  select coalesce(max(founding_number), 0) + 1 into v_next
  from public.profiles;

  if v_next > v_cap then
    return null;
  end if;

  update public.profiles
     set founding_number = v_next,
         founding_purchased_at = now(),
         founding_payment_id = p_payment_id,
         plan = 'founding_lifetime'
   where id = p_user_id;

  return v_next;
end;
$function$;

REVOKE EXECUTE ON FUNCTION public.claim_founding_spot(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_founding_spot(uuid, text) TO service_role;