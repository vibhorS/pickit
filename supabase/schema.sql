-- PickIt Phase 2 — Supabase schema scaffold
-- Apply when NEXT_PUBLIC_SUPABASE_URL is configured.
-- Local repositories mirror this shape for offline-first development.

create extension if not exists "pgcrypto";

create table if not exists profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  email text,
  avatar_url text,
  color text not null default '#e50914',
  provider text not null default 'email',
  is_guest boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists households (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Home',
  created_by uuid not null references profiles (id),
  updated_by uuid not null references profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists partner_relationships (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id),
  inviter_user_id uuid not null references profiles (id),
  partner_user_id uuid references profiles (id),
  status text not null check (status in ('pending', 'connected', 'declined', 'cancelled', 'disconnected')),
  invite_token text not null unique,
  accepted_at timestamptz,
  disconnected_at timestamptz,
  created_by uuid not null references profiles (id),
  updated_by uuid not null references profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists collections (
  id text primary key,
  name text not null,
  emoji text not null default '🎬',
  description text,
  owner_id uuid not null references profiles (id),
  household_id uuid references households (id),
  archived_at timestamptz,
  created_by uuid not null references profiles (id),
  updated_by uuid not null references profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists collection_memberships (
  id uuid primary key default gen_random_uuid(),
  collection_id text not null references collections (id) on delete cascade,
  user_id uuid not null references profiles (id),
  role text not null check (role in ('owner', 'partner', 'member')),
  joined_at timestamptz not null default now(),
  created_by uuid references profiles (id),
  updated_by uuid references profiles (id),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz,
  unique (collection_id, user_id)
);

create table if not exists collection_items (
  id uuid primary key default gen_random_uuid(),
  collection_id text not null references collections (id) on delete cascade,
  movie_id text not null,
  source jsonb not null default '{}',
  metadata jsonb,
  note text,
  added_by_user_id uuid references profiles (id),
  added_at timestamptz not null default now(),
  updated_by uuid references profiles (id),
  updated_at timestamptz,
  deleted_at timestamptz,
  unique (collection_id, movie_id)
);

create table if not exists ratings (
  id uuid primary key default gen_random_uuid(),
  collection_id text not null references collections (id) on delete cascade,
  movie_id text not null,
  user_id uuid not null references profiles (id),
  vote text not null check (vote in ('like', 'pass')),
  voted_at timestamptz not null default now(),
  created_by uuid not null references profiles (id),
  updated_by uuid not null references profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (collection_id, movie_id, user_id)
);

create table if not exists invitations (
  id uuid primary key default gen_random_uuid(),
  collection_id text not null references collections (id) on delete cascade,
  invited_by_user_id uuid not null references profiles (id),
  token text not null unique,
  status text not null,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  accepted_by_user_id uuid references profiles (id),
  declined_at timestamptz
);

create table if not exists activity (
  id uuid primary key default gen_random_uuid(),
  collection_id text not null,
  user_id uuid not null references profiles (id),
  type text not null,
  movie_id text,
  summary text,
  occurred_at timestamptz not null default now()
);

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id),
  collection_id text,
  type text not null,
  message text not null,
  event_id text,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create table if not exists presence (
  user_id uuid primary key references profiles (id) on delete cascade,
  status text not null,
  collection_id text,
  updated_at timestamptz not null default now()
);

-- Enable RLS on all tables before production use.
alter table profiles enable row level security;
alter table households enable row level security;
alter table partner_relationships enable row level security;
alter table collections enable row level security;
alter table collection_memberships enable row level security;
alter table collection_items enable row level security;
alter table ratings enable row level security;
alter table invitations enable row level security;
alter table activity enable row level security;
alter table notifications enable row level security;
alter table presence enable row level security;

-- Policies should allow household partners to read shared collections/ratings.
-- Example starter policy (refine before launch):
-- create policy "Users read own profile" on profiles
--   for select using (auth.uid() = id);
