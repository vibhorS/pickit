/**
 * Server-authoritative Movie Night session model.
 * Clients render this state; they never advance rounds locally.
 */

export type MovieNightLiveState =
  | "WAITING_FOR_PLAYERS"
  | "ROUND_ACTIVE"
  | "ROUND_RESOLVED"
  | "NEXT_MOVIE"
  | "ROULETTE"
  | "WINNER"
  | "COMPLETE"
  | "NO_MATCH";

export type MovieNightVoteValue = "watch" | "pass";

export type MovieNightLastOutcome = "match" | "all_pass" | "maybe";

export type MovieNightLiveSession = {
  id: string;
  crewId: string;
  listId: string;
  hostUserId: string;
  state: MovieNightLiveState;
  currentMovieIndex: number;
  currentMovieId: string | null;
  activeMovieIds: string[];
  maybeMovieIds: string[];
  winnerMovieId: string | null;
  lastOutcome: MovieNightLastOutcome | null;
  lastOutcomeMovieId: string | null;
  rouletteSeed: number | null;
  rouletteStartedAt: string | null;
  startedAt: string;
  updatedAt: string;
  completedAt: string | null;
};

export function mapMovieNightSessionRow(
  row: Record<string, unknown>,
): MovieNightLiveSession {
  return {
    id: String(row.id),
    crewId: String(row.crew_id),
    listId: String(row.list_id),
    hostUserId: String(row.host_user_id),
    state: row.state as MovieNightLiveState,
    currentMovieIndex: Number(row.current_movie_index ?? 0),
    currentMovieId: (row.current_movie_id as string | null) ?? null,
    activeMovieIds: (row.active_movie_ids as string[] | null) ?? [],
    maybeMovieIds: (row.maybe_movie_ids as string[] | null) ?? [],
    winnerMovieId: (row.winner_movie_id as string | null) ?? null,
    lastOutcome: (row.last_outcome as MovieNightLastOutcome | null) ?? null,
    lastOutcomeMovieId: (row.last_outcome_movie_id as string | null) ?? null,
    rouletteSeed:
      row.roulette_seed == null ? null : Number(row.roulette_seed),
    rouletteStartedAt: (row.roulette_started_at as string | null) ?? null,
    startedAt: String(row.started_at),
    updatedAt: String(row.updated_at),
    completedAt: (row.completed_at as string | null) ?? null,
  };
}
