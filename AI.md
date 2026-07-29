# # PickIt

## Product Vision

PickIt helps two people stop scrolling and start watching.

It is a decision engine for movie night.

It is NOT:

- A movie database

- A watchlist manager

- A recommendation tracker

- A productivity app

- A social network

- A Letterboxd replacement

Every feature should strengthen one of these flows:

Discover

↓

Capture

↓

Organize

↓

Rate

↓

Movie Night

↓

Watch

If a feature does not improve this journey, postpone it.

---

# Product Principles

The app should:

- Get from opening the app to a winner in five taps or fewer.

- Optimize for tonight, not someday.

- Reduce decision fatigue.

- Build shared taste over time.

- Keep recommendation management lightweight.

- Never ask users to manually enter information that AI or integrations can infer.

- Feel premium, calm and delightful.

Prefer:

- fewer decisions

- fewer screens

- fewer taps

- more confidence

---

# Current Stage

Current Phase: Closed Alpha

Current priorities:

1. Reliable cloud synchronization

2. AI capture accuracy

3. Cross-device consistency

4. Mobile-first experience

5. Fast Movie Night flow

Do NOT introduce major new product features until these are stable.

Reliability > Feature Velocity.

---

# Engineering Principles

Keep components presentational.

Business logic belongs in:

- services

- repositories

- stores

Prefer:

- composition over inheritance

- simple code over clever code

- explicitness over magic

- small focused changes

- one feature per PR

Avoid premature abstraction.

Never duplicate business logic.

---

# Architecture

## Stack

- Next.js

- TypeScript

- TailwindCSS

- Zustand

- Supabase

- TMDb

- OpenAI

---

## Source of Truth

When cloud mode is enabled:

Supabase is the canonical source of truth.

Local persistence exists only as:

- cache

- offline queue

- optimistic updates

- temporary working state

Never maintain two independent sources of truth.

Architecture should always reinforce this rule.

---

## Repository Pattern

UI never talks directly to:

- Supabase

- OpenAI

- TMDb

Always go through:

Repositories

↓

Services

↓

Stores

Repositories should be swappable.

Business logic should not know whether data comes from local or cloud storage.

---

## Synchronization

Sync philosophy:

Optimistic Update

↓

Sync Queue

↓

Cloud

↓

Confirmed

If cloud fails:

Queue

↓

Retry

Never silently discard data.

Every failed write must be observable.

Realtime improves freshness.

Realtime must never be required for correctness.

Cloud snapshots should merge with local state.

Never blindly replace local state.

Protect unsynced local changes.

---

## IDs

Every Supabase UUID column must use genuine UUIDs.

Never use prefixed IDs for UUID database fields.

---

# AI Principles

AI exists to reduce user effort.

Never make users:

- retype titles

- recreate lists

- organize recommendations manually

Prefer:

High recall

↓

High precision

↓

Fast processing

Never silently guess.

If confidence is low:

Ask.

If confidence is high:

Automate.

Every AI decision should be explainable.

Capture benchmarks should be measurable over time.

---

# Capture Pipeline

Primary input:

Screenshot

Future:

- URLs

- Instagram integrations

- Reddit

- Letterboxd

- TikTok

The pipeline should remain source-agnostic.

Pipeline:

Capture

↓

Vision

↓

Normalization

↓

TMDb Matching

↓

Review

↓

Save

Each stage should be independently testable.

---

# UX Principles

Build a premium consumer app.

Not an admin dashboard.

Every screen should have one primary action.

Prefer:

Whitespace

Typography

Motion

Depth

Avoid:

Dense dashboards

Too many badges

Too many borders

Decision fatigue

If a UI element doesn't help the user decide what to do next,

question whether it belongs.

Mobile experience comes first.

Desktop is secondary.

---

# Observability

Every important workflow should be measurable.

Track:

- AI success

- TMDb matching

- Sync success

- Retry count

- Manual corrections

- Performance

- User funnel

- Errors

Developer Mode should expose:

- Repository

- Cloud status

- Realtime status

- Pending writes

- Failed writes

- Last sync

- Sync queue

- Event log

No silent failures.

---

# Testing Philosophy

Every feature should be testable.

Before considering work complete:

- npm run build

- npm test

- TypeScript

- Production build

- Vercel deployment

All must succeed.

Test against:

- [localhost](http://localhost)

- production build

- multiple devices

- intermittent connectivity

Never optimize only for [localhost](http://localhost).

Always assume:

multiple users

multiple devices

real internet

offline transitions

---

# Security

Never expose:

- OpenAI keys

- Service Role keys

- Secrets

- Sensitive user information

OpenAI calls must remain server-side.

Service role keys must never reach the client.

Analytics should never store:

- passwords

- raw screenshots

- API keys

---

# Definition of Done

A feature is complete only when:

✓ Architecture remains clean

✓ TypeScript passes

✓ Tests pass

✓ Production build succeeds

✓ Vercel deploy succeeds

✓ Errors are surfaced

✓ Analytics are instrumented where appropriate

✓ Mobile UX is verified

✓ Cross-device behavior is verified

✓ No silent failures exist

Working on [localhost](http://localhost) is NOT considered complete.

---

# Product North Star

Every improvement should answer one question:

"Does this help two people decide what to watch faster and with less friction?"

If not,

don't build it.