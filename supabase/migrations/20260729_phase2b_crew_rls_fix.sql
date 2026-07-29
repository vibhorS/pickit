-- Crew rename + RLS update that actually persists.
-- Safe to re-run in Supabase SQL editor.

create or replace function public.is_crew_member(p_crew_id uuid)
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
      and m.deleted_at is null
  );
$$;

create or replace function public.is_crew_admin(p_crew_id uuid)
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
      and m.role in ('owner', 'admin')
      and m.deleted_at is null
  );
$$;

-- Security-definer rename so owners can update even when UPDATE RLS is misconfigured.
create or replace function public.rename_crew(p_crew_id uuid, p_name text)
returns public.crews
language plpgsql
security definer
set search_path = public
as $$
declare
  updated public.crews;
  next_name text := nullif(trim(p_name), '');
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if next_name is null then
    raise exception 'Crew name is required';
  end if;

  if not (
    public.is_crew_admin(p_crew_id)
    or exists (
      select 1 from public.crews c
      where c.id = p_crew_id
        and c.created_by = auth.uid()
        and c.deleted_at is null
    )
  ) then
    raise exception 'Only the Crew owner can rename the Crew';
  end if;

  update public.crews
  set
    name = next_name,
    updated_by = auth.uid(),
    updated_at = now()
  where id = p_crew_id
    and deleted_at is null
  returning * into updated;

  if updated.id is null then
    raise exception 'Crew not found';
  end if;

  return updated;
end;
$$;

revoke all on function public.rename_crew(uuid, text) from public;
grant execute on function public.rename_crew(uuid, text) to authenticated;

drop policy if exists crews_member_select on public.crews;
create policy crews_member_select on public.crews
  for select using (
    deleted_at is null
    and (
      public.is_crew_member(id)
      or created_by = auth.uid()
    )
  );

drop policy if exists crews_owner_update on public.crews;
create policy crews_owner_update on public.crews
  for update using (
    public.is_crew_admin(id)
    or created_by = auth.uid()
  )
  with check (
    public.is_crew_admin(id)
    or created_by = auth.uid()
  );

drop policy if exists crew_members_select on public.crew_members;
drop policy if exists crew_members_owner_manage on public.crew_members;
drop policy if exists crew_members_insert on public.crew_members;
drop policy if exists crew_members_update on public.crew_members;
drop policy if exists crew_members_delete on public.crew_members;

create policy crew_members_select on public.crew_members
  for select using (
    user_id = auth.uid()
    or public.is_crew_member(crew_id)
  );

create policy crew_members_insert on public.crew_members
  for insert with check (
    user_id = auth.uid()
    or public.is_crew_admin(crew_id)
  );

create policy crew_members_update on public.crew_members
  for update using (
    user_id = auth.uid()
    or public.is_crew_admin(crew_id)
  );

create policy crew_members_delete on public.crew_members
  for delete using (
    user_id = auth.uid()
    or public.is_crew_admin(crew_id)
  );
