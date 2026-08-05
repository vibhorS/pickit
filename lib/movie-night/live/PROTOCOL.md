# Movie Night — server-authoritative protocol

Private decisions. Shared outcome. Clients subscribe, render, and vote. The server owns all progression.

## Session model

`movie_night_sessions` is the single source of truth:

| Field | Role |
| --- | --- |
| `id` | Session id |
| `crew_id` | One active experience per crew |
| `list_id` | Collection / list used for the lineup |
| `host_user_id` | Who started the session |
| `state` | State machine (below) |
| `current_movie_index` / `current_movie_id` | Shared active title |
| `active_movie_ids` | Ordered lineup |
| `maybe_movie_ids` | Shared Maybe pile |
| `winner_movie_id` | Server-chosen winner |
| `roulette_seed` / `roulette_started_at` | Shared roulette timing |
| `last_outcome` | `match` \| `all_pass` \| `maybe` (for UI flash only) |
| `started_at` / `updated_at` / `completed_at` | Lifecycle |

Votes live in `movie_night_votes` keyed by `(session_id, movie_id, user_id)`.
They belong to the **session**, not the collection. RLS: each user reads **only their own** votes.

Participants live in `movie_night_participants` (crew members auto-joined on start / restore).

## State machine

Persisted states:

```
WAITING_FOR_PLAYERS   (reserved; start jumps to ROUND_ACTIVE once lineup exists)
        ↓
ROUND_ACTIVE          ← every device shows the same movie; Watch / Pass only
        ↓
   [server resolves when all participants have voted]
        ↓
WINNER                ← unanimous Watch → ✨ It's a Match
   or ROUND_ACTIVE    ← all Pass (quiet) or mixed (Maybe + flash), next index
   or ROULETTE        ← end of list with non-empty Maybe pile
   or NO_MATCH        ← end of list, empty Maybe
        ↓
ROULETTE → WINNER     ← after shared spin window (~4.5s)
        ↓
COMPLETE / NO_MATCH
```

Logical phases `ROUND_RESOLVED` and `NEXT_MOVIE` happen **inside** `submit_movie_night_vote` in one atomic transaction. Clients never linger on partial tallies; they only see the post-resolution session row (and `last_outcome` for a short “Added to the Maybe pile.” flash).

## Realtime protocol

1. **Subscribe** — clients channel `movie-night:{sessionId}` on `movie_night_sessions` (`*` events, `id=eq.{sessionId}`).
2. **Do not publish** `movie_night_votes` or `movie_night_participants` to Realtime (prevents mid-round leakage).
3. **Render** — UI maps `session.state` → view. No local advancement of index/winner.
4. **Vote** — `submit_movie_night_vote(session_id, movie_id, vote)`.
   - Mid-round: row written privately; **session row unchanged** → no Realtime event → peers cannot infer that anyone voted.
   - When the last required vote arrives: server resolves and updates the session → one Realtime event → all devices advance together.
5. **Roulette** — server sets `winner_movie_id`, `roulette_seed`, `roulette_started_at` when entering `ROULETTE`. Clients animate from `roulette_started_at` for a fixed duration, then call `complete_movie_night_roulette` (idempotent; server enforces the time gate).
6. **Reconnect** — `get_active_movie_night(crew_id)` restores session + re-upserts participant; `my_movie_night_vote` restores own vote for the current movie (duplicate inserts no-op).

## RPCs

| RPC | Who | Effect |
| --- | --- | --- |
| `start_movie_night` | Crew member | Creates session, joins all crew members, `ROUND_ACTIVE` on movie 0 |
| `get_active_movie_night` | Crew member | Latest non-terminal session for crew |
| `submit_movie_night_vote` | Participant | Private vote + server resolution |
| `my_movie_night_vote` | Self | Own vote only |
| `complete_movie_night_roulette` | Crew member | `ROULETTE` → `WINNER` after spin window |
| `heartbeat_movie_night` | Participant | `last_seen_at` only (not used for UI waiting) |

# Client queue hydration

`SyncedMovieNightPlay` builds `queueItems` from `session.activeMovieIds` via
`hydrateQueueFromSession` (`lib/movie-night/live/hydrate-queue.ts`).

Catalog/stats items are a seed for metadata only. Missing movies are fetched
from `movies` by id. The UI never trusts a stale local `info.queue`.

## Client rules

- Never choose next movie, winner, or Maybe membership locally.
- Never show who voted, vote counts, or waiting-for-N copy.
- Watch / Pass are the only actions during `ROUND_ACTIVE`.
