import type { CollectionMovie } from "@/lib/services/movie-service";

/**
 * Decision Game contract.
 * Add a future game by registering metadata + a play component —
 * Movie Night flow stays unchanged.
 */
export type DecisionGameId = "quick-pick" | "roulette" | "tournament";

export type DecisionGame = {
  id: DecisionGameId;
  title: string;
  description: string;
  /** Human-readable duration hint shown on the hub card. */
  estimatedDuration: string;
  emoji: string;
  blurb: string;
};

export type DecisionGameContext = {
  /** Immutable Tonight Queue for this Movie Night session. */
  queue: CollectionMovie[];
};
