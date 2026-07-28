import { create } from "zustand";
import { persist } from "zustand/middleware";

export type AppearancePreference = "system" | "dark";

type SettingsStore = {
  appearance: AppearancePreference;
  developerMode: boolean;
  analyticsOptIn: boolean;
  setAppearance: (appearance: AppearancePreference) => void;
  setDeveloperMode: (enabled: boolean) => void;
  setAnalyticsOptIn: (enabled: boolean) => void;
};

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      appearance: "dark",
      developerMode: false,
      analyticsOptIn: true,
      setAppearance: (appearance) => set({ appearance }),
      setDeveloperMode: (developerMode) => set({ developerMode }),
      setAnalyticsOptIn: (analyticsOptIn) => set({ analyticsOptIn }),
    }),
    {
      name: "pickit-settings",
      version: 1,
      partialize: (state) => ({
        appearance: state.appearance,
        developerMode: state.developerMode,
        analyticsOptIn: state.analyticsOptIn,
      }),
    },
  ),
);
