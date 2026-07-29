# PickIt

## Product

PickIt helps two people stop scrolling and start watching.

It is a decision engine for movie night, not a movie database, watchlist
manager, recommendation tracker, or productivity tool.

## Core Principles

- Get from opening the app to a winner in five taps or fewer.
- Organize the primary journey around tonight's mood, not list management.
- Keep recommendation capture and list maintenance secondary.
- Build shared taste over time without making users manage data.
- Never ask users to retype information they already have.
- Optimize for reducing decision fatigue.

## Engineering Principles

- Keep components presentational.
- Business logic belongs in services/stores.
- Prefer composition over giant reusable components.
- Prefer simple code over clever code.
- Avoid premature abstractions.
- One feature per PR.
- Keep Cursor changes focused.



## Stack

Next.js

TypeScript

Tailwind

Zustand

TMDb

Supabase (schema + client scaffold; local repositories until credentials are set)

## Collaboration architecture

- Auth: `lib/auth/auth-service.ts` + `store/auth-store.ts`
- Repositories: `lib/repositories/` (local-first, cloud-swappable)
- Sync: `lib/sync/sync-engine.ts` (optimistic updates, offline queue, retries)
- Partners: `lib/services/collaboration/relationship-service.ts`
- Permissions: `lib/services/collaboration/permissions.ts`
- Events / notifications / presence: `lib/domain/events.ts`, notification + presence services
- Migration: `lib/services/collaboration/migration-service.ts`
- Supabase SQL: `supabase/schema.sql`



## Cloud foundation (Phase 2A)

- Schema: `supabase/migrations/20260729_phase2a_cloud_foundation.sql`
- Clients: `lib/supabase/client.ts` (UI never imports this — use repositories)
- Cloud repos: `lib/repositories/cloud/`
- Auth facade: `lib/auth/cloud-auth.ts`
- Sync / offline queue: `lib/sync/cloud-sync-engine.ts`, `lib/sync/offline-queue.ts`
- React Query hooks: `hooks/use-cloud-data.ts`
- Migration: `lib/services/cloud/migration.ts`
- Seed: `npm run db:seed` / `npm run db:reset`

Configure `.env.local` with Supabase URL + anon key, enable Anonymous sign-in for guests, apply the migration, then seed.

## MVP

Mood / List Selection

Tonight Queue

Decision Modes

Quick Pick

Roulette

Tournament

Winner

Independent Ratings

Recommendation Capture

List Management

## Future

AI Capture

Restaurants

Trips

Recipes

Groups  

## Design Principles

- Build a premium consumer app, not an internal dashboard.
- Every screen should have exactly one primary action.
- Prefer whitespace over borders.
- Prefer typography over badges.
- Reduce visual noise relentlessly.
- If a UI element doesn't help users decide what to do next, question whether it should exist.
- Optimize for delight and calm, not density.



## Source of Truth

  When cloud mode is enabled (authenticated + Supabase configured), Supabase is the canonical source of truth.
  Local persistence exists only for:

- UI cache
- offline support
- optimistic updates
- sync queue
  The application should never maintain two independent sources of truth.
  All architecture decisions should reinforce this principle.

Before considering a milestone complete:

- npm run build must pass

- npm run test must pass

- TypeScript must pass

- Vercel production build must pass

A feature is not complete until it builds in production.