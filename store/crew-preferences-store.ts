import { create } from "zustand";
import { persist } from "zustand/middleware";
import { expandCrewProviderIds } from "@/lib/streaming/provider-catalog";

export type CrewStreamingPreferences = {
  /** Selected catalog provider ids (may be collapsed aliases). */
  streamingProviderIds: number[];
  /** Optional ISO country — reserved for crew.country later. */
  country?: string;
};

type CrewPreferencesStore = {
  byCrewId: Record<string, CrewStreamingPreferences>;
  getPreferences: (crewId: string | null | undefined) => CrewStreamingPreferences;
  setStreamingProviderIds: (
    crewId: string,
    streamingProviderIds: number[],
  ) => void;
  setCountry: (crewId: string, country: string | undefined) => void;
  /** Expanded TMDB ids for filtering (includes aliases). */
  getExpandedStreamingProviderIds: (
    crewId: string | null | undefined,
  ) => number[];
};

const EMPTY: CrewStreamingPreferences = {
  streamingProviderIds: [],
};

export const useCrewPreferencesStore = create<CrewPreferencesStore>()(
  persist(
    (set, get) => ({
      byCrewId: {},

      getPreferences: (crewId) => {
        if (!crewId) return EMPTY;
        return get().byCrewId[crewId] ?? EMPTY;
      },

      setStreamingProviderIds: (crewId, streamingProviderIds) =>
        set((state) => ({
          byCrewId: {
            ...state.byCrewId,
            [crewId]: {
              ...(state.byCrewId[crewId] ?? EMPTY),
              streamingProviderIds: [...new Set(streamingProviderIds)],
            },
          },
        })),

      setCountry: (crewId, country) =>
        set((state) => ({
          byCrewId: {
            ...state.byCrewId,
            [crewId]: {
              ...(state.byCrewId[crewId] ?? EMPTY),
              country,
            },
          },
        })),

      getExpandedStreamingProviderIds: (crewId) => {
        const prefs = get().getPreferences(crewId);
        return expandCrewProviderIds(prefs.streamingProviderIds);
      },
    }),
    {
      name: "pickit-crew-preferences-v1",
      version: 1,
      partialize: (state) => ({ byCrewId: state.byCrewId }),
    },
  ),
);
