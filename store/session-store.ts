import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  CaptureSession,
  MovieCandidate,
} from "@/lib/capture/types";
import type { DecisionGameId } from "@/lib/decision-games/types";

export type RatingSessionState = {
  kind: "rating";
  collectionId: string;
  updatedAt: string;
};

export type CaptureSessionState = {
  kind: "capture";
  step: "review" | "collections" | "context";
  session: CaptureSession;
  candidates: MovieCandidate[];
  selectedCollectionIds: string[];
  contextDraft?: RecommendationContextDraft;
  updatedAt: string;
};

export type RecommendationContextDraft = {
  selected: string;
  recommendedBy: string;
  otherSource: string;
  notes: string;
};

export type MovieNightSessionState = {
  kind: "movie-night";
  collectionId: string;
  phase: "overview" | "generating" | "games" | "play";
  gameId?: DecisionGameId;
  gameState?: unknown;
  /** Frozen from real shared ratings when this Movie Night starts. */
  queueMovieIds?: string[];
  updatedAt: string;
};

export type CurrentSession =
  | RatingSessionState
  | CaptureSessionState
  | MovieNightSessionState;

type SessionStore = {
  current: CurrentSession | null;
  setCurrentSession: (session: CurrentSession) => void;
  clearCurrentSession: (kind?: CurrentSession["kind"]) => void;
};

export const useSessionStore = create<SessionStore>()(
  persist(
    (set) => ({
      current: null,
      setCurrentSession: (session) => set({ current: session }),
      clearCurrentSession: (kind) =>
        set((state) => ({
          current:
            kind && state.current?.kind !== kind ? state.current : null,
        })),
    }),
    {
      name: "decision-current-session",
      partialize: (state) => ({ current: state.current }),
      merge: (persisted, current) => {
        const data = (persisted ?? {}) as Partial<SessionStore>;
        return {
          ...current,
          current: data.current ?? current.current,
        };
      },
    },
  ),
);

export function getCurrentSession(): CurrentSession | null {
  return useSessionStore.getState().current;
}
