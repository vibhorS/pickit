-- Owner-only crew member removal (soft-delete crew_members row).
-- Does not touch auth.users, public.users, lists, ratings, or recommendations.

create or replace function public.is_crew_owner(p_crew_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.crew_members m
    where m.crew_id = p_crew_id
      and m.user_id = auth.uid()
      and m.role = 'owner'
      and m.deleted_at is null
  );
$$;

revoke all on function public.is_crew_owner(uuid) from public;
grant execute on function public.is_crew_owner(uuid) to authenticated;

create or replace function public.remove_crew_member(
  p_crew_id uuid,
  p_target_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  removed_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not public.is_crew_owner(p_crew_id) then
    raise exception 'Only the Crew owner can remove members';
  end if;

  if p_target_user_id = auth.uid() then
    raise exception 'You cannot remove yourself from the Crew';
  end if;

  update public.crew_members
  set
    deleted_at = now(),
    updated_at = now()
  where crew_id = p_crew_id
    and user_id = p_target_user_id
    and deleted_at is null
  returning id into removed_id;

  if removed_id is null then
    raise exception 'Member not found in this Crew';
  end if;
end;
$$;

revoke all on function public.remove_crew_member(uuid, uuid) from public;
grant execute on function public.remove_crew_member(uuid, uuid) to authenticated;
