# Phase 2A — Cloud Foundation Setup

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

In the Supabase SQL editor, run:

`supabase/migrations/20260729_phase2a_cloud_foundation.sql`

## 4. Auth settings

In Authentication → Providers:

- Enable Email
- Enable Anonymous (for Guest mode)
- Optionally enable Google (Apple later)

## 5. Seed demo data

```bash
npm run db:seed
```

Login: `alex@pickit.demo` / `pickit-demo-123`

Reset app tables (keeps auth users):

```bash
npm run db:reset
```

## Architecture

```
UI → Hooks (TanStack Query) → Repositories → Supabase
```

UI components must not import `@/lib/supabase/client`.

## Migration

On first authenticated session, local Zustand data is imported into Supabase once.
After that, Supabase is canonical; the offline queue only holds pending writes.
