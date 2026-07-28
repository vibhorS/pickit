-- Phase 2A — Cloud Foundation
-- Single-user source of truth. Collaboration tables are intentionally omitted.
-- Apply with: supabase db push   OR   run in SQL editor.

create extension if not exists "pgcrypto";

-- =========================
-- users (app profile)
-- =========================
create table if not exists public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  email text,
  avatar_url text,
  color text not null default '#e50914',
  provider text not null default 'email',
  is_guest boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists users_email_idx on public.users (email) where deleted_at is null;

-- =========================
-- movies (catalog cache)
-- =========================
create table if not exists public.movies (
  id text primary key,
  title text not null,
  year integer,
  runtime integer,
  rating numeric,
  genres text[] not null default '{}',
  overview text not null default '',
  poster_url text not null default '',
  media_type text not null default 'movie',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists movies_title_idx on public.movies using gin (to_tsvector('english', title));

-- =========================
-- recommendation_sources
-- =========================
create table if not exists public.recommendation_sources (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  label text not null,
  created_at timestamptz not null default now(),
  unique (type, label)
);

-- =========================
-- lists (collections)
-- =========================
create table if not exists public.lists (
  id text primary key,
  owner_id uuid not null references public.users (id) on delete cascade,
  name text not null,
  emoji text not null default '🎬',
  description text,
  archived_at timestamptz,
  created_by uuid not null references public.users (id),
  updated_by uuid not null references public.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists lists_owner_idx on public.lists (owner_id) where deleted_at is null;
create index if not exists lists_updated_idx on public.lists (updated_at desc);

-- =========================
-- recommendations (list items)
-- =========================
create table if not exists public.recommendations (
  id uuid primary key default gen_random_uuid(),
  list_id text not null references public.lists (id) on delete cascade,
  movie_id text not null references public.movies (id),
  source_id uuid references public.recommendation_sources (id),
  source_type text,
  source_label text,
  metadata jsonb not null default '{}',
  note text,
  added_by_user_id uuid not null references public.users (id),
  created_by uuid not null references public.users (id),
  updated_by uuid not null references public.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (list_id, movie_id)
);

create index if not exists recommendations_list_idx
  on public.recommendations (list_id) where deleted_at is null;
create index if not exists recommendations_movie_idx
  on public.recommendations (movie_id) where deleted_at is null;

-- =========================
-- ratings
-- =========================
create table if not exists public.ratings (
  id uuid primary key default gen_random_uuid(),
  list_id text not null references public.lists (id) on delete cascade,
  movie_id text not null references public.movies (id),
  user_id uuid not null references public.users (id) on delete cascade,
  vote text not null check (vote in ('like', 'pass')),
  voted_at timestamptz not null default now(),
  created_by uuid not null references public.users (id),
  updated_by uuid not null references public.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (list_id, movie_id, user_id)
);

create index if not exists ratings_user_idx on public.ratings (user_id) where deleted_at is null;
create index if not exists ratings_list_idx on public.ratings (list_id) where deleted_at is null;

-- =========================
-- preferences
-- =========================
create table if not exists public.preferences (
  user_id uuid primary key references public.users (id) on delete cascade,
  appearance text not null default 'dark',
  analytics_opt_in boolean not null default true,
  developer_mode boolean not null default false,
  extras jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================
-- movie_nights (placeholder)
-- =========================
create table if not exists public.movie_nights (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.users (id) on delete cascade,
  list_id text references public.lists (id) on delete set null,
  status text not null default 'draft',
  winner_movie_id text references public.movies (id),
  game_id text,
  started_at timestamptz,
  completed_at timestamptz,
  created_by uuid not null references public.users (id),
  updated_by uuid not null references public.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists movie_nights_owner_idx
  on public.movie_nights (owner_id) where deleted_at is null;

-- =========================
-- migration marker
-- =========================
create table if not exists public.data_migrations (
  id text primary key,
  user_id uuid not null references public.users (id) on delete cascade,
  completed_at timestamptz not null default now()
);

-- =========================
-- updated_at trigger
-- =========================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'users', 'movies', 'lists', 'recommendations',
    'ratings', 'preferences', 'movie_nights'
  ]
  loop
    execute format(
      'drop trigger if exists %I_set_updated_at on public.%I;
       create trigger %I_set_updated_at
       before update on public.%I
       for each row execute function public.set_updated_at();',
      t, t, t, t
    );
  end loop;
end $$;

-- =========================
-- RLS
-- =========================
alter table public.users enable row level security;
alter table public.movies enable row level security;
alter table public.recommendation_sources enable row level security;
alter table public.lists enable row level security;
alter table public.recommendations enable row level security;
alter table public.ratings enable row level security;
alter table public.preferences enable row level security;
alter table public.movie_nights enable row level security;
alter table public.data_migrations enable row level security;

-- Users: own profile
drop policy if exists users_select_own on public.users;
create policy users_select_own on public.users
  for select using (auth.uid() = id and deleted_at is null);
drop policy if exists users_update_own on public.users;
create policy users_update_own on public.users
  for update using (auth.uid() = id);
drop policy if exists users_insert_own on public.users;
create policy users_insert_own on public.users
  for insert with check (auth.uid() = id);

-- Movies: readable by authenticated; upsert by authenticated
drop policy if exists movies_select_authenticated on public.movies;
create policy movies_select_authenticated on public.movies
  for select to authenticated using (true);
drop policy if exists movies_upsert_authenticated on public.movies;
create policy movies_upsert_authenticated on public.movies
  for all to authenticated using (true) with check (true);

-- Sources: read all, insert authenticated
drop policy if exists sources_select on public.recommendation_sources;
create policy sources_select on public.recommendation_sources
  for select to authenticated using (true);
drop policy if exists sources_insert on public.recommendation_sources;
create policy sources_insert on public.recommendation_sources
  for insert to authenticated with check (true);

-- Lists: owner only
drop policy if exists lists_owner_all on public.lists;
create policy lists_owner_all on public.lists
  for all using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

-- Recommendations: via list ownership
drop policy if exists recommendations_owner_all on public.recommendations;
create policy recommendations_owner_all on public.recommendations
  for all using (
    exists (
      select 1 from public.lists l
      where l.id = list_id and l.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.lists l
      where l.id = list_id and l.owner_id = auth.uid()
    )
  );

-- Ratings: own rows, and list must be owned by user
drop policy if exists ratings_owner_all on public.ratings;
create policy ratings_owner_all on public.ratings
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Preferences / movie nights / migrations: own
drop policy if exists preferences_owner_all on public.preferences;
create policy preferences_owner_all on public.preferences
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists movie_nights_owner_all on public.movie_nights;
create policy movie_nights_owner_all on public.movie_nights
  for all using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

drop policy if exists data_migrations_owner_all on public.data_migrations;
create policy data_migrations_owner_all on public.data_migrations
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, display_name, email, provider, is_guest)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(coalesce(new.email, 'Guest'), '@', 1), 'Guest'),
    new.email,
    coalesce(new.raw_user_meta_data->>'provider', 'email'),
    coalesce((new.raw_user_meta_data->>'is_guest')::boolean, false)
  )
  on conflict (id) do nothing;

  insert into public.preferences (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Realtime (ignore errors if already added)
do $$
begin
  alter publication supabase_realtime add table public.lists;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.recommendations;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.ratings;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.preferences;
exception when duplicate_object then null;
end $$;
