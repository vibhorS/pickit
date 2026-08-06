import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  CaptureSession,
  MovieCandidate,
} from "@/lib/capture/types";

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

export type CurrentSession = RatingSessionState | CaptureSessionState;

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
        const next = data.current ?? current.current;
        // Drop legacy solo Movie Night session snapshots.
        if (next && (next as { kind?: string }).kind === "movie-night") {
          return { ...current, current: null };
        }
        return {
          ...current,
          current: next ?? null,
        };
      },
    },
  ),
);

export function getCurrentSession(): CurrentSession | null {
  return useSessionStore.getState().current;
}
