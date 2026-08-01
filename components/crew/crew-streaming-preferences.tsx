"use client";

import { ProviderLogo } from "@/components/streaming/provider-logo";
import { uniqueCatalogForPreferences } from "@/lib/streaming/provider-catalog";
import {
  EMPTY_CREW_STREAMING_PREFERENCES,
  useCrewPreferencesStore,
} from "@/store/crew-preferences-store";

type CrewStreamingPreferencesPanelProps = {
  crewId: string;
};

export function CrewStreamingPreferencesPanel({
  crewId,
}: CrewStreamingPreferencesPanelProps) {
  const prefs = useCrewPreferencesStore(
    (state) => state.byCrewId[crewId] ?? EMPTY_CREW_STREAMING_PREFERENCES,
  );
  const setStreamingProviderIds = useCrewPreferencesStore(
    (state) => state.setStreamingProviderIds,
  );
  const catalog = uniqueCatalogForPreferences();
  const selected = new Set(prefs.streamingProviderIds);

  function toggle(providerId: number) {
    const option = catalog.find((entry) => entry.id === providerId);
    if (!option) return;

    const nextShort = option.shortName;
    const relatedIds = catalog
      .filter((entry) => entry.shortName === nextShort)
      .map((entry) => entry.id);

    const isOn = relatedIds.some((id) => selected.has(id));
    let next = [...prefs.streamingProviderIds];
    if (isOn) {
      next = next.filter((id) => !relatedIds.includes(id));
    } else {
      next = [...new Set([...next, providerId])];
    }
    setStreamingProviderIds(crewId, next);
  }

  return (
    <section className="mt-8 border-t border-white/10 pt-8">
      <h3 className="text-sm font-semibold text-white">
        Which streaming services does your household have?
      </h3>
      <p className="mt-1 text-sm text-netflix-muted">
        Movie Night only picks from titles you can actually watch tonight.
      </p>
      <ul className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {catalog.map((provider) => {
          const isSelected = selected.has(provider.id);
          const inputId = `crew-stream-${crewId}-${provider.id}`;
          return (
            <li key={provider.id}>
              <label
                htmlFor={inputId}
                className={`flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 transition ${
                  isSelected
                    ? "bg-netflix-red/15 ring-1 ring-netflix-red/50"
                    : "bg-white/[0.04] hover:bg-white/[0.07]"
                }`}
              >
                <input
                  id={inputId}
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggle(provider.id)}
                  className="size-4 shrink-0 rounded border-white/30 bg-transparent text-netflix-red focus:ring-netflix-red/40"
                />
                <ProviderLogo
                  providerId={provider.id}
                  name={provider.shortName}
                  logoPath={provider.logoPath}
                />
                <span className="text-sm text-white">{provider.shortName}</span>
              </label>
            </li>
          );
        })}
      </ul>
      {prefs.streamingProviderIds.length === 0 ? (
        <p className="mt-3 text-xs text-netflix-muted/70">
          Nothing selected yet — Movie Night will include any streamable mutual
          match until you choose.
        </p>
      ) : null}
    </section>
  );
}
