create or replace function public.claim_founding_spot(p_user_id uuid, p_payment_id text)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing int;
  v_next int;
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

  if v_next > 100 then
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
$$;

revoke all on function public.claim_founding_spot(uuid, text) from public;
grant execute on function public.claim_founding_spot(uuid, text) to service_role;

create or replace function public.keep_founding_members_pro()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.founding_number is not null and new.plan = 'free' then
    new.plan := 'founding_lifetime';
  end if;
  return new;
end;
$$;

update public.profiles
   set plan = 'founding_lifetime'
 where founding_number is not null and plan <> 'founding_lifetime';