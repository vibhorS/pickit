-- Synchronized multiplayer Movie Night
-- Server-authoritative sessions; votes private per user; crew-readable session state.

-- =========================
-- Tables
-- =========================

create table if not exists public.movie_night_sessions (
  id uuid primary key default gen_random_uuid(),
  crew_id uuid not null references public.crews (id) on delete cascade,
  list_id text not null references public.lists (id) on delete cascade,
  host_user_id uuid not null references public.users (id),
  state text not null
    check (state in (
      'WAITING_FOR_PLAYERS',
      'ROUND_ACTIVE',
      'ROUND_RESOLVED',
      'ROULETTE',
      'WINNER',
      'COMPLETE',
      'NO_MATCH'
    )),
  current_movie_index integer not null default 0,
  current_movie_id text,
  active_movie_ids text[] not null default '{}',
  maybe_movie_ids text[] not null default '{}',
  winner_movie_id text,
  last_outcome text
    check (last_outcome is null or last_outcome in ('match', 'all_pass', 'maybe')),
  last_outcome_movie_id text,
  roulette_seed bigint,
  roulette_started_at timestamptz,
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  deleted_at timestamptz
);

create index if not exists movie_night_sessions_crew_active_idx
  on public.movie_night_sessions (crew_id, started_at desc)
  where deleted_at is null
    and state not in ('COMPLETE', 'NO_MATCH', 'WINNER');

create table if not exists public.movie_night_participants (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.movie_night_sessions (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (session_id, user_id)
);

create index if not exists movie_night_participants_user_idx
  on public.movie_night_participants (user_id);

create table if not exists public.movie_night_votes (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.movie_night_sessions (id) on delete cascade,
  movie_id text not null,
  user_id uuid not null references public.users (id) on delete cascade,
  vote text not null check (vote in ('watch', 'pass')),
  created_at timestamptz not null default now(),
  unique (session_id, movie_id, user_id)
);

create index if not exists movie_night_votes_session_movie_idx
  on public.movie_night_votes (session_id, movie_id);

-- =========================
-- RLS
-- =========================

alter table public.movie_night_sessions enable row level security;
alter table public.movie_night_participants enable row level security;
alter table public.movie_night_votes enable row level security;

drop policy if exists movie_night_sessions_crew_select on public.movie_night_sessions;
create policy movie_night_sessions_crew_select on public.movie_night_sessions
  for select using (
    deleted_at is null
    and public.is_crew_member(crew_id)
  );

drop policy if exists movie_night_sessions_crew_insert on public.movie_night_sessions;
create policy movie_night_sessions_crew_insert on public.movie_night_sessions
  for insert with check (
    public.is_crew_member(crew_id)
    and host_user_id = auth.uid()
  );

drop policy if exists movie_night_sessions_crew_update on public.movie_night_sessions;
create policy movie_night_sessions_crew_update on public.movie_night_sessions
  for update using (public.is_crew_member(crew_id));

drop policy if exists movie_night_participants_select on public.movie_night_participants;
create policy movie_night_participants_select on public.movie_night_participants
  for select using (
    exists (
      select 1 from public.movie_night_sessions s
      where s.id = session_id
        and s.deleted_at is null
        and public.is_crew_member(s.crew_id)
    )
  );

drop policy if exists movie_night_participants_insert on public.movie_night_participants;
create policy movie_night_participants_insert on public.movie_night_participants
  for insert with check (
    user_id = auth.uid()
    or exists (
      select 1 from public.movie_night_sessions s
      where s.id = session_id
        and s.host_user_id = auth.uid()
        and public.is_crew_member(s.crew_id)
    )
  );

drop policy if exists movie_night_participants_update on public.movie_night_participants;
create policy movie_night_participants_update on public.movie_night_participants
  for update using (user_id = auth.uid());

-- Votes are private: only the voter can read their own rows.
drop policy if exists movie_night_votes_select_own on public.movie_night_votes;
create policy movie_night_votes_select_own on public.movie_night_votes
  for select using (user_id = auth.uid());

drop policy if exists movie_night_votes_insert_own on public.movie_night_votes;
create policy movie_night_votes_insert_own on public.movie_night_votes
  for insert with check (user_id = auth.uid());

-- =========================
-- Realtime
-- =========================

do $$
begin
  alter publication supabase_realtime add table public.movie_night_sessions;
exception when duplicate_object then null;
end $$;

-- Votes and participants are intentionally NOT published (private mid-round).

-- =========================
-- Helpers
-- =========================

create or replace function public.movie_night_participant_count(p_session_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
  from public.movie_night_participants p
  where p.session_id = p_session_id;
$$;

create or replace function public.movie_night_vote_count(
  p_session_id uuid,
  p_movie_id text
)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
  from public.movie_night_votes v
  where v.session_id = p_session_id
    and v.movie_id = p_movie_id;
$$;

-- =========================
-- start_movie_night
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
  member_row record;
  first_movie text;
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

  -- End every non-complete session for this crew (incl. WINNER / NO_MATCH / live).
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
    'ROUND_ACTIVE',
    0,
    first_movie,
    p_movie_ids,
    '{}',
    now(),
    now()
  )
  returning * into session_row;

  for member_row in
    select m.user_id
    from public.crew_members m
    where m.crew_id = p_crew_id
      and m.deleted_at is null
  loop
    insert into public.movie_night_participants (session_id, user_id)
    values (session_row.id, member_row.user_id)
    on conflict (session_id, user_id) do update
      set last_seen_at = now();
  end loop;

  return session_row;
end;
$$;

revoke all on function public.start_movie_night(uuid, text, text[]) from public;
grant execute on function public.start_movie_night(uuid, text, text[]) to authenticated;

-- =========================
-- get_active_movie_night
-- =========================

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

  -- Ensure caller is a participant (reconnect / late join).
  insert into public.movie_night_participants (session_id, user_id)
  values (session_row.id, auth.uid())
  on conflict (session_id, user_id) do update
    set last_seen_at = now();

  return session_row;
end;
$$;

revoke all on function public.get_active_movie_night(uuid) from public;
grant execute on function public.get_active_movie_night(uuid) to authenticated;

-- =========================
-- heartbeat
-- =========================

create or replace function public.heartbeat_movie_night(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  update public.movie_night_participants
  set last_seen_at = now()
  where session_id = p_session_id
    and user_id = auth.uid();
end;
$$;

revoke all on function public.heartbeat_movie_night(uuid) from public;
grant execute on function public.heartbeat_movie_night(uuid) to authenticated;

-- =========================
-- submit_movie_night_vote (resolves rounds server-side)
-- =========================

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

  -- Ensure voter is a participant (no last_seen bump — that would leak via Realtime).
  insert into public.movie_night_participants (session_id, user_id)
  values (p_session_id, auth.uid())
  on conflict (session_id, user_id) do nothing;

  insert into public.movie_night_votes (session_id, movie_id, user_id, vote)
  values (p_session_id, p_movie_id, auth.uid(), p_vote)
  on conflict (session_id, movie_id, user_id) do nothing;

  participant_count := public.movie_night_participant_count(p_session_id);
  vote_count := public.movie_night_vote_count(p_session_id, p_movie_id);

  -- Privacy: do not mutate the session until every participant has voted.
  -- Otherwise Realtime would reveal that "someone voted" mid-round.
  if vote_count < participant_count then
    return session_row;
  end if;

  -- All participants voted — resolve privately on the server.
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
    -- Everyone passed — advance quietly.
    null;
  else
    -- Mixed — add to maybe pile without revealing votes.
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

  -- End of list.
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

  -- Roulette finale — server picks winner; clients animate with shared seed.
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

revoke all on function public.submit_movie_night_vote(uuid, text, text) from public;
grant execute on function public.submit_movie_night_vote(uuid, text, text) to authenticated;

-- =========================
-- complete_movie_night_roulette → WINNER
-- =========================

create or replace function public.complete_movie_night_roulette(p_session_id uuid)
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

  if session_row.state = 'WINNER' then
    return session_row;
  end if;

  if session_row.state <> 'ROULETTE' then
    raise exception 'Roulette is not active';
  end if;

  -- Allow completion once shared animation window has elapsed (~4.5s).
  if session_row.roulette_started_at is not null
     and session_row.roulette_started_at > now() - interval '4 seconds' then
    return session_row;
  end if;

  update public.movie_night_sessions
  set
    state = 'WINNER',
    last_outcome = 'match',
    last_outcome_movie_id = winner_movie_id,
    updated_at = now(),
    completed_at = now()
  where id = p_session_id
  returning * into session_row;

  return session_row;
end;
$$;

revoke all on function public.complete_movie_night_roulette(uuid) from public;
grant execute on function public.complete_movie_night_roulette(uuid) to authenticated;

-- =========================
-- my_movie_night_vote (own vote only)
-- =========================

create or replace function public.my_movie_night_vote(
  p_session_id uuid,
  p_movie_id text
)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select v.vote
  from public.movie_night_votes v
  where v.session_id = p_session_id
    and v.movie_id = p_movie_id
    and v.user_id = auth.uid()
  limit 1;
$$;

revoke all on function public.my_movie_night_vote(uuid, text) from public;
grant execute on function public.my_movie_night_vote(uuid, text) to authenticated;
