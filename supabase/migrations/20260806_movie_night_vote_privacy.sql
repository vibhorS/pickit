-- Harden Movie Night privacy if 20260806_movie_night_live_sessions.sql was already applied.
-- Mid-round votes must not broadcast session updates or participant heartbeats.

create or replace function public.submit_movie_night_vote(
  p_session_id uuid,
  p_movie_id text,
  p_vote text
)
returns public.movie_night_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  session_row public.movie_night_sessions;
  participant_count integer;
  vote_count integer;
  watch_count integer;
  pass_count integer;
  next_index integer;
  next_movie text;
  next_active text[];
  next_maybe text[];
  seed bigint;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if p_vote not in ('watch', 'pass') then
    raise exception 'Invalid vote';
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

  if session_row.state <> 'ROUND_ACTIVE' then
    raise exception 'Voting is not open right now';
  end if;

  if session_row.current_movie_id is distinct from p_movie_id then
    raise exception 'This movie is no longer the active round';
  end if;

  insert into public.movie_night_participants (session_id, user_id)
  values (p_session_id, auth.uid())
  on conflict (session_id, user_id) do nothing;

  insert into public.movie_night_votes (session_id, movie_id, user_id, vote)
  values (p_session_id, p_movie_id, auth.uid(), p_vote)
  on conflict (session_id, movie_id, user_id) do nothing;

  participant_count := public.movie_night_participant_count(p_session_id);
  vote_count := public.movie_night_vote_count(p_session_id, p_movie_id);

  if vote_count < participant_count then
    return session_row;
  end if;

  select
    count(*) filter (where vote = 'watch'),
    count(*) filter (where vote = 'pass')
  into watch_count, pass_count
  from public.movie_night_votes
  where session_id = p_session_id
    and movie_id = p_movie_id;

  if watch_count = participant_count then
    update public.movie_night_sessions
    set
      state = 'WINNER',
      winner_movie_id = p_movie_id,
      last_outcome = 'match',
      last_outcome_movie_id = p_movie_id,
      updated_at = now(),
      completed_at = now()
    where id = p_session_id
    returning * into session_row;
    return session_row;
  end if;

  next_active := session_row.active_movie_ids;
  next_maybe := session_row.maybe_movie_ids;
  next_index := session_row.current_movie_index + 1;

  if pass_count = participant_count then
    null;
  else
    if not (p_movie_id = any (next_maybe)) then
      next_maybe := array_append(next_maybe, p_movie_id);
    end if;
  end if;

  if next_index < coalesce(array_length(next_active, 1), 0) then
    next_movie := next_active[next_index + 1];
    update public.movie_night_sessions
    set
      state = 'ROUND_ACTIVE',
      current_movie_index = next_index,
      current_movie_id = next_movie,
      maybe_movie_ids = next_maybe,
      last_outcome = case
        when pass_count = participant_count then 'all_pass'
        else 'maybe'
      end,
      last_outcome_movie_id = p_movie_id,
      updated_at = now()
    where id = p_session_id
    returning * into session_row;
    return session_row;
  end if;

  if coalesce(array_length(next_maybe, 1), 0) = 0 then
    update public.movie_night_sessions
    set
      state = 'NO_MATCH',
      current_movie_id = null,
      maybe_movie_ids = next_maybe,
      last_outcome = case
        when pass_count = participant_count then 'all_pass'
        else 'maybe'
      end,
      last_outcome_movie_id = p_movie_id,
      updated_at = now(),
      completed_at = now()
    where id = p_session_id
    returning * into session_row;
    return session_row;
  end if;

  seed := (extract(epoch from now()) * 1000)::bigint
    + (random() * 1000000)::bigint;
  next_movie := next_maybe[
    1 + ((abs(seed) % coalesce(array_length(next_maybe, 1), 1)))
  ];

  update public.movie_night_sessions
  set
    state = 'ROULETTE',
    current_movie_id = null,
    maybe_movie_ids = next_maybe,
    winner_movie_id = next_movie,
    roulette_seed = seed,
    roulette_started_at = now(),
    last_outcome = case
      when pass_count = participant_count then 'all_pass'
      else 'maybe'
    end,
    last_outcome_movie_id = p_movie_id,
    updated_at = now()
  where id = p_session_id
  returning * into session_row;

  return session_row;
end;
$$;

-- Drop participants from Realtime if previously added (vote privacy).
do $$
begin
  begin
    alter publication supabase_realtime drop table public.movie_night_participants;
  exception when undefined_object then null;
             when undefined_table then null;
  end;
end;
$$;
