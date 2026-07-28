import type { DecisionGame, DecisionGameId } from "@/lib/decision-games/types";

const GAMES: DecisionGame[] = [
  {
    id: "quick-pick",
    emoji: "⚡",
    title: "Quick Pick",
    blurb: "Fastest way to decide.",
    description: "Swipe through movies until you choose one.",
    estimatedDuration: "~30 seconds",
  },
  {
    id: "roulette",
    emoji: "🎲",
    title: "Roulette",
    blurb: "Leave it to chance.",
    description: "Randomly select from tonight's queue. Spin again if needed.",
    estimatedDuration: "~15 seconds",
  },
  {
    id: "tournament",
    emoji: "🏆",
    title: "Tournament",
    blurb: "Battle movies until one winner remains.",
    description: "Keep choosing between two movies until one remains.",
    estimatedDuration: "~2 minutes",
  },
];

const BY_ID = Object.fromEntries(GAMES.map((game) => [game.id, game])) as Record<
  DecisionGameId,
  DecisionGame
>;

/** Registered decision games — append here to extend Movie Night. */
export function getDecisionGames(): DecisionGame[] {
  return GAMES;
}

export function getDecisionGame(id: DecisionGameId): DecisionGame {
  return BY_ID[id];
}
