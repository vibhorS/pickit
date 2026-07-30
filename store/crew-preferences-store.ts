import { create } from "zustand";
import { persist } from "zustand/middleware";

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
};

/** Stable empty prefs object for selector snapshots. */
export const EMPTY_CREW_STREAMING_PREFERENCES: CrewStreamingPreferences = {
  streamingProviderIds: [],
};

/**
 * Stable empty id list for selectors when a crew has no prefs yet.
 * Do not allocate a new [] inside Zustand selectors.
 */
export const EMPTY_STREAMING_PROVIDER_IDS: number[] =
  EMPTY_CREW_STREAMING_PREFERENCES.streamingProviderIds;

export const useCrewPreferencesStore = create<CrewPreferencesStore>()(
  persist(
    (set, get) => ({
      byCrewId: {},

      getPreferences: (crewId) => {
        if (!crewId) return EMPTY_CREW_STREAMING_PREFERENCES;
        return get().byCrewId[crewId] ?? EMPTY_CREW_STREAMING_PREFERENCES;
      },

      setStreamingProviderIds: (crewId, streamingProviderIds) =>
        set((state) => ({
          byCrewId: {
            ...state.byCrewId,
            [crewId]: {
              ...(state.byCrewId[crewId] ?? EMPTY_CREW_STREAMING_PREFERENCES),
              streamingProviderIds: [...new Set(streamingProviderIds)],
            },
          },
        })),

      setCountry: (crewId, country) =>
        set((state) => ({
          byCrewId: {
            ...state.byCrewId,
            [crewId]: {
              ...(state.byCrewId[crewId] ?? EMPTY_CREW_STREAMING_PREFERENCES),
              country,
            },
          },
        })),
    }),
    {
      name: "pickit-crew-preferences-v1",
      version: 1,
      partialize: (state) => ({ byCrewId: state.byCrewId }),
    },
  ),
);

/**
 * Selector-safe: returns a stored array reference (or the stable empty list).
 * Expand aliases with expandCrewProviderIds in useMemo — never inside a selector.
 */
export function selectCrewStreamingProviderIds(
  state: CrewPreferencesStore,
  crewId: string | null | undefined,
): number[] {
  if (!crewId) return EMPTY_STREAMING_PROVIDER_IDS;
  return (
    state.byCrewId[crewId]?.streamingProviderIds ?? EMPTY_STREAMING_PROVIDER_IDS
  );
}
