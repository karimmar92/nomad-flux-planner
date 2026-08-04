revoke all on function public.is_org_admin(uuid, uuid) from public, anon;
revoke all on function public.is_org_member(uuid, uuid) from public, anon;
grant execute on function public.is_org_admin(uuid, uuid) to authenticated, service_role;
grant execute on function public.is_org_member(uuid, uuid) to authenticated, service_role;

revoke all on public.org_member_presence from anon;
revoke all on public.org_member_directory from anon;