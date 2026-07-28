-- Phase 2B — Crew Collaboration
-- Lists, recommendations, and movie nights belong to a Crew.
-- Apply after Phase 2A migration.

-- =========================
-- crews
-- =========================
create table if not exists public.crews (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Our Crew',
  avatar_url text,
  created_by uuid not null references public.users (id),
  updated_by uuid not null references public.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists crews_created_by_idx on public.crews (created_by)
  where deleted_at is null;

-- =========================
-- crew_members
-- =========================
create table if not exists public.crew_members (
  id uuid primary key default gen_random_uuid(),
  crew_id uuid not null references public.crews (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'member')),
  joined_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (crew_id, user_id)
);

create index if not exists crew_members_user_idx on public.crew_members (user_id)
  where deleted_at is null;
create index if not exists crew_members_crew_idx on public.crew_members (crew_id)
  where deleted_at is null;

-- =========================
-- crew_invitations
-- =========================
create table if not exists public.crew_invitations (
  id uuid primary key default gen_random_uuid(),
  crew_id uuid not null references public.crews (id) on delete cascade,
  invited_by_user_id uuid not null references public.users (id),
  token text not null unique,
  status text not null check (
    status in ('pending', 'accepted', 'expired', 'cancelled', 'rejected')
  ),
  expires_at timestamptz,
  accepted_at timestamptz,
  accepted_by_user_id uuid references public.users (id),
  rejected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists crew_invitations_token_idx on public.crew_invitations (token);
create index if not exists crew_invitations_crew_idx on public.crew_invitations (crew_id);

-- =========================
-- attach lists to crews
-- =========================
alter table public.lists
  add column if not exists crew_id uuid references public.crews (id);

create index if not exists lists_crew_idx on public.lists (crew_id)
  where deleted_at is null;

-- =========================
-- crew activity
-- =========================
create table if not exists public.crew_activity (
  id uuid primary key default gen_random_uuid(),
  crew_id uuid not null references public.crews (id) on delete cascade,
  user_id uuid not null references public.users (id),
  list_id text references public.lists (id) on delete set null,
  movie_id text,
  type text not null,
  summary text,
  occurred_at timestamptz not null default now()
);

create index if not exists crew_activity_crew_idx
  on public.crew_activity (crew_id, occurred_at desc);

-- =========================
-- presence
-- =========================
create table if not exists public.presence (
  user_id uuid primary key references public.users (id) on delete cascade,
  crew_id uuid references public.crews (id) on delete set null,
  status text not null default 'offline',
  list_id text,
  updated_at timestamptz not null default now()
);

-- =========================
-- notifications
-- =========================
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  crew_id uuid references public.crews (id) on delete set null,
  list_id text,
  type text not null,
  message text not null,
  event_id text,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists notifications_user_idx
  on public.notifications (user_id, created_at desc);

-- =========================
-- helper: is crew member
-- =========================
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

create or replace function public.user_crew_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select crew_id from public.crew_members
  where user_id = auth.uid() and deleted_at is null;
$$;

-- =========================
-- auto-create personal crew on signup (extend handle_new_user)
-- =========================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_crew_id uuid;
begin
  insert into public.users (id, display_name, email, provider, is_guest)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'display_name',
      split_part(coalesce(new.email, 'Guest'), '@', 1),
      'Guest'
    ),
    new.email,
    coalesce(new.raw_user_meta_data->>'provider', 'email'),
    coalesce((new.raw_user_meta_data->>'is_guest')::boolean, false)
  )
  on conflict (id) do nothing;

  insert into public.preferences (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  insert into public.crews (name, created_by, updated_by)
  values (
    coalesce(new.raw_user_meta_data->>'display_name', 'Our') || '''s Crew',
    new.id,
    new.id
  )
  returning id into new_crew_id;

  insert into public.crew_members (crew_id, user_id, role)
  values (new_crew_id, new.id, 'owner');

  return new;
end;
$$;

-- =========================
-- RLS
-- =========================
alter table public.crews enable row level security;
alter table public.crew_members enable row level security;
alter table public.crew_invitations enable row level security;
alter table public.crew_activity enable row level security;
alter table public.presence enable row level security;
alter table public.notifications enable row level security;

drop policy if exists crews_member_select on public.crews;
create policy crews_member_select on public.crews
  for select using (public.is_crew_member(id) and deleted_at is null);

drop policy if exists crews_owner_update on public.crews;
create policy crews_owner_update on public.crews
  for update using (
    exists (
      select 1 from public.crew_members m
      where m.crew_id = id and m.user_id = auth.uid()
        and m.role = 'owner' and m.deleted_at is null
    )
  );

drop policy if exists crews_insert_authenticated on public.crews;
create policy crews_insert_authenticated on public.crews
  for insert to authenticated with check (created_by = auth.uid());

drop policy if exists crew_members_select on public.crew_members;
create policy crew_members_select on public.crew_members
  for select using (public.is_crew_member(crew_id));

drop policy if exists crew_members_owner_manage on public.crew_members;
create policy crew_members_owner_manage on public.crew_members
  for all using (
    exists (
      select 1 from public.crew_members m
      where m.crew_id = crew_members.crew_id
        and m.user_id = auth.uid()
        and m.role in ('owner', 'admin')
        and m.deleted_at is null
    )
    or user_id = auth.uid()
  )
  with check (true);

drop policy if exists crew_invitations_select on public.crew_invitations;
create policy crew_invitations_select on public.crew_invitations
  for select using (
    public.is_crew_member(crew_id)
    or status = 'pending'
  );

drop policy if exists crew_invitations_manage on public.crew_invitations;
create policy crew_invitations_manage on public.crew_invitations
  for all using (
    public.is_crew_member(crew_id)
    or invited_by_user_id = auth.uid()
  )
  with check (true);

-- Replace owner-only list policies with crew-aware policies
drop policy if exists lists_owner_all on public.lists;
create policy lists_crew_select on public.lists
  for select using (
    owner_id = auth.uid()
    or (crew_id is not null and public.is_crew_member(crew_id))
  );
create policy lists_crew_insert on public.lists
  for insert with check (
    owner_id = auth.uid()
    and (crew_id is null or public.is_crew_member(crew_id))
  );
create policy lists_crew_update on public.lists
  for update using (
    owner_id = auth.uid()
    or (crew_id is not null and public.is_crew_member(crew_id))
  );
create policy lists_crew_delete on public.lists
  for delete using (
    owner_id = auth.uid()
    or exists (
      select 1 from public.crew_members m
      where m.crew_id = lists.crew_id
        and m.user_id = auth.uid()
        and m.role = 'owner'
        and m.deleted_at is null
    )
  );

drop policy if exists recommendations_owner_all on public.recommendations;
create policy recommendations_crew_all on public.recommendations
  for all using (
    exists (
      select 1 from public.lists l
      where l.id = list_id
        and (
          l.owner_id = auth.uid()
          or (l.crew_id is not null and public.is_crew_member(l.crew_id))
        )
    )
  )
  with check (
    exists (
      select 1 from public.lists l
      where l.id = list_id
        and (
          l.owner_id = auth.uid()
          or (l.crew_id is not null and public.is_crew_member(l.crew_id))
        )
    )
  );

-- Ratings: own writes; crew can read ratings on shared lists
drop policy if exists ratings_owner_all on public.ratings;
create policy ratings_select_crew on public.ratings
  for select using (
    user_id = auth.uid()
    or exists (
      select 1 from public.lists l
      where l.id = list_id
        and l.crew_id is not null
        and public.is_crew_member(l.crew_id)
    )
  );
create policy ratings_write_own on public.ratings
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists crew_activity_select on public.crew_activity;
create policy crew_activity_select on public.crew_activity
  for select using (public.is_crew_member(crew_id));
drop policy if exists crew_activity_insert on public.crew_activity;
create policy crew_activity_insert on public.crew_activity
  for insert with check (
    user_id = auth.uid() and public.is_crew_member(crew_id)
  );

drop policy if exists presence_all on public.presence;
create policy presence_all on public.presence
  for all using (true) with check (user_id = auth.uid());

drop policy if exists notifications_own on public.notifications;
create policy notifications_own on public.notifications
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Realtime
do $$ begin
  alter publication supabase_realtime add table public.crews;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.crew_members;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.crew_invitations;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.crew_activity;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.presence;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.notifications;
exception when duplicate_object then null; end $$;

-- Backfill: personal crew for existing users without membership
insert into public.crews (name, created_by, updated_by)
select
  coalesce(u.display_name, 'Our') || '''s Crew',
  u.id,
  u.id
from public.users u
where u.deleted_at is null
  and not exists (
    select 1 from public.crew_members m
    where m.user_id = u.id and m.deleted_at is null
  );

insert into public.crew_members (crew_id, user_id, role)
select c.id, c.created_by, 'owner'
from public.crews c
where not exists (
  select 1 from public.crew_members m
  where m.crew_id = c.id and m.user_id = c.created_by
);

-- Attach orphan lists to owner's personal crew
update public.lists l
set crew_id = (
  select m.crew_id from public.crew_members m
  where m.user_id = l.owner_id and m.deleted_at is null
  order by m.joined_at asc
  limit 1
)
where l.crew_id is null and l.deleted_at is null;
