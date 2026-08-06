# Cloud Foundation + Crew Collaboration Setup

## 1. Create a Supabase project

Create a project at https://supabase.com and copy the URL + anon key.

## 2. Environment

Copy `.env.example` → `.env.local` and set:

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...   # scripts only
TMDB_API_KEY=...
```

## 3. Apply schema

In the Supabase SQL editor, run in order:

1. `supabase/migrations/20260729_phase2a_cloud_foundation.sql`
2. `supabase/migrations/20260729_phase2b_crew_collaboration.sql`
3. `supabase/migrations/20260729_phase2b_crew_rls_fix.sql` (required if 2B was applied before this fix)
4. `supabase/migrations/20260730_users_select_crew_mates.sql` (required so crew mates can read each other's `users` profiles)
5. `supabase/migrations/20260806_remove_crew_member.sql` (required for owner-only Remove from Crew)
6. `supabase/migrations/20260806_movie_night_live_sessions.sql` (required for synchronized Movie Night)
7. `supabase/migrations/20260806_movie_night_vote_privacy.sql` (required if #6 was applied before vote-privacy hardening)
8. `supabase/migrations/20260806_movie_night_session_cleanup.sql` (required so finished sessions are never restored; adds `end_movie_night`)

Enable Realtime for: `lists`, `recommendations`, `ratings`, `crew_members`, `crew_activity`, `presence`, `movie_night_sessions` (votes/participants stay off Realtime).

Movie Night protocol: `lib/movie-night/live/PROTOCOL.md`.

## 4. Auth settings

In Authentication → Providers:

- Enable Email
- **Disable "Confirm email"** for local development (otherwise signup returns no session, and confirmation emails hit Supabase rate limits quickly while testing)
- Enable Anonymous (for Guest mode)
- Optionally enable Google (Apple later)

If you see **email rate limit exceeded**: wait ~1 minute, use a different email, or turn off Confirm email (above). Failed signup attempts still count toward the email send quota.

## 5. Seed demo Crew

```bash
npm run db:seed
```

Logins (password `pickit-demo-123`):

- `alex@pickit.demo` — Crew owner
- `jordan@pickit.demo` — Crew member

Both share Date Night with mutual likes for Movie Night QA.

Reset app tables (keeps auth users):

```bash
npm run db:reset
```

## 6. Crew QA (two browsers)

1. Sign in as Alex and Jordan (or create two accounts)
2. Alex: Profile → Crew → Invite to Crew → copy link
3. Jordan: open invite link → Accept
4. Add a recommendation / rate a movie on either side — lists and readiness update live
5. Start Movie Night from a shared list

In-app developer tools (Profile → Developer): Seed Movies, Seed Movie Night, Seed Activity, Reset Crew.

## Architecture

```
UI → Hooks / Services → Repositories → Supabase
```

UI components must not import `@/lib/supabase/client` for data writes — use Crew/list/rating services and stores.

## Migration

On first authenticated session, local Zustand data is imported into Supabase once and attached to a personal Crew. After that, Supabase is canonical; the offline queue only holds pending writes.
