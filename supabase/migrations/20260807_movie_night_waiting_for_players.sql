-- Restore synchronized entry: WAITING_FOR_PLAYERS until all crew members join,
-- then server advances to ROUND_ACTIVE so every client enters Movie 1 together.
-- Does not change vote privacy or end/cleanup semantics.

-- =========================
-- start_movie_night → WAITING_FOR_PLAYERS (host only as participant)
-- =========================

create or replace function public.start_movie_night(
  p_crew_id uuid,
  p_list_id text,
  p_movie_ids text[]
)
returns public.movie_night_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  session_row public.movie_night_sessions;
  first_movie text;
  crew_count integer;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not public.is_crew_member(p_crew_id) then
    raise exception 'Not a crew member';
  end if;

  if p_movie_ids is null or coalesce(array_length(p_movie_ids, 1), 0) = 0 then
    raise exception 'Movie Night needs at least one movie';
  end if;

  update public.movie_night_sessions
  set
    state = 'COMPLETE',
    completed_at = coalesce(completed_at, now()),
    updated_at = now()
  where crew_id = p_crew_id
    and deleted_at is null
    and state <> 'COMPLETE';

  first_movie := p_movie_ids[1];

  insert into public.movie_night_sessions (
    crew_id,
    list_id,
    host_user_id,
    state,
    current_movie_index,
    current_movie_id,
    active_movie_ids,
    maybe_movie_ids,
    started_at,
    updated_at
  )
  values (
    p_crew_id,
    p_list_id,
    auth.uid(),
    'WAITING_FOR_PLAYERS',
    0,
    first_movie,
    p_movie_ids,
    '{}',
    now(),
    now()
  )
  returning * into session_row;

  -- Host is present; other crew members join via present_movie_night / get_active.
  insert into public.movie_night_participants (session_id, user_id)
  values (session_row.id, auth.uid())
  on conflict (session_id, user_id) do update
    set last_seen_at = now();

  select count(*)::integer into crew_count
  from public.crew_members m
  where m.crew_id = p_crew_id
    and m.deleted_at is null;

  -- Solo crew can begin immediately.
  if crew_count <= 1 then
    update public.movie_night_sessions
    set
      state = 'ROUND_ACTIVE',
      updated_at = now()
    where id = session_row.id
    returning * into session_row;
  end if;

  return session_row;
end;
$$;

revoke all on function public.start_movie_night(uuid, text, text[]) from public;
grant execute on function public.start_movie_night(uuid, text, text[]) to authenticated;

-- =========================
-- present_movie_night — join + begin when full crew is connected
-- =========================

create or replace function public.present_movie_night(p_session_id uuid)
returns public.movie_night_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  session_row public.movie_night_sessions;
  crew_count integer;
  joined_count integer;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select * into session_row
  from public.movie_night_sessions
  where id = p_session_id
    and deleted_at is null
  for update;

  if session_row.id is null then
    raise exception 'Session not found';
  end if;

  if not public.is_crew_member(session_row.crew_id) then
    raise exception 'Not a crew member';
  end if;

  insert into public.movie_night_participants (session_id, user_id)
  values (p_session_id, auth.uid())
  on conflict (session_id, user_id) do update
    set last_seen_at = now();

  if session_row.state <> 'WAITING_FOR_PLAYERS' then
    select * into session_row
    from public.movie_night_sessions
    where id = p_session_id;
    return session_row;
  end if;

  select count(*)::integer into crew_count
  from public.crew_members m
  where m.crew_id = session_row.crew_id
    and m.deleted_at is null;

  select count(*)::integer into joined_count
  from public.movie_night_participants p
  where p.session_id = p_session_id;

  if joined_count >= greatest(crew_count, 1) then
    update public.movie_night_sessions
    set
      state = 'ROUND_ACTIVE',
      updated_at = now()
    where id = p_session_id
    returning * into session_row;
  else
    select * into session_row
    from public.movie_night_sessions
    where id = p_session_id;
  end if;

  return session_row;
end;
$$;

revoke all on function public.present_movie_night(uuid) from public;
grant execute on function public.present_movie_night(uuid) to authenticated;

-- get_active also marks presence and may begin the round.
create or replace function public.get_active_movie_night(p_crew_id uuid)
returns public.movie_night_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  session_row public.movie_night_sessions;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not public.is_crew_member(p_crew_id) then
    raise exception 'Not a crew member';
  end if;

  select * into session_row
  from public.movie_night_sessions s
  where s.crew_id = p_crew_id
    and s.deleted_at is null
    and s.state in (
      'WAITING_FOR_PLAYERS',
      'ROUND_ACTIVE',
      'ROUND_RESOLVED',
      'NEXT_MOVIE',
      'ROULETTE'
    )
  order by s.started_at desc
  limit 1;

  if session_row.id is null then
    return null;
  end if;

  return public.present_movie_night(session_row.id);
end;
$$;

revoke all on function public.get_active_movie_night(uuid) from public;
grant execute on function public.get_active_movie_night(uuid) to authenticated;
