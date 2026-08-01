-- Allow crew mates to read each other's profiles for collaboration UI.
-- Without this, listMemberProfiles only returns the caller's own row (users_select_own),
-- so other members render as generic "Member".

create or replace function public.shares_crew_with(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.crew_members me
    join public.crew_members them
      on them.crew_id = me.crew_id
     and them.deleted_at is null
     and them.user_id = p_user_id
    where me.user_id = auth.uid()
      and me.deleted_at is null
  );
$$;

revoke all on function public.shares_crew_with(uuid) from public;
grant execute on function public.shares_crew_with(uuid) to authenticated;

drop policy if exists users_select_crew_mates on public.users;
create policy users_select_crew_mates on public.users
  for select using (
    deleted_at is null
    and public.shares_crew_with(id)
  );
